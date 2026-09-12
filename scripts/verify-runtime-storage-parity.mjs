import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { chmod, copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import 'fake-indexeddb/auto';
import { createServer } from 'vite';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
process.env.EVERSOUL_NATIVE_HEADLESS = '1';

const ROOT = process.cwd();
const LANGUAGES = ['ko', 'en', 'zh_cn'];
const PERSONA_LIMIT = 30;
const executableName = process.platform === 'win32' ? 'eversoul-native-host.exe' : 'eversoul-native-host';
const sourceExecutable = path.join(ROOT, 'native', 'build', executableName);
const runtimeRoot = path.join(ROOT, 'native', 'build');
await mkdir(runtimeRoot, { recursive: true });
const isolatedDirectory = await mkdtemp(path.join(runtimeRoot, 'runtime-storage-parity-'));
const isolatedExecutable = path.join(isolatedDirectory, executableName);
await copyFile(sourceExecutable, isolatedExecutable);
if (process.platform !== 'win32') await chmod(isolatedExecutable, 0o755);

const vite = await createServer({
    logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0 },
});
const createdRoomIds = [];
let originalGenerate;
let originalPromptOnce;
let originalFetch;

function languageSignal(language, text) {
    if (language === 'ko') return /\p{Script=Hangul}/u.test(text);
    if (language === 'zh_cn') return /\p{Script=Han}/u.test(text) && !/\p{Script=Hangul}/u.test(text);
    return /[A-Za-z]/u.test(text) && !/\p{Script=Hangul}/u.test(text);
}

function hash(value) {
    return createHash('sha256').update(value).digest('hex');
}

try {
    await vite.listen();
    const address = vite.httpServer?.address();
    assert.ok(address && typeof address === 'object');
    const endpoint = `http://127.0.0.1:${address.port}/__eversoul/native-context`;
    originalFetch = globalThis.fetch;
    globalThis.fetch = (input, init) => originalFetch(new URL(String(input), endpoint), init);

    const [
        { chatService },
        { chatRepository },
        { personaService },
        { settingsRepository },
        { chatModelRuntime },
        { nativeContextClient },
        { buildPersonaLanguageSlice },
        { parsePersonaDialogueExchanges, selectRelevantDialogueExamples },
        { normalizeChatOutput },
        { getEverSoulDatabase, EVERSOUL_STORE },
        { PROACTIVE_MIN_IDLE_MS },
    ] = await Promise.all([
        vite.ssrLoadModule('/src/domains/chat/service.ts'),
        vite.ssrLoadModule('/src/domains/chat/repository.ts'),
        vite.ssrLoadModule('/src/domains/persona/service.ts'),
        vite.ssrLoadModule('/src/domains/settings/repository.ts'),
        vite.ssrLoadModule('/src/domains/llm/engine.ts'),
        vite.ssrLoadModule('/src/domains/native/client.ts'),
        vite.ssrLoadModule('/src/domains/persona/slice.ts'),
        vite.ssrLoadModule('/src/domains/persona/dialogue.ts'),
        vite.ssrLoadModule('/src/domains/chat/output.ts'),
        vite.ssrLoadModule('/src/shared/storage/index.ts'),
        vite.ssrLoadModule('/src/domains/chat/proactive.ts'),
    ]);

    const personaDirectory = path.join(ROOT, 'data', 'personas');
    const personaFiles = (await readdir(personaDirectory)).filter((file) => file.endsWith('.json')).sort();
    const selected = [];
    for (const file of personaFiles) {
        const pack = JSON.parse(await readFile(path.join(personaDirectory, file), 'utf8'));
        const cases = new Map();
        for (const language of LANGUAGES) {
            const slice = buildPersonaLanguageSlice(pack, language);
            const exchanges = parsePersonaDialogueExchanges(slice, language);
            const dialogue = exchanges.find((exchange) => languageSignal(language, `${exchange.user_message} ${exchange.spirit_messages.join(' ')}`)
                && selectRelevantDialogueExamples(exchanges, exchange.user_message, 2).some((selectedExchange) => selectedExchange.user_message === exchange.user_message));
            if (dialogue) cases.set(language, { slice, dialogue });
        }
        if (cases.size === LANGUAGES.length) {
            selected.push({ archiveKey: file.slice(0, -5), cases });
            if (selected.length === PERSONA_LIMIT) break;
        }
    }
    assert.equal(selected.length, PERSONA_LIMIT, 'Thirty personas must have real dialogue examples in all three languages.');

    const casesByPersonaLanguage = new Map();
    for (const persona of selected) {
        const stored = await personaService.installPreset(persona.archiveKey, 'ko');
        persona.id = stored.id;
        for (const language of LANGUAGES) {
            casesByPersonaLanguage.set(`${stored.id}\0${language}`, persona.cases.get(language));
        }
    }

    originalGenerate = chatModelRuntime.generate;
    originalPromptOnce = chatModelRuntime.promptOnce;
    const capturedRequests = [];
    chatModelRuntime.promptOnce = async () => '- runtime storage parity summary';
    chatModelRuntime.generate = async (_modelId, language, request) => {
        const testCase = casesByPersonaLanguage.get(`${request.persona_id}\0${language}`);
        assert.ok(testCase, `${request.persona_id}/${language}: missing runtime dialogue case`);
        const actualReply = testCase.dialogue.spirit_messages.join('\n');
        const proactive = request.messages.at(-1)?.content.includes('[NO NEW MESSAGE FROM ') === true;
        assert.equal(request.persona_name, testCase.slice.name);
        assert.ok(request.system_prompt.includes(testCase.slice.name));
        assert.ok(request.behavior_instruction.includes('[YOUR TURN]'));
        if (!proactive) {
            assert.ok(request.messages.at(-1).role === 'user' && request.messages.at(-1).content.endsWith(`\n${testCase.dialogue.user_message}`));
            assert.ok(request.messages.slice(0, -1).every((message) => !message.content.includes(testCase.dialogue.user_message)), 'the live user turn must appear exactly once');
        }
        capturedRequests.push({
            kind: proactive ? 'proactive' : 'conversation',
            mode: (await settingsRepository.readGeneral()).context_storage_mode,
            personaId: request.persona_id,
            language,
            promptHash: hash(request.system_prompt),
        });
        request.handlers.onChunk(actualReply);
        return { text: actualReply, cancelled: false };
    };

    nativeContextClient.setPreferredExecutablePath(isolatedExecutable);
    await settingsRepository.updateGeneral({
        setup_stage: 'done',
        active_model: 'chrome-prompt-api',
        native_executable_path: isolatedExecutable,
        savior_name: '',
    });

    async function runMode(mode) {
        const startedAt = performance.now();
        const results = [];
        await settingsRepository.updateGeneral({ context_storage_mode: mode });
        for (const language of LANGUAGES) {
            await settingsRepository.updateGeneral({ language });
            for (const persona of selected) {
                const testCase = persona.cases.get(language);
                const room = await chatService.createSessionRoom(`storage-${mode}-${persona.id}-${language}`, persona.id);
                createdRoomIds.push(room.id);
                const assistant = await chatService.sendMessage({
                    room_id: room.id,
                    persona_id: persona.id,
                    content: testCase.dialogue.user_message,
                    request_id: `${mode}-${persona.id}-${language}`,
                    signal: new AbortController().signal,
                    handlers: { onText: () => undefined },
                });
                const expectedReply = normalizeChatOutput(testCase.dialogue.spirit_messages.join('\n'), language);
                assert.equal(assistant.content, expectedReply);
                const indexedDbMessages = await chatRepository.listMessagesForPersona(room.id, persona.id);
                assert.deepEqual(indexedDbMessages.map((message) => message.content), [testCase.dialogue.user_message, expectedReply]);
                const native = await nativeContextClient.queryContext(persona.id, room.id, 5, 200);
                if (mode === 'browser') {
                    assert.equal(native.messages.length, 0, `${persona.id}/${language}: browser mode leaked into SQLite`);
                }
                else {
                    assert.deepEqual(native.messages.map((message) => message.content), [testCase.dialogue.user_message, expectedReply]);
                    assert.equal(
                        native.memories.filter((memory) => memory.memory_type === 'episodic').length,
                        LANGUAGES.indexOf(language) + 1,
                        `${persona.id}/${language}: unexpected SQLite episodic count`,
                    );
                }
                results.push({
                    roomId: room.id,
                    personaId: persona.id,
                    language,
                    expected: [testCase.dialogue.user_message, expectedReply],
                    messageIds: indexedDbMessages.map((message) => message.id),
                });
            }
        }
        return { results, elapsedMs: Math.round((performance.now() - startedAt) * 100) / 100 };
    }

    const browserRun = await runMode('browser');
    await settingsRepository.updateGeneral({ context_storage_mode: 'browser' });
    for (const entry of browserRun.results) await chatRepository.deleteRoom(entry.roomId);

    const nativeRun = await runMode('native_mirror');
    const databasePath = (await nativeContextClient.health()).health.database_path;
    const databaseStat = await stat(databasePath);
    assert.ok(databaseStat.size > 0);
    const sqliteHeader = await readFile(databasePath).then((data) => data.subarray(0, 16).toString('binary'));
    assert.equal(sqliteHeader, 'SQLite format 3\0');
    assert.equal(path.dirname(databasePath), path.dirname(isolatedExecutable));

    const database = await getEverSoulDatabase();
    for (const entry of nativeRun.results) {
        const transaction = database.transaction(EVERSOUL_STORE.chatMessage, 'readwrite');
        for (const messageId of entry.messageIds) await transaction.store.delete(messageId);
        await transaction.done;
    }
    const restoreStartedAt = performance.now();
    let restoredMessageCount = 0;
    for (const entry of nativeRun.results) {
        const restored = await chatRepository.listMessagesForPersona(entry.roomId, entry.personaId);
        assert.deepEqual(restored.map((message) => message.content), entry.expected);
        restoredMessageCount += restored.length;
    }
    const restoreElapsedMs = Math.round((performance.now() - restoreStartedAt) * 100) / 100;

    for (const language of LANGUAGES) {
        const browserPrompts = new Set(capturedRequests.filter((request) => request.kind === 'conversation' && request.mode === 'browser' && request.language === language).map((request) => request.promptHash));
        const nativePrompts = new Set(capturedRequests.filter((request) => request.kind === 'conversation' && request.mode === 'native_mirror' && request.language === language).map((request) => request.promptHash));
        assert.equal(browserPrompts.size, PERSONA_LIMIT, `${language}: browser prompts must be persona-distinct`);
        assert.equal(nativePrompts.size, PERSONA_LIMIT, `${language}: native prompts must be persona-distinct`);
    }

    const proactivePersona = selected[0];
    const proactiveCase = proactivePersona.cases.get('zh_cn');
    const proactiveRoom = await chatService.createSessionRoom('native-proactive-runtime', proactivePersona.id);
    createdRoomIds.push(proactiveRoom.id);
    await chatService.sendMessage({
        room_id: proactiveRoom.id,
        persona_id: proactivePersona.id,
        content: proactiveCase.dialogue.user_message,
        request_id: 'native-proactive-seed',
        signal: new AbortController().signal,
        handlers: { onText: () => undefined },
    });
    const proactiveCandidates = await chatRepository.listProactiveConversationCandidates();
    const proactiveCandidateIndex = proactiveCandidates.findIndex((candidate) => candidate.room_id === proactiveRoom.id);
    const proactiveCandidate = proactiveCandidates[proactiveCandidateIndex];
    assert.ok(proactiveCandidate);
    let proactiveRandomCall = 0;
    const nativeMessagesBeforeProactive = await nativeContextClient.queryContext(proactiveCandidate.persona_id, proactiveCandidate.room_id, 10, 0);
    const proactiveMessage = await chatService.tryGenerateProactiveMessage({
        now: new Date(Date.parse(proactiveCandidate.latest_activity_at) + PROACTIVE_MIN_IDLE_MS + 1_000),
        chance: 1,
        random: () => proactiveRandomCall++ === 0 ? (proactiveCandidateIndex + 0.1) / proactiveCandidates.length : 0,
    });
    assert.ok(proactiveMessage);
    assert.equal(proactiveMessage.persona_id, proactiveCandidate.persona_id);
    assert.equal(proactiveMessage.delivery, 'proactive');
    const nativeMessagesAfterProactive = await nativeContextClient.queryContext(proactiveCandidate.persona_id, proactiveCandidate.room_id, 10, 0);
    assert.equal(nativeMessagesAfterProactive.messages.length, nativeMessagesBeforeProactive.messages.length + 1);
    assert.equal(nativeMessagesAfterProactive.messages.at(-1).content, proactiveMessage.content);
    assert.equal((await chatRepository.listProactiveUnreadCounts())[proactiveCandidate.persona_id], 1);
    await chatRepository.markProactiveMessagesRead(proactiveCandidate.persona_id, new Date().toISOString());

    console.log(JSON.stringify({
        runtime_storage_parity: 'passed',
        personas: PERSONA_LIMIT,
        languages: LANGUAGES,
        dialogue_cases_per_mode: PERSONA_LIMIT * LANGUAGES.length,
        total_runtime_dialogue_cases: PERSONA_LIMIT * LANGUAGES.length * 2,
        indexeddb: {
            messages_written: browserRun.results.length * 2,
            sqlite_messages_for_browser_rooms: 0,
            elapsed_ms: browserRun.elapsedMs,
        },
        native_sqlite_extension: {
            indexeddb_messages_written_before_recovery_test: nativeRun.results.length * 2,
            sqlite_messages_written: nativeRun.results.length * 2,
            sqlite_episodic_memories_written: nativeRun.results.length,
            messages_restored_after_indexeddb_rows_removed: restoredMessageCount,
            elapsed_ms: nativeRun.elapsedMs,
            recovery_query_elapsed_ms: restoreElapsedMs,
            database_path: databasePath,
            database_bytes: databaseStat.size,
            sqlite_header: 'SQLite format 3',
        },
        persona_distinct_prompts: { ko: PERSONA_LIMIT, en: PERSONA_LIMIT, zh_cn: PERSONA_LIMIT },
        actual_json_dialogue_used_for_user_and_spirit_turns: true,
        proactive_message_mirrored_to_sqlite: true,
    }, null, 2));
}
finally {
    try {
        if (originalGenerate) {
            const { chatModelRuntime } = await vite.ssrLoadModule('/src/domains/llm/engine.ts');
            chatModelRuntime.generate = originalGenerate;
            chatModelRuntime.promptOnce = originalPromptOnce;
        }
        const [{ settingsRepository }, { chatRepository }, { nativeContextClient }] = await Promise.all([
            vite.ssrLoadModule('/src/domains/settings/repository.ts'),
            vite.ssrLoadModule('/src/domains/chat/repository.ts'),
            vite.ssrLoadModule('/src/domains/native/client.ts'),
        ]);
        await settingsRepository.updateGeneral({ context_storage_mode: 'native_mirror', native_executable_path: isolatedExecutable });
        nativeContextClient.setPreferredExecutablePath(isolatedExecutable);
        for (const roomId of createdRoomIds) {
            try { await chatRepository.deleteRoom(roomId); } catch { /* best-effort isolated test cleanup */ }
        }
        try { await nativeContextClient.disconnect(); } catch { /* bridge may already be closed */ }
        await settingsRepository.updateGeneral({ context_storage_mode: 'browser', native_executable_path: '' });
    }
    finally {
        if (originalFetch) globalThis.fetch = originalFetch;
        await vite.close();
        const resolvedIsolatedDirectory = path.resolve(isolatedDirectory);
        const resolvedRuntimeRoot = `${path.resolve(runtimeRoot)}${path.sep}`;
        assert.ok(resolvedIsolatedDirectory.startsWith(resolvedRuntimeRoot), 'Refusing to remove a directory outside native/build.');
        await rm(resolvedIsolatedDirectory, { recursive: true, force: true });
    }
}
