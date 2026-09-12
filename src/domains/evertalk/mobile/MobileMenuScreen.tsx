import { Boxes, ChevronRight, Images, Settings } from 'lucide-react';
import { getSpiritVisualAssets, resolveSpiritSkin } from '../../persona';
import { createTalkChoices, formatSystemStatusLabel } from '../logic';
import { MemoryInsightPanel } from '../components/MemoryInsightPanel';
import { SpiritSkinPicker } from '../components/SpiritSkinPicker';
import type { MobileScreenProps } from './types';

export function MobileMenuScreen({ controller }: MobileScreenProps) {
    const { activeDetail, activeSkinId, localStatus, systemStatuses, styles, activeStyle, isSyncing, labels } = controller;
    const choices = createTalkChoices(activeDetail, labels);
    const visualAssets = activeDetail ? getSpiritVisualAssets(activeDetail) : null;
    const skinOptions = visualAssets?.skinOptions ?? [];
    const activeSkin = visualAssets ? resolveSpiritSkin(visualAssets, activeSkinId) : null;
    return (
        <section className="ever-mobile-menu">
            <header className="ever-mobile-topbar">
                <div>
                    <h1>{labels.settings}</h1>
                    <span>{labels.currentSettings}</span>
                </div>
            </header>

            <div className="ever-mobile-menu__actions">
                <button type="button" onClick={controller.openSettings}>
                    <Settings aria-hidden="true" size={20}/>
                    <span>{labels.settings}</span>
                    <ChevronRight aria-hidden="true" size={18}/>
                </button>
                <button type="button" onClick={controller.openModuleManagement}>
                    <Boxes aria-hidden="true" size={20}/>
                    <span>{labels.moduleManagement}</span>
                    <ChevronRight aria-hidden="true" size={18}/>
                </button>
                <button type="button" onClick={controller.openBackgroundGallery}>
                    <Images aria-hidden="true" size={20}/>
                    <span>{labels.backgroundGallery}</span>
                    <ChevronRight aria-hidden="true" size={18}/>
                </button>
            </div>

            {activeDetail && (
                <section className="ever-mobile-menu__card">
                    <p className="ever-kicker">{labels.bondStatus}</p>
                    <button type="button" className="ever-mobile-menu__spirit" onClick={controller.openProfileDetail}>
                        <strong>{activeDetail.name}</strong>
                        <span>{activeDetail.name_en}</span>
                    </button>
                    <div className="ever-mobile-menu__grid">
                        <div><small>{labels.grade}</small><strong>{activeDetail.grade}</strong></div>
                        <div><small>{labels.race}</small><strong>{activeDetail.race}</strong></div>
                        <div><small>{labels.className}</small><strong>{activeDetail.class}</strong></div>
                        <div><small>{labels.union}</small><strong>{activeDetail.profile?.union ?? '-'}</strong></div>
                    </div>
                    <button type="button" className="ever-mobile-menu__detail" onClick={controller.openProfileDetail}>{labels.profileDetail}</button>
                </section>
            )}

            {activeDetail && skinOptions.length > 1 && (
                <section className="ever-mobile-menu__section ever-skin-section">
                    <h3>{labels.skinSelector(activeDetail.name)}</h3>
                    <SpiritSkinPicker skinOptions={skinOptions} activeSkinId={activeSkin?.id} spiritName={activeDetail.name} labels={labels} onSelectSkin={controller.selectSkin}/>
                </section>
            )}

            {activeDetail && (
                <div className="ever-mobile-menu__section ever-mobile-menu__insight">
                    <MemoryInsightPanel insight={controller.memoryInsight} loading={controller.memoryInsightLoading} labels={labels}/>
                </div>
            )}

            {activeDetail && choices.length > 0 && (
                <section className="ever-mobile-menu__section">
                    <h3>{labels.conversationKeywords}</h3>
                    <div className="ever-mobile-menu__choices">
                        {choices.map((choice) => (
                            <div key={choice.id}><span>{choice.source}</span><strong>{choice.label}</strong></div>
                        ))}
                    </div>
                </section>
            )}

            {activeDetail && (
                <section className="ever-mobile-menu__section">
                    <h3>{labels.personality}</h3>
                    <p className="ever-mobile-menu__personality">{activeDetail.personality?.description ?? labels.noPersonality}</p>
                    <div className="ever-mobile-menu__tags">
                        {activeDetail.profile?.like?.map((item) => <span key={`like-${item}`}>{labels.like} {item}</span>)}
                        {activeDetail.profile?.hobby?.map((item) => <span key={`hobby-${item}`}>{labels.hobby} {item}</span>)}
                    </div>
                </section>
            )}


            <section className="ever-mobile-menu__section">
                <h3>{labels.localStatus}</h3>
                <div className="ever-mobile-menu__grid">
                    <div><small>{labels.personaCount}</small><strong>{localStatus?.persona_count ?? '-'}</strong></div>
                    <div><small>{labels.chatRooms}</small><strong>{localStatus?.chat_room_count ?? '-'}</strong></div>
                    <div><small>{labels.chatMessages}</small><strong>{localStatus?.chat_message_count ?? '-'}</strong></div>
                    <div><small>{labels.localMemories}</small><strong>{localStatus?.memory_count ?? '-'}</strong></div>
                    <div><small>{labels.styles}</small><strong>{localStatus?.style_count ?? '-'}</strong></div>
                    <div><small>{labels.knowledge}</small><strong>{localStatus?.knowledge_chunk_count ?? '-'}</strong></div>
                </div>
            </section>

            <section className="ever-mobile-menu__section">
                <h3>{labels.systemStatus}</h3>
                <ul className="ever-mobile-menu__status">
                    {systemStatuses.map((status) => (
                        <li key={status.id} className={`is-${status.state}`}>
                            <span className="ever-mobile-menu__status-dot" aria-hidden="true"/>
                            <strong>{formatSystemStatusLabel(status.id, labels)}</strong>
                            <small>{status.detail}</small>
                        </li>
                    ))}
                </ul>
            </section>

            <section className="ever-mobile-menu__section">
                <h3>{labels.speakingStyle}</h3>
                {activeStyle && (
                    <div className="ever-mobile-menu__active-style">
                        <strong>{activeStyle.name}</strong>
                        <span>{activeStyle.tone} / {activeStyle.formality}</span>
                    </div>
                )}
                {styles.length === 0 ? (
                    <button type="button" className="ever-mobile-menu__sync" disabled={isSyncing} onClick={controller.syncStyles}>
                        {isSyncing ? labels.syncing : labels.syncServerStyle}
                    </button>
                ) : (
                    <div className="ever-mobile-menu__style-list">
                        {styles.map((style) => (
                            <button key={style.id} type="button" className={style.is_active ? 'is-active' : ''} onClick={() => controller.selectStyle(style.id)}>
                                {style.name}
                            </button>
                        ))}
                    </div>
                )}
            </section>
        </section>
    );
}
