export const FAMILIARITY_MAX_LEVEL = 40;
export const FAMILIARITY_EXP_STEP = 5;
export const FAMILIARITY_MEMORY_WEIGHT = 5;
export type FamiliarityGrade = 'epic' | 'eternal' | 'legendary' | 'origin';
export const FAMILIARITY_GRADE_MILESTONES: ReadonlyArray<{ level: number; grade: FamiliarityGrade }> = [
    { level: 10, grade: 'epic' },
    { level: 20, grade: 'eternal' },
    { level: 30, grade: 'legendary' },
    { level: 40, grade: 'origin' },
];

export function familiarityGradeLevel(grade: FamiliarityGrade): number {
    const milestone = FAMILIARITY_GRADE_MILESTONES.find((entry) => entry.grade === grade);
    if (milestone === undefined) {
        throw new RangeError(grade);
    }
    return milestone.level;
}

export function resolveFamiliarityGrade(level: number): FamiliarityGrade | null {
    let grade: FamiliarityGrade | null = null;
    for (const milestone of FAMILIARITY_GRADE_MILESTONES) {
        if (level >= milestone.level) {
            grade = milestone.grade;
        }
    }
    return grade;
}

export interface FamiliarityLevelInfo {
    level: number;
    isMax: boolean;
    totalExp: number;
    levelStartExp: number;
    nextLevelExp: number;
    progressExp: number;
    progressSpan: number;
    progressRatio: number;
}

export function familiarityScore(messageCount: number, memoryCount: number, affinityExp: number): number {
    return Math.max(0, messageCount) + Math.max(0, memoryCount) * FAMILIARITY_MEMORY_WEIGHT + Math.max(0, affinityExp);
}

export function familiarityCumulativeExp(level: number): number {
    const reached = Math.max(1, level);
    return FAMILIARITY_EXP_STEP * ((reached - 1) * reached) / 2;
}

export function computeFamiliarityLevel(totalExp: number): FamiliarityLevelInfo {
    const exp = Math.max(0, Math.floor(totalExp));
    let level = 1;
    while (level < FAMILIARITY_MAX_LEVEL && exp >= familiarityCumulativeExp(level + 1)) {
        level += 1;
    }
    const isMax = level >= FAMILIARITY_MAX_LEVEL;
    const levelStartExp = familiarityCumulativeExp(level);
    const nextLevelExp = isMax ? levelStartExp : familiarityCumulativeExp(level + 1);
    const progressSpan = isMax ? 0 : nextLevelExp - levelStartExp;
    const progressExp = exp - levelStartExp;
    const progressRatio = isMax ? 1 : (progressSpan > 0 ? Math.min(1, progressExp / progressSpan) : 0);
    return { level, isMax, totalExp: exp, levelStartExp, nextLevelExp, progressExp, progressSpan, progressRatio };
}
