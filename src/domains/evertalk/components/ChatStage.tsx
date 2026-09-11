import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { Images, MessageCircle, Send, Sparkles, Square, X, ZoomIn } from 'lucide-react';
import { getRaceTone, getSpiritVisualAssets, resolveSpiritSkin } from '../../persona';
import { createConversationSummary, createTalkChoices, formatDateTime, formatRoomTitle, formatSkinLabel, pickRandomSpeechLine, pickPokeReactionLine } from '../logic';
import type { SpiritVisualAssets } from '../../persona';
import type { ChatMessageBubbleProps, ChatStageProps, GalleryTileProps, ZoomDragState, ZoomOffset } from '../types';
import { LoadableAssetImage } from './LoadableAssetImage';
const GalleryTile = memo(function GalleryTile({ skin, skinLabel, spiritName, zoomLabel, onZoom }: GalleryTileProps) {
    return (<button type="button" className="ever-gallery-tile ever-gallery-tile--button" aria-label={`${skinLabel} ${zoomLabel}`} onClick={() => onZoom(skin.portraitCandidates)}>
      <LoadableAssetImage candidates={skin.portraitCandidates} alt={spiritName} fallback={<span>{skinLabel}</span>}/>
      <span className="ever-gallery-tile__label">{skinLabel}</span>
      <span className="ever-gallery-tile__zoom-hint" aria-hidden="true">
        <ZoomIn size={18}/>
      </span>
    </button>);
});
function parseThinkBlocks(text: string) {
    const parts: { type: 'think' | 'text'; content: string }[] = [];
    const regex = /<think>([\s\S]*?)(?:<\/think>|$)/gi;
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
        }
        parts.push({ type: 'think', content: match[1] });
        lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
        parts.push({ type: 'text', content: text.substring(lastIndex) });
    }
    return parts;
}
const ChatMessageBubble = memo(function ChatMessageBubble({ message, avatarCandidates, spiritName, showReasoning, deleteLabel, onDelete }: ChatMessageBubbleProps) {
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
        {fromUser ? (
           message.content
        ) : (
           parseThinkBlocks(message.content).map((block, idx) => {
               if (block.type === 'think') {
                   return showReasoning ? <div key={idx} className="ever-message__think">{block.content}</div> : null;
               }
               return <span key={idx} className="ever-message__text">{block.content}</span>;
           })
        )}
      </div>
      <button type="button" className="ever-message__delete" aria-label={deleteLabel} onClick={() => onDelete(message.id)}>
        <X aria-hidden="true" size={12}/>
      </button>
    </div>);
});
export function ChatStage({ activeDetail, activeRoom, llmStatus, messages, previousRooms, previousRoomsLoading, onStartNewChat, onLoadPreviousRooms, onSwitchToRoom, onDeleteMessage, onDeleteRoom, inputText, isTyping, streamingText, streamingRequestId, onCancelStreaming, activeStageTab, onInputChange, onSendMessage, onStageTabChange, messagesListRef, labels, onOpenProfileDetail, showReasoning, activeSkinId, onSelectSkin }: ChatStageProps) {
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
    const speechLine = useMemo(() => pickRandomSpeechLine(activeDetail), [activeDetail?.id]);
    const canUseComposer = Boolean(activeDetail && llmStatus?.is_loaded && !isTyping);
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
        pokeTimeoutRef.current = setTimeout(() => {
            setPoked(false);
        }, 1600);
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
        setZoomDragStart({
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            originX: zoomOffset.x,
            originY: zoomOffset.y,
        });
    }
    function moveZoomDrag(event: React.PointerEvent<HTMLDivElement>) {
        if (!zoomDragStart || zoomDragStart.pointerId !== event.pointerId) {
            return;
        }
        setZoomOffset({
            x: zoomDragStart.originX + event.clientX - zoomDragStart.x,
            y: zoomDragStart.originY + event.clientY - zoomDragStart.y,
        });
    }
    function endZoomDrag(event: React.PointerEvent<HTMLDivElement>) {
        if (zoomDragStart?.pointerId === event.pointerId) {
            setZoomDragStart(null);
        }
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
          {assets && assets.skinOptions.length > 1 && (<div className="ever-character__skins" aria-label={labels.skinSelector(activeDetail?.name ?? '')}>
              {assets.skinOptions.map((skin) => (<button key={skin.id} type="button" className={skin.id === activeSkin?.id ? 'is-active' : ''} aria-pressed={skin.id === activeSkin?.id} onClick={() => void onSelectSkin(skin.id)}>
                  {formatSkinLabel(skin, labels)}
                </button>))}
            </div>)}
          {activeDetail && (<button type="button" className="ever-character__caption ever-character__caption--button" onClick={onOpenProfileDetail}>
              <strong>{activeDetail.name_en}</strong>
              <span>{activeDetail.profile.nick_name ?? activeDetail.race}</span>
            </button>)}
        </div>

        {activeStageTab === 'chat' ? (<div className="ever-chat-panel">
            <div className="ever-chat-panel__room">
              <strong>{activeRoom ? formatRoomTitle(activeRoom, labels) : activeDetail?.name ?? labels.bondChannel}</strong>
              <span>{summary}</span>
              <div className="ever-chat-panel__room-actions">
                <button type="button" disabled={!activeDetail} aria-label={labels.newChat} onClick={onStartNewChat}>
                  {labels.newChat}
                </button>
                <button type="button" disabled={!activeDetail} aria-label={labels.previousChats} onClick={toggleHistory}>
                  {labels.previousChats}
                </button>
              </div>
              {historyOpen && (<div className="ever-chat-panel__history">
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
              {messages.length === 0 && (<div className="ever-messages__empty">
                  <strong>{labels.noSavedMessages}</strong>
                  <span>{labels.firstMessageHint}</span>
                </div>)}
              {messages.map((message) => (<ChatMessageBubble key={message.id} message={message} avatarCandidates={activeSkin?.avatarCandidates ?? assets?.avatarCandidates ?? []} spiritName={activeDetail?.name ?? ''} showReasoning={showReasoning} deleteLabel={labels.deleteMessage} onDelete={onDeleteMessage} />))}
              {isTyping && (<div className="ever-message is-spirit">
                  <div className="ever-message__avatar">
                    <LoadableAssetImage candidates={activeSkin?.avatarCandidates ?? assets?.avatarCandidates ?? []} alt={activeDetail?.name ?? ''} fallback={<span>{activeDetail?.name.charAt(0) ?? 'E'}</span>}/>
                  </div>
                  <div className="ever-message__bubble">
                    {streamingText
                      ? parseThinkBlocks(streamingText).map((block, idx) => {
                          if (block.type === 'think') {
                              return showReasoning ? <div key={idx} className="ever-message__think">{block.content}</div> : null;
                          }
                          return <span key={idx} className="ever-message__text">{block.content}</span>;
                      })
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
          <MessageCircle aria-hidden="true" size={25}/>
          <span>{labels.chat}</span>
        </button>
        <button className={activeStageTab === 'gallery' ? 'is-active' : ''} type="button" onClick={() => onStageTabChange('gallery')}>
          <Images aria-hidden="true" size={25}/>
          <span>{labels.gallery}</span>
        </button>
      </nav>
      {zoomedImageCandidates && (<div className="ever-background-zoom-overlay" role="dialog" aria-modal="true" onClick={closeZoom}>
          <button type="button" className="ever-background-zoom-close" aria-label={labels.close} onClick={closeZoom}>
            <X aria-hidden="true" size={24}/>
          </button>
          <div
            className={`ever-background-zoom-frame ${zoomDragStart ? 'is-dragging' : ''}`}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={beginZoomDrag}
            onPointerMove={moveZoomDrag}
            onPointerUp={endZoomDrag}
            onPointerCancel={endZoomDrag}
          >
            <LoadableAssetImage
              candidates={zoomedImageCandidates}
              alt={activeDetail?.name ?? ''}
              className="ever-background-zoom-image"
              style={{ transform: `translate3d(${zoomOffset.x}px, ${zoomOffset.y}px, 0)` }}
              fallback={<span>{activeDetail?.name ?? ''}</span>}
            />
          </div>
          <span className="ever-background-zoom-caption">{zoomedImageCandidates[0]?.split('/').slice(-1)[0] ?? ''}</span>
        </div>)}
    </main>);
}
