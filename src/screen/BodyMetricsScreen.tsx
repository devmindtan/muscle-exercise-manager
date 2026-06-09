import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SegmentalFormSection, SegmentalMetricPicker } from '@/src/components/SegmentalFormSection';
import { OverviewTab } from '@/src/components/body-metrics-tabs/OverviewTab';
import { SegmentalTab } from '@/src/components/body-metrics-tabs/SegmentalTab';
import { GoalsTab } from '@/src/components/body-metrics-tabs/GoalsTab';
import { HistoryTab } from '@/src/components/body-metrics-tabs/HistoryTab';

import {
  createBodyMeasurement,
  deleteInBodyRecord,
  createMuscleGoal,
  deleteMuscleGoal,
  getBodyMeasurements,
  getMuscleGoals,
  getMuscleGroups,
  updateMuscleGoal,
  updateBodyMeasurement,
} from '@/src/lib/repository';
import { Colors } from '@/src/constants/colors';
import type { MuscleGoal, BodyMeasurement, MuscleGroup } from '@/src/types/database';

// ─── Types ────────────────────────────────────────────────────────────────────

export type InBodyFormState = {
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

function confirmDestructive(
  title: string,
  message: string,
  onConfirm: () => Promise<void> | void,
  confirmText = 'Xóa',
) {
  if (Platform.OS === 'web') {
    const canConfirm = typeof globalThis.confirm === 'function';
    const confirmed = canConfirm ? globalThis.confirm(`${title}\n\n${message}`) : true;
    if (confirmed) {
      void onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: 'Hủy', style: 'cancel' },
    {
      text: confirmText,
      style: 'destructive',
      onPress: () => {
        void onConfirm();
      },
    },
  ]);
}

type InBodyRecord = {
  key: string;
  measuredAt: string;
  note: string;
  rowsByMetric: Record<string, BodyMeasurement>;
};

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
  targetValue: '',
  targetDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  note: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateShort(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

function toDateInputValue(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showGoalDatePicker, setShowGoalDatePicker] = useState(false);
  const [goalFilterMode, setGoalFilterMode] = useState<'all' | 'lean' | 'fat' | 'done'>('all');
  const [inBodyForm, setInBodyForm] = useState<InBodyFormState>(DEFAULT_INBODY_FORM);
  const [editingRecordKey, setEditingRecordKey] = useState<string | null>(null);
  const [goalForm, setGoalForm] = useState(DEFAULT_GOAL_FORM);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
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

  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => {
      setStatusMessage('');
    }, 3500);
    return () => clearTimeout(timer);
  }, [statusMessage]);

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

  const inBodyRecords = useMemo<InBodyRecord[]>(() => {
    const map = new Map<string, InBodyRecord>();

    for (const row of measurements) {
      if (row.source !== 'manual_inbody') continue;
      const key = row.measured_at;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          measuredAt: row.measured_at,
          note: row.note || '',
          rowsByMetric: { [row.metric_key]: row },
        });
        continue;
      }
      existing.rowsByMetric[row.metric_key] = row;
      if (!existing.note && row.note) {
        existing.note = row.note;
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime(),
    );
  }, [measurements]);

  const selectedMax = useMemo(
    () => Math.max(...selectedHistory.map((i) => i.value), 1),
    [selectedHistory],
  );

  const latestGoalMetricValues = useMemo(() => {
    const values: Partial<Record<keyof InBodyFormState, string>> = {};
    for (const opt of GOAL_METRIC_OPTIONS) {
      const latest = latestMetrics.get(opt.key);
      values[opt.key as keyof InBodyFormState] = latest ? String(latest.value) : '';
    }
    return values;
  }, [latestMetrics]);

  const latestCurrentForGoal = useMemo(() => {
    return latestMetrics.get(goalForm.metricKey)?.value ?? null;
  }, [goalForm.metricKey, latestMetrics]);

  const goalsWithLatestCurrent = useMemo(
    () =>
      goals.map((goal) => ({
        ...goal,
        current_value: latestMetrics.get(goal.metric_key)?.value ?? goal.current_value,
      })),
    [goals, latestMetrics],
  );

  const lastUpdated = useMemo(() => {
    if (measurements.length === 0) return null;
    return measurements[0].measured_at;
  }, [measurements]);

  const prioritizedGoals = useMemo(
    () =>
      [...goalsWithLatestCurrent]
        .filter((g) => {
          if (g.current_value == null) return true;
          const current = g.current_value ?? 0;
          if (g.metric_key.startsWith('segmental_fat_')) {
            return g.target_value < current;
          }
          return g.target_value > current;
        })
        .sort((a, b) => {
          const gapA = Math.abs(a.target_value - (a.current_value ?? 0));
          const gapB = Math.abs(b.target_value - (b.current_value ?? 0));
          return gapB - gapA;
        }),
    [goalsWithLatestCurrent],
  );

  const completedGoals = useMemo(
  () =>
    goalsWithLatestCurrent.filter((g) => {
      if (g.current_value == null) return false;
      const current = g.current_value ?? 0;
      if (g.metric_key.startsWith('segmental_fat_')) {
        return g.target_value >= current;
      }
      return g.target_value <= current;
    }),
  [goalsWithLatestCurrent],
);

  const openCreateInBody = () => {
    setEditingRecordKey(null);
    setInBodyForm({
      ...DEFAULT_INBODY_FORM,
      measuredAt: new Date().toISOString().slice(0, 10),
    });
    setError('');
    setShowInBodyModal(true);
  };

  const openEditInBody = (record: InBodyRecord) => {
    const next: InBodyFormState = {
      ...DEFAULT_INBODY_FORM,
      measuredAt: toDateInputValue(record.measuredAt),
      note: record.note,
    };

    for (const entry of INBODY_SAVE_ENTRIES) {
      const row = record.rowsByMetric[entry.metricKey];
      if (row) {
        next[entry.metricKey] = String(row.value);
      }
    }

    setEditingRecordKey(record.key);
    setInBodyForm(next);
    setError('');
    setShowInBodyModal(true);
  };

  const confirmDeleteInBody = (record: InBodyRecord) => {
    confirmDestructive(
      'Xóa bản InBody',
      `Bạn có chắc muốn xóa bản InBody ngày ${formatDateFull(record.measuredAt)}?`,
      async () => {
        setSaving(true);
        setError('');
        try {
          await deleteInBodyRecord(record.measuredAt);
          if (editingRecordKey === record.key) {
            setEditingRecordKey(null);
            setShowInBodyModal(false);
          }
          setStatusMessage('Đã xóa bản InBody.');
          await load();
        } catch (err: any) {
          setError(err?.message ?? 'Không thể xóa bản InBody.');
        } finally {
          setSaving(false);
        }
      },
    );
  };

  const onDatePicked = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (!selectedDate) return;
    setInBodyForm((state) => ({
      ...state,
      measuredAt: selectedDate.toISOString().slice(0, 10),
    }));
  };

  const onGoalDatePicked = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowGoalDatePicker(false);
    if (!selectedDate) return;
    setGoalForm((s) => ({
      ...s,
      targetDate: selectedDate.toISOString().slice(0, 10),
    }));
  };

  // ── Save handlers ──

  const saveInBodyMetrics = async () => {
    const measuredAt = inBodyForm.measuredAt.trim()
      ? new Date(`${inBodyForm.measuredAt.trim()}T12:00:00.000Z`).toISOString()
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
      const editingRecord = editingRecordKey
        ? inBodyRecords.find((record) => record.key === editingRecordKey)
        : null;

      for (const e of filled) {
        const existingRow = editingRecord?.rowsByMetric[e.metricKey];
        const payload = {
          value: Number(inBodyForm[e.metricKey]),
          unit: e.unit,
          note: inBodyForm.note.trim() || null,
          source: 'manual_inbody',
          measuredAt,
        };

        if (existingRow) {
          await updateBodyMeasurement(existingRow.id, payload);
        } else {
          await createBodyMeasurement({
            metricKey: e.metricKey,
            ...payload,
          });
        }
      }

      setInBodyForm(DEFAULT_INBODY_FORM);
      setEditingRecordKey(null);
      setShowInBodyModal(false);
      setStatusMessage(
        editingRecordKey
          ? `Đã cập nhật bản InBody (${filled.length} chỉ số).`
          : `Đã lưu ${filled.length} chỉ số InBody.`,
      );
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'Không thể lưu chỉ số InBody.');
    } finally {
      setSaving(false);
    }
  };

  const saveGoal = async () => {
    const targetValue = Number(goalForm.targetValue);
    const currentValue = latestMetrics.get(goalForm.metricKey)?.value ?? null;
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

    const unit = GOAL_METRIC_OPTIONS.find((o) => o.key === goalForm.metricKey)?.unit ?? 'kg';
    const normalizedTargetDate = goalForm.targetDate.trim()
      ? new Date(goalForm.targetDate.trim()).toISOString()
      : null;

    setSaving(true);
    setError('');
    try {
      if (editingGoalId) {
        await updateMuscleGoal(editingGoalId, {
          metricKey: goalForm.metricKey,
          currentValue,
          targetValue,
          unit,
          targetDate: normalizedTargetDate,
          note: goalForm.note.trim() || null,
        });
      } else {
        await createMuscleGoal({
          muscleGroupId: fallbackGroupId,
          metricKey: goalForm.metricKey,
          currentValue,
          targetValue,
          unit,
          targetDate: normalizedTargetDate,
          note: goalForm.note.trim() || null,
        });
      }
      setGoalForm(DEFAULT_GOAL_FORM);
      setEditingGoalId(null);
      setShowGoalModal(false);
      setStatusMessage(editingGoalId ? 'Đã cập nhật goal.' : 'Đã lưu goal thành công.');
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'Không thể lưu mục tiêu.');
    } finally {
      setSaving(false);
    }
  };

  const openCreateGoal = () => {
    setError('');
    setEditingGoalId(null);
    setGoalForm(DEFAULT_GOAL_FORM);
    setShowGoalModal(true);
  };

  const openEditGoal = (goal: MuscleGoal) => {
    const dateOnly = goal.target_date ? toDateInputValue(goal.target_date) : '';
    setError('');
    setEditingGoalId(goal.id);
    setGoalForm({
      metricKey: goal.metric_key,
      targetValue: String(goal.target_value),
      targetDate: dateOnly || DEFAULT_GOAL_FORM.targetDate,
      note: goal.note || '',
    });
    setShowGoalModal(true);
  };

  const confirmDeleteGoal = (goal: MuscleGoal) => {
    confirmDestructive(
      'Xóa goal',
      `Bạn có chắc muốn xóa goal ${getMetricLabel(goal.metric_key)}?`,
      async () => {
        setSaving(true);
        setError('');
        try {
          await deleteMuscleGoal(goal.id);
          if (editingGoalId === goal.id) {
            setEditingGoalId(null);
            setShowGoalModal(false);
            setGoalForm(DEFAULT_GOAL_FORM);
          }
          setStatusMessage('Đã xóa goal.');
          await load();
        } catch (err: any) {
          setError(err?.message ?? 'Không thể xóa goal.');
        } finally {
          setSaving(false);
        }
      },
    );
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
            <TouchableOpacity style={styles.headerBtn} onPress={openCreateInBody}>
              <Plus color={Colors.bg} size={15} strokeWidth={2.5} />
              <Text style={styles.headerBtnText}>Nhập InBody</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerBtn, styles.headerBtnGhost]}
              onPress={openCreateGoal}
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
          {tab === 'overview' && (
            <OverviewTab
              summaryMetrics={SUMMARY_METRICS}
              latestMetrics={latestMetrics}
              historyByMetric={historyByMetric}
              selectedMetric={selectedMetric}
              onSelectMetric={setSelectedMetric}
              selectedHistory={selectedHistory}
              selectedMax={selectedMax}
              getMetricLabel={getMetricLabel}
              getMetricUnit={getMetricUnit}
              getTrendTone={getTrendTone}
              formatDateShort={formatDateShort}
            />
          )}
          {tab === 'segmental' && <SegmentalTab historyByMetric={historyByMetric} />}
          {tab === 'goals' && (
            <GoalsTab
              prioritizedGoals={prioritizedGoals}
              completedGoals={completedGoals}   
              goalFilterMode={goalFilterMode}
              onChangeGoalFilterMode={setGoalFilterMode}
              onEditGoal={openEditGoal}
              onDeleteGoal={confirmDeleteGoal}
              getMetricLabel={getMetricLabel}
              formatDateFull={formatDateFull}
            />
          )}
          {tab === 'history' && (
            <HistoryTab
              inBodyRecords={inBodyRecords}
              formatDateFull={formatDateFull}
              onEditRecord={openEditInBody}
              onDeleteRecord={confirmDeleteInBody}
            />
          )}
        </View>
      </ScrollView>

      {/* ── InBody modal ── */}
      <Modal
        visible={showInBodyModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowInBodyModal(false);
          setEditingRecordKey(null);
        }}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => {
            setShowInBodyModal(false);
            setEditingRecordKey(null);
          }}
        />
        <KeyboardAvoidingView
          style={styles.sheetWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {editingRecordKey ? 'Sửa bản InBody' : 'Nhập chỉ số InBody'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowInBodyModal(false);
                  setEditingRecordKey(null);
                }}
              >
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
              <TouchableOpacity
                style={styles.datePickerBtn}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.75}
              >
                <Text style={styles.datePickerLabel}>Ngày đo</Text>
                <Text style={styles.datePickerValue}>
                  {inBodyForm.measuredAt
                    ? formatDateFull(inBodyForm.measuredAt)
                    : 'Chọn ngày'}
                </Text>
              </TouchableOpacity>
              {showDatePicker ? (
                <DateTimePicker
                  value={
                    inBodyForm.measuredAt
                      ? new Date(`${inBodyForm.measuredAt}T12:00:00.000Z`)
                      : new Date()
                  }
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onDatePicked}
                />
              ) : null}

              <View style={styles.formSectionCard}>
                <Text style={styles.formSectionTitle}>1. Muscle-Fat</Text>
                <FormField
                  label="Cân nặng"
                  value={inBodyForm.weight}
                  unit="kg"
                  onChange={(v) => setInBodyForm((s) => ({ ...s, weight: v }))}
                />
                <FormField
                  label="SMM"
                  value={inBodyForm.skeletal_muscle_mass}
                  unit="kg"
                  onChange={(v) => setInBodyForm((s) => ({ ...s, skeletal_muscle_mass: v }))}
                />
                <FormField
                  label="Body Fat Mass"
                  value={inBodyForm.body_fat_mass}
                  unit="kg"
                  onChange={(v) => setInBodyForm((s) => ({ ...s, body_fat_mass: v }))}
                />
              </View>

              <View style={styles.formSectionCard}>
                <Text style={styles.formSectionTitle}>2. Obesity</Text>
                <FormField
                  label="BMI"
                  value={inBodyForm.bmi}
                  unit="BMI"
                  onChange={(v) => setInBodyForm((s) => ({ ...s, bmi: v }))}
                />
                <FormField
                  label="PBF"
                  value={inBodyForm.pbf}
                  unit="%"
                  onChange={(v) => setInBodyForm((s) => ({ ...s, pbf: v }))}
                />
              </View>

              <SegmentalFormSection
                form={inBodyForm}
                onChange={(key, value) => setInBodyForm((s) => ({ ...s, [key]: value }))}
              />

              <View style={styles.formSectionCard}>
                <Text style={styles.formSectionTitle}>5. WHR & Visceral</Text>
                <FormField
                  label="Waist-Hip Ratio"
                  value={inBodyForm.waist_hip_ratio}
                  unit="ratio"
                  onChange={(v) => setInBodyForm((s) => ({ ...s, waist_hip_ratio: v }))}
                />
                <FormField
                  label="Visceral Fat Level"
                  value={inBodyForm.visceral_fat_level}
                  unit="level"
                  onChange={(v) => setInBodyForm((s) => ({ ...s, visceral_fat_level: v }))}
                />
              </View>

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

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={saveInBodyMetrics}
                disabled={saving}
              >
                <Text style={styles.primaryBtnText}>
                  {saving
                    ? 'Đang lưu...'
                    : editingRecordKey
                      ? 'Cập nhật bản InBody'
                      : 'Lưu chỉ số InBody'}
                </Text>
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
        onRequestClose={() => {
          setShowGoalModal(false);
          setEditingGoalId(null);
          setGoalForm(DEFAULT_GOAL_FORM);
        }}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => {
            setShowGoalModal(false);
            setEditingGoalId(null);
            setGoalForm(DEFAULT_GOAL_FORM);
          }}
        />
        <KeyboardAvoidingView
          style={styles.sheetWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{editingGoalId ? 'Sửa goal Lean / Fat' : 'Tạo goal Lean / Fat'}</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowGoalModal(false);
                  setEditingGoalId(null);
                  setGoalForm(DEFAULT_GOAL_FORM);
                }}
              >
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
                Chọn chỉ số trên hình nộm. Giá trị hiện tại sẽ tự lấy từ bản đo mới nhất.
              </Text>

              <SegmentalMetricPicker
                title="Chọn chỉ số"
                value={goalForm.metricKey}
                onChange={(metricKey) => setGoalForm((s) => ({ ...s, metricKey }))}
                values={latestGoalMetricValues}
              />

              <Text style={styles.label}>Giá trị hiện tại (tự động)</Text>
              <View style={styles.readonlyValueCard}>
                <Text style={styles.readonlyValueText}>
                  {latestCurrentForGoal != null ? latestCurrentForGoal : 'Chưa có dữ liệu'}
                </Text>
                <Text style={styles.readonlyValueUnit}>kg</Text>
              </View>

              <Text style={styles.label}>Mục tiêu</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                value={goalForm.targetValue}
                onChangeText={(v) => setGoalForm((s) => ({ ...s, targetValue: v }))}
                placeholder="VD: 9"
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.label}>Ngày đích</Text>
              <TouchableOpacity
                style={styles.datePickerBtn}
                onPress={() => setShowGoalDatePicker(true)}
                activeOpacity={0.75}
              >
                <Text style={styles.datePickerLabel}>Ngày đích</Text>
                <Text style={styles.datePickerValue}>
                  {goalForm.targetDate ? formatDateFull(goalForm.targetDate) : 'Chọn ngày'}
                </Text>
              </TouchableOpacity>
              {showGoalDatePicker ? (
                <DateTimePicker
                  value={
                    goalForm.targetDate
                      ? new Date(`${goalForm.targetDate}T12:00:00.000Z`)
                      : new Date()
                  }
                  mode="date"
                  minimumDate={new Date()}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onGoalDatePicked}
                />
              ) : null}

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
                <Text style={styles.primaryBtnText}>
                  {saving ? 'Đang lưu...' : editingGoalId ? 'Cập nhật goal' : 'Lưu goal'}
                </Text>
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
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
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
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
  tabItemActive: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.accent,
  },
  tabText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: Colors.accent },
  tabContent: { paddingHorizontal: 20 },

  // Stat grid (2×2)
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: {
    width: '48%', backgroundColor: Colors.surface,
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border,
  },
  statCardActive: { borderColor: Colors.accent, backgroundColor: Colors.surfaceElevated },
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
  chartInner: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, minHeight: 132 },
  chartCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6, minWidth: 44 },
  chartVal: { fontSize: 10, color: Colors.textSecondary, fontWeight: '600' },
  chartBarBg: {
    width: '100%', height: 72, backgroundColor: Colors.border,
    borderRadius: 8, justifyContent: 'flex-end', overflow: 'hidden',
  },
  chartBarFill: { width: '100%', backgroundColor: Colors.accent, borderRadius: 8 },
  chartLabel: { fontSize: 10, color: Colors.textMuted },

  // Segmental card (kept for SegmentalBody component)
  segCard: {
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginBottom: 12,
  },
  segCardTitle: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  segRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
  },
  segRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  segLeft: { flex: 1 },
  segName: { fontSize: 13, fontWeight: '600', color: Colors.text },
  segRight: { alignItems: 'flex-end', gap: 4 },
  segValue: { fontSize: 14, fontWeight: '700', color: Colors.text },
  sparkRow: { flexDirection: 'row', alignItems: 'flex-end', height: 20, gap: 2, marginTop: 5 },
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

  // Goals — summary
  goalSummaryRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  goalSummaryCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 12,
    padding: 10, borderWidth: 1, borderColor: Colors.border,
  },
  goalSummaryLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 4 },
  goalSummaryVal: { fontSize: 20, fontWeight: '700' },

  // Goals — filter chips
  chipRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  chipActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '20' },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: Colors.accent },

  // Goals — cards
  goalCard: {
    backgroundColor: Colors.surface, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 10,
  },
  goalTop: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 10,
  },
  goalName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  goalDate: { fontSize: 11, color: Colors.textMuted, marginTop: 3 },
  goalTrack: {
    height: 5, backgroundColor: Colors.border,
    borderRadius: 999, overflow: 'hidden', marginBottom: 10,
  },
  goalFill: { height: '100%', backgroundColor: Colors.accent, borderRadius: 999 },
  goalFillWarn: { backgroundColor: Colors.warning },
  goalNumsRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  goalNumLabel: {
    fontSize: 10, color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2,
  },
  goalNumVal: { fontSize: 14, fontWeight: '700', color: Colors.text },
  goalGapBox: {
    backgroundColor: Colors.surfaceElevated, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center',
  },
  goalGapLabel: { fontSize: 10, color: Colors.textMuted, marginBottom: 2 },
  goalGapVal: { fontSize: 13, fontWeight: '700' },

  // (kept for possible reuse)
  goalProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
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
  historyRight: { alignItems: 'flex-end', gap: 8 },
  historyValue: { fontSize: 15, fontWeight: '700', color: Colors.accent },
  historySource: { fontSize: 11, color: Colors.textMuted, marginTop: 3 },
  editBtn: {
    borderWidth: 1, borderColor: Colors.accent,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
  },
  editBtnText: { color: Colors.accent, fontSize: 12, fontWeight: '700' },
  deleteBtn: {
    borderWidth: 1, borderColor: Colors.warning,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
  },
  deleteBtnText: { color: Colors.warning, fontSize: 12, fontWeight: '700' },

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
    textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8, marginTop: 12,
  },
  formSectionCard: {
    backgroundColor: Colors.surfaceElevated, borderWidth: 1,
    borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 12, paddingBottom: 8, marginBottom: 8,
  },
  datePickerBtn: {
    backgroundColor: Colors.surfaceElevated, borderWidth: 1,
    borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 12, marginBottom: 10,
  },
  datePickerLabel: {
    fontSize: 11, color: Colors.textMuted, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4,
  },
  datePickerValue: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  formField: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600', marginBottom: 5 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fieldInput: { flex: 1, marginBottom: 0 },
  fieldUnit: { fontSize: 12, color: Colors.textMuted, minWidth: 40 },
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
  readonlyValueCard: {
    marginBottom: 14, backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  readonlyValueText: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  readonlyValueUnit: { color: Colors.textMuted, fontSize: 12 },
});