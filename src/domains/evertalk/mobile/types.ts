import type { ChatMessage } from '../../chat';
import type { EverTalkController } from '../types';

export type MobileTab = 'roster' | 'chat' | 'menu';

export interface MobileScreenProps {
    controller: EverTalkController;
}

export interface MobileRosterScreenProps extends MobileScreenProps {
    onOpenChat: (spiritId: string) => Promise<void>;
}

export interface MobileChatScreenProps extends MobileScreenProps {
    onBrowseRoster: () => void;
}

export interface MobileMessageBubbleProps {
    message: ChatMessage;
    spiritName: string;
    avatarCandidates: string[];
    showReasoning: boolean;
    deleteLabel: string;
    innerThoughtsLabel: string;
    showActionStatus: boolean;
    onDelete: (messageId: string) => Promise<void>;
}
