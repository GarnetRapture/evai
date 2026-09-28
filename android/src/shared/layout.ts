import { useSyncExternalStore } from 'react';
import { useWindowDimensions, type EmitterSubscription } from 'react-native';
import { NATIVE_EVENT, subscribeNativeEvent, type WindowInsetsEvent } from './native/events';
import NativeEvaiDevice from './native/specs/NativeEvaiDevice';

export type WindowInsets = WindowInsetsEvent;
export type LayoutMode = 'compact' | 'expanded';

export const EXPANDED_LAYOUT_MIN_WIDTH = 900;

const windowInsetsListeners = new Set<() => void>();
let windowInsetsSnapshot: WindowInsets | null = null;
let windowInsetsSubscription: EmitterSubscription | null = null;

function readNativeWindowInsets(): WindowInsets {
    return JSON.parse(NativeEvaiDevice.readWindowInsets()) as WindowInsets;
}

function readWindowInsetsSnapshot(): WindowInsets {
    if (windowInsetsSnapshot === null) {
        windowInsetsSnapshot = readNativeWindowInsets();
    }
    return windowInsetsSnapshot;
}

function subscribeWindowInsets(listener: () => void): () => void {
    windowInsetsListeners.add(listener);
    if (windowInsetsSubscription === null) {
        windowInsetsSubscription = subscribeNativeEvent(NATIVE_EVENT.windowInsets, (event) => {
            windowInsetsSnapshot = event;
            for (const notify of windowInsetsListeners) {
                notify();
            }
        });
        windowInsetsSnapshot = readNativeWindowInsets();
    }
    return () => {
        windowInsetsListeners.delete(listener);
        if (windowInsetsListeners.size === 0 && windowInsetsSubscription !== null) {
            windowInsetsSubscription.remove();
            windowInsetsSubscription = null;
            windowInsetsSnapshot = null;
        }
    };
}

export function useWindowInsets(): WindowInsets {
    return useSyncExternalStore(subscribeWindowInsets, readWindowInsetsSnapshot);
}

export function bottomWindowInset(insets: WindowInsets): number {
    return Math.max(insets.bottom, insets.ime);
}

export function useLayoutMode(): LayoutMode {
    const { width } = useWindowDimensions();
    return width >= EXPANDED_LAYOUT_MIN_WIDTH ? 'expanded' : 'compact';
}
