import { useCallback, useMemo, useState } from 'react';
import {
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
import { CalendarDays, Pencil, Plus, Trash2, X } from 'lucide-react-native';
import { getMuscleGroups } from '@/src/lib/repository';
import { Colors } from '@/src/constants/colors';
import { useAuth } from '@/src/context/AuthContext';
import {
  deleteWeeklyPlanEntry,
  getWeeklyPlanEntries,
  upsertWeeklyPlanEntry,
  WEEK_DAYS,
  WeekDayKey,
  WeeklyPlanEntry,
} from '@/src/services/weeklyPlanService';
import { MuscleGroup } from '@/src/types/database';

type MuscleGroupWithCount = MuscleGroup & { exercise_count?: number };

const DAY_LABEL_MAP: Record<WeekDayKey, string> = WEEK_DAYS.reduce((acc, day) => {
  acc[day.key] = day.label;
  return acc;
}, {} as Record<WeekDayKey, string>);

const DAY_ORDER_MAP: Record<WeekDayKey, number> = WEEK_DAYS.reduce((acc, day) => {
  acc[day.key] = day.order;
  return acc;
}, {} as Record<WeekDayKey, number>);

function sortPlans(plans: WeeklyPlanEntry[]) {
  return [...plans].sort((a, b) => {
    const orderDiff = DAY_ORDER_MAP[a.dayKey] - DAY_ORDER_MAP[b.dayKey];
    if (orderDiff !== 0) return orderDiff;
    if (a.muscleGroupId !== b.muscleGroupId) {
      return a.muscleGroupId.localeCompare(b.muscleGroupId);
    }
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export default function WeeklyPlanScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userKey = user?.id || 'guest';

  const [groups, setGroups] = useState<MuscleGroupWithCount[]>([]);
  const [plans, setPlans] = useState<WeeklyPlanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedDay, setSelectedDay] = useState<WeekDayKey | 'all'>('all');
  const [selectedMuscleId, setSelectedMuscleId] = useState<string>('all');

  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    dayKey: 'mon' as WeekDayKey,
    muscleGroupId: '',
    sets: '10',
    note: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [nextGroups, nextPlans] = await Promise.all([
      getMuscleGroups() as Promise<MuscleGroupWithCount[]>,
      getWeeklyPlanEntries(userKey),
    ]);

    setGroups(nextGroups);
    setPlans(sortPlans(nextPlans));

    if (!form.muscleGroupId && nextGroups.length > 0) {
      setForm((prev) => ({ ...prev, muscleGroupId: nextGroups[0].id }));
    }
  }, [form.muscleGroupId, userKey]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filteredPlans = useMemo(() => {
    return plans.filter((entry) => {
      const byDay = selectedDay === 'all' ? true : entry.dayKey === selectedDay;
      const byMuscle = selectedMuscleId === 'all' ? true : entry.muscleGroupId === selectedMuscleId;
      return byDay && byMuscle;
    });
  }, [plans, selectedDay, selectedMuscleId]);

  const muscleNameById = useMemo(() => {
    return groups.reduce<Record<string, string>>((acc, group) => {
      acc[group.id] = group.name;
      return acc;
    }, {});
  }, [groups]);

  const totalWeeklySets = useMemo(() => {
    return plans.reduce((sum, entry) => sum + entry.sets, 0);
  }, [plans]);

  const openCreate = () => {
    setEditingId(null);
    setError('');
    setForm((prev) => ({
      dayKey: prev.dayKey || 'mon',
      muscleGroupId: groups[0]?.id || '',
      sets: '10',
      note: '',
    }));
    setShowEditor(true);
  };

  const openEdit = (entry: WeeklyPlanEntry) => {
    setEditingId(entry.id);
    setError('');
    setForm({
      dayKey: entry.dayKey,
      muscleGroupId: entry.muscleGroupId,
      sets: String(entry.sets),
      note: entry.note || '',
    });
    setShowEditor(true);
  };

  const submit = async () => {
    if (!form.muscleGroupId) {
      setError('Vui lòng chọn nhóm cơ.');
      return;
    }

    const setsNumber = Number(form.sets);
    if (!Number.isFinite(setsNumber) || setsNumber <= 0) {
      setError('Sets cần là số lớn hơn 0.');
      return;
    }

    setSaving(true);
    try {
      const nextPlans = await upsertWeeklyPlanEntry(
        {
          id: editingId || undefined,
          dayKey: form.dayKey,
          muscleGroupId: form.muscleGroupId,
          sets: setsNumber,
          note: form.note,
        },
        userKey,
      );
      setPlans(sortPlans(nextPlans));
      setShowEditor(false);
      setEditingId(null);
    } catch {
      setError('Không thể lưu kế hoạch. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const nextPlans = await deleteWeeklyPlanEntry(id, userKey);
    setPlans(sortPlans(nextPlans));
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.loadingText}>Đang tải kế hoạch...</Text>
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
            <Text style={styles.title}>Kế hoạch tuần</Text>
            <Text style={styles.subtitle}>Chỉ để theo dõi. Bạn vẫn tập linh hoạt theo thực tế.</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
            <Plus color={Colors.bg} size={18} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryIconWrap}>
            <CalendarDays color={Colors.accent} size={16} strokeWidth={2} />
          </View>
          <View style={styles.summaryBody}>
            <Text style={styles.summaryLabel}>Tổng khối lượng kế hoạch</Text>
            <Text style={styles.summaryValue}>{plans.length} mục · {totalWeeklySets} sets/tuần</Text>
          </View>
        </View>

        <View style={styles.filterSection}>
          <Text style={styles.filterTitle}>Lọc theo ngày</Text>
          <View style={styles.filterWrap}>
            <TouchableOpacity
              style={[styles.chip, selectedDay === 'all' && styles.chipActive]}
              onPress={() => setSelectedDay('all')}
            >
              <Text style={[styles.chipText, selectedDay === 'all' && styles.chipTextActive]}>Tất cả</Text>
            </TouchableOpacity>
            {WEEK_DAYS.map((day) => (
              <TouchableOpacity
                key={day.key}
                style={[styles.chip, selectedDay === day.key && styles.chipActive]}
                onPress={() => setSelectedDay(day.key)}
              >
                <Text style={[styles.chipText, selectedDay === day.key && styles.chipTextActive]}>{day.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.filterSection}>
          <Text style={styles.filterTitle}>Lọc theo nhóm cơ</Text>
          <View style={styles.filterWrap}>
            <TouchableOpacity
              style={[styles.chip, selectedMuscleId === 'all' && styles.chipActive]}
              onPress={() => setSelectedMuscleId('all')}
            >
              <Text style={[styles.chipText, selectedMuscleId === 'all' && styles.chipTextActive]}>Tất cả</Text>
            </TouchableOpacity>
            {groups.map((group) => (
              <TouchableOpacity
                key={group.id}
                style={[styles.chip, selectedMuscleId === group.id && styles.chipActive]}
                onPress={() => setSelectedMuscleId(group.id)}
              >
                <Text style={[styles.chipText, selectedMuscleId === group.id && styles.chipTextActive]}>{group.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {groups.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Chưa có nhóm cơ</Text>
            <Text style={styles.emptyText}>Vào tab Nhóm cơ để tạo nhóm cơ trước khi lập kế hoạch tuần.</Text>
          </View>
        ) : filteredPlans.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Chưa có mục kế hoạch phù hợp</Text>
            <Text style={styles.emptyText}>Hãy tạo kế hoạch hoặc thay đổi bộ lọc để xem dữ liệu.</Text>
          </View>
        ) : (
          filteredPlans.map((entry) => (
            <View key={entry.id} style={styles.planCard}>
              <View style={styles.planTopRow}>
                <View>
                  <Text style={styles.planDay}>{DAY_LABEL_MAP[entry.dayKey]}</Text>
                  <Text style={styles.planMuscle}>{muscleNameById[entry.muscleGroupId] || 'Nhóm cơ đã xoá'}</Text>
                </View>
                <View style={styles.setBadge}>
                  <Text style={styles.setBadgeText}>{entry.sets} sets</Text>
                </View>
              </View>

              {entry.note ? <Text style={styles.planNote}>{entry.note}</Text> : null}

              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(entry)}>
                  <Pencil color={Colors.textSecondary} size={14} strokeWidth={2} />
                  <Text style={styles.actionText}>Sửa</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => remove(entry.id)}>
                  <Trash2 color={Colors.error} size={14} strokeWidth={2} />
                  <Text style={[styles.actionText, styles.actionDeleteText]}>Xoá</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={showEditor}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditor(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowEditor(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{editingId ? 'Sửa kế hoạch' : 'Thêm kế hoạch'}</Text>
            <TouchableOpacity onPress={() => setShowEditor(false)}>
              <X color={Colors.textSecondary} size={20} />
            </TouchableOpacity>
          </View>

          <Text style={styles.inputLabel}>Ngày tập</Text>
          <View style={styles.filterWrap}>
            {WEEK_DAYS.map((day) => (
              <TouchableOpacity
                key={day.key}
                style={[styles.chip, form.dayKey === day.key && styles.chipActive]}
                onPress={() => setForm((prev) => ({ ...prev, dayKey: day.key }))}
              >
                <Text style={[styles.chipText, form.dayKey === day.key && styles.chipTextActive]}>{day.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.inputLabel}>Nhóm cơ</Text>
          <View style={styles.filterWrap}>
            {groups.map((group) => (
              <TouchableOpacity
                key={group.id}
                style={[styles.chip, form.muscleGroupId === group.id && styles.chipActive]}
                onPress={() => setForm((prev) => ({ ...prev, muscleGroupId: group.id }))}
              >
                <Text style={[styles.chipText, form.muscleGroupId === group.id && styles.chipTextActive]}>{group.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.inputLabel}>Số sets</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={form.sets}
            onChangeText={(text) => setForm((prev) => ({ ...prev, sets: text }))}
            placeholder="VD: 12"
            placeholderTextColor={Colors.textMuted}
          />

          <Text style={styles.inputLabel}>Ghi chú (tuỳ chọn)</Text>
          <TextInput
            style={[styles.input, styles.noteInput]}
            multiline
            value={form.note}
            onChangeText={(text) => setForm((prev) => ({ ...prev, note: text }))}
            placeholder="VD: ưu tiên volume vừa, giữ kỹ thuật"
            placeholderTextColor={Colors.textMuted}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={submit}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Đang lưu...' : 'Lưu kế hoạch'}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 15, color: Colors.textMuted },
  content: { paddingBottom: 36 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
    maxWidth: 260,
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryBody: { flex: 1 },
  summaryLabel: { fontSize: 12, color: Colors.textSecondary },
  summaryValue: { fontSize: 15, fontWeight: '700', color: Colors.text },
  filterSection: {
    marginHorizontal: 20,
    marginBottom: 14,
  },
  filterTitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 8,
    fontWeight: '600',
  },
  filterWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent + '1f',
  },
  chipText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: Colors.accent,
    fontWeight: '700',
  },
  emptyBox: {
    marginHorizontal: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  planCard: {
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: 14,
  },
  planTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  planDay: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  planMuscle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  setBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: Colors.accent + '1f',
    borderWidth: 1,
    borderColor: Colors.accent + '50',
  },
  setBadgeText: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  planNote: {
    marginTop: 8,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  actionsRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  actionDeleteText: { color: Colors.error },
  overlay: {
    flex: 1,
    backgroundColor: '#00000088',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 18,
    maxHeight: '85%',
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: Colors.textMuted,
    alignSelf: 'center',
    marginBottom: 12,
    opacity: 0.4,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  inputLabel: {
    color: Colors.textSecondary,
    marginBottom: 8,
    marginTop: 10,
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: Colors.surfaceElevated,
    color: Colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  noteInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  errorText: {
    marginTop: 10,
    color: Colors.error,
    fontSize: 12,
  },
  saveBtn: {
    marginTop: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: Colors.accent,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: Colors.bg,
    fontWeight: '700',
    fontSize: 14,
  },
});
