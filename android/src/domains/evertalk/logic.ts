import { formatMegabytes } from '../../../../src/domains/evertalk/logic';
import type {
    ChatModelModeSelection,
    ChatModelSelection,
    GenerationEngineLimit,
    SelectableChatModelOption,
} from '../../../../src/domains/evertalk/types';
import type {
    ChatModelCatalog,
    ChatModelEntry,
    LlmStatus,
    LocalModelEngineKind,
    LocalModelFileEntry,
    OllamaModelLibrary,
} from '../llm/types';
import type { AndroidLabels } from './labels';

export interface LocalModelEntryGroup {
    engine: LocalModelEngineKind;
    entries: LocalModelFileEntry[];
}

const MEGABYTE = 1048576;

export function formatTransferMegabytes(bytes: number): string {
    return (bytes / MEGABYTE).toFixed(1);
}

export function toWholeMegabytes(bytes: number): number {
    return Math.round(bytes / MEGABYTE);
}

function withContextWindow(detail: string, contextWindow: number | null, labels: AndroidLabels): string {
    return contextWindow === null ? detail : `${detail} · ${labels.modelContextWindow(contextWindow)}`;
}

function onDeviceModelOptions(catalog: ChatModelCatalog, labels: AndroidLabels): SelectableChatModelOption[] {
    const options: SelectableChatModelOption[] = [];
    for (const entry of catalog.entries) {
        if (entry.installed) {
            options.push({
                id: entry.id,
                engine: entry.engine,
                title: entry.display_name,
                detail: withContextWindow(
                    entry.backend === null ? entry.file_name : labels.localModelBackend(entry.backend),
                    entry.context_window,
                    labels,
                ),
                selected: entry.selected,
                running: entry.loaded,
            });
        }
    }
    return options;
}

function describeOnDeviceMode(options: readonly SelectableChatModelOption[], labels: AndroidLabels): ChatModelModeSelection {
    const systemDetail = labels.modelAvailabilityDetail(null);
    const detail = options.length === 0 ? systemDetail : `${systemDetail} · ${labels.chatModelOptionCount(options.length)}`;
    if (options.some((option) => option.running)) {
        return { mode: 'on_device', state: 'running', detail, options: [...options] };
    }
    if (options.length > 0) {
        return { mode: 'on_device', state: 'ready', detail, options: [...options] };
    }
    return { mode: 'on_device', state: 'unavailable', detail, options: [] };
}

function describeOllamaMode(library: OllamaModelLibrary, activeLoaded: boolean, labels: AndroidLabels): ChatModelModeSelection {
    if (!library.server.available) {
        return {
            mode: 'ollama',
            state: 'unavailable',
            detail: `${labels.ollamaServerUnavailable} · ${library.server.detail}`,
            options: [],
        };
    }
    if (library.list_error !== null) {
        return { mode: 'ollama', state: 'unavailable', detail: library.list_error, options: [] };
    }
    const options: SelectableChatModelOption[] = library.entries.map((entry) => ({
        id: entry.id,
        engine: entry.engine,
        title: entry.model_name,
        detail: withContextWindow(
            labels.ollamaModelMeta(entry.family, entry.parameter_size, entry.quantization_level, formatMegabytes(entry.size_bytes)),
            entry.context_window,
            labels,
        ),
        selected: entry.selected,
        running: entry.selected && entry.loaded && activeLoaded,
    }));
    const detail = labels.ollamaConnectionReady(library.server.version ?? '', options.length);
    if (options.length === 0) {
        return { mode: 'ollama', state: 'unavailable', detail, options };
    }
    return {
        mode: 'ollama',
        state: options.some((option) => option.running) ? 'running' : 'ready',
        detail,
        options,
    };
}

export function buildChatModelSelection(catalog: ChatModelCatalog | null, llmStatus: LlmStatus | null, labels: AndroidLabels): ChatModelSelection {
    if (catalog === null) {
        return {
            modes: [{ mode: 'on_device', state: 'checking', detail: labels.checking, options: [] }],
            active_mode: null,
        };
    }
    const modes = [describeOnDeviceMode(onDeviceModelOptions(catalog, labels), labels)];
    if (catalog.ollama !== null) {
        modes.push(describeOllamaMode(catalog.ollama, llmStatus?.is_loaded === true, labels));
    }
    const activeMode = modes.find((selection) => selection.options.some((option) => option.selected))?.mode ?? null;
    return { modes, active_mode: activeMode };
}

export function shouldRecommendOllamaModel(catalog: ChatModelCatalog | null): boolean {
    const library = catalog?.ollama ?? null;
    return library !== null && library.server.available && library.list_error === null && library.entries.length === 0;
}

export function buildGenerationEngineLimits(catalog: ChatModelCatalog | null): GenerationEngineLimit[] {
    if (catalog === null) {
        return [];
    }
    const limits: GenerationEngineLimit[] = [];
    for (const entry of catalog.entries) {
        if (entry.selected) {
            limits.push({
                engine_label: entry.id,
                maximum_context_length: entry.maximum_context_window,
                active_context_length: entry.context_window,
            });
        }
    }
    for (const entry of catalog.ollama?.entries ?? []) {
        if (entry.selected || entry.loaded) {
            limits.push({
                engine_label: entry.model_name,
                maximum_context_length: entry.maximum_context_window,
                active_context_length: entry.context_window,
            });
        }
    }
    return limits;
}

export function groupLocalModelEntries(entries: readonly ChatModelEntry[]): LocalModelEntryGroup[] {
    const groups: LocalModelEntryGroup[] = [];
    for (const entry of entries) {
        const group = groups.find((candidate) => candidate.engine === entry.engine);
        if (group) {
            group.entries.push(entry);
        }
        else {
            groups.push({ engine: entry.engine, entries: [entry] });
        }
    }
    return groups;
}
