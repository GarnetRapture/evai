import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Check, Cpu, Pencil, X } from 'lucide-react';
import { FAMILIARITY_SIGIL_MILESTONES, familiaritySigilFrameUrl } from '../logic';
import type { SaviorProfilePanelProps, SaviorStickerEntry, SpiritStickerKind } from '../types';
import { EVERTALK_UI_ASSETS, LOBBY_UI_ASSETS } from '../uiAssets';
import { MemoryInsightPanel } from './MemoryInsightPanel';

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
    const [editingName, setEditingName] = useState(false);
    const [nameDraft, setNameDraft] = useState(profile.saviorName);
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

    function submitName() {
        const trimmed = nameDraft.trim();
        if (trimmed.length > 0) {
            onRenameSavior(trimmed);
        }
        setEditingName(false);
    }

    return (
        <div className="ever-settings-overlay" role="dialog" aria-modal="true">
            <div className="ever-savior-modal" style={{ '--ever-savior-header-pattern': `url(${LOBBY_UI_ASSETS.stripePattern})` } as CSSProperties}>
                <header className="ever-savior-modal__header">
                    <span className="ever-savior-modal__portrait" style={{ backgroundImage: `url(${EVERTALK_UI_ASSETS.saviorCardTexture})` }}>
                        <img src={EVERTALK_UI_ASSETS.appMark} alt="" aria-hidden="true"/>
                    </span>
                    <div className="ever-savior-modal__identity">
                        <span className="ever-savior-ribbon" style={{ backgroundImage: `url(${LOBBY_UI_ASSETS.ribbonLabel})` }}>{labels.saviorProfile}</span>
                        {editingName ? (
                            <span className="ever-savior-modal__edit">
                                <input value={nameDraft} maxLength={24} placeholder={labels.saviorNamePlaceholder} onChange={(event) => setNameDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { submitName(); } }}/>
                                <button type="button" aria-label={labels.saviorRename} onClick={submitName}><Check aria-hidden="true" size={16}/></button>
                            </span>
                        ) : (
                            <span className="ever-savior-modal__name">
                                <strong>{profile.saviorName}</strong>
                                <button type="button" aria-label={labels.saviorRename} onClick={() => { setNameDraft(profile.saviorName); setEditingName(true); }}><Pencil aria-hidden="true" size={14}/></button>
                            </span>
                        )}
                        <span className={`ever-savior-modal__model ${profile.modelReady ? 'is-on' : 'is-off'}`}>
                            <Cpu aria-hidden="true" size={14}/>
                            <span>{labels.lobbyModelTitle}</span>
                            <strong>{profile.modelReady ? profile.activeModelName : labels.lobbyModelOffline}</strong>
                        </span>
                    </div>
                    <button type="button" className="ever-savior-modal__close" aria-label={labels.close} onClick={onClose}>
                        <X aria-hidden="true" size={20}/>
                    </button>
                </header>

                <section className="ever-savior-stats">
                    <div><small>{labels.saviorStatPreferred}</small><strong>{profile.preferredCount}</strong></div>
                    <div><small>{labels.saviorStatEarned}</small><strong>{profile.earnedSigils.length}</strong></div>
                    <div><small>{labels.saviorStatMessages}</small><strong>{profile.totalMessages}</strong></div>
                    <div><small>{labels.saviorStatRooms}</small><strong>{profile.chatRoomCount}</strong></div>
                    <div><small>{labels.saviorStatMemories}</small><strong>{profile.memoryCount}</strong></div>
                    <div><small>{labels.saviorStatPersonas}</small><strong>{profile.personaCount}</strong></div>
                    <div><small>{labels.saviorStatBonded}</small><strong>{profile.bondedCount}</strong></div>
                    <div><small>{labels.saviorStatHighest}</small><strong>Lv.{profile.highestLevel}</strong></div>
                </section>

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

                <div className="ever-savior-collection">
                    <span className="ever-savior-ribbon" style={{ backgroundImage: `url(${LOBBY_UI_ASSETS.ribbonLabel})` }}>{labels.stickerCollection}</span>
                    <StickerGroup kind="special" entries={specialEntries} labels={labels}/>
                    <StickerGroup kind="love" entries={loveEntries} labels={labels}/>
                    <StickerGroup kind="event" entries={eventEntries} labels={labels}/>
                </div>

                <MemoryInsightPanel insight={memoryInsight} loading={memoryInsightLoading} labels={labels}/>
            </div>
        </div>
    );
}
