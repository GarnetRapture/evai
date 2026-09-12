import { authClient } from './domains/auth';
import { chatClient } from './domains/chat';
import { knowledgeClient } from './domains/knowledge';
import { llmClient } from './domains/llm';
import { modulesClient } from './domains/modules';
import { nativeContextClient } from './domains/native';
import { personaClient } from './domains/persona';
import { styleClient } from './domains/style';
import { syncClient } from './domains/sync';
export const api = {
    auth: authClient,
    chat: chatClient,
    knowledge: knowledgeClient,
    llm: llmClient,
    modules: modulesClient,
    nativeContext: nativeContextClient,
    persona: personaClient,
    style: styleClient,
    sync: syncClient,
} as const;
export type AppApi = typeof api;
export type { UserSession } from './domains/auth';
export type { ChatMessage, ChatRoom } from './domains/chat';
export type { KnowledgeChunk } from './domains/knowledge';
export type { ChatModelCatalog, LlmStatus } from './domains/llm';
export type { ImportedModule } from './domains/modules';
export type { ContextStorageMode, NativeContextHealth, NativeContextStatus } from './domains/native';
export type { PersonaConfig } from './domains/persona';
export type { StyleProfile } from './domains/style';
export type { SyncResult } from './domains/sync';
