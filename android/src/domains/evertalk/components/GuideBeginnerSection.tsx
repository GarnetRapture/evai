import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { GuidePathKind, GuideStepState } from '../../../../../src/domains/evertalk/types';
import { Icon, type IconName } from '../../../shared/icons';
import { buildGuideChecklist } from '../logic';
import type { WorkspacePageProps } from '../types';
import { GuideStepActionButton } from './GuideStepActionButton';

const GUIDE_BEGINNER_TITLE_ID = 'guide-beginner-title';
const GUIDE_CHECKLIST_TITLE_ID = 'guide-checklist-title';
const GUIDE_TEXT_COLOR = '#26293b';
const GUIDE_MUTED_TEXT_COLOR = '#4d5263';
const CONCEPT_MIN_WIDTH = 300;
const CONCEPT_GAP = 10;

const GUIDE_STEP_STATE_ICONS: Record<GuideStepState, IconName> = {
    checking: 'Loader2',
    done: 'CheckCircle2',
    current: 'CircleDot',
    todo: 'Circle',
    optional: 'PlusCircle',
};

const GUIDE_STEP_MARKER_COLORS: Record<GuideStepState, string> = {
    checking: '#817d8e',
    done: '#168153',
    current: '#5c4fa3',
    todo: '#817d8e',
    optional: '#817d8e',
};

const GUIDE_PATH: GuidePathKind = 'local_server';

export function GuideBeginnerSection({ controller }: WorkspacePageProps) {
    const { labels } = controller;
    const [conceptListWidth, setConceptListWidth] = useState(0);
    const path = GUIDE_PATH;
    const steps = buildGuideChecklist({
        catalog: controller.modelCatalog,
        activeModelId: controller.appSettings?.active_model ?? '',
        llmStatus: controller.llmStatus,
        gatePending: controller.gatePending,
    });
    const conceptColumns = Math.max(1, Math.floor((conceptListWidth + CONCEPT_GAP) / (CONCEPT_MIN_WIDTH + CONCEPT_GAP)));
    const conceptWidth = conceptListWidth === 0 ? '100%' : (conceptListWidth - CONCEPT_GAP * (conceptColumns - 1)) / conceptColumns;
    return (
        <>
            <View style={styles.card} accessibilityLabelledBy={GUIDE_BEGINNER_TITLE_ID}>
                <Text nativeID={GUIDE_BEGINNER_TITLE_ID} accessibilityRole="header" style={styles.cardTitle}>{labels.guideBeginnerTitle}</Text>
                <Text style={styles.cardText}>{labels.guideBeginnerIntro}</Text>
                <View style={styles.conceptList} onLayout={(event) => setConceptListWidth(event.nativeEvent.layout.width)}>
                    {labels.guideConcepts.map((concept) => (
                        <View key={concept.term} style={[styles.concept, { width: conceptWidth }]}>
                            <Text style={styles.conceptTerm}>{concept.term}</Text>
                            <Text style={styles.conceptDescription}>{concept.description}</Text>
                        </View>
                    ))}
                </View>
            </View>
            <View style={styles.card} accessibilityLabelledBy={GUIDE_CHECKLIST_TITLE_ID}>
                <Text nativeID={GUIDE_CHECKLIST_TITLE_ID} accessibilityRole="header" style={styles.cardTitle}>{labels.guideChecklistTitle}</Text>
                <Text style={styles.cardText}>{labels.guideChecklistIntro[path]}</Text>
                <View accessibilityRole="list" style={styles.steps}>
                    {steps.map((step, index) => (
                        <View
                            key={step.key}
                            style={[
                                styles.step,
                                step.state === 'current' ? styles.stepCurrent : null,
                                step.state === 'done' ? styles.stepDone : null,
                                step.state === 'todo' ? styles.stepTodo : null,
                            ]}
                        >
                            <View style={styles.stepMarker} importantForAccessibility="no-hide-descendants">
                                <Icon
                                    name={GUIDE_STEP_STATE_ICONS[step.state]}
                                    size={20}
                                    color={GUIDE_STEP_MARKER_COLORS[step.state]}
                                    spinning={step.state === 'checking'}
                                />
                            </View>
                            <View style={styles.stepBody}>
                                <View style={styles.stepHead}>
                                    <Text style={styles.stepTitle}>{index + 1}. {labels.guideStepTitles[step.key]}</Text>
                                    <Text
                                        style={[
                                            styles.stepState,
                                            step.state === 'done' ? styles.stepStateDone : null,
                                            step.state === 'current' ? styles.stepStateCurrent : null,
                                        ]}
                                    >
                                        {labels.guideStepStates[step.state]}
                                    </Text>
                                </View>
                                <Text style={styles.stepDescription}>{labels.guideStepDescriptions[step.key]}</Text>
                                {step.actions.length > 0 && step.state !== 'done' ? (
                                    <View style={styles.stepActions}>
                                        {step.actions.map((action) => <GuideStepActionButton key={action} action={action} controller={controller}/>)}
                                    </View>
                                ) : null}
                            </View>
                        </View>
                    ))}
                </View>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    card: {
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(72, 70, 95, 0.18)',
        borderRadius: 8,
        backgroundColor: '#fffaf1',
    },
    cardTitle: {
        marginBottom: 8,
        color: GUIDE_TEXT_COLOR,
        fontSize: 17.6,
    },
    cardText: {
        marginBottom: 14,
        color: GUIDE_MUTED_TEXT_COLOR,
        fontSize: 13.12,
        lineHeight: 21,
    },
    conceptList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: CONCEPT_GAP,
    },
    concept: {
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(72, 70, 95, 0.14)',
        borderRadius: 8,
        backgroundColor: '#ffffff',
    },
    conceptTerm: {
        marginBottom: 4,
        color: GUIDE_TEXT_COLOR,
        fontSize: 15,
        fontWeight: '800',
    },
    conceptDescription: {
        color: GUIDE_MUTED_TEXT_COLOR,
        fontSize: 13.76,
        lineHeight: 22,
    },
    steps: {
        gap: 10,
    },
    step: {
        flexDirection: 'row',
        gap: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(72, 70, 95, 0.14)',
        borderRadius: 8,
        backgroundColor: '#ffffff',
    },
    stepCurrent: {
        borderColor: '#5c4fa3',
        boxShadow: 'inset 0px 0px 0px 1px #5c4fa3',
    },
    stepDone: {
        backgroundColor: 'rgba(22, 129, 83, 0.06)',
    },
    stepTodo: {
        opacity: 0.72,
    },
    stepMarker: {
        width: 28,
        alignItems: 'center',
        paddingTop: 1,
    },
    stepBody: {
        flex: 1,
        minWidth: 0,
        gap: 6,
    },
    stepHead: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    stepTitle: {
        flexShrink: 1,
        color: GUIDE_TEXT_COLOR,
        fontSize: 15,
        fontWeight: '700',
    },
    stepState: {
        overflow: 'hidden',
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 999,
        backgroundColor: 'rgba(72, 70, 95, 0.1)',
        color: GUIDE_MUTED_TEXT_COLOR,
        fontSize: 11.52,
        fontWeight: '800',
    },
    stepStateDone: {
        backgroundColor: 'rgba(22, 129, 83, 0.14)',
        color: '#168153',
    },
    stepStateCurrent: {
        backgroundColor: 'rgba(92, 79, 163, 0.14)',
        color: '#5c4fa3',
    },
    stepDescription: {
        color: GUIDE_MUTED_TEXT_COLOR,
        fontSize: 13.76,
        lineHeight: 22,
    },
    stepActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
});
