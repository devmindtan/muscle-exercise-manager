import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Check,
  ChevronDown,
  X,
  Clock,
  Minus,
  Plus,
  Search,
} from 'lucide-react-native';
import {
  getMuscleGroups,
  getActiveExercises,
  getRecentLogs,
  insertWorkoutLog,
  softDeleteWorkoutLog,
} from '@/lib/repository';
import type { RecentLog } from '@/lib/repository';
import { MuscleGroup, Exercise } from '@/types/database';
import { Colors } from '@/constants/colors';
import { useSync } from '@/context/SyncContext';
import { exportDatabase } from "@/lib/db";

const PAGE_SIZE = 10;

export default function LogScreen() {
  const insets = useSafeAreaInsets();
  const { lastSyncAt } = useSync();
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGroupId, setFilterGroupId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [selectedGroup, setSelectedGroup] = useState<MuscleGroup | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(
    null,
  );
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [note, setNote] = useState('');

  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [showExPicker, setShowExPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [groups, logs] = await Promise.all([
      getMuscleGroups(),
      getRecentLogs(50),
    ]);
    setMuscleGroups(groups);
    setRecentLogs(logs);
    setVisibleCount(PAGE_SIZE);
  }, []);

  const loadExercises = useCallback(async (groupId: string) => {
    const data = await getActiveExercises(groupId);
    setExercises(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (!lastSyncAt) return;
    load();
  }, [lastSyncAt, load]);

  const selectGroup = (g: MuscleGroup) => {
    setSelectedGroup(g);
    setSelectedExercise(null);
    setShowGroupPicker(false);
    loadExercises(g.id);
  };

  const logWorkout = async () => {
    if (!selectedGroup) {
      setError('Chọn nhóm cơ');
      return;
    }
    if (!selectedExercise) {
      setError('Chọn bài tập');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await insertWorkoutLog({
        exercise_id: selectedExercise.id,
        muscle_group_id: selectedGroup.id,
        sets,
        reps: reps ? parseInt(reps) : null,
        weight: weight ? parseFloat(weight) : null,
        note: note.trim() || null,
        logged_at: new Date().toISOString(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setNote('');
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Lỗi không xác định');
    } finally {
      setSaving(false);
    }
  };

  const deleteLog = async (logId: string) => {
    await softDeleteWorkoutLog(logId);
    load();
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  };

  const filteredLogs = useMemo(() => {
    let list = recentLogs;
    if (filterGroupId) {
      list = list.filter((l) => l.muscle_group_id === filterGroupId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (l) =>
          l.exercise_name.toLowerCase().includes(q) ||
          l.muscle_group_name.toLowerCase().includes(q),
      );
    }
    return list;
  }, [recentLogs, filterGroupId, searchQuery]);

  const displayedLogs = filteredLogs.slice(0, visibleCount);
  const hasMore = visibleCount < filteredLogs.length;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
       <View style={[styles.titleRow, { paddingTop: insets.top + 15 }]}>
        <Text style={styles.title}>Ghi lại</Text>
        <TouchableOpacity style={styles.exportBtn} onPress={exportDatabase}>
          <Text style={styles.exportBtnText}>Xuất dữ liệu</Text>
        </TouchableOpacity>
      </View>

        {/* Form */}
        <View style={styles.card}>
          {/* Muscle group picker */}
          
          <Text style={styles.label}>Nhóm cơ</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => setShowGroupPicker(true)}
          >
            {selectedGroup ? (
              <View style={styles.pickerSelected}>
                <View
                  style={[
                    styles.pickerDot,
                    { backgroundColor: selectedGroup.color },
                  ]}
                />
                <Text style={styles.pickerText}>{selectedGroup.name}</Text>
              </View>
            ) : (
              <Text style={styles.pickerPlaceholder}>Chọn nhóm cơ...</Text>
            )}
            <ChevronDown color={Colors.textMuted} size={18} />
          </TouchableOpacity>

          {/* Exercise picker */}
          <Text style={styles.label}>Bài tập</Text>
          <TouchableOpacity
            style={[styles.picker, !selectedGroup && styles.pickerDisabled]}
            onPress={() => selectedGroup && setShowExPicker(true)}
          >
            {selectedExercise ? (
              <Text style={styles.pickerText}>{selectedExercise.name}</Text>
            ) : (
              <Text style={styles.pickerPlaceholder}>
                {selectedGroup ? 'Chọn bài tập...' : 'Chọn nhóm cơ trước'}
              </Text>
            )}
            <ChevronDown color={Colors.textMuted} size={18} />
          </TouchableOpacity>

          {/* Sets */}
          <Text style={styles.label}>Số sets</Text>
          <View style={styles.setsControl}>
            <TouchableOpacity
              style={styles.setsBtn}
              onPress={() => setSets((s) => Math.max(1, s - 1))}
            >
              <Minus color={Colors.text} size={18} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.setsNum}>{sets}</Text>
            <TouchableOpacity
              style={styles.setsBtn}
              onPress={() => setSets((s) => s + 1)}
            >
              <Plus color={Colors.text} size={18} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* Reps & Weight (optional) */}
          <View style={styles.optRow}>
            <View style={styles.optField}>
              <Text style={styles.label}>Reps (tuỳ chọn)</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                placeholder="VD: 10"
                placeholderTextColor={Colors.textMuted}
                value={reps}
                onChangeText={setReps}
              />
            </View>
            <View style={styles.optField}>
              <Text style={styles.label}>Tạ (kg, tuỳ chọn)</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                placeholder="VD: 60"
                placeholderTextColor={Colors.textMuted}
                value={weight}
                onChangeText={setWeight}
              />
            </View>
          </View>

          <Text style={styles.label}>Ghi chú buổi tập (tuỳ chọn)</Text>
          <TextInput
            style={[styles.input, styles.noteInput]}
            placeholder="VD: Vai hơi mỏi, giữ kỹ thuật chậm..."
            placeholderTextColor={Colors.textMuted}
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={3}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.logBtn, (saving || saved) && styles.logBtnDone]}
            onPress={logWorkout}
            disabled={saving || saved}
          >
            {saved ? (
              <>
                <Check color={Colors.bg} size={18} strokeWidth={2.5} />
                <Text style={styles.logBtnText}>Đã ghi!</Text>
              </>
            ) : (
              <Text style={styles.logBtnText}>
                {saving ? 'Đang lưu...' : 'Ghi lại workout'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Recent logs */}
        {recentLogs.length > 0 && (
          <>
            <View style={styles.recentHeader}>
              <Text style={styles.sectionTitle}>Gần đây</Text>
            </View>

            {/* Search bar */}
            <View style={styles.searchBar}>
              <Search color={Colors.textMuted} size={16} strokeWidth={1.8} />
              <TextInput
                style={styles.searchInput}
                placeholder="Tìm bài tập, nhóm cơ..."
                placeholderTextColor={Colors.textMuted}
                value={searchQuery}
                onChangeText={(t) => {
                  setSearchQuery(t);
                  setVisibleCount(PAGE_SIZE);
                }}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X color={Colors.textMuted} size={16} />
                </TouchableOpacity>
              )}
            </View>

            {/* Filter chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  !filterGroupId && styles.filterChipActive,
                ]}
                onPress={() => {
                  setFilterGroupId(null);
                  setVisibleCount(PAGE_SIZE);
                }}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    !filterGroupId && styles.filterChipTextActive,
                  ]}
                >
                  Tất cả
                </Text>
              </TouchableOpacity>
              {muscleGroups.map((g) => (
                <TouchableOpacity
                  key={g.id}
                  style={[
                    styles.filterChip,
                    filterGroupId === g.id && styles.filterChipActive,
                    filterGroupId === g.id && { borderColor: g.color },
                  ]}
                  onPress={() => {
                    setFilterGroupId(filterGroupId === g.id ? null : g.id);
                    setVisibleCount(PAGE_SIZE);
                  }}
                >
                  <View
                    style={[styles.filterDot, { backgroundColor: g.color }]}
                  />
                  <Text
                    style={[
                      styles.filterChipText,
                      filterGroupId === g.id && styles.filterChipTextActive,
                    ]}
                  >
                    {g.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {displayedLogs.length === 0 ? (
              <Text style={styles.noResults}>Không tìm thấy kết quả</Text>
            ) : null}

            {displayedLogs.map((log) => (
              <View key={log.id} style={styles.logRow}>
                <View
                  style={[
                    styles.logDot,
                    { backgroundColor: log.muscle_group_color },
                  ]}
                />
                <View style={styles.logInfo}>
                  <Text style={styles.logExName}>{log.exercise_name}</Text>
                  <Text style={styles.logMeta}>
                    {log.muscle_group_name} · {log.sets} sets
                    {log.reps ? ` × ${log.reps} reps` : ''}
                    {log.weight ? ` · ${log.weight}kg` : ''}
                  </Text>
                  {log.note ? (
                    <Text style={styles.logNote}>{log.note}</Text>
                  ) : null}
                  <View style={styles.logTime}>
                    <Clock
                      color={Colors.textMuted}
                      size={11}
                      strokeWidth={1.5}
                    />
                    <Text style={styles.logTimeText}>
                      {formatTime(log.logged_at)}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => deleteLog(log.id)}
                  style={styles.delBtn}
                >
                  <X color={Colors.textMuted} size={16} strokeWidth={1.8} />
                </TouchableOpacity>
              </View>
            ))}

            {hasMore && (
              <TouchableOpacity
                style={styles.loadMoreBtn}
                onPress={() => setVisibleCount((v) => v + PAGE_SIZE)}
              >
                <Text style={styles.loadMoreText}>
                  Xem thêm ({filteredLogs.length - visibleCount} mục)
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      {/* Group picker modal */}
      <Modal
        visible={showGroupPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGroupPicker(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setShowGroupPicker(false)}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Chọn nhóm cơ</Text>
          {muscleGroups.map((g) => (
            <TouchableOpacity
              key={g.id}
              style={styles.optionRow}
              onPress={() => selectGroup(g)}
            >
              <View style={[styles.optionDot, { backgroundColor: g.color }]} />
              <Text style={styles.optionText}>{g.name}</Text>
              {selectedGroup?.id === g.id && (
                <Check color={Colors.accent} size={18} />
              )}
            </TouchableOpacity>
          ))}
          {muscleGroups.length === 0 && (
            <Text style={styles.noData}>Chưa có nhóm cơ nào</Text>
          )}
        </View>
      </Modal>

      {/* Exercise picker modal */}
      <Modal
        visible={showExPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowExPicker(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setShowExPicker(false)}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Chọn bài tập</Text>
          {exercises.map((ex) => (
            <TouchableOpacity
              key={ex.id}
              style={styles.optionRow}
              onPress={() => {
                setSelectedExercise(ex);
                setShowExPicker(false);
              }}
            >
              <Text style={styles.optionText}>{ex.name}</Text>
              {selectedExercise?.id === ex.id && (
                <Check color={Colors.accent} size={18} />
              )}
            </TouchableOpacity>
          ))}
          {exercises.length === 0 && (
            <Text style={styles.noData}>Nhóm cơ này chưa có bài tập</Text>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingBottom: 48 },
  card: {
    marginHorizontal: 20,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 24,
  },

  label: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 8,
  },

  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  pickerDisabled: { opacity: 0.4 },
  pickerSelected: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pickerDot: { width: 8, height: 8, borderRadius: 4 },
  pickerText: { fontSize: 15, color: Colors.text, fontWeight: '500' },
  pickerPlaceholder: { fontSize: 14, color: Colors.textMuted },

  setsControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 16,
  },
  setsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setsNum: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    minWidth: 40,
    textAlign: 'center',
  },

  optRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  optField: { flex: 1 },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
    color: Colors.text,
    fontSize: 15,
  },
  noteInput: { textAlignVertical: 'top', minHeight: 80, marginBottom: 8 },

  errorText: {
    color: Colors.error,
    fontSize: 13,
    marginBottom: 12,
    marginTop: 4,
  },

  logBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  logBtnDone: { backgroundColor: Colors.success },
  logBtnText: { fontSize: 16, fontWeight: '700', color: Colors.bg },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    marginHorizontal: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14 },
  filterRow: {
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  filterChipActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.surfaceElevated,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterChipTextActive: { color: Colors.accent },
  filterDot: { width: 6, height: 6, borderRadius: 3 },
  noResults: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: 13,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  loadMoreBtn: {
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  loadMoreText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },

  logRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 20,
    marginBottom: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  logDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    marginRight: 12,
  },
  logInfo: { flex: 1 },
  logExName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  logMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  logNote: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 6,
    lineHeight: 17,
  },
  logTime: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  logTimeText: { fontSize: 11, color: Colors.textMuted },
  delBtn: { padding: 4 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  optionDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  optionText: { flex: 1, fontSize: 15, color: Colors.text },
  noData: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  titleRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: 20,
  paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  exportBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  exportBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
