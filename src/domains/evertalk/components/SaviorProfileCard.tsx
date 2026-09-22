import type { CSSProperties } from 'react';
import type { SaviorProfileCardProps } from '../types';
import { DECOR_UI_ASSETS, LOBBY_UI_ASSETS, SAVIOR_PORTRAIT_ASSETS } from '../uiAssets';
import { SaviorNameEditor } from './SaviorNameEditor';

export function SaviorProfileCard({ profile, labels, onRenameSavior }:SaviorProfileCardProps) {
    const cardStyle = {
        '--ever-section-deco': `url(${DECOR_UI_ASSETS.sectionDeco})`,
        '--ever-savior-card-stripe': `url(${LOBBY_UI_ASSETS.stripePattern})`,
    } as CSSProperties;

    return (
        <div className="ever-savior-card" style={cardStyle}>
            <span className="ever-savior-card__portrait">
                <img src={SAVIOR_PORTRAIT_ASSETS.medium} alt={profile.saviorName}/>
            </span>
            <div className="ever-savior-card__body">
                <span className="ever-savior-card__title">{labels.saviorProfile}</span>
                <SaviorNameEditor name={profile.saviorName} labels={labels} onRename={onRenameSavior}/>
                <div className="ever-savior-card__stats">
                    <div><small>{labels.saviorStatPreferred}</small><strong>{profile.preferredCount}</strong></div>
                    <div><small>{labels.saviorStatEarned}</small><strong>{profile.earnedSigils.length}</strong></div>
                    <div><small>{labels.saviorStatMessages}</small><strong>{profile.totalMessages}</strong></div>
                    <div className="is-highlight"><small>{labels.saviorStatHighest}</small><strong>Lv.{profile.highestLevel}</strong></div>
                </div>
            </div>
        </div>
    );
}
