import { DomainError } from "../../shared/errors";
import { normalizeAppLanguage } from "../../shared/i18n";
import {
  beginEverSoulDatabaseMaintenance,
  endEverSoulDatabaseMaintenance,
  resetEverSoulStorage,
} from "../../shared/storage";
import { createMonotonicTimestamp } from "../../shared/time";
import type { AppLanguage } from "../../shared/types";
import { createPersonaEmotionStateFromLevels } from "../chat/affect";
import {
  isMemoryContextKind,
  normalizeMemoryContextFilter,
} from "../chat/memoryContext";
import { chatRepository } from "../chat/repository";
import type { MemoryContextKind } from "../chat/types";
import { llmClient } from "../llm";
import { personaService } from "../persona";
import { findEmotionPreset, mergePersonaCheatPreset } from "../persona/presets";
import type { PersonaCheatPresetPatch } from "../persona/types";
import { composeAppSettings, settingsRepository } from "./repository";
import {
  MAX_PREFERRED_PERSONAS,
  type AppSettings,
  type SetupProgressHandler,
} from "./types";

function assertLanguage(language: string): AppLanguage {
  const normalized = normalizeAppLanguage(language);
  if (!normalized) {
    throw new DomainError("validation", language);
  }
  return normalized;
}

export const settingsClient = {
  async get(): Promise<AppSettings> {
    return settingsRepository.readAppSettings();
  },
  async resetForReload(): Promise<void> {
    await llmClient.unloadEngine();
    await beginEverSoulDatabaseMaintenance();
    try {
      await resetEverSoulStorage();
      localStorage.clear();
    } finally {
      endEverSoulDatabaseMaintenance();
    }
  },
  async setLanguage(language: AppLanguage): Promise<AppSettings> {
    const normalized = assertLanguage(language);
    const general = await settingsRepository.updateGeneral({
      language: normalized,
    });
    await personaService.warmLocalizedPrompts(normalized);
    return composeAppSettings(general);
  },
  async completeInitialSetup(
    language: AppLanguage,
    onProgress: SetupProgressHandler,
  ): Promise<AppSettings> {
    const normalizedLanguage = assertLanguage(language);
    await settingsRepository.updateGeneral({
      language: normalizedLanguage,
      setup_stage: "done",
    });
    await personaService.ensureArchivePersonasInstalled(
      normalizedLanguage,
      (current, total) => {
        onProgress({ stage: "personas", current, total });
      },
    );
    await personaService.warmLocalizedPrompts(
      normalizedLanguage,
      (current, total) => {
        onProgress({ stage: "caching", current, total });
      },
    );
    onProgress({ stage: "model", current: 0, total: 1 });
    try {
      await llmClient.loadEngine();
    } catch (error) {
      console.info(
        "No local model is ready during setup; model selection remains available in Settings.",
        error,
      );
    }
    onProgress({ stage: "done", current: 1, total: 1 });
    return settingsClient.get();
  },
  async acknowledgePlatformGuide(): Promise<AppSettings> {
    return composeAppSettings(
      await settingsRepository.updateGeneral({
        platform_guide_acknowledged: true,
      }),
    );
  },
  async setShowReasoning(showReasoning: boolean): Promise<AppSettings> {
    return composeAppSettings(
      await settingsRepository.updateGeneral({ show_reasoning: showReasoning }),
    );
  },
  async setProactiveMessagesEnabled(enabled: boolean): Promise<AppSettings> {
    return composeAppSettings(
      await settingsRepository.updateGeneral({
        proactive_messages_enabled: enabled,
      }),
    );
  },
  async setPersonaSkin(
    personaId: string,
    skinId: string,
  ): Promise<AppSettings> {
    const general = await settingsRepository.readGeneral();
    return composeAppSettings(
      await settingsRepository.updateGeneral({
        persona_skin_ids: { ...general.persona_skin_ids, [personaId]: skinId },
      }),
    );
  },
  async togglePreferredPersona(personaId: string): Promise<AppSettings> {
    const general = await settingsRepository.readGeneral();
    const current = general.preferred_persona_ids ?? [];
    const exists = current.includes(personaId);
    const next = exists
      ? current.filter((id) => id !== personaId)
      : [...current, personaId].slice(-MAX_PREFERRED_PERSONAS);
    return composeAppSettings(
      await settingsRepository.updateGeneral({
        preferred_persona_ids: next,
        default_persona_id: next[0] ?? null,
      }),
    );
  },
  async setLobbyBackground(background: string | null): Promise<AppSettings> {
    return composeAppSettings(
      await settingsRepository.updateGeneral({ lobby_background: background }),
    );
  },
  async setMemoryContextEnabled(
    kind: MemoryContextKind,
    enabled: boolean,
  ): Promise<AppSettings> {
    if (!isMemoryContextKind(kind)) {
      throw new DomainError("validation", kind);
    }
    const general = await settingsRepository.readGeneral();
    return composeAppSettings(
      await settingsRepository.updateGeneral({
        memory_context_filter: {
          ...normalizeMemoryContextFilter(general.memory_context_filter),
          [kind]: enabled,
        },
      }),
    );
  },
  async setCheatModeEnabled(enabled: boolean): Promise<AppSettings> {
    return composeAppSettings(
      await settingsRepository.updateGeneral({ cheat_mode_enabled: enabled }),
    );
  },
  async updatePersonaCheatPreset(
    personaId: string,
    patch: PersonaCheatPresetPatch,
  ): Promise<AppSettings> {
    const general = await settingsRepository.readGeneral();
    const presets = general.persona_cheat_presets ?? {};
    const updatedAt = createMonotonicTimestamp();
    const next = mergePersonaCheatPreset(presets[personaId], patch, updatedAt);
    const emotionLevels =
      patch.emotion_preset === undefined
        ? null
        : findEmotionPreset(next.emotion_preset).levels;
    if (emotionLevels !== null) {
      await chatRepository.upsertPersonaEmotion(
        personaId,
        createPersonaEmotionStateFromLevels(emotionLevels, updatedAt),
      );
    }
    return composeAppSettings(
      await settingsRepository.updateGeneral({
        persona_cheat_presets: { ...presets, [personaId]: next },
      }),
    );
  },
  async clearPersonaCheatPreset(personaId: string): Promise<AppSettings> {
    const general = await settingsRepository.readGeneral();
    const remaining = Object.fromEntries(
      Object.entries(general.persona_cheat_presets ?? {}).filter(
        ([id]) => id !== personaId,
      ),
    );
    return composeAppSettings(
      await settingsRepository.updateGeneral({
        persona_cheat_presets: remaining,
      }),
    );
  },
  async setSaviorName(name: string): Promise<AppSettings> {
    return composeAppSettings(
      await settingsRepository.updateGeneral({
        savior_name: name.slice(0, 24),
      }),
    );
  },
};
