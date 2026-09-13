import { createMonotonicTimestamp } from '../../shared/time';
import type { PersonaMaintenanceListener, PersonaMaintenanceTask, PersonaMaintenanceTaskKind } from './types';

const activeTasks = new Map<string, PersonaMaintenanceTask>();
const listeners = new Set<PersonaMaintenanceListener>();

function publishMaintenanceTasks(): void {
    const snapshot = listPersonaMaintenanceTasks();
    for (const listener of listeners) {
        listener(snapshot);
    }
}

export function listPersonaMaintenanceTasks(): PersonaMaintenanceTask[] {
    return [...activeTasks.values()].sort((left, right) => left.started_at.localeCompare(right.started_at));
}

export function subscribePersonaMaintenance(listener: PersonaMaintenanceListener): () => void {
    listeners.add(listener);
    listener(listPersonaMaintenanceTasks());
    return () => {
        listeners.delete(listener);
    };
}

export async function runPersonaMaintenanceTask<Result>(
    personaId: string,
    kind: PersonaMaintenanceTaskKind,
    work: () => Promise<Result>,
): Promise<Result> {
    const task: PersonaMaintenanceTask = {
        task_id: crypto.randomUUID(),
        persona_id: personaId,
        kind,
        started_at: createMonotonicTimestamp(),
    };
    activeTasks.set(task.task_id, task);
    publishMaintenanceTasks();
    try {
        return await work();
    }
    finally {
        activeTasks.delete(task.task_id);
        publishMaintenanceTasks();
    }
}
