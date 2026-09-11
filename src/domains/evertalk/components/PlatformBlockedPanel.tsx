import { MonitorSmartphone } from 'lucide-react';
import type { PlatformBlockedPanelProps } from '../types';

export function PlatformBlockedPanel({ reason, labels }: PlatformBlockedPanelProps) {
    return (
        <div className="ever-platform-blocked" role="alert">
            <div className="ever-platform-blocked__card">
                <MonitorSmartphone aria-hidden="true" size={40}/>
                <h1>{labels.platformBlockedTitle}</h1>
                <p>{labels.platformBlockedMessages[reason]}</p>
                <small>{labels.platformBlockedHint}</small>
            </div>
        </div>
    );
}
