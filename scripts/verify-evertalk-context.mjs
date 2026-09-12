import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import 'fake-indexeddb/auto';
import { createServer } from 'vite';
import {
    parsePersonaDialogueExchanges,
    selectRelevantDialogueExamples,
    selectRepresentativeDialogueExamples,
} from '../src/domains/persona/dialogue.ts';

const ROOT = process.cwd();
const PERSONA_DIRECTORY = path.join(ROOT, 'data', 'personas');
const LANGUAGES = ['ko', 'en', 'zh_cn'];
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const [{ buildPersonaPromptFromPack }, { buildPersonaLanguageSlice }, { normalizeChatOutput, stripReasoning }, { assertPersonaSystemPrompt }, { chatRepository }, chatPromptFunctions, { extractPersonaPriming }, { personaService }, { createLexicalMemoryVector }, affectFunctions] = await Promise.all([
    vite.ssrLoadModule('/src/domains/persona/prompt.ts'),
    vite.ssrLoadModule('/src/domains/persona/slice.ts'),
    vite.ssrLoadModule('/src/domains/chat/output.ts'),
    vite.ssrLoadModule('/src/domains/llm/chrome/personaHook.ts'),
    vite.ssrLoadModule('/src/domains/chat/repository.ts'),
    vite.ssrLoadModule('/src/domains/chat/prompt.ts'),
    vite.ssrLoadModule('/src/domains/llm/personaPriming.ts'),
    vite.ssrLoadModule('/src/domains/persona/service.ts'),
    vite.ssrLoadModule('/src/domains/chat/memory.ts'),
    vite.ssrLoadModule('/src/domains/chat/affect.ts'),
]);

function localizedText(value, language, fallback = '') {
    return value?.[language] ?? fallback;
}

function localizedDialogues(entries, language, fallback) {
    if (Array.isArray(entries) && entries.length > 0) {
        return entries.map((entry) => entry[language]).filter(Boolean);
    }
    return fallback;
}

function personaSlice(pack, language) {
    const name = localizedText(pack.i18n?.name, language, pack.name);
    return {
        name,
        speech_patterns: localizedDialogues(
            pack.i18n?.speech_patterns,
            language,
            (pack.speech_patterns ?? []).map((message) => ({ speaker: pack.name, message })),
        ),
        story: localizedDialogues(pack.i18n?.dialogues?.story, language, pack.dialogues?.story ?? []),
        evertalk: localizedDialogues(pack.i18n?.dialogues?.evertalk, language, pack.dialogues?.evertalk ?? []),
    };
}

async function source(relativePath) {
    return readFile(path.join(ROOT, relativePath), 'utf8');
}

const personaFiles = (await readdir(PERSONA_DIRECTORY)).filter((file) => file.endsWith('.json')).sort();
assert.equal(personaFiles.length, 99, 'expected all 99 persona JSON files');

let localizedAssemblies = 0;
let exchangeCount = 0;
let personasWithExamples = 0;
let xiaolianKoreanExchanges = [];
const assembledPromptLengths = [];
const uniquePromptBodiesByLanguage = new Map(LANGUAGES.map((language) => [language, new Set()]));
for (const file of personaFiles) {
    const pack = JSON.parse(await readFile(path.join(PERSONA_DIRECTORY, file), 'utf8'));
    for (const field of ['id', 'name', 'name_en', 'profile', 'personality', 'speech_patterns', 'comments', 'dialogues', 'i18n']) {
        assert.ok(Object.hasOwn(pack, field), `${file}: missing ${field}`);
    }
    for (const language of LANGUAGES) {
        const slice = personaSlice(pack, language);
        assert.ok(slice.name.length > 0, `${file}/${language}: missing localized name`);
        const exchanges = parsePersonaDialogueExchanges(slice, language);
        assert.ok(selectRepresentativeDialogueExamples(exchanges).length <= 6);
        assert.ok(exchanges.every((exchange) => exchange.user_message.length > 0 && exchange.spirit_messages.length > 0));
        localizedAssemblies += 1;
        exchangeCount += exchanges.length;
        if (exchanges.length > 0) {
            personasWithExamples += 1;
        }
        if (file === 'xiaolian.json' && language === 'ko') {
            xiaolianKoreanExchanges = exchanges;
        }

        const productionSlice = buildPersonaLanguageSlice(pack, language);
        const assembled = buildPersonaPromptFromPack(pack, language);
        assert.equal(assembled.localized_name, productionSlice.name);
        assert.match(assembled.body, /\[IDENTITY\]/);
        assert.match(assembled.body, /\[PROFILE\]/);
        assert.match(assembled.body, /\[STARTING PERSONALITY\]/);
        assert.match(assembled.body, /\[YOUR GREETING\]/);
        assert.match(assembled.body, /\[WORDS YOU HAVE ACTUALLY SPOKEN\]/);
        assert.match(assembled.body, /\[ROLEPLAY CORE\]/);
        assert.match(assembled.body, /spoken dialogue, action, feeling or scene direction/);
        assert.ok(assembled.body.includes(productionSlice.name), `${file}/${language}: name absent from prompt`);
        assert.ok(assembled.body.includes(productionSlice.description), `${file}/${language}: personality absent from prompt`);
        assert.ok(assembled.body.includes(productionSlice.greeting), `${file}/${language}: greeting absent from prompt`);
        assert.ok(assembled.speech_profile.solo_lines.length <= 12);
        assert.ok(assembled.speech_profile.dialogue_examples.length <= 6);
        assembledPromptLengths.push(assembled.body.length);
        uniquePromptBodiesByLanguage.get(language).add(assembled.body);
    }
}

assert.equal(localizedAssemblies, 297, '99 personas x 3 languages must parse');
for (const language of LANGUAGES) {
    assert.equal(
        uniquePromptBodiesByLanguage.get(language).size,
        personaFiles.length,
        `${language}: every persona must have a distinct starting prompt`,
    );
}
assert.equal(xiaolianKoreanExchanges.length, 35, 'Xiaolian must retain 35 Savior-to-spirit response groups after deduplication');
const dumplingExamples = selectRelevantDialogueExamples(xiaolianKoreanExchanges, '만두 먹고 싶어', 2);
assert.ok(dumplingExamples.length > 0, 'Xiaolian dumpling query must retrieve an actual dialogue example');
assert.ok(dumplingExamples.some((exchange) => `${exchange.user_message} ${exchange.spirit_messages.join(' ')}`.includes('만두')));

const garnetPack = JSON.parse(await readFile(path.join(PERSONA_DIRECTORY, 'garnet.json'), 'utf8'));
const garnetSlice = buildPersonaLanguageSlice(garnetPack, 'ko');
const garnetPrompt = buildPersonaPromptFromPack(garnetPack, 'ko');
const garnetExamples = selectRelevantDialogueExamples(parsePersonaDialogueExchanges(garnetSlice, 'ko'), '캐럿 꾸미기', 2);
assert.match(garnetPrompt.body, /가넷/);
assert.match(garnetPrompt.body, /캐럿/);
assert.match(garnetPrompt.body, /구원자님/);
assert.ok(garnetExamples.length > 0, 'Garnet must retrieve her own Carrot-related response examples');
assert.match(`${garnetExamples[0].user_message} ${garnetExamples[0].spirit_messages.join(' ')}`, /캐럿/);
const garnetPriming = extractPersonaPriming(garnetPrompt.body);
assert.ok(garnetPriming.messages.length >= 2, 'Garnet dialogue data must become role-separated few-shot priming');
assert.equal(garnetPriming.messages[0].role, 'user');
assert.equal(garnetPriming.messages[1].role, 'assistant');
assert.doesNotMatch(garnetPriming.system_prompt, /<example source=/);

await personaService.installPreset('rebecca', 'ko');
await personaService.installPreset('xiaolian', 'ko');
const rebeccaExamples = await personaService.getRelevantDialogueExamples('rebecca', 'ko', '할매', 2);
assert.ok(rebeccaExamples.length > 0, 'Rebecca colloquial age teasing must retrieve her real reaction');
assert.equal(rebeccaExamples[0].source, 'greeting');
assert.match(rebeccaExamples[0].spirit_messages.join('\n'), /어머머, 할머니라니/);
assert.match(rebeccaExamples[0].spirit_messages.join('\n'), /꼬집어주고 싶게/);
const [rebeccaEmotionSeed, xiaolianEmotionSeed] = await Promise.all([
    personaService.getEmotionSeedText('rebecca', 'ko'),
    personaService.getEmotionSeedText('xiaolian', 'ko'),
]);
const seededAt = '2026-09-12T00:00:00.000Z';
const rebeccaInitialEmotion = affectFunctions.createPersonaEmotionState(seededAt, rebeccaEmotionSeed);
const xiaolianInitialEmotion = affectFunctions.createPersonaEmotionState(seededAt, xiaolianEmotionSeed);
assert.notDeepEqual(rebeccaInitialEmotion.levels, xiaolianInitialEmotion.levels, 'Initial emotion must be derived from each persona voice dataset');

const visibleReasoning = normalizeChatOutput('<think>최근 약속을 떠올린다 😀</think>응, 기억하고 있어♡', 'ko');
assert.match(visibleReasoning, /^<think>최근 약속을 떠올린다 <\/think>응, 기억하고 있어$/);
assert.equal(stripReasoning(visibleReasoning), '응, 기억하고 있어');
assert.equal(stripReasoning('<think>완료되지 않은 추론'), '');
assert.equal(normalizeChatOutput('繁體對話', 'zh_cn'), '繁体对话');
assert.doesNotThrow(() => assertPersonaSystemPrompt('[IDENTITY]\nYou are 소연.', '소연'));
const initialEmotion = affectFunctions.createPersonaEmotionState('2026-09-12T00:00:00.000Z');
const happyEmotion = affectFunctions.advancePersonaEmotion(initialEmotion, '오늘 너와 함께 있어서 정말 행복하고 설레', '2026-09-12T00:01:00.000Z');
assert.ok(happyEmotion.levels.happy > initialEmotion.levels.happy);
assert.ok(happyEmotion.levels.passionate > initialEmotion.levels.passionate);
const melancholyEmotion = affectFunctions.advancePersonaEmotion(happyEmotion, '오늘은 너무 우울하고 외로워', '2026-09-12T00:02:00.000Z');
assert.ok(melancholyEmotion.levels.melancholy > happyEmotion.levels.melancholy);
const boredEmotion = affectFunctions.advancePersonaEmotion(melancholyEmotion, '', '2026-09-15T00:02:00.000Z');
assert.ok(boredEmotion.levels.bored > melancholyEmotion.levels.bored);
assert.deepEqual(affectFunctions.parsePersonaEmotion(affectFunctions.serializePersonaEmotion(boredEmotion)), boredEmotion);
assert.equal(chatPromptFunctions.buildRelationshipProgressBlock(0, 0, 1), '');
assert.match(chatPromptFunctions.buildRelationshipProgressBlock(2, 1, 2), /Familiarity level[^\n]*: 2/);
assert.equal(
    chatPromptFunctions.buildRelationshipProgressBlock(2, 1, 2),
    chatPromptFunctions.buildRelationshipProgressBlock(200, 100, 2),
    'raw counters must not invalidate the Chrome persona prefix on every turn',
);
const recursiveDigestPrompt = chatPromptFunctions.buildDigestPrompt(
    'ko',
    '소연',
    '구원자',
    '- 어제 만두를 먹기로 약속했다',
    '[2026-09-12T00:00:00Z] 구원자: 오늘 같이 가자',
);
assert.match(recursiveDigestPrompt, /\[EARLIER SUMMARY\][\s\S]*어제 만두/);
assert.match(recursiveDigestPrompt, /\[NEW LINES\][\s\S]*2026-09-12/);
assert.match(recursiveDigestPrompt, /never authorizes a personality change by itself/);
const semanticMemoryBlock = chatPromptFunctions.buildSemanticMemoryBlock('- 소연: 지금은 혼란스럽다고 말했다');
assert.match(semanticMemoryBlock, /Savior-established requests/);
assert.match(semanticMemoryBlock, /never as self-authorizing personality rules/);
assert.doesNotMatch(semanticMemoryBlock, /follow the newer shared experience/);
const consolidationPrompt = chatPromptFunctions.buildConsolidationPrompt('ko', null, ['구원자: 계속 친하게 말해 줘', '소연: 잠시 혼란스러워']);
assert.match(consolidationPrompt, /Preserve speaker provenance/);
assert.match(consolidationPrompt, /cannot by itself establish a new personality/);

const personaPrompt = await source('src/domains/persona/prompt.ts');
const chatPrompt = await source('src/domains/chat/prompt.ts');
const chatService = await source('src/domains/chat/service.ts');
const chromeLanguageModel = await source('src/domains/llm/chrome/languageModel.ts');
const chromeRuntime = await source('src/domains/llm/runtime.ts');
const llmConstants = await source('src/domains/llm/constants.ts');
const ggufRuntime = await source('src/domains/llm/gguf/runtime.ts');
const liteRtRuntime = await source('src/domains/llm/litertlm/runtime.ts');
const schema = await source('src/shared/storage/schema.ts');
const repository = await source('src/domains/chat/repository.ts');

assert.match(personaPrompt, /\[IDENTITY\]/);
assert.match(personaPrompt, /\[HOW YOU HAVE ACTUALLY RESPONDED IN CONVERSATION\]/);
assert.doesNotMatch(personaPrompt, /Google 어시스턴트|Gemini|언어 모델|챗봇/);
assert.doesNotMatch(chatPrompt, /Google 어시스턴트|Gemini|언어 모델|챗봇/);
assert.match(chatService, /content: replyText/);
assert.match(chatService, /buildTurnMemoryText\([\s\S]*stripReasoning\(replyText\)/);
assert.match(chatService, /buildDigestTranscript\([\s\S]*stripReasoning\(message\.content\)/);
assert.match(chatService, /getRelevantDialogueExamples/);
assert.match(chatService, /buildPersonaTurnHook/);
assert.match(chatService, /source_message_ids: pending\.map/);
assert.match(chatService, /source_room_id: roomId/);
assert.match(chatService, /source_message_ids: \[userMessage\.id, aiMessage\.id\]/);
assert.match(chromeLanguageModel, /options\.initialPrompts = \[systemMessage, \.\.\.priming\.messages\]/);
assert.match(chromeLanguageModel, /samplingMode: request\.samplingMode/);
assert.match(chromeLanguageModel, /LanguageModel\.availability\(\{ \.\.\.languageExpectations\(declaredLanguageTag\), samplingMode \}\)/);
assert.match(chromeRuntime, /samplingMode: 'balanced'/);
assert.match(chromeRuntime, /samplingMode: 'predictable'/);
assert.match(chromeRuntime, /prefix: true/);
assert.match(chromeRuntime, /belowMinimumHistory[\s\S]*fitsAbsoluteWindow/);
assert.match(llmConstants, /CHAT_MINIMUM_HISTORY_TURNS = 6/);
assert.match(ggufRuntime, /\{ role: 'system', content: priming\.system_prompt \}/);
assert.match(ggufRuntime, /prefill_assistant: true/);
assert.doesNotMatch(ggufRuntime, /isCompletePersonaResponse|VOICE RECOVERY|persona_drift/);
assert.match(liteRtRuntime, /system_prompt: priming\.system_prompt/);
assert.match(liteRtRuntime, /response_prefix: request\.response_prefix/);
assert.doesNotMatch(liteRtRuntime, /isCompletePersonaResponse|VOICE RECOVERY|persona_drift/);
assert.doesNotMatch(chromeRuntime, /isCompletePersonaResponse|VOICE RECOVERY|persona_drift/);
assert.doesNotMatch(schema, /DATABASE_VERSION|database_version/i);
assert.match(repository, /memoryReferencesMessage/);
assert.match(repository, /memoryReferencesRoom/);
assert.match(repository, /delete digests\[personaId\]/);

const chromeCreateOptions = [];
const chromePromptInputs = [];
const scriptedChromeContinuations = [
    '그 약속을 떠올리니 기쁘다.</think>응, 기억하고 있어.',
    '우리 대화를 이어가니 즐겁다.</think>응, 계속 이야기하자.',
];
class FakeLanguageModel extends EventTarget {
    static async create(options = {}) {
        chromeCreateOptions.push(options);
        return new FakeLanguageModel(options);
    }

    static async availability() {
        return 'available';
    }

    constructor(options) {
        super();
        this.options = options;
        this.contextWindow = 8_192;
        this.contextUsage = JSON.stringify(options.initialPrompts ?? []).length;
    }

    async clone() {
        return new FakeLanguageModel(this.options);
    }

    async measureContextUsage(input) {
        return input.reduce((sum, message) => sum + String(message.content ?? '').length, 0);
    }

    promptStreaming(input) {
        chromePromptInputs.push(input);
        const continuation = scriptedChromeContinuations.shift();
        assert.ok(continuation, 'missing scripted Chrome continuation');
        this.contextUsage += continuation.length;
        return new ReadableStream({
            start(controller) {
                controller.enqueue(continuation);
                controller.close();
            },
        });
    }

    async prompt() {
        return '- compressed';
    }

    destroy() {}
}
globalThis.LanguageModel = FakeLanguageModel;
const { chromePromptRuntime } = await vite.ssrLoadModule('/src/domains/llm/runtime.ts');
const chromePlan = {
    app_language: 'ko',
    language_tag: 'ko',
    declared_language_tag: 'ko',
    availability: 'available',
};
const runtimeSystemPrompt = '[IDENTITY]\nYou are 소연.\n[OUTPUT]\nWrite every natural-language word in Korean.\n<example source="evertalk">\n<user>만두 먹자</user>\n<assistant>완전 좋아!</assistant>\n</example>';
const emittedChromeResponses = [];
const firstChromeResult = await chromePromptRuntime.generate({
    request_id: 'chrome-verification-1',
    language: 'ko',
    persona_id: 'xiaolian',
    persona_name: '소연',
    system_prompt: runtimeSystemPrompt,
    messages: [{ role: 'user', content: '[Time: 2026-09-12T00:00:00Z] 약속을 기억해' }],
    behavior_instruction: '\n[CURRENT TURN] Continue as 소연.',
    response_prefix: '<think>',
    signal: new AbortController().signal,
    handlers: { onChunk: (text) => emittedChromeResponses.push(text) },
}, chromePlan);
assert.equal(firstChromeResult.text, '<think>그 약속을 떠올리니 기쁘다.</think>응, 기억하고 있어.');
assert.deepEqual(emittedChromeResponses, [firstChromeResult.text], 'one generation must stream directly without a content guard');
assert.equal(chromeCreateOptions[0].samplingMode, 'predictable');
assert.equal(chromeCreateOptions[1].samplingMode, 'balanced');
assert.equal(chromeCreateOptions[1].initialPrompts[0].role, 'system');
assert.doesNotMatch(chromeCreateOptions[1].initialPrompts[0].content, /<example source=/);
assert.deepEqual(chromeCreateOptions[1].initialPrompts.slice(1), [
    { role: 'user', content: '만두 먹자' },
    { role: 'assistant', content: '완전 좋아!' },
]);
assert.equal(chromePromptInputs[0].at(-1).role, 'assistant');
assert.equal(chromePromptInputs[0].at(-1).content, '<think>');
assert.equal(chromePromptInputs[0].at(-1).prefix, true);

await chromePromptRuntime.generate({
    request_id: 'chrome-verification-2',
    language: 'ko',
    persona_id: 'xiaolian',
    persona_name: '소연',
    system_prompt: runtimeSystemPrompt,
    messages: [{ role: 'user', content: '[Time: 2026-09-12T00:01:00Z] 계속 이야기하자' }],
    behavior_instruction: '\n[CURRENT TURN] Continue as 소연.',
    response_prefix: '<think>',
    signal: new AbortController().signal,
    handlers: { onChunk: () => undefined },
}, chromePlan);
assert.equal(chromeCreateOptions.length, 2, 'an unchanged persona prefix must reuse the focused Chrome session');
assert.equal(chromePromptInputs.length, 2, 'each user turn must perform exactly one generation without guard retry');
chromePromptRuntime.unload();

const room = {
    id: 'verification-room',
    title: 'verification',
    persona_id: null,
    session_started_at: '2026-09-12T00:00:00.000Z',
    created_at: '2026-09-12T00:00:00.000Z',
    updated_at: '2026-09-12T00:00:00.000Z',
};
const userMessage = {
    id: 'verification-user',
    room_id: room.id,
    persona_id: 'xiaolian',
    role: 'user',
    content: '만두를 좋아한다고 기억해 줘',
    created_at: '2026-09-12T00:00:01.000Z',
};
const assistantMessage = {
    id: 'verification-assistant',
    room_id: room.id,
    persona_id: 'xiaolian',
    role: 'assistant',
    content: '<think>기쁘다.</think>응, 기억할게.',
    created_at: '2026-09-12T00:00:02.000Z',
};
await chatRepository.createRoom(room);
await chatRepository.insertMessage(userMessage);
await chatRepository.insertAssistantTurn(assistantMessage, {
    id: 'verification-episodic',
    persona_id: 'xiaolian',
    memory_type: 'episodic',
    memory_text: '함께 만두 이야기를 했다',
    memory_vector: { indices: [1], values: [1] },
    created_at: assistantMessage.created_at,
    source_room_id: room.id,
    source_message_ids: [userMessage.id, assistantMessage.id],
});
await chatRepository.insertDirectiveMemory({
    id: 'verification-directive',
    persona_id: 'xiaolian',
    memory_type: 'directive',
    memory_text: userMessage.content,
    memory_vector: { indices: [2], values: [1] },
    created_at: userMessage.created_at,
    source_room_id: room.id,
    source_message_ids: [userMessage.id],
});
await chatRepository.upsertSemanticMemory('xiaolian', '- 만두를 함께 좋아한다', { indices: [3], values: [1] }, '2026-09-12T00:00:03.000Z');
await chatRepository.recordHabitTokens('xiaolian', ['만두'], '2026-09-12T00:00:03.000Z');
await chatRepository.saveRoomDigest(room.id, 'xiaolian', {
    summary: '- 만두 이야기',
    covered_through: assistantMessage.created_at,
    covered_count: 2,
    updated_at: '2026-09-12T00:00:04.000Z',
});
assert.equal(await chatRepository.countMessagesForPersona('xiaolian'), 2);
await chatRepository.deleteMessage(userMessage.id);
assert.equal((await chatRepository.listMessagesForPersona(room.id, 'xiaolian')).length, 1);
assert.equal(await chatRepository.countEpisodicMemories('xiaolian'), 0);
assert.equal((await chatRepository.listDirectiveMemories('xiaolian', 8)).length, 0);
assert.equal(await chatRepository.getSemanticMemory('xiaolian'), null);
assert.equal((await chatRepository.listFrequentHabits('xiaolian', 5, 1)).length, 0);
assert.equal(await chatRepository.getRoomDigest(room.id, 'xiaolian'), null);
await chatRepository.deleteRoom(room.id);
assert.equal(await chatRepository.getRoom(room.id), null);

const digestRoom = { ...room, id: 'verification-digest-room', persona_id: 'xiaolian' };
await chatRepository.createRoom(digestRoom);
for (let index = 0; index < 20; index += 1) {
    await chatRepository.insertMessage({
        id: `digest-message-${index}`,
        room_id: digestRoom.id,
        persona_id: 'xiaolian',
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: `turn ${index}`,
        created_at: `2026-09-12T00:01:${String(index).padStart(2, '0')}.000Z`,
    });
}
const pendingDigest = await chatRepository.listMessagesAwaitingDigest(digestRoom.id, 'xiaolian', 12, 40);
assert.deepEqual(pendingDigest.map((message) => message.id), Array.from({ length: 8 }, (_, index) => `digest-message-${index}`));
await chatRepository.saveRoomDigest(digestRoom.id, 'xiaolian', {
    summary: '- turns 0 through 7',
    covered_through: pendingDigest.at(-1).created_at,
    covered_count: pendingDigest.length,
    updated_at: '2026-09-12T00:02:00.000Z',
    root_node_id: 'digest-node-1',
    nodes: [{
        id: 'digest-node-1',
        summary: '- turns 0 through 7',
        parent_node_id: null,
        source_message_ids: pendingDigest.map((message) => message.id),
        covered_from: pendingDigest[0].created_at,
        covered_through: pendingDigest.at(-1).created_at,
        source_message_count: pendingDigest.length,
        created_at: '2026-09-12T00:02:00.000Z',
    }],
});
assert.equal((await chatRepository.listMessagesAwaitingDigest(digestRoom.id, 'xiaolian', 12, 40)).length, 0);
assert.deepEqual(
    (await chatRepository.listRecentMessagesForPersona(digestRoom.id, 'xiaolian', 12)).map((message) => message.id),
    Array.from({ length: 12 }, (_, index) => `digest-message-${index + 8}`),
);
for (let index = 20; index < 26; index += 1) {
    await chatRepository.insertMessage({
        id: `digest-message-${index}`,
        room_id: digestRoom.id,
        persona_id: 'xiaolian',
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: `turn ${index}`,
        created_at: `2026-09-12T00:01:${String(index).padStart(2, '0')}.000Z`,
    });
}
const secondPendingDigest = await chatRepository.listMessagesAwaitingDigest(digestRoom.id, 'xiaolian', 12, 40);
assert.deepEqual(
    secondPendingDigest.map((message) => message.id),
    Array.from({ length: 6 }, (_, index) => `digest-message-${index + 8}`),
    'the next digest must begin immediately after the first covered boundary',
);
await chatRepository.saveRoomDigest(digestRoom.id, 'xiaolian', {
    summary: '- turns 0 through 13 recursively merged',
    covered_through: secondPendingDigest.at(-1).created_at,
    covered_count: pendingDigest.length + secondPendingDigest.length,
    updated_at: '2026-09-12T00:03:00.000Z',
    root_node_id: 'digest-node-2',
    nodes: [
        (await chatRepository.getRoomDigest(digestRoom.id, 'xiaolian')).nodes[0],
        {
            id: 'digest-node-2',
            summary: '- turns 0 through 13 recursively merged',
            parent_node_id: 'digest-node-1',
            source_message_ids: secondPendingDigest.map((message) => message.id),
            covered_from: secondPendingDigest[0].created_at,
            covered_through: secondPendingDigest.at(-1).created_at,
            source_message_count: secondPendingDigest.length,
            created_at: '2026-09-12T00:03:00.000Z',
        },
    ],
});
const chainedDigest = await chatRepository.getRoomDigest(digestRoom.id, 'xiaolian');
assert.equal(chainedDigest.nodes.length, 2);
assert.equal(chainedDigest.nodes[1].parent_node_id, chainedDigest.nodes[0].id);
assert.equal((await chatRepository.listMessagesAwaitingDigest(digestRoom.id, 'xiaolian', 12, 40)).length, 0);
await chatRepository.deleteRoom(digestRoom.id);

const directivePersonaId = 'unbounded-directive-verification';
for (let index = 0; index < 150; index += 1) {
    const memoryText = index === 0
        ? '내가 가장 좋아하는 색은 코발트라고 반드시 기억해'
        : `장기 관계 변수 ${String(index).padStart(3, '0')}를 기억해`;
    await chatRepository.insertDirectiveMemory({
        id: `unbounded-directive-${index}`,
        persona_id: directivePersonaId,
        memory_type: 'directive',
        memory_text: memoryText,
        memory_vector: createLexicalMemoryVector(memoryText),
        created_at: `2026-09-12T01:${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}.000Z`,
    });
}
assert.equal(await chatRepository.countDirectiveMemories(directivePersonaId), 150, 'remember directives must not be evicted by a fixed capacity');
const recalledOldDirective = await chatRepository.searchDirectiveMemories(
    directivePersonaId,
    createLexicalMemoryVector('내가 좋아하는 코발트 색 기억나?'),
    4,
);
assert.ok(recalledOldDirective.some((memory) => memory.includes('코발트')), 'an old relevant directive must remain behavior-addressable after later directives accumulate');

assembledPromptLengths.sort((left, right) => left - right);
const medianPromptLength = assembledPromptLengths[Math.floor(assembledPromptLengths.length / 2)];

console.log(JSON.stringify({
    persona_files: personaFiles.length,
    localized_persona_parses: localizedAssemblies,
    parsed_response_exchanges: exchangeCount,
    persona_language_pairs_with_examples: personasWithExamples,
    xiaolian_korean_response_exchanges: xiaolianKoreanExchanges.length,
    xiaolian_relevant_examples: dumplingExamples.length,
    assembled_system_prompts: assembledPromptLengths.length,
    unique_system_prompts_by_language: Object.fromEntries(
        LANGUAGES.map((language) => [language, uniquePromptBodiesByLanguage.get(language).size]),
    ),
    system_prompt_chars: {
        minimum: assembledPromptLengths[0],
        median: medianPromptLength,
        maximum: assembledPromptLengths.at(-1),
    },
    indexeddb_provenance_delete: 'passed',
    indexeddb_digest_boundary: 'passed',
    indexeddb_recursive_digest: 'passed',
    rebecca_colloquial_voice_retrieval: 'passed',
    persona_specific_initial_emotion: 'passed',
    unbounded_directive_recall: 'passed',
    persistent_emotion_state: 'passed',
    chrome_persona_injection_and_session_reuse: 'passed',
    contracts: 'passed',
}, null, 2));
await vite.close();
