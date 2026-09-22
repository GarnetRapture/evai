import { EVERSOUL_STORE, SINGLETON_RECORD_KEY, getEverSoulDatabase } from '../../shared/storage';
import { createMonotonicTimestamp } from '../../shared/time';
import type { UserSession } from './types';

export const authClient = {
    async login(email: string, token: string): Promise<UserSession> {
        const session: UserSession = {
            token,
            email,
            username: email.split('@')[0],
            created_at: createMonotonicTimestamp(),
        };
        const database = await getEverSoulDatabase();
        await database.put(EVERSOUL_STORE.authSession, session, SINGLETON_RECORD_KEY);
        return session;
    },
    async logout(): Promise<void> {
        const database = await getEverSoulDatabase();
        await database.delete(EVERSOUL_STORE.authSession, SINGLETON_RECORD_KEY);
    },
    async getSession(): Promise<UserSession | null> {
        const database = await getEverSoulDatabase();
        return (await database.get(EVERSOUL_STORE.authSession, SINGLETON_RECORD_KEY)) ?? null;
    },
};
