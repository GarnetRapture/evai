type SuspendListener = (suspended: boolean) => void;

const listeners = new Set<SuspendListener>();
let suspended = false;

export function ambientBgmSuspended(): boolean {
    return suspended;
}

export function suspendAmbientBgm(value: boolean): void {
    if (suspended === value) {
        return;
    }
    suspended = value;
    for (const listener of listeners) {
        listener(value);
    }
}

export function subscribeAmbientBgm(listener: SuspendListener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
