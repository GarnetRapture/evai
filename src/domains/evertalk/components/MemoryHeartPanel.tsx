import { useMemo, useState } from 'react';
import type React from 'react';
import { HeartPulse } from 'lucide-react';
import { buildHeartTimelineChart, nearestHeartTimelineIndex } from '../logic';
import type { HeartExpressionKey, HeartMetricKey, HeartTimelineSeriesKey, MemoryHeartPanelProps } from '../types';

const HEART_CHART_WIDTH = 360;
const HEART_CHART_PLOT_HEIGHT = 170;
const HEART_CHART_BAR_HEIGHT = 34;
const HEART_CHART_BAR_GAP = 18;
const HEART_CHART_MARGIN = { top: 12, right: 64, bottom: 22, left: 30 };
const HEART_METRIC_KEYS: readonly HeartMetricKey[] = ['affection', 'trust', 'longing', 'hurt', 'jealousy'];
const HEART_EXPRESSION_KEYS: readonly HeartExpressionKey[] = ['openness', 'outward_warmth', 'receptiveness', 'initiative'];
const HEART_SERIES_KEYS: readonly HeartTimelineSeriesKey[] = ['affection', 'trust', 'longing', 'hurt'];

export function MemoryHeartPanel({ graph, spiritName, labels }: MemoryHeartPanelProps) {
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const points = graph.heart_timeline;
    const chart = useMemo(
        () => buildHeartTimelineChart(points, HEART_CHART_WIDTH, HEART_CHART_PLOT_HEIGHT, HEART_CHART_BAR_HEIGHT, HEART_CHART_BAR_GAP),
        [points],
    );
    const heart = graph.heart;
    const hovered = hoverIndex === null ? null : points[hoverIndex] ?? null;
    const svgWidth = HEART_CHART_MARGIN.left + chart.width + HEART_CHART_MARGIN.right;
    const svgHeight = HEART_CHART_MARGIN.top + chart.bar_top + chart.bar_height + HEART_CHART_MARGIN.bottom;
    const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
        const box = event.currentTarget.getBoundingClientRect();
        if (box.width === 0 || points.length === 0) return;
        const x = ((event.clientX - box.left) / box.width) * svgWidth - HEART_CHART_MARGIN.left;
        setHoverIndex(nearestHeartTimelineIndex(chart, x));
    };
    const tooltipLeft = hoverIndex === null ? 0 : ((HEART_CHART_MARGIN.left + chart.x_positions[hoverIndex]) / svgWidth) * 100;
    return (
        <section className="ever-memory-heart" aria-labelledby="memory-heart-title">
            <header className="ever-memory-heart__head">
                <HeartPulse size={20} aria-hidden="true"/>
                <div>
                    <strong id="memory-heart-title">{labels.memoryHeartTitle}</strong>
                    <span>{labels.memoryHeartDescription(spiritName)}</span>
                </div>
            </header>
            {heart === null || points.length === 0 ? <p className="ever-memory-heart__empty">{labels.memoryHeartEmpty}</p> : (
                <>
                    <div className="ever-memory-heart__tiles">
                        {HEART_METRIC_KEYS.map((key) => (
                            <article key={key} className={`is-${key}`}>
                                <span><i aria-hidden="true"/>{labels.memoryHeartMetrics[key]}</span>
                                <b>{heart.heart[key]}</b>
                            </article>
                        ))}
                    </div>
                    <div className="ever-memory-heart__expressions">
                        {HEART_EXPRESSION_KEYS.map((key) => (
                            <div key={key}>
                                <span>{labels.memoryHeartExpressions[key]}</span>
                                <meter min={0} max={100} value={heart[key]}/>
                                <b>{heart[key]}%</b>
                            </div>
                        ))}
                    </div>
                    <small className="ever-memory-heart__summary">{labels.memoryHeartContactSummary(heart.heart.contact_days, heart.heart.savior_message_count)}</small>
                    <div className="ever-memory-heart__legend">
                        {HEART_SERIES_KEYS.map((key) => <span key={key} className={`is-${key}`}><i aria-hidden="true"/>{labels.memoryHeartMetrics[key]}</span>)}
                        <span className="is-rival"><b aria-hidden="true"/>{labels.memoryHeartRivalBarLabel}</span>
                    </div>
                    <div className="ever-memory-heart__chart">
                        <svg
                            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                            role="img"
                            aria-label={labels.memoryHeartChartLabel(spiritName)}
                            onPointerMove={handlePointerMove}
                            onPointerLeave={() => setHoverIndex(null)}
                        >
                            <g transform={`translate(${HEART_CHART_MARGIN.left} ${HEART_CHART_MARGIN.top})`}>
                                {chart.y_ticks.map((tick) => (
                                    <g key={tick.value} className="ever-memory-heart__tick">
                                        <line x1={0} x2={chart.width} y1={tick.y} y2={tick.y}/>
                                        <text x={-6} y={tick.y}>{tick.value}</text>
                                    </g>
                                ))}
                                {chart.series.map((series) => <path key={series.key} className={`ever-memory-heart__line is-${series.key}`} d={series.path}/>)}
                                {points.length === 1 ? chart.series.map((series) => <circle key={series.key} className={`ever-memory-heart__dot is-${series.key}`} cx={series.end.x} cy={series.end.y} r={4}/>) : null}
                                {chart.series.map((series) => (
                                    <text key={series.key} className="ever-memory-heart__end" x={chart.width + 8} y={series.end_label_y}>{labels.memoryHeartMetrics[series.key]} {series.end_value}</text>
                                ))}
                                <line className="ever-memory-heart__baseline" x1={0} x2={chart.width} y1={chart.bar_top + chart.bar_height} y2={chart.bar_top + chart.bar_height}/>
                                {chart.bars.map((bar) => bar.height > 0 ? <rect key={bar.day} className="ever-memory-heart__bar" x={bar.x} y={bar.y} width={bar.width} height={bar.height} rx={2}/> : null)}
                                <text className="ever-memory-heart__day" x={0} y={chart.bar_top + chart.bar_height + 14}>{points[0].day}</text>
                                {points.length > 1 ? <text className="ever-memory-heart__day is-end" x={chart.width} y={chart.bar_top + chart.bar_height + 14}>{points[points.length - 1].day}</text> : null}
                                {hoverIndex === null ? null : (
                                    <g className="ever-memory-heart__crosshair">
                                        <line x1={chart.x_positions[hoverIndex]} x2={chart.x_positions[hoverIndex]} y1={0} y2={chart.bar_top + chart.bar_height}/>
                                        {chart.series.map((series) => <circle key={series.key} className={`is-${series.key}`} cx={series.coordinates[hoverIndex].x} cy={series.coordinates[hoverIndex].y} r={4.5}/>)}
                                    </g>
                                )}
                            </g>
                        </svg>
                        {hovered === null ? null : (
                            <div className="ever-memory-heart__tooltip" style={{ left: `${tooltipLeft}%` }} role="status">
                                <strong>{hovered.day}</strong>
                                {HEART_SERIES_KEYS.map((key) => <span key={key} className={`is-${key}`}><i aria-hidden="true"/>{labels.memoryHeartMetrics[key]}<b>{hovered[key]}</b></span>)}
                                <small>{labels.memoryHeartRivalCount(hovered.rival_message_count)}</small>
                            </div>
                        )}
                    </div>
                    <details className="ever-memory-heart__table">
                        <summary>{labels.memoryHeartTableToggle}</summary>
                        <table>
                            <thead>
                                <tr>
                                    <th scope="col">{labels.memoryHeartDayLabel}</th>
                                    {HEART_SERIES_KEYS.map((key) => <th key={key} scope="col">{labels.memoryHeartMetrics[key]}</th>)}
                                    <th scope="col">{labels.memoryHeartRivalBarLabel}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[...points].reverse().map((point) => (
                                    <tr key={point.day}>
                                        <th scope="row">{point.day}</th>
                                        {HEART_SERIES_KEYS.map((key) => <td key={key}>{point[key]}</td>)}
                                        <td>{point.rival_message_count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </details>
                </>
            )}
        </section>
    );
}
