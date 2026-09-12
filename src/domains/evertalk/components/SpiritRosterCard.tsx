import { getSpiritVisualAssets, resolveSpiritSkin } from '../../persona';
import type { SpiritDetail } from '../../persona';
import { familiaritySigilFrameUrl, resolveFamiliaritySigilGrade, resolveSpiritStickerBadges } from '../logic';
import type { EverTalkLabels } from '../i18n';
import { LOBBY_UI_ASSETS, raceBadgeUrl, spiritPortraitRingAsset } from '../uiAssets';
import { LoadableAssetImage } from './LoadableAssetImage';

export interface RosterAvatarProps {
    detail: SpiritDetail;
    level: number;
    skinId: string | undefined;
    sessionActive: boolean;
    labels: EverTalkLabels;
}

export function RosterAvatar({ detail, level, skinId, sessionActive, labels }: RosterAvatarProps) {
    const assets = getSpiritVisualAssets(detail);
    const skin = resolveSpiritSkin(assets, skinId);
    const sigilGrade = resolveFamiliaritySigilGrade(level);
    const stickerBadges = resolveSpiritStickerBadges(assets.assetFolder, level).filter((badge) => badge.unlocked);
    const portraitCandidates = skin
        ? [...skin.portraitCandidates, ...assets.rosterIconCandidates]
        : assets.rosterIconCandidates;
    return (
        <span className={`ever-spirit-row__icon ${sigilGrade ? `has-frame is-${sigilGrade}` : ''}`}>
            <span className="ever-spirit-row__icon-clip">
                <LoadableAssetImage candidates={portraitCandidates} alt={detail.name} fallback={<span className="ever-spirit-row__icon-initial">{detail.name.charAt(0)}</span>}/>
            </span>
            <img className="ever-spirit-row__ring" src={spiritPortraitRingAsset(sigilGrade)} alt="" aria-hidden="true"/>
            {sigilGrade && <img className="ever-spirit-row__crown" src={familiaritySigilFrameUrl(sigilGrade)} alt={labels.familiaritySigilGradeNames[sigilGrade]}/>}
            <img className="ever-spirit-row__race" src={raceBadgeUrl(detail.race)} alt={detail.race}/>
            {stickerBadges.length > 0 && (
                <span className="ever-spirit-row__stickers">
                    {stickerBadges.map((badge) => (
                        <img key={badge.id} src={badge.url} alt={badge.kind === 'special' ? labels.stickerKindSpecial : labels.stickerKindLove}/>
                    ))}
                </span>
            )}
            {sessionActive && <span className="ever-spirit-row__session-badge" title={labels.activeSessionBadge}/>}
        </span>
    );
}

export interface RosterExpBarProps {
    level: number;
    ratio: number;
    isMax: boolean;
}

export function RosterExpBar({ level, ratio, isMax }: RosterExpBarProps) {
    return (
        <span className="ever-spirit-row__exp">
            <i className="ever-spirit-row__exp-level">Lv.{level}</i>
            <span className="ever-spirit-row__exp-bar">
                <span className={isMax ? 'is-max' : ''} style={{ width: `${Math.round(ratio * 100)}%`, backgroundImage: `url(${LOBBY_UI_ASSETS.gaugeFill})` }}/>
            </span>
        </span>
    );
}

export function RosterRankBadge({ rank }: { rank: number }) {
    return (
        <i className="ever-spirit-row__rank" style={{ backgroundImage: `url(${LOBBY_UI_ASSETS.hexSolid})` }}>{rank}</i>
    );
}
