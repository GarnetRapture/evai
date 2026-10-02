import { createPersonaIntimacyPatternLibrary } from '../../../../src/domains/persona/intimacyPatternLibrary';
import { readPersonaIntimacyPatternText } from './datasetArchive';

export type { PersonaIntimacySelection } from '../../../../src/domains/persona/intimacyPatternLibrary';

const intimacyPatternLibrary = createPersonaIntimacyPatternLibrary(readPersonaIntimacyPatternText);

export const {
    listPersonaIntimacyLevels,
    listPersonaIntimacyTopics,
    countPersonaIntimacyPatterns,
    selectPersonaIntimacyDialogue,
    selectPersonaIntimacyPatterns,
} = intimacyPatternLibrary;
