import { listPersonaMaintenanceTasks, subscribePersonaMaintenance } from './maintenance';
import { EVERTALK_SESSION_TITLE } from './prompt';
import { chatRepository } from './repository';
import { chatService } from './service';
import type {
    ChatMessage,
    ChatRoom,
    ChatSendRequest,
    PersonaContextGraph,
    PersonaMaintenanceListener,
    PersonaMaintenanceTask,
    PersonaMemoryInsight,
    PersonaMemoryOverview,
    ProactiveGenerationOptions,
} from './types';

export const chatClient = {
    async createRoom(title: string): Promise<ChatRoom> {
        return chatService.createSessionRoom(title, null);
    },
    async createSessionRoom(title: string, personaId: string): Promise<ChatRoom> {
        return chatService.createSessionRoom(title, personaId);
    },
    async getEverTalkSessionRoom(): Promise<ChatRoom> {
        return chatService.getOrCreateEverTalkSessionRoom();
    },
    async getLatestSessionRoom(personaId: string): Promise<ChatRoom | null> {
        return chatRepository.findLatestRoomByPersona(personaId);
    },
    async listRooms(): Promise<ChatRoom[]> {
        return chatRepository.listRooms();
    },
    async listRoomsForPersona(personaId: string): Promise<ChatRoom[]> {
        return chatRepository.listRoomsByPersona(personaId);
    },
    async startNewRoom(personaId: string): Promise<ChatRoom> {
        return chatService.createSessionRoom(EVERTALK_SESSION_TITLE, personaId);
    },
    async deleteRoom(roomId: string): Promise<void> {
        await chatRepository.deleteRoom(roomId);
    },
    async deleteMessage(messageId: string): Promise<void> {
        await chatRepository.deleteMessage(messageId);
    },
    async listMessages(roomId: string): Promise<ChatMessage[]> {
        return chatRepository.listMessages(roomId);
    },
    async listMessagesForPersona(roomId: string, personaId: string): Promise<ChatMessage[]> {
        return chatRepository.listMessagesForPersona(roomId, personaId);
    },
    async focusPersonaSession(personaId: string): Promise<void> {
        await chatService.focusPersonaSession(personaId);
    },
    async getPersonaMemoryInsight(personaId: string): Promise<PersonaMemoryInsight> {
        return chatService.getPersonaMemoryInsight(personaId);
    },
    async getPersonaMemoryOverview(): Promise<PersonaMemoryOverview> {
        return chatService.getPersonaMemoryOverview();
    },
    async getPersonaContextGraph(personaId: string, roomId: string): Promise<PersonaContextGraph> {
        return chatService.getPersonaContextGraph(personaId, roomId);
    },
    subscribeMaintenance(listener: PersonaMaintenanceListener): () => void {
        return subscribePersonaMaintenance(listener);
    },
    listMaintenanceTasks(): PersonaMaintenanceTask[] {
        return listPersonaMaintenanceTasks();
    },
    async sendMessage(request: ChatSendRequest): Promise<ChatMessage> {
        return chatService.sendMessage(request);
    },
    async tryGenerateProactiveMessage(options?: ProactiveGenerationOptions): Promise<ChatMessage | null> {
        return chatService.tryGenerateProactiveMessage(options);
    },
    async listProactiveUnreadCounts(): Promise<Record<string, number>> {
        return chatRepository.listProactiveUnreadCounts();
    },
    async markProactiveMessagesRead(personaId: string): Promise<void> {
        await chatRepository.markProactiveMessagesRead(personaId, new Date().toISOString());
    },
};
