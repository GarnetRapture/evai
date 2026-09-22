import { DomainError } from '../../shared/errors';
import { openLocalFile } from '../../shared/files';
import { EVERSOUL_STORE, getEverSoulDatabase } from '../../shared/storage';
import { RISU_MODULE_FILE_PICKER_ID, RISU_MODULE_FILE_TYPE, buildActiveModulePrompt, parseRisumModule } from './risum';
import type { ImportedModule, ModuleControl } from './types';

async function listStoredModules(): Promise<ImportedModule[]> {
    const database = await getEverSoulDatabase();
    const modules = await database.getAll(EVERSOUL_STORE.importedModule);
    return modules.sort((left, right) => left.created_at.localeCompare(right.created_at));
}

async function updateStoredModule(id: string, patch: Partial<ImportedModule>): Promise<ImportedModule[]> {
    const database = await getEverSoulDatabase();
    const existing = await database.get(EVERSOUL_STORE.importedModule, id);
    if (!existing) {
        throw new DomainError('not_found', id);
    }
    await database.put(EVERSOUL_STORE.importedModule, { ...existing, ...patch });
    return listStoredModules();
}

export const modulesClient = {
    async list(): Promise<ImportedModule[]> {
        return listStoredModules();
    },
    async importFromFile(file: File): Promise<ImportedModule> {
        const module = parseRisumModule(new Uint8Array(await file.arrayBuffer()), file.name);
        const database = await getEverSoulDatabase();
        const transaction = database.transaction(EVERSOUL_STORE.importedModule, 'readwrite');
        const existing = await transaction.store.getAll();
        for (const candidate of existing) {
            if (candidate.name === module.name) {
                await transaction.store.delete(candidate.id);
            }
        }
        await transaction.store.put(module);
        await transaction.done;
        return module;
    },
    async importFromLocalFile(): Promise<ImportedModule | null> {
        const file = await openLocalFile(RISU_MODULE_FILE_TYPE, RISU_MODULE_FILE_PICKER_ID);
        return file ? modulesClient.importFromFile(file) : null;
    },
    async setEnabled(id: string, enabled: boolean): Promise<ImportedModule[]> {
        return updateStoredModule(id, { enabled });
    },
    async updateControls(id: string, controls: ModuleControl[]): Promise<ImportedModule[]> {
        return updateStoredModule(id, { controls });
    },
    async delete(id: string): Promise<ImportedModule[]> {
        const database = await getEverSoulDatabase();
        await database.delete(EVERSOUL_STORE.importedModule, id);
        return listStoredModules();
    },
    async getActivePrompt(): Promise<string> {
        return buildActiveModulePrompt(await listStoredModules());
    },
};
