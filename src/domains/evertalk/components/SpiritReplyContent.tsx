import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { collectSpiritActions, splitSpiritReply } from '../logic';
import type { SpiritReplyContentProps } from '../types';
import { SpiritActionStatus } from './SpiritActionStatus';

export function SpiritReplyContent({ text, spiritAction, showReasoning, innerThoughtsLabel, streaming, showActionStatus, actionNoteLabel }: SpiritReplyContentProps) {
    const [expanded, setExpanded] = useState(false);
    const [flashFinished, setFlashFinished] = useState(!showActionStatus);
    const panelId = useId();
    const { reasoning, reply, actions } = splitSpiritReply(text, streaming);
    const allActions = collectSpiritActions(actions, spiritAction);
    const flashing = showActionStatus && !flashFinished;
    return (
        <>
            {flashing && <SpiritActionStatus key={allActions.join(' · ')} actions={allActions} onFinished={() => setFlashFinished(true)}/>}
            {!flashing && !streaming && allActions.length > 0 && <span className="ever-action-note">{actionNoteLabel(allActions.join(' · '))}</span>}
            {showReasoning && reasoning.length > 0 && (
                <div className={`ever-inner-thoughts ${expanded ? 'is-expanded' : ''}`}>
                    <button type="button" className="ever-inner-thoughts__toggle" aria-expanded={expanded} aria-controls={panelId} onClick={() => setExpanded((current) => !current)}>
                        <span>{innerThoughtsLabel}</span>
                        <ChevronDown aria-hidden="true" size={14}/>
                    </button>
                    {expanded && <p id={panelId} className="ever-inner-thoughts__body">{reasoning}</p>}
                </div>
            )}
            {reply.length > 0 && <span className="ever-message__text">{reply}</span>}
        </>
    );
}
