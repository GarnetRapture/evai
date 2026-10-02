import { useState } from 'react';
import type { AppPlatform } from '../../../../../src/shared/types';
import type { AndroidLabels } from '../labels';
import { PlatformGuideNotice } from './PlatformGuideNotice';
import { SetupWizardFrame, SetupWizardNextButton } from './SetupWizard';

export interface PlatformGuideGateProps {
    appPlatform: AppPlatform;
    labels: AndroidLabels;
    onAcknowledge: () => Promise<void>;
}

export function PlatformGuideGate({ appPlatform, labels, onAcknowledge }: PlatformGuideGateProps) {
    const [acknowledged, setAcknowledged] = useState(false);
    return (
        <SetupWizardFrame sheet={false}>
            <PlatformGuideNotice appPlatform={appPlatform} labels={labels} confirmation={{ acknowledged, onAcknowledgedChange: setAcknowledged }}/>
            <SetupWizardNextButton label={labels.platformGuideConfirm} disabled={!acknowledged} onPress={() => void onAcknowledge()}/>
        </SetupWizardFrame>
    );
}
