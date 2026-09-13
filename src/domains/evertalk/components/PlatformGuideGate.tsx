import { useState } from 'react';
import type { PlatformGuideGateProps } from '../types';
import { OllamaConnectionGuide } from './OllamaConnectionGuide';
import { PlatformGuideNotice } from './PlatformGuideNotice';

export function PlatformGuideGate({ appPlatform, labels, ollamaGuideVisible, ollamaConnection, ollamaConnectionChecking, devicePlatform, onCheckOllamaConnection, onAcknowledge }: PlatformGuideGateProps) {
    const [acknowledged, setAcknowledged] = useState(false);
    return (
        <div className="ever-settings-overlay ever-setup-wizard" role="dialog" aria-modal="true">
            <div className="ever-setup-wizard__modal">
                <div className="ever-setup-wizard__body">
                    <PlatformGuideNotice appPlatform={appPlatform} labels={labels} acknowledged={acknowledged} onAcknowledgedChange={setAcknowledged}/>
                    {ollamaGuideVisible ? <OllamaConnectionGuide library={ollamaConnection} checking={ollamaConnectionChecking} introVisible platform={devicePlatform} labels={labels} onCheck={onCheckOllamaConnection}/> : null}
                    <button type="button" className="ever-setup-wizard__next" disabled={!acknowledged} onClick={() => void onAcknowledge()}>
                        {labels.platformGuideConfirm}
                    </button>
                </div>
            </div>
        </div>
    );
}
