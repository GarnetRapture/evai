import type { AppLanguage } from '../../../../src/shared/types';
import type { PersonaLocalizedPrompt, StoredPersonaProfile } from '../../../../src/domains/persona/types';
import { EVERSOUL_STORE, getEverSoulDatabase } from '../../shared/storage';

const profileCache = new Map<string, StoredPersonaProfile>();
let profileCacheComplete = false;
let profileCacheGeneration = 0;
let profileListing: { generation: number; profiles: Promise<StoredPersonaProfile[]> } | null = null;

function normalizeStoredPersona(persona: StoredPersonaProfile): StoredPersonaProfile {
    return { ...persona, personality_override: persona.personality_override === null || persona.personality_override === undefined ? null : { ...persona.personality_override } };
}

function compareProfileKeys(left: StoredPersonaProfile, right: StoredPersonaProfile): number {
    if (left.id < right.id) {
        return -1;
    }
    return left.id > right.id ? 1 : 0;
}

async function readProfileListing(generation: number): Promise<StoredPersonaProfile[]> {
    const database = await getEverSoulDatabase();
    const profiles = (await database.getAll(EVERSOUL_STORE.personaProfile)).map(normalizeStoredPersona);
    if (generation === profileCacheGeneration) {
        profileCache.clear();
        for (const profile of profiles) {
            profileCache.set(profile.id, profile);
        }
        profileCacheComplete = true;
    }
    return profiles;
}

export const personaRepository = {
    async savePersona(persona: StoredPersonaProfile): Promise<void> {
        const database = await getEverSoulDatabase();
        profileCacheGeneration += 1;
        try {
            await database.put(EVERSOUL_STORE.personaProfile, persona);
        }
        finally {
            profileCacheGeneration += 1;
        }
        profileCache.set(persona.id, normalizeStoredPersona(persona));
    },
    async getPersona(id: string): Promise<StoredPersonaProfile | null> {
        const cached = profileCache.get(id);
        if (cached !== undefined) {
            return normalizeStoredPersona(cached);
        }
        if (profileCacheComplete) {
            return null;
        }
        const generation = profileCacheGeneration;
        const database = await getEverSoulDatabase();
        const stored = await database.get(EVERSOUL_STORE.personaProfile, id);
        if (!stored) {
            return null;
        }
        const profile = normalizeStoredPersona(stored);
        if (generation === profileCacheGeneration) {
            profileCache.set(id, profile);
        }
        return normalizeStoredPersona(profile);
    },
    async listPersonas(): Promise<StoredPersonaProfile[]> {
        if (profileCacheComplete) {
            return [...profileCache.values()].sort(compareProfileKeys).map(normalizeStoredPersona);
        }
        if (profileListing === null || profileListing.generation !== profileCacheGeneration) {
            const generation = profileCacheGeneration;
            const profiles: Promise<StoredPersonaProfile[]> = readProfileListing(generation).finally(() => {
                if (profileListing?.profiles === profiles) {
                    profileListing = null;
                }
            });
            profileListing = { generation, profiles };
        }
        return (await profileListing.profiles).map(normalizeStoredPersona);
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
