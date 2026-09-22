import type { AppLanguage } from '../../shared/types';
import {
    collectLowercaseWords,
    countNameLetters,
    findAliasMentionSurfaces,
    findNameMentionSurfaces,
    isKnownUnion,
    personaBaseName,
    personaCharacterKey,
} from './characterName';
import { EMPTY_SLICE_FIELD } from './slice';
import { ADDRESS_TERM_CANDIDATES_BY_LANGUAGE } from './speech';
import { buildPersonaWorldCodex } from './world';
import type {
    LocalizedDialogue,
    PersonaCanonDialogueTrack,
    PersonaCanonLine,
    PersonaCanonSourceIndex,
    PersonaCanonUtterance,
    PersonaCanonUtteranceKind,
    PersonaCharacterIdentity,
    PersonaRelationAccumulator,
    PersonaRelationEvidence,
    PersonaRelationshipGraph,
    PersonaRelationshipProfile,
    PersonaRelationshipSource,
} from './types';

export const RELATION_REMARK_LIMIT = 6;
export const RELATION_SCENE_LIMIT = 2;
export const RELATION_ADDRESS_FORM_LIMIT = 2;
const SCENE_CONTEXT_RADIUS = 2;
const SCENE_LINE_LIMIT = 10;
const ALIAS_MIN_LETTERS_BY_LANGUAGE: Record<AppLanguage, number> = { ko: 2, en: 3, zh_cn: 2 };
const ALIAS_MIN_OCCURRENCES = 2;
const RELATION_KEY_SEPARATOR = '\n';

function knownText(value: string): string | null {
    const trimmed = value.trim();
    return trimmed.length === 0 || trimmed === EMPTY_SLICE_FIELD ? null : trimmed;
}

function characterKeyOf(characters: ReadonlyMap<string, PersonaCharacterIdentity>, speaker: string): string | null {
    const key = personaCharacterKey(speaker);
    return characters.has(key) ? key : null;
}

function toUtterances(
    entries: readonly LocalizedDialogue[],
    kind: PersonaCanonUtteranceKind,
    ownerKey: string,
    characters: ReadonlyMap<string, PersonaCharacterIdentity>,
): PersonaCanonUtterance[] {
    return entries.map((entry) => ({
        kind,
        owner_key: ownerKey,
        speaker: entry.speaker,
        speaker_key: characterKeyOf(characters, entry.speaker),
        message: entry.message,
    }));
}

function indexSource(source: PersonaRelationshipSource, characters: ReadonlyMap<string, PersonaCharacterIdentity>): PersonaCanonSourceIndex {
    const { slice } = source;
    const ownerKey = personaCharacterKey(slice.name);
    const monologue = [slice.description, slice.greeting]
        .flatMap((text) => knownText(text) ?? [])
        .map((message): LocalizedDialogue => ({ speaker: slice.name, message }));
    const tracks: PersonaCanonDialogueTrack[] = [slice.story, slice.evertalk]
        .map((entries) => ({ owner_key: ownerKey, lines: toUtterances(entries, 'dialogue', ownerKey, characters) }))
        .filter((track) => track.lines.length > 0);
    const utterances = [
        ...tracks.flatMap((track) => track.lines),
        ...toUtterances(slice.comments, 'comment', ownerKey, characters),
        ...toUtterances(monologue, 'monologue', ownerKey, characters),
        ...toUtterances(slice.speech_patterns, 'pattern', ownerKey, characters),
    ];
    return {
        persona_id: source.persona_id,
        owner_key: ownerKey,
        utterances,
        tracks,
        text: utterances.map((utterance) => `${utterance.speaker}\n${utterance.message}`).join('\n'),
    };
}

function buildCharacterIdentities(sources: readonly PersonaRelationshipSource[]): Map<string, PersonaCharacterIdentity> {
    const characters = new Map<string, PersonaCharacterIdentity>();
    for (const source of sources) {
        const { slice } = source;
        const key = personaCharacterKey(slice.name);
        const baseName = personaBaseName(slice.name);
        const identity = characters.get(key) ?? {
            key,
            base_name: baseName,
            lowered_base_name: baseName.toLocaleLowerCase(),
            persona_ids: [],
            aliases: [],
            nick_name: null,
            unions: [],
        };
        identity.persona_ids.push(source.persona_id);
        const nickName = knownText(slice.nick_name);
        if (nickName !== null && (identity.nick_name === null || slice.name === baseName)) {
            identity.nick_name = nickName;
        }
        const union = knownText(slice.union);
        if (union !== null && isKnownUnion(union) && !identity.unions.includes(union)) {
            identity.unions.push(union);
        }
        characters.set(key, identity);
    }
    return characters;
}

function addDatasetSpeakerIdentities(
    characters: Map<string, PersonaCharacterIdentity>,
    sources: readonly PersonaRelationshipSource[],
    language: AppLanguage,
): void {
    const addressTerms = new Set(ADDRESS_TERM_CANDIDATES_BY_LANGUAGE[language]);
    for (const { slice } of sources) {
        for (const line of [...slice.comments, ...slice.story, ...slice.evertalk]) {
            const baseName = personaBaseName(line.speaker);
            const key = personaCharacterKey(line.speaker);
            if (baseName.length === 0 || baseName === EMPTY_SLICE_FIELD || addressTerms.has(baseName) || characters.has(key)) {
                continue;
            }
            characters.set(key, {
                key,
                base_name: baseName,
                lowered_base_name: baseName.toLocaleLowerCase(),
                persona_ids: [],
                aliases: [],
                nick_name: null,
                unions: [],
            });
        }
    }
}

function aliasCandidates(identity: PersonaCharacterIdentity, characters: ReadonlyMap<string, PersonaCharacterIdentity>, language: AppLanguage): string[] {
    const letters = Array.from(identity.base_name);
    const minimumLetters = ALIAS_MIN_LETTERS_BY_LANGUAGE[language];
    if (countNameLetters(identity.base_name) <= minimumLetters || letters.some((character) => /[\s.'-]/u.test(character))) {
        return [];
    }
    const otherBaseNames = [...characters.values()].filter((other) => other.key !== identity.key).map((other) => other.base_name);
    return Array.from({ length: letters.length - minimumLetters }, (_, index) => letters.slice(0, minimumLetters + index).join(''))
        .filter((prefix) => !otherBaseNames.some((otherName) => otherName.startsWith(prefix)));
}

function resolveAliases(
    characters: Map<string, PersonaCharacterIdentity>,
    indexes: readonly PersonaCanonSourceIndex[],
    language: AppLanguage,
): void {
    const lowercaseWords = collectLowercaseWords(indexes.map((index) => index.text));
    for (const identity of characters.values()) {
        const relatedTexts = indexes
            .filter((index) => index.owner_key === identity.key || index.text.includes(identity.base_name))
            .map((index) => index.text);
        identity.aliases = aliasCandidates(identity, characters, language)
            .filter((alias) => !lowercaseWords.has(alias.toLocaleLowerCase()))
            .filter((alias) => relatedTexts.reduce(
                (count, text) => count + (text.includes(alias) ? findAliasMentionSurfaces(text, alias, identity.base_name, language).length : 0),
                0,
            ) >= ALIAS_MIN_OCCURRENCES);
    }
}

function relationKey(selfKey: string, otherKey: string): string {
    return `${selfKey}${RELATION_KEY_SEPARATOR}${otherKey}`;
}

function accumulator(store: Map<string, PersonaRelationAccumulator>, selfKey: string, otherKey: string): PersonaRelationAccumulator {
    const key = relationKey(selfKey, otherKey);
    const existing = store.get(key);
    if (existing) {
        return existing;
    }
    const created: PersonaRelationAccumulator = {
        address_forms: new Map(),
        self_remarks: [],
        other_remarks: [],
        remark_keys: new Set(),
        shared_scenes: [],
        scene_keys: new Set(),
        interaction_count: 0,
        mention_count: 0,
    };
    store.set(key, created);
    return created;
}

function addRemark(target: PersonaRelationAccumulator, bucket: 'self_remarks' | 'other_remarks', message: string): void {
    const remarkKey = `${bucket}${RELATION_KEY_SEPARATOR}${message}`;
    if (target.remark_keys.has(remarkKey)) {
        return;
    }
    target.remark_keys.add(remarkKey);
    target[bucket].push(message);
}

function addScene(target: PersonaRelationAccumulator, scene: PersonaCanonLine[]): void {
    const sceneKey = scene.map((line) => `${line.speaker}:${line.message}`).join('\n');
    if (target.scene_keys.has(sceneKey)) {
        return;
    }
    target.scene_keys.add(sceneKey);
    target.shared_scenes.push(scene);
}

function mentionSurfaces(message: string, identity: PersonaCharacterIdentity, language: AppLanguage, loweredMessage = message.toLocaleLowerCase()): string[] {
    const nameSurfaces = loweredMessage.includes(identity.lowered_base_name)
        ? findNameMentionSurfaces(message, identity.base_name, language)
        : [];
    const aliasSurfaces = identity.aliases
        .filter((alias) => message.includes(alias))
        .flatMap((alias) => findAliasMentionSurfaces(message, alias, identity.base_name, language));
    return [...nameSurfaces, ...aliasSurfaces];
}

function accumulateMentions(
    store: Map<string, PersonaRelationAccumulator>,
    index: PersonaCanonSourceIndex,
    characters: ReadonlyMap<string, PersonaCharacterIdentity>,
    language: AppLanguage,
): void {
    for (const utterance of index.utterances) {
        const speakerKey = utterance.speaker_key;
        if (speakerKey === null) {
            continue;
        }
        const loweredMessage = utterance.message.toLocaleLowerCase();
        for (const identity of characters.values()) {
            if (identity.key === speakerKey) {
                continue;
            }
            const surfaces = mentionSurfaces(utterance.message, identity, language, loweredMessage);
            if (surfaces.length === 0) {
                continue;
            }
            const outgoing = accumulator(store, speakerKey, identity.key);
            const incoming = accumulator(store, identity.key, speakerKey);
            addRemark(outgoing, 'self_remarks', utterance.message);
            addRemark(incoming, 'other_remarks', utterance.message);
            outgoing.mention_count += 1;
            incoming.mention_count += 1;
            for (const surface of surfaces) {
                outgoing.address_forms.set(surface, (outgoing.address_forms.get(surface) ?? 0) + 1);
            }
        }
    }
}

function accumulateComments(store: Map<string, PersonaRelationAccumulator>, index: PersonaCanonSourceIndex): void {
    for (const utterance of index.utterances) {
        if (utterance.kind !== 'comment' || utterance.speaker_key === null || utterance.speaker_key === index.owner_key) {
            continue;
        }
        const outgoing = accumulator(store, utterance.speaker_key, index.owner_key);
        const incoming = accumulator(store, index.owner_key, utterance.speaker_key);
        addRemark(outgoing, 'self_remarks', utterance.message);
        addRemark(incoming, 'other_remarks', utterance.message);
        outgoing.interaction_count += 1;
        incoming.interaction_count += 1;
    }
}

function sceneLines(lines: readonly PersonaCanonUtterance[], start: number, end: number): PersonaCanonLine[] {
    const scene: PersonaCanonLine[] = [];
    for (const line of lines.slice(start, end + 1)) {
        const previous = scene.at(-1);
        if (previous?.speaker === line.speaker && previous.message === line.message) {
            continue;
        }
        scene.push({ speaker: line.speaker, message: line.message });
    }
    return scene.slice(0, SCENE_LINE_LIMIT);
}

function accumulateSharedScenes(
    store: Map<string, PersonaRelationAccumulator>,
    track: PersonaCanonDialogueTrack,
    characters: ReadonlyMap<string, PersonaCharacterIdentity>,
    language: AppLanguage,
): void {
    const { lines, owner_key: ownerKey } = track;
    const owner = characters.get(ownerKey);
    let index = 0;
    while (index < lines.length) {
        const visitorKey = lines[index].speaker_key;
        if (visitorKey === null || visitorKey === ownerKey) {
            index += 1;
            continue;
        }
        let clusterEnd = index;
        let visitorLines = 0;
        for (let cursor = index; cursor < lines.length && cursor <= clusterEnd + SCENE_CONTEXT_RADIUS; cursor += 1) {
            if (lines[cursor].speaker_key === visitorKey) {
                clusterEnd = cursor;
                visitorLines += 1;
            }
        }
        const start = Math.max(0, index - SCENE_CONTEXT_RADIUS);
        const end = Math.min(lines.length - 1, clusterEnd + SCENE_CONTEXT_RADIUS);
        const window = lines.slice(start, end + 1);
        const ownerSpeaks = window.some((line) => line.speaker_key === ownerKey);
        const visitorMentionsOwner = owner !== undefined
            && window.some((line) => line.speaker_key === visitorKey && mentionSurfaces(line.message, owner, language).length > 0);
        const outgoing = accumulator(store, visitorKey, ownerKey);
        const incoming = accumulator(store, ownerKey, visitorKey);
        outgoing.interaction_count += visitorLines;
        incoming.interaction_count += visitorLines;
        if (ownerSpeaks || visitorMentionsOwner) {
            const scene = sceneLines(lines, start, end);
            addScene(outgoing, scene);
            addScene(incoming, scene);
        }
        index = clusterEnd + 1;
    }
}

function topAddressForms(forms: ReadonlyMap<string, number>): string[] {
    return [...forms.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, RELATION_ADDRESS_FORM_LIMIT)
        .map(([form]) => form);
}

function relationEvidence(
    self: PersonaRelationshipSource,
    other: PersonaCharacterIdentity,
    evidence: PersonaRelationAccumulator | undefined,
): PersonaRelationEvidence {
    const selfUnion = knownText(self.slice.union);
    const sharedUnion = selfUnion !== null && isKnownUnion(selfUnion) && other.unions.includes(selfUnion) ? selfUnion : null;
    return {
        character_key: other.key,
        name: other.base_name,
        persona_ids: [...other.persona_ids],
        nick_name: other.nick_name,
        unions: [...other.unions],
        shared_union: sharedUnion,
        address_forms: evidence === undefined ? [] : topAddressForms(evidence.address_forms),
        self_remarks: evidence?.self_remarks.slice(0, RELATION_REMARK_LIMIT) ?? [],
        other_remarks: evidence?.other_remarks.slice(0, RELATION_REMARK_LIMIT) ?? [],
        shared_scenes: evidence?.shared_scenes.slice(0, RELATION_SCENE_LIMIT) ?? [],
        interaction_count: evidence?.interaction_count ?? 0,
        mention_count: evidence?.mention_count ?? 0,
    };
}

function hasRelationEvidence(relation: PersonaRelationEvidence): boolean {
    return relation.interaction_count > 0 || relation.mention_count > 0 || relation.shared_union !== null;
}

export function compareRelationStrength(left: PersonaRelationEvidence, right: PersonaRelationEvidence): number {
    return right.interaction_count - left.interaction_count
        || right.mention_count - left.mention_count
        || Number(right.shared_union !== null) - Number(left.shared_union !== null)
        || left.name.localeCompare(right.name);
}

function externalVoiceLines(self: PersonaRelationshipSource, indexes: readonly PersonaCanonSourceIndex[]): string[] {
    return indexes
        .filter((index) => index.persona_id !== self.persona_id)
        .flatMap((index) => index.utterances)
        .filter((utterance) => (utterance.kind === 'dialogue' || utterance.kind === 'comment') && utterance.speaker === self.slice.name)
        .map((utterance) => utterance.message);
}

export function buildPersonaRelationshipGraph(
    sources: readonly PersonaRelationshipSource[],
    language: AppLanguage,
    fingerprint: string,
): PersonaRelationshipGraph {
    const characters = buildCharacterIdentities(sources);
    addDatasetSpeakerIdentities(characters, sources, language);
    const indexes = sources.map((source) => indexSource(source, characters));
    resolveAliases(characters, indexes, language);
    const store = new Map<string, PersonaRelationAccumulator>();
    for (const index of indexes) {
        accumulateComments(store, index);
        accumulateMentions(store, index, characters, language);
        for (const track of index.tracks) {
            accumulateSharedScenes(store, track, characters, language);
        }
    }
    const characterKeyByPersona = new Map(sources.map((source) => [source.persona_id, personaCharacterKey(source.slice.name)]));
    const world = buildPersonaWorldCodex(sources);
    const profiles = new Map<string, PersonaRelationshipProfile>();
    for (const source of sources) {
        const selfKey = personaCharacterKey(source.slice.name);
        const relations = [...characters.values()]
            .filter((other) => other.key !== selfKey)
            .map((other) => relationEvidence(source, other, store.get(relationKey(selfKey, other.key))))
            .filter(hasRelationEvidence)
            .sort(compareRelationStrength);
        profiles.set(source.persona_id, {
            persona_id: source.persona_id,
            character_key: selfKey,
            relations,
            external_voice_lines: externalVoiceLines(source, indexes),
        });
    }
    return { language, fingerprint, characters, character_key_by_persona: characterKeyByPersona, profiles, world };
}

export function countCharacterMentions(graph: PersonaRelationshipGraph, personaId: string, texts: readonly string[]): number {
    const characterKey = graph.character_key_by_persona.get(personaId);
    const identity = characterKey === undefined ? undefined : graph.characters.get(characterKey);
    if (identity === undefined) {
        return 0;
    }
    return texts.reduce((total, text) => total + (mentionSurfaces(text.normalize('NFC'), identity, graph.language).length > 0 ? 1 : 0), 0);
}

export function findRelationForCharacter(
    graph: PersonaRelationshipGraph,
    personaId: string,
    characterKey: string,
): PersonaRelationEvidence | null {
    const profile = graph.profiles.get(personaId);
    if (!profile || profile.character_key === characterKey) {
        return null;
    }
    const known = profile.relations.find((relation) => relation.character_key === characterKey);
    if (known) {
        return known;
    }
    const identity = graph.characters.get(characterKey);
    return identity === undefined ? null : {
        character_key: identity.key,
        name: identity.base_name,
        persona_ids: [...identity.persona_ids],
        nick_name: identity.nick_name,
        unions: [...identity.unions],
        shared_union: null,
        address_forms: [],
        self_remarks: [],
        other_remarks: [],
        shared_scenes: [],
        interaction_count: 0,
        mention_count: 0,
    };
}

export function findMentionedCharacterKeys(
    graph: PersonaRelationshipGraph,
    personaId: string,
    text: string,
    candidateKeys: ReadonlySet<string>,
): string[] {
    const profile = graph.profiles.get(personaId);
    if (!profile) {
        return [];
    }
    const normalized = text.normalize('NFC');
    return [...candidateKeys]
        .filter((key) => key !== profile.character_key)
        .filter((key) => {
            const identity = graph.characters.get(key);
            return identity !== undefined && mentionSurfaces(normalized, identity, graph.language).length > 0;
        });
}
