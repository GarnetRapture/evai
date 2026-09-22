import type { AppLanguage } from "../../shared/types";
import { loadPersonaPack, normalizePersonaKey } from "./archive";
import {
  hasPersonaJudgmentArchive,
  hasPersonaMemoryArchive,
  loadPersonaIntimacyPatterns,
  loadPersonaJudgmentRecords,
  loadPersonaStoryMemoryRecords,
  loadPersonaTeachingLessonFile,
} from "./datasetArchive";
import { personaTeachingAnswerKey } from "./datasetKeys";
import { PERSONA_TEACHING_TOPIC_IDS } from "./teachingTopics";
import type {
  PersonaIntimacyPatternRecord,
  PersonaJudgmentInterpretation,
  PersonaJudgmentRecord,
  PersonaStoryMemoryRecord,
  PersonaTeachingExchange,
  PersonaTeachingLesson,
  PersonaTeachingLessonFile,
  PersonaTeachingStyleSource,
  PersonaTeachingTopicId,
} from "./types";

export interface PersonaDatasetCoverage {
  has_teaching: boolean;
  has_adult_teaching: boolean;
  has_judgment: boolean;
  has_story_memory: boolean;
}

export interface PersonaTeachingQuestion {
  topic_id: PersonaTeachingTopicId;
  source_class: string;
  question: string;
  paraphrases: string[];
  answer: string;
  history: PersonaTeachingExchange[];
  style_source: PersonaTeachingStyleSource;
}

const teachingFileMemo = new Map<string, Promise<PersonaTeachingLessonFile>>();
const teachingLessonMemo = new Map<string, PersonaTeachingLesson>();

function pickLocalizedText(
  values: Partial<Record<AppLanguage | "zh_tw", string>> | undefined,
  language: AppLanguage,
): string | null {
  if (!values) {
    return null;
  }
  for (const locale of [language, "ko", "en", "zh_tw"] as const) {
    const value = values[locale];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

function pickLocalizedList(
  values: Partial<Record<AppLanguage | "zh_tw", string[]>> | undefined,
  language: AppLanguage,
): string[] {
  if (!values) {
    return [];
  }
  for (const locale of [language, "ko", "en", "zh_tw"] as const) {
    const value = values[locale];
    if (Array.isArray(value) && value.length > 0) {
      return [...value];
    }
  }
  return [];
}

async function resolveArchiveSnos(archiveKey: string): Promise<string[]> {
  const pack = await loadPersonaPack(archiveKey);
  return [pack.id, archiveKey, normalizePersonaKey(pack.name_en)].filter(
    (sno) => sno.trim().length > 0,
  );
}

async function loadTeachingFile(
  adult: boolean,
): Promise<PersonaTeachingLessonFile> {
  const key = adult ? "adult" : "base";
  const memoized = teachingFileMemo.get(key);
  if (memoized) {
    return memoized;
  }
  const promise = loadPersonaTeachingLessonFile(adult);
  teachingFileMemo.set(key, promise);
  return promise;
}

function pickLocalizedExchanges(
  values:
    | Partial<Record<AppLanguage | "zh_tw", PersonaTeachingExchange[]>>
    | undefined,
  language: AppLanguage,
): PersonaTeachingExchange[] {
  if (!values) {
    return [];
  }
  for (const locale of [language, "ko", "en", "zh_tw"] as const) {
    const value = values[locale];
    if (Array.isArray(value) && value.length > 0) {
      return value.map((turn) => ({ role: turn.role, content: turn.content }));
    }
  }
  return [];
}

function substituteName(
  text: string,
  personaName: string,
  addressTerm: string,
): string {
  return text
    .replaceAll("{name}", personaName)
    .replaceAll("{savior}", addressTerm);
}

export const personaDatasetService = {
  async getCoverage(archiveKey: string): Promise<PersonaDatasetCoverage> {
    const [base, adult, snos] = await Promise.all([
      loadTeachingFile(false),
      loadTeachingFile(true),
      resolveArchiveSnos(archiveKey),
    ]);
    const hasAny = (file: PersonaTeachingLessonFile): boolean =>
      snos.some((sno: string) => sno in file.spirits);
    return {
      has_teaching: hasAny(base),
      has_adult_teaching: hasAny(adult),
      has_judgment: hasPersonaJudgmentArchive(archiveKey),
      has_story_memory: hasPersonaMemoryArchive(archiveKey),
    };
  },
  async getTeachingLesson(
    archiveKey: string,
    adult: boolean,
  ): Promise<PersonaTeachingLesson | null> {
    const memoKey = `${personaTeachingAnswerKey(archiveKey)}\u0000${adult ? "adult" : "base"}`;
    const memoized = teachingLessonMemo.get(memoKey);
    if (memoized !== undefined) {
      return memoized;
    }
    const [file, snos] = await Promise.all([
      loadTeachingFile(adult),
      resolveArchiveSnos(archiveKey),
    ]);
    for (const sno of snos) {
      const lesson = file.spirits[sno];
      if (lesson !== undefined) {
        teachingLessonMemo.set(memoKey, lesson);
        return lesson;
      }
    }
    return null;
  },
  async getTeachingQuestions(
    archiveKey: string,
    language: AppLanguage,
    personaName: string,
    addressTerm: string,
  ): Promise<PersonaTeachingQuestion[]> {
    const [baseFile, adultFile, baseLesson, adultLesson] = await Promise.all([
      loadTeachingFile(false),
      loadTeachingFile(true),
      personaDatasetService.getTeachingLesson(archiveKey, false),
      personaDatasetService.getTeachingLesson(archiveKey, true),
    ]);
    const sources: ReadonlyArray<
      readonly [PersonaTeachingLessonFile, PersonaTeachingLesson | null]
    > = [
      [baseFile, baseLesson],
      [adultFile, adultLesson],
    ];
    const collected: PersonaTeachingQuestion[] = [];
    for (const source of sources) {
      const file = source[0];
      const lesson = source[1];
      if (lesson === null) {
        continue;
      }
      for (const topicId of PERSONA_TEACHING_TOPIC_IDS) {
        const answer = pickLocalizedText(lesson.answers[topicId], language);
        if (answer === null) {
          continue;
        }
        const topic = file.topics[topicId];
        if (topic === undefined) {
          continue;
        }
        const question = pickLocalizedText(topic.questions, language);
        if (question === null) {
          continue;
        }
        collected.push({
          topic_id: topicId,
          source_class: topic.source_class,
          question: substituteName(question, personaName, addressTerm),
          paraphrases: pickLocalizedList(topic.paraphrases, language).map(
            (entry) => substituteName(entry, personaName, addressTerm),
          ),
          answer: substituteName(answer, personaName, addressTerm),
          history: pickLocalizedExchanges(topic.history, language).map(
            (turn) => ({
              role: turn.role,
              content: substituteName(turn.content, personaName, addressTerm),
            }),
          ),
          style_source: lesson.style_source,
        });
      }
    }
    return collected;
  },
  async getJudgmentRecords(
    archiveKey: string,
  ): Promise<PersonaJudgmentRecord[]> {
    if (!hasPersonaJudgmentArchive(archiveKey)) {
      return [];
    }
    return loadPersonaJudgmentRecords(archiveKey);
  },
  async getInterpretationLines(archiveKey: string): Promise<string[]> {
    const records = await personaDatasetService.getJudgmentRecords(archiveKey);
    return records
      .filter(
        (record) =>
          record.annotation_kind === "source_grounded_interpretation" &&
          record.judgment !== undefined,
      )
      .map((record) => {
        const judgment = record.judgment as PersonaJudgmentInterpretation;
        const evidence =
          judgment.evidence.length === 0
            ? ""
            : ` (${judgment.evidence.join(" / ")})`;
        return `- ${judgment.interpretation}: ${judgment.emotion} — ${judgment.action}${evidence}`;
      });
  },
  async getStoryMemoryLines(
    archiveKey: string,
    familiarityLevel: number,
  ): Promise<string[]> {
    const records =
      await personaDatasetService.getStoryMemoryRecords(archiveKey);
    return records
      .filter((record) => familiarityLevel >= record.love_level_min)
      .map((record) => `- ${record.text}`);
  },
  async getStoryMemoryRecords(
    archiveKey: string,
  ): Promise<PersonaStoryMemoryRecord[]> {
    if (!hasPersonaMemoryArchive(archiveKey)) {
      return [];
    }
    return loadPersonaStoryMemoryRecords(archiveKey);
  },
  async getIntimacyPatterns(): Promise<PersonaIntimacyPatternRecord[]> {
    return loadPersonaIntimacyPatterns();
  },
};
