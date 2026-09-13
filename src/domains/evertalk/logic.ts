import { isDomainError } from '../../shared/errors';
import type { AppLanguage } from '../../shared/types';
import { EVERTALK_SESSION_TITLE, splitPersonaReplyActions, type ChatMessage, type ChatRoom, type PersonaContextGraph, type PersonaContextRelation, type PersonaKeywordThread, type PersonaMemoryOverview } from '../chat';
import type { ChatModelEntry, LocalModelFileEntry, ModelDownloadProgress } from '../llm';
import type { ModuleControl, ModuleControlOption } from '../modules';
import type { FamiliarityEntry, PersonaConfig, SpiritDetail, SpiritSkinVisualAsset } from '../persona';
import { FAMILIARITY_GRADE_MILESTONES, FAMILIARITY_MAX_LEVEL, computeFamiliarityLevel, resolveFamiliarityGrade, type FamiliarityGrade } from '../persona/familiarity';
import { parseSpiritDetail } from '../persona/logic';
export {
    computeFamiliarityLevel,
    familiarityCumulativeExp,
    FAMILIARITY_EXP_STEP,
    FAMILIARITY_MAX_LEVEL,
    type FamiliarityLevelInfo,
} from '../persona/familiarity';
import type { BackupFileEntry } from '../sync';
import type { EverTalkLabels } from './i18n';
import type { ApiConnectionState, ApiStatusItem, ImageViewerPanDirection, ImageViewerPoint, ImageViewerSize, ImageViewerTransform, LobbyActorMotion, LocalModelEntryGroup, MemoryGraphArcPlacement, MemoryGraphBounds, MemoryGraphDetailPosition, MemoryGraphEdge, MemoryGraphEmphasis, MemoryGraphLayout, MemoryGraphLayoutSubject, MemoryGraphNode, MemoryGraphPoint, MemoryGraphViewFilter, MemoryGraphViewTransform, MemoryOverviewRow, MemorySpiritRosterEntry, SpiritReplyParts, PanelResizeHandle, PanelResizeResult, PanelResizeState, PreferredSpiritFamiliarity, SettingsSectionNavItem, SpiritRosterMeta, SpiritStickerBadge, SystemStatusId, TalkChoice } from './types';
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
    if (skin.kind === 'special') {
        return labels.skinSpecial;
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
export function shouldAnnounceSpiritActions(message: ChatMessage, index: number, messageCount: number): boolean {
    return index === messageCount - 1 && message.role === 'assistant' && message.delivery === 'proactive';
}
export function splitSpiritReply(text: string, streaming: boolean): SpiritReplyParts {
    const blocks = parseThinkBlocks(text);
    const { actions, spoken } = splitPersonaReplyActions(blocks.filter((block) => block.type === 'text').map((block) => block.content).join(''), streaming);
    return {
        reasoning: blocks.filter((block) => block.type === 'think').map((block) => block.content.trim()).filter((content) => content.length > 0).join('\n\n'),
        reply: spoken,
        actions,
    };
}
const LOBBY_STAGE_LEFT_PERCENT = 14;
const LOBBY_STAGE_RIGHT_PERCENT = 86;

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
        ? LOBBY_STAGE_LEFT_PERCENT + span * 0.5
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
export const MEMORY_GRAPH_MARGIN = 64;
export const MEMORY_GRAPH_PERSONA_RADIUS = 64;
export const MEMORY_GRAPH_SAVIOR_RADIUS = 58;
export const MEMORY_GRAPH_KEYWORD_MIN_RADIUS = 32;
export const MEMORY_GRAPH_KEYWORD_MAX_RADIUS = 56;
export const MEMORY_GRAPH_RELATION_MIN_RADIUS = 36;
export const MEMORY_GRAPH_RELATION_MAX_RADIUS = 54;
export const MEMORY_GRAPH_TOPIC_LABEL_RANK_LIMIT = 6;
export const MEMORY_GRAPH_STAGE_WIDTH = 320;
export const MEMORY_GRAPH_STAGE_HEIGHT = 118;
export const MEMORY_GRAPH_SESSION_WIDTH = 320;
export const MEMORY_GRAPH_SESSION_HEIGHT = 150;
export const MEMORY_GRAPH_DETAIL_WIDTH = 340;
export const MEMORY_GRAPH_DETAIL_OFFSET = 18;
const MEMORY_GRAPH_NODE_SPACING = 34;
const MEMORY_GRAPH_RING_SPACING = 70;
const MEMORY_GRAPH_CLUSTER_INNER_GAP = 120;
const MEMORY_GRAPH_SAVIOR_CLEARANCE = 150;
const MEMORY_GRAPH_KEYWORD_ARC_HALF_ANGLE = (Math.PI * 7) / 18;
const MEMORY_GRAPH_RELATION_ARC_HALF_ANGLE = (Math.PI * 7) / 18;
const MEMORY_GRAPH_SAVIOR_AXIS_CLEARANCE = 40;
const MEMORY_GRAPH_ARC_X_SCALE = 1.6;
const MEMORY_GRAPH_ARC_Y_SCALE = 0.8;
const MEMORY_GRAPH_ARC_SAMPLES = 180;
const MEMORY_GRAPH_COLUMN_GAP = 150;
const MEMORY_GRAPH_CARD_GAP = 28;
const MEMORY_GRAPH_STAGE_COLUMNS = 2;
const MEMORY_GRAPH_ROW_GAP = 130;
const MEMORY_GRAPH_MIN_EDGE_WEIGHT = 0.15;

function memoryKeywordEmphasis(thread: PersonaKeywordThread): MemoryGraphEmphasis {
    if (thread.keyword.query_match) return 'query';
    return thread.keyword.recent_count > 0 ? 'recent' : 'history';
}

function memoryGraphEllipsePoint(center: MemoryGraphPoint, radius: number, angle: number): MemoryGraphPoint {
    return {
        x: center.x + Math.cos(angle) * radius * MEMORY_GRAPH_ARC_X_SCALE,
        y: center.y + Math.sin(angle) * radius * MEMORY_GRAPH_ARC_Y_SCALE,
    };
}

function sampleMemoryGraphArc(placement: MemoryGraphArcPlacement, radius: number): { angles: number[]; lengths: number[] } {
    const angles = [placement.startAngle];
    const lengths = [0];
    let previous = memoryGraphEllipsePoint(placement.center, radius, placement.startAngle);
    for (let step = 1; step <= MEMORY_GRAPH_ARC_SAMPLES; step += 1) {
        const angle = placement.startAngle + ((placement.endAngle - placement.startAngle) * step) / MEMORY_GRAPH_ARC_SAMPLES;
        const point = memoryGraphEllipsePoint(placement.center, radius, angle);
        angles.push(angle);
        lengths.push(lengths[lengths.length - 1] + Math.hypot(point.x - previous.x, point.y - previous.y));
        previous = point;
    }
    return { angles, lengths };
}

function memoryGraphArcAngleAt(sample: { angles: number[]; lengths: number[] }, length: number): number {
    const index = sample.lengths.findIndex((candidate) => candidate >= length);
    if (index <= 0) {
        return sample.angles[Math.max(0, index)];
    }
    const span = sample.lengths[index] - sample.lengths[index - 1];
    const ratio = span === 0 ? 0 : (length - sample.lengths[index - 1]) / span;
    return sample.angles[index - 1] + (sample.angles[index] - sample.angles[index - 1]) * ratio;
}

function placeMemoryGraphArcNodes(diameters: readonly number[], placement: MemoryGraphArcPlacement): MemoryGraphPoint[] {
    const slot = Math.max(0, ...diameters) + MEMORY_GRAPH_NODE_SPACING;
    const points: MemoryGraphPoint[] = [];
    let radius = placement.startRadius;
    let placed = 0;
    while (placed < diameters.length) {
        const sample = sampleMemoryGraphArc(placement, radius);
        const total = sample.lengths[sample.lengths.length - 1];
        const usableStart = placement.startClearance > 0 ? Math.min(total, placement.startClearance + slot / 2) : 0;
        const usableEnd = placement.endClearance > 0 ? Math.max(usableStart, total - placement.endClearance - slot / 2) : total;
        const capacity = Math.max(1, Math.floor((usableEnd - usableStart) / slot) + 1);
        const size = Math.min(capacity, diameters.length - placed);
        for (let index = 0; index < size; index += 1) {
            const length = size > 1
                ? usableStart + ((usableEnd - usableStart) * index) / (size - 1)
                : placement.startClearance > 0 ? usableStart : placement.endClearance > 0 ? usableEnd : (usableStart + usableEnd) / 2;
            points.push(memoryGraphEllipsePoint(placement.center, radius, memoryGraphArcAngleAt(sample, length)));
        }
        placed += size;
        radius += slot + MEMORY_GRAPH_RING_SPACING;
    }
    return points;
}

function placeMemoryGraphRelationNodes(diameters: readonly number[], center: MemoryGraphPoint, startRadius: number): MemoryGraphPoint[] {
    const upperCount = Math.ceil(diameters.length / 2);
    const upper = placeMemoryGraphArcNodes(diameters.slice(0, upperCount), {
        center,
        startRadius,
        startAngle: Math.PI - MEMORY_GRAPH_RELATION_ARC_HALF_ANGLE,
        endAngle: Math.PI,
        startClearance: 0,
        endClearance: MEMORY_GRAPH_SAVIOR_AXIS_CLEARANCE,
    });
    const lower = placeMemoryGraphArcNodes(diameters.slice(upperCount), {
        center,
        startRadius,
        startAngle: Math.PI,
        endAngle: Math.PI + MEMORY_GRAPH_RELATION_ARC_HALF_ANGLE,
        startClearance: MEMORY_GRAPH_SAVIOR_AXIS_CLEARANCE,
        endClearance: 0,
    });
    return [...upper, ...lower];
}

function memoryGraphHorizontalReach(points: readonly MemoryGraphPoint[], diameters: readonly number[], center: MemoryGraphPoint, direction: 1 | -1): number {
    return Math.max(0, ...points.map((point, index) => direction * (point.x - center.x) + diameters[index] / 2));
}

export function memoryGraphLayoutBounds(nodes: readonly MemoryGraphNode[]): MemoryGraphBounds {
    if (nodes.length === 0) {
        return { left: 0, top: 0, right: 0, bottom: 0 };
    }
    return {
        left: Math.min(...nodes.map((node) => node.x - node.width / 2)),
        top: Math.min(...nodes.map((node) => node.y - node.height / 2)),
        right: Math.max(...nodes.map((node) => node.x + node.width / 2)),
        bottom: Math.max(...nodes.map((node) => node.y + node.height / 2)),
    };
}

export function resolveMemoryOverviewRows(overview: PersonaMemoryOverview, spirits: readonly PersonaConfig[], language: AppLanguage): MemoryOverviewRow[] {
    const spiritById = new Map(spirits.map((spirit) => [spirit.id, spirit]));
    return overview.entries.flatMap((entry) => {
        const spirit = spiritById.get(entry.persona_id);
        return spirit === undefined ? [] : [{ entry, name: parseSpiritDetail(spirit, language).name }];
    });
}

export function buildMemorySpiritRosterEntries(
    spirits: readonly PersonaConfig[],
    familiarityList: readonly FamiliarityEntry[],
    language: AppLanguage,
    query: string,
): MemorySpiritRosterEntry[] {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const familiarityById = new Map(familiarityList.map((entry) => [entry.persona_id, entry]));
    return spirits
        .map((spirit): MemorySpiritRosterEntry & { searchable: string[] } => {
            const detail = parseSpiritDetail(spirit, language);
            const familiarity = familiarityById.get(spirit.id);
            const score = familiarity?.familiarity_score ?? 0;
            return {
                personaId: spirit.id,
                name: detail.name,
                level: computeFamiliarityLevel(score).level,
                messageCount: familiarity?.message_count ?? 0,
                score,
                searchable: [detail.name, detail.name_en, spirit.id],
            };
        })
        .filter((entry) => normalizedQuery.length === 0 || entry.searchable.some((candidate) => candidate.toLocaleLowerCase().includes(normalizedQuery)))
        .sort((left, right) => right.score - left.score || right.messageCount - left.messageCount || left.name.localeCompare(right.name))
        .map(({ personaId, name, level, messageCount, score }) => ({ personaId, name, level, messageCount, score }));
}

export function filterMemoryKeywordThreads(threads: readonly PersonaKeywordThread[], filter: MemoryGraphViewFilter): PersonaKeywordThread[] {
    const query = filter.query.trim().toLocaleLowerCase();
    return threads.filter((thread) => (query.length === 0 || thread.keyword.token.toLocaleLowerCase().includes(query))
        && (!filter.recentOnly || thread.keyword.query_match || thread.keyword.recent_count > 0));
}

function memoryRelationEmphasis(relation: PersonaContextRelation): MemoryGraphEmphasis {
    if (relation.rival?.mentioned_now === true) return 'query';
    return relation.rival !== null && relation.rival.user_message_count > 0 ? 'recent' : 'history';
}

export function buildMemoryContextGraphLayout(
    graph: PersonaContextGraph,
    subject: MemoryGraphLayoutSubject,
    threads: readonly PersonaKeywordThread[],
    labels: EverTalkLabels,
): MemoryGraphLayout {
    const maxPriority = Math.max(1, ...threads.map((thread) => thread.keyword.priority));
    const maxCanonStrength = Math.max(1, ...graph.relations.map((relation) => relation.canon_strength));
    const center: MemoryGraphPoint = { x: 0, y: 0 };
    const clusterStartRadius = MEMORY_GRAPH_PERSONA_RADIUS + MEMORY_GRAPH_CLUSTER_INNER_GAP;
    const keywordDiameters = threads.map((thread) => (MEMORY_GRAPH_KEYWORD_MIN_RADIUS + (MEMORY_GRAPH_KEYWORD_MAX_RADIUS - MEMORY_GRAPH_KEYWORD_MIN_RADIUS) * Math.sqrt(thread.keyword.priority / maxPriority)) * 2);
    const keywordPoints = placeMemoryGraphArcNodes(keywordDiameters, {
        center,
        startRadius: clusterStartRadius,
        startAngle: -MEMORY_GRAPH_KEYWORD_ARC_HALF_ANGLE,
        endAngle: MEMORY_GRAPH_KEYWORD_ARC_HALF_ANGLE,
        startClearance: 0,
        endClearance: 0,
    });
    const relationDiameters = graph.relations.map((relation) => (MEMORY_GRAPH_RELATION_MIN_RADIUS + (MEMORY_GRAPH_RELATION_MAX_RADIUS - MEMORY_GRAPH_RELATION_MIN_RADIUS) * Math.sqrt(relation.canon_strength / maxCanonStrength)) * 2);
    const relationPoints = placeMemoryGraphRelationNodes(relationDiameters, center, clusterStartRadius);
    const relationReach = memoryGraphHorizontalReach(relationPoints, relationDiameters, center, -1);
    const keywordReach = Math.max(MEMORY_GRAPH_PERSONA_RADIUS, memoryGraphHorizontalReach(keywordPoints, keywordDiameters, center, 1));
    const saviorX = center.x - (Math.max(clusterStartRadius, relationReach) + MEMORY_GRAPH_SAVIOR_CLEARANCE + MEMORY_GRAPH_SAVIOR_RADIUS);
    const clusterHalfHeight = Math.max(
        MEMORY_GRAPH_PERSONA_RADIUS,
        ...keywordPoints.map((point, index) => Math.abs(point.y) + keywordDiameters[index] / 2),
        ...relationPoints.map((point, index) => Math.abs(point.y) + relationDiameters[index] / 2),
    );
    const persona: MemoryGraphNode = {
        id: `${graph.persona_id}-persona`,
        personaId: graph.persona_id,
        kind: 'persona',
        x: center.x,
        y: center.y,
        width: MEMORY_GRAPH_PERSONA_RADIUS * 2,
        height: MEMORY_GRAPH_PERSONA_RADIUS * 2,
        title: subject.spirit_name,
        value: `Lv.${graph.familiarity_level}`,
        lines: [],
        emphasis: 'query',
        rank: 0,
    };
    const savior: MemoryGraphNode = {
        id: `${graph.persona_id}-savior`,
        personaId: graph.persona_id,
        kind: 'savior',
        x: saviorX,
        y: center.y,
        width: MEMORY_GRAPH_SAVIOR_RADIUS * 2,
        height: MEMORY_GRAPH_SAVIOR_RADIUS * 2,
        title: subject.savior_name,
        value: labels.memoryGraphSaviorValue(graph.savior_message_count),
        lines: [],
        emphasis: 'query',
        rank: 0,
    };
    const stageRows = Math.ceil(graph.behavior_stages.length / MEMORY_GRAPH_STAGE_COLUMNS);
    const stageColumnLeft = keywordReach + MEMORY_GRAPH_COLUMN_GAP;
    const stageTop = center.y - (stageRows * (MEMORY_GRAPH_STAGE_HEIGHT + MEMORY_GRAPH_CARD_GAP) - MEMORY_GRAPH_CARD_GAP) / 2;
    const stageNodes = graph.behavior_stages.map((stage, order): MemoryGraphNode => ({
        id: `stage:${stage.kind}`,
        personaId: graph.persona_id,
        kind: 'stage',
        x: stageColumnLeft + MEMORY_GRAPH_STAGE_WIDTH / 2 + (order % MEMORY_GRAPH_STAGE_COLUMNS) * (MEMORY_GRAPH_STAGE_WIDTH + MEMORY_GRAPH_CARD_GAP),
        y: stageTop + MEMORY_GRAPH_STAGE_HEIGHT / 2 + Math.floor(order / MEMORY_GRAPH_STAGE_COLUMNS) * (MEMORY_GRAPH_STAGE_HEIGHT + MEMORY_GRAPH_CARD_GAP),
        width: MEMORY_GRAPH_STAGE_WIDTH,
        height: MEMORY_GRAPH_STAGE_HEIGHT,
        title: labels.memoryBehaviorStages[stage.kind].title,
        value: labels.memoryBehaviorStages[stage.kind].description,
        lines: stage.items.length === 0 ? [labels.memoryBehaviorStageEmpty] : stage.items,
        emphasis: stage.items.length === 0 ? 'history' : 'recent',
        rank: order + 1,
    }));
    const stagesBottom = stageNodes.length === 0 ? center.y : stageTop + stageRows * (MEMORY_GRAPH_STAGE_HEIGHT + MEMORY_GRAPH_CARD_GAP) - MEMORY_GRAPH_CARD_GAP;
    const sessionY = Math.max(center.y + clusterHalfHeight, stagesBottom) + MEMORY_GRAPH_ROW_GAP + MEMORY_GRAPH_SESSION_HEIGHT / 2;
    const sessionRowLeft = saviorX - MEMORY_GRAPH_SAVIOR_RADIUS;
    const sessionNodes = graph.sessions.map((session, order): MemoryGraphNode => ({
        id: `session:${session.room_id}`,
        personaId: graph.persona_id,
        kind: 'session',
        x: sessionRowLeft + MEMORY_GRAPH_SESSION_WIDTH / 2 + order * (MEMORY_GRAPH_SESSION_WIDTH + MEMORY_GRAPH_CARD_GAP),
        y: sessionY,
        width: MEMORY_GRAPH_SESSION_WIDTH,
        height: MEMORY_GRAPH_SESSION_HEIGHT,
        title: `${formatDateTime(session.covered_from, labels)} ~ ${formatDateTime(session.covered_through, labels)}`,
        value: labels.memorySessionsTitle,
        lines: session.summary.split('\n').filter((line) => line.trim().length > 0),
        emphasis: 'history',
        rank: order + 1,
    }));
    const keywordNodes = threads.map((thread, order): MemoryGraphNode => {
        return {
            id: `keyword:${thread.keyword.token}`,
            personaId: graph.persona_id,
            kind: 'keyword',
            x: keywordPoints[order].x,
            y: keywordPoints[order].y,
            width: keywordDiameters[order],
            height: keywordDiameters[order],
            title: thread.keyword.token,
            value: labels.memoryGraphKeywordCounts(thread.keyword.user_count, thread.keyword.spirit_count),
            lines: [],
            emphasis: memoryKeywordEmphasis(thread),
            rank: order + 1,
        };
    });
    const relationNodes = graph.relations.map((relation, order): MemoryGraphNode => {
        return {
            id: `relation:${relation.relation.character_key}`,
            personaId: relation.relation.persona_ids[0] ?? '',
            kind: 'relation',
            x: relationPoints[order].x,
            y: relationPoints[order].y,
            width: relationDiameters[order],
            height: relationDiameters[order],
            title: relation.relation.name,
            value: labels.memoryGraphRelationValue(relation.savior_familiarity_level),
            lines: [],
            emphasis: memoryRelationEmphasis(relation),
            rank: order + 1,
        };
    });
    const edges: MemoryGraphEdge[] = [
        {
            id: `edge:${savior.id}`,
            source: persona,
            target: savior,
            kind: 'savior_bond',
            label: labels.memoryGraphEdgeSaviorBondLabel(graph.familiarity_level, graph.savior_message_count),
            weight: 1,
            emphasis: 'query',
        },
        ...keywordNodes.map((node, order): MemoryGraphEdge => ({
            id: `edge:${node.id}`,
            source: persona,
            target: node,
            kind: 'topic',
            label: node.rank <= MEMORY_GRAPH_TOPIC_LABEL_RANK_LIMIT ? labels.memoryGraphEdgeTopicLabel(threads[order].keyword.priority) : '',
            weight: Math.max(MEMORY_GRAPH_MIN_EDGE_WEIGHT, threads[order].keyword.priority / maxPriority),
            emphasis: node.emphasis,
        })),
        ...relationNodes.map((node, order): MemoryGraphEdge => ({
            id: `edge:${node.id}`,
            source: persona,
            target: node,
            kind: 'canon_bond',
            label: labels.memoryGraphEdgeCanonBondLabel(graph.relations[order].canon_strength, graph.relations[order].relation.shared_union),
            weight: Math.max(MEMORY_GRAPH_MIN_EDGE_WEIGHT, graph.relations[order].canon_strength / maxCanonStrength),
            emphasis: node.emphasis,
        })),
        ...relationNodes.flatMap((node, order): MemoryGraphEdge[] => {
            const relation = graph.relations[order];
            const rivalMessages = relation.rival?.user_message_count ?? 0;
            if (rivalMessages > 0) {
                return [{
                    id: `edge:${node.id}:savior`,
                    source: node,
                    target: savior,
                    kind: 'rival_attention',
                    label: labels.memoryGraphEdgeRivalLabel(rivalMessages),
                    weight: Math.min(1, MEMORY_GRAPH_MIN_EDGE_WEIGHT + rivalMessages / Math.max(1, graph.savior_message_count)),
                    emphasis: node.emphasis,
                }];
            }
            return relation.savior_familiarity_level === null ? [] : [{
                id: `edge:${node.id}:savior`,
                source: node,
                target: savior,
                kind: 'relation_savior',
                label: labels.memoryGraphEdgeRelationSaviorLabel(relation.savior_familiarity_level),
                weight: MEMORY_GRAPH_MIN_EDGE_WEIGHT,
                emphasis: 'history',
            }];
        }),
        ...stageNodes.map((node, order): MemoryGraphEdge => ({
            id: `edge:${node.id}`,
            source: order === 0 ? persona : stageNodes[order - 1],
            target: node,
            kind: 'procedure',
            label: '',
            weight: MEMORY_GRAPH_MIN_EDGE_WEIGHT * 2,
            emphasis: node.emphasis,
        })),
        ...sessionNodes.map((node, order): MemoryGraphEdge => ({
            id: `edge:${node.id}`,
            source: order === 0 ? persona : sessionNodes[order - 1],
            target: node,
            kind: 'session',
            label: '',
            weight: MEMORY_GRAPH_MIN_EDGE_WEIGHT,
            emphasis: node.emphasis,
        })),
    ];
    return normalizeMemoryGraphLayout({
        nodes: [savior, persona, ...keywordNodes, ...relationNodes, ...stageNodes, ...sessionNodes],
        edges,
        width: 0,
        height: 0,
    });
}

function normalizeMemoryGraphLayout(layout: MemoryGraphLayout): MemoryGraphLayout {
    const bounds = memoryGraphLayoutBounds(layout.nodes);
    const offsetX = MEMORY_GRAPH_MARGIN - bounds.left;
    const offsetY = MEMORY_GRAPH_MARGIN - bounds.top;
    const nodes = layout.nodes.map((node) => ({ ...node, x: node.x + offsetX, y: node.y + offsetY }));
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    return {
        nodes,
        edges: layout.edges.map((edge) => ({ ...edge, source: nodeById.get(edge.source.id) ?? edge.source, target: nodeById.get(edge.target.id) ?? edge.target })),
        width: bounds.right - bounds.left + MEMORY_GRAPH_MARGIN * 2,
        height: bounds.bottom - bounds.top + MEMORY_GRAPH_MARGIN * 2,
    };
}

export function applyMemoryGraphNodePositions(layout: MemoryGraphLayout, positions: ReadonlyMap<string, MemoryGraphPoint>): MemoryGraphLayout {
    if (positions.size === 0) {
        return layout;
    }
    const nodes = layout.nodes.map((node) => {
        const position = positions.get(node.id);
        return position === undefined ? node : { ...node, x: position.x, y: position.y };
    });
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    return {
        nodes,
        edges: layout.edges.map((edge) => ({ ...edge, source: nodeById.get(edge.source.id) ?? edge.source, target: nodeById.get(edge.target.id) ?? edge.target })),
        width: Math.max(layout.width, ...nodes.map((node) => node.x + node.width / 2 + MEMORY_GRAPH_MARGIN)),
        height: Math.max(layout.height, ...nodes.map((node) => node.y + node.height / 2 + MEMORY_GRAPH_MARGIN)),
    };
}

export function memoryGraphEdgeLabelPoint(edge: MemoryGraphEdge): MemoryGraphPoint {
    return { x: (edge.source.x + edge.target.x) / 2, y: (edge.source.y + edge.target.y) / 2 };
}

export function memoryGraphEdgePath(edge: MemoryGraphEdge): string {
    if (edge.target.kind === 'stage' && edge.source.kind === 'stage') {
        if (Math.abs(edge.target.y - edge.source.y) < edge.source.height / 2) {
            const direction = edge.target.x >= edge.source.x ? 1 : -1;
            return `M ${edge.source.x + (direction * edge.source.width) / 2} ${edge.source.y} L ${edge.target.x - (direction * edge.target.width) / 2} ${edge.target.y}`;
        }
        const sourceY = edge.source.y + edge.source.height / 2;
        const targetY = edge.target.y - edge.target.height / 2;
        const bendY = sourceY + (targetY - sourceY) / 2;
        return `M ${edge.source.x} ${sourceY} C ${edge.source.x} ${bendY}, ${edge.target.x} ${bendY}, ${edge.target.x} ${targetY}`;
    }
    if (edge.target.kind === 'stage' || edge.target.kind === 'session') {
        const targetX = edge.target.kind === 'stage' ? edge.target.x - edge.target.width / 2 : edge.target.x;
        const targetY = edge.target.kind === 'stage' ? edge.target.y : edge.target.y - edge.target.height / 2;
        const sourceX = edge.source.kind === 'session' ? edge.source.x + edge.source.width / 2 : edge.source.x;
        const sourceY = edge.source.kind === 'session' ? edge.source.y : edge.source.y;
        const bendX = edge.target.kind === 'stage' ? sourceX + (targetX - sourceX) / 2 : targetX;
        return edge.target.kind === 'stage'
            ? `M ${sourceX} ${sourceY} C ${bendX} ${sourceY}, ${bendX} ${targetY}, ${targetX} ${targetY}`
            : `M ${sourceX} ${sourceY} C ${sourceX} ${targetY}, ${sourceX} ${targetY}, ${targetX} ${targetY}`;
    }
    return `M ${edge.source.x} ${edge.source.y} L ${edge.target.x} ${edge.target.y}`;
}

export function resolveMemoryGraphDetailPosition(node: MemoryGraphNode, graph: MemoryGraphLayout): MemoryGraphDetailPosition {
    const rightSide = node.x + node.width / 2 + MEMORY_GRAPH_DETAIL_OFFSET;
    const left = rightSide + MEMORY_GRAPH_DETAIL_WIDTH <= graph.width
        ? rightSide
        : Math.max(0, node.x - node.width / 2 - MEMORY_GRAPH_DETAIL_OFFSET - MEMORY_GRAPH_DETAIL_WIDTH);
    return { left, top: Math.max(0, node.y - node.height / 2) };
}
export const MEMORY_GRAPH_ZOOM_MIN = 0.08;
export const MEMORY_GRAPH_ZOOM_MAX = 3;
export const MEMORY_GRAPH_ZOOM_STEP = 1.2;
export const MEMORY_GRAPH_DEFAULT_ZOOM = 1;
export const MEMORY_GRAPH_DEFAULT_VIEW: MemoryGraphViewTransform = { x: 0, y: 0, zoom: MEMORY_GRAPH_DEFAULT_ZOOM };
export const MEMORY_GRAPH_BACKGROUND_GRID_PX = 18;
const MEMORY_GRAPH_ZOOM_PRECISION = 1000;
const MEMORY_GRAPH_FIT_PADDING_PX = 24;
export function clampMemoryGraphZoom(zoom: number): number {
    const bounded = Math.min(MEMORY_GRAPH_ZOOM_MAX, Math.max(MEMORY_GRAPH_ZOOM_MIN, zoom));
    return Math.round(bounded * MEMORY_GRAPH_ZOOM_PRECISION) / MEMORY_GRAPH_ZOOM_PRECISION;
}
export function zoomMemoryGraphViewAt(view: MemoryGraphViewTransform, requestedZoom: number, anchor: ImageViewerPoint): MemoryGraphViewTransform {
    const zoom = clampMemoryGraphZoom(requestedZoom);
    const contentX = (anchor.x - view.x) / view.zoom;
    const contentY = (anchor.y - view.y) / view.zoom;
    return { x: anchor.x - contentX * zoom, y: anchor.y - contentY * zoom, zoom };
}
export function computeMemoryGraphFitView(bounds: MemoryGraphBounds, viewport: ImageViewerSize): MemoryGraphViewTransform {
    const contentWidth = bounds.right - bounds.left;
    const contentHeight = bounds.bottom - bounds.top;
    const availableWidth = viewport.width - MEMORY_GRAPH_FIT_PADDING_PX * 2;
    const availableHeight = viewport.height - MEMORY_GRAPH_FIT_PADDING_PX * 2;
    if (contentWidth <= 0 || contentHeight <= 0 || availableWidth <= 0 || availableHeight <= 0) {
        return MEMORY_GRAPH_DEFAULT_VIEW;
    }
    const zoom = clampMemoryGraphZoom(Math.min(MEMORY_GRAPH_DEFAULT_ZOOM, availableWidth / contentWidth, availableHeight / contentHeight));
    return {
        x: (viewport.width - contentWidth * zoom) / 2 - bounds.left * zoom,
        y: (viewport.height - contentHeight * zoom) / 2 - bounds.top * zoom,
        zoom,
    };
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
export type FamiliaritySigilGrade = FamiliarityGrade;
export const FAMILIARITY_SIGIL_MILESTONES = FAMILIARITY_GRADE_MILESTONES;
export function resolveFamiliaritySigilGrade(level: number): FamiliaritySigilGrade | null {
    return resolveFamiliarityGrade(level);
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
export function settingsSectionNavItems(labels: EverTalkLabels): SettingsSectionNavItem[] {
    return [
        { key: 'general', label: labels.currentSettings },
        { key: 'environment', label: labels.environmentTitle },
        { key: 'models', label: labels.modelListTitle },
        { key: 'modules', label: labels.modulesSectionTitle },
        { key: 'sessions', label: labels.localModel },
        { key: 'data', label: labels.backupTitle },
        { key: 'reset', label: labels.resetData },
    ];
}
export function groupLocalModelEntries(entries: ChatModelEntry[]): LocalModelEntryGroup[] {
    const groups: LocalModelEntryGroup[] = [];
    for (const entry of entries) {
        if (entry.engine === 'chrome_prompt' || entry.engine === 'android_gemini_nano' || entry.engine === 'native_host') {
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
