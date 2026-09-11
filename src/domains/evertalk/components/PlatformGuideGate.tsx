import { useState } from 'react';
import type { PlatformGuideGateProps } from '../types';
import { PlatformGuideNotice } from './PlatformGuideNotice';

export function PlatformGuideGate({ labels, onAcknowledge }: PlatformGuideGateProps) {
    const [acknowledged, setAcknowledged] = useState(false);
    return (
        <div className="ever-settings-overlay ever-setup-wizard" role="dialog" aria-modal="true">
            <div className="ever-setup-wizard__modal">
                <div className="ever-setup-wizard__body">
                    <PlatformGuideNotice labels={labels} acknowledged={acknowledged} onAcknowledgedChange={setAcknowledged}/>
                    <button type="button" className="ever-setup-wizard__next" disabled={!acknowledged} onClick={() => void onAcknowledge()}>
                        {labels.platformGuideConfirm}
                    </button>
                </div>
            </div>
        </div>
    );
}
