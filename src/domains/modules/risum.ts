import { DomainError } from '../../shared/errors';
import type { LocalFileType } from '../../shared/files';
import { createMonotonicTimestamp } from '../../shared/time';
import type { ImportedModule, ModuleControl, ModuleControlKind, ModuleControlOption } from './types';

export const RISU_MODULE_FILE_TYPE: LocalFileType = {
    description: 'Risu Module',
    mime_type: 'application/octet-stream',
    extensions: ['.risum'],
};
export const RISU_MODULE_FILE_PICKER_ID = 'eversoul-risu-module';
const RISUM_MAGIC_BYTE = 111;
const RISUM_SUPPORTED_VERSION = 0;
const RISUM_HEADER_LENGTH = 6;
const RISU_MODULE_TYPE = 'risuModule';
const IMPORTED_MODULE_DEFAULT_NAME = 'Imported Risu Module';
const CONTROL_MARKERS = ['getglobalvar::', 'setglobalvar::'] as const;

const RPACK_DECODE_MAP: readonly number[] = [
    44, 247, 132, 139, 201, 101, 251, 182, 159, 174, 179, 3, 45, 1, 105, 116, 31, 228, 163, 236,
    238, 92, 52, 33, 147, 74, 15, 106, 226, 98, 2, 158, 34, 156, 253, 60, 252, 113, 199, 198, 173,
    89, 103, 5, 112, 109, 138, 68, 18, 250, 36, 134, 95, 175, 209, 122, 71, 206, 254, 80, 99, 221,
    81, 6, 111, 24, 224, 82, 168, 9, 157, 86, 115, 76, 184, 83, 108, 195, 160, 14, 25, 207, 62, 13,
    126, 7, 50, 104, 70, 234, 72, 249, 153, 46, 171, 164, 73, 32, 94, 85, 53, 56, 12, 188, 211,
    177, 88, 22, 121, 40, 10, 26, 225, 242, 205, 196, 57, 219, 162, 186, 96, 114, 118, 125, 149,
    239, 127, 200, 192, 222, 55, 148, 191, 181, 20, 129, 146, 37, 69, 172, 231, 245, 102, 167, 43,
    54, 90, 193, 19, 227, 75, 58, 232, 141, 131, 27, 124, 39, 176, 154, 66, 235, 135, 170, 220, 84,
    142, 120, 38, 210, 87, 41, 212, 183, 248, 47, 143, 137, 117, 240, 65, 119, 194, 30, 255, 216,
    21, 17, 229, 4, 151, 23, 243, 49, 208, 155, 0, 215, 202, 180, 79, 42, 59, 217, 178, 107, 218,
    93, 161, 63, 48, 97, 189, 145, 61, 78, 230, 223, 190, 77, 130, 140, 29, 35, 16, 152, 100, 244,
    133, 51, 123, 144, 67, 187, 169, 136, 241, 214, 165, 28, 246, 204, 110, 185, 91, 11, 150, 237,
    213, 233, 197, 203, 8, 166, 128, 64,
];

type RisuJsonObject = Record<string, unknown>;

interface ControlShape {
    kind: ModuleControlKind;
    value: string;
    options: ModuleControlOption[];
}

function isJsonObject(value: unknown): value is RisuJsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(source: RisuJsonObject, key: string): string | null {
    const value = source[key];
    return typeof value === 'string' ? value : null;
}

function arrayField(source: RisuJsonObject, key: string): unknown[] {
    const value = source[key];
    return Array.isArray(value) ? value : [];
}

function buildModulePrompt(description: string, module: RisuJsonObject, lorebook: unknown[]): string {
    let prompt = '';
    if (description.trim().length > 0) {
        prompt += `[Description]\n${description.trim()}\n`;
    }
    const toggle = stringField(module, 'customModuleToggle');
    if (toggle !== null && toggle.trim().length > 0) {
        prompt += `\n[Module Toggle]\n${toggle.trim()}\n`;
    }
    if (lorebook.length > 0) {
        prompt += '\n[Lorebook]\n';
        for (const entry of lorebook) {
            if (!isJsonObject(entry)) {
                continue;
            }
            const comment = stringField(entry, 'comment') ?? '';
            const content = stringField(entry, 'content') ?? '';
            if (content.trim().length === 0) {
                continue;
            }
            if (comment.trim().length > 0) {
                prompt += `### ${comment.trim()}\n`;
            }
            prompt += `${content.trim()}\n\n`;
        }
    }
    return prompt;
}

function selectOptions(values: readonly string[]): ModuleControlOption[] {
    return values.map((value) => ({ value, label: value }));
}

function controlShape(id: string): ControlShape {
    if (id === 'toggle_response_mode') {
        return { kind: 'select', value: '0', options: selectOptions(['0', '1', '2']) };
    }
    if (id === 'toggle_writer') {
        return { kind: 'select', value: 'Gemini', options: selectOptions(['Gemini', 'Claude', 'GPT']) };
    }
    if (id === 'toggle_RPD' || id === 'toggle_RPreq') {
        return { kind: 'select', value: '0', options: selectOptions(['0', '1']) };
    }
    if (id.includes('keyword') || id.includes('word')) {
        return { kind: 'text', value: '', options: [] };
    }
    return { kind: 'boolean', value: '0', options: [] };
}

function controlLabel(id: string): string {
    return id
        .replace(/^(toggle_)+/, '')
        .replace(/_/g, ' ')
        .split(/\s+/)
        .filter((part) => part.length > 0)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function buildModuleControls(module: RisuJsonObject): ModuleControl[] {
    const source = JSON.stringify(module);
    const ids: string[] = [];
    for (const marker of CONTROL_MARKERS) {
        let searchFrom = 0;
        let index = source.indexOf(marker, searchFrom);
        while (index !== -1) {
            const afterMarker = index + marker.length;
            const match = /^[A-Za-z0-9_]*/.exec(source.slice(afterMarker));
            const id = match ? match[0] : '';
            if (id.length > 0 && !ids.includes(id)) {
                ids.push(id);
            }
            searchFrom = afterMarker;
            index = source.indexOf(marker, searchFrom);
        }
    }
    ids.sort();
    return ids.map((id) => {
        const shape = controlShape(id);
        return {
            id,
            label: controlLabel(id),
            kind: shape.kind,
            value: shape.value,
            options: shape.options,
        };
    });
}

export function parseRisumModule(data: Uint8Array, sourcePath: string | null): ImportedModule {
    if (data.length < RISUM_HEADER_LENGTH || data[0] !== RISUM_MAGIC_BYTE || data[1] !== RISUM_SUPPORTED_VERSION) {
        throw new DomainError('invalid_format', 'magic/version');
    }
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const mainLength = view.getUint32(2, true);
    const mainEnd = RISUM_HEADER_LENGTH + mainLength;
    if (mainEnd > data.length) {
        throw new DomainError('invalid_format', `payload ${mainLength} > ${data.length - RISUM_HEADER_LENGTH}`);
    }
    const decoded = data.subarray(RISUM_HEADER_LENGTH, mainEnd).map((byte) => RPACK_DECODE_MAP[byte]);
    let root: unknown;
    try {
        root = JSON.parse(new TextDecoder().decode(decoded));
    }
    catch (error) {
        throw new DomainError('invalid_format', error instanceof Error ? error.message : String(error));
    }
    if (!isJsonObject(root) || root.type !== RISU_MODULE_TYPE) {
        throw new DomainError('invalid_format', `type != ${RISU_MODULE_TYPE}`);
    }
    const module = root.module;
    if (!isJsonObject(module)) {
        throw new DomainError('invalid_format', 'module');
    }
    const description = stringField(module, 'description') ?? '';
    const lorebook = arrayField(module, 'lorebook');
    return {
        id: crypto.randomUUID(),
        name: stringField(module, 'name') ?? IMPORTED_MODULE_DEFAULT_NAME,
        description,
        source_path: sourcePath,
        enabled: true,
        prompt: buildModulePrompt(description, module, lorebook),
        controls: buildModuleControls(module),
        lorebook_count: lorebook.length,
        regex_count: arrayField(module, 'regex').length,
        trigger_count: arrayField(module, 'trigger').length,
        created_at: createMonotonicTimestamp(),
    };
}

export function buildActiveModulePrompt(modules: ImportedModule[]): string {
    const active = modules.filter((module) => module.enabled && module.prompt.trim().length > 0);
    if (active.length === 0) {
        return '';
    }
    let block = '\n[Imported Risu Modules]\n';
    for (const module of active) {
        block += `\n## ${module.name}\n${module.prompt.trim()}\n`;
        const enabledControls = module.controls.filter((control) => control.value.trim().length > 0 && control.value !== '0');
        if (enabledControls.length > 0) {
            block += '\n[Module Controls]\n';
            for (const control of enabledControls) {
                block += `- ${control.label} (${control.id}): ${control.value.trim()}\n`;
            }
        }
    }
    return block;
}
