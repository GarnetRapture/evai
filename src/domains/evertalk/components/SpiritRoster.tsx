import { Bell, PanelLeftClose, PanelLeftOpen, Star } from 'lucide-react';
import { getRaceTone, parseSpiritDetail } from '../../persona';
import { computeFamiliarityLevel, createConversationSummary, resolvePreferredSpiritsFamiliarity } from '../logic';
import type { SpiritRosterProps } from '../types';
import { EVERTALK_UI_ASSETS, rosterDecorationStyle } from '../uiAssets';
import { RosterAvatar, RosterExpBar, RosterRankBadge } from './SpiritRosterCard';
function ProactiveUnreadBadge({ count, label }: { count: number; label: string }) {
    if (count <= 0) return null;
    return <span className="ever-spirit-row__unread" aria-label={label} title={label}><Bell aria-hidden="true" size={11}/>{count > 99 ? '99+' : count}</span>;
}
export function SpiritRoster({ spirits, activeSpiritId, searchQuery, loadError, preferredPersonaIds, activeTab, collapsed, bondRanking, bondRankingLoading, familiarityList, familiarityLoading, labels, appLanguage, activeSessionIds, personaSkinIds, proactiveUnreadCounts, onSearchChange, onSelect, onToggleDefault, onTabChange, onToggleCollapsed, onOpenFamiliarity, }: SpiritRosterProps) {
    const hasSpirits = spirits.length > 0;
    const preferredSpirits = resolvePreferredSpiritsFamiliarity(spirits, familiarityList, preferredPersonaIds);
    const rankedFamiliarity = familiarityList.filter((entry) => !preferredPersonaIds.includes(entry.persona_id));
    return (<aside className={`ever-roster ${collapsed ? 'is-collapsed' : ''}`} style={rosterDecorationStyle()}>
      <img className="ever-roster__rail" src={EVERTALK_UI_ASSETS.verticalRail} alt="" aria-hidden="true"/>
      <div className="ever-roster__top">
        {!collapsed && (<div>
            <h1>{labels.rosterTitle}</h1>
            <span>{labels.rosterSubtitle(spirits.length)}</span>
          </div>)}
        <button className="ever-roster__toggle" type="button" aria-label={collapsed ? labels.expandLeft : labels.collapseLeft} onClick={onToggleCollapsed}>
          {collapsed ? <PanelLeftOpen aria-hidden="true" size={20}/> : <PanelLeftClose aria-hidden="true" size={20}/>}
        </button>
      </div>
      {collapsed ? null : (<>
      <input className="ever-search" value={searchQuery} onChange={(event) => onSearchChange(event.target.value)} placeholder={labels.searchPlaceholder}/>
      <div className="ever-roster__list">
        {loadError && (<div className="ever-roster__error">
            <strong>{labels.dataLoadFailed}</strong>
            <span>{loadError}</span>
          </div>)}
        {!loadError && spirits.length === 0 && (<div className="ever-roster__empty">
            <strong>{labels.databasePending}</strong>
            <span>{labels.personaPackChecking}</span>
          </div>)}
        {activeTab === 'list' && spirits.map((spirit) => {
                const active = activeSpiritId === spirit.id;
                const isDefault = preferredPersonaIds.includes(spirit.id);
                const isSessionActive = activeSessionIds.includes(spirit.id);
                const detail = parseSpiritDetail(spirit, appLanguage);
                const preview = detail.personality.greeting || createConversationSummary(detail);
                const famEntry = familiarityList.find((entry) => entry.persona_id === spirit.id);
                const levelInfo = computeFamiliarityLevel(famEntry?.familiarity_score ?? 0);
                return (<div key={spirit.id} className={`ever-spirit-row ${active ? 'is-active' : ''} ${getRaceTone(spirit.race)}`}>
                <button className="ever-spirit-row__select" type="button" onClick={() => onSelect(spirit)}>
                  <RosterAvatar detail={detail} level={levelInfo.level} skinId={personaSkinIds[spirit.id]} sessionActive={isSessionActive} labels={labels}/>
                  <span className="ever-spirit-row__copy">
                    <strong>{detail.name}</strong>
                    <small>{preview}</small>
                    <RosterExpBar level={levelInfo.level} ratio={levelInfo.progressRatio} isMax={levelInfo.isMax}/>
                  </span>
                </button>
                <span className="ever-spirit-row__meta">
                  <ProactiveUnreadBadge count={proactiveUnreadCounts[spirit.id] ?? 0} label={labels.proactiveUnreadCount(proactiveUnreadCounts[spirit.id] ?? 0)}/>
                  <b>{detail.grade}</b>
                  <button className={isDefault ? 'is-default' : ''} type="button" aria-pressed={isDefault} aria-label={isDefault ? labels.preferredSpiritClearAction(detail.name) : labels.preferredSpiritSetAction(detail.name)} title={isDefault ? labels.preferredSpiritClearAction(detail.name) : labels.preferredSpiritSetAction(detail.name)} onClick={() => {
                        void onToggleDefault(spirit.id);
                    }}>
                    <Star aria-hidden="true" size={16}/>
                  </button>
                </span>
              </div>);
            })}
        {activeTab === 'bondRanking' && bondRankingLoading && (<div className="ever-roster__empty">
            <strong>{labels.loadingBondRanking}</strong>
          </div>)}
        {activeTab === 'bondRanking' && !bondRankingLoading && bondRanking.length === 0 && (<div className="ever-roster__empty">
            <strong>{labels.noBondData}</strong>
            <span>{labels.bondDescription}</span>
          </div>)}
        {activeTab === 'bondRanking' && !bondRankingLoading && bondRanking.map((entry, index) => {
          const spirit = spirits.find((s) => s.id === entry.persona_id);
          const detail = spirit ? parseSpiritDetail(spirit, appLanguage) : null;
          const rankLevel = computeFamiliarityLevel(familiarityList.find((candidate) => candidate.persona_id === entry.persona_id)?.familiarity_score ?? 0);
          return (<div key={entry.persona_id} className={`ever-spirit-row ${activeSpiritId === entry.persona_id ? 'is-active' : ''} ${spirit ? getRaceTone(spirit.race) : ''}`}>
            <button className="ever-spirit-row__select" type="button" onClick={() => {
                    if (spirit) {
                        onSelect(spirit);
                    }
                }}>
              {detail
                ? <RosterAvatar detail={detail} level={rankLevel.level} skinId={personaSkinIds[entry.persona_id]} sessionActive={activeSessionIds.includes(entry.persona_id)} labels={labels}/>
                : <span className="ever-spirit-row__icon"><span className="ever-spirit-row__icon-initial">{index + 1}</span></span>}
              <span className="ever-spirit-row__copy">
                <strong>{detail?.name ?? entry.name_en}</strong>
                <small>{labels.messages} {entry.message_count} · {labels.memories} {entry.memory_count}</small>
                <RosterExpBar level={rankLevel.level} ratio={rankLevel.progressRatio} isMax={rankLevel.isMax}/>
              </span>
            </button>
            <span className="ever-spirit-row__meta">
              <ProactiveUnreadBadge count={proactiveUnreadCounts[entry.persona_id] ?? 0} label={labels.proactiveUnreadCount(proactiveUnreadCounts[entry.persona_id] ?? 0)}/>
              <RosterRankBadge rank={index + 1}/>
              <b>{entry.bond_score}</b>
            </span>
          </div>);
        })}
        {activeTab === 'familiarity' && familiarityLoading && (<div className="ever-roster__empty">
            <strong>{labels.loadingFamiliarity}</strong>
          </div>)}
        {activeTab === 'familiarity' && !familiarityLoading && preferredSpirits.length > 0 && (<div className="ever-roster__section">
            <span className="ever-roster__section-label">
              <Star aria-hidden="true" size={14}/>
              {labels.preferredSpirit}
            </span>
            {preferredSpirits.map((preferred) => {
              const preferredDetail = parseSpiritDetail(preferred.spirit, appLanguage);
              const preferredEntry = familiarityList.find((entry) => entry.persona_id === preferred.spirit.id) ?? null;
              const preferredLevel = computeFamiliarityLevel(preferred.familiarity_score);
              return (<div key={preferred.spirit.id} className={`ever-spirit-row is-preferred ${activeSpiritId === preferred.spirit.id ? 'is-active' : ''} ${getRaceTone(preferred.spirit.race)}`}>
                <button className="ever-spirit-row__select" type="button" onClick={() => { if (preferredEntry) { onOpenFamiliarity(preferredEntry); } else { onSelect(preferred.spirit); } }}>
                  <RosterAvatar detail={preferredDetail} level={preferredLevel.level} skinId={personaSkinIds[preferred.spirit.id]} sessionActive={activeSessionIds.includes(preferred.spirit.id)} labels={labels}/>
                  <span className="ever-spirit-row__copy">
                    <strong>{preferredDetail.name}</strong>
                    <small>{labels.messages} {preferred.message_count} · {labels.memories} {preferred.memory_count}</small>
                    <RosterExpBar level={preferredLevel.level} ratio={preferredLevel.progressRatio} isMax={preferredLevel.isMax}/>
                  </span>
                </button>
                <span className="ever-spirit-row__meta">
                  <ProactiveUnreadBadge count={proactiveUnreadCounts[preferred.spirit.id] ?? 0} label={labels.proactiveUnreadCount(proactiveUnreadCounts[preferred.spirit.id] ?? 0)}/>
                  <b>{preferred.familiarity_score}</b>
                  <button className="is-default" type="button" aria-pressed={true} aria-label={labels.preferredSpiritClearAction(preferredDetail.name)} title={labels.preferredSpiritClearAction(preferredDetail.name)} onClick={() => {
                          void onToggleDefault(preferred.spirit.id);
                      }}>
                    <Star aria-hidden="true" size={16}/>
                  </button>
                </span>
              </div>);
            })}
          </div>)}
        {activeTab === 'familiarity' && !familiarityLoading && rankedFamiliarity.length === 0 && (<div className="ever-roster__empty">
            <strong>{labels.noFamiliarity}</strong>
            <span>{hasSpirits ? labels.familiarityDescription : labels.personaDbLoading}</span>
          </div>)}
        {activeTab === 'familiarity' && !familiarityLoading && rankedFamiliarity.map((entry, index) => {
          const spirit = spirits.find((s) => s.id === entry.persona_id);
          const detail = spirit ? parseSpiritDetail(spirit, appLanguage) : null;
          const entryLevel = computeFamiliarityLevel(entry.familiarity_score);
          return (<div key={entry.persona_id} className={`ever-spirit-row ${activeSpiritId === entry.persona_id ? 'is-active' : ''} ${spirit ? getRaceTone(spirit.race) : ''}`}>
            <button className="ever-spirit-row__select" type="button" onClick={() => onOpenFamiliarity(entry)}>
              {detail
                ? <RosterAvatar detail={detail} level={entryLevel.level} skinId={personaSkinIds[entry.persona_id]} sessionActive={activeSessionIds.includes(entry.persona_id)} labels={labels}/>
                : <span className="ever-spirit-row__icon"><span className="ever-spirit-row__icon-initial">{index + 1}</span></span>}
              <span className="ever-spirit-row__copy">
                <strong>{detail?.name ?? entry.name_en}</strong>
                <small>{labels.messages} {entry.message_count} · {labels.memories} {entry.memory_count}</small>
                <RosterExpBar level={entryLevel.level} ratio={entryLevel.progressRatio} isMax={entryLevel.isMax}/>
              </span>
            </button>
            <span className="ever-spirit-row__meta">
              <ProactiveUnreadBadge count={proactiveUnreadCounts[entry.persona_id] ?? 0} label={labels.proactiveUnreadCount(proactiveUnreadCounts[entry.persona_id] ?? 0)}/>
              <RosterRankBadge rank={index + 1}/>
              <b>{entry.familiarity_score}</b>
            </span>
          </div>);
        })}
      </div>
      <nav className="ever-tabbar" aria-label={labels.rosterTitle}>
        <button className={activeTab === 'list' ? 'is-active' : ''} type="button" onClick={() => onTabChange('list')}>
          <span className="ever-tabbar__icon">
            <img src={EVERTALK_UI_ASSETS.tabChat} alt="" aria-hidden="true"/>
            <img className="is-pressed" src={EVERTALK_UI_ASSETS.tabChatPressed} alt="" aria-hidden="true"/>
          </span>
          <span>{labels.list}</span>
        </button>
        <button className={activeTab === 'bondRanking' ? 'is-active' : ''} type="button" onClick={() => onTabChange('bondRanking')}>
          <span className="ever-tabbar__icon">
            <img src={EVERTALK_UI_ASSETS.tabGallery} alt="" aria-hidden="true"/>
            <img className="is-pressed" src={EVERTALK_UI_ASSETS.tabGalleryPressed} alt="" aria-hidden="true"/>
          </span>
          <span>{labels.bondRanking}</span>
        </button>
        <button className={activeTab === 'familiarity' ? 'is-active' : ''} type="button" onClick={() => onTabChange('familiarity')}>
          <span className="ever-tabbar__icon">
            <img src={EVERTALK_UI_ASSETS.tabBond} alt="" aria-hidden="true"/>
            <img className="is-pressed" src={EVERTALK_UI_ASSETS.tabBondPressed} alt="" aria-hidden="true"/>
          </span>
          <span>{labels.familiarity}</span>
        </button>
      </nav>
      </>)}
    </aside>);
}
