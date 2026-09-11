import { EVERSOUL_STORE, getEverSoulDatabase } from '../../shared/storage';
import type { AppLanguage } from '../../shared/types';
import type { PersonaLocalizedPrompt, StoredPersonaProfile } from './types';

export const personaRepository = {
    async savePersona(persona: StoredPersonaProfile): Promise<void> {
        const database = await getEverSoulDatabase();
        await database.put(EVERSOUL_STORE.personaProfile, persona);
    },
    async getPersona(id: string): Promise<StoredPersonaProfile | null> {
        const database = await getEverSoulDatabase();
        return (await database.get(EVERSOUL_STORE.personaProfile, id)) ?? null;
    },
    async listPersonas(): Promise<StoredPersonaProfile[]> {
        const database = await getEverSoulDatabase();
        return database.getAll(EVERSOUL_STORE.personaProfile);
    },
    async getLocalizedPrompt(personaId: string, language: AppLanguage, sourceUpdatedAt: string): Promise<PersonaLocalizedPrompt | null> {
        const database = await getEverSoulDatabase();
        return (await database.get(EVERSOUL_STORE.personaLocalizedPrompt, [personaId, language, sourceUpdatedAt])) ?? null;
    },
    async saveLocalizedPrompt(entry: PersonaLocalizedPrompt): Promise<void> {
        const database = await getEverSoulDatabase();
        await database.put(EVERSOUL_STORE.personaLocalizedPrompt, entry);
    },
};
