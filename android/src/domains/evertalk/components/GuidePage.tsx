import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../../shared/icons';
import { resolveOllamaCommandShell } from '../../ollama';
import { OLLAMA_HOST_PLATFORMS } from '../logic';
import type { WorkspacePageProps } from '../types';
import { GuideBeginnerSection } from './GuideBeginnerSection';
import { OllamaConnectionGuide } from './OllamaConnectionGuide';
import { WorkspacePageHeader, WorkspacePageHeaderIcon, WorkspaceSurface } from './WorkspaceSurface';

const GUIDE_TEXT_COLOR = '#26293b';
const GUIDE_PAGE_TITLE_ID = 'guide-page-title';
const GUIDE_TERMINAL_TITLE_ID = 'guide-terminal-title';
const GUIDE_HOST_PLATFORM_TITLE_ID = 'guide-host-platform-title';

export function GuidePage({ controller }: WorkspacePageProps) {
    const { labels } = controller;
    return (
        <WorkspaceSurface controller={controller} labelledBy={GUIDE_PAGE_TITLE_ID}>
            <WorkspacePageHeader
                eyebrow={labels.navGuide}
                title={labels.guidePageTitle}
                titleId={GUIDE_PAGE_TITLE_ID}
                description={labels.guidePageDescription}
            >
                <WorkspacePageHeaderIcon name="BookOpen"/>
            </WorkspacePageHeader>
            <View style={styles.sections}>
                <GuideBeginnerSection controller={controller}/>
                {controller.ollamaGuideVisible ? (
                    <View style={styles.card} accessibilityLabelledBy={GUIDE_TERMINAL_TITLE_ID}>
                        <View style={styles.cardTitleRow}>
                            <Icon name="Terminal" size={18} color={GUIDE_TEXT_COLOR}/>
                            <Text nativeID={GUIDE_TERMINAL_TITLE_ID} accessibilityRole="header" style={styles.cardTitle}>{labels.guideTerminalTitle}</Text>
                        </View>
                        <View style={styles.hostPlatform}>
                            <Text nativeID={GUIDE_HOST_PLATFORM_TITLE_ID} style={styles.hostPlatformTitle}>{labels.ollamaHostPlatformTitle}</Text>
                            <View accessibilityRole="radiogroup" accessibilityLabelledBy={GUIDE_HOST_PLATFORM_TITLE_ID} style={styles.hostPlatformOptions}>
                                {OLLAMA_HOST_PLATFORMS.map((platform) => {
                                    const selected = controller.ollamaHostPlatform === platform;
                                    return (
                                        <Pressable
                                            key={platform}
                                            accessibilityRole="radio"
                                            accessibilityState={{ checked: selected }}
                                            onPress={() => controller.setOllamaHostPlatform(platform)}
                                            style={({ pressed }) => [
                                                styles.hostPlatformOption,
                                                selected && styles.hostPlatformOptionSelected,
                                                pressed && styles.hostPlatformOptionPressed,
                                            ]}
                                        >
                                            <Text style={[styles.hostPlatformOptionText, selected && styles.hostPlatformOptionTextSelected]}>{platform}</Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>
                        <View accessibilityRole="list" style={styles.terminalSteps}>
                            {labels.guideTerminalSteps[resolveOllamaCommandShell(controller.ollamaHostPlatform)].map((step, index) => (
                                <View key={step} style={styles.terminalStep}>
                                    <Text style={styles.terminalStepNumber}>{index + 1}.</Text>
                                    <Text style={styles.terminalStepText}>{step}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                ) : null}
                {controller.ollamaGuideVisible ? (
                    <View style={styles.card}>
                        <OllamaConnectionGuide
                            library={controller.modelCatalog?.ollama ?? null}
                            checking={controller.modelCatalogRefreshing}
                            introVisible={true}
                            platform={controller.ollamaHostPlatform}
                            labels={labels}
                            onCheck={controller.refreshModelCatalog}
                        />
                    </View>
                ) : null}
            </View>
        </WorkspaceSurface>
    );
}

const styles = StyleSheet.create({
    sections: {
        width: '100%',
        maxWidth: 1440,
        alignSelf: 'center',
        gap: 18,
    },
    card: {
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(72, 70, 95, 0.18)',
        borderRadius: 8,
        backgroundColor: '#fffaf1',
    },
    cardTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    cardTitle: {
        flexShrink: 1,
        color: GUIDE_TEXT_COLOR,
        fontSize: 17.6,
    },
    hostPlatform: {
        gap: 6,
        marginBottom: 10,
    },
    hostPlatformTitle: {
        color: GUIDE_TEXT_COLOR,
        fontSize: 14,
        fontWeight: '800',
    },
    hostPlatformOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    hostPlatformOption: {
        flexGrow: 1,
        flexBasis: 0,
        minWidth: 88,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: 'rgba(89, 82, 115, 0.28)',
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.78)',
    },
    hostPlatformOptionSelected: {
        borderColor: '#7660bb',
        backgroundColor: 'rgba(118, 96, 187, 0.14)',
    },
    hostPlatformOptionPressed: {
        backgroundColor: 'rgba(118, 96, 187, 0.08)',
    },
    hostPlatformOptionText: {
        color: '#4d5263',
        fontSize: 14,
        fontWeight: '700',
    },
    hostPlatformOptionTextSelected: {
        color: '#4b3a8c',
        fontWeight: '800',
    },
    terminalSteps: {
        gap: 6,
    },
    terminalStep: {
        flexDirection: 'row',
    },
    terminalStepNumber: {
        width: 20,
        color: '#4d5263',
        fontSize: 13.76,
        lineHeight: 22,
    },
    terminalStepText: {
        flex: 1,
        color: '#4d5263',
        fontSize: 13.76,
        lineHeight: 22,
    },
});
