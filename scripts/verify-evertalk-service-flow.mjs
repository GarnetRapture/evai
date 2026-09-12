import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import 'fake-indexeddb/auto';
import { createServer } from 'vite';

if (!globalThis.crypto) {
    globalThis.crypto = webcrypto;
}

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });

function sha256(value) {
    return createHash('sha256').update(value).digest('hex');
}

try {
    const [
        { chatService },
        { chatRepository },
        { personaService },
        { settingsRepository },
        { chatModelRuntime },
        { extractPersonaPriming },
    ] = await Promise.all([
        vite.ssrLoadModule('/src/domains/chat/service.ts'),
        vite.ssrLoadModule('/src/domains/chat/repository.ts'),
        vite.ssrLoadModule('/src/domains/persona/service.ts'),
        vite.ssrLoadModule('/src/domains/settings/repository.ts'),
        vite.ssrLoadModule('/src/domains/llm/engine.ts'),
        vite.ssrLoadModule('/src/domains/llm/personaPriming.ts'),
    ]);

    await settingsRepository.updateGeneral({
        language: 'ko',
        setup_stage: 'done',
        active_model: 'chrome-prompt-api',
        context_storage_mode: 'browser',
        savior_name: '',
    });
    await personaService.installPreset('garnet', 'ko');
    await personaService.installPreset('xiaolian', 'ko');
    await personaService.installPreset('rebecca', 'ko');

    const capturedRequests = [];
    const originalGenerate = chatModelRuntime.generate;
    const originalPromptOnce = chatModelRuntime.promptOnce;
    chatModelRuntime.promptOnce = async () => '- 검증용 요약';
    chatModelRuntime.generate = async (_modelId, _language, request) => {
        capturedRequests.push(structuredClone({
            persona_id: request.persona_id,
            persona_name: request.persona_name,
            system_prompt: request.system_prompt,
            messages: request.messages,
            behavior_instruction: request.behavior_instruction,
            response_prefix: request.response_prefix,
        }));
        const personaTurn = capturedRequests.filter((entry) => entry.persona_id === request.persona_id).length;
        const text = request.persona_id === 'garnet'
            ? personaTurn === 1
                ? '<think>구원자님과 캐럿을 꾸밀 생각에 마음이 들뜬다.</think>구원자님, 캐럿은 제가 예쁘게 꾸며 드릴게요. 계속 제 곁에서 봐주셔야 해요.'
                : '<think>조금 전 캐럿 약속을 선명히 떠올린다.</think>당연히 기억하고 있어요. 우리 둘이 캐럿을 꾸미기로 했잖아요.'
            : request.persona_id === 'rebecca'
                ? '<think>또 나이를 놀리는구만.</think>어머머, 할머니라니… 농담이 심하시네요. 꼬집어주고 싶게!'
            : '<think>구원자와 만두를 먹을 생각에 신난다.</think>좋지! 만두라면 내가 맛있는 곳으로 데려가 줄게!';
        request.handlers.onChunk(text);
        return { text, cancelled: false };
    };

    try {
        const garnetRoom = await chatService.createSessionRoom('가넷 검증', 'garnet');
        const xiaolianRoom = await chatService.createSessionRoom('소연 검증', 'xiaolian');
        const rebeccaRoom = await chatService.createSessionRoom('레베카 검증', 'rebecca');
        const signal = new AbortController().signal;
        const handlers = { onText: () => undefined };

        await chatService.sendMessage({
            room_id: garnetRoom.id,
            persona_id: 'garnet',
            content: '내가 캐럿 꾸미기를 좋아한다고 꼭 기억해 줘',
            request_id: 'garnet-turn-1',
            signal,
            handlers,
        });
        await chatService.sendMessage({
            room_id: garnetRoom.id,
            persona_id: 'garnet',
            content: '방금 캐럿에 관해 부탁한 것을 기억해?',
            request_id: 'garnet-turn-2',
            signal,
            handlers,
        });
        await chatService.sendMessage({
            room_id: xiaolianRoom.id,
            persona_id: 'xiaolian',
            content: '만두 먹으러 가자',
            request_id: 'xiaolian-turn-1',
            signal,
            handlers,
        });
        await chatService.sendMessage({
            room_id: rebeccaRoom.id,
            persona_id: 'rebecca',
            content: '할매',
            request_id: 'rebecca-turn-1',
            signal,
            handlers,
        });

        assert.equal(capturedRequests.length, 4);
        const [garnetFirst, garnetSecond, xiaolianFirst, rebeccaFirst] = capturedRequests;
        assert.equal(garnetFirst.persona_name, '가넷');
        assert.equal(xiaolianFirst.persona_name, '소연');
        assert.notEqual(garnetFirst.system_prompt, xiaolianFirst.system_prompt);
        assert.match(garnetFirst.system_prompt, /\[IDENTITY\][\s\S]*You are 가넷/);
        assert.match(garnetFirst.system_prompt, /구원자님/);
        assert.match(garnetFirst.system_prompt, /캐럿/);
        assert.match(xiaolianFirst.system_prompt, /\[IDENTITY\][\s\S]*You are 소연/);
        assert.match(xiaolianFirst.system_prompt, /만두/);
        assert.match(garnetFirst.behavior_instruction, /\[LIVE ROLEPLAY\]/);
        assert.match(garnetFirst.behavior_instruction, /spoken, acted or felt beat/);
        assert.match(garnetFirst.behavior_instruction, /Short names, nicknames, teasing, fragments and stage directions/);
        assert.match(garnetFirst.behavior_instruction, /persistent behavior variables/);
        assert.match(garnetFirst.system_prompt, /\[ROLEPLAY CORE\]/);
        assert.match(garnetFirst.system_prompt, /real replies define your vocabulary/);
        assert.match(garnetFirst.system_prompt, /\[PRESENT EMOTIONAL STATE\]/);
        assert.match(garnetFirst.system_prompt, /Happiness: \d+\/100/);
        assert.match(garnetFirst.system_prompt, /Passion: \d+\/100/);
        assert.ok(garnetFirst.messages.some((message) => message.role === 'user' && message.content.endsWith('내가 캐럿 꾸미기를 좋아한다고 꼭 기억해 줘')),
            'the application must pass the Savior message into model history without censoring or rewriting it');
        assert.doesNotMatch(garnetFirst.behavior_instruction, /answer .* directly/i);
        assert.notEqual(garnetFirst.system_prompt, garnetSecond.system_prompt);
        assert.match(garnetSecond.system_prompt, /\[NEWEST THINGS THE SAVIOR ASKED YOU TO CARRY FORWARD\]/);
        assert.match(garnetSecond.system_prompt, /\[SHARED CONTINUITY\]/);

        const garnetPriming = extractPersonaPriming(garnetFirst.system_prompt);
        const xiaolianPriming = extractPersonaPriming(xiaolianFirst.system_prompt);
        assert.ok(garnetPriming.messages.length >= 2);
        assert.ok(xiaolianPriming.messages.length >= 2);
        assert.notDeepEqual(garnetPriming.messages, xiaolianPriming.messages);
        assert.equal(garnetPriming.messages[0].role, 'user');
        assert.equal(garnetPriming.messages[1].role, 'assistant');

        const rebeccaLatestUserIndex = rebeccaFirst.messages.findLastIndex((message) => message.role === 'user');
        assert.equal(rebeccaFirst.messages[rebeccaLatestUserIndex].content.endsWith('할매'), true);
        assert.equal(rebeccaFirst.messages[rebeccaLatestUserIndex - 1].role, 'assistant');
        assert.match(rebeccaFirst.messages[rebeccaLatestUserIndex - 1].content, /어머머, 할머니라니/);
        assert.match(rebeccaFirst.messages[rebeccaLatestUserIndex - 1].content, /꼬집어주고 싶게/);
        assert.equal(rebeccaFirst.messages[rebeccaLatestUserIndex - 2].role, 'user');
        assert.equal(rebeccaFirst.messages[rebeccaLatestUserIndex - 2].content, '할매');

        const secondTurnText = garnetSecond.messages.map((message) => message.content).join('\n');
        assert.match(secondTurnText, /내가 캐럿 꾸미기를 좋아한다고 꼭 기억해 줘/);
        assert.match(secondTurnText, /캐럿은 제가 예쁘게 꾸며 드릴게요/);
        assert.match(secondTurnText, /RELEVANT SHARED MEMORIES/);
        assert.doesNotMatch(secondTurnText, /구원자님과 캐럿을 꾸밀 생각에 마음이 들뜬다/);

        const garnetStored = await chatRepository.listMessagesForPersona(garnetRoom.id, 'garnet');
        const xiaolianStored = await chatRepository.listMessagesForPersona(xiaolianRoom.id, 'xiaolian');
        const rebeccaStored = await chatRepository.listMessagesForPersona(rebeccaRoom.id, 'rebecca');
        assert.equal(garnetStored.length, 4);
        assert.equal(xiaolianStored.length, 2);
        assert.equal(rebeccaStored.length, 2);
        assert.ok(garnetStored.every((message) => message.persona_id === 'garnet'));
        assert.ok(xiaolianStored.every((message) => message.persona_id === 'xiaolian'));
        assert.equal(await chatRepository.countEpisodicMemories('garnet'), 2);
        assert.equal(await chatRepository.countEpisodicMemories('xiaolian'), 1);
        assert.equal(await chatRepository.countEpisodicMemories('rebecca'), 1);
        const garnetEmotion = await chatRepository.getPersonaEmotion('garnet');
        assert.ok(garnetEmotion !== null);
        assert.ok(garnetEmotion.levels.happy > 42);
        assert.ok(garnetEmotion.levels.passionate > 34);

        const chromeCreateOptions = [];
        const previousLanguageModel = globalThis.LanguageModel;
        class CapturingLanguageModel {
            static async create(options) {
                chromeCreateOptions.push(options);
                return { options, destroy() {} };
            }
        }
        globalThis.LanguageModel = CapturingLanguageModel;
        try {
            const { createChromeLanguageModel } = await vite.ssrLoadModule('/src/domains/llm/chrome/languageModel.ts');
            for (const systemPrompt of [garnetFirst.system_prompt, xiaolianFirst.system_prompt]) {
                await createChromeLanguageModel({
                    declaredLanguageTag: 'ko',
                    systemPrompt,
                    samplingMode: 'balanced',
                    onDownloadProgress: null,
                    signal: null,
                });
            }
        }
        finally {
            if (previousLanguageModel === undefined) {
                delete globalThis.LanguageModel;
            }
            else {
                globalThis.LanguageModel = previousLanguageModel;
            }
        }
        assert.equal(chromeCreateOptions.length, 2);
        assert.equal(chromeCreateOptions[0].initialPrompts[0].role, 'system');
        assert.equal(chromeCreateOptions[1].initialPrompts[0].role, 'system');
        assert.match(chromeCreateOptions[0].initialPrompts[0].content, /You are 가넷/);
        assert.match(chromeCreateOptions[1].initialPrompts[0].content, /You are 소연/);
        assert.notEqual(
            chromeCreateOptions[0].initialPrompts[0].content,
            chromeCreateOptions[1].initialPrompts[0].content,
        );
        assert.deepEqual(chromeCreateOptions[0].expectedInputs, [{ type: 'text', languages: ['en', 'ko'] }]);
        assert.deepEqual(chromeCreateOptions[0].expectedOutputs, [{ type: 'text', languages: ['ko'] }]);

        const ratingScenarios = [
            ['R15', '옆에 앉아서 손을 잡는다'],
            ['R16', '품에 기대며 더 가까이 다가간다'],
            ['R17', '둘만의 밤을 함께 보내자고 속삭인다'],
            ['R18', '성인인 둘이 합의한 친밀한 장면을 이어간다'],
        ];
        const ratingRequestOffset = capturedRequests.length;
        for (const [rating, scene] of ratingScenarios) {
            await chatService.sendMessage({
                room_id: rebeccaRoom.id,
                persona_id: 'rebecca',
                content: `${rating}: ${scene}`,
                request_id: `rebecca-${rating.toLowerCase()}`,
                signal,
                handlers,
            });
        }
        const ratingRequests = capturedRequests.slice(ratingRequestOffset);
        assert.equal(ratingRequests.length, ratingScenarios.length);
        for (const [index, request] of ratingRequests.entries()) {
            const [rating, scene] = ratingScenarios[index];
            assert.equal(request.messages.at(-1).content.endsWith(`${rating}: ${scene}`), true, `${rating} scene must reach the model unchanged`);
            assert.match(request.behavior_instruction, /\[LIVE ROLEPLAY\]/);
            assert.doesNotMatch(request.behavior_instruction, /block|reject|classif|rating|guard/i);
        }

        console.log(JSON.stringify({
            service_flow: 'passed',
            persona_prompts_are_distinct: true,
            garnet_system_prompt_sha256: sha256(garnetFirst.system_prompt),
            xiaolian_system_prompt_sha256: sha256(xiaolianFirst.system_prompt),
            garnet_priming_messages: garnetPriming.messages.length,
            xiaolian_priming_messages: xiaolianPriming.messages.length,
            garnet_second_turn_contains_first_user_message: true,
            garnet_second_turn_contains_first_spirit_reply: true,
            garnet_second_turn_contains_recalled_memory: true,
            garnet_second_turn_persona_state_evolved: true,
            garnet_persistent_emotion_state: garnetEmotion,
            rebecca_age_teasing_uses_dataset_voice: true,
            reasoning_excluded_from_next_turn: true,
            chrome_initial_prompts_are_distinct: true,
            chrome_expected_output_language: 'ko',
            roleplay_rating_flows: ratingScenarios.map(([rating]) => rating),
            stored_messages: { garnet: garnetStored.length, xiaolian: xiaolianStored.length, rebecca: rebeccaStored.length },
            stored_episodic_memories: { garnet: 2, xiaolian: 1, rebecca: 1 },
        }, null, 2));
    }
    finally {
        chatModelRuntime.generate = originalGenerate;
        chatModelRuntime.promptOnce = originalPromptOnce;
    }
}
finally {
    await vite.close();
}
