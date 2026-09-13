import { BrainCircuit } from 'lucide-react';
import type { PersonaMaintenanceStatusProps } from '../types';

export function PersonaMaintenanceStatus({ tasks, spiritName, labels }: PersonaMaintenanceStatusProps) {
    const current = tasks.at(-1);
    if (current === undefined) {
        return null;
    }
    return (
        <div className="ever-maintenance-status" role="status" aria-live="polite">
            <BrainCircuit aria-hidden="true" size={14}/>
            <span>{labels.maintenanceStatus[current.kind](spiritName)}</span>
            <i aria-hidden="true"><b/><b/><b/></i>
        </div>
    );
}
