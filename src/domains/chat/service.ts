import { DomainError } from "../../shared/errors";
import { createMonotonicTimestamp } from "../../shared/time";
import type { AppLanguage } from "../../shared/types";
import { knowledgeClient } from "../knowledge/client";
import { chatModelRuntime } from "../llm";
import {
  FAMILIARITY_MAX_LEVEL,
  computeFamiliarityLevel,
  findEmotionPreset,
  resolveActivePersonaCheatPreset,
  resolveBondProgress,
  resolvePersonaFamiliarityLevel,
  type PersonaCheatPreset,
} from "../persona";
import { personaDatasetService } from "../persona/datasetService";
import { selectPersonaIntimacyDialogue } from "../persona/intimacyPattern";
import { personaService } from "../persona/service";
import type { PersonaTemperament } from "../persona/types";
import { detectPersonaUserTurnPattern } from "../persona/userTurnPattern";
import { settingsRepository } from "../settings/repository";
import type { AppSettings } from "../settings/types";
import {
  IDLE_EMOTION_INFLUENCE,
  PERSONA_EMOTION_BASELINE,
  SPIRIT_MESSAGE_EMOTION_INFLUENCE,
  USER_MESSAGE_EMOTION_INFLUENCE,
  advancePersonaEmotion,
  applyProfileMentionEmotion,
  applyRivalAttention,
  createPersonaEmotionState,
  createPersonaEmotionStateFromLevels,
  replayPersonaEmotion,
  type PersonaEmotionLevels,
  type PersonaEmotionState,
} from "./affect";
import { recordProfileMentionAffinity } from "./affinity";
import {
  buildPersonaConversationFlow,
  selectCrossPersonaConversationExcerpts,
} from "./conversationFlow";
import { analyzeConversationState } from "./conversationState";
import { collectKeywordObservations } from "./habit";
import {
  derivePersonaHeartTimeline,
  resolvePersonaHeartExpression,
  resolvePersonaJealousyNetwork,
} from "./heart";
import {
  CONTEXT_GRAPH_RELATION_LIMIT,
  KEYWORD_GRAPH_VIEW_EPISODE_LIMIT,
  KEYWORD_GRAPH_VIEW_THREAD_LIMIT,
  KEYWORD_THREAD_EPISODE_LIMIT,
  KEYWORD_THREAD_PROMPT_LIMIT,
  buildPersonaContextRelations,
  buildPersonaKeywordEpisode,
  buildPersonaKeywordNodes,
  selectContextKeywordNodes,
  selectKeywordEpisodeIds,
} from "./keywordGraph";
import { createLexicalMemoryVector } from "./memory";
import { buildPersonaMemoryOverview } from "./memoryOverview";
import { extractReasoning, stripReasoning } from "./output";
import {
  buildGreetingOpeningMessage,
  buildPersonaPrimingMessages,
  buildPersonaRedirectHook,
  buildPersonaTurnHook,
  toPersonaHistoryMessages,
} from "./personaTurnHook";
import {
  buildProactiveTurnBody,
  buildProactiveTurnHeading,
  countUnansweredProactiveMessages,
  pickProactiveCandidateByUrge,
  resolveProactiveSchedule,
} from "./proactive";
import {
  EPISODIC_INJECT_LIMIT,
  EVERTALK_SESSION_TITLE,
  KNOWLEDGE_INJECT_LIMIT,
  MEMORY_DIRECTIVE_LIMIT,
  RELEVANT_DIRECTIVE_LIMIT,
  SAVIOR_NAME_MAX_LENGTH,
  STORY_INJECT_LIMIT,
  buildNewMessageHeading,
  buildPersonaTurnContext,
  buildTurnMemoryText,
  describePersonaMood,
  detectSaviorName,
  mergeDirectiveMemories,
  shouldCaptureAsDirective,
  shouldOpenWithGreeting,
} from "./prompt";
import {
  buildPersonaReplySpec,
  detectPersonaReplyViolation,
  detectPersonaStreamingViolation,
  envelopeFromStoredReply,
  normalizePersonaReplyEnvelope,
  parsePersonaReplyEnvelope,
  renderPersonaReplyContent,
  renderPersonaStoredReplyContent,
  resolvePersonaReplyMessageLimit,
} from "./replyEnvelope";
import { chatRepository } from "./repository";
import {
  buildPersonaRivalContexts,
  countPersonaRivalAttention,
} from "./rivalContext";
import { buildPersonaTeachingGuidance } from "./teachingTurnHook";
import type {
  ChatMessage,
  ChatRoom,
  ChatSendRequest,
  PersonaAffinityGain,
  PersonaBehaviorStage,
  PersonaContactSnapshot,
  PersonaContextGraph,
  PersonaFamiliaritySource,
  PersonaHeartExpression,
  PersonaKeywordNode,
  PersonaKeywordThread,
  PersonaMemoryInsight,
  PersonaMemoryOverview,
  PersonaPreparedTurnReferences,
  PersonaRelationshipNetwork,
  PersonaReplyEnvelope,
  PersonaReplyGeneration,
  PersonaReplyGenerationInput,
  PersonaReplyViolation,
  PersonaRivalContext,
  PersonaSystemPrompt,
  PersonaTimelineEntry,
  PersonaTurnContext,
  PersonaTurnContextRequest,
  ProactiveGenerationOptions,
} from "./types";

const MEMORY_INSIGHT_LIMIT = 30;
// 버그 수정 (C-027, O-001 해소): 마지막 시도까지 검증을 통과하지 못하면 그대로
// 수용되던 기존 동작(2회)은 존댓말 이탈·거짓말류 엉터리 응답이 그대로 저장되는
// 원인이었다. 리다이렉트 기회를 4회까지 늘려 마지막 수용 표본을 줄인다.
const PERSONA_REPLY_ATTEMPT_LIMIT = 4;

// [핵심 아키텍처 · 수정 금지] 응답 생성·검증·재생성 루프. 사용자의 명시 지시 없이 변경하지 않는다. (AI_TRACKING.md 5A L-1)
async function generatePersonaReply(
  input: PersonaReplyGenerationInput,
): Promise<PersonaReplyGeneration> {
  const { persona } = input;
  const structuredReply = buildPersonaReplySpec({
    reasoning: input.reasoning,
    max_messages: resolvePersonaReplyMessageLimit(persona.voice.style),
  });
  const turnHook = buildPersonaTurnHook(
    persona.spirit_name,
    persona.address_term,
    input.reasoning,
    persona.voice,
    input.language,
    input.continuity,
  );
  let content = "";
  let action = "";
  let truncatedMessageCount = 0;
  let previousViolation: PersonaReplyViolation | null = null;
  for (let attempt = 1; attempt <= PERSONA_REPLY_ATTEMPT_LIMIT; attempt += 1) {
    const redirectable = attempt < PERSONA_REPLY_ATTEMPT_LIMIT;
    const attemptController = new AbortController();
    const attemptSignal = AbortSignal.any([
      input.signal,
      attemptController.signal,
    ]);
    let rawReply = "";
    const streamed: { envelope: PersonaReplyEnvelope | null } = {
      envelope: null,
    };
    let breachViolation: PersonaReplyViolation | null = null;
    const result = await chatModelRuntime.generate(
      input.model_id,
      input.language,
      {
        request_id:
          attempt === 1
            ? input.request_id
            : `${input.request_id}:redirect-${attempt}`,
        language: input.language,
        persona_id: input.persona_id,
        persona_name: persona.spirit_name,
        session_prompt: persona.session_prompt,
        prefix_messages: input.prefix_messages,
        history_messages: input.history_messages,
        turn: input.turn,
        behavior_instruction:
          previousViolation === null
            ? turnHook
            : `${turnHook}${buildPersonaRedirectHook(persona.spirit_name, persona.address_term, previousViolation, persona.voice, input.language)}`,
        structured_reply: structuredReply,
        signal: attemptSignal,
        handlers: {
          onChunk: (chunk) => {
            if (breachViolation !== null) {
              return;
            }
            rawReply += chunk;
            const rawEnvelope = parsePersonaReplyEnvelope(rawReply);
            const streamingViolation = detectPersonaStreamingViolation(
              rawEnvelope,
              input.language,
              persona.spirit_name,
            );
            if (streamingViolation !== null && redirectable) {
              breachViolation = streamingViolation;
              attemptController.abort();
              return;
            }
            const streamedEnvelope = normalizePersonaReplyEnvelope(
              rawEnvelope,
              input.language,
              persona.voice,
              persona.address_term,
            );
            streamed.envelope = streamedEnvelope;
            input.on_text(renderPersonaReplyContent(streamedEnvelope));
          },
        },
      },
    );
    truncatedMessageCount = Math.max(
      truncatedMessageCount,
      result.truncated_message_count,
    );
    if (input.signal.aborted) {
      return {
        content:
          streamed.envelope === null
            ? ""
            : renderPersonaStoredReplyContent(streamed.envelope),
        action: streamed.envelope?.action ?? "",
        cancelled: true,
        redirected: attempt > 1,
        truncated_message_count: truncatedMessageCount,
      };
    }
    const rawFinalEnvelope = parsePersonaReplyEnvelope(
      breachViolation !== null ? rawReply : result.text,
    );
    const finalEnvelope = normalizePersonaReplyEnvelope(
      rawFinalEnvelope,
      input.language,
      persona.voice,
      persona.address_term,
    );
    content = renderPersonaStoredReplyContent(finalEnvelope);
    action = finalEnvelope.action;
    const violation =
      breachViolation ??
      detectPersonaStreamingViolation(
        rawFinalEnvelope,
        input.language,
        persona.spirit_name,
      ) ??
      detectPersonaReplyViolation(
        finalEnvelope,
        persona.voice.register,
        input.language,
        input.continuity.previous_spirit_lines,
        input.continuity.latest_user_text,
        persona.spirit_name,
      );
    if (redirectable && violation !== null) {
      previousViolation = violation;
      continue;
    }
    input.on_text(renderPersonaReplyContent(finalEnvelope));
    return {
      content,
      action,
      cancelled: result.cancelled,
      redirected: attempt > 1,
      truncated_message_count: truncatedMessageCount,
    };
  }
  return {
    content,
    action,
    cancelled: false,
    redirected: true,
    truncated_message_count: truncatedMessageCount,
  };
}

function resolvePersonaEmotionBaseline(
  cheatPreset: PersonaCheatPreset | null,
): PersonaEmotionLevels {
  return (
    (cheatPreset === null
      ? null
      : findEmotionPreset(cheatPreset.emotion_preset).levels) ??
    PERSONA_EMOTION_BASELINE
  );
}

async function resolvePersonaEmotionSeed(
  personaId: string,
  language: AppLanguage,
  occurredAt: string,
  cheatPreset: PersonaCheatPreset | null,
): Promise<PersonaEmotionState> {
  const previous = await chatRepository.getPersonaEmotion(personaId);
  if (previous !== null) return previous;
  const presetLevels =
    cheatPreset === null
      ? null
      : findEmotionPreset(cheatPreset.emotion_preset).levels;
  return presetLevels === null
    ? createPersonaEmotionState(
        occurredAt,
        await personaService.getEmotionSeedText(personaId, language),
      )
    : createPersonaEmotionStateFromLevels(presetLevels, occurredAt);
}

async function readPersonaFamiliaritySource(
  personaId: string,
): Promise<PersonaFamiliaritySource> {
  const [messageCount, memoryCount, affinityLedger] = await Promise.all([
    chatRepository.countMessagesForPersona(personaId),
    chatRepository.countEpisodicMemories(personaId),
    chatRepository.getPersonaAffinityLedger(personaId),
  ]);
  return {
    message_count: messageCount,
    memory_count: memoryCount,
    bonus_exp: affinityLedger.bonus_exp,
  };
}

function resolvePersonaFamiliaritySourceLevel(
  source: PersonaFamiliaritySource,
  gainedExp: number,
  cheatPreset: PersonaCheatPreset | null,
): number {
  return resolvePersonaFamiliarityLevel(
    source.message_count,
    source.memory_count,
    source.bonus_exp + gainedExp,
    cheatPreset?.bond_level ?? null,
  );
}

async function readPersonaFamiliarityLevel(
  personaId: string,
  cheatPreset: PersonaCheatPreset | null,
): Promise<number> {
  return resolvePersonaFamiliaritySourceLevel(
    await readPersonaFamiliaritySource(personaId),
    0,
    cheatPreset,
  );
}

async function applyProfileMentionAffinity(
  personaId: string,
  prepared: PersonaPreparedTurnReferences,
  sourceMessageId: string,
  occurredAt: string,
): Promise<PersonaAffinityGain[]> {
  const mentions = prepared.references.profile_mentions;
  if (mentions.length === 0) {
    return [];
  }
  const [ledger, emotion] = await Promise.all([
    chatRepository.getPersonaAffinityLedger(personaId),
    chatRepository.getPersonaEmotion(personaId),
  ]);
  const update = recordProfileMentionAffinity(
    ledger,
    mentions,
    sourceMessageId,
    occurredAt,
  );
  const delighted = mentions.filter(
    (mention) => mention.kind !== "dislike",
  ).length;
  const disliked = mentions.length - delighted;
  await Promise.all([
    update.gains.length > 0
      ? chatRepository.upsertPersonaAffinityLedger(
          personaId,
          update.ledger,
          occurredAt,
        )
      : Promise.resolve(),
    emotion === null
      ? Promise.resolve()
      : chatRepository.upsertPersonaEmotion(
          personaId,
          applyProfileMentionEmotion(emotion, delighted, disliked, occurredAt),
        ),
  ]);
  return update.gains;
}

interface PersonaHeartParticipant {
  persona_id: string;
  familiarity_level: number;
  temperament: PersonaTemperament;
  cheat_preset: PersonaCheatPreset | null;
  expression: PersonaHeartExpression;
}

async function readPersonaHeartParticipants(
  settings: AppSettings,
  timeline: readonly PersonaTimelineEntry[],
  personaIds: readonly string[],
  now: string,
): Promise<PersonaHeartParticipant[]> {
  const [messageCounts, memoryCounts, affinityExps, emotions] =
    await Promise.all([
      chatRepository.countMessagesByPersona(),
      chatRepository.countEpisodicMemoriesByPersona(),
      chatRepository.listAffinityExpByPersona(),
      chatRepository.listPersonaEmotionsByPersona(),
    ]);
  return Promise.all(
    personaIds.map(async (personaId): Promise<PersonaHeartParticipant> => {
      const cheatPreset = resolveActivePersonaCheatPreset(settings, personaId);
      const familiarityLevel = resolvePersonaFamiliarityLevel(
        messageCounts.get(personaId) ?? 0,
        memoryCounts.get(personaId) ?? 0,
        affinityExps.get(personaId) ?? 0,
        cheatPreset?.bond_level ?? null,
      );
      const temperament = await personaService.getPersonaTemperament(
        personaId,
        settings.language,
        cheatPreset,
      );
      return {
        persona_id: personaId,
        familiarity_level: familiarityLevel,
        temperament,
        cheat_preset: cheatPreset,
        expression: resolvePersonaHeartExpression({
          persona_id: personaId,
          timeline,
          now,
          temperament,
          familiarity_level: familiarityLevel,
          jealousy: emotions.get(personaId)?.levels.jealous ?? null,
        }),
      };
    }),
  );
}

function listTimelinePersonaIds(
  timeline: readonly PersonaTimelineEntry[],
): string[] {
  return [
    ...new Set(
      timeline
        .filter((entry) => entry.message.role === "user")
        .map((entry) => entry.persona_id),
    ),
  ];
}

async function preparePersonaTurnReferences(
  personaId: string,
  language: AppLanguage,
  query: string,
  excludedTerms: readonly string[],
  familiarityLevel: number,
  contact: PersonaContactSnapshot,
  occurredAt: string,
): Promise<PersonaPreparedTurnReferences> {
  const [references, personaNames] = await Promise.all([
    personaService.getTurnPersonaReferences({
      occurred_at: occurredAt,
      persona_id: personaId,
      language,
      query,
      excluded_terms: excludedTerms,
      familiarity_level: familiarityLevel,
      rival_persona_ids: [
        ...new Set([
          ...contact.rival_attention.map((attention) => attention.persona_id),
          ...contact.rival_history.map((history) => history.persona_id),
        ]),
      ],
      rival_exchanges: contact.rival_attention.map((attention) => ({
        persona_id: attention.persona_id,
        texts: attention.exchange_texts,
      })),
      mention_candidate_ids: contact.mention_candidate_ids,
    }),
    personaService.getPersonaDisplayNames(language),
  ]);
  return {
    references,
    rivals: buildPersonaRivalContexts(contact, references, personaNames),
  };
}

async function applyPersonaRivalEmotion(
  personaId: string,
  prepared: PersonaPreparedTurnReferences,
  familiarityLevel: number,
  occurredAt: string,
): Promise<void> {
  const rivalAttention = countPersonaRivalAttention(prepared.rivals);
  const current = await chatRepository.getPersonaEmotion(personaId);
  if (rivalAttention === 0 || current === null) {
    return;
  }
  await chatRepository.upsertPersonaEmotion(
    personaId,
    applyRivalAttention(
      current,
      rivalAttention,
      resolveBondProgress(familiarityLevel, FAMILIARITY_MAX_LEVEL),
      occurredAt,
    ),
  );
}

async function resolveKeywordThreads(
  nodes: readonly PersonaKeywordNode[],
  episodeLimit: number,
  liveHistorySince: string,
): Promise<PersonaKeywordThread[]> {
  const episodeIds = [
    ...new Set(
      nodes.flatMap((node) => selectKeywordEpisodeIds(node, episodeLimit)),
    ),
  ];
  const memories = await chatRepository.getEpisodicMemoriesByIds(episodeIds);
  const memoryById = new Map(
    memories
      .filter(
        (memory) =>
          liveHistorySince.length === 0 || memory.created_at < liveHistorySince,
      )
      .map((memory) => [memory.id, memory]),
  );
  const messages = await chatRepository.getMessagesByIds([
    ...new Set(memories.flatMap((memory) => memory.source_message_ids ?? [])),
  ]);
  const messageById = new Map(messages.map((message) => [message.id, message]));
  return nodes.map((node) => ({
    keyword: node,
    episodes: selectKeywordEpisodeIds(node, episodeLimit)
      .flatMap((memoryId) => memoryById.get(memoryId) ?? [])
      .map((memory) => buildPersonaKeywordEpisode(memory, messageById)),
  }));
}

// [핵심 아키텍처 · 수정 금지] DB 기반 턴 맥락 수집. 사용자의 명시 지시 없이 변경하지 않는다. (AI_TRACKING.md 5A L-1)
async function collectPersonaTurnContext(
  request: PersonaTurnContextRequest,
  prepared: PersonaPreparedTurnReferences,
): Promise<PersonaTurnContext> {
  const { persona_id: personaId, filter } = request;
  const queryVector = createLexicalMemoryVector(request.query);
  const { references: personaReferences, rivals } = prepared;
  const [
    recentDirectives,
    relevantDirectives,
    episodic,
    keywordRecords,
    emotion,
    personaNames,
    [knowledge, storyMoments],
  ] = await Promise.all([
    filter.directive
      ? chatRepository.listDirectiveMemories(personaId, MEMORY_DIRECTIVE_LIMIT)
      : Promise.resolve([]),
    filter.directive
      ? chatRepository.searchDirectiveMemories(
          personaId,
          queryVector,
          RELEVANT_DIRECTIVE_LIMIT,
        )
      : Promise.resolve([]),
    filter.episodic
      ? chatRepository.searchEpisodicMemories(
          personaId,
          queryVector,
          EPISODIC_INJECT_LIMIT,
          request.live_history_since,
        )
      : Promise.resolve([]),
    filter.habit
      ? chatRepository.listKeywordRecords(personaId)
      : Promise.resolve([]),
    filter.affect
      ? chatRepository.getPersonaEmotion(personaId)
      : Promise.resolve(null),
    personaService.getPersonaDisplayNames(request.language),
    knowledgeClient.searchGroups(request.query, [
      {
        limit:
          request.include_knowledge && filter.knowledge
            ? KNOWLEDGE_INJECT_LIMIT
            : 0,
        document_names: personaService.worldKnowledgeDocuments(
          request.language,
        ),
      },
      {
        limit: filter.knowledge ? STORY_INJECT_LIMIT : 0,
        document_names: personaService.storyKnowledgeDocuments(
          request.language,
          personaId,
        ),
      },
    ]),
  ]);
  const keywordNodes = selectContextKeywordNodes(
    buildPersonaKeywordNodes(
      keywordRecords,
      request.recent_texts,
      request.query,
      request.language,
    ),
    KEYWORD_THREAD_PROMPT_LIMIT,
  );
  const keywordThreads = await resolveKeywordThreads(
    keywordNodes,
    KEYWORD_THREAD_EPISODE_LIMIT,
    request.live_history_since,
  );
  const userTurnPattern = detectPersonaUserTurnPattern(request.query);
  const teachingGuidance = buildPersonaTeachingGuidance(
    request.query,
    userTurnPattern,
    request.teaching_questions,
    request.spirit_name,
    request.address_term,
  );
  const intimacyDialogue =
    userTurnPattern.intimacy_level === null || !userTurnPattern.is_adult_intent
      ? null
      : await selectPersonaIntimacyDialogue({
          level: userTurnPattern.intimacy_level,
          topic: null,
          situation: null,
          limit: 1,
          rotationSeed: `${request.archive_key}\u0000${request.query}`,
          query: request.query,
          language: request.language,
          spirit_id: request.spirit_sno,
        });
  const [storyMemory, judgmentLines] = await Promise.all([
    personaDatasetService.getStoryMemoryLines(
      request.archive_key,
      request.familiarity_level,
    ),
    personaDatasetService.getInterpretationLines(request.archive_key),
  ]);
  const otherConversations = selectCrossPersonaConversationExcerpts(
    request.timeline,
    personaId,
    personaNames,
    request.query,
    request.language,
  );
  return {
    context_sections: buildPersonaTurnContext(
      {
        conversation: analyzeConversationState(request.conversation),
        continuation: request.continuation,
        directives: mergeDirectiveMemories(
          relevantDirectives,
          recentDirectives.map((directive) => directive.memory_text),
          MEMORY_DIRECTIVE_LIMIT,
        ),
        episodic,
        keyword_threads: keywordThreads,
        knowledge: knowledge.map((chunk) => chunk.chunk_text),
        story_moments: storyMoments.map((chunk) => chunk.chunk_text),
        emotion,
        heart: filter.affect
          ? resolvePersonaHeartExpression({
              persona_id: personaId,
              timeline: request.timeline,
              now: request.conversation.latest_at,
              temperament: request.temperament,
              familiarity_level: request.familiarity_level,
              jealousy: emotion?.levels.jealous ?? null,
            })
          : null,
        familiarity_level: request.familiarity_level,
        profile_mentions: personaReferences.profile_mentions,
        affinity_gained: request.affinity_gained,
        last_contact_at: request.contact.last_contact_at,
        own_user_message_count: request.contact.own_user_message_count,
        rivals,
        other_conversations: otherConversations,
        mentioned_relations: personaReferences.mentioned_relations,
        today_holidays: personaReferences.today_holidays,
        mentioned_holidays: personaReferences.mentioned_holidays,
        teaching_guidance: teachingGuidance,
        intimacy_dialogue: intimacyDialogue,
        user_turn_pattern: userTurnPattern,
        story_memory: storyMemory,
        judgment_lines: judgmentLines,
      },
      request.spirit_name,
      request.address_term,
      filter,
      request.language,
    ),
    rehearsal_messages: buildPersonaPrimingMessages(
      personaReferences.rehearsal_exchanges,
    ),
  };
}

function latestSpiritReplyLines(history: readonly ChatMessage[]): string[] {
  const latest = history.findLast(
    (message) =>
      message.role === "assistant" &&
      envelopeFromStoredReply(message.content).messages.length > 0,
  );
  return latest === undefined
    ? []
    : envelopeFromStoredReply(latest.content).messages;
}

// 버그 수정 (C-025): 키워드 최근성 점수는 spoken 대사만 본다. 원본 content에는
// <think> 내레이션이 포함되어 <think> 어휘가 키워드 노드 우선순위를 왜곡했다.
function keywordScanText(message: ChatMessage): string {
  return message.role === "assistant"
    ? envelopeFromStoredReply(message.content).messages.join("\n")
    : message.content;
}

function latestSpiritReplyAction(history: readonly ChatMessage[]): string {
  const latest = history.findLast(
    (message) =>
      message.role === "assistant" &&
      envelopeFromStoredReply(message.content).messages.length > 0,
  );
  if (latest === undefined) {
    return "";
  }
  return latest.spirit_action ?? envelopeFromStoredReply(latest.content).action;
}

async function persistPersonaInnerState(
  personaId: string,
  roomId: string,
  sourceMessageIds: readonly string[],
  innerThought: string,
  coveredThrough: string,
): Promise<void> {
  const text = innerThought.trim();
  if (text.length === 0) {
    return;
  }
  await chatRepository.upsertPersonaReflection({
    id: "",
    persona_id: personaId,
    memory_type: "reflection",
    memory_text: text,
    created_at: coveredThrough,
    covered_through: coveredThrough,
    source_room_id: roomId,
    source_message_ids: [...sourceMessageIds],
  });
}

const RECORDED_LINE_BREAK_PATTERN = /\s*\n+\s*/gu;
const RECORDED_LINE_JOINER = " / ";
const RECORDED_THOUGHT_SEPARATOR = "\n(속마음: ";

function describeRecordedTurnContent(
  message: Pick<ChatMessage, "role" | "content">,
): string {
  const spoken = stripReasoning(message.content).replace(
    RECORDED_LINE_BREAK_PATTERN,
    RECORDED_LINE_JOINER,
  );
  if (message.role !== "assistant") {
    return spoken;
  }
  const thought = extractReasoning(message.content).replace(
    RECORDED_LINE_BREAK_PATTERN,
    RECORDED_LINE_JOINER,
  );
  return thought.length === 0
    ? spoken
    : `${spoken}${RECORDED_THOUGHT_SEPARATOR}${thought})`;
}

function describeBehaviorStages(
  latestUserText: string,
  threads: readonly PersonaKeywordThread[],
  episodic: readonly string[],
  semanticSummary: string | null,
  rivals: readonly PersonaRivalContext[],
  reflection: string | null,
  emotion: PersonaEmotionState | null,
  familiarityLevel: number,
  lastSpiritReply: string,
): PersonaBehaviorStage[] {
  return [
    {
      kind: "input",
      items: latestUserText.length === 0 ? [] : [latestUserText],
    },
    { kind: "keywords", items: threads.map((thread) => thread.keyword.token) },
    {
      kind: "recall",
      items: [
        ...(semanticSummary === null ? [] : [semanticSummary]),
        ...episodic,
      ],
    },
    {
      kind: "social",
      items: rivals.map(
        (rival) =>
          `${rival.relation.name} · ${rival.user_message_count}${rival.topics.length === 0 ? "" : ` · ${rival.topics.join(", ")}`}`,
      ),
    },
    {
      kind: "inner_state",
      items: reflection === null ? [] : reflection.split("\n"),
    },
    {
      kind: "emotion",
      items:
        emotion === null
          ? []
          : [describePersonaMood(emotion) ?? emotion.dominant],
    },
    { kind: "bond", items: [String(familiarityLevel)] },
    {
      kind: "reply",
      items: lastSpiritReply.length === 0 ? [] : [lastSpiritReply],
    },
  ];
}

export const chatService = {
  async createSessionRoom(
    title: string,
    personaId: string | null,
  ): Promise<ChatRoom> {
    const now = createMonotonicTimestamp();
    const room: ChatRoom = {
      id: crypto.randomUUID(),
      title,
      persona_id: personaId,
      session_started_at: now,
      created_at: now,
      updated_at: now,
    };
    await chatRepository.createRoom(room);
    return room;
  },
  async getOrCreateEverTalkSessionRoom(): Promise<ChatRoom> {
    const existing = await chatRepository.findLatestGlobalSessionRoom(
      EVERTALK_SESSION_TITLE,
    );
    return (
      existing ?? chatService.createSessionRoom(EVERTALK_SESSION_TITLE, null)
    );
  },
  async buildPersonaBaseSystemPrompt(
    personaId: string,
    language: AppLanguage,
    saviorName: string,
    cheatPreset: PersonaCheatPreset | null,
    familiarityLevel: number,
  ): Promise<PersonaSystemPrompt> {
    const [persona, primingExchanges, datasetIdentity] = await Promise.all([
      personaService.getAssembledPersonaPrompt(
        personaId,
        language,
        saviorName,
        cheatPreset,
      ),
      personaService.getPrimingDialogueExchanges(
        personaId,
        language,
        familiarityLevel,
      ),
      personaService.getPersonaDatasetIdentity(personaId),
    ]);
    const teachingQuestions = await personaDatasetService.getTeachingQuestions(
      datasetIdentity.archive_key,
      language,
      persona.localized_name,
      persona.address_term,
    );
    return {
      spirit_name: persona.localized_name,
      spirit_sno: datasetIdentity.snos[0] ?? datasetIdentity.archive_key,
      session_prompt: {
        system_prompt: persona.assembled_prompt,
        priming_messages: buildPersonaPrimingMessages(primingExchanges),
      },
      address_term: persona.address_term,
      greeting: persona.greeting,
      dialogue_excluded_terms: persona.dialogue_excluded_terms,
      voice: persona.voice,
      teaching_questions: teachingQuestions,
      archive_key: datasetIdentity.archive_key,
    };
  },
  async getPersonaMemoryInsight(
    personaId: string,
  ): Promise<PersonaMemoryInsight> {
    const [
      semanticSummary,
      reflection,
      emotion,
      directives,
      episodic,
      episodicTotal,
    ] = await Promise.all([
      chatRepository.getSemanticMemory(personaId),
      chatRepository.getPersonaReflection(personaId),
      chatRepository.getPersonaEmotion(personaId),
      chatRepository.listDirectiveMemories(personaId, MEMORY_DIRECTIVE_LIMIT),
      chatRepository.listEpisodicMemories(personaId, MEMORY_INSIGHT_LIMIT),
      chatRepository.countEpisodicMemories(personaId),
    ]);
    return {
      semantic_summary: semanticSummary,
      reflection:
        reflection === null
          ? null
          : {
              id: reflection.id,
              memory_text: reflection.memory_text,
              created_at: reflection.created_at,
            },
      emotion,
      directives: directives.map((record) => ({
        id: record.id,
        memory_text: record.memory_text,
        created_at: record.created_at,
      })),
      episodic: episodic.map((record) => ({
        id: record.id,
        memory_text: record.memory_text,
        created_at: record.created_at,
      })),
      episodic_total: episodicTotal,
    };
  },
  async getPersonaMemoryOverview(): Promise<PersonaMemoryOverview> {
    const [
      messageCounts,
      episodicCounts,
      emotions,
      reflections,
      latestDirectives,
    ] = await Promise.all([
      chatRepository.countMessagesByPersona(),
      chatRepository.countEpisodicMemoriesByPersona(),
      chatRepository.listPersonaEmotionsByPersona(),
      chatRepository.listPersonaReflectionsByPersona(),
      chatRepository.listLatestDirectiveMemoryByPersona(),
    ]);
    return buildPersonaMemoryOverview({
      generated_at: createMonotonicTimestamp(),
      message_counts: messageCounts,
      episodic_counts: episodicCounts,
      emotions,
      reflections,
      latest_directives: latestDirectives,
    });
  },
  async rebuildPersonaEmotion(personaId: string): Promise<void> {
    const settings = await settingsRepository.readAppSettings();
    const language = settings.language;
    const cheatPreset = resolveActivePersonaCheatPreset(settings, personaId);
    const presetLevels =
      cheatPreset === null
        ? null
        : findEmotionPreset(cheatPreset.emotion_preset).levels;
    if (
      presetLevels !== null &&
      cheatPreset?.emotion_applied_at === undefined
    ) {
      return;
    }
    const [timeline, episodicCreatedAt, affinityLedger, detectors, seedText] =
      await Promise.all([
        chatRepository.listPersonaTimeline(),
        chatRepository.listEpisodicMemoryTimestamps(personaId),
        chatRepository.getPersonaAffinityLedger(personaId),
        personaService.getEmotionReplayDetectors(personaId, language),
        personaService.getEmotionSeedText(personaId, language),
      ]);
    const rebuilt = replayPersonaEmotion({
      persona_id: personaId,
      timeline,
      episodic_created_at: episodicCreatedAt,
      affinity_events: affinityLedger.events,
      bond_level_override: cheatPreset?.bond_level ?? null,
      baseline: resolvePersonaEmotionBaseline(cheatPreset),
      preset:
        presetLevels === null || cheatPreset?.emotion_applied_at === undefined
          ? null
          : {
              levels: presetLevels,
              applied_at: cheatPreset.emotion_applied_at,
            },
      seed_text: seedText,
      detectors,
    });
    if (rebuilt === null) {
      await chatRepository.deletePersonaEmotion(personaId);
      return;
    }
    await chatRepository.upsertPersonaEmotion(personaId, rebuilt);
  },
  async focusPersonaSession(personaId: string): Promise<void> {
    const settings = await settingsRepository.readAppSettings();
    const cheatPreset = resolveActivePersonaCheatPreset(settings, personaId);
    const persona = await chatService.buildPersonaBaseSystemPrompt(
      personaId,
      settings.language,
      settings.savior_name,
      cheatPreset,
      await readPersonaFamiliarityLevel(personaId, cheatPreset),
    );
    await chatModelRuntime.focusPersonaSession(
      settings.active_model,
      settings.language,
      personaId,
      persona.session_prompt,
    );
  },
  async getPersonaContextGraph(
    personaId: string,
    roomId: string,
  ): Promise<PersonaContextGraph> {
    const settings = await settingsRepository.readAppSettings();
    const language = settings.language;
    const cheatPreset = resolveActivePersonaCheatPreset(settings, personaId);
    const [contact, familiarityLevel, keywordRecords, emotion, timeline] =
      await Promise.all([
        chatRepository.readPersonaContactSnapshot(personaId, language),
        readPersonaFamiliarityLevel(personaId, cheatPreset),
        chatRepository.listKeywordRecords(personaId),
        chatRepository.getPersonaEmotion(personaId),
        chatRepository.listPersonaTimeline(),
      ]);
    const flow = buildPersonaConversationFlow({
      persona_id: personaId,
      room_id: roomId,
      language,
      query: "",
      timeline,
    });
    const history = flow.recent_messages;
    const latestUserText =
      [...history].reverse().find((message) => message.role === "user")
        ?.content ?? "";
    const lastSpiritReply =
      [...history].reverse().find((message) => message.role === "assistant")
        ?.content ?? "";
    const nodes = buildPersonaKeywordNodes(
      keywordRecords,
      history.map((message) => message.content),
      latestUserText,
      language,
    );
    const [
      threads,
      prepared,
      episodic,
      canonRelations,
      familiarityList,
      saviorMessageCount,
    ] = await Promise.all([
      resolveKeywordThreads(
        nodes.slice(0, KEYWORD_GRAPH_VIEW_THREAD_LIMIT),
        KEYWORD_GRAPH_VIEW_EPISODE_LIMIT,
        "",
      ),
      preparePersonaTurnReferences(
        personaId,
        language,
        latestUserText,
        [],
        familiarityLevel,
        contact,
        createMonotonicTimestamp(),
      ),
      chatRepository.searchEpisodicMemories(
        personaId,
        createLexicalMemoryVector(latestUserText),
        EPISODIC_INJECT_LIMIT,
        history[0]?.created_at ?? "",
      ),
      personaService.getPersonaRelations(
        personaId,
        language,
        CONTEXT_GRAPH_RELATION_LIMIT,
      ),
      personaService.getFamiliarityList(settings),
      chatRepository.countMessagesForPersona(personaId),
    ]);
    const generatedAt = createMonotonicTimestamp();
    const networkIds = [
      personaId,
      ...listTimelinePersonaIds(timeline).filter((id) => id !== personaId),
    ];
    const participants = await readPersonaHeartParticipants(
      settings,
      timeline,
      networkIds,
      generatedAt,
    );
    const focused = participants[0];
    return {
      heart: focused.expression,
      heart_timeline: derivePersonaHeartTimeline({
        persona_id: personaId,
        timeline,
        now: generatedAt,
        temperament: focused.temperament,
        familiarity_level: focused.familiarity_level,
        jealousy: emotion?.levels.jealous ?? null,
      }),
      jealousy_links: resolvePersonaJealousyNetwork(
        timeline,
        participants.map((participant) => ({
          persona_id: participant.persona_id,
          heart: participant.expression.heart,
        })),
      ),
      persona_id: personaId,
      generated_at: createMonotonicTimestamp(),
      familiarity_level: familiarityLevel,
      savior_message_count: saviorMessageCount,
      latest_user_text: latestUserText,
      keyword_threads: threads,
      relations: buildPersonaContextRelations(
        canonRelations,
        prepared.rivals,
        new Map(familiarityList.map((entry) => [entry.persona_id, entry])),
        (score) => computeFamiliarityLevel(score).level,
      ),
      sessions: flow.continuation.previous_sessions,
      behavior_stages: describeBehaviorStages(
        latestUserText,
        selectContextKeywordNodes(nodes, KEYWORD_THREAD_PROMPT_LIMIT).map(
          (node) => ({ keyword: node, episodes: [] }),
        ),
        episodic,
        null,
        prepared.rivals,
        extractReasoning(lastSpiritReply) || null,
        emotion,
        familiarityLevel,
        stripReasoning(lastSpiritReply),
      ),
    };
  },
  async getPersonaRelationshipNetwork(): Promise<PersonaRelationshipNetwork> {
    const settings = await settingsRepository.readAppSettings();
    const generatedAt = createMonotonicTimestamp();
    const timeline = await chatRepository.listPersonaTimeline();
    const personaIds = listTimelinePersonaIds(timeline);
    const participants = await readPersonaHeartParticipants(
      settings,
      timeline,
      personaIds,
      generatedAt,
    );
    return {
      generated_at: generatedAt,
      nodes: participants.map((participant) => ({
        persona_id: participant.persona_id,
        familiarity_level: participant.familiarity_level,
        savior_message_count: participant.expression.heart.savior_message_count,
        last_contact_at: participant.expression.heart.last_contact_at,
        heart: participant.expression,
      })),
      jealousy_links: resolvePersonaJealousyNetwork(
        timeline,
        participants.map((participant) => ({
          persona_id: participant.persona_id,
          heart: participant.expression.heart,
        })),
      ),
    };
  },
  // [핵심 아키텍처 · 수정 금지] 먼저 말 걸기 턴 조립. 사용자의 명시 지시 없이 변경하지 않는다. (AI_TRACKING.md 5A L-1)
  async tryGenerateProactiveMessage(
    options: ProactiveGenerationOptions = {},
  ): Promise<ChatMessage | null> {
    const now = options.now ?? new Date();
    const nowTime = now.getTime();
    const nowIso = now.toISOString();
    const random = options.random ?? Math.random;
    const settings = await settingsRepository.readAppSettings();
    if (!settings.proactive_messages_enabled) return null;
    const [conversationCandidates, timeline] = await Promise.all([
      chatRepository.listProactiveConversationCandidates(),
      chatRepository.listPersonaTimeline(),
    ]);
    const participants = await readPersonaHeartParticipants(
      settings,
      timeline,
      conversationCandidates.map((entry) => entry.persona_id),
      nowIso,
    );
    const scoredCandidates = conversationCandidates.map(
      (conversationCandidate, order) => {
        const participant = participants[order];
        return {
          candidate: conversationCandidate,
          schedule: resolveProactiveSchedule(
            participant.expression,
            participant.temperament,
            countUnansweredProactiveMessages(timeline, participant.persona_id),
          ),
          familiarity_level: participant.familiarity_level,
          temperament: participant.temperament,
          cheat_preset: participant.cheat_preset,
        };
      },
    );
    const eligible = scoredCandidates.filter(
      ({ candidate: conversationCandidate, schedule }) => {
        const lastActivity = Date.parse(
          conversationCandidate.latest_activity_at,
        );
        const lastAttempt =
          conversationCandidate.last_attempt_at === null
            ? Number.NEGATIVE_INFINITY
            : Date.parse(conversationCandidate.last_attempt_at);
        return (
          Number.isFinite(lastActivity) &&
          nowTime - lastActivity >= schedule.min_idle_ms &&
          nowTime - lastAttempt >= schedule.cooldown_ms &&
          schedule.unanswered_count < schedule.max_unanswered
        );
      },
    );
    const selected = pickProactiveCandidateByUrge(eligible, random());
    if (selected === null) return null;
    const {
      candidate,
      familiarity_level: familiarityLevel,
      temperament,
      cheat_preset: cheatPreset,
    } = selected;
    const chance = Math.min(
      1,
      Math.max(0, options.chance ?? selected.schedule.chance),
    );
    const attemptedAt = nowIso;
    await chatRepository.markProactiveAttempt(
      candidate.room_id,
      candidate.persona_id,
      attemptedAt,
    );
    if (random() >= chance) return null;

    const contact = await chatRepository.readPersonaContactSnapshot(
      candidate.persona_id,
      settings.language,
    );
    const emotionBaseline = resolvePersonaEmotionBaseline(cheatPreset);
    const emotionSeed = await resolvePersonaEmotionSeed(
      candidate.persona_id,
      settings.language,
      candidate.latest_activity_at,
      cheatPreset,
    );
    await chatRepository.upsertPersonaEmotion(
      candidate.persona_id,
      advancePersonaEmotion(
        emotionSeed,
        "",
        attemptedAt,
        IDLE_EMOTION_INFLUENCE,
        emotionBaseline,
      ),
    );
    await chatRepository.recordPersonaSessionDigest(
      candidate.persona_id,
      candidate.room_id,
      attemptedAt,
      settings.language,
    );
    const storedDigests = await chatRepository.listPersonaSessionDigests(
      candidate.persona_id,
      candidate.room_id,
    );

    const language = settings.language;
    const persona = await chatService.buildPersonaBaseSystemPrompt(
      candidate.persona_id,
      language,
      settings.savior_name,
      cheatPreset,
      familiarityLevel,
    );
    const flow = buildPersonaConversationFlow({
      persona_id: candidate.persona_id,
      room_id: candidate.room_id,
      language,
      query: candidate.latest_user_content,
      timeline,
      context_window_tokens: settings.context_window_tokens,
      stored_digests: storedDigests,
    });
    const history = flow.recent_messages;
    const turnRequest: PersonaTurnContextRequest = {
      persona_id: candidate.persona_id,
      room_id: candidate.room_id,
      language,
      spirit_name: persona.spirit_name,
      address_term: persona.address_term,
      query: candidate.latest_user_content,
      conversation: { history, latest_user_text: null, latest_at: attemptedAt },
      continuation: flow.continuation,
      timeline,
      live_history_since: flow.live_history_since,
      recent_texts: history.map(keywordScanText),
      filter: settings.memory_context_filter,
      excluded_terms: persona.dialogue_excluded_terms,
      include_knowledge: false,
      affinity_gained: [],
      familiarity_level: familiarityLevel,
      contact: { ...contact, mention_candidate_ids: [] },
      temperament,
      archive_key: persona.archive_key,
      spirit_sno: persona.spirit_sno,
      teaching_questions: persona.teaching_questions,
    };
    const preparedReferences = await preparePersonaTurnReferences(
      turnRequest.persona_id,
      language,
      turnRequest.query,
      turnRequest.excluded_terms,
      familiarityLevel,
      turnRequest.contact,
      attemptedAt,
    );
    await applyPersonaRivalEmotion(
      candidate.persona_id,
      preparedReferences,
      familiarityLevel,
      attemptedAt,
    );
    const turnContext = await collectPersonaTurnContext(
      turnRequest,
      preparedReferences,
    );
    const prefixMessages = [
      ...turnContext.rehearsal_messages,
      ...(shouldOpenWithGreeting(persona.greeting, flow.has_prior_context)
        ? buildGreetingOpeningMessage(persona.greeting)
        : []),
    ];
    const historyMessages = toPersonaHistoryMessages(history);
    const result = await generatePersonaReply({
      continuity: {
        latest_user_text: null,
        previous_spirit_lines: latestSpiritReplyLines(history),
        previous_spirit_action: latestSpiritReplyAction(history),
      },
      model_id: settings.active_model,
      language,
      request_id: crypto.randomUUID(),
      persona_id: candidate.persona_id,
      persona,
      prefix_messages: prefixMessages,
      history_messages: historyMessages,
      turn: {
        heading: buildProactiveTurnHeading(
          persona.address_term,
          candidate.latest_activity_at,
          attemptedAt,
        ),
        body: buildProactiveTurnBody(
          persona.spirit_name,
          persona.address_term,
          preparedReferences.rivals,
          participants.find(
            (participant) => participant.persona_id === candidate.persona_id,
          )?.expression ?? null,
        ),
        context_sections: turnContext.context_sections,
      },
      reasoning: settings.show_reasoning,
      signal: options.signal ?? new AbortController().signal,
      on_text: () => undefined,
    });
    const replyText = result.content.trim();
    if (result.cancelled || stripReasoning(replyText).length === 0) return null;
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      room_id: candidate.room_id,
      persona_id: candidate.persona_id,
      role: "assistant",
      content: replyText,
      created_at: attemptedAt,
      ...(result.action.length > 0 ? { spirit_action: result.action } : {}),
      delivery: "proactive",
      read_at: null,
    };
    await chatRepository.insertProactiveAssistantTurn(message);
    await chatRepository.upsertPersonaEmotion(
      candidate.persona_id,
      advancePersonaEmotion(
        await chatRepository.getPersonaEmotion(candidate.persona_id),
        stripReasoning(replyText),
        attemptedAt,
        SPIRIT_MESSAGE_EMOTION_INFLUENCE,
        emotionBaseline,
      ),
    );
    await persistPersonaInnerState(
      candidate.persona_id,
      candidate.room_id,
      [message.id],
      extractReasoning(replyText),
      attemptedAt,
    );
    return message;
  },
  // [핵심 아키텍처 · 수정 금지] 사용자 메시지 턴 조립. 사용자의 명시 지시 없이 변경하지 않는다. (AI_TRACKING.md 5A L-1)
  async sendMessage(request: ChatSendRequest): Promise<ChatMessage> {
    const {
      room_id: roomId,
      persona_id: personaId,
      content,
      request_id: requestId,
      signal,
      handlers,
    } = request;
    const userOccurredAt = createMonotonicTimestamp();
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      room_id: roomId,
      persona_id: personaId,
      role: "user",
      content,
      created_at: userOccurredAt,
    };
    const settings = await settingsRepository.readAppSettings();
    const language = settings.language;
    const modelId = settings.active_model;
    const contact = await chatRepository.readPersonaContactSnapshot(
      personaId,
      language,
    );
    await chatRepository.insertMessage(userMessage);
    const cheatPreset = resolveActivePersonaCheatPreset(settings, personaId);
    const emotionBaseline = resolvePersonaEmotionBaseline(cheatPreset);
    const declaredName = detectSaviorName(content);
    const saviorName = declaredName ?? settings.savior_name;
    const [familiaritySource] = await Promise.all([
      readPersonaFamiliaritySource(personaId),
      resolvePersonaEmotionSeed(
        personaId,
        language,
        userOccurredAt,
        cheatPreset,
      ).then((emotionSeed) =>
        chatRepository.upsertPersonaEmotion(
          personaId,
          advancePersonaEmotion(
            emotionSeed,
            content,
            userOccurredAt,
            USER_MESSAGE_EMOTION_INFLUENCE,
            emotionBaseline,
          ),
        ),
      ),
      shouldCaptureAsDirective(content)
        ? chatRepository.insertDirectiveMemory({
            id: crypto.randomUUID(),
            persona_id: personaId,
            memory_type: "directive",
            memory_text: content,
            memory_vector: createLexicalMemoryVector(content),
            created_at: createMonotonicTimestamp(),
            source_room_id: roomId,
            source_message_ids: [userMessage.id],
          })
        : Promise.resolve(),
      declaredName !== null && declaredName !== settings.savior_name
        ? settingsRepository.updateGeneral({
            savior_name: declaredName.slice(0, SAVIOR_NAME_MAX_LENGTH),
          })
        : Promise.resolve(),
    ]);
    const familiarityLevel = resolvePersonaFamiliaritySourceLevel(
      familiaritySource,
      0,
      cheatPreset,
    );
    const [persona, temperament] = await Promise.all([
      chatService.buildPersonaBaseSystemPrompt(
        personaId,
        language,
        saviorName,
        cheatPreset,
        familiarityLevel,
      ),
      personaService.getPersonaTemperament(personaId, language, cheatPreset),
    ]);
    const [timeline, preparedReferences] = await Promise.all([
      chatRepository.listPersonaTimeline(),
      preparePersonaTurnReferences(
        personaId,
        language,
        content,
        persona.dialogue_excluded_terms,
        familiarityLevel,
        contact,
        userOccurredAt,
      ),
    ]);
    await chatRepository.recordPersonaSessionDigest(
      personaId,
      roomId,
      userOccurredAt,
      language,
    );
    const storedDigests = await chatRepository.listPersonaSessionDigests(
      personaId,
      roomId,
    );
    const flow = buildPersonaConversationFlow({
      persona_id: personaId,
      room_id: roomId,
      language,
      query: content,
      timeline,
      excluded_message_ids: [userMessage.id],
      context_window_tokens: settings.context_window_tokens,
      stored_digests: storedDigests,
    });
    const history = flow.recent_messages;
    const priorHistory = history.filter(
      (message) => message.id !== userMessage.id,
    );
    const affinityGained = await applyProfileMentionAffinity(
      personaId,
      preparedReferences,
      userMessage.id,
      userOccurredAt,
    );
    const turnFamiliarityLevel =
      affinityGained.length > 0
        ? resolvePersonaFamiliaritySourceLevel(
            familiaritySource,
            affinityGained.reduce((total, gain) => total + gain.exp, 0),
            cheatPreset,
          )
        : familiarityLevel;
    const turnRequest: PersonaTurnContextRequest = {
      persona_id: personaId,
      room_id: roomId,
      language,
      spirit_name: persona.spirit_name,
      address_term: persona.address_term,
      query: content,
      conversation: {
        history: priorHistory,
        latest_user_text: content,
        latest_at: userOccurredAt,
      },
      continuation: flow.continuation,
      timeline,
      live_history_since: flow.live_history_since || userOccurredAt,
      recent_texts: priorHistory.map(keywordScanText),
      filter: settings.memory_context_filter,
      excluded_terms: persona.dialogue_excluded_terms,
      include_knowledge: true,
      affinity_gained: affinityGained,
      familiarity_level: turnFamiliarityLevel,
      contact,
      temperament,
      archive_key: persona.archive_key,
      spirit_sno: persona.spirit_sno,
      teaching_questions: persona.teaching_questions,
    };
    await applyPersonaRivalEmotion(
      personaId,
      preparedReferences,
      turnFamiliarityLevel,
      userOccurredAt,
    );
    const turnContext = await collectPersonaTurnContext(
      turnRequest,
      preparedReferences,
    );
    const prefixMessages = [
      ...turnContext.rehearsal_messages,
      ...(shouldOpenWithGreeting(persona.greeting, flow.has_prior_context)
        ? buildGreetingOpeningMessage(persona.greeting)
        : []),
    ];
    const historyMessages = toPersonaHistoryMessages(priorHistory);
    const result = await generatePersonaReply({
      continuity: {
        latest_user_text: content,
        previous_spirit_lines: latestSpiritReplyLines(priorHistory),
        previous_spirit_action: latestSpiritReplyAction(priorHistory),
      },
      model_id: modelId,
      language,
      request_id: requestId,
      persona_id: personaId,
      persona,
      prefix_messages: prefixMessages,
      history_messages: historyMessages,
      turn: {
        heading: buildNewMessageHeading(persona.address_term, userOccurredAt),
        body: content,
        context_sections: turnContext.context_sections,
      },
      reasoning: settings.show_reasoning,
      signal,
      on_text: handlers.onText,
    });
    const replyText = result.content;
    if (result.cancelled && stripReasoning(replyText).trim().length === 0) {
      throw new DomainError("cancelled", requestId);
    }

    const aiMessage: ChatMessage = {
      id: crypto.randomUUID(),
      room_id: roomId,
      persona_id: personaId,
      role: "assistant",
      content: replyText,
      created_at: createMonotonicTimestamp(),
      ...(result.action.length > 0 ? { spirit_action: result.action } : {}),
    };
    const memoryText = buildTurnMemoryText(
      persona.address_term,
      persona.spirit_name,
      describeRecordedTurnContent(userMessage),
      describeRecordedTurnContent(aiMessage),
      userOccurredAt,
      aiMessage.created_at,
    );
    const episodicMemoryId = crypto.randomUUID();
    await chatRepository.insertAssistantTurn(
      aiMessage,
      memoryText === null
        ? null
        : {
            id: episodicMemoryId,
            persona_id: personaId,
            memory_type: "episodic",
            memory_text: memoryText,
            memory_vector: createLexicalMemoryVector(memoryText),
            created_at: aiMessage.created_at,
            source_room_id: roomId,
            source_message_ids: [userMessage.id, aiMessage.id],
          },
    );
    const spiritEnvelope = envelopeFromStoredReply(replyText);
    await Promise.all([
      chatRepository
        .getPersonaEmotion(personaId)
        .then((currentEmotion) =>
          chatRepository.upsertPersonaEmotion(
            personaId,
            advancePersonaEmotion(
              currentEmotion,
              stripReasoning(replyText),
              aiMessage.created_at,
              SPIRIT_MESSAGE_EMOTION_INFLUENCE,
              emotionBaseline,
            ),
          ),
        ),
      memoryText === null
        ? Promise.resolve()
        : chatRepository.recordKeywordObservations(
            personaId,
            collectKeywordObservations(
              content,
              spiritEnvelope.messages.join("\n"),
              language,
            ),
            episodicMemoryId,
            aiMessage.created_at,
          ),
      persistPersonaInnerState(
        personaId,
        roomId,
        [userMessage.id, aiMessage.id],
        extractReasoning(replyText),
        aiMessage.created_at,
      ),
    ]);
    return aiMessage;
  },
};
