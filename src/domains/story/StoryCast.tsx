import type { CSSProperties } from 'react';
import { storySpiritUrl } from './client';
import type { StoryCastMember } from './client';
import { storyTextOf } from './types';
import type { AppLanguage } from '../../shared/types';

interface StoryCastProps {
    cast: readonly StoryCastMember[];
    language: AppLanguage;
    onMediaError: (source: string) => void;
}

function slotStyle(member: StoryCastMember): CSSProperties {
    return {
        left: `${member.center * 100}%`,
        width: `${member.width * 100}%`,
        height: `${member.height * 100}%`,
    };
}

export function StoryCast({ cast, language, onMediaError }: StoryCastProps) {
    if (cast.length === 0) {
        return null;
    }
    return (
        <div className="ever-story__cast" data-count={cast.length}>
            {cast.map((member) => {
                const source = storySpiritUrl(member.actor);
                if (source === null) {
                    return null;
                }
                return (
                    <div
                        key={`${member.slot}-${member.actor.id}`}
                        className={`ever-story__actor-slot ever-story__actor-slot--${member.slot}${member.speaking ? ' is-speaking' : ''}`}
                        style={slotStyle(member)}
                    >
                        <img
                            className="ever-story__actor"
                            src={source}
                            alt={storyTextOf(member.actor.name, language)}
                            style={member.actor.flip ? { transform: 'scaleX(-1)' } : undefined}
                            onError={() => onMediaError(source)}
                        />
                    </div>
                );
            })}
        </div>
    );
}
