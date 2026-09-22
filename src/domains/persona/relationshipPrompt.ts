import type { PersonaCanonLine, PersonaRelationEvidence } from './types';

export const RELATIONSHIP_PROMPT_LIMIT = 5;
const SUMMARY_REMARK_CHAR_LIMIT = 140;
const DETAIL_REMARK_CHAR_LIMIT = 200;
const DETAIL_SELF_REMARK_LIMIT = 3;
const DETAIL_OTHER_REMARK_LIMIT = 2;
const DETAIL_SCENE_LIMIT = 1;
const SPOKEN_LINE_SEPARATOR = ' / ';

function clipCanonText(text: string, limit: number): string {
    const normalized = text.replace(/\s+/gu, ' ').trim();
    return normalized.length <= limit ? normalized : `${normalized.slice(0, limit).trimEnd()}...`;
}

function spokenLines(lines: readonly string[], limit: number): string {
    return lines.map((line) => clipCanonText(line, limit)).join(SPOKEN_LINE_SEPARATOR);
}

function relationIdentity(relation: PersonaRelationEvidence): string {
    const details = [
        relation.nick_name === null ? '' : `"${relation.nick_name}"`,
        relation.unions.length === 0 ? '' : relation.unions.join(', '),
    ].filter((detail) => detail.length > 0);
    return details.length === 0 ? relation.name : `${relation.name} (${details.join(', ')})`;
}

function relationFacts(relation: PersonaRelationEvidence): string[] {
    return [
        relation.shared_union === null ? '' : `You both belong to ${relation.shared_union}.`,
        relation.address_forms.length === 0 ? '' : `You call them ${relation.address_forms.map((form) => `"${form}"`).join(' or ')}.`,
    ].filter((fact) => fact.length > 0);
}

function sceneText(scene: readonly PersonaCanonLine[]): string {
    return scene.map((line) => `${line.speaker}: ${clipCanonText(line.message, DETAIL_REMARK_CHAR_LIMIT)}`).join('\n');
}

export function buildPersonaRelationshipSection(relations: readonly PersonaRelationEvidence[]): string {
    const lines = relations.slice(0, RELATIONSHIP_PROMPT_LIMIT).map((relation) => {
        const parts = [
            ...relationFacts(relation),
            relation.self_remarks.length === 0 ? '' : `Your own words about them: ${spokenLines(relation.self_remarks.slice(0, 1), SUMMARY_REMARK_CHAR_LIMIT)}`,
            relation.other_remarks.length === 0 ? '' : `Their words about you: ${spokenLines(relation.other_remarks.slice(0, 1), SUMMARY_REMARK_CHAR_LIMIT)}`,
        ].filter((part) => part.length > 0);
        return `- ${relationIdentity(relation)}${parts.length === 0 ? '' : `: ${parts.join(' ')}`}`;
    });
    return lines.length === 0
        ? ''
        : '[SOULS YOU KNOW]\nOther souls from your own life, closest first. Speak of them the way your own words below show, call them the way you always do, and speak of what you have really shared with them as shown here.\n'
            + lines.join('\n');
}

export function buildPersonaRelationDetail(relation: PersonaRelationEvidence): string {
    const lines = [
        `Who they are: ${relationIdentity(relation)}.`,
        ...relationFacts(relation),
        relation.self_remarks.length === 0 ? '' : `Your own words about them: ${spokenLines(relation.self_remarks.slice(0, DETAIL_SELF_REMARK_LIMIT), DETAIL_REMARK_CHAR_LIMIT)}`,
        relation.other_remarks.length === 0 ? '' : `Their words about you: ${spokenLines(relation.other_remarks.slice(0, DETAIL_OTHER_REMARK_LIMIT), DETAIL_REMARK_CHAR_LIMIT)}`,
        ...relation.shared_scenes.slice(0, DETAIL_SCENE_LIMIT).map((scene) => `A moment you both were part of:\n${sceneText(scene)}`),
    ].filter((line) => line.length > 0);
    return `[ABOUT ${relation.name}]\n${lines.join('\n')}`;
}

export function describePersonaRelationAddress(relation: PersonaRelationEvidence): string {
    return relation.address_forms.length === 0 ? relation.name : relation.address_forms[0];
}
