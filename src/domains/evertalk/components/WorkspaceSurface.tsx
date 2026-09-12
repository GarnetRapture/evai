import type { CSSProperties } from 'react';
import { computeFamiliarityLevel, getSpiritVisualAssets, parseSpiritDetail } from '../../persona';
import type { SpiritDetail } from '../../persona';
import type { EverTalkController, WorkspacePageProps, WorkspaceSurfaceProps } from '../types';
import { EVERTALK_UI_ASSETS, LOBBY_UI_ASSETS } from '../uiAssets';
import { LoadableAssetImage } from './LoadableAssetImage';
import { RosterAvatar } from './SpiritRosterCard';

const WORKSPACE_STYLE = {
    '--ever-workspace-panel-texture': `url(${EVERTALK_UI_ASSETS.panelSurfaceCommon})`,
    '--ever-workspace-stripe': `url(${LOBBY_UI_ASSETS.stripePattern})`,
    '--ever-workspace-gauge': `url(${LOBBY_UI_ASSETS.gaugeFill})`,
} as CSSProperties;

function WorkspaceBackdrop({ controller }: WorkspacePageProps) {
    const detail = controller.activeDetail
        ?? (controller.allSpirits[0] ? parseSpiritDetail(controller.allSpirits[0], controller.appLanguage) : null);
    if (!detail) return null;
    const assets = getSpiritVisualAssets(detail);
    return <div className="ever-workspace-backdrop" aria-hidden="true">
        <img src={assets.background} alt=""/>
        <LoadableAssetImage candidates={assets.memoryCandidates.length ? assets.memoryCandidates : assets.portraitCandidates} alt="" className="ever-workspace-backdrop__spirit" fallback={null}/>
    </div>;
}

export function WorkspaceSurface({ controller, labelledBy, children }: WorkspaceSurfaceProps) {
    return <main className="ever-workspace-page" aria-labelledby={labelledBy} style={WORKSPACE_STYLE}>
        <WorkspaceBackdrop controller={controller}/>
        <div className="ever-workspace-page__content">{children}</div>
    </main>;
}

function resolveSpiritDisplay(controller: EverTalkController, personaId: string): { detail: SpiritDetail; level: number; skinId: string | undefined } | null {
    const spirit = controller.allSpirits.find((candidate) => candidate.id === personaId);
    if (!spirit) return null;
    const familiarity = controller.familiarityList.find((entry) => entry.persona_id === personaId)?.familiarity_score ?? 0;
    return {
        detail: parseSpiritDetail(spirit, controller.appLanguage),
        level: computeFamiliarityLevel(familiarity).level,
        skinId: controller.personaSkinIds[personaId],
    };
}

export function SpiritViewAvatar({ controller, personaId }: WorkspacePageProps & { personaId: string }) {
    const display = resolveSpiritDisplay(controller, personaId);
    if (!display) return null;
    return <RosterAvatar detail={display.detail} level={display.level} skinId={display.skinId} sessionActive={personaId === controller.activeSpiritId} labels={controller.labels}/>;
}
