import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Cpu, Users } from 'lucide-react';
import { ASSET_ROOT, getSpiritVisualAssets } from '../../persona';
import { computeFamiliarityLevel, familiaritySigilFrameUrl, pickRandomSpeechLine, resolveFamiliaritySigilGrade, resolveLobbyActorMotion, resolveSpiritStickerBadges } from '../logic';
import type { LobbyScreenProps } from '../types';
import { DECOR_UI_ASSETS, EVERTALK_UI_ASSETS, LOBBY_ACTOR_SLOT_ASSETS, LOBBY_UI_ASSETS, loveFrameAssetForLevel, raceBadgeUrl } from '../uiAssets';
import { LoadableAssetImage } from './LoadableAssetImage';
import { MemoryInsightPanel } from './MemoryInsightPanel';
import { SaviorProfileCard } from './SaviorProfileCard';

export function LobbyScreen({ spirits, familiarityList, background, saviorProfile, memoryInsight, memoryInsightLoading, labels, maxPreferredSlots, onEnterChat, onOpenBackgroundPicker, onOpenRoster, onOpenSaviorProfile, onRenameSavior }: LobbyScreenProps) {
    const [reaction, setReaction] = useState<{ id: string; line: string } | null>(null);
    const backgroundUrl = background ? `${ASSET_ROOT}/backgrounds/talk/${background}` : `${ASSET_ROOT}/backgrounds/talk/Talk_BG_Lounge.png`;
    const emptySlots = Math.max(0, maxPreferredSlots - spirits.length);

    const lobbyStyle = {
        backgroundImage: `url(${backgroundUrl})`,
        '--ever-section-deco': `url(${DECOR_UI_ASSETS.sectionDeco})`,
        '--ever-lobby-stripe': `url(${LOBBY_UI_ASSETS.stripePattern})`,
    } as CSSProperties;

    return (
        <div className="ever-lobby" style={lobbyStyle}>
            <div className="ever-lobby__shade"/>
            <img className="ever-lobby__light ever-lobby__light--left" src={LOBBY_UI_ASSETS.lightColumn} alt="" aria-hidden="true"/>
            <img className="ever-lobby__light ever-lobby__light--right" src={LOBBY_UI_ASSETS.lightColumn} alt="" aria-hidden="true"/>
            <aside className="ever-lobby__side">
                <nav className="ever-lobby__top-actions" aria-label={labels.lobby}>
                    <button type="button" className="ever-lobby__action" onClick={onOpenSaviorProfile}>
                        <span className="ever-lobby__action-icon"><img src={DECOR_UI_ASSETS.inventoryIcon} alt="" aria-hidden="true"/></span>
                        <span>{labels.inventory}</span>
                    </button>
                    <button type="button" className="ever-lobby__action" onClick={onOpenBackgroundPicker}>
                        <span className="ever-lobby__action-icon is-thumbnail"><img src={backgroundUrl} alt="" aria-hidden="true"/></span>
                        <span>{labels.lobbyPickBackground}</span>
                    </button>
                    <button type="button" className="ever-lobby__action" onClick={onOpenRoster}>
                        <span className="ever-lobby__action-icon"><img src={EVERTALK_UI_ASSETS.tabBond} alt="" aria-hidden="true"/></span>
                        <span>{labels.lobbyBrowseRoster}</span>
                    </button>
                </nav>
                <section className="ever-lobby__insight">
                    <div className={`ever-lobby__model ${saviorProfile.modelReady ? 'is-on' : 'is-off'}`}>
                        <Cpu aria-hidden="true" size={14}/>
                        <span>{labels.lobbyModelTitle}</span>
                        <strong>{saviorProfile.modelReady ? saviorProfile.activeModelName : labels.lobbyModelOffline}</strong>
                    </div>
                    <MemoryInsightPanel insight={memoryInsight} loading={memoryInsightLoading} labels={labels}/>
                </section>
            </aside>

            <div className="ever-lobby__main">
            <header className="ever-lobby__top">
                <SaviorProfileCard profile={saviorProfile} labels={labels} onRenameSavior={onRenameSavior}/>
            </header>

            {spirits.length === 0 ? (
                <div className="ever-lobby__empty">
                    <img className="ever-lobby__empty-art" src={loveFrameAssetForLevel(1)} alt="" aria-hidden="true"/>
                    <div className="ever-lobby__empty-body">
                        <strong>{labels.lobbyEmpty}</strong>
                        <button type="button" onClick={onOpenRoster}>
                            <Users aria-hidden="true" size={18}/>
                            {labels.lobbyBrowseRoster}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="ever-lobby__stage">
                    {spirits.map((spirit, index) => {
                        const assets = getSpiritVisualAssets(spirit);
                        const line = pickRandomSpeechLine(spirit) || spirit.personality.greeting || '';
                        const entry = familiarityList.find((candidate) => candidate.persona_id === spirit.id);
                        const levelInfo = computeFamiliarityLevel(entry?.familiarity_score ?? 0);
                        const grade = resolveFamiliaritySigilGrade(levelInfo.level);
                        const stickerBadges = resolveSpiritStickerBadges(assets.assetFolder, levelInfo.level).filter((badge) => badge.unlocked);
                        const slot = LOBBY_ACTOR_SLOT_ASSETS[index % LOBBY_ACTOR_SLOT_ASSETS.length];
                        const motion = resolveLobbyActorMotion(spirit.id, index, spirits.length);
                        const actorStyle = {
                            '--lobby-delay': `${motion.delay_seconds}s`,
                            '--lobby-duration': `${motion.duration_seconds}s`,
                            '--lobby-base': `${motion.base_percent}%`,
                            '--lobby-range': `${motion.range_vw}vw`,
                            '--lobby-rise': `${motion.rise_px}px`,
                            '--lobby-depth': motion.depth_scale,
                        } as CSSProperties;
                        const isReacting = reaction?.id === spirit.id;
                        return (
                            <div key={spirit.id} className={`ever-lobby__actor ${isReacting ? 'is-reacting' : ''}`} style={actorStyle}>
                                {isReacting && reaction.line && (
                                    <span className={`ever-lobby__speech is-${motion.speech_alignment}`} style={{ borderImageSource: `url(${EVERTALK_UI_ASSETS.speechBubble})` }}>
                                        {reaction.line}
                                        <img className="ever-lobby__speech-tail" src={EVERTALK_UI_ASSETS.speechBubbleTail} alt="" aria-hidden="true"/>
                                    </span>
                                )}
                                <img className="ever-lobby__slot" src={slot} alt="" aria-hidden="true"/>
                                <img className="ever-lobby__stand-pin" src={LOBBY_UI_ASSETS.hexOutlinePin} alt="" aria-hidden="true"/>
                                {isReacting && <img className="ever-lobby__pointer" src={EVERTALK_UI_ASSETS.lobbyPointer} alt="" aria-hidden="true"/>}
                                <button
                                    type="button"
                                    className="ever-lobby__actor-button"
                                    aria-label={labels.lobbyEnterChat(spirit.name)}
                                    onClick={() => setReaction({ id: spirit.id, line })}
                                    onDoubleClick={() => onEnterChat(spirit.id)}
                                >
                                    <LoadableAssetImage candidates={assets.portraitCandidates} alt={spirit.name} className="ever-lobby__portrait" fallback={<span className="ever-lobby__portrait-fallback">{spirit.name.charAt(0)}</span>}/>
                                    <span className="ever-lobby__actor-info">
                                        {grade && <img className="ever-lobby__actor-crown" src={familiaritySigilFrameUrl(grade)} alt={labels.familiaritySigilGradeNames[grade]}/>}
                                        <span className="ever-lobby__actor-name">
                                            <img className="ever-lobby__actor-race" src={raceBadgeUrl(spirit.race)} alt={spirit.race}/>
                                            {spirit.name}
                                        </span>
                                        <span className="ever-lobby__actor-gauge">
                                            <i>Lv.{levelInfo.level}</i>
                                            <span className="ever-lobby__actor-exp">
                                                <span style={{ width: `${Math.round(levelInfo.progressRatio * 100)}%`, backgroundImage: `url(${LOBBY_UI_ASSETS.gaugeFill})` }}/>
                                            </span>
                                        </span>
                                        {stickerBadges.length > 0 && (
                                            <span className="ever-lobby__actor-stickers">
                                                {stickerBadges.map((badge) => (
                                                    <img key={badge.id} src={badge.url} alt={badge.kind === 'special' ? labels.stickerKindSpecial : labels.stickerKindLove}/>
                                                ))}
                                            </span>
                                        )}
                                    </span>
                                </button>
                                <img className="ever-lobby__actor-divider" src={LOBBY_UI_ASSETS.chevronDivider} alt="" aria-hidden="true"/>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="ever-lobby__floor">
                <div className="ever-lobby__slots">
                    {spirits.map((spirit) => (
                        <span key={spirit.id} className="ever-lobby__slot-chip is-filled" style={{ backgroundImage: `url(${LOBBY_UI_ASSETS.emptySlotCrowned})` }}>
                            <LoadableAssetImage candidates={getSpiritVisualAssets(spirit).rosterIconCandidates} alt={spirit.name} fallback={<span>{spirit.name.charAt(0)}</span>}/>
                        </span>
                    ))}
                    {Array.from({ length: emptySlots }, (_unused, index) => (
                        <button key={`empty-${index}`} type="button" className="ever-lobby__slot-chip" style={{ backgroundImage: `url(${LOBBY_UI_ASSETS.emptySlot})` }} aria-label={labels.lobbySlotEmptyLabel(spirits.length + index + 1)} onClick={onOpenRoster}>
                            <img src={LOBBY_UI_ASSETS.diamondMarker} alt="" aria-hidden="true"/>
                            <b className="ever-lobby__slot-number">{spirits.length + index + 1}</b>
                        </button>
                    ))}
                </div>
                <p className="ever-lobby__hint">{labels.lobbyTapHint}</p>
            </div>
            </div>
        </div>
    );
}
