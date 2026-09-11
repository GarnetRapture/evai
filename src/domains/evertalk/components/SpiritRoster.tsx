import { HeartHandshake, PanelLeftClose, PanelLeftOpen, Star, Trophy, Users } from 'lucide-react';
import { getRaceTone, getSpiritVisualAssets, parseSpiritDetail } from '../../persona';
import { createConversationSummary, resolvePreferredSpiritFamiliarity } from '../logic';
import type { SpiritRosterProps } from '../types';
import { LoadableAssetImage } from './LoadableAssetImage';
export function SpiritRoster({ spirits, activeSpiritId, searchQuery, loadError, defaultPersonaId, activeTab, collapsed, bondRanking, bondRankingLoading, familiarityList, familiarityLoading, labels, appLanguage, activeSessionIds, onSearchChange, onSelect, onToggleDefault, onTabChange, onToggleCollapsed, }: SpiritRosterProps) {
    const hasSpirits = spirits.length > 0;
    const preferredSpirit = resolvePreferredSpiritFamiliarity(spirits, familiarityList, defaultPersonaId);
    const preferredSpiritDetail = preferredSpirit ? parseSpiritDetail(preferredSpirit.spirit, appLanguage) : null;
    const rankedFamiliarity = familiarityList.filter((entry) => entry.persona_id !== preferredSpirit?.spirit.id);
    return (<aside className={`ever-roster ${collapsed ? 'is-collapsed' : ''}`}>
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
                const isDefault = defaultPersonaId === spirit.id;
                const isSessionActive = activeSessionIds.includes(spirit.id);
                const detail = parseSpiritDetail(spirit, appLanguage);
                const assets = getSpiritVisualAssets(detail);
                const preview = detail.personality.greeting || createConversationSummary(detail);
                return (<div key={spirit.id} className={`ever-spirit-row ${active ? 'is-active' : ''} ${getRaceTone(spirit.race)}`}>
                <button className="ever-spirit-row__select" type="button" onClick={() => onSelect(spirit)}>
                  <span className="ever-spirit-row__icon">
                    <LoadableAssetImage candidates={assets.avatarCandidates} alt={detail.name} fallback={<span>{detail.name.charAt(0)}</span>}/>
                    {isSessionActive && (<span className="ever-spirit-row__session-badge" title={labels.activeSessionBadge}/>)}
                  </span>
                  <span className="ever-spirit-row__copy">
                    <strong>{detail.name}</strong>
                    <small>{preview}</small>
                  </span>
                </button>
                <span className="ever-spirit-row__meta">
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
          return (<div key={entry.persona_id} className={`ever-spirit-row ${activeSpiritId === entry.persona_id ? 'is-active' : ''}`}>
            <button className="ever-spirit-row__select" type="button" onClick={() => {
                    if (spirit) {
                        onSelect(spirit);
                    }
                }}>
              <span className="ever-spirit-row__icon">
                <span>{index + 1}</span>
              </span>
              <span className="ever-spirit-row__copy">
                <strong>{detail?.name ?? entry.name_en}</strong>
                <small>{labels.messages} {entry.message_count} · {labels.memories} {entry.memory_count}</small>
              </span>
            </button>
            <span className="ever-spirit-row__meta">
              <b>{entry.bond_score}</b>
            </span>
          </div>);
        })}
        {activeTab === 'familiarity' && familiarityLoading && (<div className="ever-roster__empty">
            <strong>{labels.loadingFamiliarity}</strong>
          </div>)}
        {activeTab === 'familiarity' && !familiarityLoading && preferredSpirit && preferredSpiritDetail && (<div className="ever-roster__section">
            <span className="ever-roster__section-label">
              <Star aria-hidden="true" size={14}/>
              {labels.preferredSpirit}
            </span>
            <div className={`ever-spirit-row is-preferred ${activeSpiritId === preferredSpirit.spirit.id ? 'is-active' : ''} ${getRaceTone(preferredSpirit.spirit.race)}`}>
              <button className="ever-spirit-row__select" type="button" onClick={() => onSelect(preferredSpirit.spirit)}>
                <span className="ever-spirit-row__icon">
                  <LoadableAssetImage candidates={getSpiritVisualAssets(preferredSpiritDetail).avatarCandidates} alt={preferredSpiritDetail.name} fallback={<span>{preferredSpiritDetail.name.charAt(0)}</span>}/>
                </span>
                <span className="ever-spirit-row__copy">
                  <strong>{preferredSpiritDetail.name}</strong>
                  <small>{labels.messages} {preferredSpirit.message_count} · {labels.memories} {preferredSpirit.memory_count}</small>
                </span>
              </button>
              <span className="ever-spirit-row__meta">
                <b>{preferredSpirit.familiarity_score}</b>
                <button className="is-default" type="button" aria-pressed={true} aria-label={labels.preferredSpiritClearAction(preferredSpiritDetail.name)} title={labels.preferredSpiritClearAction(preferredSpiritDetail.name)} onClick={() => {
                        void onToggleDefault(preferredSpirit.spirit.id);
                    }}>
                  <Star aria-hidden="true" size={16}/>
                </button>
              </span>
            </div>
          </div>)}
        {activeTab === 'familiarity' && !familiarityLoading && rankedFamiliarity.length === 0 && (<div className="ever-roster__empty">
            <strong>{labels.noFamiliarity}</strong>
            <span>{hasSpirits ? labels.familiarityDescription : labels.personaDbLoading}</span>
          </div>)}
        {activeTab === 'familiarity' && !familiarityLoading && rankedFamiliarity.map((entry, index) => {
          const spirit = spirits.find((s) => s.id === entry.persona_id);
          const detail = spirit ? parseSpiritDetail(spirit, appLanguage) : null;
          return (<div key={entry.persona_id} className={`ever-spirit-row ${activeSpiritId === entry.persona_id ? 'is-active' : ''}`}>
            <button className="ever-spirit-row__select" type="button" onClick={() => {
                    if (spirit) {
                        onSelect(spirit);
                    }
                }}>
              <span className="ever-spirit-row__icon">
                <span>{index + 1}</span>
              </span>
              <span className="ever-spirit-row__copy">
                <strong>{detail?.name ?? entry.name_en}</strong>
                <small>{labels.messages} {entry.message_count} · {labels.memories} {entry.memory_count}</small>
              </span>
            </button>
            <span className="ever-spirit-row__meta">
              <b>{entry.familiarity_score}</b>
            </span>
          </div>);
        })}
      </div>
      <nav className="ever-tabbar" aria-label={labels.rosterTitle}>
        <button className={activeTab === 'list' ? 'is-active' : ''} type="button" onClick={() => onTabChange('list')}>
          <Users aria-hidden="true" size={22}/>
          <span>{labels.list}</span>
        </button>
        <button className={activeTab === 'bondRanking' ? 'is-active' : ''} type="button" onClick={() => onTabChange('bondRanking')}>
          <Trophy aria-hidden="true" size={22}/>
          <span>{labels.bondRanking}</span>
        </button>
        <button className={activeTab === 'familiarity' ? 'is-active' : ''} type="button" onClick={() => onTabChange('familiarity')}>
          <HeartHandshake aria-hidden="true" size={22}/>
          <span>{labels.familiarity}</span>
        </button>
      </nav>
      </>)}
    </aside>);
}
