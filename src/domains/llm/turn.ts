import type { OnDeviceGenerationRequest, OnDeviceTextMessage, OnDeviceTurn, OnDeviceTurnContextSection } from './types';

const TURN_SECTION_SEPARATOR = '\n\n';

export function composeOnDeviceTurnContent(turn: OnDeviceTurn, includedSections: ReadonlySet<OnDeviceTurnContextSection>, behaviorInstruction: string): string {
    const context = turn.context_sections
        .filter((section) => includedSections.has(section) && section.text.length > 0)
        .map((section) => section.text)
        .join(TURN_SECTION_SEPARATOR);
    const heading = `[${turn.heading}]\n${turn.body}`;
    return [context, behaviorInstruction.trim(), heading]
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
