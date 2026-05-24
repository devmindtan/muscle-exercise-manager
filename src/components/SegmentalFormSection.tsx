/**
 * SegmentalFormSection — thay thế phần "3. Segmental Lean" và "4. Segmental Fat"
 * trong InBody modal. Hiển thị hình người mini với input tương tác.
 *
 * Props: giống FormField cũ — form state + onChange
 */

import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Rect, Ellipse, G, Text as SvgText } from 'react-native-svg';
import { Colors } from '@/src/constants/colors';
import type { InBodyFormState } from '@/src/screen/BodyMetricsScreen';

type SegZone = 'upper_left' | 'upper_right' | 'center' | 'lower_left' | 'lower_right';

const LEAN_KEYS: Record<SegZone, keyof InBodyFormState> = {
  upper_left: 'segmental_lean_upper_left',
  upper_right: 'segmental_lean_upper_right',
  center: 'segmental_lean_center',
  lower_left: 'segmental_lean_lower_left',
  lower_right: 'segmental_lean_lower_right',
};

const FAT_KEYS: Record<SegZone, keyof InBodyFormState> = {
  upper_left: 'segmental_fat_upper_left',
  upper_right: 'segmental_fat_upper_right',
  center: 'segmental_fat_center',
  lower_left: 'segmental_fat_lower_left',
  lower_right: 'segmental_fat_lower_right',
};

const ZONE_LABELS: Record<SegZone, string> = {
  upper_left: 'Tay trái',
  upper_right: 'Tay phải',
  center: 'Thân (giữa)',
  lower_left: 'Chân trái',
  lower_right: 'Chân phải',
};

type FormMode = 'lean' | 'fat';

interface Props {
  form: InBodyFormState;
  onChange: (key: keyof InBodyFormState, value: string) => void;
}

// Mini body SVG for the input section (smaller 160×240)
function MiniBodySvg({
  form,
  mode,
  selected,
  onZonePress,
}: {
  form: InBodyFormState;
  mode: FormMode;
  selected: SegZone | null;
  onZonePress: (z: SegZone) => void;
}) {
  const keys = mode === 'lean' ? LEAN_KEYS : FAT_KEYS;

  function zoneHasValue(zone: SegZone) {
    const v = form[keys[zone]];
    return typeof v === 'string' && v.trim().length > 0;
  }

  function zoneFill(zone: SegZone) {
    const isSelected = selected === zone;
    const hasFill = zoneHasValue(zone);
    if (isSelected) return Colors.accent;
    if (hasFill) return '#9FE1CB';
    return Colors.border;
  }

  function zoneStroke(zone: SegZone) {
    if (selected === zone) return Colors.accent;
    if (zoneHasValue(zone)) return '#0F6E56';
    return Colors.textMuted;
  }

  const zones: SegZone[] = ['upper_left', 'upper_right', 'center', 'lower_left', 'lower_right'];

  return (
    <Svg viewBox="0 0 160 240" width={160} height={240}>
      {/* Head */}
      <Ellipse cx={80} cy={22} rx={16} ry={18} fill={Colors.surface} stroke={Colors.border} strokeWidth={0.8} />

      {/* Left arm */}
      <Path
        d="M42,52 Q34,58 30,95 Q29,104 33,106 Q41,107 46,105 Q51,103 52,95 L54,52Z"
        fill={zoneFill('upper_left')} stroke={zoneStroke('upper_left')} strokeWidth={0.8}
        onPress={() => onZonePress('upper_left')}
      />

      {/* Right arm */}
      <Path
        d="M118,52 Q126,58 130,95 Q131,104 127,106 Q119,107 114,105 Q109,103 108,95 L106,52Z"
        fill={zoneFill('upper_right')} stroke={zoneStroke('upper_right')} strokeWidth={0.8}
        onPress={() => onZonePress('upper_right')}
      />

      {/* Torso */}
      <Rect
        x={56} y={52} width={48} height={68} rx={5}
        fill={zoneFill('center')} stroke={zoneStroke('center')} strokeWidth={0.8}
        onPress={() => onZonePress('center')}
      />

      {/* Left leg */}
      <Path
        d="M60,120 Q56,140 55,180 Q54,196 58,206 Q62,213 68,213 Q74,213 76,206 Q78,196 78,180 L80,120Z"
        fill={zoneFill('lower_left')} stroke={zoneStroke('lower_left')} strokeWidth={0.8}
        onPress={() => onZonePress('lower_left')}
      />

      {/* Right leg */}
      <Path
        d="M100,120 Q104,140 105,180 Q106,196 102,206 Q98,213 92,213 Q86,213 84,206 Q82,196 82,180 L80,120Z"
        fill={zoneFill('lower_right')} stroke={zoneStroke('lower_right')} strokeWidth={0.8}
        onPress={() => onZonePress('lower_right')}
      />

      {/* Head re-draw on top */}
      <Ellipse cx={80} cy={22} rx={16} ry={18} fill={Colors.surface} stroke={Colors.border} strokeWidth={0.8} />

      {/* Value labels */}
      {zones.map((zone) => {
        const v = form[keys[zone]];
        const hasV = typeof v === 'string' && v.trim().length > 0;
        if (!hasV) return null;
        const positions: Record<SegZone, { x: number; y: number }> = {
          upper_left: { x: 36, y: 80 },
          upper_right: { x: 124, y: 80 },
          center: { x: 80, y: 88 },
          lower_left: { x: 62, y: 170 },
          lower_right: { x: 98, y: 170 },
        };
        const pos = positions[zone];
        return (
          <G key={zone}>
            <Rect x={pos.x - 14} y={pos.y - 10} width={28} height={14} rx={4} fill="rgba(0,0,0,0.55)" />
            <SvgText x={pos.x} y={pos.y} textAnchor="middle" fontSize={9} fontWeight="700" fill="#fff">
              {v}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

export function SegmentalFormSection({ form, onChange }: Props) {
  const [mode, setMode] = useState<FormMode>('lean');
  const [selected, setSelected] = useState<SegZone | null>(null);

  const keys = mode === 'lean' ? LEAN_KEYS : FAT_KEYS;
  const zones: SegZone[] = ['upper_left', 'upper_right', 'center', 'lower_left', 'lower_right'];

  const handleZonePress = (zone: SegZone) => {
    setSelected((prev) => (prev === zone ? null : zone));
  };

  return (
    <View style={fs.wrap}>
      <Text style={fs.sectionTitle}>3–4. Segmental (Lean & Fat)</Text>

      {/* Mode toggle */}
      <View style={fs.toggle}>
        {(['lean', 'fat'] as FormMode[]).map((m) => (
          <TouchableOpacity
            key={m}
            style={[fs.toggleBtn, mode === m && fs.toggleBtnActive]}
            onPress={() => { setMode(m); setSelected(null); }}
            activeOpacity={0.75}
          >
            <Text style={[fs.toggleText, mode === m && fs.toggleTextActive]}>
              {m === 'lean' ? 'Lean (Cơ)' : 'Fat (Mỡ)'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={fs.bodyRow}>
        {/* Mini body figure */}
        <View style={fs.figureWrap}>
          <MiniBodySvg form={form} mode={mode} selected={selected} onZonePress={handleZonePress} />
          <Text style={fs.tapHint}>Nhấn vùng để nhập</Text>
        </View>

        {/* Input fields column */}
        <View style={fs.fieldsCol}>
          {zones.map((zone) => {
            const metricKey = keys[zone];
            const isActive = selected === zone;
            return (
              <TouchableOpacity
                key={zone}
                style={[fs.fieldRow, isActive && fs.fieldRowActive]}
                onPress={() => handleZonePress(zone)}
                activeOpacity={0.8}
              >
                <Text style={[fs.fieldLabel, isActive && fs.fieldLabelActive]} numberOfLines={1}>
                  {ZONE_LABELS[zone]}
                </Text>
                <View style={fs.inputRow}>
                  <TextInput
                    style={[fs.input, isActive && fs.inputActive]}
                    keyboardType="decimal-pad"
                    value={form[metricKey] as string}
                    onChangeText={(v) => onChange(metricKey, v)}
                    placeholder="—"
                    placeholderTextColor={Colors.textMuted}
                    onFocus={() => setSelected(zone)}
                  />
                  <Text style={fs.unit}>kg</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const fs = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.surfaceElevated, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, padding: 12, marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11, color: Colors.textSecondary, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10,
  },
  toggle: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  toggleBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  toggleBtnActive: { backgroundColor: Colors.accent + '20', borderColor: Colors.accent },
  toggleText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  toggleTextActive: { color: Colors.accent },
  bodyRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  figureWrap: { alignItems: 'center' },
  tapHint: { fontSize: 10, color: Colors.textMuted, marginTop: 4 },
  fieldsCol: { flex: 1, gap: 6 },
  fieldRow: {
    backgroundColor: Colors.surface, borderRadius: 8,
    padding: 7, borderWidth: 1, borderColor: Colors.border,
  },
  fieldRowActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '10' },
  fieldLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '600', marginBottom: 3 },
  fieldLabelActive: { color: Colors.accent },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  input: {
    flex: 1, color: Colors.text, fontSize: 13, fontWeight: '600',
    paddingVertical: 0, paddingHorizontal: 0,
  },
  inputActive: { color: Colors.accent },
  unit: { fontSize: 10, color: Colors.textMuted },
});