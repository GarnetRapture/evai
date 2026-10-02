import { Linking, Pressable, StyleSheet, Text, ToastAndroid } from 'react-native';
import { formatUnknownError } from '../../../../../src/domains/evertalk/logic';
import type { GuideStepAction } from '../../../../../src/domains/evertalk/types';
import { EVAI_REPOSITORY_URL } from '../../../../../src/shared/host/types';
import { Icon, type IconName } from '../../../shared/icons';
import { HUGGING_FACE_OLLAMA_GUIDE_URL, OLLAMA_DOWNLOAD_URL, OLLAMA_MODEL_LIBRARY_URL } from '../../ollama';
import type { AndroidLabels } from '../labels';
import type { EverTalkController } from '../types';

const ACTION_TEXT_COLOR = '#26293b';

export interface GuideStepActionButtonProps {
    action: GuideStepAction;
    controller: EverTalkController;
}

interface GuideActionPressableProps {
    role: 'button' | 'link';
    icon: IconName;
    label: string;
    disabled: boolean;
    spinning: boolean;
    onPress: () => void;
}

function GuideActionPressable({ role, icon, label, disabled, spinning, onPress }: GuideActionPressableProps) {
    return (
        <Pressable
            accessibilityRole={role}
            accessibilityLabel={label}
            accessibilityState={{ disabled, busy: spinning }}
            disabled={disabled}
            onPress={onPress}
            style={({ pressed }) => [styles.action, pressed ? styles.actionPressed : null, disabled ? styles.actionDisabled : null]}
        >
            <Icon name={icon} size={14} color={ACTION_TEXT_COLOR} spinning={spinning}/>
            <Text style={styles.actionText}>{label}</Text>
        </Pressable>
    );
}

function openExternalLink(href: string, labels: AndroidLabels) {
    Linking.openURL(href).catch((error: unknown) => {
        ToastAndroid.show(formatUnknownError(error, labels), ToastAndroid.LONG);
    });
}

export function GuideStepActionButton({ action, controller }: GuideStepActionButtonProps) {
    const { labels } = controller;
    const title = labels.guideActionLabels[action];
    if (action === 'open_ollama_download' || action === 'open_ollama_library' || action === 'open_hugging_face_guide' || action === 'open_repository') {
        const href = action === 'open_ollama_download' ? OLLAMA_DOWNLOAD_URL
            : action === 'open_ollama_library' ? OLLAMA_MODEL_LIBRARY_URL
                : action === 'open_hugging_face_guide' ? HUGGING_FACE_OLLAMA_GUIDE_URL
                    : EVAI_REPOSITORY_URL;
        return (
            <GuideActionPressable
                role="link"
                icon={action === 'open_ollama_download' ? 'Download' : 'ExternalLink'}
                label={title}
                disabled={false}
                spinning={false}
                onPress={() => openExternalLink(href, labels)}
            />
        );
    }
    if (action === 'refresh_status') {
        return (
            <GuideActionPressable
                role="button"
                icon="RefreshCw"
                label={controller.modelCatalogRefreshing ? labels.checking : title}
                disabled={controller.modelCatalogRefreshing}
                spinning={controller.modelCatalogRefreshing}
                onPress={() => void controller.refreshModelCatalog()}
            />
        );
    }
    if (action === 'open_settings') {
        return (
            <GuideActionPressable
                role="button"
                icon="Settings"
                label={title}
                disabled={false}
                spinning={false}
                onPress={() => void controller.openSettings()}
            />
        );
    }
    if (action === 'choose_model') {
        return (
            <GuideActionPressable
                role="button"
                icon="BookOpen"
                label={title}
                disabled={false}
                spinning={false}
                onPress={() => void (controller.gatePending ? controller.navigateWorkspace('chat') : controller.openSettings())}
            />
        );
    }
    return (
        <GuideActionPressable
            role="button"
            icon="MessageCircle"
            label={title}
            disabled={false}
            spinning={false}
            onPress={() => void controller.navigateWorkspace('chat')}
        />
    );
}

const styles = StyleSheet.create({
    action: {
        minHeight: 40,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: 'rgba(72, 70, 95, 0.2)',
        borderRadius: 8,
        backgroundColor: '#faf7f1',
    },
    actionPressed: {
        backgroundColor: '#efe9dd',
    },
    actionDisabled: {
        opacity: 0.5,
    },
    actionText: {
        color: ACTION_TEXT_COLOR,
        fontSize: 12.8,
        fontWeight: '700',
    },
});
