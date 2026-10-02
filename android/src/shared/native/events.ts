import { DeviceEventEmitter, type EmitterSubscription } from 'react-native';

export const NATIVE_EVENT = {
    llmChunk: 'EvaiLlmChunk',
    llmTransfer: 'EvaiLlmTransfer',
    assetProgress: 'EvaiAssetProgress',
    audioEnded: 'EvaiAudioEnded',
    audioError: 'EvaiAudioError',
    windowInsets: 'EvaiWindowInsets',
} as const;

export interface LlmChunkEvent {
    request_id: string;
    text: string;
}

export interface LlmTransferEvent {
    request_id: string;
    loaded_bytes: number;
    total_bytes: number;
    ratio: number;
}

export interface AssetProgressEvent {
    request_id: string;
    completed: number;
    total: number;
    bytes: number;
    total_bytes: number;
    current: string;
}

export interface AudioChannelEvent {
    channel: string;
    message?: string;
}

export interface WindowInsetsEvent {
    top: number;
    bottom: number;
    left: number;
    right: number;
    ime: number;
}

interface NativeEventPayloads {
    [NATIVE_EVENT.llmChunk]: LlmChunkEvent;
    [NATIVE_EVENT.llmTransfer]: LlmTransferEvent;
    [NATIVE_EVENT.assetProgress]: AssetProgressEvent;
    [NATIVE_EVENT.audioEnded]: AudioChannelEvent;
    [NATIVE_EVENT.audioError]: AudioChannelEvent;
    [NATIVE_EVENT.windowInsets]: WindowInsetsEvent;
}

export type NativeEventName = keyof NativeEventPayloads;

export function subscribeNativeEvent<Name extends NativeEventName>(
    name: Name,
    listener: (event: NativeEventPayloads[Name]) => void,
): EmitterSubscription {
    return DeviceEventEmitter.addListener(name, listener);
}

export function subscribeRequestEvent<Name extends typeof NATIVE_EVENT.llmChunk | typeof NATIVE_EVENT.llmTransfer | typeof NATIVE_EVENT.assetProgress>(
    name: Name,
    requestId: string,
    listener: (event: NativeEventPayloads[Name]) => void,
): EmitterSubscription {
    return subscribeNativeEvent(name, (event) => {
        if (event.request_id === requestId) {
            listener(event);
        }
    });
}
