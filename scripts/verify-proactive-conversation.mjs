import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import 'fake-indexeddb/auto';
import { createServer } from 'vite';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });

try {
    const [
        { chatService },
        { chatRepository },
        { personaService },
        { settingsRepository },
        { chatModelRuntime },
        { PROACTIVE_ATTEMPT_COOLDOWN_MS, PROACTIVE_MIN_IDLE_MS },
    ] = await Promise.all([
        vite.ssrLoadModule('/src/domains/chat/service.ts'),
        vite.ssrLoadModule('/src/domains/chat/repository.ts'),
        vite.ssrLoadModule('/src/domains/persona/service.ts'),
        vite.ssrLoadModule('/src/domains/settings/repository.ts'),
        vite.ssrLoadModule('/src/domains/llm/engine.ts'),
        vite.ssrLoadModule('/src/domains/chat/proactive.ts'),
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

    const captured = [];
    const originalGenerate = chatModelRuntime.generate;
    chatModelRuntime.generate = async (_modelId, _language, request) => {
        captured.push(structuredClone({
            persona_id: request.persona_id,
            system_prompt: request.system_prompt,
            messages: request.messages,
            behavior_instruction: request.behavior_instruction,
        }));
        const proactive = request.messages.at(-1)?.content.includes('[SPONTANEOUS CONTINUATION]');
        const text = proactive
            ? '<think>함께 꾸미기로 한 캐럿이 문득 궁금해져 먼저 말을 걸고 싶다.</think>구원자님, 우리 캐럿은 어떤 색으로 꾸밀까요? 아까부터 계속 궁금했어요.'
            : '<think>구원자님과 한 약속을 소중히 간직한다.</think>좋아요. 우리 함께 캐럿을 꾸미기로 해요. 꼭 기억할게요.';
        request.handlers.onChunk(text);
        return { text, cancelled: false };
    };

    try {
        const room = await chatService.createSessionRoom('선제 대화 검증', 'garnet');
        await chatService.sendMessage({
            room_id: room.id,
            persona_id: 'garnet',
            content: '우리 다음에 캐럿을 같이 꾸미자. 꼭 기억해 줘.',
            request_id: 'seed-conversation',
            signal: new AbortController().signal,
            handlers: { onText: () => undefined },
        });
        assert.equal((await chatRepository.listProactiveConversationCandidates()).length, 1, '대화 이력이 없는 소연은 후보가 아니어야 한다.');

        const seedActivity = Date.parse((await chatRepository.listProactiveConversationCandidates())[0].latest_activity_at);
        const proactiveNow = new Date(seedActivity + PROACTIVE_MIN_IDLE_MS + 1_000);
        const generated = await chatService.tryGenerateProactiveMessage({
            now: proactiveNow,
            chance: 1,
            random: () => 0,
        });
        assert.ok(generated);
        assert.equal(generated.persona_id, 'garnet');
        assert.equal(generated.delivery, 'proactive');
        assert.equal(generated.read_at, null);

        const proactiveRequest = captured.at(-1);
        const promptText = proactiveRequest.messages.map((message) => message.content).join('\n');
        assert.equal(proactiveRequest.persona_id, 'garnet');
        assert.match(proactiveRequest.system_prompt, /\[IDENTITY\][\s\S]*You are 가넷/);
        assert.match(promptText, /우리 다음에 캐럿을 같이 꾸미자/);
        assert.match(promptText, /우리 함께 캐럿을 꾸미기로 해요/);
        assert.match(promptText, /RELEVANT SHARED MEMORIES/);
        assert.match(promptText, /SPONTANEOUS CONTINUATION/);
        assert.doesNotMatch(promptText, /함께 꾸미기로 한 캐럿이 문득 궁금해져/);

        const stored = await chatRepository.listMessagesForPersona(room.id, 'garnet');
        assert.equal(stored.length, 3);
        assert.equal(stored.filter((message) => message.role === 'user').length, 1, '선제 생성을 위한 내부 지시는 사용자 대화로 저장되면 안 된다.');
        assert.equal(stored.at(-1).delivery, 'proactive');
        assert.deepEqual(await chatRepository.listProactiveUnreadCounts(), { garnet: 1 });

        const blockedByCooldown = await chatService.tryGenerateProactiveMessage({
            now: new Date(proactiveNow.getTime() + PROACTIVE_ATTEMPT_COOLDOWN_MS - 1),
            chance: 1,
            random: () => 0,
        });
        assert.equal(blockedByCooldown, null);
        assert.equal(captured.length, 2, '쿨다운 중에는 모델 호출이 없어야 한다.');

        await chatRepository.markProactiveMessagesRead('garnet', new Date(proactiveNow.getTime() + 1).toISOString());
        assert.deepEqual(await chatRepository.listProactiveUnreadCounts(), {});
        assert.equal((await chatRepository.listMessagesForPersona(room.id, 'garnet')).at(-1).read_at !== null, true);

        console.log(JSON.stringify({
            proactive_conversation: 'passed',
            history_required: true,
            recent_context_and_memory_injected: true,
            persona_prompt_injected: true,
            ephemeral_trigger_not_persisted: true,
            unread_after_generation: 1,
            unread_after_open: 0,
            cooldown_prevented_duplicate_generation: true,
        }, null, 2));
    }
    finally {
        chatModelRuntime.generate = originalGenerate;
    }
}
finally {
    await vite.close();
}
