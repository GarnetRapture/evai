import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
    Animated,
    Easing,
    PanResponder,
    Pressable,
    StyleSheet,
    Text,
    View,
    useAnimatedValue,
    useWindowDimensions,
    type LayoutChangeEvent,
    type StyleProp,
    type TextStyle,
} from 'react-native';
import { buildHeartTimelineChart, nearestHeartTimelineIndex } from '../../../../../src/domains/evertalk/logic';
import type { HeartExpressionKey, HeartMetricKey, HeartTimelineChart, HeartTimelineSeriesKey } from '../../../../../src/domains/evertalk/types';
import { Icon } from '../../../shared/icons';
import { touchFrameOrigin, useReducedMotion } from '../../../shared/interaction';
import { clampSize } from '../../../shared/layout';
import EvaiVectorView from '../../../shared/native/specs/EvaiVectorViewNativeComponent';
import { serializeVectorShapes, type VectorShape } from '../../../shared/vector';
import type { PersonaContextGraph, PersonaHeartTimelinePoint } from '../../chat';
import type { AndroidLabels } from '../labels';

const HEART_CHART_WIDTH = 360;
const HEART_CHART_PLOT_HEIGHT = 170;
const HEART_CHART_BAR_HEIGHT = 34;
const HEART_CHART_BAR_GAP = 18;
const HEART_CHART_MARGIN = { top: 12, right: 64, bottom: 22, left: 30 };
const HEART_METRIC_KEYS: readonly HeartMetricKey[] = ['affection', 'trust', 'longing', 'hurt', 'jealousy'];
const HEART_EXPRESSION_KEYS: readonly HeartExpressionKey[] = ['openness', 'outward_warmth', 'receptiveness', 'initiative'];
const HEART_SERIES_KEYS: readonly HeartTimelineSeriesKey[] = ['affection', 'trust', 'longing', 'hurt'];
const HEART_COLORS: Readonly<Record<HeartMetricKey, string>> = {
    affection: '#3987e5',
    trust: '#d95926',
    longing: '#199e70',
    hurt: '#c98500',
    jealousy: '#ff5f7a',
};
const HEART_COMPACT_MAX_WIDTH = 680;
const HEART_TILE_COLUMNS = 5;
const HEART_TILE_COMPACT_COLUMNS = 3;
const HEART_EXPRESSION_LABEL_WIDTH = 128;
const HEART_EXPRESSION_LABEL_COMPACT_WIDTH = 104;
const HEART_EXPRESSION_VALUE_WIDTH = 44;
const HEART_EXPRESSION_VALUE_COMPACT_WIDTH = 40;
const HEART_METER_MAX = 100;
const HEART_TICK_LABEL_OFFSET = 6;
const HEART_END_LABEL_OFFSET = 8;
const HEART_DAY_LABEL_OFFSET = 14;
const HEART_DOT_RADIUS = 4;
const HEART_CROSSHAIR_RADIUS = 4.5;
const HEART_BAR_RADIUS = 2;
const HEART_CHART_FONT_SIZE = 10;
const HEART_CHART_TEXT_BOX_WIDTH = 200;
const HEART_LINE_REVEAL_BLEED = 1;
const HEART_LINE_REVEAL_DURATION_MS = 1100;
const HEART_LINE_REVEAL_EASING = Easing.bezier(0, 0, 0.58, 1);
const HEART_PANEL_TITLE_ID = 'memory-heart-title';

export interface MemoryHeartPanelProps {
    graph: PersonaContextGraph;
    spiritName: string;
    labels: AndroidLabels;
}

interface HeartChartTextProps {
    x: number;
    y: number;
    anchor: 'start' | 'end';
    scale: number;
    style: StyleProp<TextStyle>;
    children: ReactNode;
}

interface HeartHoverSource {
    chart: HeartTimelineChart;
    pointCount: number;
    scale: number;
}

function chunkRows<T>(items: readonly T[], columns: number): T[][] {
    return Array.from({ length: Math.ceil(items.length / columns) }, (_, row) => items.slice(row * columns, row * columns + columns));
}

function circlePath(centerX: number, centerY: number, radius: number): string {
    return `M${centerX - radius} ${centerY} A${radius} ${radius} 0 1 0 ${centerX + radius} ${centerY} A${radius} ${radius} 0 1 0 ${centerX - radius} ${centerY} Z`;
}

function roundedRectPath(x: number, y: number, width: number, height: number, radius: number): string {
    const corner = Math.min(radius, width / 2, height / 2);
    return [
        `M${x + corner} ${y}`,
        `H${x + width - corner}`,
        `A${corner} ${corner} 0 0 1 ${x + width} ${y + corner}`,
        `V${y + height - corner}`,
        `A${corner} ${corner} 0 0 1 ${x + width - corner} ${y + height}`,
        `H${x + corner}`,
        `A${corner} ${corner} 0 0 1 ${x} ${y + height - corner}`,
        `V${y + corner}`,
        `A${corner} ${corner} 0 0 1 ${x + corner} ${y}`,
        'Z',
    ].join(' ');
}

function HeartChartText({ x, y, anchor, scale, style, children }: HeartChartTextProps) {
    const fontSize = HEART_CHART_FONT_SIZE * scale;
    const boxHeight = fontSize * 1.6;
    const boxWidth = HEART_CHART_TEXT_BOX_WIDTH * scale;
    return (
        <View
            pointerEvents="none"
            style={[
                styles.chartTextBox,
                anchor === 'end' ? styles.chartTextBoxEnd : null,
                { left: anchor === 'end' ? x * scale - boxWidth : x * scale, top: y * scale - boxHeight / 2, width: boxWidth, height: boxHeight },
            ]}
        >
            <Text numberOfLines={1} style={[style, { fontSize, lineHeight: boxHeight }]}>{children}</Text>
        </View>
    );
}

interface MemoryHeartChartProps {
    points: readonly PersonaHeartTimelinePoint[];
    spiritName: string;
    labels: AndroidLabels;
}

function MemoryHeartChart({ points, spiritName, labels }: MemoryHeartChartProps) {
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const [chartWidth, setChartWidth] = useState(0);
    const [tooltipWidth, setTooltipWidth] = useState<number | null>(null);
    const reducedMotion = useReducedMotion();
    const reveal = useAnimatedValue(0);
    const chart = useMemo(
        () => buildHeartTimelineChart(points, HEART_CHART_WIDTH, HEART_CHART_PLOT_HEIGHT, HEART_CHART_BAR_HEIGHT, HEART_CHART_BAR_GAP),
        [points],
    );
    const activeIndex = hoverIndex !== null && hoverIndex < chart.x_positions.length ? hoverIndex : null;
    const hovered = activeIndex === null ? null : points[activeIndex] ?? null;
    const svgWidth = HEART_CHART_MARGIN.left + chart.width + HEART_CHART_MARGIN.right;
    const svgHeight = HEART_CHART_MARGIN.top + chart.bar_top + chart.bar_height + HEART_CHART_MARGIN.bottom;
    const scale = chartWidth / svgWidth;
    const barBottom = chart.bar_top + chart.bar_height;
    const hoverSource = useRef<HeartHoverSource>({ chart, pointCount: points.length, scale });
    const frameOriginX = useRef(0);
    useLayoutEffect(() => {
        hoverSource.current = { chart, pointCount: points.length, scale };
    });
    useEffect(() => {
        if (reducedMotion) {
            reveal.setValue(1);
            return undefined;
        }
        const animation = Animated.timing(reveal, {
            toValue: 1,
            duration: HEART_LINE_REVEAL_DURATION_MS,
            easing: HEART_LINE_REVEAL_EASING,
            useNativeDriver: true,
        });
        animation.start();
        return () => animation.stop();
    }, [reducedMotion, reveal]);
    const [chartHandlers] = useState(() => {
        function hoverAt(pageX: number) {
            const source = hoverSource.current;
            if (source.scale === 0 || source.pointCount === 0) {
                return;
            }
            const x = (pageX - frameOriginX.current) / source.scale - HEART_CHART_MARGIN.left;
            setHoverIndex(nearestHeartTimelineIndex(source.chart, x));
        }
        return PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderGrant: (event) => {
                frameOriginX.current = touchFrameOrigin(event.nativeEvent).x;
                hoverAt(event.nativeEvent.pageX);
            },
            onPanResponderMove: (event) => hoverAt(event.nativeEvent.pageX),
            onPanResponderRelease: () => setHoverIndex(null),
            onPanResponderTerminate: () => setHoverIndex(null),
            onPanResponderTerminationRequest: () => true,
            onShouldBlockNativeResponder: () => false,
        }).panHandlers;
    });
    const viewBox = { viewBoxX: -HEART_CHART_MARGIN.left, viewBoxY: -HEART_CHART_MARGIN.top, viewBoxWidth: svgWidth, viewBoxHeight: svgHeight };
    const gridShapes = useMemo(() => serializeVectorShapes(chart.y_ticks.map((tick): VectorShape => ({
        d: `M0 ${tick.y} H${chart.width}`,
        stroke: 'rgba(255, 255, 255, 0.08)',
        strokeWidth: 1,
        cap: 'butt',
    }))), [chart]);
    const lineShapes = useMemo(() => serializeVectorShapes(chart.series.map((series): VectorShape => ({
        d: series.path,
        stroke: HEART_COLORS[series.key],
        strokeWidth: 2,
        cap: 'round',
        join: 'round',
    }))), [chart]);
    const markShapes = useMemo(() => serializeVectorShapes([
        ...(points.length === 1
            ? chart.series.map((series): VectorShape => ({
                d: circlePath(series.end.x, series.end.y, HEART_DOT_RADIUS),
                fill: '#292839',
                stroke: HEART_COLORS[series.key],
                strokeWidth: 2,
            }))
            : []),
        { d: `M0 ${barBottom} H${chart.width}`, stroke: 'rgba(255, 255, 255, 0.18)', strokeWidth: 1, cap: 'butt' },
        ...chart.bars
            .filter((bar) => bar.height > 0)
            .map((bar): VectorShape => ({ d: roundedRectPath(bar.x, bar.y, bar.width, bar.height, HEART_BAR_RADIUS), fill: '#7d7699' })),
    ]), [barBottom, chart, points.length]);
    const crosshairShapes = useMemo(() => {
        if (activeIndex === null) {
            return null;
        }
        const x = chart.x_positions[activeIndex];
        return serializeVectorShapes([
            { d: `M${x} 0 V${barBottom}`, stroke: 'rgba(255, 255, 255, 0.35)', strokeWidth: 1, cap: 'butt', dash: [3, 3] },
            ...chart.series.map((series): VectorShape => ({
                d: circlePath(series.coordinates[activeIndex].x, series.coordinates[activeIndex].y, HEART_CROSSHAIR_RADIUS),
                fill: '#292839',
                stroke: HEART_COLORS[series.key],
                strokeWidth: 2,
            })),
        ]);
    }, [activeIndex, barBottom, chart]);
    const frameWidth = svgWidth * scale;
    const revealStart = (HEART_CHART_MARGIN.left - HEART_LINE_REVEAL_BLEED) * scale;
    const revealEnd = (HEART_CHART_MARGIN.left + chart.width + HEART_LINE_REVEAL_BLEED) * scale;
    const tooltipCenter = activeIndex === null ? 0 : (HEART_CHART_MARGIN.left + chart.x_positions[activeIndex]) * scale;
    const tooltipLeft = tooltipWidth === null
        ? tooltipCenter
        : Math.max(0, Math.min(chartWidth - tooltipWidth, tooltipCenter - tooltipWidth / 2));
    const toSvgX = (x: number) => HEART_CHART_MARGIN.left + x;
    const toSvgY = (y: number) => HEART_CHART_MARGIN.top + y;
    return (
        <View style={styles.chart}>
            <View
                collapsable={false}
                accessible={true}
                accessibilityRole="image"
                accessibilityLabel={labels.memoryHeartChartLabel(spiritName)}
                style={[styles.chartCanvas, { aspectRatio: svgWidth / svgHeight }]}
                onLayout={(event: LayoutChangeEvent) => setChartWidth(event.nativeEvent.layout.width)}
                {...chartHandlers}
            >
                <EvaiVectorView pointerEvents="none" shapes={gridShapes} {...viewBox} style={styles.chartLayer}/>
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.chartLayer,
                        styles.chartReveal,
                        {
                            opacity: reveal,
                            transform: [{ translateX: reveal.interpolate({ inputRange: [0, 1], outputRange: [revealStart - frameWidth, revealEnd - frameWidth] }) }],
                        },
                    ]}
                >
                    <Animated.View
                        style={[
                            styles.chartLayer,
                            { transform: [{ translateX: reveal.interpolate({ inputRange: [0, 1], outputRange: [frameWidth - revealStart, frameWidth - revealEnd] }) }] },
                        ]}
                    >
                        <EvaiVectorView pointerEvents="none" shapes={lineShapes} {...viewBox} style={styles.chartLayer}/>
                    </Animated.View>
                </Animated.View>
                <EvaiVectorView pointerEvents="none" shapes={markShapes} {...viewBox} style={styles.chartLayer}/>
                {scale === 0 ? null : (
                    <View pointerEvents="none" style={styles.chartLayer}>
                        {chart.y_ticks.map((tick) => (
                            <HeartChartText key={tick.value} x={toSvgX(-HEART_TICK_LABEL_OFFSET)} y={toSvgY(tick.y)} anchor="end" scale={scale} style={styles.chartAxisText}>
                                {tick.value}
                            </HeartChartText>
                        ))}
                        {chart.series.map((series) => (
                            <HeartChartText
                                key={series.key}
                                x={toSvgX(chart.width + HEART_END_LABEL_OFFSET)}
                                y={toSvgY(series.end_label_y)}
                                anchor="start"
                                scale={scale}
                                style={styles.chartEndText}
                            >
                                {labels.memoryHeartMetrics[series.key]} {series.end_value}
                            </HeartChartText>
                        ))}
                        <HeartChartText x={toSvgX(0)} y={toSvgY(barBottom + HEART_DAY_LABEL_OFFSET)} anchor="start" scale={scale} style={styles.chartAxisText}>
                            {points[0].day}
                        </HeartChartText>
                        {points.length > 1 ? (
                            <HeartChartText x={toSvgX(chart.width)} y={toSvgY(barBottom + HEART_DAY_LABEL_OFFSET)} anchor="end" scale={scale} style={styles.chartAxisText}>
                                {points[points.length - 1].day}
                            </HeartChartText>
                        ) : null}
                    </View>
                )}
                {crosshairShapes === null ? null : <EvaiVectorView pointerEvents="none" shapes={crosshairShapes} {...viewBox} style={styles.chartLayer}/>}
            </View>
            {hovered === null ? null : (
                <View
                    pointerEvents="none"
                    accessibilityLiveRegion="polite"
                    onLayout={(event: LayoutChangeEvent) => setTooltipWidth(event.nativeEvent.layout.width)}
                    style={[styles.tooltip, { left: tooltipLeft, opacity: tooltipWidth === null ? 0 : 1 }]}
                >
                    <Text style={styles.tooltipDay}>{hovered.day}</Text>
                    {HEART_SERIES_KEYS.map((key) => (
                        <View key={key} style={styles.tooltipRow}>
                            <View style={[styles.dot, { backgroundColor: HEART_COLORS[key] }]}/>
                            <Text style={styles.tooltipLabel}>{labels.memoryHeartMetrics[key]}</Text>
                            <Text style={styles.tooltipValue}>{hovered[key]}</Text>
                        </View>
                    ))}
                    <Text style={styles.tooltipNote}>{labels.memoryHeartRivalCount(hovered.rival_message_count)}</Text>
                </View>
            )}
        </View>
    );
}

export function MemoryHeartPanel({ graph, spiritName, labels }: MemoryHeartPanelProps) {
    const [tableOpen, setTableOpen] = useState(false);
    const { width: windowWidth } = useWindowDimensions();
    const points = graph.heart_timeline;
    const heart = graph.heart;
    const compact = windowWidth <= HEART_COMPACT_MAX_WIDTH;
    const tileColumns = compact ? HEART_TILE_COMPACT_COLUMNS : HEART_TILE_COLUMNS;
    const expressionLabelWidth = compact ? HEART_EXPRESSION_LABEL_COMPACT_WIDTH : HEART_EXPRESSION_LABEL_WIDTH;
    const expressionValueWidth = compact ? HEART_EXPRESSION_VALUE_COMPACT_WIDTH : HEART_EXPRESSION_VALUE_WIDTH;
    return (
        <View style={styles.panel} accessibilityLabelledBy={HEART_PANEL_TITLE_ID}>
            <View style={styles.head}>
                <Icon name="HeartPulse" size={20} color="#ff9ec2" style={styles.headIcon}/>
                <View style={styles.headText}>
                    <Text nativeID={HEART_PANEL_TITLE_ID} accessibilityRole="header" style={styles.title}>{labels.memoryHeartTitle}</Text>
                    <Text style={styles.description}>{labels.memoryHeartDescription(spiritName)}</Text>
                </View>
            </View>
            {heart === null || points.length === 0 ? <Text style={styles.empty}>{labels.memoryHeartEmpty}</Text> : (
                <>
                    <View style={styles.tiles}>
                        {chunkRows(HEART_METRIC_KEYS, tileColumns).map((row) => (
                            <View key={row.join(':')} style={styles.tileRow}>
                                {row.map((key) => (
                                    <View key={key} style={styles.tile}>
                                        <View style={styles.tileLabel}>
                                            <View style={[styles.dot, { backgroundColor: HEART_COLORS[key] }]}/>
                                            <Text style={styles.tileLabelText}>{labels.memoryHeartMetrics[key]}</Text>
                                        </View>
                                        <Text style={styles.tileValue}>{heart.heart[key]}</Text>
                                    </View>
                                ))}
                                {Array.from({ length: tileColumns - row.length }, (_, index) => (
                                    <View key={`spacer-${index}`} style={styles.tileSpacer}/>
                                ))}
                            </View>
                        ))}
                    </View>
                    <View style={styles.expressions}>
                        {HEART_EXPRESSION_KEYS.map((key) => (
                            <View key={key} style={styles.expressionRow}>
                                <Text style={[styles.expressionLabel, { width: expressionLabelWidth }]}>{labels.memoryHeartExpressions[key]}</Text>
                                <View
                                    accessible={true}
                                    accessibilityRole="progressbar"
                                    accessibilityLabel={labels.memoryHeartExpressions[key]}
                                    accessibilityValue={{ min: 0, max: HEART_METER_MAX, now: heart[key] }}
                                    style={styles.meter}
                                >
                                    <View style={[styles.meterFill, { width: `${clampSize(0, heart[key], HEART_METER_MAX)}%` }]}/>
                                </View>
                                <Text style={[styles.expressionValue, { width: expressionValueWidth }]}>{heart[key]}%</Text>
                            </View>
                        ))}
                    </View>
                    <Text style={styles.summary}>{labels.memoryHeartContactSummary(heart.heart.contact_days, heart.heart.savior_message_count)}</Text>
                    <View style={styles.legend}>
                        {HEART_SERIES_KEYS.map((key) => (
                            <View key={key} style={styles.legendItem}>
                                <View style={[styles.dot, { backgroundColor: HEART_COLORS[key] }]}/>
                                <Text style={styles.legendText}>{labels.memoryHeartMetrics[key]}</Text>
                            </View>
                        ))}
                        <View style={styles.legendItem}>
                            <View style={styles.legendBar}/>
                            <Text style={styles.legendText}>{labels.memoryHeartRivalBarLabel}</Text>
                        </View>
                    </View>
                    <MemoryHeartChart points={points} spiritName={spiritName} labels={labels}/>
                    <View style={styles.table}>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityState={{ expanded: tableOpen }}
                            onPress={() => setTableOpen((open) => !open)}
                            style={({ pressed }) => [styles.tableToggle, pressed && styles.tableTogglePressed]}
                        >
                            <Icon name={tableOpen ? 'ChevronDown' : 'ChevronRight'} size={12} color="#d8d3e8"/>
                            <Text style={styles.tableToggleText}>{labels.memoryHeartTableToggle}</Text>
                        </Pressable>
                        {tableOpen ? (
                            <View style={styles.tableGrid}>
                                <View style={styles.tableRow}>
                                    <Text style={[styles.tableCell, styles.tableFirstCell, styles.tableHeadCell]}>{labels.memoryHeartDayLabel}</Text>
                                    {HEART_SERIES_KEYS.map((key) => (
                                        <Text key={key} style={[styles.tableCell, styles.tableHeadCell]}>{labels.memoryHeartMetrics[key]}</Text>
                                    ))}
                                    <Text style={[styles.tableCell, styles.tableHeadCell]}>{labels.memoryHeartRivalBarLabel}</Text>
                                </View>
                                {[...points].reverse().map((point) => (
                                    <View key={point.day} style={styles.tableRow}>
                                        <Text style={[styles.tableCell, styles.tableFirstCell, styles.tableRowHeadCell]}>{point.day}</Text>
                                        {HEART_SERIES_KEYS.map((key) => (
                                            <Text key={key} style={styles.tableCell}>{point[key]}</Text>
                                        ))}
                                        <Text style={styles.tableCell}>{point.rival_message_count}</Text>
                                    </View>
                                ))}
                            </View>
                        ) : null}
                    </View>
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    panel: {
        flexDirection: 'column',
        gap: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#4c4962',
        borderRadius: 18,
        backgroundColor: '#292839',
        boxShadow: '0px 18px 38px rgba(43, 39, 64, 0.2)',
    },
    head: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    headIcon: {
        flexShrink: 0,
        marginTop: 2,
    },
    headText: {
        flex: 1,
        minWidth: 0,
        gap: 4,
    },
    title: {
        color: '#f5f2fa',
        fontSize: 16,
        lineHeight: 24,
        fontWeight: '900',
    },
    description: {
        color: '#bdb7cc',
        fontSize: 12,
        lineHeight: 17.4,
    },
    empty: {
        color: '#c3bdd2',
        fontSize: 14,
        lineHeight: 21,
    },
    tiles: {
        gap: 6,
    },
    tileRow: {
        flexDirection: 'row',
        gap: 6,
    },
    tile: {
        flex: 1,
        minWidth: 0,
        alignItems: 'center',
        gap: 2,
        paddingVertical: 8,
        paddingHorizontal: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
    },
    tileSpacer: {
        flex: 1,
        minWidth: 0,
    },
    tileLabel: {
        maxWidth: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    tileLabelText: {
        flexShrink: 1,
        color: '#cfc8e2',
        fontSize: 11,
        lineHeight: 16.5,
        fontWeight: '700',
        textAlign: 'center',
    },
    tileValue: {
        color: '#f5f2fa',
        fontSize: 22,
        lineHeight: 33,
        fontWeight: '900',
        fontVariant: ['tabular-nums'],
    },
    dot: {
        width: 8,
        height: 8,
        flexShrink: 0,
        borderRadius: 4,
        backgroundColor: '#7d7699',
    },
    expressions: {
        gap: 6,
    },
    expressionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    expressionLabel: {
        color: '#cfc8e2',
        fontSize: 12,
        lineHeight: 18,
    },
    meter: {
        flex: 1,
        minWidth: 0,
        height: 8,
        overflow: 'hidden',
        borderRadius: 4,
        backgroundColor: '#efefef',
    },
    meterFill: {
        height: '100%',
        borderRadius: 4,
        backgroundColor: '#107c10',
    },
    expressionValue: {
        color: '#f5f2fa',
        fontSize: 12,
        lineHeight: 18,
        fontWeight: '700',
        textAlign: 'right',
        fontVariant: ['tabular-nums'],
    },
    summary: {
        color: '#a9a3ba',
        fontSize: 12,
        lineHeight: 18,
    },
    legend: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        rowGap: 4,
        columnGap: 14,
    },
    legendItem: {
        maxWidth: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    legendText: {
        flexShrink: 1,
        color: '#d8d3e8',
        fontSize: 12,
        lineHeight: 18,
    },
    legendBar: {
        width: 10,
        height: 10,
        borderRadius: 2,
        backgroundColor: '#7d7699',
    },
    chart: {
        position: 'relative',
    },
    chartCanvas: {
        width: '100%',
        overflow: 'hidden',
    },
    chartLayer: {
        ...StyleSheet.absoluteFill,
    },
    chartReveal: {
        overflow: 'hidden',
    },
    chartTextBox: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    chartTextBoxEnd: {
        alignItems: 'flex-end',
    },
    chartAxisText: {
        color: '#a9a3ba',
        fontVariant: ['tabular-nums'],
        includeFontPadding: false,
        textAlignVertical: 'center',
    },
    chartEndText: {
        color: '#d8d3e8',
        fontWeight: '700',
        includeFontPadding: false,
        textAlignVertical: 'center',
    },
    tooltip: {
        position: 'absolute',
        top: 4,
        zIndex: 2,
        minWidth: 132,
        gap: 3,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.14)',
        borderRadius: 10,
        backgroundColor: 'rgba(33, 32, 46, 0.96)',
        boxShadow: '0px 10px 22px rgba(10, 9, 18, 0.4)',
    },
    tooltipDay: {
        color: '#f5f2fa',
        fontSize: 12,
        lineHeight: 18,
        fontWeight: '700',
    },
    tooltipRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    tooltipLabel: {
        flex: 1,
        color: '#cfc8e2',
        fontSize: 12,
        lineHeight: 18,
    },
    tooltipValue: {
        color: '#f5f2fa',
        fontSize: 12,
        lineHeight: 18,
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
    },
    tooltipNote: {
        color: '#a9a3ba',
        fontSize: 9.6,
        lineHeight: 14.4,
    },
    table: {
        gap: 8,
    },
    tableToggle: {
        minHeight: 40,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    tableTogglePressed: {
        opacity: 0.72,
    },
    tableToggleText: {
        color: '#d8d3e8',
        fontSize: 12,
        lineHeight: 18,
        fontWeight: '700',
    },
    tableGrid: {
        width: '100%',
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'stretch',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    },
    tableCell: {
        flex: 1,
        minWidth: 0,
        paddingVertical: 4,
        paddingHorizontal: 6,
        color: '#f5f2fa',
        fontSize: 12,
        lineHeight: 18,
        textAlign: 'right',
        fontVariant: ['tabular-nums'],
    },
    tableFirstCell: {
        flex: 1.6,
        textAlign: 'left',
    },
    tableHeadCell: {
        color: '#a9a3ba',
        fontWeight: '700',
    },
    tableRowHeadCell: {
        fontWeight: '700',
    },
});
