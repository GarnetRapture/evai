import { DomainError, describeUnknownError } from '../../shared/errors';
import { pickLocalized } from '../../shared/i18n';
import { createMonotonicTimestamp } from '../../shared/time';
import type { AppLanguage } from '../../shared/types';
import { chatRepository } from '../chat/repository';
import { listPersonaArchiveKeys, loadPersonaPack, normalizePersonaKey } from './archive';
import {
    hasDialogueLexicalOverlap,
    parsePersonaDialogueExchanges,
    selectRelevantDialogueExamples,
} from './dialogue';
import { familiarityScore } from './familiarity';
import {
    buildPersonaPromptFromPack,
    personaGreetingFromPack,
    wrapAssembledPersonaPrompt,
} from './prompt';
import { personaRepository } from './repository';
import { buildPersonaLanguageSlice } from './slice';
import type {
    AssembledPersonaPrompt,
    BondRankingEntry,
    FamiliarityEntry,
    PersonaDialogueExchange,
    SpiritDetail,
    StoredPersonaProfile,
} from './types';

const DEFAULT_PROFILE_FIELD = '-';
const assembledPromptMemo = new Map<string, AssembledPersonaPrompt>();
const BOND_MEMORY_WEIGHT = 3;

export function personaNotFoundError(id: string): DomainError {
    return new DomainError('not_found', id);
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
            system_prompt: buildPersonaPromptFromPack(pack, language).body,
            greeting: personaGreetingFromPack(pack, language),
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
    async getAssembledPersonaPrompt(id: string, language: AppLanguage, saviorName = ''): Promise<AssembledPersonaPrompt> {
        const persona = await personaRepository.getPersona(id);
        if (!persona) {
            throw personaNotFoundError(id);
        }
        const normalizedSaviorName = saviorName.trim();
        const memoKey = `${persona.id}\u0000${language}\u0000${persona.created_at}\u0000${normalizedSaviorName}`;
        const memoized = assembledPromptMemo.get(memoKey);
        if (memoized) {
            return memoized;
        }
        const pack = JSON.parse(persona.raw_json) as SpiritDetail;
        const localized = buildPersonaPromptFromPack(pack, language);
        const assembled: AssembledPersonaPrompt = {
            localized_name: localized.localized_name,
            assembled_prompt: wrapAssembledPersonaPrompt(
                localized.localized_name,
                localized.body,
                language,
                localized.speech_profile,
                normalizedSaviorName,
            ),
            speech_profile: localized.speech_profile,
        };
        assembledPromptMemo.set(memoKey, assembled);
        if (normalizedSaviorName.length > 0) {
            return assembled;
        }
        const cached = await personaRepository.getLocalizedPrompt(persona.id, language, persona.created_at);
        if (!cached || cached.assembled_prompt !== assembled.assembled_prompt || cached.localized_name !== assembled.localized_name) {
            await personaRepository.saveLocalizedPrompt({
                persona_id: persona.id,
                language,
                localized_name: assembled.localized_name,
                assembled_prompt: assembled.assembled_prompt,
                speech_profile: assembled.speech_profile,
                source_updated_at: persona.created_at,
                cached_at: createMonotonicTimestamp(),
            });
        }
        return assembled;
    },
    async getRelevantDialogueExamples(
        id: string,
        language: AppLanguage,
        query: string,
        limit: number,
    ): Promise<PersonaDialogueExchange[]> {
        const persona = await personaRepository.getPersona(id);
        if (!persona) {
            throw personaNotFoundError(id);
        }
        const pack = JSON.parse(persona.raw_json) as SpiritDetail;
        const slice = buildPersonaLanguageSlice(pack, language);
        const selected = selectRelevantDialogueExamples(parsePersonaDialogueExchanges(slice, language), query, limit);
        if (selected.length >= limit || !hasDialogueLexicalOverlap(query, slice.greeting)) {
            return selected;
        }
        return [
            {
                source: 'greeting' as const,
                user_message: query,
                spirit_messages: [slice.greeting],
            },
            ...selected,
        ].slice(0, limit);
    },
    async getEmotionSeedText(id: string, language: AppLanguage): Promise<string> {
        const persona = await personaRepository.getPersona(id);
        if (!persona) throw personaNotFoundError(id);
        const pack = JSON.parse(persona.raw_json) as SpiritDetail;
        const slice = buildPersonaLanguageSlice(pack, language);
        return [
            slice.description,
            slice.greeting,
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
    async getFamiliarityList(): Promise<FamiliarityEntry[]> {
        const [personas, messageCounts, memoryCounts] = await Promise.all([
            personaRepository.listPersonas(),
            chatRepository.countMessagesByPersona(),
            chatRepository.countEpisodicMemoriesByPersona(),
        ]);
        const entries: FamiliarityEntry[] = [];
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
                familiarity_score: familiarityScore(messageCount, memoryCount),
            });
        }
        return entries.sort((left, right) => right.familiarity_score - left.familiarity_score);
    },
};
