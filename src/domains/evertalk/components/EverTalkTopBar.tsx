import type { WorkspacePageProps } from '../types';
import { EnvironmentLayer } from './EnvironmentLayer';

export function EverTalkTopBar({ controller }: WorkspacePageProps) {
    function openProactiveNotification(personaId: string) {
        const spirit = controller.allSpirits.find((candidate) => candidate.id === personaId);
        if (spirit) void controller.navigateWorkspace('chat').then(() => controller.selectSpirit(spirit));
    }
    return (
        <EnvironmentLayer
            settings={controller.appSettings}
            session={controller.userSession}
            savior={controller.saviorProfile}
            environment={controller.deviceEnvironment}
            labels={controller.labels}
            gatePending={controller.gatePending}
            notificationItems={controller.proactiveNotifications}
            onOpenNotification={openProactiveNotification}
            activeView={controller.workspaceView}
            onNavigate={(view) => void controller.navigateWorkspace(view)}
            onOpenLobby={controller.openLobby}
            onOpenSettings={() => void controller.openSettings()}
            onOpenSaviorProfile={controller.gatePending ? undefined : controller.openSaviorProfile}
            onRenameSavior={controller.setSaviorName}
        />
    );
}
