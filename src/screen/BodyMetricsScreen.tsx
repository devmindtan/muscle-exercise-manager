import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
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
import { Activity, Calendar, Plus, ScanText, Target, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  createBodyMeasurement,
  createMuscleGoal,
  getBodyMeasurements,
  getMuscleGoals,
  getMuscleGroups,
} from '@/src/lib/repository';
import { scanInBodySheetFromImage } from '@/src/services/bodyMetricsScanner';
import { Colors } from '@/src/constants/colors';
import type { MuscleGoal, BodyMeasurement, MuscleGroup } from '@/src/types/database';

const METRIC_OPTIONS = [
  { key: 'weight', label: 'Cân nặng', unit: 'kg' },
  { key: 'skeletal_muscle_mass', label: 'SMM', unit: 'kg' },
  { key: 'body_fat_mass', label: 'Body Fat Mass', unit: 'kg' },
  { key: 'pbf', label: 'PBF', unit: '%' },
  { key: 'bmi', label: 'BMI', unit: 'BMI' },
  { key: 'waist_hip_ratio', label: 'Waist-Hip Ratio', unit: 'ratio' },
  { key: 'visceral_fat_level', label: 'Visceral Fat Level', unit: 'level' },
  { key: 'other', label: 'Khác', unit: '' },
] as const;

const DEFAULT_MEASUREMENT_FORM = {
  metricKey: 'weight',
  value: '',
  unit: 'kg',
  note: '',
};

const DEFAULT_GOAL_FORM = {
  muscleGroupId: '',
  metricKey: 'skeletal_muscle_mass',
  currentValue: '',
  targetValue: '',
  unit: 'kg',
  targetDate: '',
  note: '',
};

function formatDateLabel(value?: string | null) {
  if (!value) return 'Chưa đặt ngày';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getMetricLabel(metricKey: string) {
  return METRIC_OPTIONS.find((option) => option.key === metricKey)?.label || metricKey;
}

function getMetricUnit(metricKey: string) {
  return METRIC_OPTIONS.find((option) => option.key === metricKey)?.unit || '';
}

function getProgressPercentage(goal: MuscleGoal) {
  if (!goal.target_value || goal.target_value <= 0 || goal.current_value == null) {
    return 0;
  }

  return Math.max(0, Math.min((goal.current_value / goal.target_value) * 100, 100));
}

export default function BodyMetricsScreen() {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [goals, setGoals] = useState<MuscleGoal[]>([]);
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<string>('weight');
  const [showMeasurementModal, setShowMeasurementModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [measurementForm, setMeasurementForm] = useState(DEFAULT_MEASUREMENT_FORM);
  const [goalForm, setGoalForm] = useState(DEFAULT_GOAL_FORM);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const [measurementRows, goalRows, groupRows] = await Promise.all([
        getBodyMeasurements(undefined, 120),
        getMuscleGoals(),
        getMuscleGroups(),
      ]);

      setMeasurements(measurementRows as BodyMeasurement[]);
      setGoals(goalRows as MuscleGoal[]);
      setMuscleGroups(groupRows);
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

  const groupMap = useMemo(
    () => new Map(muscleGroups.map((group) => [group.id, group])),
    [muscleGroups],
  );

  const latestMetrics = useMemo(() => {
    const map = new Map<string, BodyMeasurement>();

    for (const measurement of measurements) {
      if (!map.has(measurement.metric_key)) {
        map.set(measurement.metric_key, measurement);
      }
    }

    return map;
  }, [measurements]);

  const selectedMetricHistory = useMemo(() => {
    return measurements
      .filter((measurement) => measurement.metric_key === selectedMetric)
      .slice(0, 6)
      .reverse();
  }, [measurements, selectedMetric]);

  const selectedMetricMax = useMemo(() => {
    return Math.max(...selectedMetricHistory.map((item) => item.value), 1);
  }, [selectedMetricHistory]);

  const prioritizedGoals = useMemo(() => {
    return [...goals]
      .filter((goal) => goal.current_value != null && goal.target_value > (goal.current_value ?? 0))
      .sort((left, right) => {
        const leftGap = left.target_value - (left.current_value ?? 0);
        const rightGap = right.target_value - (right.current_value ?? 0);
        return rightGap - leftGap;
      })
      .slice(0, 3);
  }, [goals]);

  const saveMeasurement = async () => {
    const value = Number(measurementForm.value);
    if (!Number.isFinite(value)) {
      setError('Vui lòng nhập giá trị chỉ số hợp lệ');
      return;
    }

    setSaving(true);
    setError('');
    setStatusMessage('');
    try {
      await createBodyMeasurement({
        metricKey: measurementForm.metricKey,
        value,
        unit: measurementForm.unit.trim() || getMetricUnit(measurementForm.metricKey) || 'đv',
        note: measurementForm.note.trim() || null,
        source: 'manual',
      });
      setMeasurementForm(DEFAULT_MEASUREMENT_FORM);
      setShowMeasurementModal(false);
      await load();
    } catch (saveError: any) {
      setError(saveError?.message || 'Không thể lưu chỉ số');
    } finally {
      setSaving(false);
    }
  };

  const saveGoal = async () => {
    const targetValue = Number(goalForm.targetValue);
    const currentValue = goalForm.currentValue.trim() ? Number(goalForm.currentValue) : null;

    if (!goalForm.muscleGroupId) {
      setError('Vui lòng chọn nhóm cơ cho mục tiêu');
      return;
    }

    if (!Number.isFinite(targetValue)) {
      setError('Vui lòng nhập mục tiêu hợp lệ');
      return;
    }

    if (goalForm.currentValue.trim() && !Number.isFinite(currentValue)) {
      setError('Giá trị hiện tại không hợp lệ');
      return;
    }

    const normalizedTargetDate = goalForm.targetDate.trim()
      ? new Date(goalForm.targetDate.trim()).toISOString()
      : null;

    setSaving(true);
    setError('');
    setStatusMessage('');
    try {
      await createMuscleGoal({
        muscleGroupId: goalForm.muscleGroupId,
        metricKey: goalForm.metricKey,
        currentValue,
        targetValue,
        unit: goalForm.unit.trim() || 'kg',
        targetDate: normalizedTargetDate,
        note: goalForm.note.trim() || null,
      });
      setGoalForm(DEFAULT_GOAL_FORM);
      setShowGoalModal(false);
      await load();
    } catch (saveError: any) {
      setError(saveError?.message || 'Không thể lưu mục tiêu');
    } finally {
      setSaving(false);
    }
  };

  const scanAndAutofillInBody = async () => {
    setError('');
    setStatusMessage('');

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError('Cần quyền truy cập thư viện ảnh để quét tờ chỉ số.');
        return;
      }

      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
      });

      if (picked.canceled || picked.assets.length === 0) {
        return;
      }

      setScanning(true);

      const scanResult = await scanInBodySheetFromImage(picked.assets[0].uri);

      if (scanResult.metrics.length === 0) {
        setError('Không nhận diện được chỉ số quan trọng từ ảnh. Hãy thử ảnh rõ hơn.');
        return;
      }

      for (const metric of scanResult.metrics) {
        await createBodyMeasurement({
          metricKey: metric.metricKey,
          value: metric.value,
          unit: metric.unit,
          note: `Auto scan InBody: ${metric.label}`,
          source: 'scan_inbody',
        });
      }

      setSelectedMetric(scanResult.metrics[0].metricKey);
      setStatusMessage(
        `Đã tự điền ${scanResult.metrics.length} chỉ số quan trọng từ ảnh InBody.`
      );
      await load();
    } catch (scanError: any) {
      setError(scanError?.message || 'Quét ảnh thất bại. Vui lòng thử lại hoặc nhập tay.');
      Alert.alert('Quét thất bại', scanError?.message || 'Vui lòng thử lại hoặc nhập tay.');
    } finally {
      setScanning(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.loadingText}>Đang tải chỉ số...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
          />
        }
      >
        <View style={[styles.header, { paddingTop: insets.top + 15 }]}> 
          <View>
            <Text style={styles.title}>Chỉ số cơ thể</Text>
            <Text style={styles.subtitle}>Lưu số đo, theo dõi xu hướng và đặt mục tiêu theo nhóm cơ</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerBtn} onPress={() => setShowMeasurementModal(true)}>
              <Plus color={Colors.bg} size={16} strokeWidth={2.4} />
              <Text style={styles.headerBtnText}>Thêm chỉ số</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerBtn, styles.headerBtnScan]}
              onPress={scanAndAutofillInBody}
              disabled={scanning || saving}
            >
              <ScanText color={Colors.bg} size={16} strokeWidth={2.2} />
              <Text style={styles.headerBtnText}>{scanning ? 'Đang quét...' : 'Quét InBody'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerBtn, styles.headerBtnGhost]}
              onPress={() => setShowGoalModal(true)}
            >
              <Target color={Colors.accent} size={16} strokeWidth={2.2} />
              <Text style={[styles.headerBtnText, styles.headerBtnGhostText]}>Thêm goal</Text>
            </TouchableOpacity>
          </View>
          {statusMessage ? (
            <View style={styles.statusCard}>
              <Text style={styles.statusText}>{statusMessage}</Text>
            </View>
          ) : null}
          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorCardText}>{error}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.overviewGrid}>
          {METRIC_OPTIONS.slice(0, 4).map((metric) => {
            const latest = latestMetrics.get(metric.key);
            return (
              <TouchableOpacity
                key={metric.key}
                style={[
                  styles.overviewCard,
                  selectedMetric === metric.key && styles.overviewCardActive,
                ]}
                onPress={() => setSelectedMetric(metric.key)}
              >
                <View style={styles.overviewRow}>
                  <Activity color={selectedMetric === metric.key ? Colors.accent : Colors.textMuted} size={16} strokeWidth={2} />
                  <Text style={styles.overviewLabel}>{metric.label}</Text>
                </View>
                <Text style={styles.overviewValue}>
                  {latest ? `${latest.value}${latest.unit ? ` ${latest.unit}` : ''}` : '--'}
                </Text>
                <Text style={styles.overviewHint}>
                  {latest ? `Cập nhật ${formatDateLabel(latest.measured_at)}` : 'Chưa có dữ liệu'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Xu hướng gần đây</Text>
            <Text style={styles.sectionHint}>{getMetricLabel(selectedMetric)}</Text>
          </View>
          {selectedMetricHistory.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Chưa có dữ liệu cho chỉ số này</Text>
            </View>
          ) : (
            <View style={styles.chartWrap}>
              {selectedMetricHistory.map((item) => (
                <View key={item.id} style={styles.chartCol}>
                  <Text style={styles.chartVal}>{item.value}</Text>
                  <View style={styles.chartBarBg}>
                    <View
                      style={[
                        styles.chartBarFill,
                        { height: `${Math.max((item.value / selectedMetricMax) * 100, 6)}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.chartLabel}>
                    {new Date(item.measured_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Ưu tiên tăng volume</Text>
            <Text style={styles.sectionHint}>Dựa trên khoảng cách tới goal</Text>
          </View>
          {prioritizedGoals.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Tạo goal để app bắt đầu gợi ý nhóm cơ cần ưu tiên</Text>
            </View>
          ) : (
            prioritizedGoals.map((goal) => {
              const group = groupMap.get(goal.muscle_group_id);
              const gap = Math.max(goal.target_value - (goal.current_value ?? 0), 0);
              return (
                <View key={goal.id} style={styles.priorityCard}>
                  <View style={[styles.priorityDot, { backgroundColor: group?.color || Colors.accent }]} />
                  <View style={styles.priorityInfo}>
                    <Text style={styles.priorityTitle}>{group?.name || 'Nhóm cơ'}</Text>
                    <Text style={styles.priorityText}>
                      Còn thiếu {gap.toFixed(1)} {goal.unit} để đạt mục tiêu {goal.target_value} {goal.unit}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Mục tiêu nhóm cơ</Text>
            <Text style={styles.sectionHint}>{goals.length} goal</Text>
          </View>
          {goals.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Chưa có goal nào cho nhóm cơ</Text>
            </View>
          ) : (
            goals.map((goal) => {
              const group = groupMap.get(goal.muscle_group_id);
              const progress = getProgressPercentage(goal);
              return (
                <View key={goal.id} style={styles.goalCard}>
                  <View style={styles.goalHeader}>
                    <View>
                      <Text style={styles.goalTitle}>{group?.name || 'Nhóm cơ'}</Text>
                      <Text style={styles.goalSubtitle}>{getMetricLabel(goal.metric_key)}</Text>
                    </View>
                    <View style={styles.goalDateWrap}>
                      <Calendar color={Colors.textMuted} size={12} strokeWidth={2} />
                      <Text style={styles.goalDate}>{formatDateLabel(goal.target_date)}</Text>
                    </View>
                  </View>
                  <View style={styles.goalValuesRow}>
                    <Text style={styles.goalCurrent}>{goal.current_value ?? 0} {goal.unit}</Text>
                    <Text style={styles.goalArrow}>→</Text>
                    <Text style={styles.goalTarget}>{goal.target_value} {goal.unit}</Text>
                  </View>
                  <View style={styles.goalTrack}>
                    <View style={[styles.goalFill, { width: `${progress}%`, backgroundColor: group?.color || Colors.accent }]} />
                  </View>
                  <Text style={styles.goalHint}>
                    {goal.note?.trim() || `${Math.round(progress)}% so với mục tiêu hiện tại`}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Lịch sử gần đây</Text>
            <Text style={styles.sectionHint}>{measurements.length} bản ghi</Text>
          </View>
          {measurements.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Chưa có bản ghi chỉ số nào</Text>
            </View>
          ) : (
            measurements.slice(0, 12).map((measurement) => (
              <View key={measurement.id} style={styles.historyCard}>
                <View>
                  <Text style={styles.historyTitle}>{getMetricLabel(measurement.metric_key)}</Text>
                  <Text style={styles.historyDate}>{formatDateLabel(measurement.measured_at)}</Text>
                </View>
                <View style={styles.historyRight}>
                  <Text style={styles.historyValue}>{measurement.value} {measurement.unit}</Text>
                  <Text style={styles.historySource}>{measurement.source || 'manual'}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal
        visible={showMeasurementModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMeasurementModal(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowMeasurementModal(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Thêm chỉ số cơ thể</Text>
            <TouchableOpacity onPress={() => setShowMeasurementModal(false)}>
              <X color={Colors.textSecondary} size={20} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Loại chỉ số</Text>
            <View style={styles.chipWrap}>
              {METRIC_OPTIONS.map((metric) => {
                const active = measurementForm.metricKey === metric.key;
                return (
                  <TouchableOpacity
                    key={metric.key}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() =>
                      setMeasurementForm((current) => ({
                        ...current,
                        metricKey: metric.key,
                        unit: metric.unit || current.unit,
                      }))
                    }
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{metric.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Giá trị</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={measurementForm.value}
              onChangeText={(value) => setMeasurementForm((current) => ({ ...current, value }))}
              placeholder="VD: 72.5"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.label}>Đơn vị</Text>
            <TextInput
              style={styles.input}
              value={measurementForm.unit}
              onChangeText={(unit) => setMeasurementForm((current) => ({ ...current, unit }))}
              placeholder="kg, %, BMI..."
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.label}>Ghi chú</Text>
            <TextInput
              style={[styles.input, styles.noteInput]}
              value={measurementForm.note}
              onChangeText={(note) => setMeasurementForm((current) => ({ ...current, note }))}
              placeholder="VD: Đo buổi sáng sau tập"
              placeholderTextColor={Colors.textMuted}
              multiline
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity style={styles.primaryBtn} onPress={saveMeasurement} disabled={saving}>
              <Text style={styles.primaryBtnText}>{saving ? 'Đang lưu...' : 'Lưu chỉ số'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showGoalModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGoalModal(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowGoalModal(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Tạo goal nhóm cơ</Text>
            <TouchableOpacity onPress={() => setShowGoalModal(false)}>
              <X color={Colors.textSecondary} size={20} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Nhóm cơ</Text>
            <View style={styles.chipWrap}>
              {muscleGroups.map((group) => {
                const active = goalForm.muscleGroupId === group.id;
                return (
                  <TouchableOpacity
                    key={group.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setGoalForm((current) => ({ ...current, muscleGroupId: group.id }))}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{group.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Giá trị hiện tại</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={goalForm.currentValue}
              onChangeText={(currentValue) => setGoalForm((current) => ({ ...current, currentValue }))}
              placeholder="VD: 8"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.label}>Mục tiêu</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={goalForm.targetValue}
              onChangeText={(targetValue) => setGoalForm((current) => ({ ...current, targetValue }))}
              placeholder="VD: 9"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.label}>Đơn vị</Text>
            <TextInput
              style={styles.input}
              value={goalForm.unit}
              onChangeText={(unit) => setGoalForm((current) => ({ ...current, unit }))}
              placeholder="kg"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.label}>Ngày đích (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={goalForm.targetDate}
              onChangeText={(targetDate) => setGoalForm((current) => ({ ...current, targetDate }))}
              placeholder="2026-06-30"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.label}>Ghi chú</Text>
            <TextInput
              style={[styles.input, styles.noteInput]}
              value={goalForm.note}
              onChangeText={(note) => setGoalForm((current) => ({ ...current, note }))}
              placeholder="VD: Tăng volume tay trước trong 4 tuần tới"
              placeholderTextColor={Colors.textMuted}
              multiline
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity style={styles.primaryBtn} onPress={saveGoal} disabled={saving}>
              <Text style={styles.primaryBtnText}>{saving ? 'Đang lưu...' : 'Lưu goal'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: Colors.textMuted, fontSize: 15 },
  content: { paddingBottom: 32 },
  header: { paddingHorizontal: 20, paddingBottom: 18, gap: 14 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 4, lineHeight: 20 },
  headerActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  headerBtnGhost: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerBtnScan: {
    backgroundColor: Colors.accentDim,
  },
  headerBtnText: { color: Colors.bg, fontWeight: '700', fontSize: 13 },
  headerBtnGhostText: { color: Colors.accent },
  statusCard: {
    backgroundColor: Colors.success + '20',
    borderWidth: 1,
    borderColor: Colors.success + '55',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statusText: { color: Colors.success, fontSize: 12, fontWeight: '600' },
  errorCard: {
    backgroundColor: Colors.error + '20',
    borderWidth: 1,
    borderColor: Colors.error + '55',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorCardText: { color: Colors.error, fontSize: 12, fontWeight: '600' },
  overviewGrid: {
    paddingHorizontal: 20,
    gap: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  overviewCard: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  overviewCardActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.surfaceElevated,
  },
  overviewRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  overviewLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  overviewValue: { fontSize: 24, fontWeight: '800', color: Colors.text, lineHeight: 30 },
  overviewHint: { fontSize: 11, color: Colors.textMuted, marginTop: 6 },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionHint: { fontSize: 12, color: Colors.textSecondary },
  emptyBox: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyText: { fontSize: 13, color: Colors.textMuted, lineHeight: 20 },
  chartWrap: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: 220,
  },
  chartCol: { flex: 1, alignItems: 'center', gap: 8 },
  chartVal: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  chartBarBg: {
    width: 24,
    height: 120,
    backgroundColor: Colors.border,
    borderRadius: 999,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBarFill: { width: '100%', backgroundColor: Colors.accent, borderRadius: 999 },
  chartLabel: { fontSize: 10, color: Colors.textMuted },
  priorityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  priorityDot: { width: 10, height: 10, borderRadius: 5 },
  priorityInfo: { flex: 1 },
  priorityTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  priorityText: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  goalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  goalTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  goalSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  goalDateWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  goalDate: { fontSize: 11, color: Colors.textMuted },
  goalValuesRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  goalCurrent: { fontSize: 20, fontWeight: '800', color: Colors.text },
  goalArrow: { fontSize: 16, color: Colors.textMuted },
  goalTarget: { fontSize: 18, fontWeight: '700', color: Colors.accent },
  goalTrack: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 999,
    overflow: 'hidden',
  },
  goalFill: { height: '100%', borderRadius: 999 },
  goalHint: { fontSize: 11, color: Colors.textMuted, marginTop: 8 },
  historyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  historyDate: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  historyRight: { alignItems: 'flex-end' },
  historyValue: { fontSize: 15, fontWeight: '700', color: Colors.accent },
  historySource: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    maxHeight: '80%',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  label: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  chipActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '20' },
  chipText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: Colors.accent },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
    marginBottom: 16,
  },
  noteInput: { minHeight: 88, textAlignVertical: 'top' },
  errorText: { color: Colors.error, fontSize: 13, marginBottom: 12 },
  primaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 15,
  },
  primaryBtnText: { color: Colors.bg, fontWeight: '700', fontSize: 15 },
});