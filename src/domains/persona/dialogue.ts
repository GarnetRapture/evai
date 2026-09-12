import type { AppLanguage } from '../../shared/types';
import type {
    LocalizedDialogue,
    PersonaDialogueExchange,
    PersonaDialogueSource,
    PersonaLanguageSlice,
} from './types';

export const BASELINE_DIALOGUE_EXAMPLE_LIMIT = 6;
export const RELEVANT_DIALOGUE_EXAMPLE_LIMIT = 2;
const EXAMPLE_REPLY_LINE_LIMIT = 6;
const EXAMPLE_TEXT_CHAR_LIMIT = 280;
const TOKEN_PATTERN = /[\p{L}\p{N}]+/gu;
const SAVIOR_SPEAKERS: Record<AppLanguage, ReadonlySet<string>> = {
    ko: new Set(['구원자']),
    en: new Set(['Savior']),
    zh_cn: new Set(['救援者', '救世主']),
};
const DIALOGUE_CANONICAL_ALIASES: ReadonlyArray<readonly [RegExp, string]> = [
    [/할매|할망구/gu, '할머니'],
    [/할배|영감탱이/gu, '할아버지'],
];

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
            speaker: compactDialogueText(entry.speaker),
            message: compactDialogueText(entry.message),
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
    const normalizedSpiritName = compactDialogueText(spiritName);
    const exchanges: PersonaDialogueExchange[] = [];
    for (let index = 0; index < dialogues.length; index += 1) {
        const current = dialogues[index];
        if (!saviorSpeakers.has(current.speaker)) {
            continue;
        }
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
            user_message: clipDialogueText(current.message),
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

function lexicalTerms(text: string): Set<string> {
    const terms = new Set<string>();
    const normalized = compactDialogueText(text).toLocaleLowerCase();
    for (const token of normalized.match(TOKEN_PATTERN) ?? []) {
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
        (compactDialogueText(text).toLocaleLowerCase().match(TOKEN_PATTERN) ?? [])
            .filter((token) => token.length >= 2),
    );
}

function exchangeText(exchange: PersonaDialogueExchange): string {
    return `${exchange.user_message} ${exchange.spirit_messages.join(' ')}`;
}

function relevanceScore(
    queryTokens: Set<string>,
    queryTerms: Set<string>,
    exchange: PersonaDialogueExchange,
    tokenDocumentFrequency: ReadonlyMap<string, number>,
    exchangeCount: number,
): number {
    const candidateText = exchangeText(exchange);
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
): PersonaDialogueExchange[] {
    if (limit <= 0) {
        return [];
    }
    const queryTokens = lexicalTokens(query);
    const queryTerms = lexicalTerms(query);
    if (queryTerms.size === 0) {
        return [];
    }
    const tokenDocumentFrequency = new Map<string, number>();
    for (const exchange of exchanges) {
        for (const token of lexicalTokens(exchangeText(exchange))) {
            tokenDocumentFrequency.set(token, (tokenDocumentFrequency.get(token) ?? 0) + 1);
        }
    }
    return exchanges
        .map((exchange, index) => ({
            exchange,
            index,
            score: relevanceScore(queryTokens, queryTerms, exchange, tokenDocumentFrequency, exchanges.length),
        }))
        .filter((candidate) => candidate.score > 0)
        .sort((left, right) => right.score - left.score || left.index - right.index)
        .slice(0, limit)
        .map((candidate) => candidate.exchange);
}

export function hasDialogueLexicalOverlap(query: string, candidate: string): boolean {
    const queryTerms = lexicalTerms(query);
    if (queryTerms.size === 0) return false;
    const candidateTerms = lexicalTerms(candidate);
    for (const term of queryTerms) {
        if (candidateTerms.has(term)) return true;
    }
    return false;
}
