import { useEffect, useEffectEvent, useState } from 'react';
import { Animated, BackHandler, Easing, Image, Pressable, StyleSheet, Text, View, useAnimatedValue, useWindowDimensions } from 'react-native';
import { buildMoodAccent } from '../../../../../src/domains/evertalk/logic';
import { EVERTALK_UI_ASSETS } from '../../../../../src/domains/evertalk/uiAssets';
import { resolveAssetUri } from '../../../shared/assets';
import { clampSize, useLayoutMode, useWindowInsets } from '../../../shared/layout';
import type { AssetPreparationState } from '../../assets/types';
import { parseSpiritDetail } from '../../persona';
import { MAX_PREFERRED_PERSONAS } from '../../settings';
import { useEverTalkController } from '../hooks';
import { BackgroundGalleryPanel } from './BackgroundGalleryPanel';
import { ChatStage } from './ChatStage';
import { EverTalkSettingsPanel } from './EverTalkSettingsPanel';
import { EverTalkTopBar } from './EverTalkTopBar';
import { FamiliarityDetailPanel } from './FamiliarityDetailPanel';
import { GuidePage } from './GuidePage';
import { LobbyScreen } from './LobbyScreen';
import { ModuleManagementPanel } from './ModuleManagementPanel';
import { PlatformBlockedPanel } from './PlatformBlockedPanel';
import { PlatformGuideGate } from './PlatformGuideGate';
import { ProfileDetailPanel } from './ProfileDetailPanel';
import { SaviorProfilePanel } from './SaviorProfilePanel';
import { SetupProgressPanel } from './SetupProgressPanel';
import { SetupWizard } from './SetupWizard';
import { SpiritProfilePanel } from './SpiritProfilePanel';
import { SpiritRoster } from './SpiritRoster';
import { StoryPage } from './StoryPage';
import { WorkspacePage } from './WorkspacePages';

const LOADING_RING_DURATION_MS = 900;
const LOBBY_FAB_BOTTOM_GAP = 14;
const LOBBY_FAB_BAND_EXTRA = 28;

export interface EverTalkAppProps {
    initialAssetPreparation: AssetPreparationState | null;
}

function LoadingRing() {
    const rotation = useAnimatedValue(0);
    useEffect(() => {
        const loop = Animated.loop(Animated.timing(rotation, {
            toValue: 1,
            duration: LOADING_RING_DURATION_MS,
            easing: Easing.linear,
            useNativeDriver: true,
        }));
        loop.start();
        return () => loop.stop();
    }, [rotation]);
    return (
        <Animated.View
            style={[
                styles.loadingRing,
                { transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] },
            ]}
        />
    );
}

export function EverTalkApp({ initialAssetPreparation }: EverTalkAppProps) {
    const controller = useEverTalkController(initialAssetPreparation);
    const insets = useWindowInsets();
    const layoutMode = useLayoutMode();
    const { height } = useWindowDimensions();
    const [composerFocused, setComposerFocused] = useState(false);
    const handleBackPress = useEffectEvent((): boolean => {
        if (controller.lobbyOpen) {
            controller.closeLobby();
            return true;
        }
        if (!controller.gatePending && controller.workspaceView !== 'chat') {
            void controller.navigateWorkspace('chat');
            return true;
        }
        return false;
    });
    useEffect(() => {
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => handleBackPress());
        return () => subscription.remove();
    }, []);

    if (controller.platformSupport !== 'supported') {
        return <PlatformBlockedPanel reason={controller.platformSupport} labels={controller.labels}/>;
    }
    if (controller.appInitializing && !controller.setupInProgress) {
        return (
            <View style={styles.loading}>
                <LoadingRing/>
                <Text style={styles.loadingText}>{controller.labels.appLoading}</Text>
            </View>
        );
    }
    if (controller.setupInProgress) {
        return (
            <View style={styles.root}>
                <SetupProgressPanel open={true} progress={controller.setupProgress} labels={controller.labels}/>
            </View>
        );
    }
    if (controller.gatePending) {
        return (
            <View style={styles.root}>
                <EverTalkTopBar controller={controller}/>
                <View style={styles.content}>
                    {controller.workspaceView === 'guide' ? (
                        <GuidePage controller={controller}/>
                    ) : controller.workspaceView === 'story' ? (
                        <StoryPage controller={controller}/>
                    ) : controller.setupStage !== 'done' ? (
                        <SetupWizard
                            appPlatform={controller.appPlatform}
                            language={controller.appLanguage}
                            labels={controller.labels}
                            storageKind={controller.storageKind}
                            llmStatus={controller.llmStatus}
                            activeModelId={controller.appSettings?.active_model ?? ''}
                            modelCatalog={controller.modelCatalog}
                            modelCatalogError={controller.modelCatalogError}
                            modelCatalogRefreshing={controller.modelCatalogRefreshing}
                            modelLoadingId={controller.modelLoadingId}
                            onSelectChatModel={controller.selectChatModel}
                            onRefreshModelCatalog={controller.refreshModelCatalog}
                            onOpenGuide={controller.openGuide}
                            platformGuideConfirmed={controller.platformGuideConfirmed}
                            onPlatformGuideConfirmedChange={controller.setPlatformGuideConfirmed}
                            onSelectLanguage={controller.setLanguage}
                            onCompleteSetup={controller.completeSetup}
                        />
                    ) : (
                        <PlatformGuideGate
                            appPlatform={controller.appPlatform}
                            labels={controller.labels}
                            onAcknowledge={controller.acknowledgePlatformGuide}
                        />
                    )}
                </View>
                <EverTalkSettingsPanel controller={controller}/>
            </View>
        );
    }

    const familiaritySpirit = controller.activeFamiliarityEntry
        ? controller.filteredSpirits.find((spirit) => spirit.id === controller.activeFamiliarityEntry?.persona_id)
        : undefined;
    const familiarityDetail = familiaritySpirit ? parseSpiritDetail(familiaritySpirit, controller.appLanguage) : null;
    async function openFamiliarityChat(personaId: string) {
        const spirit = controller.filteredSpirits.find((candidate) => candidate.id === personaId);
        if (spirit) {
            await controller.selectSpirit(spirit);
        }
        controller.closeFamiliarityDetail();
    }
    const keyboardOpen = insets.ime > insets.bottom;
    const fabHeight = clampSize(52, height * 0.07, 68);
    const chatShellBottom = keyboardOpen ? insets.ime : insets.bottom + fabHeight + LOBBY_FAB_BAND_EXTRA;
    const rosterHidden = layoutMode === 'compact' && keyboardOpen && composerFocused;

    return (
        <View style={styles.root}>
            <EverTalkTopBar controller={controller}/>
            <View style={styles.content}>
                {controller.workspaceView === 'chat' ? (
                    <View
                        style={[
                            styles.appShell,
                            layoutMode === 'expanded' ? styles.appShellExpanded : styles.appShellCompact,
                            { paddingLeft: insets.left, paddingRight: insets.right, paddingBottom: chatShellBottom },
                        ]}
                    >
                        {rosterHidden ? null : <SpiritRoster
                            spirits={controller.filteredSpirits}
                            activeSpiritId={controller.activeSpiritId}
                            defaultPersonaId={controller.defaultPersonaId}
                            preferredPersonaIds={controller.preferredPersonaIds}
                            searchQuery={controller.searchQuery}
                            loadError={controller.personaLoadError}
                            activeTab={controller.activeRosterTab}
                            collapsed={controller.rosterCollapsed}
                            bondRanking={controller.bondRanking}
                            bondRankingLoading={controller.bondRankingLoading}
                            familiarityList={controller.familiarityList}
                            familiarityLoading={controller.familiarityLoading}
                            labels={controller.labels}
                            appLanguage={controller.appLanguage}
                            activeSessionIds={controller.activeSessionIds}
                            personaSkinIds={controller.personaSkinIds}
                            proactiveUnreadCounts={controller.proactiveUnreadCounts}
                            onSearchChange={controller.setSearchQuery}
                            onSelect={controller.selectSpirit}
                            onToggleDefault={controller.toggleDefaultSpirit}
                            onTabChange={controller.changeRosterTab}
                            onToggleCollapsed={() => controller.setRosterCollapsed(!controller.rosterCollapsed)}
                            onOpenFamiliarity={controller.openFamiliarityDetail}
                        />}
                        <ChatStage
                            activeDetail={controller.activeDetail}
                            activeStageTab={controller.activeStageTab}
                            activeRoom={controller.activeRoom}
                            llmStatus={controller.llmStatus}
                            messages={controller.messages}
                            previousRooms={controller.previousRooms}
                            previousRoomsLoading={controller.previousRoomsLoading}
                            onStartNewChat={controller.startNewChat}
                            onLoadPreviousRooms={controller.loadPreviousRooms}
                            onSwitchToRoom={controller.switchToRoom}
                            onDeleteMessage={controller.deleteChatMessage}
                            onDeleteRoom={controller.deleteChatRoom}
                            inputText={controller.inputText}
                            isTyping={controller.isTyping}
                            streamingText={controller.streamingText}
                            streamingRequestId={controller.streamingRequestId}
                            onCancelStreaming={controller.cancelStreaming}
                            onInputChange={controller.setInputText}
                            onSendMessage={controller.sendMessage}
                            onStageTabChange={controller.setActiveStageTab}
                            labels={controller.labels}
                            onOpenProfileDetail={controller.openProfileDetail}
                            showReasoning={controller.appSettings?.show_reasoning ?? true}
                            activeSkinId={controller.activeSkinId}
                            moodAccent={buildMoodAccent(
                                controller.memoryOverview?.entries.find((entry) => entry.persona_id === controller.activeSpiritId)?.emotion ?? null,
                            )}
                            onOpenProfilePanel={layoutMode === 'compact' ? () => controller.setProfileCollapsed(false) : null}
                            onComposerFocusChange={setComposerFocused}
                        />
                        <SpiritProfilePanel
                            activeDetail={controller.activeDetail}
                            activeSpiritId={controller.activeSpiritId}
                            activeSkinId={controller.activeSkinId}
                            onSelectSkin={controller.selectSkin}
                            collapsed={controller.profileCollapsed}
                            systemStatuses={controller.systemStatuses}
                            localStatus={controller.localStatus}
                            memoryInsight={controller.memoryInsight}
                            memoryInsightLoading={controller.memoryInsightLoading}
                            memoryOverview={controller.memoryOverview}
                            contextGraph={controller.contextGraph}
                            contextGraphLoading={controller.contextGraphLoading}
                            labels={controller.labels}
                            onToggleCollapsed={() => controller.setProfileCollapsed(!controller.profileCollapsed)}
                            onOpenSettings={controller.openSettings}
                            onOpenModuleManagement={controller.openModuleManagement}
                            onOpenBackgroundGallery={controller.openBackgroundGallery}
                            onOpenProfileDetail={controller.openProfileDetail}
                        />
                    </View>
                ) : (
                    <WorkspacePage controller={controller}/>
                )}
                {controller.lobbyOpen && (
                    <View style={styles.lobbyOverlay}>
                        <LobbyScreen
                            spirits={controller.lobbySpirits}
                            allSpirits={controller.allSpirits}
                            appLanguage={controller.appLanguage}
                            familiarityList={controller.familiarityList}
                            background={controller.lobbyBackground}
                            saviorProfile={controller.saviorProfile}
                            memoryOverview={controller.memoryOverview}
                            memoryOverviewLoading={controller.memoryOverviewLoading}
                            maxPreferredSlots={MAX_PREFERRED_PERSONAS}
                            labels={controller.labels}
                            onEnterChat={controller.enterChatFromLobby}
                            onOpenBackgroundPicker={controller.openLobbyBackgroundPicker}
                            onOpenRoster={controller.closeLobby}
                            onOpenSaviorProfile={controller.openSaviorProfile}
                            onRenameSavior={controller.setSaviorName}
                        />
                    </View>
                )}
                {controller.workspaceView === 'chat' && !keyboardOpen && (
                    <View pointerEvents="box-none" style={[styles.lobbyFabDock, { bottom: insets.bottom + LOBBY_FAB_BOTTOM_GAP }]}>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={controller.labels.lobby}
                            accessibilityState={{ selected: controller.lobbyOpen }}
                            onPress={controller.lobbyOpen ? controller.closeLobby : controller.openLobby}
                            style={({ pressed }) => [styles.lobbyFab, { height: fabHeight }, pressed && styles.lobbyFabPressed]}
                        >
                            <View style={styles.lobbyFabIcon}>
                                <Image source={{ uri: resolveAssetUri(EVERTALK_UI_ASSETS.lobbyPointer) }} resizeMode="contain" style={styles.lobbyFabIconImage}/>
                            </View>
                            <Text style={styles.lobbyFabText}>{controller.labels.lobby}</Text>
                        </Pressable>
                    </View>
                )}
            </View>
            <EverTalkSettingsPanel controller={controller}/>
            <ModuleManagementPanel
                open={controller.moduleManagementOpen}
                modules={controller.importedModules}
                moduleBusy={controller.moduleBusy}
                moduleError={controller.moduleError}
                moduleMessage={controller.moduleMessage}
                labels={controller.labels}
                onClose={controller.closeModuleManagement}
                onImportModule={controller.importModule}
                onSetModuleEnabled={controller.setModuleEnabled}
                onUpdateModuleControls={controller.updateModuleControls}
                onDeleteModule={controller.deleteModule}
            />
            <BackgroundGalleryPanel
                open={controller.backgroundGalleryOpen}
                labels={controller.labels}
                onClose={controller.closeBackgroundGallery}
            />
            <BackgroundGalleryPanel
                open={controller.lobbyBackgroundPickerOpen}
                labels={controller.labels}
                onClose={controller.closeLobbyBackgroundPicker}
                onSelectBackground={controller.setLobbyBackground}
                selectedBackground={controller.lobbyBackground}
            />
            <ProfileDetailPanel
                open={controller.profileDetailOpen}
                activeDetail={controller.activeDetail}
                labels={controller.labels}
                onClose={controller.closeProfileDetail}
            />
            <FamiliarityDetailPanel
                open={controller.familiarityDetailOpen}
                entry={controller.activeFamiliarityEntry}
                detail={familiarityDetail}
                labels={controller.labels}
                onClose={controller.closeFamiliarityDetail}
                onOpenChat={openFamiliarityChat}
            />
            <SaviorProfilePanel
                open={controller.saviorProfileOpen}
                profile={controller.saviorProfile}
                memoryInsight={controller.memoryInsight}
                memoryInsightLoading={controller.memoryInsightLoading}
                eventStickers={controller.eventStickers}
                labels={controller.labels}
                onClose={controller.closeSaviorProfile}
                onRenameSavior={controller.setSaviorName}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#171b2a',
    },
    content: {
        flex: 1,
        position: 'relative',
    },
    loading: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        backgroundColor: '#45445f',
    },
    loadingRing: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 3,
        borderColor: 'rgba(255, 255, 255, 0.26)',
        borderTopColor: '#ffffff',
    },
    loadingText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
    appShell: {
        flex: 1,
        overflow: 'hidden',
        backgroundColor: '#171b2a',
    },
    appShellCompact: {
        flexDirection: 'column',
    },
    appShellExpanded: {
        flexDirection: 'row',
    },
    lobbyOverlay: {
        ...StyleSheet.absoluteFill,
        zIndex: 8,
    },
    lobbyFabDock: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 9,
        alignItems: 'center',
    },
    lobbyFab: {
        minWidth: 150,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingHorizontal: 16,
        filter: 'drop-shadow(0px 8px 22px rgba(20, 12, 60, 0.4))',
    },
    lobbyFabPressed: {
        transform: [{ scale: 0.96 }],
    },
    lobbyFabIcon: {
        width: 28,
        height: 28,
        filter: 'drop-shadow(0px 1px 3px rgba(0, 0, 0, 0.45))',
    },
    lobbyFabIconImage: {
        width: '100%',
        height: '100%',
    },
    lobbyFabText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '800',
        textShadowColor: 'rgba(0, 0, 0, 0.55)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
});
