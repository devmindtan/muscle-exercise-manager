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
  Text as SvgText,
} from 'react-native-svg';
import { Colors } from '@/src/constants/colors';

// ─── Types ────────────────────────────────────────────────────────────────────

export type HistoryPoint = {
  key: string;
  label: string;
  title: string;
  sets: number;
  reps: number;
  volume: number;
  isCurrent: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtVol(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(1)} t`;
  return `${Math.round(v).toLocaleString('vi-VN')} kg`;
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

// ─── SVG Chart ────────────────────────────────────────────────────────────────

const W = 340;
const H = 170;
const PAD = { top: 14, right: 28, bottom: 26, left: 46 };
const IW = W - PAD.left - PAD.right;
const IH = H - PAD.top - PAD.bottom;
const GRAD_ID = 'histGrad';

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
  points: HistoryPoint[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
  mode: 'week' | 'month';
};

function SvgAreaChart({ points, selectedIdx, onSelect, mode }: SvgChartProps) {
  if (points.length === 0) return null;

  const vols = points.map((p) => p.volume);
  const trend = linearRegression(vols);

  const minRaw = Math.min(...vols, 0);
  const maxRaw = Math.max(...vols, 1);
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

  const linePath = smoothPath(vols);
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
            <Stop offset="0%" stopColor={Colors.accent} stopOpacity="0.18" />
            <Stop offset="100%" stopColor={Colors.accent} stopOpacity="0.01" />
          </LinearGradient>
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
              x={PAD.left - 5} y={t.y}
              fontSize="9" fill={Colors.textMuted}
              textAnchor="end" alignmentBaseline="middle"
            >
              {fmtVol(t.v)}
            </SvgText>
          </G>
        ))}

        {/* Area fill */}
        <Path d={areaPath} fill={`url(#${GRAD_ID})`} />

        {/* Trend dashed line */}
        <Path
          d={trendPath}
          stroke={Colors.warning ?? '#F59E0B'}
          strokeWidth="1.5"
          strokeDasharray="6,4"
          fill="none"
          opacity="0.9"
        />

        {/* Main line */}
        <Path
          d={linePath}
          stroke={Colors.accent}
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />

        {/* Selected vertical guide */}
        <Line
          x1={toX(safe)} y1={PAD.top}
          x2={toX(safe)} y2={PAD.top + IH}
          stroke={Colors.accent} strokeWidth="1"
          strokeDasharray="3,3" opacity="0.4"
        />

        {/* Dots — rendered AFTER lines so they sit on top */}
        {points.map((p, i) => {
          const cx = toX(i);
          const cy = toY(p.volume);
          const sel = i === safe;
          return (
            <G key={p.key}>
              {sel && <Circle cx={cx} cy={cy} r={12} fill={Colors.accent} opacity="0.1" />}
              <Circle
                cx={cx} cy={cy}
                r={sel ? 6 : 4}
                fill={sel ? Colors.accent : Colors.surface}
                stroke={Colors.accent}
                strokeWidth="2"
              />
            </G>
          );
        })}

        {/* X-axis labels */}
        {points.map((p, i) => {
          const isLast = i === points.length - 1;
          const anchor = isLast ? 'middle' : i === 0 ? 'start' : 'middle'; // ← 'end' thành 'middle'
          const xPos = isLast ? toX(i) : toX(i); // ← bỏ min clamp, dùng thẳng toX(i)
          return (
            <SvgText
              key={`xl${p.key}`}
              x={xPos} y={H - 5}
              fontSize="10"
              fill={i === safe ? Colors.accent : Colors.textMuted}
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
  point: HistoryPoint;
  prev: HistoryPoint | null;
};

function DetailCard({ point, prev }: DetailCardProps) {
  const vt = prev ? calcTrend(point.volume, prev.volume) : null;
  const st = prev ? calcTrend(point.sets, prev.sets) : null;
  const rt = prev ? calcTrend(point.reps, prev.reps) : null;

  const rps = point.sets > 0 ? (point.reps / point.sets).toFixed(1) : '—';
  const prevRps =
    prev && prev.sets > 0 ? (prev.reps / prev.sets).toFixed(1) : undefined;
  const rpst =
    prev && prev.sets > 0 && point.sets > 0
      ? calcTrend(parseFloat(rps), parseFloat(prevRps!))
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

      {/* Volume row — most prominent */}
      <View style={dc.volRow}>
        <View>
          <Text style={dc.volLabel}>Khối lượng</Text>
          <Text style={dc.volValue}>{fmtVol(point.volume)}</Text>
          {prev && (
            <Text style={dc.volPrev}>Kỳ trước: {fmtVol(prev.volume)}</Text>
          )}
        </View>
        {vt && (
          <Text style={[dc.volTrend, { color: trendColor(vt) }]}>{vt.label}</Text>
        )}
      </View>

      {/* Sets / Reps / Reps-per-set — each shows value + trend + prev */}
      <View style={dc.statsRow}>
        <StatItem
          label="Sets"
          value={point.sets}
          trend={st}
          prevValue={prev?.sets}
        />
        <View style={dc.divider} />
        <StatItem
          label="Reps"
          value={point.reps}
          trend={rt}
          prevValue={prev?.reps}
        />
        <View style={dc.divider} />
        <StatItem
          label="Reps/set"
          value={rps}
          trend={rpst}
          prevValue={prevRps}
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
    backgroundColor: Colors.accent + '22',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.accent,
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

type GrowthChartProps = {
  weeklyHistory: HistoryPoint[];
  monthlyHistory: HistoryPoint[];
  selectedWeekKey: string | null;
  selectedMonthKey: string | null;
  setSelectedWeekKey: (key: string) => void;
  setSelectedMonthKey: (key: string) => void;
};

export function GrowthChart({
  weeklyHistory,
  monthlyHistory,
  selectedWeekKey,
  selectedMonthKey,
  setSelectedWeekKey,
  setSelectedMonthKey,
}: GrowthChartProps) {
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
          <View style={[s.ldot, { backgroundColor: Colors.accent }]} />
          <Text style={s.ltext}>Khối lượng</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.ldash, { backgroundColor: Colors.warning ?? '#F59E0B' }]} />
          <Text style={s.ltext}>Xu hướng</Text>
        </View>
        <Text style={s.lhint}>Chạm điểm để xem chi tiết</Text>
      </View>

      {/* Chart */}
      <SvgAreaChart
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

// ─── Section wrapper (replaces HistoryTabSection) ─────────────────────────────

export function HistoryTabSection({
  historyLoading,
  weeklyHistory,
  monthlyHistory,
  selectedWeekKey,
  selectedMonthKey,
  setSelectedWeekKey,
  setSelectedMonthKey,
}: {
  historyLoading: boolean;
  weeklyHistory: HistoryPoint[];
  monthlyHistory: HistoryPoint[];
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
        <Text style={s.emptyText}>Chưa có dữ liệu lịch sử</Text>
      </View>
    );
  }

  return (
    <View style={s.sectionWrap}>
      <GrowthChart
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
    borderColor: Colors.accent,
    backgroundColor: Colors.accent + '18',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.accent,
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