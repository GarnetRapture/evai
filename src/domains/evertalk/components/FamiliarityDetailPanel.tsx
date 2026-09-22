import { Lock, MessageCircle, X } from 'lucide-react';
import { getSpiritVisualAssets } from '../../persona';
import { computeFamiliarityLevel, familiaritySigilFrameUrl, resolveFamiliaritySigilGrade, resolveSpiritStickerBadges, FAMILIARITY_SIGIL_MILESTONES } from '../logic';
import type { FamiliarityDetailPanelProps } from '../types';
import { EVERTALK_UI_ASSETS, raceBadgeUrl } from '../uiAssets';
import { LoadableAssetImage } from './LoadableAssetImage';

export function FamiliarityDetailPanel({ open, entry, detail, labels, onClose, onOpenChat }: FamiliarityDetailPanelProps) {
    if (!open || !entry) {
        return null;
    }
    const levelInfo = computeFamiliarityLevel(entry.familiarity_score);
    const grade = resolveFamiliaritySigilGrade(levelInfo.level);
    const assets = detail ? getSpiritVisualAssets(detail) : null;
    const displayName = detail?.name ?? entry.name;
    const progressPercent = Math.round(levelInfo.progressRatio * 100);
    const stickerBadges = resolveSpiritStickerBadges(assets?.assetFolder ?? null, levelInfo.level);

    return (<div className="ever-settings-overlay" role="dialog" aria-modal="true">
      <div className="ever-familiarity-modal">
        <header className="ever-settings-modal__header">
          <div>
            <p className="ever-kicker">{labels.familiarityDetailTitle}</p>
            <h2>{displayName}</h2>
            <span>{detail?.name_en ?? entry.name_en}</span>
          </div>
          <button type="button" aria-label={labels.close} onClick={onClose}>
            <X aria-hidden="true" size={20}/>
          </button>
        </header>

        <section className="ever-familiarity-hero">
          <div className="ever-familiarity-hero__avatar">
            <span className="ever-familiarity-hero__clip">
              <LoadableAssetImage candidates={assets?.memoryCandidates ?? assets?.rosterIconCandidates ?? []} alt={displayName} fallback={<span>{displayName.charAt(0)}</span>}/>
            </span>
            <img className="ever-familiarity-hero__hole" src={EVERTALK_UI_ASSETS.avatarHoleMask} alt="" aria-hidden="true"/>
            {grade && <img className="ever-familiarity-hero__crown" src={familiaritySigilFrameUrl(grade)} alt={labels.familiaritySigilGradeNames[grade]}/>}
            {detail && <img className="ever-familiarity-hero__race" src={raceBadgeUrl(detail.race)} alt={detail.race}/>}
          </div>
          <div className="ever-familiarity-hero__level">
            <span className="ever-familiarity-hero__level-label">{labels.familiarityLevel(levelInfo.level)}</span>
            {grade && <span className="ever-familiarity-hero__grade">{labels.familiaritySigilGradeNames[grade]}</span>}
          </div>
        </section>

        <section className="ever-familiarity-progress">
          <div className="ever-familiarity-progress__head">
            <span>{levelInfo.isMax ? labels.familiarityMaxLevelLabel : labels.familiarityNextLevel(levelInfo.level + 1)}</span>
            <strong>{levelInfo.isMax ? '100%' : `${progressPercent}%`}</strong>
          </div>
          <div className="ever-familiarity-progress__track">
            <div className="ever-familiarity-progress__fill" style={{ width: `${progressPercent}%` }}/>
          </div>
          <small>{levelInfo.isMax ? labels.familiarityMaxLevelLabel : labels.familiarityExpLabel(levelInfo.progressExp, levelInfo.progressSpan)}</small>
        </section>

        <section className="ever-familiarity-sigils">
          {FAMILIARITY_SIGIL_MILESTONES.map((milestone) => {
            const unlocked = levelInfo.level >= milestone.level;
            return (
              <div key={milestone.grade} className={`ever-familiarity-sigil ${unlocked ? 'is-unlocked' : 'is-locked'}`}>
                <div className="ever-familiarity-sigil__frame">
                  <img src={familiaritySigilFrameUrl(milestone.grade)} alt={labels.familiaritySigilGradeNames[milestone.grade]}/>
                  {!unlocked && <span className="ever-familiarity-sigil__lock"><Lock aria-hidden="true" size={16}/></span>}
                </div>
                <small>Lv.{milestone.level}</small>
                <span>{labels.familiaritySigilGradeNames[milestone.grade]}</span>
              </div>
            );
          })}
        </section>

        {stickerBadges.length > 0 && (
          <section className="ever-familiarity-rewards">
            {stickerBadges.map((badge) => (
              <div key={badge.id} className={`ever-familiarity-reward ${badge.unlocked ? 'is-unlocked' : 'is-locked'}`}>
                <img className="ever-familiarity-reward__sticker" src={badge.url} alt={displayName}/>
                <strong>{badge.kind === 'special' ? labels.stickerKindSpecial : labels.stickerKindLove}</strong>
                <span>{badge.unlocked ? labels.familiaritySigilObtained : labels.stickerLockedHint(badge.unlockLevel)}</span>
              </div>
            ))}
          </section>
        )}

        <section className="ever-familiarity-metrics">
          <div><small>{labels.familiarity}</small><strong>{entry.familiarity_score}</strong></div>
          <div><small>{labels.messages}</small><strong>{entry.message_count}</strong></div>
          <div><small>{labels.memories}</small><strong>{entry.memory_count}</strong></div>
        </section>

        <button type="button" className="ever-familiarity-chat" onClick={() => onOpenChat(entry.persona_id)}>
          <MessageCircle aria-hidden="true" size={18}/>
          {labels.familiarityOpenChat(displayName)}
        </button>
      </div>
    </div>);
}
