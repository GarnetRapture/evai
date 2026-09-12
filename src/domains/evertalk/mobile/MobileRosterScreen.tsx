import { HeartHandshake, Star, Trophy, Users } from 'lucide-react';
import { getRaceTone, parseSpiritDetail } from '../../persona';
import { computeFamiliarityLevel, createConversationSummary, resolvePreferredSpiritsFamiliarity } from '../logic';
import { RosterAvatar, RosterExpBar, RosterRankBadge } from '../components/SpiritRosterCard';
import type { MobileRosterScreenProps } from './types';

export function MobileRosterScreen({ controller, onOpenChat }: MobileRosterScreenProps) {
    const { filteredSpirits: spirits, activeRosterTab, bondRanking, bondRankingLoading, familiarityList, familiarityLoading, preferredPersonaIds, activeSessionIds, personaSkinIds, appLanguage, labels } = controller;
    const preferredSpirits = resolvePreferredSpiritsFamiliarity(spirits, familiarityList, preferredPersonaIds);
    const rankedFamiliarity = familiarityList.filter((entry) => !preferredPersonaIds.includes(entry.persona_id));

    return (
        <section className="ever-mobile-roster">
            <header className="ever-mobile-topbar">
                <div>
                    <h1>{labels.rosterTitle}</h1>
                    <span>{labels.rosterSubtitle(spirits.length)}</span>
                </div>
            </header>
            <input className="ever-search" value={controller.searchQuery} onChange={(event) => controller.setSearchQuery(event.target.value)} placeholder={labels.searchPlaceholder}/>
            <nav className="ever-mobile-segment" aria-label={labels.rosterTitle}>
                <button type="button" className={activeRosterTab === 'list' ? 'is-active' : ''} onClick={() => controller.changeRosterTab('list')}>
                    <Users aria-hidden="true" size={16}/><span>{labels.list}</span>
                </button>
                <button type="button" className={activeRosterTab === 'bondRanking' ? 'is-active' : ''} onClick={() => controller.changeRosterTab('bondRanking')}>
                    <Trophy aria-hidden="true" size={16}/><span>{labels.bondRanking}</span>
                </button>
                <button type="button" className={activeRosterTab === 'familiarity' ? 'is-active' : ''} onClick={() => controller.changeRosterTab('familiarity')}>
                    <HeartHandshake aria-hidden="true" size={16}/><span>{labels.familiarity}</span>
                </button>
            </nav>
            <div className="ever-mobile-roster__list">
                {controller.personaLoadError && (<div className="ever-roster__error"><strong>{labels.dataLoadFailed}</strong><span>{controller.personaLoadError}</span></div>)}
                {activeRosterTab === 'list' && spirits.map((spirit) => {
                    const detail = parseSpiritDetail(spirit, appLanguage);
                    const preview = detail.personality.greeting || createConversationSummary(detail);
                    const isDefault = preferredPersonaIds.includes(spirit.id);
                    const famEntry = familiarityList.find((entry) => entry.persona_id === spirit.id);
                    const levelInfo = computeFamiliarityLevel(famEntry?.familiarity_score ?? 0);
                    return (
                        <div key={spirit.id} className={`ever-spirit-row ${controller.activeSpiritId === spirit.id ? 'is-active' : ''} ${getRaceTone(spirit.race)}`}>
                            <button className="ever-spirit-row__select" type="button" onClick={() => void onOpenChat(spirit.id)}>
                                <RosterAvatar detail={detail} level={levelInfo.level} skinId={personaSkinIds[spirit.id]} sessionActive={activeSessionIds.includes(spirit.id)} labels={labels}/>
                                <span className="ever-spirit-row__copy"><strong>{detail.name}</strong><small>{preview}</small>
                                    <RosterExpBar level={levelInfo.level} ratio={levelInfo.progressRatio} isMax={levelInfo.isMax}/>
                                </span>
                            </button>
                            <span className="ever-spirit-row__meta">
                                <b>{detail.grade}</b>
                                <button className={isDefault ? 'is-default' : ''} type="button" aria-pressed={isDefault} aria-label={isDefault ? labels.preferredSpiritClearAction(detail.name) : labels.preferredSpiritSetAction(detail.name)} onClick={() => void controller.toggleDefaultSpirit(spirit.id)}>
                                    <Star aria-hidden="true" size={16}/>
                                </button>
                            </span>
                        </div>
                    );
                })}
                {activeRosterTab === 'bondRanking' && bondRankingLoading && (<div className="ever-roster__empty"><strong>{labels.loadingBondRanking}</strong></div>)}
                {activeRosterTab === 'bondRanking' && !bondRankingLoading && bondRanking.length === 0 && (<div className="ever-roster__empty"><strong>{labels.noBondData}</strong><span>{labels.bondDescription}</span></div>)}
                {activeRosterTab === 'bondRanking' && !bondRankingLoading && bondRanking.map((entry, index) => {
                    const spirit = spirits.find((candidate) => candidate.id === entry.persona_id);
                    const detail = spirit ? parseSpiritDetail(spirit, appLanguage) : null;
                    const rankLevel = computeFamiliarityLevel(familiarityList.find((candidate) => candidate.persona_id === entry.persona_id)?.familiarity_score ?? 0);
                    return (
                        <div key={entry.persona_id} className={`ever-spirit-row ${controller.activeSpiritId === entry.persona_id ? 'is-active' : ''} ${spirit ? getRaceTone(spirit.race) : ''}`}>
                            <button className="ever-spirit-row__select" type="button" onClick={() => { if (spirit) { void onOpenChat(spirit.id); } }}>
                                {detail
                                    ? <RosterAvatar detail={detail} level={rankLevel.level} skinId={personaSkinIds[entry.persona_id]} sessionActive={activeSessionIds.includes(entry.persona_id)} labels={labels}/>
                                    : <span className="ever-spirit-row__icon"><span className="ever-spirit-row__icon-initial">{index + 1}</span></span>}
                                <span className="ever-spirit-row__copy"><strong>{detail?.name ?? entry.name_en}</strong><small>{labels.messages} {entry.message_count} · {labels.memories} {entry.memory_count}</small>
                                    <RosterExpBar level={rankLevel.level} ratio={rankLevel.progressRatio} isMax={rankLevel.isMax}/>
                                </span>
                            </button>
                            <span className="ever-spirit-row__meta"><RosterRankBadge rank={index + 1}/><b>{entry.bond_score}</b></span>
                        </div>
                    );
                })}
                {activeRosterTab === 'familiarity' && familiarityLoading && (<div className="ever-roster__empty"><strong>{labels.loadingFamiliarity}</strong></div>)}
                {activeRosterTab === 'familiarity' && !familiarityLoading && preferredSpirits.length > 0 && (
                    <div className="ever-roster__section">
                        <span className="ever-roster__section-label"><Star aria-hidden="true" size={14}/>{labels.preferredSpirit}</span>
                        {preferredSpirits.map((preferred) => {
                            const preferredDetail = parseSpiritDetail(preferred.spirit, appLanguage);
                            const preferredEntry = familiarityList.find((entry) => entry.persona_id === preferred.spirit.id) ?? null;
                            const preferredLevel = computeFamiliarityLevel(preferred.familiarity_score);
                            return (
                                <div key={preferred.spirit.id} className={`ever-spirit-row is-preferred ${controller.activeSpiritId === preferred.spirit.id ? 'is-active' : ''} ${getRaceTone(preferred.spirit.race)}`}>
                                    <button className="ever-spirit-row__select" type="button" onClick={() => { if (preferredEntry) { controller.openFamiliarityDetail(preferredEntry); } else { void onOpenChat(preferred.spirit.id); } }}>
                                        <RosterAvatar detail={preferredDetail} level={preferredLevel.level} skinId={personaSkinIds[preferred.spirit.id]} sessionActive={activeSessionIds.includes(preferred.spirit.id)} labels={labels}/>
                                        <span className="ever-spirit-row__copy"><strong>{preferredDetail.name}</strong><small>{labels.messages} {preferred.message_count} · {labels.memories} {preferred.memory_count}</small>
                                            <RosterExpBar level={preferredLevel.level} ratio={preferredLevel.progressRatio} isMax={preferredLevel.isMax}/>
                                        </span>
                                    </button>
                                    <span className="ever-spirit-row__meta">
                                        <b>{preferred.familiarity_score}</b>
                                        <button className="is-default" type="button" aria-pressed={true} aria-label={labels.preferredSpiritClearAction(preferredDetail.name)} onClick={() => void controller.toggleDefaultSpirit(preferred.spirit.id)}><Star aria-hidden="true" size={16}/></button>
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
                {activeRosterTab === 'familiarity' && !familiarityLoading && rankedFamiliarity.length === 0 && (<div className="ever-roster__empty"><strong>{labels.noFamiliarity}</strong><span>{spirits.length > 0 ? labels.familiarityDescription : labels.personaDbLoading}</span></div>)}
                {activeRosterTab === 'familiarity' && !familiarityLoading && rankedFamiliarity.map((entry, index) => {
                    const spirit = spirits.find((candidate) => candidate.id === entry.persona_id);
                    const detail = spirit ? parseSpiritDetail(spirit, appLanguage) : null;
                    const entryLevel = computeFamiliarityLevel(entry.familiarity_score);
                    return (
                        <div key={entry.persona_id} className={`ever-spirit-row ${controller.activeSpiritId === entry.persona_id ? 'is-active' : ''} ${spirit ? getRaceTone(spirit.race) : ''}`}>
                            <button className="ever-spirit-row__select" type="button" onClick={() => controller.openFamiliarityDetail(entry)}>
                                {detail
                                    ? <RosterAvatar detail={detail} level={entryLevel.level} skinId={personaSkinIds[entry.persona_id]} sessionActive={activeSessionIds.includes(entry.persona_id)} labels={labels}/>
                                    : <span className="ever-spirit-row__icon"><span className="ever-spirit-row__icon-initial">{index + 1}</span></span>}
                                <span className="ever-spirit-row__copy"><strong>{detail?.name ?? entry.name_en}</strong><small>{labels.messages} {entry.message_count} · {labels.memories} {entry.memory_count}</small>
                                    <RosterExpBar level={entryLevel.level} ratio={entryLevel.progressRatio} isMax={entryLevel.isMax}/>
                                </span>
                            </button>
                            <span className="ever-spirit-row__meta"><RosterRankBadge rank={index + 1}/><b>{entry.familiarity_score}</b></span>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
