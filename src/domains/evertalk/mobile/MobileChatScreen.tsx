import { useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { ChevronLeft, History, Images, MessageCircle, Plus, Send, Square, X, ZoomIn } from 'lucide-react';
import { getRaceTone, getSpiritVisualAssets, resolveSpiritSkin } from '../../persona';
import type { SpiritVisualAssets } from '../../persona';
import { createTalkChoices, createConversationSummary, formatDateTime, formatRoomTitle, formatSkinLabel, parseThinkBlocks, pickPokeReactionLine, pickRandomSpeechLine } from '../logic';
import { LoadableAssetImage } from '../components/LoadableAssetImage';
import type { StageTab, ZoomDragState, ZoomOffset } from '../types';
import type { MobileChatScreenProps, MobileMessageBubbleProps } from './types';

export function MobileChatScreen({ controller, onBrowseRoster }: MobileChatScreenProps) {
    const { activeDetail, activeRoom, llmStatus, messages, previousRooms, previousRoomsLoading, inputText, isTyping, streamingText, streamingRequestId, activeStageTab, activeSkinId, appSettings, messagesListRef, labels } = controller;
    const showReasoning = appSettings?.show_reasoning ?? true;
    const assets: SpiritVisualAssets | null = useMemo(() => (activeDetail ? getSpiritVisualAssets(activeDetail) : null), [activeDetail]);
    const tone = useMemo(() => (activeDetail ? getRaceTone(activeDetail.race) : 'tone-neutral'), [activeDetail]);
    const choices = useMemo(() => createTalkChoices(activeDetail, labels), [activeDetail, labels]);
    const summary = useMemo(() => createConversationSummary(activeDetail), [activeDetail]);
    const activeSkin = useMemo(() => (assets ? resolveSpiritSkin(assets, activeSkinId) : null), [activeSkinId, assets]);
    const gallerySkins = useMemo(() => assets?.skinOptions ?? [], [assets]);
    const speechLine = useMemo(() => pickRandomSpeechLine(activeDetail), [activeDetail?.id]);
    const avatarCandidates = activeSkin?.avatarCandidates ?? assets?.avatarCandidates ?? [];
    const canUseComposer = Boolean(activeDetail && llmStatus?.is_loaded && !isTyping);

    const [historyOpen, setHistoryOpen] = useState(false);
    const [poked, setPoked] = useState(false);
    const [displayLine, setDisplayLine] = useState(speechLine);
    const [zoomedImageCandidates, setZoomedImageCandidates] = useState<string[] | null>(null);
    const [zoomOffset, setZoomOffset] = useState<ZoomOffset>({ x: 0, y: 0 });
    const [zoomDragStart, setZoomDragStart] = useState<ZoomDragState | null>(null);
    const pokeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setDisplayLine(speechLine);
        setPoked(false);
        return () => {
            if (pokeTimeoutRef.current) {
                clearTimeout(pokeTimeoutRef.current);
            }
        };
    }, [activeDetail?.id]);

    function handlePortraitPoke() {
        if (!activeDetail) {
            return;
        }
        setDisplayLine(pickPokeReactionLine(activeDetail, displayLine));
        setPoked(true);
        if (pokeTimeoutRef.current) {
            clearTimeout(pokeTimeoutRef.current);
        }
        pokeTimeoutRef.current = setTimeout(() => setPoked(false), 1600);
    }

    async function toggleHistory() {
        const next = !historyOpen;
        setHistoryOpen(next);
        if (next) {
            await controller.loadPreviousRooms();
        }
    }

    async function handleDeleteRoom(event: React.MouseEvent, roomId: string) {
        event.stopPropagation();
        if (window.confirm(labels.confirmDeleteChat)) {
            await controller.deleteChatRoom(roomId);
        }
    }

    function setStageTab(tab: StageTab) {
        controller.setActiveStageTab(tab);
    }

    function openZoom(candidates: string[]) {
        setZoomOffset({ x: 0, y: 0 });
        setZoomDragStart(null);
        setZoomedImageCandidates(candidates);
    }

    function closeZoom() {
        setZoomDragStart(null);
        setZoomedImageCandidates(null);
    }

    function beginZoomDrag(event: React.PointerEvent<HTMLDivElement>) {
        event.currentTarget.setPointerCapture(event.pointerId);
        setZoomDragStart({ pointerId: event.pointerId, x: event.clientX, y: event.clientY, originX: zoomOffset.x, originY: zoomOffset.y });
    }

    function moveZoomDrag(event: React.PointerEvent<HTMLDivElement>) {
        if (!zoomDragStart || zoomDragStart.pointerId !== event.pointerId) {
            return;
        }
        setZoomOffset({ x: zoomDragStart.originX + event.clientX - zoomDragStart.x, y: zoomDragStart.originY + event.clientY - zoomDragStart.y });
    }

    function endZoomDrag(event: React.PointerEvent<HTMLDivElement>) {
        if (zoomDragStart?.pointerId === event.pointerId) {
            setZoomDragStart(null);
        }
    }

    if (!activeDetail) {
        return (
            <section className="ever-mobile-chat is-empty">
                <div className="ever-mobile-chat__empty">
                    <MessageCircle aria-hidden="true" size={40}/>
                    <strong>{labels.selectSpirit}</strong>
                    <button type="button" onClick={onBrowseRoster}>{labels.rosterTitle}</button>
                </div>
            </section>
        );
    }

    return (
        <section className={`ever-mobile-chat ${tone}`}>
            {assets && <img className="ever-mobile-chat__background" src={assets.background} alt=""/>}
            <div className="ever-mobile-chat__shade"/>
            <header className="ever-mobile-chat__header">
                <button type="button" className="ever-mobile-chat__back" aria-label={labels.rosterTitle} onClick={onBrowseRoster}>
                    <ChevronLeft aria-hidden="true" size={22}/>
                </button>
                <button type="button" className="ever-mobile-chat__title" onClick={controller.openProfileDetail}>
                    <strong>{activeDetail.name}</strong>
                    <span>{activeDetail.profile.nick_name ?? activeDetail.race}</span>
                </button>
                <span className={`ever-mobile-chat__engine ${llmStatus?.is_loaded ? 'is-on' : 'is-off'}`}>
                    <i aria-hidden="true"/>{llmStatus?.is_loaded ? labels.modelReady : labels.modelWaiting}
                </span>
            </header>

            <div className="ever-mobile-chat__hero">
                <button type="button" className={`ever-mobile-chat__portrait-button ${poked ? 'is-poked' : ''}`} aria-label={`${activeDetail.name} ${labels.spiritReaction}`} onClick={handlePortraitPoke}>
                    {displayLine && <span className="ever-mobile-chat__speech">{displayLine}</span>}
                    <LoadableAssetImage candidates={activeSkin?.portraitCandidates ?? []} alt={activeDetail.name} className="ever-mobile-chat__portrait" fallback={<span className="ever-mobile-chat__portrait-fallback">{activeDetail.name.charAt(0)}</span>}/>
                </button>
            </div>

            <nav className="ever-mobile-chat__stage-tabs" aria-label={labels.rosterTitle}>
                <button type="button" className={activeStageTab === 'chat' ? 'is-active' : ''} onClick={() => setStageTab('chat')}>
                    <MessageCircle aria-hidden="true" size={16}/><span>{labels.chat}</span>
                </button>
                <button type="button" className={activeStageTab === 'gallery' ? 'is-active' : ''} onClick={() => setStageTab('gallery')}>
                    <Images aria-hidden="true" size={16}/><span>{labels.gallery}</span>
                </button>
            </nav>

            {activeStageTab === 'chat' ? (
                <div className="ever-mobile-chat__panel">
                    <div className="ever-mobile-chat__roombar">
                        <div className="ever-mobile-chat__roombar-copy">
                            <strong>{activeRoom ? formatRoomTitle(activeRoom, labels) : activeDetail.name}</strong>
                            <span>{summary}</span>
                        </div>
                        <div className="ever-mobile-chat__roombar-actions">
                            <button type="button" aria-label={labels.newChat} onClick={controller.startNewChat}><Plus aria-hidden="true" size={16}/></button>
                            <button type="button" aria-label={labels.previousChats} className={historyOpen ? 'is-active' : ''} onClick={toggleHistory}><History aria-hidden="true" size={16}/></button>
                        </div>
                    </div>
                    {historyOpen && (
                        <div className="ever-mobile-chat__history">
                            {previousRoomsLoading && <span className="ever-mobile-chat__history-loading">…</span>}
                            {!previousRoomsLoading && previousRooms.length === 0 && (<span className="ever-mobile-chat__history-empty">{labels.noPreviousChats}</span>)}
                            {!previousRoomsLoading && previousRooms.map((room) => (
                                <div key={room.id} className={`ever-mobile-chat__history-item ${room.id === activeRoom?.id ? 'is-active' : ''}`}>
                                    <button type="button" onClick={async () => { await controller.switchToRoom(room); setHistoryOpen(false); }}>{formatDateTime(room.created_at, labels)}</button>
                                    <button type="button" aria-label={labels.deleteChat} onClick={(event) => handleDeleteRoom(event, room.id)}><X aria-hidden="true" size={14}/></button>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="ever-mobile-chat__messages" ref={messagesListRef}>
                        {messages.length === 0 && (
                            <div className="ever-mobile-chat__messages-empty">
                                <strong>{labels.noSavedMessages}</strong>
                                <span>{labels.firstMessageHint}</span>
                            </div>
                        )}
                        {messages.map((message) => (
                            <MobileMessageBubble key={message.id} message={message} spiritName={activeDetail.name} avatarCandidates={avatarCandidates} showReasoning={showReasoning} deleteLabel={labels.deleteMessage} onDelete={controller.deleteChatMessage}/>
                        ))}
                        {isTyping && (
                            <div className="ever-mobile-message is-spirit">
                                <div className="ever-mobile-message__avatar">
                                    <LoadableAssetImage candidates={avatarCandidates} alt={activeDetail.name} fallback={<span>{activeDetail.name.charAt(0)}</span>}/>
                                </div>
                                <div className="ever-mobile-message__bubble">
                                    {streamingText
                                        ? parseThinkBlocks(streamingText).map((block, idx) => (block.type === 'think'
                                            ? (showReasoning ? <div key={idx} className="ever-mobile-message__think">{block.content}</div> : null)
                                            : <span key={idx} className="ever-mobile-message__text">{block.content}</span>))
                                        : <span className="ever-mobile-typing"><i/><i/><i/></span>}
                                </div>
                            </div>
                        )}
                    </div>
                    <form className="ever-mobile-composer" onSubmit={controller.sendMessage}>
                        {choices.length > 0 && (
                            <div className="ever-mobile-composer__choices">
                                {choices.map((choice) => (
                                    <button key={choice.id} type="button" onClick={() => controller.setInputText(choice.label)}>
                                        <span>{choice.source}</span><strong>{choice.label}</strong>
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="ever-mobile-composer__row">
                            <input value={inputText} onChange={(event) => controller.setInputText(event.target.value)} disabled={!canUseComposer} placeholder={llmStatus?.is_loaded ? labels.messagePlaceholder(activeDetail.name) : labels.modelRequiredPlaceholder}/>
                            {streamingRequestId ? (
                                <button type="button" aria-label={labels.stopGenerating} onClick={controller.cancelStreaming}><Square aria-hidden="true" size={20}/></button>
                            ) : (
                                <button type="submit" aria-label={labels.send} disabled={!canUseComposer || !inputText.trim()}><Send aria-hidden="true" size={20}/></button>
                            )}
                        </div>
                    </form>
                </div>
            ) : (
                <div className="ever-mobile-chat__gallery">
                    <div className="ever-mobile-chat__gallery-head">
                        <strong>{activeDetail.name} {labels.imageGallery}</strong>
                        <span>{assets?.assetFolder ?? ''}</span>
                    </div>
                    <div className="ever-mobile-chat__gallery-grid">
                        {gallerySkins.map((skin) => (
                            <button key={skin.id} type="button" className="ever-mobile-chat__gallery-tile" aria-label={`${formatSkinLabel(skin, labels)} ${labels.zoomImage}`} onClick={() => openZoom(skin.portraitCandidates)}>
                                <LoadableAssetImage candidates={skin.portraitCandidates} alt={activeDetail.name} fallback={<span>{formatSkinLabel(skin, labels)}</span>}/>
                                <span>{formatSkinLabel(skin, labels)}</span>
                                <i className="ever-mobile-chat__gallery-zoom" aria-hidden="true"><ZoomIn size={16}/></i>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {zoomedImageCandidates && (
                <div className="ever-mobile-zoom-overlay" role="dialog" aria-modal="true" onClick={closeZoom}>
                    <button type="button" className="ever-mobile-zoom-close" aria-label={labels.close} onClick={closeZoom}><X aria-hidden="true" size={24}/></button>
                    <div className={`ever-mobile-zoom-frame ${zoomDragStart ? 'is-dragging' : ''}`} onClick={(event) => event.stopPropagation()} onPointerDown={beginZoomDrag} onPointerMove={moveZoomDrag} onPointerUp={endZoomDrag} onPointerCancel={endZoomDrag}>
                        <LoadableAssetImage candidates={zoomedImageCandidates} alt={activeDetail.name} className="ever-mobile-zoom-image" style={{ transform: `translate3d(${zoomOffset.x}px, ${zoomOffset.y}px, 0)` }} fallback={<span>{activeDetail.name}</span>}/>
                    </div>
                    <span className="ever-mobile-zoom-caption">{zoomedImageCandidates[0]?.split('/').slice(-1)[0] ?? ''}</span>
                </div>
            )}
        </section>
    );
}

function MobileMessageBubble({ message, spiritName, avatarCandidates, showReasoning, deleteLabel, onDelete }: MobileMessageBubbleProps) {
    if (message.role === 'system') {
        return (<div className="ever-mobile-message is-system"><div className="ever-mobile-message__bubble">{message.content}</div></div>);
    }
    const fromUser = message.role === 'user';
    return (
        <div className={`ever-mobile-message ${fromUser ? 'is-user' : 'is-spirit'}`}>
            {!fromUser && (
                <div className="ever-mobile-message__avatar">
                    <LoadableAssetImage candidates={avatarCandidates} alt={spiritName} fallback={<span>{spiritName.charAt(0) || 'E'}</span>}/>
                </div>
            )}
            <div className="ever-mobile-message__bubble">
                {fromUser
                    ? message.content
                    : parseThinkBlocks(message.content).map((block, idx) => (block.type === 'think'
                        ? (showReasoning ? <div key={idx} className="ever-mobile-message__think">{block.content}</div> : null)
                        : <span key={idx} className="ever-mobile-message__text">{block.content}</span>))}
            </div>
            <button type="button" className="ever-mobile-message__delete" aria-label={deleteLabel} onClick={() => void onDelete(message.id)}><X aria-hidden="true" size={12}/></button>
        </div>
    );
}
