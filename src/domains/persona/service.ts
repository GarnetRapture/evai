import { DomainError, describeUnknownError } from '../../shared/errors';
import { pickLocalized } from '../../shared/i18n';
import { createMonotonicTimestamp } from '../../shared/time';
import type { AppLanguage } from '../../shared/types';
import { chatRepository } from '../chat/repository';
import { listPersonaArchiveKeys, loadPersonaPack, normalizePersonaKey } from './archive';
import {
    BOND_STAGE_DIALOGUE_EXAMPLE_LIMIT,
    RELEVANT_DIALOGUE_EXAMPLE_LIMIT,
    parsePersonaDialogueExchanges,
    selectBondStageDialogueExamples,
    selectRelevantDialogueExamples,
    selectRepresentativeDialogueExamples,
    selectStageReachedDialogueExchanges,
} from './dialogue';
import { FAMILIARITY_MAX_LEVEL } from './familiarity';
import { personaCheatPresetKey, resolveActivePersonaCheatPreset, resolvePersonaFamiliarityScore } from './presets';
import {
    buildPersonaSystemPrompt,
    findPersonaProfileMentions,
    personaGreetingFromPack,
} from './prompt';
import { buildPersonaRelationshipGraph, findMentionedCharacterKeys, findRelationForCharacter } from './relationship';
import { personaRepository } from './repository';
import { buildPersonaLanguageSlice } from './slice';
import type {
    AssembledPersonaPrompt,
    PersonaCheatPreset,
    PersonaCheatSettingsSource,
    BondRankingEntry,
    FamiliarityEntry,
    PersonaDialogueExchange,
    PersonaLanguageSlice,
    PersonaRelationEvidence,
    PersonaRelationshipGraph,
    PersonaRelationshipGraphMemo,
    PersonaTurnReferenceRequest,
    PersonaTurnReferences,
    SpiritDetail,
    StoredPersonaProfile,
} from './types';

const DEFAULT_PROFILE_FIELD = '-';
const assembledPromptMemo = new Map<string, AssembledPersonaPrompt>();
const languageSliceMemo = new Map<string, PersonaLanguageSlice>();
const dialogueExchangeMemo = new Map<string, PersonaDialogueExchange[]>();
const relationshipGraphMemo = new Map<AppLanguage, PersonaRelationshipGraphMemo>();
const BOND_MEMORY_WEIGHT = 3;
const ROSTER_FINGERPRINT_SEPARATOR = '\n';

export function personaNotFoundError(id: string): DomainError {
    return new DomainError('not_found', id);
}

function personaSourceKey(persona: StoredPersonaProfile, language: AppLanguage): string {
    return JSON.stringify([persona.id, language, persona.created_at]);
}

function memoizedLanguageSlice(persona: StoredPersonaProfile, language: AppLanguage): PersonaLanguageSlice {
    const key = personaSourceKey(persona, language);
    const memoized = languageSliceMemo.get(key);
    if (memoized) {
        return memoized;
    }
    const slice = buildPersonaLanguageSlice(JSON.parse(persona.raw_json) as SpiritDetail, language);
    languageSliceMemo.set(key, slice);
    return slice;
}

function memoizedDialogueExchanges(persona: StoredPersonaProfile, language: AppLanguage): PersonaDialogueExchange[] {
    const key = personaSourceKey(persona, language);
    const memoized = dialogueExchangeMemo.get(key);
    if (memoized) {
        return memoized;
    }
    const exchanges = parsePersonaDialogueExchanges(memoizedLanguageSlice(persona, language), language);
    dialogueExchangeMemo.set(key, exchanges);
    return exchanges;
}

function rosterFingerprint(personaIds: readonly string[]): string {
    return [...personaIds].sort().join(ROSTER_FINGERPRINT_SEPARATOR);
}

async function loadRelationshipGraph(language: AppLanguage): Promise<PersonaRelationshipGraph> {
    const fingerprint = rosterFingerprint(await personaRepository.listPersonaIds());
    const memoized = relationshipGraphMemo.get(language);
    if (memoized?.fingerprint === fingerprint) {
        return memoized.graph;
    }
    const graph = personaRepository.listPersonas().then((personas) => buildPersonaRelationshipGraph(
        personas.map((persona) => ({ persona_id: persona.id, slice: memoizedLanguageSlice(persona, language) })),
        language,
        fingerprint,
    ));
    relationshipGraphMemo.set(language, { fingerprint, graph });
    try {
        return await graph;
    }
    catch (error) {
        if (relationshipGraphMemo.get(language)?.graph === graph) {
            relationshipGraphMemo.delete(language);
        }
        throw error;
    }
}

function relationsForPersonaIds(graph: PersonaRelationshipGraph, personaId: string, personaIds: readonly string[]): PersonaRelationEvidence[] {
    const characterKeys = new Set(personaIds.flatMap((id) => graph.character_key_by_persona.get(id) ?? []));
    return [...characterKeys].flatMap((key) => findRelationForCharacter(graph, personaId, key) ?? []);
}

function primingExchanges(exchanges: PersonaDialogueExchange[], familiarityLevel: number): PersonaDialogueExchange[] {
    return selectRepresentativeDialogueExamples(selectStageReachedDialogueExchanges(exchanges, familiarityLevel, FAMILIARITY_MAX_LEVEL));
}

async function requirePersona(id: string): Promise<StoredPersonaProfile> {
    const persona = await personaRepository.getPersona(id);
    if (!persona) {
        throw personaNotFoundError(id);
    }
    return persona;
}

export const personaService = {
    async installPreset(archiveKey: string, language: AppLanguage): Promise<StoredPersonaProfile> {
        const pack = await loadPersonaPack(archiveKey);
        const nameEn = pack.name_en ?? archiveKey;
        const persona: StoredPersonaProfile = {
            id: normalizePersonaKey(nameEn),
            name: pack.name ?? archiveKey,
            name_en: nameEn,
            grade: pack.grade ?? DEFAULT_PROFILE_FIELD,
            race: pack.race ?? DEFAULT_PROFILE_FIELD,
            class: pack.class ?? DEFAULT_PROFILE_FIELD,
            sub_class: pack.sub_class ?? DEFAULT_PROFILE_FIELD,
            greeting: personaGreetingFromPack(pack, language),
            personality_override: null,
            raw_json: JSON.stringify(pack),
            created_at: createMonotonicTimestamp(),
            archive_key: archiveKey,
        };
        await personaRepository.savePersona(persona);
        return persona;
    },
    async ensureArchivePersonasInstalled(language: AppLanguage, onArchiveProcessed?: (current: number, total: number) => void): Promise<void> {
        const existing = await personaRepository.listPersonas();
        const existingKeys = new Set<string>();
        for (const persona of existing) {
            existingKeys.add(persona.id.toLowerCase());
            existingKeys.add(persona.name_en.toLowerCase());
            existingKeys.add(normalizePersonaKey(persona.name_en));
            existingKeys.add(persona.archive_key);
        }
        const archiveKeys = listPersonaArchiveKeys();
        for (const [index, archiveKey] of archiveKeys.entries()) {
            const installed = existingKeys.has(archiveKey)
                || existingKeys.has(archiveKey.toLowerCase())
                || existingKeys.has(normalizePersonaKey(archiveKey));
            if (!installed) {
                try {
                    await personaService.installPreset(archiveKey, language);
                }
                catch (error) {
                    console.error(pickLocalized(
                        language,
                        `페르소나 프리셋 수립 실패: ${describeUnknownError(error)}`,
                        `Failed to install persona preset: ${describeUnknownError(error)}`,
                        `精灵预设安装失败：${describeUnknownError(error)}`,
                    ));
                }
            }
            onArchiveProcessed?.(index + 1, archiveKeys.length);
        }
    },
    async getAvailablePersonas(language: AppLanguage): Promise<StoredPersonaProfile[]> {
        await personaService.ensureArchivePersonasInstalled(language);
        return personaRepository.listPersonas();
    },
    async getAssembledPersonaPrompt(
        id: string,
        language: AppLanguage,
        saviorName = '',
        cheatPreset: PersonaCheatPreset | null = null,
    ): Promise<AssembledPersonaPrompt> {
        const persona = await personaRepository.getPersona(id);
        if (!persona) {
            throw personaNotFoundError(id);
        }
        const normalizedSaviorName = saviorName.trim();
        const presetKey = personaCheatPresetKey(cheatPreset);
        const sourceUpdatedAt = persona.personality_override?.updated_at ?? persona.created_at;
        const memoKey = `${persona.id}\u0000${language}\u0000${sourceUpdatedAt}\u0000${normalizedSaviorName}\u0000${presetKey}`;
        const graph = await loadRelationshipGraph(language);
        const graphMemoKey = JSON.stringify([memoKey, graph.fingerprint]);
        const memoized = assembledPromptMemo.get(graphMemoKey);
        if (memoized) {
            return memoized;
        }
        const assembled = buildPersonaSystemPrompt(
            memoizedLanguageSlice(persona, language),
            language,
            normalizedSaviorName,
            persona.personality_override,
            cheatPreset,
            graph.profiles.get(persona.id) ?? null,
        );
        assembledPromptMemo.set(graphMemoKey, assembled);
        if (normalizedSaviorName.length > 0 || cheatPreset !== null) {
            return assembled;
        }
        const cached = await personaRepository.getLocalizedPrompt(persona.id, language, sourceUpdatedAt);
        if (!cached || cached.assembled_prompt !== assembled.assembled_prompt || cached.localized_name !== assembled.localized_name) {
            await personaRepository.saveLocalizedPrompt({
                persona_id: persona.id,
                language,
                localized_name: assembled.localized_name,
                assembled_prompt: assembled.assembled_prompt,
                speech_profile: assembled.speech_profile,
                source_updated_at: sourceUpdatedAt,
                cached_at: createMonotonicTimestamp(),
            });
        }
        return assembled;
    },
    async getPrimingDialogueExchanges(id: string, language: AppLanguage, familiarityLevel: number): Promise<PersonaDialogueExchange[]> {
        const persona = await requirePersona(id);
        return primingExchanges(memoizedDialogueExchanges(persona, language), familiarityLevel);
    },
    async getTurnPersonaReferences(request: PersonaTurnReferenceRequest): Promise<PersonaTurnReferences> {
        const { language, query, familiarity_level: familiarityLevel } = request;
        const persona = await requirePersona(request.persona_id);
        const slice = memoizedLanguageSlice(persona, language);
        const exchanges = memoizedDialogueExchanges(persona, language);
        const primed = primingExchanges(exchanges, familiarityLevel);
        const primedSet = new Set(primed);
        const stageReached = selectStageReachedDialogueExchanges(exchanges, familiarityLevel, FAMILIARITY_MAX_LEVEL)
            .filter((exchange) => !primedSet.has(exchange));
        const topical = selectRelevantDialogueExamples(stageReached, query, RELEVANT_DIALOGUE_EXAMPLE_LIMIT, request.excluded_terms);
        const bondStage = selectBondStageDialogueExamples(
            exchanges,
            familiarityLevel,
            FAMILIARITY_MAX_LEVEL,
            BOND_STAGE_DIALOGUE_EXAMPLE_LIMIT,
            query,
            [...primed, ...topical],
        );
        const graph = await loadRelationshipGraph(language);
        const canonRelationKeys = (graph.profiles.get(persona.id)?.relations ?? []).map((relation) => relation.character_key);
        const chattedKeys = request.mention_candidate_ids.flatMap((id) => graph.character_key_by_persona.get(id) ?? []);
        const mentionedKeys = findMentionedCharacterKeys(graph, persona.id, query, new Set([...canonRelationKeys, ...chattedKeys]));
        return {
            rehearsal_exchanges: [...bondStage, ...topical],
            profile_mentions: findPersonaProfileMentions(slice, query),
            mentioned_relations: mentionedKeys.flatMap((key) => findRelationForCharacter(graph, persona.id, key) ?? []),
            rival_relations: relationsForPersonaIds(graph, persona.id, request.rival_persona_ids),
        };
    },
    async getEmotionSeedText(id: string, language: AppLanguage): Promise<string> {
        const persona = await personaRepository.getPersona(id);
        if (!persona) throw personaNotFoundError(id);
        const pack = JSON.parse(persona.raw_json) as SpiritDetail;
        const slice = buildPersonaLanguageSlice(pack, language);
        return [
            persona.personality_override?.personality || slice.description,
            persona.personality_override?.greeting || slice.greeting,
            ...slice.speech_patterns
                .filter((entry) => entry.speaker === slice.name)
                .slice(0, 24)
                .map((entry) => entry.message),
        ].join('\n');
    },
    async warmLocalizedPrompts(language: AppLanguage, onPersonaCached?: (current: number, total: number) => void): Promise<void> {
        const personas = await personaRepository.listPersonas();
        for (const [index, persona] of personas.entries()) {
            try {
                await personaService.getAssembledPersonaPrompt(persona.id, language);
            }
            catch (error) {
                console.error(pickLocalized(
                    language,
                    `정령 프롬프트 사전 캐시 실패 (${persona.id}/${language}): ${describeUnknownError(error)}`,
                    `Failed to pre-cache persona prompt (${persona.id}/${language}): ${describeUnknownError(error)}`,
                    `精灵提示词预缓存失败（${persona.id}/${language}）：${describeUnknownError(error)}`,
                ));
            }
            onPersonaCached?.(index + 1, personas.length);
        }
    },
    async getBondRanking(): Promise<BondRankingEntry[]> {
        const [personas, messageCounts, memoryCounts] = await Promise.all([
            personaRepository.listPersonas(),
            chatRepository.countMessagesByPersona(),
            chatRepository.countEpisodicMemoriesByPersona(),
        ]);
        const entries: BondRankingEntry[] = [];
        for (const persona of personas) {
            const messageCount = messageCounts.get(persona.id) ?? 0;
            const memoryCount = memoryCounts.get(persona.id) ?? 0;
            if (messageCount === 0 && memoryCount === 0) {
                continue;
            }
            entries.push({
                persona_id: persona.id,
                name: persona.name,
                name_en: persona.name_en,
                message_count: messageCount,
                memory_count: memoryCount,
                bond_score: messageCount + memoryCount * BOND_MEMORY_WEIGHT,
            });
        }
        return entries.sort((left, right) => right.bond_score - left.bond_score);
    },
    async getFamiliarityList(cheatSource: PersonaCheatSettingsSource): Promise<FamiliarityEntry[]> {
        const [personas, messageCounts, memoryCounts] = await Promise.all([
            personaRepository.listPersonas(),
            chatRepository.countMessagesByPersona(),
            chatRepository.countEpisodicMemoriesByPersona(),
        ]);
        const entries: FamiliarityEntry[] = [];
        for (const persona of personas) {
            const messageCount = messageCounts.get(persona.id) ?? 0;
            const memoryCount = memoryCounts.get(persona.id) ?? 0;
            const cheatLevel = resolveActivePersonaCheatPreset(cheatSource, persona.id)?.bond_level ?? null;
            if (messageCount === 0 && memoryCount === 0 && cheatLevel === null) {
                continue;
            }
            entries.push({
                persona_id: persona.id,
                name: persona.name,
                name_en: persona.name_en,
                message_count: messageCount,
                memory_count: memoryCount,
                familiarity_score: resolvePersonaFamiliarityScore(messageCount, memoryCount, cheatLevel),
            });
        }
        return entries.sort((left, right) => right.familiarity_score - left.familiarity_score);
    },
};
