import {NativeModules} from 'react-native';
import type {ChatMessage, ChatMessageRole, ChatRoom, ChatRoomPersonaActivity, MemoryContextFilter} from '../../../../src/domains/chat/types';

export type {ChatMessage, ChatRoom, ChatRoomPersonaActivity};

export type Language = 'ko' | 'en' | 'zh_cn';

export type {ChatMessageRole, MemoryContextFilter};

export interface SpiritSummary {
  id: string;
  name: string;
  name_en: string;
  name_zh_cn: string | null;
  grade: string;
  race: string;
  archive_key: string;
}

export interface LocalizedText {
  ko?: string;
  en?: string;
  zh_cn?: string;
}

export interface SpiritDetail {
  id: string;
  name: string;
  name_en: string;
  grade: string;
  race: string;
  class: string;
  profile: {
    nick_name: string | null;
    like: string[];
    dislike: string[];
    hobby: string[];
  };
  personality: {
    description: string | null;
    greeting: string | null;
  };
  speech_patterns: string[];
  dialogues?: {
    story?: Array<{speaker: string; message: string}>;
    evertalk?: Array<{speaker: string; message: string}>;
  };
  i18n?: {
    name?: LocalizedText;
    speech_patterns?: Array<Partial<Record<Language, {speaker: string; message: string}>>>;
    personality?: {
      description?: LocalizedText;
      greeting?: LocalizedText;
    };
  };
}

export interface NativeSettings {
  language: Language;
  model_name: string | null;
  savior_name: string;
  context_window_tokens: number | null;
  show_reasoning: boolean;
  memory_context_filter: MemoryContextFilter;
}

interface EvaiNativeApi {
  listSpirits(): Promise<SpiritSummary[]>;
  readSpirit(archiveKey: string): Promise<string>;
  readRecord(store: string, key: string): Promise<string | null>;
  listRecords(store: string): Promise<string[]>;
  countRecords(store: string): Promise<number>;
  listRoomsForPersona(personaId: string): Promise<string[]>;
  listMessagesForRoom(roomId: string): Promise<string[]>;
  listMessagesForPersona(personaId: string): Promise<string[]>;
  writeRecord(store: string, key: string, value: string): Promise<void>;
  writeBatch(entries: string): Promise<void>;
  deleteRecord(store: string, key: string): Promise<void>;
  listModels(): Promise<string[]>;
  pickModel(): Promise<string | null>;
  loadModel(fileName: string, contextTokens: number): Promise<string>;
  deleteModel(fileName: string): Promise<void>;
  generate(messagesJson: string, maxTokens: number): Promise<string>;
  cancelGeneration(): void;
  unloadModel(): Promise<void>;
}

export function nativeApi(): EvaiNativeApi {
  const module: unknown = NativeModules.EvaiNative;
  if (typeof module !== 'object' || module === null) {
    throw new Error('Android native module is not registered');
  }
  return module as EvaiNativeApi;
}

export function parseRecord<T>(value: string): T {
  return JSON.parse(value) as T;
}

export function localizedName(spirit: SpiritSummary, detail: SpiritDetail | null, language: Language): string {
  return detail?.i18n?.name?.[language]
    ?? (language === 'en' ? spirit.name_en : language === 'zh_cn' ? spirit.name_zh_cn ?? spirit.name : spirit.name);
}

export function localizedDescription(detail: SpiritDetail, language: Language): string {
  return detail.i18n?.personality?.description?.[language] ?? detail.personality.description ?? '';
}

export function localizedGreeting(detail: SpiritDetail, language: Language): string {
  return detail.i18n?.personality?.greeting?.[language] ?? detail.personality.greeting ?? '';
}
