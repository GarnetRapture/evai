import { formatModelSettingsPath } from '../logic';
import type { PlatformGuideNoticeProps } from '../types';

export function PlatformGuideNotice({ appPlatform, labels, confirmation }: PlatformGuideNoticeProps) {
    return (
        <section className="ever-platform-guide">
            <h3>{labels.platformGuideTitle}</h3>
            <ul>
                {labels.platformGuideItems[appPlatform](formatModelSettingsPath(labels)).map((item) => (
                    <li key={item}>{item}</li>
                ))}
            </ul>
            <label className="ever-platform-guide__confirm">
                <input type="checkbox" checked={confirmation.acknowledged} onChange={(event) => confirmation.onAcknowledgedChange(event.target.checked)}/>
                <span>{labels.platformGuideCheckbox[appPlatform]}</span>
            </label>
        </section>
    );
}
