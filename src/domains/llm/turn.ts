import type { OnDeviceGenerationRequest, OnDeviceTextMessage, OnDeviceTurn, OnDeviceTurnContextSection } from './types';

const TURN_SECTION_SEPARATOR = '\n\n';

// [핵심 아키텍처 · 수정 금지] 턴 메시지 조립 순서. 사용자의 명시 지시 없이 변경하지 않는다. (AI_TRACKING.md 5A L-1)
export function composeOnDeviceTurnContent(turn: OnDeviceTurn, includedSections: ReadonlySet<OnDeviceTurnContextSection>, behaviorInstruction: string): string {
    const context = turn.context_sections
        .filter((section) => includedSections.has(section) && section.text.length > 0)
        .map((section) => section.text)
        .join(TURN_SECTION_SEPARATOR);
    const heading = `[${turn.heading}]\n${turn.body}`;
    return [context, heading, behaviorInstruction.trim()]
        .filter((part) => part.length > 0)
        .join(TURN_SECTION_SEPARATOR);
}

export function composeOnDeviceTurnMessage(turn: OnDeviceTurn, includedSections: ReadonlySet<OnDeviceTurnContextSection>, behaviorInstruction: string): OnDeviceTextMessage {
    return { role: 'user', content: composeOnDeviceTurnContent(turn, includedSections, behaviorInstruction) };
}

export function composeOnDeviceConversationMessages(request: OnDeviceGenerationRequest): OnDeviceTextMessage[] {
    return [
        ...request.prefix_messages,
        ...request.history_messages,
        composeOnDeviceTurnMessage(request.turn, new Set(request.turn.context_sections), request.behavior_instruction),
    ];
}
