import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, {
  Path,
  Line,
  Circle,
  Defs,
  LinearGradient,
  Stop,
  G,
  ClipPath,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import { Colors } from '@/src/constants/colors';
import type { CardioLog } from '@/src/lib/repository';

const CARDIO_ACCENT = '#F97316';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CardioHistoryPoint = {
  key: string;
  label: string;
  title: string;
  sessions: number;
  totalMinutes: number;
  isCurrent: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(mins: number): string {
  const m = Math.round(mins);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem > 0 ? `${h} giờ ${rem} phút` : `${h} giờ`;
  }
  return `${m} phút`;
}

type Trend = { label: string; positive: boolean | null };

function calcTrend(cur: number, prev: number): Trend {
  if (prev === 0 && cur === 0) return { label: '—', positive: null };
  const diff = cur - prev;
  const pct = prev > 0 ? Math.round((Math.abs(diff) / prev) * 100) : 100;
  if (diff > 0) return { label: `+${pct}%`, positive: true };
  if (diff < 0) return { label: `-${pct}%`, positive: false };
  return { label: '=', positive: null };
}

function trendColor(t: Trend | null): string {
  if (!t) return Colors.textMuted;
  if (t.positive === true) return Colors.success;
  if (t.positive === false) return Colors.error ?? '#EF4444';
  return Colors.textMuted;
}

function linearRegression(ys: number[]): number[] {
  const n = ys.length;
  if (n <= 1) return ys;
  const xs = ys.map((_, i) => i);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((a, x) => a + x * ys[x], 0);
  const sumXX = xs.reduce((a, x) => a + x * x, 0);
  const denom = n * sumXX - sumX ** 2;
  if (!denom) return ys;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return xs.map((x) => Math.round(intercept + slope * x));
}

// ─── Aggregation: raw CardioLog[] → weekly/monthly points ────────────────────

function getWeekStart(d: Date): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay(); // 0 = Sunday
  const diff = (day === 0 ? -6 : 1) - day; // Monday as the first day of week
  date.setDate(date.getDate() + diff);
  return date;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function fmtDateLabel(d: Date): string {
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}`;
}

/**
 * Groups raw cardio logs into per-week totals (Mon–Sun), sorted oldest → newest.
 * `label` is formatted as "DD-MM" so it plugs straight into `shortLabel('week', ...)`.
 */
export function groupCardioLogsByWeek(logs: CardioLog[]): CardioHistoryPoint[] {
    const map = new Map<string, {
    start: Date; end: Date;
    totalMinutes: number;
    sessions: number;
    days: Set<string>; 
    }>();

    for (const log of logs) {
    const d = new Date(log.logged_at);
    const start = getWeekStart(d);
    const key = start.toISOString().slice(0, 10);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    const dayKey = d.toISOString().slice(0, 10); // "YYYY-MM-DD"

    const entry = map.get(key) ?? {
        start, end, totalMinutes: 0, sessions: 0, days: new Set<string>()
    };
    entry.totalMinutes += log.duration_minutes;
    entry.days.add(dayKey);          // ← track ngày
    entry.sessions = entry.days.size; // ← sessions = số ngày duy nhất
    map.set(key, entry);
    }

  const todayKey = getWeekStart(new Date()).toISOString().slice(0, 10);

  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, v]) => ({
      key,
      label: fmtDateLabel(v.start),
      title: `Tuần ${fmtDateLabel(v.start)} – ${fmtDateLabel(v.end)}`,
      totalMinutes: v.totalMinutes,
      sessions: v.sessions,
      isCurrent: key === todayKey,
    }));
}

/**
 * Groups raw cardio logs into per-month totals, sorted oldest → newest.
 * `label` is formatted as "Tháng N" so it plugs straight into `shortLabel('month', ...)`.
 */
export function groupCardioLogsByMonth(logs: CardioLog[]): CardioHistoryPoint[] {
  const map = new Map<string, {
    year: number;
    month: number;
    totalMinutes: number;
    sessions: number;
    days: Set<string>; 
  }>();

  for (const log of logs) {
    const d = new Date(log.logged_at);
    const year = d.getFullYear();
    const month = d.getMonth();
    const key = `${year}-${pad2(month + 1)}`;

    const dayKey = d.toISOString().slice(0, 10); // ← thêm

    const entry = map.get(key) ?? {
      year, month, totalMinutes: 0, sessions: 0, days: new Set<string>() 
    };
    entry.totalMinutes += log.duration_minutes;
    entry.days.add(dayKey);           
    entry.sessions = entry.days.size; 
    map.set(key, entry);
  }

  const now = new Date();
  const curKey = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;

  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, v]) => ({
      key,
      label: `Tháng ${v.month + 1}`,
      title: `Tháng ${v.month + 1}/${v.year}`,
      totalMinutes: v.totalMinutes,
      sessions: v.sessions,
      isCurrent: key === curKey,
    }));
}

// ─── SVG Chart ────────────────────────────────────────────────────────────────

const W = 340;
const H = 170;
const PAD = { top: 14, right: 28, bottom: 26, left: 46 };
const IW = W - PAD.left - PAD.right;
const IH = H - PAD.top - PAD.bottom;
const GRAD_ID = 'cardioHistGrad';
const CLIP_ID = 'cardioChartClip';

function shortLabel(label: string, mode: 'week' | 'month'): string {
  if (mode === 'week') {
    const parts = label.split('-');
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
    return label;
  }
  const m = label.match(/(\d{1,2})/);
  return m ? `T${m[1]}` : label;
}

type SvgChartProps = {
  points: CardioHistoryPoint[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
  mode: 'week' | 'month';
};

function CardioSvgChart({ points, selectedIdx, onSelect, mode }: SvgChartProps) {
  if (points.length === 0) return null;

  const vals = points.map((p) => p.totalMinutes);
  const trend = linearRegression(vals);

  const minRaw = Math.min(...vals, 0);
  const maxRaw = Math.max(...vals, 1);
  const span = Math.max(maxRaw - minRaw, 1);
  const minV = Math.max(0, minRaw - span * 0.12);
  const maxV = maxRaw + span * 0.08;
  const range = Math.max(maxV - minV, 1);

  const toX = (i: number) =>
    PAD.left + (points.length > 1 ? (i / (points.length - 1)) * IW : IW / 2);
  const toY = (v: number) => PAD.top + IH - ((v - minV) / range) * IH;

  function smoothPath(ys: number[]): string {
    if (ys.length === 1) return `M ${toX(0)} ${toY(ys[0])}`;
    const pts = ys.map((v, i) => ({ x: toX(i), y: toY(v) }));
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const cp1x = pts[i - 1].x + (pts[i].x - pts[i - 1].x) / 3;
      const cp2x = pts[i].x - (pts[i].x - pts[i - 1].x) / 3;
      d += ` C ${cp1x} ${pts[i - 1].y}, ${cp2x} ${pts[i].y}, ${pts[i].x} ${pts[i].y}`;
    }
    return d;
  }

  const linePath = smoothPath(vals);
  const areaPath =
    linePath +
    ` L ${toX(points.length - 1)} ${PAD.top + IH}` +
    ` L ${toX(0)} ${PAD.top + IH} Z`;
  const trendPath = smoothPath(trend);

  const safe = Math.min(Math.max(selectedIdx, 0), points.length - 1);

  const ticks = Array.from({ length: 4 }, (_, i) => {
    const v = minV + (range * i) / 3;
    return { v: Math.max(0, Math.round(v)), y: toY(v) };
  });

  return (
    <View style={s.chartWrap}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <LinearGradient id={GRAD_ID} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={CARDIO_ACCENT} stopOpacity="0.18" />
            <Stop offset="100%" stopColor={CARDIO_ACCENT} stopOpacity="0.01" />
          </LinearGradient>
          <ClipPath id={CLIP_ID}>
            <Rect x={PAD.left} y={PAD.top} width={IW} height={IH} />
          </ClipPath>
        </Defs>

        {/* Grid + y-axis labels */}
        {ticks.map((t, i) => (
          <G key={`g${i}`}>
            <Line
              x1={PAD.left} y1={t.y}
              x2={W - PAD.right} y2={t.y}
              stroke={Colors.border} strokeWidth="0.5"
            />
            <SvgText
              x={PAD.left - 10} y={t.y}
              fontSize="9" fill={Colors.textMuted}
              textAnchor="end" alignmentBaseline="middle"
            >
              {fmtDuration(t.v)}
            </SvgText>
          </G>
        ))}

        {/* Area fill */}
        <Path d={areaPath} fill={`url(#${GRAD_ID})`} />

        {/* Trend dashed line */}
        <Path
          d={trendPath}
          stroke={Colors.accent}
          strokeWidth="1.5"
          strokeDasharray="6,4"
          fill="none"
          opacity="0.9"
          clipPath={`url(#${CLIP_ID})`}
        />

        {/* Main line */}
        <Path
          d={linePath}
          stroke={CARDIO_ACCENT}
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />

        {/* Selected vertical guide */}
        <Line
          x1={toX(safe)} y1={PAD.top}
          x2={toX(safe)} y2={PAD.top + IH}
          stroke={CARDIO_ACCENT} strokeWidth="1"
          strokeDasharray="3,3" opacity="0.4"
        />

        {/* Dots — rendered AFTER lines so they sit on top */}
        {points.map((p, i) => {
          const cx = toX(i);
          const cy = toY(p.totalMinutes);
          const sel = i === safe;
          return (
            <G key={p.key}>
              {sel && <Circle cx={cx} cy={cy} r={12} fill={CARDIO_ACCENT} opacity="0.1" />}
              <Circle
                cx={cx} cy={cy}
                r={sel ? 6 : 4}
                fill={sel ? CARDIO_ACCENT : Colors.surface}
                stroke={CARDIO_ACCENT}
                strokeWidth="2"
              />
            </G>
          );
        })}

        {/* X-axis labels */}
        {points.map((p, i) => {
          const isLast = i === points.length - 1;
          const anchor = i === 0 && !isLast ? 'start' : 'middle';
          return (
            <SvgText
              key={`xl${p.key}`}
              x={toX(i)} y={H - 5}
              fontSize="10"
              fill={i === safe ? CARDIO_ACCENT : Colors.textMuted}
              fontWeight={i === safe ? '700' : '400'}
              textAnchor={anchor}
            >
              {shortLabel(p.label, mode)}
            </SvgText>
          );
        })}
      </Svg>

      {/* Full-height slice hit areas for mobile reliability */}
      <View style={s.chartHitOverlay} pointerEvents="box-none">
        {points.map((p, i) => (
          <TouchableOpacity
            key={`hit-${p.key}`}
            style={s.chartHitZone}
            activeOpacity={1}
            onPress={() => onSelect(i)}
          />
        ))}
      </View>
    </View>
  );
}

// ─── Detail Card ──────────────────────────────────────────────────────────────

type StatItemProps = {
  label: string;
  value: string | number;
  trend: Trend | null;
  prevValue?: string | number;
};

function StatItem({ label, value, trend, prevValue }: StatItemProps) {
  return (
    <View style={dc.statBox}>
      <Text style={dc.statLabel}>{label}</Text>
      <Text style={dc.statValue}>{value}</Text>
      {trend && (
        <Text style={[dc.statTrend, { color: trendColor(trend) }]}>{trend.label}</Text>
      )}
      {prevValue !== undefined && (
        <Text style={dc.statPrev}>↩ {prevValue}</Text>
      )}
    </View>
  );
}

type DetailCardProps = {
  point: CardioHistoryPoint;
  prev: CardioHistoryPoint | null;
};

function DetailCard({ point, prev }: DetailCardProps) {
  const totalTrend = prev ? calcTrend(point.totalMinutes, prev.totalMinutes) : null;
  const sessionTrend = prev ? calcTrend(point.sessions, prev.sessions) : null;

  const avgCur = point.sessions > 0 ? point.totalMinutes / point.sessions : 0;
  const avgPrev = prev && prev.sessions > 0 ? prev.totalMinutes / prev.sessions : undefined;
  const avgTrend =
    prev && prev.sessions > 0 && point.sessions > 0
      ? calcTrend(avgCur, avgPrev!)
      : null;

  return (
    <View style={dc.card}>
      {/* Header */}
      <View style={dc.header}>
        <Text style={dc.title}>{point.title}</Text>
        {point.isCurrent && (
          <View style={dc.badge}>
            <Text style={dc.badgeText}>Hiện tại</Text>
          </View>
        )}
      </View>

      {/* Total duration row — most prominent */}
      <View style={dc.volRow}>
        <View>
          <Text style={dc.volLabel}>Tổng thời gian</Text>
          <Text style={dc.volValue}>{fmtDuration(point.totalMinutes)}</Text>
          {prev && (
            <Text style={dc.volPrev}>Kỳ trước: {fmtDuration(prev.totalMinutes)}</Text>
          )}
        </View>
        {totalTrend && (
          <Text style={[dc.volTrend, { color: trendColor(totalTrend) }]}>{totalTrend.label}</Text>
        )}
      </View>

      {/* Sessions / Avg per session */}
      <View style={dc.statsRow}>
        <StatItem
          label="Buổi tập"
          value={point.sessions}
          trend={sessionTrend}
          prevValue={prev?.sessions}
        />
        <View style={dc.divider} />
        <StatItem
          label="TB / buổi"
          value={fmtDuration(avgCur)}
          trend={avgTrend}
          prevValue={avgPrev !== undefined ? fmtDuration(avgPrev) : undefined}
        />
      </View>
    </View>
  );
}

const dc = StyleSheet.create({
  card: {
    marginTop: 12,
    backgroundColor: Colors.surfaceElevated ?? Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: CARDIO_ACCENT + '22',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: CARDIO_ACCENT,
  },
  volRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  volLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
    marginBottom: 2,
  },
  volValue: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  volPrev: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  volTrend: {
    fontSize: 14,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  divider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    gap: 2,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.3,
  },
  statTrend: {
    fontSize: 10,
    fontWeight: '700',
  },
  statPrev: {
    fontSize: 10,
    color: Colors.textMuted,
  },
});

// ─── Main Component ───────────────────────────────────────────────────────────

type CardioGrowthChartProps = {
  weeklyHistory: CardioHistoryPoint[];
  monthlyHistory: CardioHistoryPoint[];
  selectedWeekKey: string | null;
  selectedMonthKey: string | null;
  setSelectedWeekKey: (key: string) => void;
  setSelectedMonthKey: (key: string) => void;
};

export function CardioGrowthChart({
  weeklyHistory,
  monthlyHistory,
  selectedWeekKey,
  selectedMonthKey,
  setSelectedWeekKey,
  setSelectedMonthKey,
}: CardioGrowthChartProps) {
  const [mode, setMode] = useState<'week' | 'month'>('week');

  const data = mode === 'week' ? weeklyHistory : monthlyHistory;
  const controlledKey = mode === 'week' ? selectedWeekKey : selectedMonthKey;
  const [selIdx, setSelIdx] = useState(data.length - 1);

  useEffect(() => {
    if (!data.length) { setSelIdx(-1); return; }
    const idx = controlledKey ? data.findIndex((p) => p.key === controlledKey) : -1;
    setSelIdx(idx >= 0 ? idx : data.length - 1);
  }, [controlledKey, data]);

  const resolvedIdx = data.length === 0 ? -1 : Math.min(Math.max(selIdx, 0), data.length - 1);
  const selectedPt = resolvedIdx >= 0 ? data[resolvedIdx] : null;
  const prevPt = resolvedIdx > 0 ? data[resolvedIdx - 1] : null;

  function handleSelect(idx: number) {
    setSelIdx(idx);
    const pt = data[idx];
    if (!pt) return;
    if (mode === 'week') setSelectedWeekKey(pt.key);
    else setSelectedMonthKey(pt.key);
  }

  function handleMode(m: 'week' | 'month') {
    setMode(m);
    const d = m === 'week' ? weeklyHistory : monthlyHistory;
    setSelIdx(d.length - 1);
  }

  return (
    <View style={s.container}>
      {/* Tab switcher */}
      <View style={s.tabs}>
        {(['week', 'month'] as const).map((m) => (
          <TouchableOpacity
            key={m}
            style={[s.tab, mode === m && s.tabActive]}
            onPress={() => handleMode(m)}
            activeOpacity={0.7}
          >
            <Text style={[s.tabText, mode === m && s.tabTextActive]}>
              {m === 'week' ? 'Theo tuần' : 'Theo tháng'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Legend */}
      <View style={s.legend}>
        <View style={s.legendItem}>
          <View style={[s.ldot, { backgroundColor: CARDIO_ACCENT }]} />
          <Text style={s.ltext}>Tổng thời gian</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.ldash, { backgroundColor: Colors.accent }]} />
          <Text style={s.ltext}>Xu hướng</Text>
        </View>
        <Text style={s.lhint}>Chạm điểm để xem chi tiết</Text>
      </View>

      {/* Chart */}
      <CardioSvgChart
        points={data}
        selectedIdx={resolvedIdx}
        onSelect={handleSelect}
        mode={mode}
      />

      {/* Detail */}
      {selectedPt && <DetailCard point={selectedPt} prev={prevPt} />}
    </View>
  );
}

// ─── Section wrapper ───────────────────────────────────────────────────────────

export function CardioHistoryTabSection({
  historyLoading,
  weeklyHistory,
  monthlyHistory,
  selectedWeekKey,
  selectedMonthKey,
  setSelectedWeekKey,
  setSelectedMonthKey,
}: {
  historyLoading: boolean;
  weeklyHistory: CardioHistoryPoint[];
  monthlyHistory: CardioHistoryPoint[];
  selectedWeekKey: string | null;
  selectedMonthKey: string | null;
  setSelectedWeekKey: (key: string) => void;
  setSelectedMonthKey: (key: string) => void;
}) {
  if (historyLoading) {
    return (
      <View style={s.emptyCard}>
        <Text style={s.emptyText}>Đang tải lịch sử...</Text>
      </View>
    );
  }

  if (!weeklyHistory.length && !monthlyHistory.length) {
    return (
      <View style={s.emptyCard}>
        <Text style={s.emptyText}>Chưa có dữ liệu cardio</Text>
      </View>
    );
  }

  return (
    <View style={s.sectionWrap}>
      <CardioGrowthChart
        weeklyHistory={weeklyHistory}
        monthlyHistory={monthlyHistory}
        selectedWeekKey={selectedWeekKey}
        selectedMonthKey={selectedMonthKey}
        setSelectedWeekKey={setSelectedWeekKey}
        setSelectedMonthKey={setSelectedMonthKey}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  sectionWrap: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  emptyCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  tabActive: {
    borderColor: CARDIO_ACCENT,
    backgroundColor: CARDIO_ACCENT + '18',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: CARDIO_ACCENT,
    fontWeight: '700',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ldot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ldash: {
    width: 14,
    height: 2,
    borderRadius: 1,
  },
  ltext: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  lhint: {
    marginLeft: 'auto',
    fontSize: 10,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  chartWrap: {
    position: 'relative',
  },
  chartHitOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  chartHitZone: {
    flex: 1,
  },
});