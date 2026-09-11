import { formatModelSettingsPath } from '../logic';
import type { PlatformGuideNoticeProps } from '../types';

export function PlatformGuideNotice({ labels, acknowledged, onAcknowledgedChange }: PlatformGuideNoticeProps) {
    return (
        <section className="ever-platform-guide">
            <h3>{labels.platformGuideTitle}</h3>
            <ul>
                {labels.platformGuideItems(formatModelSettingsPath(labels)).map((item) => (
                    <li key={item}>{item}</li>
                ))}
            </ul>
            <label className="ever-platform-guide__confirm">
                <input type="checkbox" checked={acknowledged} onChange={(event) => onAcknowledgedChange(event.target.checked)}/>
                <span>{labels.platformGuideCheckbox}</span>
            </label>
        </section>
    );
}
