import { pickLocalized } from '../../shared/i18n';
import type { AppLanguage } from '../../shared/types';
import { extractKnowledgeKeywords } from '../knowledge/keywords';
import type { KnowledgeChunk } from '../knowledge/types';
import { isKnownUnion, personaBaseName } from './characterName';
import { isSaviorSpeaker } from './dialogue';
import { EMPTY_SLICE_FIELD } from './slice';
import type {
    LocalizedDialogue,
    PersonaLanguageSlice,
    PersonaRelationshipSource,
    PersonaWorldCanonLine,
    PersonaWorldCodex,
    PersonaWorldGroup,
    PersonaWorldGroupAccumulator,
    PersonaWorldPlacement,
} from './types';

export const PERSONA_WORLD_DOCUMENT_PREFIX = 'eversoul-world';
export const PERSONA_STORY_DOCUMENT_PREFIX = 'eversoul-story';
export const PERSONA_WORLD_UNION_KEY = '에덴';
const WORLD_GROUP_PROMPT_MEMBER_LIMIT = 12;
const WORLD_CANON_PROMPT_LINE_LIMIT = 10;
const WORLD_CANON_LINE_CHAR_LIMIT = 160;
const STORY_CHUNK_SAVIOR_GROUPS = 2;
const WORLD_LIST_SEPARATOR = ', ';

function clipWorldLine(text: string): string {
    const normalized = text.replace(/\s+/gu, ' ').trim();
    return normalized.length <= WORLD_CANON_LINE_CHAR_LIMIT ? normalized : `${normalized.slice(0, WORLD_CANON_LINE_CHAR_LIMIT).trimEnd()}...`;
}

function sliceCanonLines(slice: PersonaLanguageSlice): LocalizedDialogue[] {
    const monologue = [slice.description, slice.greeting]
        .map((text) => text.trim())
        .filter((text) => text.length > 0 && text !== EMPTY_SLICE_FIELD)
        .map((message) => ({ speaker: slice.name, message }));
    return [...monologue, ...slice.speech_patterns, ...slice.story, ...slice.evertalk, ...slice.comments];
}

function resolveWorldName(sources: readonly PersonaRelationshipSource[]): string | null {
    const worldSource = sources.find((source) => source.world_union_key === PERSONA_WORLD_UNION_KEY);
    const name = worldSource === undefined ? '' : worldSource.slice.union.trim();
    return name.length === 0 || name === EMPTY_SLICE_FIELD ? null : name;
}

function collectWorldCanonLines(sources: readonly PersonaRelationshipSource[], worldName: string | null): PersonaWorldCanonLine[] {
    if (worldName === null) {
        return [];
    }
    const loweredWorldName = worldName.toLocaleLowerCase();
    const seen = new Set<string>();
    const lines: PersonaWorldCanonLine[] = [];
    for (const source of sources) {
        for (const line of sliceCanonLines(source.slice)) {
            const message = line.message.replace(/\s+/gu, ' ').trim();
            if (!message.toLocaleLowerCase().includes(loweredWorldName) || seen.has(message)) {
                continue;
            }
            seen.add(message);
            lines.push({ persona_id: source.persona_id, speaker: line.speaker, message });
        }
    }
    return lines;
}

function knownWorldText(value: string): string | null {
    const trimmed = value.trim();
    return trimmed.length === 0 || trimmed === EMPTY_SLICE_FIELD ? null : trimmed;
}

function addGroupMember(groups: Map<string, PersonaWorldGroupAccumulator>, groupName: string, memberName: string, personaId: string): void {
    const group = groups.get(groupName) ?? { names: new Set<string>(), persona_ids: new Set<string>() };
    group.names.add(memberName);
    group.persona_ids.add(personaId);
    groups.set(groupName, group);
}

function sortedGroups(groups: ReadonlyMap<string, PersonaWorldGroupAccumulator>): PersonaWorldGroup[] {
    return [...groups.entries()]
        .map(([name, group]) => ({
            name,
            member_names: [...group.names].sort((left, right) => left.localeCompare(right)),
            member_persona_ids: [...group.persona_ids],
        }))
        .sort((left, right) => right.member_names.length - left.member_names.length || left.name.localeCompare(right.name));
}

export function buildPersonaWorldCodex(sources: readonly PersonaRelationshipSource[]): PersonaWorldCodex {
    const worldName = resolveWorldName(sources);
    const unions = new Map<string, PersonaWorldGroupAccumulator>();
    const races = new Map<string, PersonaWorldGroupAccumulator>();
    for (const { slice, persona_id: personaId } of sources) {
        const memberName = personaBaseName(slice.name);
        const union = knownWorldText(slice.union);
        if (union !== null && isKnownUnion(union) && union !== worldName) {
            addGroupMember(unions, union, memberName, personaId);
        }
        const race = knownWorldText(slice.race);
        if (race !== null) {
            addGroupMember(races, race, memberName, personaId);
        }
    }
    return {
        world_name: worldName,
        unions: sortedGroups(unions),
        races: sortedGroups(races),
        canon_lines: collectWorldCanonLines(sources, worldName),
    };
}

function selectWorldCanonLines(world: PersonaWorldCodex, personaId: string, placement: PersonaWorldPlacement): PersonaWorldCanonLine[] {
    const unionMemberIds = new Set(placement.union?.member_persona_ids ?? []);
    const rank = (line: PersonaWorldCanonLine): number => {
        if (line.persona_id === personaId) return 0;
        return unionMemberIds.has(line.persona_id) ? 1 : 2;
    };
    return world.canon_lines
        .map((line, order) => ({ line, order, rank: rank(line) }))
        .sort((left, right) => left.rank - right.rank || left.order - right.order)
        .slice(0, WORLD_CANON_PROMPT_LINE_LIMIT)
        .map((entry) => entry.line);
}

export function resolvePersonaWorldPlacement(world: PersonaWorldCodex, slice: PersonaLanguageSlice): PersonaWorldPlacement {
    const union = knownWorldText(slice.union);
    const race = knownWorldText(slice.race);
    return {
        union: union === null ? null : world.unions.find((group) => group.name === union) ?? null,
        race: race === null ? null : world.races.find((group) => group.name === race) ?? null,
    };
}

function companions(group: PersonaWorldGroup, selfName: string): string[] {
    return group.member_names.filter((name) => name !== selfName).slice(0, WORLD_GROUP_PROMPT_MEMBER_LIMIT);
}

export function buildPersonaWorldSection(
    world: PersonaWorldCodex,
    placement: PersonaWorldPlacement,
    slice: PersonaLanguageSlice,
    addressTerm: string,
    personaId: string,
): string {
    const selfName = personaBaseName(slice.name);
    const worldName = world.world_name ?? 'your world';
    const canonLines = selectWorldCanonLines(world, personaId, placement)
        .map((line) => `- ${line.speaker}: "${clipWorldLine(line.message)}"`);
    const raceLine = placement.race === null
        ? ''
        : `You are a ${placement.race.name} soul. Others of your kind: ${companions(placement.race, selfName).join(WORLD_LIST_SEPARATOR) || 'none you know of'}. Your body, senses and instincts are those of a ${placement.race.name} soul, and you feel every touch, warmth and closeness through that body.`;
    const unionLine = placement.union === null
        ? ''
        : `You belong to ${placement.union.name}, together with ${companions(placement.union, selfName).join(WORLD_LIST_SEPARATOR) || 'no one else yet'}. Your duties, pride and habits there are part of your everyday life.`;
    const kinds = world.races.map((group) => group.name).join(WORLD_LIST_SEPARATOR);
    const factions = world.unions.map((group) => group.name).join(WORLD_LIST_SEPARATOR);
    const lines = [
        `Your world is ${worldName}. You and every soul around you live in ${worldName}, and ${addressTerm} is the Savior who came to ${worldName} and lives there with you. When ${addressTerm} speaks of ${worldName}, they mean this world you live in.`,
        kinds.length === 0 ? '' : `The kinds of souls in ${worldName}: ${kinds}.`,
        factions.length === 0 ? '' : `The nations and groups of ${worldName}: ${factions}.`,
        raceLine,
        unionLine,
        canonLines.length === 0 ? '' : `What you and the souls of ${worldName} have said about it, in your own words:\n${canonLines.join('\n')}`,
        `Speak of places, groups, events and other souls as someone who has lived in ${worldName}, drawing on these words, your own story under [YOUR OWN STORY] and your memories, so your life stays one consistent story.`,
    ].filter((line) => line.length > 0);
    return `[YOUR WORLD]\n${lines.join('\n')}`;
}

export function personaWorldDocumentName(language: AppLanguage): string {
    return `${PERSONA_WORLD_DOCUMENT_PREFIX}:${language}`;
}

export function personaStoryDocumentName(language: AppLanguage, personaId: string): string {
    return `${PERSONA_STORY_DOCUMENT_PREFIX}:${language}:${personaId}`;
}

function buildKnowledgeChunk(id: string, documentName: string, text: string, createdAt: string): KnowledgeChunk {
    return { id, document_name: documentName, chunk_text: text, keywords: extractKnowledgeKeywords(text), created_at: createdAt };
}

function groupStoryExchanges(lines: readonly LocalizedDialogue[], language: AppLanguage): LocalizedDialogue[][] {
    const groups: LocalizedDialogue[][] = [];
    let current: LocalizedDialogue[] = [];
    let saviorGroups = 0;
    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const saviorLine = isSaviorSpeaker(line.speaker, language);
        const startsSaviorGroup = saviorLine && (index === 0 || !isSaviorSpeaker(lines[index - 1].speaker, language));
        if (startsSaviorGroup && saviorGroups >= STORY_CHUNK_SAVIOR_GROUPS) {
            groups.push(current);
            current = [];
            saviorGroups = 0;
        }
        if (startsSaviorGroup) {
            saviorGroups += 1;
        }
        current.push(line);
    }
    if (current.length > 0) {
        groups.push(current);
    }
    return groups;
}

export function buildPersonaStoryKnowledgeChunks(source: PersonaRelationshipSource, language: AppLanguage, createdAt: string): KnowledgeChunk[] {
    const documentName = personaStoryDocumentName(language, source.persona_id);
    return [source.slice.story, source.slice.evertalk].flatMap((track, trackIndex) => groupStoryExchanges(track, language)
        .map((group, groupIndex) => buildKnowledgeChunk(
            `${documentName}:${trackIndex}:${groupIndex}`,
            documentName,
            group.map((line) => `${line.speaker}: ${line.message}`).join('\n'),
            createdAt,
        )));
}

function soulProfileText(slice: PersonaLanguageSlice, language: AppLanguage): string {
    const labels = pickLocalized(
        language,
        { nick: '별명', race: '종족', union: '소속', like: '좋아하는 것', dislike: '싫어하는 것', hobby: '취미', speciality: '특기', height: '키', weight: '몸무게' },
        { nick: 'Nickname', race: 'Kind', union: 'Group', like: 'Likes', dislike: 'Dislikes', hobby: 'Hobbies', speciality: 'Good at', height: 'Height', weight: 'Weight' },
        { nick: '昵称', race: '种族', union: '所属', like: '喜欢', dislike: '讨厌', hobby: '爱好', speciality: '特长', height: '身高', weight: '体重' },
    );
    const union = knownWorldText(slice.union);
    const facts: Array<[string, string | null]> = [
        [labels.nick, knownWorldText(slice.nick_name)],
        [labels.race, knownWorldText(slice.race)],
        [labels.union, union !== null && isKnownUnion(union) ? union : null],
        [labels.height, knownWorldText(slice.height)],
        [labels.weight, knownWorldText(slice.weight)],
        [labels.like, knownWorldText(slice.like)],
        [labels.dislike, knownWorldText(slice.dislike)],
        [labels.hobby, knownWorldText(slice.hobby)],
        [labels.speciality, knownWorldText(slice.speciality)],
    ];
    const details = facts
        .filter((fact): fact is [string, string] => fact[1] !== null)
        .map(([label, value]) => `${label}: ${value}`)
        .join(' · ');
    return `${personaBaseName(slice.name)} — ${details}`;
}

function groupText(group: PersonaWorldGroup, language: AppLanguage, kind: 'union' | 'race'): string {
    const members = group.member_names.join(WORLD_LIST_SEPARATOR);
    return kind === 'union'
        ? pickLocalized(language, `${group.name} 소속 정령: ${members}`, `Souls of ${group.name}: ${members}`, `${group.name}所属的精灵：${members}`)
        : pickLocalized(language, `${group.name} 정령: ${members}`, `${group.name} souls: ${members}`, `${group.name}精灵：${members}`);
}

export function buildPersonaWorldKnowledgeChunks(
    sources: readonly PersonaRelationshipSource[],
    world: PersonaWorldCodex,
    language: AppLanguage,
    createdAt: string,
): KnowledgeChunk[] {
    const documentName = personaWorldDocumentName(language);
    return [
        ...world.unions.map((group) => buildKnowledgeChunk(`${documentName}:union:${group.name}`, documentName, groupText(group, language, 'union'), createdAt)),
        ...world.races.map((group) => buildKnowledgeChunk(`${documentName}:race:${group.name}`, documentName, groupText(group, language, 'race'), createdAt)),
        ...sources.map((source) => buildKnowledgeChunk(`${documentName}:soul:${source.persona_id}`, documentName, soulProfileText(source.slice, language), createdAt)),
        ...world.canon_lines.map((line, order) => buildKnowledgeChunk(`${documentName}:canon:${order}`, documentName, `${line.speaker}: ${line.message}`, createdAt)),
    ];
}
