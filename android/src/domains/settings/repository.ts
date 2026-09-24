import {nativeApi, parseRecord, type Language, type NativeSettings} from '../../shared/native';
import {DEFAULT_MEMORY_CONTEXT_FILTER, normalizeMemoryContextFilter} from '../../../../src/domains/chat/memoryContext';

const defaultSettings: NativeSettings = {
  language: 'ko',
  model_name: null,
  savior_name: '',
  context_window_tokens: null,
  show_reasoning: true,
  memory_context_filter: DEFAULT_MEMORY_CONTEXT_FILTER,
};

export async function readSettings(): Promise<NativeSettings> {
  const saved = await nativeApi().readRecord('general_settings', 'current');
  if (saved === null) return defaultSettings;
  const value = parseRecord<Partial<NativeSettings>>(saved);
  const language: Language = value.language === 'en' || value.language === 'zh_cn' ? value.language : 'ko';
  const contextWindowTokens = typeof value.context_window_tokens === 'number' && Number.isFinite(value.context_window_tokens) && value.context_window_tokens > 0
    ? value.context_window_tokens
    : null;
  return {
    language,
    model_name: typeof value.model_name === 'string' ? value.model_name : null,
    savior_name: typeof value.savior_name === 'string' ? value.savior_name : defaultSettings.savior_name,
    context_window_tokens: contextWindowTokens,
    show_reasoning: typeof value.show_reasoning === 'boolean' ? value.show_reasoning : defaultSettings.show_reasoning,
    memory_context_filter: normalizeMemoryContextFilter(value.memory_context_filter ?? null),
  };
}

export async function saveSettings(settings: NativeSettings): Promise<void> {
  await nativeApi().writeRecord('general_settings', 'current', JSON.stringify(settings));
}
