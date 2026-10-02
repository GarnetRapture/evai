import { DomainError } from '../../../../src/shared/errors';
import { personaJudgmentKey, personaStoryMemoryKey } from '../../../../src/domains/persona/datasetKeys';
import type {
    PersonaIntimacyPatternRecord,
    PersonaJudgmentRecord,
    PersonaStoryMemoryRecord,
    PersonaTeachingLessonFile,
} from '../../../../src/domains/persona/types';
import NativeEvaiAssets from '../../shared/native/specs/NativeEvaiAssets';
import { runNative } from '../../shared/native/failure';

const PERSONA_TEACHING_FILE = 'spirit_lessons/curriculum.json';
const PERSONA_TEACHING_ADULT_FILE = 'spirit_lessons/extensions/adult_extension.json';
const PERSONA_JUDGMENT_DIRECTORY = 'spirit_judgment';
const PERSONA_MEMORY_DIRECTORY = 'spirit_memory';
const PERSONA_INTIMACY_PATTERN_FILE = 'dialogue_patterns/intimacy_ko.jsonl';
const JSON_MODULE_EXTENSION = '.json';
const JSONL_MODULE_EXTENSION = '.jsonl';

let judgmentFileNames: ReadonlySet<string> | null = null;
let memoryFileNames: ReadonlySet<string> | null = null;

async function listDatasetDirectory(directory: string): Promise<ReadonlySet<string>> {
    const fileNames = JSON.parse(await runNative(() => NativeEvaiAssets.listDatasetFiles(directory))) as string[];
    return new Set(fileNames.filter((fileName) => fileName.endsWith(JSONL_MODULE_EXTENSION)));
}

function requireFileNames(fileNames: ReadonlySet<string> | null, directory: string): ReadonlySet<string> {
    if (fileNames === null) {
        throw new DomainError('archive', directory);
    }
    return fileNames;
}

function archiveKeysOf(fileNames: ReadonlySet<string>, extension: string): string[] {
    return [...fileNames]
        .filter((fileName) => fileName.endsWith(extension))
        .map((fileName) => fileName.slice(0, fileName.length - extension.length))
        .sort((left, right) => left.localeCompare(right));
}

function parseJsonLines<T>(text: string, source: string): T[] {
    const records: T[] = [];
    for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.length === 0) {
            continue;
        }
        records.push(JSON.parse(trimmed) as T);
    }
    if (records.length === 0) {
        throw new DomainError('archive', source);
    }
    return records;
}

function readDatasetText(path: string): Promise<string> {
    return runNative(() => NativeEvaiAssets.readDatasetFile(path));
}

export async function loadPersonaDatasetIndex(): Promise<void> {
    const [judgments, memories] = await Promise.all([
        listDatasetDirectory(PERSONA_JUDGMENT_DIRECTORY),
        listDatasetDirectory(PERSONA_MEMORY_DIRECTORY),
    ]);
    judgmentFileNames = judgments;
    memoryFileNames = memories;
}

export function listPersonaJudgmentArchiveKeys(): string[] {
    return archiveKeysOf(requireFileNames(judgmentFileNames, PERSONA_JUDGMENT_DIRECTORY), JSONL_MODULE_EXTENSION);
}

export function listPersonaMemoryArchiveKeys(): string[] {
    return archiveKeysOf(requireFileNames(memoryFileNames, PERSONA_MEMORY_DIRECTORY), JSONL_MODULE_EXTENSION);
}

export function hasPersonaJudgmentArchive(archiveKey: string): boolean {
    const key = personaJudgmentKey(archiveKey);
    const fileNames = requireFileNames(judgmentFileNames, PERSONA_JUDGMENT_DIRECTORY);
    return fileNames.has(`${key}${JSONL_MODULE_EXTENSION}`) || fileNames.has(`${key}${JSON_MODULE_EXTENSION}`);
}

export function hasPersonaMemoryArchive(archiveKey: string): boolean {
    const key = personaStoryMemoryKey(archiveKey);
    const fileNames = requireFileNames(memoryFileNames, PERSONA_MEMORY_DIRECTORY);
    return fileNames.has(`${key}${JSONL_MODULE_EXTENSION}`) || fileNames.has(`${key}${JSON_MODULE_EXTENSION}`);
}

export async function loadPersonaTeachingLessonFile(adult: boolean): Promise<PersonaTeachingLessonFile> {
    return JSON.parse(await readDatasetText(adult ? PERSONA_TEACHING_ADULT_FILE : PERSONA_TEACHING_FILE)) as PersonaTeachingLessonFile;
}

export async function loadPersonaJudgmentRecords(archiveKey: string): Promise<PersonaJudgmentRecord[]> {
    const key = personaJudgmentKey(archiveKey);
    if (!requireFileNames(judgmentFileNames, PERSONA_JUDGMENT_DIRECTORY).has(`${key}${JSONL_MODULE_EXTENSION}`)) {
        throw new DomainError('archive', archiveKey);
    }
    return parseJsonLines<PersonaJudgmentRecord>(await readDatasetText(`${PERSONA_JUDGMENT_DIRECTORY}/${key}${JSONL_MODULE_EXTENSION}`), archiveKey);
}

export async function loadPersonaStoryMemoryRecords(archiveKey: string): Promise<PersonaStoryMemoryRecord[]> {
    const key = personaStoryMemoryKey(archiveKey);
    if (!requireFileNames(memoryFileNames, PERSONA_MEMORY_DIRECTORY).has(`${key}${JSONL_MODULE_EXTENSION}`)) {
        throw new DomainError('archive', archiveKey);
    }
    return parseJsonLines<PersonaStoryMemoryRecord>(await readDatasetText(`${PERSONA_MEMORY_DIRECTORY}/${key}${JSONL_MODULE_EXTENSION}`), archiveKey);
}

export async function loadPersonaIntimacyPatterns(): Promise<PersonaIntimacyPatternRecord[]> {
    return parseJsonLines<PersonaIntimacyPatternRecord>(await readDatasetText(PERSONA_INTIMACY_PATTERN_FILE), PERSONA_INTIMACY_PATTERN_FILE);
}

export function readPersonaIntimacyPatternText(): Promise<string> {
    return readDatasetText(PERSONA_INTIMACY_PATTERN_FILE);
}
