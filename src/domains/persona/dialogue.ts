import type { AppLanguage } from '../../shared/types';
import type {
    LocalizedDialogue,
    PersonaDialogueExchange,
    PersonaDialogueSource,
    PersonaLanguageSlice,
} from './types';

export const BASELINE_DIALOGUE_EXAMPLE_LIMIT = 6;
export const RELEVANT_DIALOGUE_EXAMPLE_LIMIT = 2;
const BOND_STAGE_EXAMPLE_WINDOW = 6;
const EXAMPLE_REPLY_LINE_LIMIT = 6;
const EXAMPLE_TEXT_CHAR_LIMIT = 280;
const TOKEN_PATTERN = /[\p{L}\p{N}]+/gu;
const SAVIOR_SPEAKERS: Record<AppLanguage, ReadonlySet<string>> = {
    ko: new Set(['구원자']),
    en: new Set(['Savior']),
    zh_cn: new Set(['救援者', '救世主']),
};

function isSaviorChoicePair(entries: LocalizedDialogue[], index: number, saviorSpeaker: string): boolean {
    const current = entries[index];
    return current.speaker === saviorSpeaker
        && ((entries[index - 1]?.speaker === saviorSpeaker && entries[index - 1].message === current.message)
            || (entries[index + 1]?.speaker === saviorSpeaker && entries[index + 1].message === current.message));
}

export function repairSaviorChoicePairSpeakers(entries: LocalizedDialogue[], language: AppLanguage, spiritName: string): LocalizedDialogue[] {
    const saviorSpeakers = SAVIOR_SPEAKERS[language];
    const repaired = entries.map((entry) => ({ ...entry }));
    for (let index = 1; index < repaired.length; index += 1) {
        const previous = repaired[index - 1];
        const current = repaired[index];
        const saviorSpeaker = saviorSpeakers.has(previous.speaker) ? previous.speaker : saviorSpeakers.has(current.speaker) ? current.speaker : null;
        if (saviorSpeaker === null || previous.message !== current.message || previous.speaker === current.speaker) {
            continue;
        }
        const spiritSpeaker = saviorSpeakers.has(previous.speaker) ? current.speaker : previous.speaker;
        if (spiritSpeaker !== spiritName) {
            continue;
        }
        previous.speaker = saviorSpeaker;
        current.speaker = saviorSpeaker;
        for (const neighborIndex of [index - 2, index + 1]) {
            const neighbor = repaired[neighborIndex];
            if (neighbor !== undefined && neighbor.speaker === saviorSpeaker && !isSaviorChoicePair(repaired, neighborIndex, saviorSpeaker)) {
                neighbor.speaker = spiritName;
            }
        }
    }
    return repaired;
}
const DIALOGUE_CANONICAL_ALIASES: ReadonlyArray<readonly [RegExp, string]> = [
    [/할매|할망구/gu, '할머니'],
    [/할배|영감탱이/gu, '할아버지'],
];

function displayDialogueText(text: string): string {
    return text.normalize('NFC').replace(/\s+/g, ' ').trim();
}

function compactDialogueText(text: string): string {
    let normalized = text.normalize('NFKC').replace(/\s+/g, ' ').trim();
    for (const [pattern, replacement] of DIALOGUE_CANONICAL_ALIASES) {
        normalized = normalized.replace(pattern, replacement);
    }
    return normalized;
}

function clipDialogueText(text: string): string {
    return text.length <= EXAMPLE_TEXT_CHAR_LIMIT
        ? text
        : `${text.slice(0, EXAMPLE_TEXT_CHAR_LIMIT).trimEnd()}...`;
}

function deduplicateAdjacent(entries: LocalizedDialogue[]): LocalizedDialogue[] {
    const deduplicated: LocalizedDialogue[] = [];
    for (const entry of entries) {
        const normalized = {
            speaker: displayDialogueText(entry.speaker),
            message: displayDialogueText(entry.message),
        };
        if (normalized.speaker.length === 0 || normalized.message.length === 0) {
            continue;
        }
        const previous = deduplicated.at(-1);
        if (previous?.speaker === normalized.speaker && previous.message === normalized.message) {
            continue;
        }
        deduplicated.push(normalized);
    }
    return deduplicated;
}

function parseResponseExchanges(
    entries: LocalizedDialogue[],
    source: PersonaDialogueSource,
    spiritName: string,
    language: AppLanguage,
): PersonaDialogueExchange[] {
    const dialogues = deduplicateAdjacent(entries);
    const saviorSpeakers = SAVIOR_SPEAKERS[language];
    const normalizedSpiritName = displayDialogueText(spiritName);
    const exchanges: PersonaDialogueExchange[] = [];
    for (let index = 0; index < dialogues.length; index += 1) {
        if (!saviorSpeakers.has(dialogues[index].speaker)) {
            continue;
        }
        const saviorMessages: string[] = [];
        while (index < dialogues.length && saviorSpeakers.has(dialogues[index].speaker)) {
            saviorMessages.push(dialogues[index].message);
            index += 1;
        }
        index -= 1;
        const spiritMessages: string[] = [];
        let cursor = index + 1;
        while (cursor < dialogues.length && dialogues[cursor].speaker === normalizedSpiritName) {
            if (spiritMessages.length < EXAMPLE_REPLY_LINE_LIMIT) {
                spiritMessages.push(clipDialogueText(dialogues[cursor].message));
            }
            cursor += 1;
        }
        if (spiritMessages.length === 0) {
            continue;
        }
        exchanges.push({
            source,
            user_message: clipDialogueText(saviorMessages.join('\n')),
            spirit_messages: spiritMessages,
        });
    }
    return exchanges;
}

export function parsePersonaDialogueExchanges(slice: PersonaLanguageSlice, language: AppLanguage): PersonaDialogueExchange[] {
    return [
        ...parseResponseExchanges(slice.story, 'story', slice.name, language),
        ...parseResponseExchanges(slice.evertalk, 'evertalk', slice.name, language),
    ];
}

function dialogueExchangeKey(exchange: PersonaDialogueExchange): string {
    return `${exchange.user_message}\n${exchange.spirit_messages.join('\n')}`;
}

function stableTextHash(text: string): number {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

export function selectBondStageDialogueExamples(
    exchanges: PersonaDialogueExchange[],
    familiarityLevel: number,
    maxLevel: number,
    limit: number,
    rotationSeed: string,
    excludedExchanges: readonly PersonaDialogueExchange[],
): PersonaDialogueExchange[] {
    const excludedKeys = new Set(excludedExchanges.map(dialogueExchangeKey));
    const timeline = exchanges.filter((exchange) => exchange.source === 'evertalk' && !excludedKeys.has(dialogueExchangeKey(exchange)));
    if (limit <= 0 || timeline.length === 0 || maxLevel <= 1) {
        return [];
    }
    const progress = (Math.min(maxLevel, Math.max(1, familiarityLevel)) - 1) / (maxLevel - 1);
    const center = Math.round(progress * (timeline.length - 1));
    const windowSize = Math.min(BOND_STAGE_EXAMPLE_WINDOW, timeline.length);
    const windowStart = Math.min(Math.max(0, center - Math.floor(windowSize / 2)), timeline.length - windowSize);
    const stageWindow = timeline.slice(windowStart, windowStart + windowSize);
    const offset = stableTextHash(rotationSeed) % stageWindow.length;
    return Array.from({ length: Math.min(limit, stageWindow.length) }, (_, index) => stageWindow[(offset + index) % stageWindow.length]);
}

export function selectRepresentativeDialogueExamples(
    exchanges: PersonaDialogueExchange[],
    limit = BASELINE_DIALOGUE_EXAMPLE_LIMIT,
): PersonaDialogueExchange[] {
    if (limit <= 0 || exchanges.length === 0) {
        return [];
    }
    if (exchanges.length <= limit) {
        return exchanges;
    }
    return Array.from({ length: limit }, (_, index) => {
        const position = Math.round(index * (exchanges.length - 1) / (limit - 1));
        return exchanges[position];
    });
}

function withoutExcludedTerms(text: string, excludedTerms: readonly string[]): string {
    let normalized = compactDialogueText(text).toLocaleLowerCase();
    for (const term of excludedTerms) {
        normalized = normalized.replaceAll(term, ' ');
    }
    return normalized;
}

function normalizeExcludedTerms(terms: readonly string[]): string[] {
    const normalized = new Set<string>();
    for (const term of terms) {
        const compact = compactDialogueText(term).toLocaleLowerCase();
        for (const token of compact.match(TOKEN_PATTERN) ?? []) {
            normalized.add(token);
        }
    }
    return [...normalized].sort((left, right) => right.length - left.length);
}

function lexicalTerms(text: string): Set<string> {
    const terms = new Set<string>();
    for (const token of text.match(TOKEN_PATTERN) ?? []) {
        if (token.length >= 2) {
            terms.add(token);
        }
        if (token.length >= 3) {
            for (let index = 0; index < token.length - 1; index += 1) {
                terms.add(token.slice(index, index + 2));
            }
        }
    }
    return terms;
}

function lexicalTokens(text: string): Set<string> {
    return new Set(
        (text.match(TOKEN_PATTERN) ?? [])
            .filter((token) => token.length >= 2),
    );
}

function exchangeText(exchange: PersonaDialogueExchange, excludedTerms: readonly string[]): string {
    return withoutExcludedTerms(`${exchange.user_message} ${exchange.spirit_messages.join(' ')}`, excludedTerms);
}

function relevanceScore(
    queryTokens: Set<string>,
    queryTerms: Set<string>,
    candidateText: string,
    tokenDocumentFrequency: ReadonlyMap<string, number>,
    exchangeCount: number,
): number {
    const candidateTokens = lexicalTokens(candidateText);
    let exactTokenScore = 0;
    for (const token of queryTokens) {
        if (!candidateTokens.has(token)) {
            continue;
        }
        const documentFrequency = tokenDocumentFrequency.get(token) ?? exchangeCount;
        const rarity = Math.log2(1 + exchangeCount / Math.max(1, documentFrequency));
        exactTokenScore += (token.length + 2) * rarity;
    }
    const candidateTerms = lexicalTerms(candidateText);
    let overlap = 0;
    for (const term of queryTerms) {
        if (candidateTerms.has(term)) {
            overlap += term.length;
        }
    }
    // Exact, rare topic words must outrank incidental character bigram overlap.
    return exactTokenScore * 100 + overlap;
}

export function selectRelevantDialogueExamples(
    exchanges: PersonaDialogueExchange[],
    query: string,
    limit = RELEVANT_DIALOGUE_EXAMPLE_LIMIT,
    excludedTerms: readonly string[] = [],
): PersonaDialogueExchange[] {
    if (limit <= 0) {
        return [];
    }
    const exclusions = normalizeExcludedTerms(excludedTerms);
    const normalizedQuery = withoutExcludedTerms(query, exclusions);
    const queryTokens = lexicalTokens(normalizedQuery);
    const queryTerms = lexicalTerms(normalizedQuery);
    if (queryTerms.size === 0) {
        return [];
    }
    const candidateTexts = exchanges.map((exchange) => exchangeText(exchange, exclusions));
    const tokenDocumentFrequency = new Map<string, number>();
    for (const candidateText of candidateTexts) {
        for (const token of lexicalTokens(candidateText)) {
            tokenDocumentFrequency.set(token, (tokenDocumentFrequency.get(token) ?? 0) + 1);
        }
    }
    return exchanges
        .map((exchange, index) => ({
            exchange,
            index,
            score: relevanceScore(queryTokens, queryTerms, candidateTexts[index], tokenDocumentFrequency, exchanges.length),
        }))
        .filter((candidate) => candidate.score > 0)
        .sort((left, right) => right.score - left.score || left.index - right.index)
        .slice(0, limit)
        .map((candidate) => candidate.exchange);
}
