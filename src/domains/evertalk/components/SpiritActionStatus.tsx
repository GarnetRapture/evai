import type { SpiritActionStatusProps } from '../types';

export function SpiritActionStatus({ actions }: SpiritActionStatusProps) {
    if (actions.length === 0) {
        return null;
    }
    return (
        <span className="ever-action-status" role="status" aria-live="polite">
            {actions.join(' · ')}
        </span>
    );
}
