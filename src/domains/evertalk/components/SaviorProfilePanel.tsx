import type { CSSProperties } from 'react';
import { Cpu, X } from 'lucide-react';
import { FAMILIARITY_SIGIL_MILESTONES, familiaritySigilFrameUrl } from '../logic';
import type { SaviorProfilePanelProps, SaviorStickerEntry, SpiritStickerKind } from '../types';
import { DECOR_UI_ASSETS, EVERTALK_UI_ASSETS, LOBBY_UI_ASSETS, SAVIOR_PORTRAIT_ASSETS } from '../uiAssets';
import { MemoryInsightPanel } from './MemoryInsightPanel';
import { SaviorNameEditor } from './SaviorNameEditor';

function stickerKindLabel(kind: SpiritStickerKind, labels: SaviorProfilePanelProps['labels']): string {
    if (kind === 'special') {
        return labels.stickerKindSpecial;
    }
    if (kind === 'event') {
        return labels.stickerKindEvent;
    }
    return labels.stickerKindLove;
}

function StickerGroup({ kind, entries, labels }: { kind: SpiritStickerKind; entries: SaviorStickerEntry[]; labels: SaviorProfilePanelProps['labels'] }) {
    const owned = entries.filter((entry) => entry.badge.unlocked);
    return (
        <section className="ever-savior-stickers">
            <header>
                <span className="ever-savior-ribbon" style={{ backgroundImage: `url(${LOBBY_UI_ASSETS.ribbonLabel})` }}>{stickerKindLabel(kind, labels)}</span>
                <small>{labels.stickerOwnedCount(owned.length, entries.length)}</small>
            </header>
            {entries.length === 0 ? (
                <p className="ever-savior-stickers__empty">{labels.stickerEmpty}</p>
            ) : (
                <div className="ever-savior-stickers__grid">
                    {entries.map((entry) => (
                        <div key={`${entry.personaId}-${entry.badge.id}`} className={`ever-savior-sticker ${entry.badge.unlocked ? 'is-unlocked' : 'is-locked'}`}>
                            <img src={entry.badge.url} alt={entry.name}/>
                            <span>{entry.name}</span>
                            <small>
                                <img src={entry.badge.unlocked ? EVERTALK_UI_ASSETS.keywordHeartFilled : EVERTALK_UI_ASSETS.keywordHeartEmpty} alt="" aria-hidden="true"/>
                                {entry.badge.unlocked ? `Lv.${entry.level}` : labels.stickerLockedHint(entry.badge.unlockLevel)}
                            </small>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

export function SaviorProfilePanel({ open, profile, memoryInsight, memoryInsightLoading, eventStickers, labels, onClose, onRenameSavior }: SaviorProfilePanelProps) {
    if (!open) {
        return null;
    }
    const loveEntries = profile.stickerEntries.filter((entry) => entry.badge.kind === 'love');
    const specialEntries = profile.stickerEntries.filter((entry) => entry.badge.kind === 'special');
    const eventEntries: SaviorStickerEntry[] = eventStickers.map((badge) => ({
        personaId: badge.id,
        name: labels.stickerKindEvent,
        level: 0,
        badge,
    }));

    return (
        <div className="ever-settings-overlay is-savior-inventory" role="dialog" aria-modal="true" aria-label={labels.inventory}>
            <div className="ever-savior-modal" style={{ '--ever-savior-header-pattern': `url(${LOBBY_UI_ASSETS.stripePattern})` } as CSSProperties}>
                <header className="ever-savior-modal__header">
                    <span className="ever-savior-modal__portrait">
                        <img src={SAVIOR_PORTRAIT_ASSETS.large} alt={profile.saviorName}/>
                    </span>
                    <div className="ever-savior-modal__identity">
                        <span className="ever-savior-ribbon" style={{ backgroundImage: `url(${LOBBY_UI_ASSETS.ribbonLabel})` }}>{labels.saviorProfile}</span>
                        <SaviorNameEditor name={profile.saviorName} labels={labels} onRename={onRenameSavior}/>
                        <span className={`ever-savior-modal__model ${profile.modelReady ? 'is-on' : 'is-off'}`}>
                            <Cpu aria-hidden="true" size={14}/>
                            <span>{labels.lobbyModelTitle}</span>
                            <strong>{profile.modelReady ? profile.activeModelName : labels.lobbyModelOffline}</strong>
                        </span>
                    </div>
                    <section className="ever-savior-stats">
                        <div><small>{labels.saviorStatPreferred}</small><strong>{profile.preferredCount}</strong></div>
                        <div><small>{labels.saviorStatEarned}</small><strong>{profile.earnedSigils.length}</strong></div>
                        <div><small>{labels.saviorStatMessages}</small><strong>{profile.totalMessages}</strong></div>
                        <div><small>{labels.saviorStatRooms}</small><strong>{profile.chatRoomCount}</strong></div>
                        <div><small>{labels.saviorStatMemories}</small><strong>{profile.memoryCount}</strong></div>
                        <div><small>{labels.saviorStatPersonas}</small><strong>{profile.personaCount}</strong></div>
                        <div><small>{labels.saviorStatBonded}</small><strong>{profile.bondedCount}</strong></div>
                        <div className="is-highlight"><small>{labels.saviorStatHighest}</small><strong>Lv.{profile.highestLevel}</strong></div>
                    </section>
                    <button type="button" className="ever-savior-modal__close" aria-label={labels.close} onClick={onClose}>
                        <X aria-hidden="true" size={20}/>
                    </button>
                </header>

                <div className="ever-savior-modal__body">
                    <div className="ever-savior-modal__summary">
                        <section className="ever-savior-sigils">
                            <span className="ever-savior-ribbon" style={{ backgroundImage: `url(${LOBBY_UI_ASSETS.ribbonLabel})` }}>{labels.saviorSigilProgress}</span>
                            <div className="ever-savior-sigils__grid">
                                {FAMILIARITY_SIGIL_MILESTONES.map((milestone) => {
                                    const count = profile.earnedSigils.filter((sigil) => sigil.level >= milestone.level).length;
                                    return (
                                        <div key={milestone.grade} className={`ever-savior-sigil ${count > 0 ? 'is-unlocked' : 'is-locked'}`}>
                                            <img src={familiaritySigilFrameUrl(milestone.grade)} alt={labels.familiaritySigilGradeNames[milestone.grade]}/>
                                            <span>{labels.familiaritySigilGradeNames[milestone.grade]}</span>
                                            <small>Lv.{milestone.level} · {count}</small>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                        <MemoryInsightPanel insight={memoryInsight} loading={memoryInsightLoading} labels={labels}/>
                    </div>

                    <div className="ever-savior-collection">
                        <span className="ever-savior-inventory-title">
                            <img src={DECOR_UI_ASSETS.inventoryIcon} alt="" aria-hidden="true"/>
                            {labels.inventory}
                        </span>
                        <span className="ever-savior-ribbon" style={{ backgroundImage: `url(${LOBBY_UI_ASSETS.ribbonLabel})` }}>{labels.stickerCollection}</span>
                        <StickerGroup kind="special" entries={specialEntries} labels={labels}/>
                        <StickerGroup kind="love" entries={loveEntries} labels={labels}/>
                        <StickerGroup kind="event" entries={eventEntries} labels={labels}/>
                    </div>
                </div>
            </div>
        </div>
    );
}
