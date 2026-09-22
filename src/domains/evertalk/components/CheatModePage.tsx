import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { FlaskConical, RotateCcw, Search } from 'lucide-react';
import {
    FAMILIARITY_MAX_LEVEL,
    PERSONA_EMOTION_PRESETS,
    PERSONA_PERSONALITY_PRESETS,
    PERSONA_SPEECH_PRESETS,
    computeFamiliarityLevel,
    familiarityScore,
    getSpiritVisualAssets,
    parseSpiritDetail,
    resolveSpiritSkin,
} from '../../persona';
import type { PersonaCheatPresetPatch } from '../../persona';
import { FAMILIARITY_SIGIL_MILESTONES, familiaritySigilFrameUrl, resolveFamiliaritySigilGrade } from '../logic';
import type { CheatPresetGridProps, EverTalkController, WorkspacePageProps } from '../types';
import { CHEAT_PRESET_ICON_ASSETS, DECOR_UI_ASSETS, EVERTALK_UI_ASSETS, LOBBY_UI_ASSETS, loveFrameAssetForLevel } from '../uiAssets';
import { LoadableAssetImage } from './LoadableAssetImage';
import { RosterAvatar } from './SpiritRosterCard';
import { WorkspaceSurface } from './WorkspaceSurface';

const CHEAT_ASSET_STYLE = {
    '--ever-cheat-deco': `url(${DECOR_UI_ASSETS.sectionDeco})`,
    '--ever-cheat-badge': `url(${DECOR_UI_ASSETS.levelBadge})`,
    '--ever-cheat-gauge': `url(${DECOR_UI_ASSETS.gaugeGradient})`,
    '--ever-cheat-edge': `url(${DECOR_UI_ASSETS.cardEdge})`,
    '--ever-cheat-heart': `url(${DECOR_UI_ASSETS.heart})`,
    '--ever-cheat-ribbon': `url(${LOBBY_UI_ASSETS.ribbonLabel})`,
    '--ever-cheat-stripe': `url(${LOBBY_UI_ASSETS.stripePattern})`,
    '--ever-cheat-chip': `url(${EVERTALK_UI_ASSETS.keywordChip})`,
} as CSSProperties;

function CheatSectionTitle({ title, description }: { title: string; description?: string }) {
    return (
        <header className="ever-cheat-section-title">
            <h3><i aria-hidden="true"/>{title}</h3>
            {description && <p>{description}</p>}
        </header>
    );
}

function CheatPresetGrid<Id extends string>({ title, description, options, icons, selected, language, onSelect }: CheatPresetGridProps<Id>) {
    return (
        <section className="ever-cheat-presets">
            <CheatSectionTitle title={title} description={description}/>
            <div className="ever-cheat-presets__grid" role="radiogroup" aria-label={title}>
                {options.map((option) => {
                    const active = option.id === selected;
                    return (
                        <button
                            key={option.id}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            className={`ever-cheat-preset ${active ? 'is-selected' : ''}`}
                            onClick={() => onSelect(option.id)}
                        >
                            <span className="ever-cheat-preset__icon" aria-hidden="true">
                                <img src={icons[option.id]} alt=""/>
                            </span>
                            <span className="ever-cheat-preset__text">
                                <strong>{option.labels[language]}</strong>
                                <small>{option.descriptions[language]}</small>
                            </span>
                            <img className="ever-cheat-preset__heart" src={active ? EVERTALK_UI_ASSETS.keywordHeartFilled : EVERTALK_UI_ASSETS.keywordHeartEmpty} alt="" aria-hidden="true"/>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}

function CheatSpiritEditor({ controller, personaId }: WorkspacePageProps & { personaId: string }) {
    const { labels, appLanguage } = controller;
    const spirit = controller.allSpirits.find((candidate) => candidate.id === personaId);
    const preset = controller.personaCheatPresets[personaId];
    const entry = controller.familiarityList.find((candidate) => candidate.persona_id === personaId);
    const automaticLevel = computeFamiliarityLevel(familiarityScore(entry?.message_count ?? 0, entry?.memory_count ?? 0, entry?.affinity_exp ?? 0)).level;
    const committedLevel = preset?.bond_level ?? null;
    const [draftLevel, setDraftLevel] = useState<number>(committedLevel ?? automaticLevel);
    if (!spirit) return null;
    const detail = parseSpiritDetail(spirit, appLanguage);
    const assets = getSpiritVisualAssets(detail);
    const skin = resolveSpiritSkin(assets, controller.personaSkinIds[personaId]);
    const displayLevel = committedLevel === null ? automaticLevel : draftLevel;
    const sigilGrade = resolveFamiliaritySigilGrade(displayLevel);

    function update(patch: PersonaCheatPresetPatch) {
        void controller.updatePersonaCheatPreset(personaId, patch);
    }

    function commitDraftLevel() {
        if (draftLevel !== committedLevel) {
            update({ bond_level: draftLevel });
        }
    }

    return (
        <article className="ever-cheat-editor">
            <header className="ever-cheat-editor__hero">
                <img className="ever-cheat-editor__hero-background" src={assets.background} alt="" aria-hidden="true"/>
                <div className="ever-cheat-editor__frame">
                    <LoadableAssetImage
                        candidates={[...(skin?.portraitCandidates ?? []), ...assets.portraitCandidates]}
                        alt={detail.name}
                        className="ever-cheat-editor__portrait"
                        fallback={<span className="ever-cheat-editor__portrait-fallback">{detail.name.charAt(0)}</span>}
                    />
                    <img className="ever-cheat-editor__frame-art" src={loveFrameAssetForLevel(displayLevel)} alt="" aria-hidden="true"/>
                </div>
                <div className="ever-cheat-editor__identity">
                    <small>{detail.name_en}</small>
                    <h2>{detail.name}</h2>
                    <span className="ever-cheat-editor__level-tag">
                        <b>Lv.{displayLevel}</b>
                        {committedLevel === null ? labels.cheatBondAutomatic : labels.cheatBondManualLevel(committedLevel)}
                    </span>
                    {sigilGrade && <img className="ever-cheat-editor__sigil" src={familiaritySigilFrameUrl(sigilGrade)} alt={labels.familiaritySigilGradeNames[sigilGrade]}/>}
                </div>
            </header>

            <section className="ever-cheat-bond">
                <CheatSectionTitle title={labels.cheatBondTitle} description={labels.cheatBondDescription}/>
                <div className={`ever-cheat-bond__panel ${committedLevel === null ? 'is-automatic' : ''}`}>
                    <div className="ever-cheat-bond__level">
                        <b>{displayLevel}</b>
                        <small>/ {FAMILIARITY_MAX_LEVEL}</small>
                    </div>
                    <div className="ever-cheat-bond__meter">
                        <div className="ever-cheat-bond__track">
                            <span className="ever-cheat-bond__fill" style={{ width: `${levelPercent(displayLevel)}%` }}/>
                            <input
                                type="range"
                                min={1}
                                max={FAMILIARITY_MAX_LEVEL}
                                value={displayLevel}
                                aria-label={labels.cheatBondTitle}
                                onChange={(event) => setDraftLevel(Number(event.target.value))}
                                onPointerDown={() => { if (committedLevel === null) setDraftLevel(automaticLevel); }}
                                onPointerUp={commitDraftLevel}
                                onKeyUp={commitDraftLevel}
                                onBlur={commitDraftLevel}
                            />
                        </div>
                        <ol className="ever-cheat-bond__milestones">
                            {FAMILIARITY_SIGIL_MILESTONES.map((milestone) => (
                                <li key={milestone.grade} className={displayLevel >= milestone.level ? 'is-reached' : ''} style={{ left: `${levelPercent(milestone.level)}%` }}>
                                    <img src={familiaritySigilFrameUrl(milestone.grade)} alt={labels.familiaritySigilGradeNames[milestone.grade]}/>
                                    <span>Lv.{milestone.level}</span>
                                </li>
                            ))}
                        </ol>
                    </div>
                    <label className="ever-cheat-switch">
                        <input
                            type="checkbox"
                            role="switch"
                            checked={committedLevel === null}
                            onChange={(event) => {
                                setDraftLevel(automaticLevel);
                                update({ bond_level: event.target.checked ? null : automaticLevel });
                            }}
                        />
                        <i aria-hidden="true"/>
                        <span>
                            <strong>{labels.cheatBondAutomatic}</strong>
                            <small>{labels.cheatBondAutomaticLevel(automaticLevel)}</small>
                        </span>
                    </label>
                </div>
            </section>

            <CheatPresetGrid
                title={labels.cheatPersonalityTitle}
                options={PERSONA_PERSONALITY_PRESETS}
                icons={CHEAT_PRESET_ICON_ASSETS.personality}
                selected={preset?.personality_preset ?? 'dataset'}
                language={appLanguage}
                onSelect={(id) => update({ personality_preset: id })}
            />
            <CheatPresetGrid
                title={labels.cheatEmotionTitle}
                description={labels.cheatEmotionDescription}
                options={PERSONA_EMOTION_PRESETS}
                icons={CHEAT_PRESET_ICON_ASSETS.emotion}
                selected={preset?.emotion_preset ?? 'dataset'}
                language={appLanguage}
                onSelect={(id) => update({ emotion_preset: id })}
            />
            <CheatPresetGrid
                title={labels.cheatSpeechTitle}
                options={PERSONA_SPEECH_PRESETS}
                icons={CHEAT_PRESET_ICON_ASSETS.speech}
                selected={preset?.speech_preset ?? 'dataset'}
                language={appLanguage}
                onSelect={(id) => update({ speech_preset: id })}
            />

            <button type="button" className="ever-cheat-editor__reset" disabled={!preset} onClick={() => void controller.clearPersonaCheatPreset(personaId)}>
                <RotateCcw size={16} aria-hidden="true"/>
                {labels.cheatReset}
            </button>
        </article>
    );
}

function levelPercent(level: number): number {
    return ((level - 1) / (FAMILIARITY_MAX_LEVEL - 1)) * 100;
}

function spiritLevel(controller: EverTalkController, personaId: string): number {
    const score = controller.familiarityList.find((entry) => entry.persona_id === personaId)?.familiarity_score ?? 0;
    return computeFamiliarityLevel(score).level;
}

export function CheatModePage({ controller }: WorkspacePageProps) {
    const { labels, appLanguage } = controller;
    const [query, setQuery] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const spirits = useMemo(() => {
        const normalized = query.trim().toLocaleLowerCase();
        return controller.allSpirits
            .map((spirit) => ({ spirit, detail: parseSpiritDetail(spirit, appLanguage) }))
            .filter(({ spirit, detail }) => normalized.length === 0
                || [detail.name, detail.name_en, spirit.id].some((candidate) => candidate.toLocaleLowerCase().includes(normalized)));
    }, [controller.allSpirits, appLanguage, query]);
    const activeId = selectedId ?? (controller.activeSpiritId || null) ?? spirits[0]?.spirit.id ?? null;
    const resolvedId = spirits.some(({ spirit }) => spirit.id === activeId) ? activeId : spirits[0]?.spirit.id ?? null;

    return (
        <WorkspaceSurface controller={controller} labelledBy="cheat-page-title">
            <header className="ever-workspace-page__header">
                <div><p>{labels.navCheat}</p><h1 id="cheat-page-title">{labels.cheatPageTitle}</h1><span>{labels.cheatPageDescription}</span></div>
                <FlaskConical size={34}/>
            </header>
            <section className="ever-cheat-layout" style={CHEAT_ASSET_STYLE}>
                <aside className="ever-cheat-roster">
                    <label className="ever-cheat-roster__search">
                        <Search size={15} aria-hidden="true"/>
                        <input type="search" value={query} placeholder={labels.cheatSearchPlaceholder} aria-label={labels.cheatSearchPlaceholder} onChange={(event) => setQuery(event.target.value)}/>
                    </label>
                    {spirits.length === 0 ? <p className="ever-cheat-roster__empty">{labels.cheatNoSpirits}</p> : (
                        <div className="ever-cheat-roster__list">
                            {spirits.map(({ spirit, detail }) => {
                                const level = spiritLevel(controller, spirit.id);
                                const applied = Boolean(controller.personaCheatPresets[spirit.id]);
                                return (
                                    <button key={spirit.id} type="button" className={`ever-cheat-roster__item ${spirit.id === resolvedId ? 'is-active' : ''}`} aria-pressed={spirit.id === resolvedId} onClick={() => setSelectedId(spirit.id)}>
                                        <RosterAvatar detail={detail} level={level} skinId={controller.personaSkinIds[spirit.id]} sessionActive={spirit.id === controller.activeSpiritId} labels={labels}/>
                                        <span>
                                            <strong>{detail.name}</strong>
                                            <small>Lv.{level}</small>
                                        </span>
                                        {applied && <em className="ever-cheat-roster__badge">{labels.cheatAppliedBadge}</em>}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </aside>
                {resolvedId && <CheatSpiritEditor key={`${resolvedId}:${controller.personaCheatPresets[resolvedId]?.updated_at ?? 'none'}`} controller={controller} personaId={resolvedId}/>}
            </section>
        </WorkspaceSurface>
    );
}
