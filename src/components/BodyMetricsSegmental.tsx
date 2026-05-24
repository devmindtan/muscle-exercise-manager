import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, {
  Path, Rect, Ellipse, Text as SvgText, G, Line, Circle,
} from 'react-native-svg';
import { Colors } from '@/src/constants/colors';
import type { BodyMeasurement } from '@/src/types/database';

// ─── Types ────────────────────────────────────────────────────────────────────

type SegMode = 'lean' | 'fat';
type BodyZone = 'arm_l' | 'arm_r' | 'torso' | 'leg_l' | 'leg_r';

interface ZoneData {
  label: string;
  val: number | null;
  prev: number | null;
  unit: string;
}

interface SegmentalBodyProps {
  historyByMetric: Map<string, BodyMeasurement[]>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LEAN_ZONE_KEYS: Record<BodyZone, string> = {
  arm_l: 'segmental_lean_upper_left',
  arm_r: 'segmental_lean_upper_right',
  torso: 'segmental_lean_center',
  leg_l: 'segmental_lean_lower_left',
  leg_r: 'segmental_lean_lower_right',
};

const FAT_ZONE_KEYS: Record<BodyZone, string> = {
  arm_l: 'segmental_fat_upper_left',
  arm_r: 'segmental_fat_upper_right',
  torso: 'segmental_fat_center',
  leg_l: 'segmental_fat_lower_left',
  leg_r: 'segmental_fat_lower_right',
};

const ZONE_LABELS: Record<BodyZone, string> = {
  arm_l: 'Tay trái',
  arm_r: 'Tay phải',
  torso: 'Thân',
  leg_l: 'Chân trái',
  leg_r: 'Chân phải',
};

// Short label for inside SVG callouts
const ZONE_SHORT_LABELS: Record<BodyZone, string> = {
  arm_l: 'Trái',
  arm_r: 'Phải',
  torso: 'Thân',
  leg_l: 'Trái',
  leg_r: 'Phải',
};

function getZoneData(
  zone: BodyZone,
  mode: SegMode,
  historyByMetric: Map<string, BodyMeasurement[]>,
): ZoneData {
  const key = mode === 'lean' ? LEAN_ZONE_KEYS[zone] : FAT_ZONE_KEYS[zone];
  const history = historyByMetric.get(key) ?? [];
  const val = history[0]?.value ?? null;
  const prev = history[1]?.value ?? null;
  return { label: ZONE_LABELS[zone], val, prev, unit: 'kg' };
}

type Tone = 'good' | 'warn' | 'neutral';

function getTone(delta: number | null, mode: SegMode): Tone {
  if (delta == null) return 'neutral';
  if (mode === 'lean') return delta > 0 ? 'good' : delta < -0.05 ? 'warn' : 'neutral';
  return delta < 0 ? 'good' : delta > 0.05 ? 'warn' : 'neutral';
}

function getToneVisual(tone: Tone, mode: SegMode) {
  if (mode === 'fat') {
    if (tone === 'good') {
      return {
        fill: `${Colors.success}2A`,
        stroke: Colors.success,
        text: Colors.success,
        badgeBg: `${Colors.success}1F`,
        solidFill: Colors.success,
      };
    }
    if (tone === 'warn') {
      return {
        fill: `${Colors.error}2A`,
        stroke: Colors.error,
        text: Colors.error,
        badgeBg: `${Colors.error}1F`,
        solidFill: Colors.error,
      };
    }
    return {
      fill: `${Colors.warning}24`,
      stroke: Colors.warning,
      text: Colors.warning,
      badgeBg: `${Colors.warning}1A`,
      solidFill: Colors.warning,
    };
  }

  if (tone === 'good') {
    return {
      fill: `${Colors.success}2A`,
      stroke: Colors.success,
      text: Colors.success,
      badgeBg: `${Colors.success}1F`,
      solidFill: Colors.success,
    };
  }
  if (tone === 'warn') {
    return {
      fill: `${Colors.warning}2A`,
      stroke: Colors.warning,
      text: Colors.warning,
      badgeBg: `${Colors.warning}1F`,
      solidFill: Colors.warning,
    };
  }
  return {
    fill: `${Colors.accent}26`,
    stroke: Colors.accent,
    text: Colors.accent,
    badgeBg: `${Colors.accent}1A`,
    solidFill: Colors.accent,
  };
}

function fmt(v: number | null): string {
  if (v == null) return '—';
  return Number(v).toFixed(1);
}

function fmtDelta(delta: number | null): string {
  if (delta == null) return '—';
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta.toFixed(2)}`;
}

function getDeltaArrow(delta: number | null, mode: SegMode): string {
  if (delta == null) return '';
  const isPositive = delta > 0.005;
  const isNegative = delta < -0.005;
  if (!isPositive && !isNegative) return '';
  if (mode === 'lean') return isPositive ? '↑' : '↓';
  return isNegative ? '↓' : '↑';
}

// ─── Body Figure SVG ──────────────────────────────────────────────────────────
// Layout: SVG is 200×320. Labels are rendered OUTSIDE the SVG in a React Native
// overlay approach — but since we're in SVG context we position them carefully
// to NOT overlap the body silhouette.
//
// Left column labels: x=0..52 (left of left arm)
// Right column labels: x=148..200 (right of right arm)
// Torso label: below the figure at y>290
//
// Connector lines go from label → zone anchor point on the body edge.

const LABEL_W = 44;
const LABEL_H = 38;

// Where labels are anchored (center of label box)
const LABEL_CENTERS: Record<BodyZone, { x: number; y: number }> = {
  arm_l:  { x: 6,  y: 95  },  // left column, arm height
  torso:  { x: 100, y: 106 },  // bottom-center, below legs
  arm_r:  { x: 194, y: 95  },  // right column
  leg_l:  { x: 26,  y: 230 },  // left column, leg height
  leg_r:  { x: 174, y: 230 },  // right column
};

// Where connector lines point TO on the body silhouette
const BODY_ANCHORS: Record<BodyZone, { x: number; y: number }> = {
  arm_l:  { x: 46,  y: 95  },
  torso:  { x: 100, y: 106 },
  arm_r:  { x: 154, y: 95  },
  leg_l:  { x: 70,  y: 220 },
  leg_r:  { x: 130, y: 220 },
};

function BodyFigureSvg({
  zoneData,
  mode,
  selected,
  onZonePress,
}: {
  zoneData: Record<BodyZone, ZoneData>;
  mode: SegMode;
  selected: BodyZone | null;
  onZonePress: (z: BodyZone) => void;
}) {
  const zones: BodyZone[] = ['arm_l', 'arm_r', 'torso', 'leg_l', 'leg_r'];

  function getVisuals(zone: BodyZone) {
    const d = zoneData[zone];
    const delta = d.val != null && d.prev != null ? d.val - d.prev : null;
    const tone = getTone(delta, mode);
    const v = getToneVisual(tone, mode);
    // When something is selected, dim everything else
    const isSelected = selected === zone;
    const isDimmed = selected !== null && !isSelected;
    const bodyOpacity = isDimmed ? 0.15 : 1;
    const labelOpacity = isDimmed ? 0.2 : 1;
    return { ...v, delta, tone, bodyOpacity, labelOpacity, isSelected };
  }

  const renderZoneLabel = (zone: BodyZone) => {
    const vis = getVisuals(zone);
    const center = LABEL_CENTERS[zone];
    const anchor = BODY_ANCHORS[zone];
    const lx = center.x - LABEL_W / 2;
    const ly = center.y - LABEL_H / 2;
    const shortLabel = ZONE_SHORT_LABELS[zone];

    // Connector line: from body anchor to label edge
    // Pick the label edge closest to body anchor
    let lineToX = center.x;
    let lineToY = center.y;
    if (zone === 'arm_l' || zone === 'leg_l') lineToX = lx + LABEL_W; // right edge of label
    else if (zone === 'arm_r' || zone === 'leg_r') lineToX = lx;      // left edge
    else lineToY = ly; // top edge for torso label

    return (
      <G key={`lbl-${zone}`} opacity={vis.labelOpacity}>
        {/* Connector line */}
        <Line
          x1={lineToX}
          y1={zone === 'torso' ? lineToY : center.y}
          x2={anchor.x}
          y2={anchor.y}
          stroke={vis.stroke}
          strokeWidth={0.8}
          strokeDasharray="3 2"
          opacity={0.7}
        />

        {/* Dot at body anchor */}
        <Circle
          cx={anchor.x}
          cy={anchor.y}
          r={2.5}
          fill={vis.solidFill}
          opacity={0.9}
        />
        {/* Label box */}
        <Rect
          x={lx}
          y={ly}
          width={LABEL_W}
          height={LABEL_H}
          rx={7}
          fill={Colors.surfaceElevated}
          stroke={vis.isSelected ? vis.stroke : vis.stroke}
          strokeWidth={vis.isSelected ? 1.5 : 0.8}
          opacity={0.95}
          onPress={() => onZonePress(zone)}
        />
        {/* Short zone label */}
        <SvgText
          x={center.x}
          y={ly + 11}
          textAnchor="middle"
          fontSize={7.5}
          fill={vis.text}
          opacity={0.75}
        >
          {shortLabel}
        </SvgText>
        {/* Value */}
        <SvgText
          x={center.x}
          y={ly + 22}
          textAnchor="middle"
          fontSize={11}
          fontWeight="700"
          fill={vis.text}
        >
          {zoneData[zone].val != null ? `${Number(zoneData[zone].val).toFixed(1)}` : '—'}
        </SvgText>
        {/* Delta */}
        <SvgText
          x={center.x}
          y={ly + 32}
          textAnchor="middle"
          fontSize={7}
          fill={vis.text}
          opacity={0.85}
        >
          {fmtDelta(vis.delta)}
        </SvgText>
      </G>
    );
  };

  const renderBodyZone = (zone: BodyZone) => {
    const vis = getVisuals(zone);
    const hitProps = {
      onPress: () => onZonePress(zone),
    };

    if (zone === 'arm_l') {
      return (
        <G key="arm_l" opacity={vis.bodyOpacity}>
          <Path
            d="M50,68 Q38,78 34,126 Q33,136 38,138 Q46,140 52,138 Q58,136 60,126 L62,68Z"
            fill={vis.fill} stroke={vis.stroke} strokeWidth={vis.isSelected ? 1.5 : 0.8}
            {...hitProps}
          />
          {/* Invisible wider hit area */}
          <Path
            d="M50,68 Q38,78 34,126 Q33,136 38,138 Q46,140 52,138 Q58,136 60,126 L62,68Z"
            fill="transparent" stroke="transparent" strokeWidth={14}
            {...hitProps}
          />
        </G>
      );
    }
    if (zone === 'arm_r') {
      return (
        <G key="arm_r" opacity={vis.bodyOpacity}>
          <Path
            d="M150,68 Q162,78 166,126 Q167,136 162,138 Q154,140 148,138 Q142,136 140,126 L138,68Z"            fill={vis.fill} stroke={vis.stroke} strokeWidth={vis.isSelected ? 1.5 : 0.8}
            {...hitProps}
          />
          <Path
            d="M150,68 Q162,78 166,126 Q167,136 162,138 Q154,140 148,138 Q142,136 140,126 L138,68Z"
            fill="transparent" stroke="transparent" strokeWidth={14}
            {...hitProps}
          />
        </G>
      );
    }
    if (zone === 'torso') {
      return (
        <G key="torso" opacity={vis.bodyOpacity}>
          <Rect
            x={62} y={60} width={76} height={92} rx={7}
            fill={vis.fill} stroke={vis.stroke} strokeWidth={vis.isSelected ? 1.5 : 0.8}
            {...hitProps}
          />
          <Rect x={58} y={56} width={84} height={100} rx={8}
            fill="transparent" {...hitProps} />
        </G>
      );
    }
    if (zone === 'leg_l') {
      return (
        <G key="leg_l" opacity={vis.bodyOpacity}>
          <Path
            d="M66,162 Q62,180 60,242 Q58,258 62,272 Q66,282 74,282 Q82,282 84,272 Q88,258 88,242 L92,162Z"
            fill={vis.fill} stroke={vis.stroke} strokeWidth={vis.isSelected ? 1.5 : 0.8}
            {...hitProps}
          />
          <Path
            d="M66,162 Q62,180 60,242 Q58,258 62,272 Q66,282 74,282 Q82,282 84,272 Q88,258 88,242 L92,162Z"
            fill="transparent" stroke="transparent" strokeWidth={14}
            {...hitProps}
          />
        </G>
      );
    }
    if (zone === 'leg_r') {
      return (
        <G key="leg_r" opacity={vis.bodyOpacity}>
          <Path
            d="M134,162 Q138,180 140,242 Q142,258 138,272 Q134,282 126,282 Q118,282 116,272 Q112,258 112,242 L108,162Z"
            fill={vis.fill} stroke={vis.stroke} strokeWidth={vis.isSelected ? 1.5 : 0.8}
            {...hitProps}
          />
          <Path
            d="M134,162 Q138,180 140,242 Q142,258 138,272 Q134,282 126,282 Q118,282 116,272 Q112,258 112,242 L108,162Z"
            fill="transparent" stroke="transparent" strokeWidth={14}
            {...hitProps}
          />
        </G>
      );
    }
    return null;
  };

  return (
    <Svg viewBox="0 0 200 320" width={240} height={320}>
      {/* Body zones (rendered before head so head is on top) */}
      {zones.map(renderBodyZone)}

      {/* Head — on top of everything */}
      <Ellipse cx={100} cy={28} rx={20} ry={23}
        fill={Colors.surfaceElevated} stroke={Colors.textSecondary} strokeWidth={1} />

      {/* Labels — always on top */}
      {zones.map(renderZoneLabel)}
    </Svg>
  );
}

// ─── Selected Zone Detail Card ────────────────────────────────────────────────

function SelectedZoneCard({
  zone,
  data,
  mode,
  onDismiss,
}: {
  zone: BodyZone;
  data: ZoneData;
  mode: SegMode;
  onDismiss: () => void;
}) {
  const delta = data.val != null && data.prev != null ? data.val - data.prev : null;
  const tone = getTone(delta, mode);
  const vis = getToneVisual(tone, mode);
  const arrow = getDeltaArrow(delta, mode);

  return (
    <View style={[detailStyles.card, { borderColor: vis.stroke }]}>
      <View style={detailStyles.header}>
        <View style={[detailStyles.titleRow]}>
          <View style={[detailStyles.dot, { backgroundColor: vis.solidFill }]} />
          <Text style={detailStyles.zoneName}>{data.label}</Text>
          <View style={[detailStyles.modeBadge, { backgroundColor: vis.badgeBg }]}>
            <Text style={[detailStyles.modeBadgeText, { color: vis.text }]}>
              {mode === 'lean' ? 'Cơ' : 'Mỡ'}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={detailStyles.dismiss}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={detailStyles.values}>
        <View style={detailStyles.valueBlock}>
          <Text style={detailStyles.valueLabel}>Hiện tại</Text>
          <Text style={[detailStyles.valueBig, { color: vis.text }]}>
            {fmt(data.val)} <Text style={detailStyles.unit}>kg</Text>
          </Text>
        </View>
        <View style={detailStyles.divider} />
        <View style={detailStyles.valueBlock}>
          <Text style={detailStyles.valueLabel}>Trước đó</Text>
          <Text style={detailStyles.valuePrev}>{fmt(data.prev)} kg</Text>
        </View>
        <View style={detailStyles.divider} />
        <View style={detailStyles.valueBlock}>
          <Text style={detailStyles.valueLabel}>Thay đổi</Text>
          <Text style={[detailStyles.valueDelta, { color: vis.text }]}>
            {arrow} {fmtDelta(delta)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 99 },
  zoneName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  modeBadge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  modeBadgeText: { fontSize: 11, fontWeight: '600' },
  dismiss: { fontSize: 14, color: Colors.textMuted, paddingLeft: 4 },
  values: { flexDirection: 'row', alignItems: 'center' },
  valueBlock: { flex: 1, alignItems: 'center' },
  valueLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 4 },
  valueBig: { fontSize: 20, fontWeight: '700' },
  valuePrev: { fontSize: 15, fontWeight: '500', color: Colors.textSecondary },
  valueDelta: { fontSize: 15, fontWeight: '700' },
  unit: { fontSize: 12, fontWeight: '400' },
  divider: { width: 1, height: 36, backgroundColor: Colors.border },
});

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend({ mode }: { mode: SegMode }) {
  const items =
    mode === 'lean'
      ? [
          { ...getToneVisual('good', 'lean'), label: 'Tăng (tốt)' },
          { ...getToneVisual('neutral', 'lean'), label: 'Ổn định' },
          { ...getToneVisual('warn', 'lean'), label: 'Giảm (chú ý)' },
        ]
      : [
          { ...getToneVisual('good', 'fat'), label: 'Giảm (tốt)' },
          { ...getToneVisual('neutral', 'fat'), label: 'Ổn định' },
          { ...getToneVisual('warn', 'fat'), label: 'Tăng (chú ý)' },
        ];

  return (
    <View style={legendStyles.row}>
      {items.map((item) => (
        <View key={item.label} style={legendStyles.item}>
          <View style={[legendStyles.dot, { backgroundColor: item.fill, borderColor: item.stroke }]} />
          <Text style={legendStyles.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const legendStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: 12, marginTop: 4, flexWrap: 'wrap' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 9, height: 9, borderRadius: 99, borderWidth: 1 },
  label: { fontSize: 11, color: Colors.textMuted },
});

// ─── Metric List Row ──────────────────────────────────────────────────────────

function MetricListRow({
  data,
  mode,
  selected,
  onPress,
}: {
  data: ZoneData;
  mode: SegMode;
  selected: boolean;
  onPress: () => void;
}) {
  const delta = data.val != null && data.prev != null ? data.val - data.prev : null;
  const tone = getTone(delta, mode);
  const visual = getToneVisual(tone, mode);
  const arrow = getDeltaArrow(delta, mode);

  return (
    <TouchableOpacity
      style={[
        listStyles.row,
        selected && { borderColor: visual.stroke, borderWidth: 1.5, backgroundColor: Colors.surfaceElevated },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={listStyles.left}>
        <View style={[listStyles.dot, { backgroundColor: visual.fill, borderColor: visual.stroke }]} />
        <Text style={[listStyles.name, selected && { color: visual.text }]}>{data.label}</Text>
      </View>
      <View style={listStyles.right}>
        {data.val != null ? (
          <Text style={listStyles.val}>{fmt(data.val)} {data.unit}</Text>
        ) : (
          <Text style={[listStyles.val, { color: Colors.textMuted }]}>— kg</Text>
        )}
        <View style={[listStyles.badge, { backgroundColor: visual.badgeBg }]}>
          <Text style={[listStyles.badgeText, { color: visual.text }]}>
            {arrow}{arrow ? ' ' : ''}{fmtDelta(delta)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const listStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 6,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 99, borderWidth: 1 },
  name: { fontSize: 13, fontWeight: '500', color: Colors.text },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  val: { fontSize: 14, fontWeight: '600', color: Colors.text },
  badge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3, minWidth: 52, alignItems: 'center' },
  badgeText: { fontSize: 11, fontWeight: '700' },
});

// ─── Summary Bar ──────────────────────────────────────────────────────────────

function SummaryBar({
  zoneData,
  mode,
}: {
  zoneData: Record<BodyZone, ZoneData>;
  mode: SegMode;
}) {
  const zones: BodyZone[] = ['arm_l', 'arm_r', 'torso', 'leg_l', 'leg_r'];
  const total = zones.reduce((sum, z) => {
    const v = zoneData[z].val;
    return v != null ? sum + v : sum;
  }, 0);
  const hasData = zones.some((z) => zoneData[z].val != null);

  if (!hasData) return null;

  return (
    <View style={summaryStyles.bar}>
      <View style={summaryStyles.block}>
        <Text style={summaryStyles.label}>{mode === 'lean' ? 'Tổng Cơ' : 'Tổng Mỡ'}</Text>
        <Text style={summaryStyles.value}>{total.toFixed(1)} kg</Text>
      </View>
      <View style={summaryStyles.sep} />
      <View style={summaryStyles.block}>
        <Text style={summaryStyles.label}>Vùng có data</Text>
        <Text style={summaryStyles.value}>
          {zones.filter((z) => zoneData[z].val != null).length}/5
        </Text>
      </View>
      <View style={summaryStyles.sep} />
      <View style={summaryStyles.block}>
        <Text style={summaryStyles.label}>Đơn vị</Text>
        <Text style={summaryStyles.value}>kg</Text>
      </View>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginBottom: 10,
  },
  block: { flex: 1, alignItems: 'center' },
  label: { fontSize: 10, color: Colors.textMuted, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 15, fontWeight: '700', color: Colors.text },
  sep: { width: 1, backgroundColor: Colors.border, marginHorizontal: 4 },
});

// ─── Main exported component ──────────────────────────────────────────────────

export function SegmentalBody({ historyByMetric }: SegmentalBodyProps) {
  const [mode, setMode] = useState<SegMode>('lean');
  const [selected, setSelected] = useState<BodyZone | null>(null);

  const zones: BodyZone[] = ['arm_l', 'arm_r', 'torso', 'leg_l', 'leg_r'];

  const zoneData: Record<BodyZone, ZoneData> = {
    arm_l: getZoneData('arm_l', mode, historyByMetric),
    arm_r: getZoneData('arm_r', mode, historyByMetric),
    torso: getZoneData('torso', mode, historyByMetric),
    leg_l: getZoneData('leg_l', mode, historyByMetric),
    leg_r: getZoneData('leg_r', mode, historyByMetric),
  };

  const handleZonePress = (zone: BodyZone) => {
    setSelected((prev) => (prev === zone ? null : zone));
  };

  const handleModeSwitch = (newMode: SegMode) => {
    setMode(newMode);
    setSelected(null);
  };

  return (
    <View style={s.container}>
      {/* Mode toggle */}
      <View style={s.toggle}>
        <TouchableOpacity
          style={[s.toggleBtn, mode === 'lean' && s.toggleBtnActive]}
          onPress={() => handleModeSwitch('lean')}
          activeOpacity={0.75}
        >
          <Text style={[s.toggleText, mode === 'lean' && s.toggleTextActive]}>Lean (Cơ)</Text>
          <Text style={[s.toggleHint, mode === 'lean' && s.toggleHintActive]}>nên tăng</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.toggleBtn, mode === 'fat' && s.toggleBtnActiveFat]}
          onPress={() => handleModeSwitch('fat')}
          activeOpacity={0.75}
        >
          <Text style={[s.toggleText, mode === 'fat' && s.toggleTextActiveFat]}>Fat (Mỡ)</Text>
          <Text style={[s.toggleHint, mode === 'fat' && s.toggleHintActiveFat]}>nên giảm</Text>
        </TouchableOpacity>
      </View>

      {/* Summary stats */}
      <SummaryBar zoneData={zoneData} mode={mode} />

      {/* Selected zone detail — shown above figure when something is selected */}
      {selected && (
        <SelectedZoneCard
          zone={selected}
          data={zoneData[selected]}
          mode={mode}
          onDismiss={() => setSelected(null)}
        />
      )}

      {/* Body figure */}
      <View style={s.figureCard}>
        {!selected && (
          <Text style={s.tapHint}>Nhấn vào vùng cơ thể để xem chi tiết</Text>
        )}
        <View style={s.figureWrap}>
          <BodyFigureSvg
            zoneData={zoneData}
            mode={mode}
            selected={selected}
            onZonePress={handleZonePress}
          />

          {/* Absolute touch overlay to guarantee tapping works on Android SVG */}
          <TouchableOpacity style={[s.zoneTouch, s.zoneArmLeft]} onPress={() => handleZonePress('arm_l')} activeOpacity={1} />
          <TouchableOpacity style={[s.zoneTouch, s.zoneArmRight]} onPress={() => handleZonePress('arm_r')} activeOpacity={1} />
          <TouchableOpacity style={[s.zoneTouch, s.zoneTorso]} onPress={() => handleZonePress('torso')} activeOpacity={1} />
          <TouchableOpacity style={[s.zoneTouch, s.zoneLegLeft]} onPress={() => handleZonePress('leg_l')} activeOpacity={1} />
          <TouchableOpacity style={[s.zoneTouch, s.zoneLegRight]} onPress={() => handleZonePress('leg_r')} activeOpacity={1} />
        </View>
      </View>

      <Legend mode={mode} />

      {/* Zone list */}
      <View style={s.listHeader}>
        <Text style={s.listTitle}>{mode === 'lean' ? 'Lean — 5 vùng' : 'Fat — 5 vùng'}</Text>
        {selected && (
          <TouchableOpacity onPress={() => setSelected(null)}>
            <Text style={s.clearBtn}>Bỏ chọn</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={s.listWrap}>
        {zones.map((zone) => (
          <MetricListRow
            key={zone}
            data={zoneData[zone]}
            mode={mode}
            selected={selected === zone}
            onPress={() => handleZonePress(zone)}
          />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    gap: 6,
  },
  toggle: {
    flexDirection: 'row', marginBottom: 6, gap: 8,
  },
  toggleBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  toggleBtnActive: { backgroundColor: `${Colors.accent}18`, borderColor: Colors.accent },
  toggleBtnActiveFat: { backgroundColor: `${Colors.warning}18`, borderColor: Colors.warning },
  toggleText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  toggleTextActive: { color: Colors.accent },
  toggleTextActiveFat: { color: Colors.warning },
  toggleHint: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  toggleHintActive: { color: Colors.accent },
  toggleHintActiveFat: { color: Colors.warning },
  figureCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  tapHint: {
    textAlign: 'center',
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  figureWrap: { alignItems: 'center' },
  zoneTouch: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.01)',
  },
  zoneArmLeft: {
    left: 30,
    top: 66,
    width: 38,
    height: 86,
  },
  zoneArmRight: {
    left: 172,
    top: 66,
    width: 38,
    height: 86,
  },
  zoneTorso: {
    left: 76,
    top: 62,
    width: 92,
    height: 106,
  },
  zoneLegLeft: {
    left: 68,
    top: 156,
    width: 44,
    height: 128,
  },
  zoneLegRight: {
    left: 128,
    top: 156,
    width: 44,
    height: 128,
  },
  listHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 8, marginTop: 4,
  },
  listTitle: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.7,
  },
  clearBtn: { fontSize: 12, color: Colors.accent, fontWeight: '600' },
  listWrap: { paddingBottom: 4 },
});