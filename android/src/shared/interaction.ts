import { useEffect, useState } from 'react';
import { AccessibilityInfo, type NativeTouchEvent } from 'react-native';

export interface TouchPoint {
    x: number;
    y: number;
}

export function touchFrameOrigin(touch: NativeTouchEvent): TouchPoint {
    return { x: touch.pageX - touch.locationX, y: touch.pageY - touch.locationY };
}

export function useReducedMotion(): boolean {
    const [reducedMotion, setReducedMotion] = useState(false);
    useEffect(() => {
        let active = true;
        void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
            if (active) {
                setReducedMotion(enabled);
            }
        });
        const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
            setReducedMotion(enabled);
        });
        return () => {
            active = false;
            subscription.remove();
        };
    }, []);
    return reducedMotion;
}
