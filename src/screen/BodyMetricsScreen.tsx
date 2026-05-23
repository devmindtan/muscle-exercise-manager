import { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Target, X } from 'lucide-react-native';
import {
  createBodyMeasurement,
  createMuscleGoal,
  getBodyMeasurements,
  getMuscleGoals,
  getMuscleGroups,
} from '@/src/lib/repository';
import { Colors } from '@/src/constants/colors';
import type { MuscleGoal, BodyMeasurement, MuscleGroup } from '@/src/types/database';

// ─── Types ────────────────────────────────────────────────────────────────────

type InBodyFormState = {
  measuredAt: string;
  note: string;
  weight: string;
  skeletal_muscle_mass: string;
  body_fat_mass: string;
  bmi: string;
  pbf: string;
  segmental_lean_upper_left: string;
  segmental_lean_upper_right: string;
  segmental_lean_center: string;
  segmental_lean_lower_left: string;
  segmental_lean_lower_right: string;
  segmental_fat_upper_left: string;
  segmental_fat_upper_right: string;
  segmental_fat_center: string;
  segmental_fat_lower_left: string;
  segmental_fat_lower_right: string;
  waist_hip_ratio: string;
  visceral_fat_level: string;
};

type ScreenTab = 'overview' | 'segmental' | 'goals' | 'history';

// ─── Constants ────────────────────────────────────────────────────────────────

const METRIC_OPTIONS = [
  { key: 'weight', label: 'Cân nặng', unit: 'kg' },
  { key: 'skeletal_muscle_mass', label: 'SMM', unit: 'kg' },
  { key: 'body_fat_mass', label: 'Body Fat', unit: 'kg' },
  { key: 'bmi', label: 'BMI', unit: '' },
  { key: 'pbf', label: 'PBF', unit: '%' },
  { key: 'waist_hip_ratio', label: 'WHR', unit: '' },
  { key: 'visceral_fat_level', label: 'Visceral Fat', unit: '' },
  { key: 'segmental_lean_upper_left', label: 'Lean Trên Trái', unit: 'kg' },
  { key: 'segmental_lean_upper_right', label: 'Lean Trên Phải', unit: 'kg' },
  { key: 'segmental_lean_center', label: 'Lean Giữa', unit: 'kg' },
  { key: 'segmental_lean_lower_left', label: 'Lean Dưới Trái', unit: 'kg' },
  { key: 'segmental_lean_lower_right', label: 'Lean Dưới Phải', unit: 'kg' },
  { key: 'segmental_fat_upper_left', label: 'Fat Trên Trái', unit: 'kg' },
  { key: 'segmental_fat_upper_right', label: 'Fat Trên Phải', unit: 'kg' },
  { key: 'segmental_fat_center', label: 'Fat Giữa', unit: 'kg' },
  { key: 'segmental_fat_lower_left', label: 'Fat Dưới Trái', unit: 'kg' },
  { key: 'segmental_fat_lower_right', label: 'Fat Dưới Phải', unit: 'kg' },
] as const;

const GOAL_METRIC_OPTIONS = [
  { key: 'segmental_lean_upper_left', label: 'Lean Trên Trái', unit: 'kg' },
  { key: 'segmental_lean_upper_right', label: 'Lean Trên Phải', unit: 'kg' },
  { key: 'segmental_lean_center', label: 'Lean Giữa', unit: 'kg' },
  { key: 'segmental_lean_lower_left', label: 'Lean Dưới Trái', unit: 'kg' },
  { key: 'segmental_lean_lower_right', label: 'Lean Dưới Phải', unit: 'kg' },
  { key: 'segmental_fat_upper_left', label: 'Fat Trên Trái', unit: 'kg' },
  { key: 'segmental_fat_upper_right', label: 'Fat Trên Phải', unit: 'kg' },
  { key: 'segmental_fat_center', label: 'Fat Giữa', unit: 'kg' },
  { key: 'segmental_fat_lower_left', label: 'Fat Dưới Trái', unit: 'kg' },
  { key: 'segmental_fat_lower_right', label: 'Fat Dưới Phải', unit: 'kg' },
] as const;

// Top-4 summary cards
const SUMMARY_METRICS = ['weight', 'skeletal_muscle_mass', 'body_fat_mass', 'pbf'] as const;

const SEGMENTAL_LEAN_METRICS = [
  { key: 'segmental_lean_upper_left', label: 'Trên trái' },
  { key: 'segmental_lean_upper_right', label: 'Trên phải' },
  { key: 'segmental_lean_center', label: 'Giữa (thân)' },
  { key: 'segmental_lean_lower_left', label: 'Dưới trái' },
  { key: 'segmental_lean_lower_right', label: 'Dưới phải' },
] as const;

const SEGMENTAL_FAT_METRICS = [
  { key: 'segmental_fat_upper_left', label: 'Trên trái' },
  { key: 'segmental_fat_upper_right', label: 'Trên phải' },
  { key: 'segmental_fat_center', label: 'Giữa (thân)' },
  { key: 'segmental_fat_lower_left', label: 'Dưới trái' },
  { key: 'segmental_fat_lower_right', label: 'Dưới phải' },
] as const;

const INCREASE_METRICS = new Set([
  'skeletal_muscle_mass',
  'segmental_lean_upper_left',
  'segmental_lean_upper_right',
  'segmental_lean_center',
  'segmental_lean_lower_left',
  'segmental_lean_lower_right',
]);

const DECREASE_METRICS = new Set([
  'body_fat_mass',
  'pbf',
  'segmental_fat_upper_left',
  'segmental_fat_upper_right',
  'segmental_fat_center',
  'segmental_fat_lower_left',
  'segmental_fat_lower_right',
  'waist_hip_ratio',
  'visceral_fat_level',
]);

const INBODY_SAVE_ENTRIES: { metricKey: keyof InBodyFormState; unit: string; label: string }[] = [
  { metricKey: 'weight', unit: 'kg', label: 'Cân nặng' },
  { metricKey: 'skeletal_muscle_mass', unit: 'kg', label: 'SMM' },
  { metricKey: 'body_fat_mass', unit: 'kg', label: 'Body Fat Mass' },
  { metricKey: 'bmi', unit: 'BMI', label: 'BMI' },
  { metricKey: 'pbf', unit: '%', label: 'PBF' },
  { metricKey: 'segmental_lean_upper_left', unit: 'kg', label: 'Lean Trên Trái' },
  { metricKey: 'segmental_lean_upper_right', unit: 'kg', label: 'Lean Trên Phải' },
  { metricKey: 'segmental_lean_center', unit: 'kg', label: 'Lean Giữa' },
  { metricKey: 'segmental_lean_lower_left', unit: 'kg', label: 'Lean Dưới Trái' },
  { metricKey: 'segmental_lean_lower_right', unit: 'kg', label: 'Lean Dưới Phải' },
  { metricKey: 'segmental_fat_upper_left', unit: 'kg', label: 'Fat Trên Trái' },
  { metricKey: 'segmental_fat_upper_right', unit: 'kg', label: 'Fat Trên Phải' },
  { metricKey: 'segmental_fat_center', unit: 'kg', label: 'Fat Giữa' },
  { metricKey: 'segmental_fat_lower_left', unit: 'kg', label: 'Fat Dưới Trái' },
  { metricKey: 'segmental_fat_lower_right', unit: 'kg', label: 'Fat Dưới Phải' },
  { metricKey: 'waist_hip_ratio', unit: 'ratio', label: 'Waist-Hip Ratio' },
  { metricKey: 'visceral_fat_level', unit: 'level', label: 'Visceral Fat Level' },
];

const DEFAULT_INBODY_FORM: InBodyFormState = {
  measuredAt: '',
  note: '',
  weight: '',
  skeletal_muscle_mass: '',
  body_fat_mass: '',
  bmi: '',
  pbf: '',
  segmental_lean_upper_left: '',
  segmental_lean_upper_right: '',
  segmental_lean_center: '',
  segmental_lean_lower_left: '',
  segmental_lean_lower_right: '',
  segmental_fat_upper_left: '',
  segmental_fat_upper_right: '',
  segmental_fat_center: '',
  segmental_fat_lower_left: '',
  segmental_fat_lower_right: '',
  waist_hip_ratio: '',
  visceral_fat_level: '',
};

const DEFAULT_GOAL_FORM = {
  metricKey: 'segmental_lean_upper_left' as string,
  currentValue: '',
  targetValue: '',
  targetDate: '',
  note: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateShort(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

function formatDateFull(value?: string | null) {
  if (!value) return 'Chưa đặt ngày';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getMetricLabel(key: string) {
  return METRIC_OPTIONS.find((o) => o.key === key)?.label ?? key;
}

function getMetricUnit(key: string) {
  return METRIC_OPTIONS.find((o) => o.key === key)?.unit ?? '';
}

function getTrendTarget(key: string): 'up' | 'down' | 'balance' {
  if (INCREASE_METRICS.has(key)) return 'up';
  if (DECREASE_METRICS.has(key)) return 'down';
  return 'balance';
}

function getTrendTone(key: string, delta: number | null): 'good' | 'warn' | 'neutral' {
  if (delta == null || delta === 0) return 'neutral';
  const target = getTrendTarget(key);
  if (target === 'balance') return Math.abs(delta) <= 0.05 ? 'good' : 'warn';
  if (target === 'up') return delta > 0 ? 'good' : 'warn';
  return delta < 0 ? 'good' : 'warn';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SparkBars({ history, max }: { history: BodyMeasurement[]; max: number }) {
  if (history.length === 0) return <View style={styles.sparkEmpty} />;
  return (
    <View style={styles.sparkRow}>
      {history.map((pt) => (
        <View key={pt.id} style={styles.sparkTrack}>
          <View
            style={[
              styles.sparkFill,
              { height: `${Math.max((pt.value / max) * 100, 8)}%` },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

function TrendBadge({ tone, delta }: { tone: 'good' | 'warn' | 'neutral'; delta: number | null }) {
  const label =
    delta == null
      ? '—'
      : `${delta > 0 ? '+' : ''}${delta.toFixed(2)}`;

  const badgeStyle =
    tone === 'good'
      ? styles.badgeGood
      : tone === 'warn'
        ? styles.badgeWarn
        : styles.badgeNeutral;

  const textStyle =
    tone === 'good'
      ? styles.badgeGoodText
      : tone === 'warn'
        ? styles.badgeWarnText
        : styles.badgeNeutralText;

  return (
    <View style={[styles.badge, badgeStyle]}>
      <Text style={[styles.badgeText, textStyle]}>{label}</Text>
    </View>
  );
}

function FormField({
  label,
  value,
  onChange,
  unit,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit?: string;
}) {
  return (
    <View style={styles.formField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldRow}>
        <TextInput
          style={[styles.input, styles.fieldInput]}
          keyboardType="decimal-pad"
          value={value}
          onChangeText={onChange}
          placeholder="—"
          placeholderTextColor={Colors.textMuted}
        />
        {unit ? <Text style={styles.fieldUnit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function BodyMetricsScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<ScreenTab>('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [goals, setGoals] = useState<MuscleGoal[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<string>('skeletal_muscle_mass');
  const [showInBodyModal, setShowInBodyModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [inBodyForm, setInBodyForm] = useState<InBodyFormState>(DEFAULT_INBODY_FORM);
  const [goalForm, setGoalForm] = useState(DEFAULT_GOAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const [measurementRows, goalRows] = await Promise.all([
        getBodyMeasurements(undefined, 200),
        getMuscleGoals(),
      ]);
      setMeasurements(measurementRows as BodyMeasurement[]);
      setGoals(goalRows as MuscleGoal[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // ── Derived data ──

  const latestMetrics = useMemo(() => {
    const map = new Map<string, BodyMeasurement>();
    for (const m of measurements) {
      if (!map.has(m.metric_key)) map.set(m.metric_key, m);
    }
    return map;
  }, [measurements]);

  const historyByMetric = useMemo(() => {
    const map = new Map<string, BodyMeasurement[]>();
    for (const m of measurements) {
      const cur = map.get(m.metric_key) ?? [];
      map.set(m.metric_key, [...cur, m]);
    }
    return map;
  }, [measurements]);

  const selectedHistory = useMemo(
    () => (historyByMetric.get(selectedMetric) ?? []).slice(0, 6).reverse(),
    [historyByMetric, selectedMetric],
  );

  const selectedMax = useMemo(
    () => Math.max(...selectedHistory.map((i) => i.value), 1),
    [selectedHistory],
  );

  const lastUpdated = useMemo(() => {
    if (measurements.length === 0) return null;
    return measurements[0].measured_at;
  }, [measurements]);

  const prioritizedGoals = useMemo(
    () =>
      [...goals]
        .filter((g) => g.current_value != null && g.target_value > (g.current_value ?? 0))
        .sort((a, b) => {
          const gapA = a.target_value - (a.current_value ?? 0);
          const gapB = b.target_value - (b.current_value ?? 0);
          return gapB - gapA;
        }),
    [goals],
  );

  // ── Metric row data helper ──

  function metricRowData(key: string) {
    const history = historyByMetric.get(key) ?? [];
    const latest = history[0];
    const previous = history[1];
    const delta = latest != null && previous != null ? latest.value - previous.value : null;
    const tone = getTrendTone(key, delta);
    const spark = history.slice(0, 5).reverse();
    const localMax = Math.max(...history.map((i) => i.value), 1);
    return { latest, delta, tone, spark, localMax };
  }

  // ── Save handlers ──

  const saveInBodyMetrics = async () => {
    const measuredAt = inBodyForm.measuredAt.trim()
      ? new Date(inBodyForm.measuredAt.trim()).toISOString()
      : new Date().toISOString();

    if (
      inBodyForm.measuredAt.trim() &&
      Number.isNaN(new Date(inBodyForm.measuredAt.trim()).getTime())
    ) {
      setError('Ngày đo không hợp lệ. Dùng định dạng YYYY-MM-DD hoặc để trống.');
      return;
    }

    const filled = INBODY_SAVE_ENTRIES.filter((e) => {
      const v = inBodyForm[e.metricKey];
      return typeof v === 'string' && v.trim().length > 0;
    });

    if (filled.length === 0) {
      setError('Vui lòng nhập ít nhất một chỉ số.');
      return;
    }

    for (const e of filled) {
      if (!Number.isFinite(Number(inBodyForm[e.metricKey]))) {
        setError(`Giá trị không hợp lệ: ${e.label}`);
        return;
      }
    }

    setSaving(true);
    setError('');
    try {
      for (const e of filled) {
        await createBodyMeasurement({
          metricKey: e.metricKey,
          value: Number(inBodyForm[e.metricKey]),
          unit: e.unit,
          note: inBodyForm.note.trim() || `InBody: ${e.label}`,
          source: 'manual_inbody',
          measuredAt,
        });
      }
      setInBodyForm(DEFAULT_INBODY_FORM);
      setShowInBodyModal(false);
      setStatusMessage(`Đã lưu ${filled.length} chỉ số InBody.`);
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'Không thể lưu chỉ số InBody.');
    } finally {
      setSaving(false);
    }
  };

  const saveGoal = async () => {
    const targetValue = Number(goalForm.targetValue);
    const currentValue = goalForm.currentValue.trim() ? Number(goalForm.currentValue) : null;
    const groups = (await getMuscleGroups()) as MuscleGroup[];
    const fallbackGroupId = groups[0]?.id;

    if (!fallbackGroupId) {
      setError('Cần ít nhất 1 nhóm cơ trước khi tạo goal.');
      return;
    }
    if (!Number.isFinite(targetValue)) {
      setError('Vui lòng nhập mục tiêu hợp lệ.');
      return;
    }
    if (goalForm.currentValue.trim() && !Number.isFinite(currentValue)) {
      setError('Giá trị hiện tại không hợp lệ.');
      return;
    }

    const unit = GOAL_METRIC_OPTIONS.find((o) => o.key === goalForm.metricKey)?.unit ?? 'kg';
    const normalizedTargetDate = goalForm.targetDate.trim()
      ? new Date(goalForm.targetDate.trim()).toISOString()
      : null;

    setSaving(true);
    setError('');
    try {
      await createMuscleGoal({
        muscleGroupId: fallbackGroupId,
        metricKey: goalForm.metricKey,
        currentValue,
        targetValue,
        unit,
        targetDate: normalizedTargetDate,
        note: goalForm.note.trim() || null,
      });
      setGoalForm(DEFAULT_GOAL_FORM);
      setShowGoalModal(false);
      setStatusMessage('Đã lưu goal thành công.');
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'Không thể lưu mục tiêu.');
    } finally {
      setSaving(false);
    }
  };

  // ── Loading ──

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.loadingText}>Đang tải chỉ số...</Text>
      </View>
    );
  }

  // ── Tab content ──

  const renderOverview = () => (
    <>
      {/* 2×2 summary cards */}
      <View style={styles.statGrid}>
        {SUMMARY_METRICS.map((key) => {
          const latest = latestMetrics.get(key);
          const history = historyByMetric.get(key) ?? [];
          const delta =
            history.length >= 2 ? history[0].value - history[1].value : null;
          const tone = getTrendTone(key, delta);
          const isSelected = selectedMetric === key;

          return (
            <TouchableOpacity
              key={key}
              style={[styles.statCard, isSelected && styles.statCardActive]}
              onPress={() => setSelectedMetric(key)}
              activeOpacity={0.75}
            >
              <Text style={styles.statLabel}>{getMetricLabel(key)}</Text>
              <Text style={[styles.statValue, isSelected && styles.statValueAccent]}>
                {latest != null ? `${latest.value}` : '—'}
                {latest ? <Text style={styles.statUnit}> {getMetricUnit(key)}</Text> : null}
              </Text>
              {delta != null ? (
                <Text
                  style={[
                    styles.statDelta,
                    tone === 'good' && styles.deltaGood,
                    tone === 'warn' && styles.deltaWarn,
                  ]}
                >
                  {delta > 0 ? '+' : ''}
                  {delta.toFixed(2)} so với lần trước
                </Text>
              ) : (
                <Text style={styles.statDeltaNeutral}>Chưa đủ dữ liệu</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Trend chart for selected metric */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Xu hướng</Text>
        <Text style={styles.sectionHint}>{getMetricLabel(selectedMetric)}</Text>
      </View>
      {selectedHistory.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Chưa có dữ liệu cho chỉ số này</Text>
        </View>
      ) : (
        <View style={styles.chartCard}>
          <View style={styles.chartInner}>
            {selectedHistory.map((item) => (
              <View key={item.id} style={styles.chartCol}>
                <Text style={styles.chartVal}>{item.value}</Text>
                <View style={styles.chartBarBg}>
                  <View
                    style={[
                      styles.chartBarFill,
                      { height: `${Math.max((item.value / selectedMax) * 100, 6)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.chartLabel}>{formatDateShort(item.measured_at)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </>
  );

  const renderSegmentalSection = (
    title: string,
    metrics: readonly { key: string; label: string }[],
  ) => (
    <View style={styles.segCard}>
      <Text style={styles.segCardTitle}>{title}</Text>
      {metrics.map(({ key, label }, idx) => {
        const { latest, delta, tone, spark, localMax } = metricRowData(key);
        const isLast = idx === metrics.length - 1;
        return (
          <View key={key} style={[styles.segRow, !isLast && styles.segRowBorder]}>
            <View style={styles.segLeft}>
              <Text style={styles.segName}>{label}</Text>
              <SparkBars history={spark} max={localMax} />
            </View>
            <View style={styles.segRight}>
              <Text style={styles.segValue}>
                {latest != null ? `${latest.value} kg` : '—'}
              </Text>
              <TrendBadge tone={tone} delta={delta} />
            </View>
          </View>
        );
      })}
    </View>
  );

  const renderSegmental = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Lean (cơ)</Text>
        <Text style={styles.sectionHint}>Nên tăng</Text>
      </View>
      {renderSegmentalSection('Segmental Lean', SEGMENTAL_LEAN_METRICS)}

      <View style={[styles.sectionHeader, { marginTop: 8 }]}>
        <Text style={styles.sectionTitle}>Fat (mỡ)</Text>
        <Text style={styles.sectionHint}>Nên giảm</Text>
      </View>
      {renderSegmentalSection('Segmental Fat', SEGMENTAL_FAT_METRICS)}
    </>
  );

  const renderGoals = () => (
    <>
      {prioritizedGoals.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            Tạo goal để app gợi ý chỉ số nào cần ưu tiên tăng hoặc giảm
          </Text>
        </View>
      ) : (
        prioritizedGoals.map((goal) => {
          const current = goal.current_value ?? 0;
          const pct =
            goal.target_value > 0
              ? Math.min(Math.round((current / goal.target_value) * 100), 100)
              : 0;
          const gap = Math.max(goal.target_value - current, 0);
          return (
            <View key={goal.id} style={styles.goalCard}>
              <View style={styles.goalTop}>
                <Text style={styles.goalName}>{getMetricLabel(goal.metric_key)}</Text>
                {goal.target_date ? (
                  <Text style={styles.goalDate}>Đích: {formatDateShort(goal.target_date)}</Text>
                ) : null}
              </View>
              <View style={styles.goalProgressRow}>
                <View style={styles.goalTrack}>
                  <View style={[styles.goalFill, { width: `${pct}%` }]} />
                </View>
                <Text style={styles.goalPct}>{pct}%</Text>
              </View>
              <View style={styles.goalMeta}>
                <Text style={styles.goalMetaText}>Hiện tại {current} {goal.unit}</Text>
                <Text style={styles.goalMetaText}>
                  Còn {gap.toFixed(1)} {goal.unit} → {goal.target_value} {goal.unit}
                </Text>
              </View>
            </View>
          );
        })
      )}
    </>
  );

  const renderHistory = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Lịch sử</Text>
        <Text style={styles.sectionHint}>{measurements.length} bản ghi</Text>
      </View>
      {measurements.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Chưa có bản ghi nào</Text>
        </View>
      ) : (
        measurements.slice(0, 30).map((m) => (
          <View key={m.id} style={styles.historyCard}>
            <View>
              <Text style={styles.historyTitle}>{getMetricLabel(m.metric_key)}</Text>
              <Text style={styles.historyDate}>{formatDateFull(m.measured_at)}</Text>
            </View>
            <View style={styles.historyRight}>
              <Text style={styles.historyValue}>
                {m.value} {m.unit}
              </Text>
              <Text style={styles.historySource}>{m.source ?? 'manual'}</Text>
            </View>
          </View>
        ))
      )}
    </>
  );

  // ── Render ──

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 15 }]}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Chỉ số cơ thể</Text>
              {lastUpdated ? (
                <Text style={styles.subtitle}>
                  Cập nhật lần cuối {formatDateFull(lastUpdated)}
                </Text>
              ) : (
                <Text style={styles.subtitle}>Nhập chỉ số InBody để bắt đầu theo dõi</Text>
              )}
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => { setError(''); setShowInBodyModal(true); }}
            >
              <Plus color={Colors.bg} size={15} strokeWidth={2.5} />
              <Text style={styles.headerBtnText}>Nhập InBody</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerBtn, styles.headerBtnGhost]}
              onPress={() => { setError(''); setShowGoalModal(true); }}
            >
              <Target color={Colors.accent} size={15} strokeWidth={2.2} />
              <Text style={[styles.headerBtnText, styles.headerBtnGhostText]}>Thêm goal</Text>
            </TouchableOpacity>
          </View>

          {statusMessage ? (
            <View style={styles.statusCard}>
              <Text style={styles.statusText}>{statusMessage}</Text>
            </View>
          ) : null}
        </View>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          {(
            [
              { key: 'overview', label: 'Tổng quan' },
              { key: 'segmental', label: 'Segmental' },
              { key: 'goals', label: 'Goals' },
              { key: 'history', label: 'Lịch sử' },
            ] as const
          ).map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabItem, tab === t.key && styles.tabItemActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        <View style={styles.tabContent}>
          {tab === 'overview' && renderOverview()}
          {tab === 'segmental' && renderSegmental()}
          {tab === 'goals' && renderGoals()}
          {tab === 'history' && renderHistory()}
        </View>
      </ScrollView>

      {/* ── InBody modal ── */}
      <Modal
        visible={showInBodyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowInBodyModal(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowInBodyModal(false)} />
        <KeyboardAvoidingView
          style={styles.sheetWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Nhập chỉ số InBody</Text>
              <TouchableOpacity onPress={() => setShowInBodyModal(false)}>
                <X color={Colors.textSecondary} size={20} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={styles.sheetContent}
            >
              <Text style={styles.formSectionTitle}>Thông tin chung</Text>
              <TextInput
                style={styles.input}
                value={inBodyForm.measuredAt}
                onChangeText={(v) => setInBodyForm((s) => ({ ...s, measuredAt: v }))}
                placeholder="Ngày đo YYYY-MM-DD (để trống = hiện tại)"
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.formSectionTitle}>1. Muscle-Fat</Text>
              <FormField label="Cân nặng" value={inBodyForm.weight} unit="kg"
                onChange={(v) => setInBodyForm((s) => ({ ...s, weight: v }))} />
              <FormField label="SMM" value={inBodyForm.skeletal_muscle_mass} unit="kg"
                onChange={(v) => setInBodyForm((s) => ({ ...s, skeletal_muscle_mass: v }))} />
              <FormField label="Body Fat Mass" value={inBodyForm.body_fat_mass} unit="kg"
                onChange={(v) => setInBodyForm((s) => ({ ...s, body_fat_mass: v }))} />

              <Text style={styles.formSectionTitle}>2. Obesity</Text>
              <FormField label="BMI" value={inBodyForm.bmi} unit="BMI"
                onChange={(v) => setInBodyForm((s) => ({ ...s, bmi: v }))} />
              <FormField label="PBF" value={inBodyForm.pbf} unit="%"
                onChange={(v) => setInBodyForm((s) => ({ ...s, pbf: v }))} />

              <Text style={styles.formSectionTitle}>3. Segmental Lean (5 vùng)</Text>
              <View style={styles.twoCol}>
                <View style={styles.colHalf}>
                  <FormField label="Trên trái" value={inBodyForm.segmental_lean_upper_left} unit="kg"
                    onChange={(v) => setInBodyForm((s) => ({ ...s, segmental_lean_upper_left: v }))} />
                  <FormField label="Giữa" value={inBodyForm.segmental_lean_center} unit="kg"
                    onChange={(v) => setInBodyForm((s) => ({ ...s, segmental_lean_center: v }))} />
                  <FormField label="Dưới phải" value={inBodyForm.segmental_lean_lower_right} unit="kg"
                    onChange={(v) => setInBodyForm((s) => ({ ...s, segmental_lean_lower_right: v }))} />
                </View>
                <View style={styles.colHalf}>
                  <FormField label="Trên phải" value={inBodyForm.segmental_lean_upper_right} unit="kg"
                    onChange={(v) => setInBodyForm((s) => ({ ...s, segmental_lean_upper_right: v }))} />
                  <FormField label="Dưới trái" value={inBodyForm.segmental_lean_lower_left} unit="kg"
                    onChange={(v) => setInBodyForm((s) => ({ ...s, segmental_lean_lower_left: v }))} />
                </View>
              </View>

              <Text style={styles.formSectionTitle}>4. Segmental Fat (5 vùng)</Text>
              <View style={styles.twoCol}>
                <View style={styles.colHalf}>
                  <FormField label="Trên trái" value={inBodyForm.segmental_fat_upper_left} unit="kg"
                    onChange={(v) => setInBodyForm((s) => ({ ...s, segmental_fat_upper_left: v }))} />
                  <FormField label="Giữa" value={inBodyForm.segmental_fat_center} unit="kg"
                    onChange={(v) => setInBodyForm((s) => ({ ...s, segmental_fat_center: v }))} />
                  <FormField label="Dưới phải" value={inBodyForm.segmental_fat_lower_right} unit="kg"
                    onChange={(v) => setInBodyForm((s) => ({ ...s, segmental_fat_lower_right: v }))} />
                </View>
                <View style={styles.colHalf}>
                  <FormField label="Trên phải" value={inBodyForm.segmental_fat_upper_right} unit="kg"
                    onChange={(v) => setInBodyForm((s) => ({ ...s, segmental_fat_upper_right: v }))} />
                  <FormField label="Dưới trái" value={inBodyForm.segmental_fat_lower_left} unit="kg"
                    onChange={(v) => setInBodyForm((s) => ({ ...s, segmental_fat_lower_left: v }))} />
                </View>
              </View>

              <Text style={styles.formSectionTitle}>5. WHR & Visceral</Text>
              <FormField label="Waist-Hip Ratio" value={inBodyForm.waist_hip_ratio} unit="ratio"
                onChange={(v) => setInBodyForm((s) => ({ ...s, waist_hip_ratio: v }))} />
              <FormField label="Visceral Fat Level" value={inBodyForm.visceral_fat_level} unit="level"
                onChange={(v) => setInBodyForm((s) => ({ ...s, visceral_fat_level: v }))} />

              <Text style={styles.formSectionTitle}>Ghi chú</Text>
              <TextInput
                style={[styles.input, styles.noteInput]}
                value={inBodyForm.note}
                onChangeText={(v) => setInBodyForm((s) => ({ ...s, note: v }))}
                placeholder="VD: đo trước ăn sáng, sau ngủ đủ giấc"
                placeholderTextColor={Colors.textMuted}
                multiline
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity style={styles.primaryBtn} onPress={saveInBodyMetrics} disabled={saving}>
                <Text style={styles.primaryBtnText}>{saving ? 'Đang lưu...' : 'Lưu chỉ số InBody'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Goal modal ── */}
      <Modal
        visible={showGoalModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGoalModal(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowGoalModal(false)} />
        <KeyboardAvoidingView
          style={styles.sheetWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Tạo goal Lean / Fat</Text>
              <TouchableOpacity onPress={() => setShowGoalModal(false)}>
                <X color={Colors.textSecondary} size={20} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={styles.sheetContent}
            >
              <Text style={styles.goalHint}>
                Chọn chỉ số, nhập giá trị hiện tại và mục tiêu.
              </Text>

              <Text style={styles.label}>Chỉ số</Text>
              <View style={styles.chipWrap}>
                {GOAL_METRIC_OPTIONS.map((opt) => {
                  const active = goalForm.metricKey === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setGoalForm((s) => ({ ...s, metricKey: opt.key }))}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>Giá trị hiện tại</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                value={goalForm.currentValue}
                onChangeText={(v) => setGoalForm((s) => ({ ...s, currentValue: v }))}
                placeholder="VD: 8"
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.label}>Mục tiêu</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                value={goalForm.targetValue}
                onChangeText={(v) => setGoalForm((s) => ({ ...s, targetValue: v }))}
                placeholder="VD: 9"
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.label}>Ngày đích (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={goalForm.targetDate}
                onChangeText={(v) => setGoalForm((s) => ({ ...s, targetDate: v }))}
                placeholder="2026-06-30"
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.label}>Ghi chú</Text>
              <TextInput
                style={[styles.input, styles.noteInput]}
                value={goalForm.note}
                onChangeText={(v) => setGoalForm((s) => ({ ...s, note: v }))}
                placeholder="VD: tăng volume tay trong 4 tuần tới"
                placeholderTextColor={Colors.textMuted}
                multiline
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity style={styles.primaryBtn} onPress={saveGoal} disabled={saving}>
                <Text style={styles.primaryBtnText}>{saving ? 'Đang lưu...' : 'Lưu goal'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: Colors.textMuted, fontSize: 15 },
  content: { paddingBottom: 40 },

  // Header
  header: { paddingHorizontal: 20, paddingBottom: 16, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: { fontSize: 28, fontWeight: '700', color: Colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 3 },
  headerActions: { flexDirection: 'row', gap: 10 },
  headerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.accent, paddingHorizontal: 14,
    paddingVertical: 10, borderRadius: 12,
  },
  headerBtnGhost: {
    backgroundColor: Colors.surface, borderWidth: 1,
    borderColor: Colors.border,
  },
  headerBtnText: { color: Colors.bg, fontWeight: '700', fontSize: 13 },
  headerBtnGhostText: { color: Colors.accent },
  statusCard: {
    backgroundColor: Colors.success + '20', borderWidth: 1,
    borderColor: Colors.success + '55', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  statusText: { color: Colors.success, fontSize: 12, fontWeight: '600' },

  // Tab bar
  tabBar: {
    flexDirection: 'row', marginHorizontal: 20, marginBottom: 16,
    backgroundColor: Colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, padding: 3, gap: 2,
  },
  tabItem: {
    flex: 1, alignItems: 'center', paddingVertical: 8,
    borderRadius: 10,
  },
  tabItemActive: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.accent,
  },
  tabText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: Colors.accent },
  tabContent: { paddingHorizontal: 20 },

  // Stat grid (2×2)
  statGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20,
  },
  statCard: {
    width: '48%', backgroundColor: Colors.surface,
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border,
  },
  statCardActive: {
    borderColor: Colors.accent, backgroundColor: Colors.surfaceElevated,
  },
  statLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500', marginBottom: 5 },
  statValue: { fontSize: 24, fontWeight: '700', color: Colors.text, lineHeight: 28 },
  statValueAccent: { color: Colors.accent },
  statUnit: { fontSize: 12, fontWeight: '400', color: Colors.textMuted },
  statDelta: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  statDeltaNeutral: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  deltaGood: { color: Colors.success },
  deltaWarn: { color: Colors.warning },

  // Section header
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.7,
  },
  sectionHint: { fontSize: 12, color: Colors.textSecondary },

  // Chart
  chartCard: {
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 16, marginBottom: 8,
  },
  chartInner: {
    flexDirection: 'row', alignItems: 'flex-end',
    gap: 6, height: 100,
  },
  chartCol: { flex: 1, alignItems: 'center', gap: 5 },
  chartVal: { fontSize: 10, color: Colors.textSecondary, fontWeight: '600' },
  chartBarBg: {
    width: '100%', flex: 1, backgroundColor: Colors.border,
    borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden',
  },
  chartBarFill: { width: '100%', backgroundColor: Colors.accent, borderRadius: 6 },
  chartLabel: { fontSize: 10, color: Colors.textMuted },

  // Segmental card
  segCard: {
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden', marginBottom: 12,
  },
  segCardTitle: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  segRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
  },
  segRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  segLeft: { flex: 1 },
  segName: { fontSize: 13, fontWeight: '600', color: Colors.text },
  segRight: { alignItems: 'flex-end', gap: 4 },
  segValue: { fontSize: 14, fontWeight: '700', color: Colors.text },

  // Sparkline
  sparkRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    height: 20, gap: 2, marginTop: 5,
  },
  sparkTrack: {
    flex: 1, height: '100%', justifyContent: 'flex-end',
    backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden',
  },
  sparkFill: { width: '100%', backgroundColor: Colors.accent, borderRadius: 3 },
  sparkEmpty: { height: 8, backgroundColor: Colors.border, borderRadius: 3 },

  // Trend badge
  badge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  badgeGood: { backgroundColor: Colors.success + '20' },
  badgeGoodText: { color: Colors.success },
  badgeWarn: { backgroundColor: Colors.warning + '20' },
  badgeWarnText: { color: Colors.warning },
  badgeNeutral: { backgroundColor: Colors.border },
  badgeNeutralText: { color: Colors.textMuted },

  // Goals
  goalCard: {
    backgroundColor: Colors.surface, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 10,
  },
  goalTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  goalName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  goalDate: { fontSize: 11, color: Colors.textMuted },
  goalProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  goalTrack: {
    flex: 1, height: 4, backgroundColor: Colors.border,
    borderRadius: 2, overflow: 'hidden',
  },
  goalFill: { height: '100%', backgroundColor: Colors.accent, borderRadius: 2 },
  goalPct: { fontSize: 11, fontWeight: '700', color: Colors.accent, minWidth: 32, textAlign: 'right' },
  goalMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  goalMetaText: { fontSize: 11, color: Colors.textMuted },

  // History
  historyCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  historyTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  historyDate: { fontSize: 11, color: Colors.textMuted, marginTop: 3 },
  historyRight: { alignItems: 'flex-end' },
  historyValue: { fontSize: 15, fontWeight: '700', color: Colors.accent },
  historySource: { fontSize: 11, color: Colors.textMuted, marginTop: 3 },

  // Empty
  emptyBox: {
    backgroundColor: Colors.surface, borderRadius: 14,
    padding: 24, borderWidth: 1, borderColor: Colors.border, marginBottom: 10,
  },
  emptyText: { fontSize: 13, color: Colors.textMuted, lineHeight: 20 },

  // Modal / sheet
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetWrap: { justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 20,
    borderTopRightRadius: 20, padding: 20, paddingBottom: 36, maxHeight: '85%',
  },
  sheetContent: { paddingBottom: 24 },
  sheetHandle: {
    width: 36, height: 4, backgroundColor: Colors.border,
    borderRadius: 2, alignSelf: 'center', marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 16,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },

  // Form
  formSectionTitle: {
    fontSize: 11, color: Colors.textSecondary, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.7,
    marginBottom: 8, marginTop: 12,
  },
  formField: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600', marginBottom: 5 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fieldInput: { flex: 1, marginBottom: 0 },
  fieldUnit: { fontSize: 12, color: Colors.textMuted, minWidth: 40 },
  twoCol: { flexDirection: 'row', gap: 10 },
  colHalf: { flex: 1 },
  input: {
    backgroundColor: Colors.surfaceElevated, borderWidth: 1,
    borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 11,
    color: Colors.text, fontSize: 14, marginBottom: 14,
  },
  noteInput: { minHeight: 80, textAlignVertical: 'top' },
  errorText: { color: Colors.error, fontSize: 13, marginBottom: 12 },
  primaryBtn: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 15,
  },
  primaryBtnText: { color: Colors.bg, fontWeight: '700', fontSize: 15 },

  // Goal form
  goalHint: { fontSize: 12, color: Colors.textMuted, lineHeight: 18, marginBottom: 14 },
  label: {
    fontSize: 11, color: Colors.textMuted, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceElevated,
  },
  chipActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '20' },
  chipText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: Colors.accent },
});