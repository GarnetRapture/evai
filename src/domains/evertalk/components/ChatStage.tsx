import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { Maximize2, Minimize2, Minus, Send, Sparkles, Square, X, ZoomIn } from 'lucide-react';
import { getRaceTone, getSpiritVisualAssets, resolveSpiritSkin } from '../../persona';
import { CHAT_PANEL_MIN_HEIGHT, CHAT_PANEL_MIN_WIDTH, CHAT_PANEL_RESIZE_HANDLES, createConversationSummary, createTalkChoices, formatDateTime, formatRoomTitle, formatSkinLabel, pickRandomSpeechLine, pickPokeReactionLine, resolvePanelResize } from '../logic';
import type { SpiritVisualAssets } from '../../persona';
import type { ChatMessageBubbleProps, ChatStageProps, GalleryTileProps, PanelGeometry, PanelResizeHandle, PanelResizeState } from '../types';
import { EVERTALK_UI_ASSETS } from '../uiAssets';
import { ImageViewerOverlay } from './ImageViewerOverlay';
import { LoadableAssetImage } from './LoadableAssetImage';
import { SpiritReplyContent } from './SpiritReplyContent';
const GalleryTile = memo(function GalleryTile({ skin, skinLabel, spiritName, zoomLabel, onZoom }: GalleryTileProps) {
    return (<button type="button" className="ever-gallery-tile ever-gallery-tile--button" aria-label={`${skinLabel} ${zoomLabel}`} onClick={() => onZoom(skin.portraitCandidates)}>
      <LoadableAssetImage candidates={skin.portraitCandidates} alt={spiritName} fallback={<span>{skinLabel}</span>}/>
      <span className="ever-gallery-tile__label">{skinLabel}</span>
      <span className="ever-gallery-tile__zoom-hint" aria-hidden="true">
        <ZoomIn size={18}/>
      </span>
    </button>);
});
const PANEL_SHAKE_DURATION_MS = 400;
const PANEL_BOUNDARY_TOLERANCE_PX = 1;
const ChatMessageBubble = memo(function ChatMessageBubble({ message, avatarCandidates, spiritName, showReasoning, deleteLabel, innerThoughtsLabel, onDelete }: ChatMessageBubbleProps) {
    if (message.role === 'system') {
        return (<div className="ever-message is-system">
          <div className="ever-message__bubble">{message.content}</div>
        </div>);
    }
    const fromUser = message.role === 'user';
    return (<div className={`ever-message ${fromUser ? 'is-user' : 'is-spirit'}`}>
      {!fromUser && (<div className="ever-message__avatar">
          <LoadableAssetImage candidates={avatarCandidates} alt={spiritName} fallback={<span>{spiritName.charAt(0) || 'E'}</span>}/>
        </div>)}
      <div className="ever-message__bubble">
        {fromUser
          ? message.content
          : <SpiritReplyContent text={message.content} showReasoning={showReasoning} variant="desktop" innerThoughtsLabel={innerThoughtsLabel}/>}
      </div>
      <button type="button" className="ever-message__delete" aria-label={deleteLabel} onClick={() => onDelete(message.id)}>
        <X aria-hidden="true" size={12}/>
      </button>
    </div>);
});
export function ChatStage({ activeDetail, activeRoom, llmStatus, messages, previousRooms, previousRoomsLoading, onStartNewChat, onLoadPreviousRooms, onSwitchToRoom, onDeleteMessage, onDeleteRoom, inputText, isTyping, streamingText, streamingRequestId, onCancelStreaming, activeStageTab, onInputChange, onSendMessage, onStageTabChange, messagesListRef, labels, onOpenProfileDetail, showReasoning, activeSkinId }: ChatStageProps) {
    const [historyOpen, setHistoryOpen] = useState(false);
    async function toggleHistory() {
        const next = !historyOpen;
        setHistoryOpen(next);
        if (next) {
            await onLoadPreviousRooms();
        }
    }
    async function handleDeleteRoom(event: React.MouseEvent, roomId: string) {
        event.stopPropagation();
        if (window.confirm(labels.confirmDeleteChat)) {
            await onDeleteRoom(roomId);
        }
    }
    const assets: SpiritVisualAssets | null = useMemo(() => (activeDetail ? getSpiritVisualAssets(activeDetail) : null), [activeDetail]);
    const tone = useMemo(() => (activeDetail ? getRaceTone(activeDetail.race) : 'tone-neutral'), [activeDetail]);
    const choices = useMemo(() => createTalkChoices(activeDetail, labels), [activeDetail, labels]);
    const summary = useMemo(() => createConversationSummary(activeDetail), [activeDetail]);
    const activeSkin = useMemo(() => (assets ? resolveSpiritSkin(assets, activeSkinId) : null), [activeSkinId, assets]);
    const gallerySkins = useMemo(() => assets?.skinOptions ?? [], [assets]);
    const openingGreeting = activeDetail?.personality.greeting?.trim() ?? '';
    const speechLine = useMemo(() => pickRandomSpeechLine(activeDetail), [activeDetail]);
    const canUseComposer = Boolean(activeDetail && llmStatus?.is_loaded && !isTyping);
    const [poked, setPoked] = useState(false);
    const [displayLine, setDisplayLine] = useState(speechLine);
    const [zoomedImageCandidates, setZoomedImageCandidates] = useState<string[] | null>(null);
    const [panelState, setPanelState] = useState<'normal' | 'minimized' | 'maximized'>('normal');
    const [panelSize, setPanelSize] = useState<{ width: number; height: number } | null>(null);
    const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);
    const [panelShake, setPanelShake] = useState(false);
    const panelRef = useRef<HTMLDivElement | null>(null);
    const panelResizeRef = useRef<PanelResizeState | null>(null);
    const panelDragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
    const panelShakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pokeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    function readPanelGeometry(): PanelGeometry | null {
        const panel = panelRef.current;
        const parent = panel?.offsetParent as HTMLElement | null;
        if (!panel || !parent) {
            return null;
        }
        const panelRect = panel.getBoundingClientRect();
        const parentRect = parent.getBoundingClientRect();
        return {
            x: panelRect.left - parentRect.left - parent.clientLeft,
            y: panelRect.top - parentRect.top - parent.clientTop,
            width: panelRect.width,
            height: panelRect.height,
            parentWidth: parent.clientWidth,
            parentHeight: parent.clientHeight,
        };
    }
    function beginPanelDrag(event: React.PointerEvent<HTMLElement>) {
        if (panelState === 'maximized') {
            return;
        }
        const geometry = readPanelGeometry();
        if (!geometry) {
            return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        panelDragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originX: geometry.x,
            originY: geometry.y,
        };
        setPanelSize({ width: geometry.width, height: geometry.height });
        setPanelPos({ x: geometry.x, y: geometry.y });
    }
    function triggerBoundaryShake() {
        if (panelShakeTimeoutRef.current) {
            return;
        }
        setPanelShake(true);
        panelShakeTimeoutRef.current = setTimeout(() => {
            panelShakeTimeoutRef.current = null;
            setPanelShake(false);
        }, PANEL_SHAKE_DURATION_MS);
    }
    function movePanelDrag(event: React.PointerEvent<HTMLElement>) {
        const drag = panelDragRef.current;
        const geometry = readPanelGeometry();
        if (!drag || drag.pointerId !== event.pointerId || !geometry) {
            return;
        }
        const rawX = drag.originX + event.clientX - drag.startX;
        const rawY = drag.originY + event.clientY - drag.startY;
        const maxX = geometry.parentWidth - geometry.width;
        const maxY = geometry.parentHeight - geometry.height;
        const clampedX = maxX <= 0 ? 0 : Math.min(Math.max(0, rawX), maxX);
        const clampedY = maxY <= 0 ? 0 : Math.min(Math.max(0, rawY), maxY);
        const blockedX = maxX > 0 && Math.abs(rawX - clampedX) > PANEL_BOUNDARY_TOLERANCE_PX;
        const blockedY = maxY > 0 && Math.abs(rawY - clampedY) > PANEL_BOUNDARY_TOLERANCE_PX;
        if (blockedX || blockedY) {
            triggerBoundaryShake();
        }
        setPanelPos({ x: clampedX, y: clampedY });
    }
    function endPanelDrag(event: React.PointerEvent<HTMLElement>) {
        if (panelDragRef.current?.pointerId === event.pointerId) {
            panelDragRef.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }
        }
    }
    function beginPanelResize(event: React.PointerEvent<HTMLDivElement>, handle: PanelResizeHandle) {
        event.stopPropagation();
        const geometry = readPanelGeometry();
        if (!geometry) {
            return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        panelResizeRef.current = {
            pointerId: event.pointerId,
            handle,
            startX: event.clientX,
            startY: event.clientY,
            originX: geometry.x,
            originY: geometry.y,
            originWidth: geometry.width,
            originHeight: geometry.height,
            parentWidth: geometry.parentWidth,
            parentHeight: geometry.parentHeight,
        };
        setPanelSize({ width: geometry.width, height: geometry.height });
        setPanelPos({ x: geometry.x, y: geometry.y });
    }
    function movePanelResize(event: React.PointerEvent<HTMLDivElement>) {
        const resize = panelResizeRef.current;
        if (!resize || resize.pointerId !== event.pointerId) {
            return;
        }
        const next = resolvePanelResize(resize, event.clientX - resize.startX, event.clientY - resize.startY);
        setPanelSize({ width: next.width, height: next.height });
        setPanelPos({ x: next.x, y: next.y });
        if (next.blocked) {
            triggerBoundaryShake();
        }
    }
    function endPanelResize(event: React.PointerEvent<HTMLDivElement>) {
        if (panelResizeRef.current?.pointerId === event.pointerId) {
            panelResizeRef.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }
        }
    }
    useEffect(() => {
        const panel = panelRef.current;
        const parent = panel?.offsetParent as HTMLElement | null;
        if (!parent || panelState !== 'normal') {
            return;
        }
        const observer = new ResizeObserver(() => {
            setPanelSize((currentSize) => {
                if (!currentSize) {
                    return currentSize;
                }
                const width = Math.min(currentSize.width, Math.max(CHAT_PANEL_MIN_WIDTH, parent.clientWidth));
                const height = Math.min(currentSize.height, Math.max(CHAT_PANEL_MIN_HEIGHT, parent.clientHeight));
                return width === currentSize.width && height === currentSize.height ? currentSize : { width, height };
            });
            setPanelPos((currentPos) => {
                if (!currentPos) {
                    return currentPos;
                }
                const maxX = Math.max(0, parent.clientWidth - (panel?.offsetWidth ?? 0));
                const maxY = Math.max(0, parent.clientHeight - (panel?.offsetHeight ?? 0));
                const x = Math.min(currentPos.x, maxX);
                const y = Math.min(currentPos.y, maxY);
                return x === currentPos.x && y === currentPos.y ? currentPos : { x, y };
            });
        });
        observer.observe(parent);
        return () => observer.disconnect();
    }, [panelState, activeStageTab]);
    function togglePanelMaximize() {
        setPanelState((prev) => (prev === 'maximized' ? 'normal' : 'maximized'));
    }
    function togglePanelMinimize() {
        setPanelState((prev) => (prev === 'minimized' ? 'normal' : 'minimized'));
    }
    useEffect(() => {
        setDisplayLine(speechLine);
        setPoked(false);
        return () => {
            if (pokeTimeoutRef.current) {
                clearTimeout(pokeTimeoutRef.current);
            }
            if (panelShakeTimeoutRef.current) {
                clearTimeout(panelShakeTimeoutRef.current);
                panelShakeTimeoutRef.current = null;
            }
        };
    }, [speechLine]);
    function handlePortraitPoke() {
        if (!activeDetail) {
            return;
        }
        setDisplayLine(pickPokeReactionLine(activeDetail, displayLine));
        setPoked(true);
        if (pokeTimeoutRef.current) {
            clearTimeout(pokeTimeoutRef.current);
        }
        pokeTimeoutRef.current = setTimeout(() => {
            setPoked(false);
        }, 1600);
    }
    function openZoom(candidates: string[]) {
        setZoomedImageCandidates(candidates);
    }
    function closeZoom() {
        setZoomedImageCandidates(null);
    }
    return (<main className={`ever-stage ${tone}`}>
      {assets && <img className="ever-stage__background" src={assets.background} alt=""/>}
      <div className="ever-stage__shade"/>
      <header className="ever-stage__header">
        <div>
          <Sparkles aria-hidden="true" size={22}/>
          <button className="ever-stage__profile-button" type="button" disabled={!activeDetail} onClick={onOpenProfileDetail}>
            {activeDetail?.name ?? labels.selectSpirit}
          </button>
        </div>
        <X aria-hidden="true" size={20}/>
        <div className={`ever-engine ${llmStatus?.is_loaded ? 'is-on' : 'is-off'}`}>
          <span />
          {llmStatus?.is_loaded ? labels.modelReady : labels.modelWaiting}
        </div>
      </header>

      <section className="ever-stage__body">
        <div className="ever-character" key={activeDetail?.id ?? 'none'}>
          <div className={`ever-character__figure ${poked ? 'is-poked' : ''}`}>
            {displayLine && <div className="ever-character__speech">{displayLine}</div>}
            <button
              type="button"
              className="ever-character__touch-target"
              aria-label={activeDetail ? `${activeDetail.name} ${labels.spiritReaction}` : labels.spiritReaction}
              disabled={!activeDetail}
              onClick={handlePortraitPoke}
            >
              <LoadableAssetImage candidates={activeSkin?.portraitCandidates ?? []} alt={activeDetail?.name ?? ''} className="ever-character__portrait" fallback={<div className="ever-character__fallback">{activeDetail?.name.charAt(0) ?? 'E'}</div>}/>
              <span className="ever-character__blush" aria-hidden="true" />
            </button>
          </div>
          <div className="ever-character__overlay">
            {activeDetail && (<button type="button" className="ever-character__caption ever-character__caption--button" onClick={onOpenProfileDetail}>
                <strong>{activeDetail.name_en}</strong>
                <span>{activeDetail.profile.nick_name ?? activeDetail.race}</span>
              </button>)}
          </div>
        </div>

        {activeStageTab === 'chat' ? (<div ref={panelRef} className={`ever-chat-panel is-${panelState} ${panelPos && panelState === 'normal' ? 'is-floating' : ''} ${panelShake ? 'is-shake' : ''}`} style={panelState === 'normal' ? { ...(panelSize ? { width: panelSize.width, height: panelSize.height } : {}), ...(panelPos ? { position: 'absolute', left: panelPos.x, top: panelPos.y, margin: 0 } : {}) } : undefined}>
            <div className="ever-chat-panel__room ever-chat-panel__room--draggable" onPointerDown={beginPanelDrag} onPointerMove={movePanelDrag} onPointerUp={endPanelDrag} onPointerCancel={endPanelDrag}>
              <strong>{activeRoom ? formatRoomTitle(activeRoom, labels) : activeDetail?.name ?? labels.bondChannel}</strong>
              <span>{summary}</span>
              <div className="ever-chat-panel__window-controls" onPointerDown={(event) => event.stopPropagation()}>
                <button type="button" aria-label={labels.windowMinimize} onClick={togglePanelMinimize}><Minus aria-hidden="true" size={15}/></button>
                <button type="button" aria-label={panelState === 'maximized' ? labels.windowRestore : labels.windowMaximize} onClick={togglePanelMaximize}>
                  {panelState === 'maximized' ? <Minimize2 aria-hidden="true" size={14}/> : <Maximize2 aria-hidden="true" size={14}/>}
                </button>
              </div>
              <div className="ever-chat-panel__room-actions" onPointerDown={(event) => event.stopPropagation()}>
                <button type="button" disabled={!activeDetail} aria-label={labels.newChat} onClick={onStartNewChat}>
                  {labels.newChat}
                </button>
                <button type="button" disabled={!activeDetail} aria-label={labels.previousChats} onClick={toggleHistory}>
                  {labels.previousChats}
                </button>
              </div>
              {historyOpen && (<div className="ever-chat-panel__history" onPointerDown={(event) => event.stopPropagation()}>
                  {previousRoomsLoading && <span className="ever-chat-panel__history-loading">…</span>}
                  {!previousRoomsLoading && previousRooms.length === 0 && (
                    <span className="ever-chat-panel__history-empty">{labels.noPreviousChats}</span>
                  )}
                  {!previousRoomsLoading && previousRooms.map((room) => (
                    <div key={room.id} className={`ever-chat-panel__history-item ${room.id === activeRoom?.id ? 'is-active' : ''}`}>
                      <button type="button" onClick={async () => { await onSwitchToRoom(room); setHistoryOpen(false); }}>
                        {formatDateTime(room.created_at, labels)}
                      </button>
                      <button type="button" aria-label={labels.deleteChat} onClick={(event) => handleDeleteRoom(event, room.id)}>
                        <X aria-hidden="true" size={14}/>
                      </button>
                    </div>
                  ))}
                </div>)}
            </div>
            <div className="ever-messages" ref={messagesListRef}>
              {openingGreeting.length > 0 && (<div className="ever-message is-spirit is-opening">
                  <div className="ever-message__avatar">
                    <LoadableAssetImage candidates={activeSkin?.avatarCandidates ?? assets?.avatarCandidates ?? []} alt={activeDetail?.name ?? ''} fallback={<span>{activeDetail?.name.charAt(0) ?? 'E'}</span>}/>
                  </div>
                  <div className="ever-message__bubble"><span className="ever-message__text">{openingGreeting}</span></div>
                </div>)}
              {messages.length === 0 && openingGreeting.length === 0 && (<div className="ever-messages__empty">
                  <strong>{labels.noSavedMessages}</strong>
                  <span>{labels.firstMessageHint}</span>
                </div>)}
              {messages.map((message) => (<ChatMessageBubble key={message.id} message={message} avatarCandidates={activeSkin?.avatarCandidates ?? assets?.avatarCandidates ?? []} spiritName={activeDetail?.name ?? ''} showReasoning={showReasoning} deleteLabel={labels.deleteMessage} innerThoughtsLabel={labels.innerThoughts} onDelete={onDeleteMessage} />))}
              {isTyping && (<div className="ever-message is-spirit">
                  <div className="ever-message__avatar">
                    <LoadableAssetImage candidates={activeSkin?.avatarCandidates ?? assets?.avatarCandidates ?? []} alt={activeDetail?.name ?? ''} fallback={<span>{activeDetail?.name.charAt(0) ?? 'E'}</span>}/>
                  </div>
                  <div className="ever-message__bubble">
                    {streamingText
                      ? <SpiritReplyContent text={streamingText} showReasoning={showReasoning} variant="desktop" innerThoughtsLabel={labels.innerThoughts}/>
                      : <span className="ever-typing"><i /><i /><i /></span>}
                  </div>
                </div>)}
            </div>
            <form className="ever-composer" onSubmit={onSendMessage}>
              {choices.length > 0 && (<div className="ever-choice-strip">
                  {choices.map((choice) => (<button key={choice.id} type="button" onClick={() => onInputChange(choice.label)}>
                      <span>{choice.source}</span>
                      <strong>{choice.label}</strong>
                    </button>))}
                </div>)}
              <input value={inputText} onChange={(event) => onInputChange(event.target.value)} disabled={!canUseComposer} placeholder={activeDetail && llmStatus?.is_loaded ? labels.messagePlaceholder(activeDetail.name) : labels.modelRequiredPlaceholder}/>
              {streamingRequestId ? (
                <button type="button" aria-label={labels.stopGenerating} onClick={onCancelStreaming}>
                  <Square aria-hidden="true" size={22}/>
                </button>
              ) : (
                <button type="submit" aria-label={labels.send} disabled={!canUseComposer || !inputText.trim()}>
                  <Send aria-hidden="true" size={22}/>
                </button>
              )}
            </form>
            {panelState === 'normal' && CHAT_PANEL_RESIZE_HANDLES.map((handle) => (
              <div
                key={handle}
                className={`ever-chat-panel__resize ever-chat-panel__resize--${handle}`}
                onPointerDown={(event) => beginPanelResize(event, handle)}
                onPointerMove={movePanelResize}
                onPointerUp={endPanelResize}
                onPointerCancel={endPanelResize}
              />
            ))}
          </div>) : (<div className="ever-gallery-panel">
            <div className="ever-chat-panel__room">
              <strong>{activeDetail?.name ?? labels.selectSpirit} {labels.imageGallery}</strong>
              <span>{assets?.assetFolder ?? ''}</span>
            </div>
            <div className="ever-gallery-grid">
              {gallerySkins.map((skin) => (<GalleryTile key={skin.id} skin={skin} skinLabel={formatSkinLabel(skin, labels)} spiritName={activeDetail?.name ?? ''} zoomLabel={labels.zoomImage} onZoom={openZoom}/>))}
            </div>
          </div>)}
      </section>
      <nav className="ever-tabbar ever-stage-tabs" aria-label={labels.rosterTitle}>
        <button className={activeStageTab === 'chat' ? 'is-active' : ''} type="button" onClick={() => onStageTabChange('chat')}>
          <span className="ever-tabbar__icon">
            <img src={EVERTALK_UI_ASSETS.tabChat} alt="" aria-hidden="true"/>
            <img className="is-pressed" src={EVERTALK_UI_ASSETS.tabChatPressed} alt="" aria-hidden="true"/>
          </span>
          <span>{labels.chat}</span>
        </button>
        <button className={activeStageTab === 'gallery' ? 'is-active' : ''} type="button" onClick={() => onStageTabChange('gallery')}>
          <span className="ever-tabbar__icon">
            <img src={EVERTALK_UI_ASSETS.tabGallery} alt="" aria-hidden="true"/>
            <img className="is-pressed" src={EVERTALK_UI_ASSETS.tabGalleryPressed} alt="" aria-hidden="true"/>
          </span>
          <span>{labels.gallery}</span>
        </button>
      </nav>
      <ImageViewerOverlay
        open={zoomedImageCandidates !== null}
        candidates={zoomedImageCandidates ?? []}
        alt={activeDetail?.name ?? ''}
        caption={zoomedImageCandidates?.[0]?.split('/').slice(-1)[0] ?? ''}
        labels={labels}
        onClose={closeZoom}
      />
    </main>);
}
