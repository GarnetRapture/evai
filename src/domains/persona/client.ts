import { settingsRepository } from '../settings/repository';
import { listPersonaArchiveKeys, loadPersonaPack } from './archive';
import { personaRepository } from './repository';
import { personaNotFoundError, personaService } from './service';
import type { BondRankingEntry, FamiliarityEntry, PersonaConfig, SpiritDetail } from './types';

async function currentLanguage() {
    return (await settingsRepository.readAppSettings()).language;
}

export const personaClient = {
    async list(): Promise<PersonaConfig[]> {
        return personaService.getAvailablePersonas(await currentLanguage());
    },
    async update(id: string, systemPrompt: string, greeting: string): Promise<void> {
        const persona = await personaRepository.getPersona(id);
        if (!persona) {
            throw personaNotFoundError(id);
        }
        await personaRepository.savePersona({ ...persona, system_prompt: systemPrompt, greeting });
    },
    async listArchive(): Promise<string[]> {
        return listPersonaArchiveKeys();
    },
    async getPack(nameEn: string): Promise<SpiritDetail> {
        return loadPersonaPack(nameEn);
    },
    async selectPreset(nameEn: string): Promise<PersonaConfig> {
        return personaService.installPreset(nameEn, await currentLanguage());
    },
    async getDefault(): Promise<string | null> {
        return (await settingsRepository.readGeneral()).default_persona_id;
    },
    async toggleDefault(id: string): Promise<string | null> {
        const persona = await personaRepository.getPersona(id);
        if (!persona) {
            throw personaNotFoundError(id);
        }
        const current = (await settingsRepository.readGeneral()).default_persona_id;
        const next = current === id ? null : id;
        await settingsRepository.updateGeneral({ default_persona_id: next });
        return next;
    },
    async getBondRanking(): Promise<BondRankingEntry[]> {
        return personaService.getBondRanking();
    },
    async getFamiliarityList(): Promise<FamiliarityEntry[]> {
        return personaService.getFamiliarityList();
    },
};
