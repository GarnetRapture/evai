import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { splitSpiritReply } from '../logic';
import type { SpiritReplyContentProps } from '../types';
import { SpiritActionStatus } from './SpiritActionStatus';

export function SpiritReplyContent({ text, showReasoning, innerThoughtsLabel, streaming, showActionStatus }: SpiritReplyContentProps) {
    const [expanded, setExpanded] = useState(false);
    const panelId = useId();
    const { reasoning, reply, actions } = splitSpiritReply(text, streaming);
    return (
        <>
            {showActionStatus && <SpiritActionStatus key={actions.join(' · ')} actions={actions}/>}
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
