import { Boxes, Images, PanelRightClose, PanelRightOpen, Settings } from 'lucide-react';
import { getRaceTone, getSpiritVisualAssets, resolveSpiritSkin } from '../../persona';
import { selectPanelKeywordThreads } from '../logic';
import type { SpiritProfilePanelProps } from '../types';
import { raceBadgeUrl } from '../uiAssets';
import { SpiritSkinPicker } from './SpiritSkinPicker';
import { MemoryInsightPanel } from './MemoryInsightPanel';
import { SystemStatusPanel } from './SystemStatusPanel';
export function SpiritProfilePanel({ activeDetail, activeSpiritId, activeSkinId, onSelectSkin, collapsed, systemStatuses, onToggleCollapsed, onOpenSettings, onOpenModuleManagement, onOpenBackgroundGallery, localStatus, memoryInsight, memoryInsightLoading, memoryOverview, contextGraph, contextGraphLoading, labels, onOpenProfileDetail, }: SpiritProfilePanelProps) {
    const tone = activeDetail ? getRaceTone(activeDetail.race) : 'tone-neutral';
    const graphMatchesSpirit = contextGraph !== null && contextGraph.persona_id === activeSpiritId;
    const keywordThreads = graphMatchesSpirit ? selectPanelKeywordThreads(contextGraph.keyword_threads) : [];
    const spiritUsage = memoryOverview?.entries.find((entry) => entry.persona_id === activeSpiritId) ?? null;
    const visualAssets = activeDetail ? getSpiritVisualAssets(activeDetail) : null;
    const skinOptions = visualAssets?.skinOptions ?? [];
    const activeSkin = visualAssets ? resolveSpiritSkin(visualAssets, activeSkinId) : null;
    return (<aside className={`ever-profile ${tone} ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="ever-profile__toolbar">
        <button className="ever-profile__toggle" type="button" aria-label={labels.backgroundGallery} onClick={onOpenBackgroundGallery}>
          <Images aria-hidden="true" size={20}/>
        </button>
        <button className="ever-profile__toggle" type="button" aria-label={labels.settingsOpen} onClick={onOpenSettings}>
          <Settings aria-hidden="true" size={20}/>
        </button>
        <button className="ever-profile__toggle" type="button" aria-label={labels.moduleManagement} title={labels.moduleManagement} onClick={onOpenModuleManagement}>
          <Boxes aria-hidden="true" size={20}/>
        </button>
        <button className="ever-profile__toggle" type="button" aria-label={collapsed ? labels.expandRight : labels.collapseRight} onClick={onToggleCollapsed}>
          {collapsed ? <PanelRightOpen aria-hidden="true" size={20}/> : <PanelRightClose aria-hidden="true" size={20}/>}
        </button>
      </div>
      {collapsed ? null : (<>
      <SystemStatusPanel statuses={systemStatuses} labels={labels}/>
      {activeDetail ? (<>
          <section className="ever-profile-card">
            <p className="ever-kicker">{labels.bondStatus}</p>
            <button className="ever-profile-card__name" type="button" onClick={onOpenProfileDetail}>
              {activeDetail.name}
            </button>
            <span>{activeDetail.name_en}</span>
            <div className="ever-profile-grid">
              <div><small>{labels.grade}</small><strong>{activeDetail.grade}</strong></div>
              <div><small>{labels.race}</small><strong><img className="ever-profile-race-badge" src={raceBadgeUrl(activeDetail.race)} alt=""/>{activeDetail.race}</strong></div>
              <div><small>{labels.className}</small><strong>{activeDetail.class}</strong></div>
              <div><small>{labels.union}</small><strong>{activeDetail.profile?.union ?? '-'}</strong></div>
            </div>
            <button className="ever-sync-button" type="button" onClick={onOpenProfileDetail}>{labels.profileDetail}</button>
          </section>

          {skinOptions.length > 1 && (
            <section className="ever-panel-section ever-skin-section">
              <h3>{labels.skinSelector(activeDetail.name)}</h3>
              <SpiritSkinPicker skinOptions={skinOptions} activeSkinId={activeSkin?.id} spiritName={activeDetail.name} labels={labels} onSelectSkin={onSelectSkin}/>
            </section>
          )}

          <section className="ever-panel-section">
            <h3>{labels.localStatus}</h3>
            <div className="ever-profile-grid">
              <div><small>{labels.personaCount}</small><strong>{localStatus?.persona_count ?? '-'}</strong></div>
              <div><small>{labels.chatRooms}</small><strong>{localStatus?.chat_room_count ?? '-'}</strong></div>
              <div><small>{labels.chatMessages}</small><strong>{localStatus?.chat_message_count ?? '-'}</strong></div>
              <div><small>{labels.localMemories}</small><strong>{localStatus?.memory_count ?? '-'}</strong></div>
            </div>
            <div className="ever-profile-grid ever-profile-grid--spirit">
              <div><small>{labels.messagesLabel}</small><strong>{spiritUsage?.message_count ?? 0}</strong></div>
              <div><small>{labels.memoriesLabel}</small><strong>{spiritUsage?.episodic_total ?? 0}</strong></div>
              <div><small>{labels.bondStatus}</small><strong>{graphMatchesSpirit ? labels.familiarityLevel(contextGraph.familiarity_level) : '-'}</strong></div>
              <div><small>{labels.lastActivityLabel}</small><strong>{spiritUsage ? new Date(spiritUsage.latest_activity_at).toLocaleDateString(labels.localeTag) : '-'}</strong></div>
            </div>
          </section>

          <MemoryInsightPanel insight={memoryInsight} loading={memoryInsightLoading} labels={labels}/>

          <section className="ever-panel-section">
            <h3>{labels.conversationKeywords}</h3>
            {contextGraphLoading && keywordThreads.length === 0 ? <p className="ever-profile-choices__empty">{labels.checking}</p> : null}
            {!contextGraphLoading && keywordThreads.length === 0 ? <p className="ever-profile-choices__empty">{labels.noStoredData}</p> : null}
            <div className="ever-profile-choices">
              {keywordThreads.map((thread) => (<div key={thread.keyword.token}>
                  <span>{labels.memoryGraphKeywordCounts(thread.keyword.user_count, thread.keyword.spirit_count)}</span>
                  <strong>{thread.keyword.token}</strong>
                  <time dateTime={thread.keyword.last_seen_at}>{new Date(thread.keyword.last_seen_at).toLocaleDateString(labels.localeTag)}</time>
                </div>))}
            </div>
          </section>

          <section className="ever-panel-section">
            <h3>{labels.personality}</h3>
            <p>{activeDetail.personality?.description ?? labels.noPersonality}</p>
            <div className="ever-tags">
              {activeDetail.profile?.like?.map((item) => <span key={`like-${item}`}>{labels.like} {item}</span>)}
              {activeDetail.profile?.hobby?.map((item) => <span key={`hobby-${item}`}>{labels.hobby} {item}</span>)}
            </div>
          </section>

        </>) : (<div className="ever-empty-panel">{labels.emptyProfilePanel}</div>)}
        </>)}
    </aside>);
}
