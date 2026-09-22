let lastIssuedEpochMilliseconds = 0;

export function createMonotonicTimestamp(): string {
    const currentEpochMilliseconds = Date.now();
    lastIssuedEpochMilliseconds = currentEpochMilliseconds > lastIssuedEpochMilliseconds
        ? currentEpochMilliseconds
        : lastIssuedEpochMilliseconds + 1;
    return new Date(lastIssuedEpochMilliseconds).toISOString();
}
