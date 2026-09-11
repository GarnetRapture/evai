import { Boxes, Images, PanelRightClose, PanelRightOpen, Settings } from 'lucide-react';
import { getRaceTone, getSpiritVisualAssets } from '../../persona';
import { createTalkChoices } from '../logic';
import type { SpiritProfilePanelProps } from '../types';
import { AppInfoPanel } from './AppInfoPanel';
import { SystemStatusPanel } from './SystemStatusPanel';
export function SpiritProfilePanel({ activeDetail, collapsed, systemStatuses, styles, activeStyle, isSyncing, onSyncStyles, onSelectStyle, onToggleCollapsed, onOpenSettings, onOpenModuleManagement, onOpenBackgroundGallery, localStatus, labels, onOpenProfileDetail, }: SpiritProfilePanelProps) {
    const assets = activeDetail ? getSpiritVisualAssets(activeDetail) : null;
    const tone = activeDetail ? getRaceTone(activeDetail.race) : 'tone-neutral';
    const choices = createTalkChoices(activeDetail, labels);
    return (<aside className={`ever-profile ${tone} ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="ever-profile__toolbar">
        <button className="ever-profile__toggle" type="button" aria-label={labels.backgroundGallery} onClick={onOpenBackgroundGallery}>
          <Images aria-hidden="true" size={20}/>
        </button>
        <button className="ever-profile__toggle" type="button" aria-label={labels.settingsOpen} onClick={onOpenSettings}>
          <Settings aria-hidden="true" size={20}/>
        </button>
        <button className="ever-profile__toggle" type="button" aria-label="모듈 관리" title="모듈 관리" onClick={onOpenModuleManagement}>
          <Boxes aria-hidden="true" size={20}/>
        </button>
        <button className="ever-profile__toggle" type="button" aria-label={collapsed ? labels.expandRight : labels.collapseRight} onClick={onToggleCollapsed}>
          {collapsed ? <PanelRightOpen aria-hidden="true" size={20}/> : <PanelRightClose aria-hidden="true" size={20}/>}
        </button>
      </div>
      {collapsed ? null : (<>
      <SystemStatusPanel statuses={systemStatuses} labels={labels}/>
      <AppInfoPanel labels={labels}/>
      {activeDetail ? (<>
          <section className="ever-profile-card">
            <p className="ever-kicker">{labels.bondStatus}</p>
            <button className="ever-profile-card__name" type="button" onClick={onOpenProfileDetail}>
              {activeDetail.name}
            </button>
            <span>{activeDetail.name_en}</span>
            <div className="ever-profile-grid">
              <div><small>{labels.grade}</small><strong>{activeDetail.grade}</strong></div>
              <div><small>{labels.race}</small><strong>{activeDetail.race}</strong></div>
              <div><small>{labels.className}</small><strong>{activeDetail.class}</strong></div>
              <div><small>{labels.union}</small><strong>{activeDetail.profile?.union ?? '-'}</strong></div>
            </div>
            <button className="ever-sync-button" type="button" onClick={onOpenProfileDetail}>{labels.profileDetail}</button>
          </section>

          <section className="ever-panel-section">
            <h3>{labels.localStatus}</h3>
            <div className="ever-profile-grid">
              <div><small>{labels.personaCount}</small><strong>{localStatus?.persona_count ?? '-'}</strong></div>
              <div><small>{labels.chatRooms}</small><strong>{localStatus?.chat_room_count ?? '-'}</strong></div>
              <div><small>{labels.chatMessages}</small><strong>{localStatus?.chat_message_count ?? '-'}</strong></div>
              <div><small>{labels.localMemories}</small><strong>{localStatus?.memory_count ?? '-'}</strong></div>
            </div>
          </section>

          <section className="ever-panel-section">
            <h3>{labels.conversationKeywords}</h3>
            <div className="ever-profile-choices">
              {choices.map((choice) => (<div key={choice.id}>
                  <span>{choice.source}</span>
                  <strong>{choice.label}</strong>
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

          <section className="ever-panel-section">
            <h3>{labels.assetConnection}</h3>
            <div className="ever-asset-status">
              <span>{labels.folder}</span>
              <strong>{assets?.assetFolder ?? labels.disconnected}</strong>
            </div>
            <div className="ever-asset-status">
              <span>{labels.background}</span>
              <strong>{assets?.background.split('/').slice(-1)[0]}</strong>
            </div>
          </section>

          <section className="ever-panel-section">
            <h3>{labels.speakingStyle}</h3>
            {activeStyle && (<div className="ever-active-style">
                <strong>{activeStyle.name}</strong>
                <span>{activeStyle.tone} / {activeStyle.formality}</span>
              </div>)}
            {styles.length === 0 ? (<button className="ever-sync-button" type="button" disabled={isSyncing} onClick={onSyncStyles}>
                {isSyncing ? labels.syncing : labels.syncServerStyle}
              </button>) : (<div className="ever-style-list">
                {styles.map((style) => (<button key={style.id} type="button" className={style.is_active ? 'is-active' : ''} onClick={() => onSelectStyle(style.id)}>
                    {style.name}
                  </button>))}
              </div>)}
          </section>
        </>) : (<div className="ever-empty-panel">{labels.emptyProfilePanel}</div>)}
        </>)}
    </aside>);
}
