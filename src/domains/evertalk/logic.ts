import { isDomainError } from '../../shared/errors';
import type { AppLanguage } from '../../shared/types';
import { EVERTALK_SESSION_TITLE, type ChatRoom } from '../chat';
import type { ChatModelEntry, LocalModelFileEntry, ModelDownloadProgress } from '../llm';
import type { ModuleControl, ModuleControlOption } from '../modules';
import type { FamiliarityEntry, PersonaConfig, SpiritDetail, SpiritSkinVisualAsset } from '../persona';
import { FAMILIARITY_MAX_LEVEL } from '../persona/familiarity';
export {
    computeFamiliarityLevel,
    familiarityCumulativeExp,
    FAMILIARITY_EXP_STEP,
    FAMILIARITY_MAX_LEVEL,
    type FamiliarityLevelInfo,
} from '../persona/familiarity';
import type { BackupFileEntry } from '../sync';
import type { EverTalkLabels } from './i18n';
import type { ApiConnectionState, ApiStatusItem, ImageViewerPanDirection, ImageViewerPoint, ImageViewerSize, ImageViewerTransform, LobbyActorMotion, LocalModelEntryGroup, SpiritReplyParts, PanelResizeHandle, PanelResizeResult, PanelResizeState, PreferredSpiritFamiliarity, SpiritRosterMeta, SpiritStickerBadge, SystemStatusId, TalkChoice } from './types';
import {
    ANNIVERSARY_STICKER_URL,
    familiaritySigilFrameAsset,
    loveStickerKeyFor,
    loveStickerUrl,
    RAID_STICKER_URLS,
    specialStickerKeyFor,
    specialStickerUrl,
} from './uiAssets';
export function filterSpirits(spirits: PersonaConfig[], searchQuery: string): PersonaConfig[] {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
        return spirits;
    }
    return spirits.filter((spirit) => (spirit.name.toLowerCase().includes(query) ||
        spirit.name_en.toLowerCase().includes(query) ||
        spirit.race.toLowerCase().includes(query) ||
        spirit.class.toLowerCase().includes(query)));
}
export function resolvePreferredSpiritFamiliarity(spirits: PersonaConfig[], familiarityList: FamiliarityEntry[], preferredPersonaId: string | null): PreferredSpiritFamiliarity | null {
    const spirit = preferredPersonaId ? spirits.find((candidate) => candidate.id === preferredPersonaId) : undefined;
    if (!spirit) {
        return null;
    }
    const entry = familiarityList.find((candidate) => candidate.persona_id === spirit.id);
    return {
        spirit,
        message_count: entry?.message_count ?? 0,
        memory_count: entry?.memory_count ?? 0,
        familiarity_score: entry?.familiarity_score ?? 0,
    };
}
export function resolvePreferredSpiritsFamiliarity(spirits: PersonaConfig[], familiarityList: FamiliarityEntry[], preferredPersonaIds: string[]): PreferredSpiritFamiliarity[] {
    return preferredPersonaIds
        .map((personaId) => {
            const spirit = spirits.find((candidate) => candidate.id === personaId);
            if (!spirit) {
                return null;
            }
            const entry = familiarityList.find((candidate) => candidate.persona_id === personaId);
            return {
                spirit,
                message_count: entry?.message_count ?? 0,
                memory_count: entry?.memory_count ?? 0,
                familiarity_score: entry?.familiarity_score ?? 0,
            };
        })
        .filter((entry): entry is PreferredSpiritFamiliarity => entry !== null);
}
export function createRosterMeta(spirit: PersonaConfig): SpiritRosterMeta {
    const preview = spirit.greeting || spirit.class || spirit.race;
    return {
        preview,
    };
}
export function createTalkChoices(detail: SpiritDetail | null, labels: EverTalkLabels): TalkChoice[] {
    if (!detail) {
        return [];
    }
    return [
        ...detail.profile.like.map((label, index) => ({
            id: `like-${index}-${label}`,
            label,
            source: labels.like,
        })),
        ...detail.profile.hobby.map((label, index) => ({
            id: `hobby-${index}-${label}`,
            label,
            source: labels.hobby,
        })),
        ...detail.profile.speciality.map((label, index) => ({
            id: `speciality-${index}-${label}`,
            label,
            source: labels.speciality,
        })),
    ].filter((choice) => choice.label.trim().length > 0);
}
export function pickRandomSpeechLine(detail: SpiritDetail | null): string {
    if (!detail || detail.speech_patterns.length === 0) {
        return '';
    }
    const candidates = detail.speech_patterns.filter((line) => line.trim().length > 0);
    if (candidates.length === 0) {
        return '';
    }
    const index = Math.floor(Math.random() * candidates.length);
    return candidates[index];
}
export function pickPokeReactionLine(detail: SpiritDetail | null, excluding: string): string {
    if (!detail || detail.speech_patterns.length === 0) {
        return '';
    }
    const candidates = detail.speech_patterns.filter((line) => line.trim().length > 0 && line !== excluding);
    const pool = candidates.length > 0 ? candidates : detail.speech_patterns;
    const index = Math.floor(Math.random() * pool.length);
    return pool[index];
}
export function createConversationSummary(detail: SpiritDetail | null): string {
    if (!detail) {
        return '';
    }
    return detail.personality.description || detail.personality.greeting || detail.class || detail.race;
}
export function createApiStatus(id: SystemStatusId, state: ApiConnectionState, detail: string): ApiStatusItem {
    return {
        id,
        state,
        detail,
    };
}
export function formatSkinLabel(skin: SpiritSkinVisualAsset, labels: EverTalkLabels): string {
    if (skin.kind === 'base') {
        return labels.skinBase;
    }
    if (skin.kind === 'base_variant') {
        return labels.skinBaseVariant;
    }
    if (skin.kind === 'costume') {
        return labels.skinCostume(skin.costume_index ?? 0);
    }
    return labels.skinRaid(labels.raidEventNames[skin.raid_event ?? 'standard']);
}
export function formatRoomTitle(room: ChatRoom, labels: EverTalkLabels): string {
    return room.title === EVERTALK_SESSION_TITLE ? labels.evertalkSessionTitle : room.title;
}
export function formatDateTime(isoTimestamp: string, labels: EverTalkLabels): string {
    const parsed = new Date(isoTimestamp);
    if (Number.isNaN(parsed.getTime())) {
        return isoTimestamp;
    }
    return new Intl.DateTimeFormat(labels.localeTag, { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
}
export function formatBackupFileMeta(file: BackupFileEntry, labels: EverTalkLabels): string {
    return labels.backupFileMeta(formatDateTime(file.modified_at, labels), Math.max(1, Math.ceil(file.size_bytes / 1024)));
}
export interface ThinkBlock {
    type: 'think' | 'text';
    content: string;
}
const THINK_BLOCK_PATTERN = /<think(?:ing)?>([\s\S]*?)(?:<\/think(?:ing)?>|$)/gi;
const STRAY_THINK_TAG_PATTERN = /<\/?think(?:ing)?>?/gi;
export function parseThinkBlocks(text: string): ThinkBlock[] {
    const parts: ThinkBlock[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    THINK_BLOCK_PATTERN.lastIndex = 0;
    while ((match = THINK_BLOCK_PATTERN.exec(text)) !== null) {
        if (match.index > lastIndex) {
            const before = text.substring(lastIndex, match.index).replace(STRAY_THINK_TAG_PATTERN, '');
            if (before.length > 0) {
                parts.push({ type: 'text', content: before });
            }
        }
        parts.push({ type: 'think', content: match[1] });
        lastIndex = THINK_BLOCK_PATTERN.lastIndex;
    }
    if (lastIndex < text.length) {
        const rest = text.substring(lastIndex).replace(STRAY_THINK_TAG_PATTERN, '');
        if (rest.length > 0) {
            parts.push({ type: 'text', content: rest });
        }
    }
    return parts;
}
export function splitSpiritReply(text: string): SpiritReplyParts {
    const blocks = parseThinkBlocks(text);
    return {
        reasoning: blocks.filter((block) => block.type === 'think').map((block) => block.content.trim()).filter((content) => content.length > 0).join('\n\n'),
        reply: blocks.filter((block) => block.type === 'text').map((block) => block.content).join('').trim(),
    };
}
const LOBBY_STAGE_LEFT_PERCENT = 9;
const LOBBY_STAGE_RIGHT_PERCENT = 70;

function stableUnitHash(seed: string, salt: number): number {
    let hash = 2166136261 ^ salt;
    for (let index = 0; index < seed.length; index += 1) {
        hash ^= seed.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return ((hash >>> 0) % 10_000) / 10_000;
}

export function resolveLobbyActorMotion(spiritId: string, index: number, count: number): LobbyActorMotion {
    const span = LOBBY_STAGE_RIGHT_PERCENT - LOBBY_STAGE_LEFT_PERCENT;
    const slotWidth = span / Math.max(1, count);
    const base = count === 1
        ? LOBBY_STAGE_LEFT_PERCENT + span * 0.46
        : LOBBY_STAGE_LEFT_PERCENT + slotWidth * index + slotWidth * (0.2 + stableUnitHash(spiritId, 1) * 0.3);
    const relative = (base - LOBBY_STAGE_LEFT_PERCENT) / span;
    return {
        base_percent: base,
        range_vw: Math.round((1.5 + stableUnitHash(spiritId, 2) * 5.5) * 10) / 10,
        rise_px: Math.round(4 + stableUnitHash(spiritId, 3) * 16),
        duration_seconds: Math.round((14 + stableUnitHash(spiritId, 4) * 16) * 10) / 10,
        delay_seconds: -Math.round(stableUnitHash(spiritId, 5) * 120) / 10,
        depth_scale: Math.round((0.88 + stableUnitHash(spiritId, 6) * 0.16) * 100) / 100,
        speech_alignment: relative < 0.3 ? 'start' : relative > 0.7 ? 'end' : 'center',
    };
}

export function formatProgressPercent(progress: ModelDownloadProgress): number {
    return Math.round(progress.ratio * 100);
}
export const IMAGE_VIEWER_ZOOM_FACTOR = 1.25;
export const IMAGE_VIEWER_PAN_STEP_PX = 64;
export const IMAGE_VIEWER_WHEEL_ZOOM_RATE = 0.0015;
export const IMAGE_VIEWER_WHEEL_LINE_PX = 16;
export const IMAGE_VIEWER_JOG_RANGE = 100;
export const IMAGE_VIEWER_JOG_UNITS_PER_DOUBLING = 25;
export const IMAGE_VIEWER_FRAME_CENTER: ImageViewerPoint = { x: 0, y: 0 };
export const IMAGE_VIEWER_FIT_TRANSFORM: ImageViewerTransform = { scale: 1, x: 0, y: 0 };
export function resolveImageViewerScale(currentScale: number, nextScale: number): number {
    return Number.isFinite(nextScale) && nextScale > 0 ? nextScale : currentScale;
}
export function zoomImageViewerTransform(transform: ImageViewerTransform, nextScale: number, anchor: ImageViewerPoint): ImageViewerTransform {
    const scale = resolveImageViewerScale(transform.scale, nextScale);
    const ratio = scale / transform.scale;
    return {
        scale,
        x: anchor.x - (anchor.x - transform.x) * ratio,
        y: anchor.y - (anchor.y - transform.y) * ratio,
    };
}
export function computeImageViewerFitScale(natural: ImageViewerSize, frame: ImageViewerSize): number | null {
    if (natural.width <= 0 || natural.height <= 0 || frame.width <= 0 || frame.height <= 0) {
        return null;
    }
    return Math.min(frame.width / natural.width, frame.height / natural.height);
}
export function imageViewerWheelDeltaPixels(deltaY: number, deltaMode: number, pageHeight: number): number {
    if (deltaMode === WheelEvent.DOM_DELTA_LINE) {
        return deltaY * IMAGE_VIEWER_WHEEL_LINE_PX;
    }
    if (deltaMode === WheelEvent.DOM_DELTA_PAGE) {
        return deltaY * pageHeight;
    }
    return deltaY;
}
export function imageViewerWheelZoomFactor(deltaPixels: number): number {
    return Math.exp(-deltaPixels * IMAGE_VIEWER_WHEEL_ZOOM_RATE);
}
export function imageViewerJogScale(baseScale: number, jogValue: number): number {
    return baseScale * 2 ** (jogValue / IMAGE_VIEWER_JOG_UNITS_PER_DOUBLING);
}
export function imageViewerPointFromClient(clientX: number, clientY: number, frameRect: DOMRect): ImageViewerPoint {
    return {
        x: clientX - (frameRect.left + frameRect.width / 2),
        y: clientY - (frameRect.top + frameRect.height / 2),
    };
}
export function formatImageViewerScalePercent(scale: number): string {
    const percent = scale * 100;
    return percent >= 100 ? String(Math.round(percent)) : String(Number(percent.toPrecision(3)));
}
export function panImageViewerTransform(transform: ImageViewerTransform, direction: ImageViewerPanDirection, stepPx: number): ImageViewerTransform {
    if (direction === 'up') {
        return { ...transform, y: transform.y + stepPx };
    }
    if (direction === 'down') {
        return { ...transform, y: transform.y - stepPx };
    }
    if (direction === 'left') {
        return { ...transform, x: transform.x + stepPx };
    }
    return { ...transform, x: transform.x - stepPx };
}
export const CHAT_PANEL_MIN_WIDTH = 320;
export const CHAT_PANEL_MIN_HEIGHT = 240;
export const CHAT_PANEL_RESIZE_HANDLES: PanelResizeHandle[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
export function resolvePanelResize(state: PanelResizeState, deltaX: number, deltaY: number): PanelResizeResult {
    const right = state.originX + state.originWidth;
    const bottom = state.originY + state.originHeight;
    const maxWidth = state.parentWidth;
    const maxHeight = state.parentHeight;
    let x = state.originX;
    let y = state.originY;
    let width = state.originWidth;
    let height = state.originHeight;
    let blocked = false;
    if (state.handle.includes('e')) {
        const requested = state.originWidth + deltaX;
        width = Math.min(Math.max(CHAT_PANEL_MIN_WIDTH, requested), Math.max(CHAT_PANEL_MIN_WIDTH, maxWidth - state.originX));
        blocked = blocked || Math.abs(requested - width) > 1;
    }
    if (state.handle.includes('w')) {
        const requested = state.originWidth - deltaX;
        width = Math.min(Math.max(CHAT_PANEL_MIN_WIDTH, requested), Math.max(CHAT_PANEL_MIN_WIDTH, right));
        x = right - width;
        blocked = blocked || Math.abs(requested - width) > 1;
    }
    if (state.handle.includes('s')) {
        const requested = state.originHeight + deltaY;
        height = Math.min(Math.max(CHAT_PANEL_MIN_HEIGHT, requested), Math.max(CHAT_PANEL_MIN_HEIGHT, maxHeight - state.originY));
        blocked = blocked || Math.abs(requested - height) > 1;
    }
    if (state.handle.includes('n')) {
        const requested = state.originHeight - deltaY;
        height = Math.min(Math.max(CHAT_PANEL_MIN_HEIGHT, requested), Math.max(CHAT_PANEL_MIN_HEIGHT, bottom));
        y = bottom - height;
        blocked = blocked || Math.abs(requested - height) > 1;
    }
    return {
        x: Math.max(0, Math.min(x, Math.max(0, maxWidth - width))),
        y: Math.max(0, Math.min(y, Math.max(0, maxHeight - height))),
        width,
        height,
        blocked,
    };
}
export type FamiliaritySigilGrade = 'epic' | 'eternal' | 'legendary' | 'origin';
export const FAMILIARITY_SIGIL_MILESTONES: { level: number; grade: FamiliaritySigilGrade }[] = [
    { level: 10, grade: 'epic' },
    { level: 20, grade: 'eternal' },
    { level: 30, grade: 'legendary' },
    { level: 40, grade: 'origin' },
];
export function resolveFamiliaritySigilGrade(level: number): FamiliaritySigilGrade | null {
    let grade: FamiliaritySigilGrade | null = null;
    for (const milestone of FAMILIARITY_SIGIL_MILESTONES) {
        if (level >= milestone.level) {
            grade = milestone.grade;
        }
    }
    return grade;
}
export function familiaritySigilFrameUrl(grade: FamiliaritySigilGrade): string {
    return familiaritySigilFrameAsset(grade);
}
export const SPECIAL_STICKER_UNLOCK_LEVEL = 30;
export const LOVE_STICKER_UNLOCK_LEVEL = FAMILIARITY_MAX_LEVEL;
export function familiarityLoveStickerUrl(assetFolder: string): string {
    const key = loveStickerKeyFor(assetFolder);
    return loveStickerUrl(key ?? assetFolder);
}
export function familiaritySpecialStickerUrl(assetFolder: string): string | null {
    const key = specialStickerKeyFor(assetFolder);
    return key ? specialStickerUrl(key) : null;
}
export function resolveSpiritStickerBadges(assetFolder: string | null, level: number): SpiritStickerBadge[] {
    if (!assetFolder) {
        return [];
    }
    const badges: SpiritStickerBadge[] = [];
    const specialKey = specialStickerKeyFor(assetFolder);
    if (specialKey) {
        badges.push({
            id: `special-${specialKey}`,
            kind: 'special',
            url: specialStickerUrl(specialKey),
            unlockLevel: SPECIAL_STICKER_UNLOCK_LEVEL,
            unlocked: level >= SPECIAL_STICKER_UNLOCK_LEVEL,
        });
    }
    const loveKey = loveStickerKeyFor(assetFolder);
    if (loveKey) {
        badges.push({
            id: `love-${loveKey}`,
            kind: 'love',
            url: loveStickerUrl(loveKey),
            unlockLevel: LOVE_STICKER_UNLOCK_LEVEL,
            unlocked: level >= LOVE_STICKER_UNLOCK_LEVEL,
        });
    }
    return badges;
}
export function collectEventStickers(): SpiritStickerBadge[] {
    return [
        {
            id: 'event-anniversary',
            kind: 'event',
            url: ANNIVERSARY_STICKER_URL,
            unlockLevel: 0,
            unlocked: true,
        },
        ...RAID_STICKER_URLS.map((url, index) => ({
            id: `event-raid-${index + 1}`,
            kind: 'event' as const,
            url,
            unlockLevel: 0,
            unlocked: true,
        })),
    ];
}
export function groupLocalModelEntries(entries: ChatModelEntry[]): LocalModelEntryGroup[] {
    const groups: LocalModelEntryGroup[] = [];
    for (const entry of entries) {
        if (entry.engine === 'chrome_prompt') {
            continue;
        }
        const localEntry: LocalModelFileEntry = entry;
        const group = groups.find((candidate) => candidate.engine === localEntry.engine);
        if (group) {
            group.entries.push(localEntry);
        }
        else {
            groups.push({ engine: localEntry.engine, entries: [localEntry] });
        }
    }
    return groups;
}
export function formatMegabytes(bytes: number): number {
    return Math.max(1, Math.round(bytes / (1024 * 1024)));
}
export function formatModelSettingsPath(labels: EverTalkLabels): string {
    return `${labels.settings} > ${labels.modelListTitle}`;
}
export function formatLanguageName(language: AppLanguage, labels: EverTalkLabels): string {
    if (language === 'en') {
        return labels.languageEn;
    }
    if (language === 'zh_cn') {
        return labels.languageZhCn;
    }
    return labels.languageKo;
}
export function formatModuleControlLabel(control: ModuleControl, labels: EverTalkLabels): string {
    return labels.moduleControlNames[control.id] ?? control.label;
}
export function formatModuleControlOption(control: ModuleControl, option: ModuleControlOption, labels: EverTalkLabels): string {
    return labels.moduleControlOptionNames[control.id]?.[option.value] ?? option.label;
}
export function formatModuleControlValue(control: ModuleControl, labels: EverTalkLabels): string {
    if (control.kind === 'boolean') {
        return control.value === '1' ? labels.moduleToggleOn : labels.moduleToggleOff;
    }
    const option = control.options.find((candidate) => candidate.value === control.value);
    return option ? formatModuleControlOption(control, option, labels) : control.value;
}
export function formatSystemStatusLabel(statusId: SystemStatusId, labels: EverTalkLabels): string {
    switch (statusId) {
        case 'auth':
            return labels.authSession;
        case 'persona-archive':
            return labels.personaPack;
        case 'persona-db':
            return labels.personaDb;
        case 'chat-db':
            return labels.chatDb;
        case 'style-db':
            return labels.styleDb;
        case 'llm':
            return labels.localModel;
        case 'native-context':
            return labels.contextStorage;
        case 'sync':
            return labels.dataSync;
    }
}
export function formatUnknownError(err: unknown, labels: EverTalkLabels): string {
    if (isDomainError(err)) {
        return labels.domainErrorMessage(err.code, err.detail);
    }
    if (err instanceof Error) {
        return err.message;
    }
    if (typeof err === 'string') {
        return err;
    }
    if (
        typeof err === 'object' &&
        err !== null &&
        'message' in err &&
        typeof (err as { message: unknown }).message === 'string'
    ) {
        return (err as { message: string }).message;
    }
    return JSON.stringify(err);
}
