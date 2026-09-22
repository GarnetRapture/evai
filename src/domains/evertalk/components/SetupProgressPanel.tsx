import type { SetupProgressPanelProps } from '../types';

export function SetupProgressPanel({ open, progress, labels }: SetupProgressPanelProps) {
    if (!open) {
        return null;
    }

    function getStageLabel(): string {
        if (!progress) {
            return labels.setupStagePersonas;
        }
        if (progress.stage === 'personas') {
            return labels.setupStagePersonas;
        }
        if (progress.stage === 'caching') {
            return labels.setupStageCaching;
        }
        if (progress.stage === 'model') {
            return labels.setupStageModel;
        }
        return labels.setupStageDone;
    }

    const current = progress?.current ?? 0;
    const total = Math.max(progress?.total ?? 1, 1);
    const percent = Math.min(100, Math.round((current / total) * 100));

    return (
        <div className="ever-settings-overlay ever-setup-progress" role="dialog" aria-modal="true">
            <div className="ever-setup-progress__modal">
                <h2>{labels.setupProgressTitle}</h2>
                <p>{getStageLabel()}</p>
                <div className="ever-setup-progress__bar-track">
                    <div className="ever-setup-progress__bar-fill" style={{ width: `${percent}%` }} />
                </div>
                <span className="ever-setup-progress__count">{labels.setupProgressCount(current, total)}</span>
            </div>
        </div>
    );
}
