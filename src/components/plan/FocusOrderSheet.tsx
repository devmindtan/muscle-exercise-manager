import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Pressable, TextInput } from 'react-native';
import { X, ChevronUp, ChevronDown, ArrowUpDown, GripVertical, Clock } from 'lucide-react-native';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { Colors } from '@/src/constants/colors';
import { getGroupTone } from '@/src/lib/planTone';
import { updateExercise } from '@/src/lib/repository';
import { upsertWeeklyPlanEntries, WeeklyPlanEntry } from '@/src/services/weeklyPlanService';
import { Exercise } from '@/src/types/database';
import { ExerciseThumb } from '@/src/components/plan/ExerciseThumb';

const ROW_HEIGHT = 70;
const DEFAULT_PREP_SECONDS = 120;

interface FocusOrderSheetProps {
  visible: boolean;
  dayLabel: string;
  entries: WeeklyPlanEntry[];
  exerciseById: Record<string, Exercise>;
  muscleNameById: Record<string, string>;
  colorByMuscle: Record<string, ReturnType<typeof getGroupTone>>;
  userKey: string;
  activePlanId: string | null;
  onClose: () => void;
  onSaved: (nextPlans: WeeklyPlanEntry[]) => void;
  onExerciseUpdated: () => void;
}

// Thứ tự tập trong Focus Mode chạy theo sortOrder xuyên suốt cả ngày, không
// phân biệt nhóm cơ (FocusModeScreen.sortEntriesForFocus không còn ưu tiên
// nhóm theo muscleGroupId trước) — sheet này là nơi DUY NHẤT người dùng chủ
// động chỉnh sortOrder, nên mỗi lần đổi vị trí sẽ đánh số lại toàn bộ danh
// sách của ngày đó (0..N-1) và lưu ngay.
function sortForDisplay(entries: WeeklyPlanEntry[]): WeeklyPlanEntry[] {
  return [...entries].sort((a, b) => {
    const aHas = a.sortOrder != null;
    const bHas = b.sortOrder != null;
    if (aHas && bHas) return (a.sortOrder as number) - (b.sortOrder as number);
    if (aHas !== bHas) return aHas ? -1 : 1;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

interface OrderRowProps {
  entry: WeeklyPlanEntry;
  index: number;
  total: number;
  ex: Exercise | null;
  tone: ReturnType<typeof getGroupTone>;
  muscleLabel: string;
  isDragging: boolean;
  showDropLineAbove: boolean;
  disabled: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: () => void;
  onDragUpdate: (translationY: number) => void;
  onDragEnd: () => void;
  onPrepSecondsCommit: (value: number | null) => void;
}

// Kéo-thả: chỉ giữ ở tay cầm (GripVertical) — kéo không làm reorder liên tục
// giữa chừng (tránh phải bù trừ vị trí phức tạp khi mảng đổi ngay trong lúc
// kéo), chỉ hiện 1 đường chỉ báo sẽ thả vào đâu, thật sự đổi thứ tự + lưu khi
// thả tay. Mũi tên ▲▼ vẫn giữ song song — đáng tin cậy hơn trên mọi nền tảng.
function OrderRow({
  entry,
  index,
  total,
  ex,
  tone,
  muscleLabel,
  isDragging,
  showDropLineAbove,
  disabled,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragUpdate,
  onDragEnd,
  onPrepSecondsCommit,
}: OrderRowProps) {
  const translateY = useSharedValue(0);
  const [prepText, setPrepText] = useState(ex?.prep_seconds != null ? String(ex.prep_seconds) : '');

  useEffect(() => {
    setPrepText(ex?.prep_seconds != null ? String(ex.prep_seconds) : '');
  }, [ex?.id, ex?.prep_seconds]);

  useEffect(() => {
    if (!isDragging) translateY.value = withSpring(0, { damping: 22, stiffness: 280 });
  }, [isDragging, translateY]);

  const pan = Gesture.Pan()
    .onStart(() => {
      runOnJS(onDragStart)();
    })
    .onUpdate((event) => {
      translateY.value = event.translationY;
      runOnJS(onDragUpdate)(event.translationY);
    })
    .onEnd(() => {
      runOnJS(onDragEnd)();
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    zIndex: isDragging ? 10 : 0,
    opacity: isDragging ? 0.95 : 1,
    shadowOpacity: isDragging ? 0.35 : 0,
    shadowRadius: 8,
    shadowColor: '#000',
    elevation: isDragging ? 6 : 0,
  }));

  return (
    <View>
      {showDropLineAbove && <View style={styles.dropLine} />}
      <Animated.View style={[styles.row, animatedStyle]}>
        <Text style={styles.rowIndex}>{index + 1}</Text>
        {ex ? (
          <ExerciseThumb ex={ex} tone={tone} size={30} />
        ) : (
          <View style={[styles.dot, { backgroundColor: tone.bar }]} />
        )}
        <View style={styles.rowInfo}>
          <Text style={styles.rowName} numberOfLines={1}>
            {ex?.name ?? 'Chưa chọn bài tập'}
          </Text>
          <Text style={styles.rowMuscle} numberOfLines={1}>
            {muscleLabel} · {entry.sets} sets
          </Text>
          {ex && (
            <View style={styles.prepRow}>
              <Clock size={11} color={Colors.textMuted} strokeWidth={2} />
              <TextInput
                style={styles.prepInput}
                keyboardType="number-pad"
                value={prepText}
                onChangeText={setPrepText}
                onBlur={() => {
                  const parsed = Number(prepText);
                  onPrepSecondsCommit(prepText.trim() && Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null);
                }}
                placeholder={String(DEFAULT_PREP_SECONDS)}
                placeholderTextColor={Colors.textMuted}
                selectTextOnFocus
              />
              <Text style={styles.prepUnit}>s chuẩn bị đổi bài</Text>
            </View>
          )}
        </View>
        <View style={styles.arrowCol}>
          <TouchableOpacity onPress={onMoveUp} disabled={index === 0 || disabled} hitSlop={6}>
            <ChevronUp size={16} color={index === 0 ? Colors.border : Colors.textMuted} strokeWidth={2.2} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onMoveDown} disabled={index === total - 1 || disabled} hitSlop={6}>
            <ChevronDown size={16} color={index === total - 1 ? Colors.border : Colors.textMuted} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
        <GestureDetector gesture={pan}>
          <View style={styles.dragHandle} hitSlop={8}>
            <GripVertical size={18} color={Colors.textMuted} strokeWidth={2} />
          </View>
        </GestureDetector>
      </Animated.View>
    </View>
  );
}

export function FocusOrderSheet({
  visible,
  dayLabel,
  entries,
  exerciseById,
  muscleNameById,
  colorByMuscle,
  userKey,
  activePlanId,
  onClose,
  onSaved,
  onExerciseUpdated,
}: FocusOrderSheetProps) {
  const [order, setOrder] = useState<WeeklyPlanEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const dragStartIndexRef = useRef(0);

  const commitPrepSeconds = async (exerciseId: string, value: number | null) => {
    await updateExercise(exerciseId, { prep_seconds: value });
    onExerciseUpdated();
  };

  useEffect(() => {
    if (visible) setOrder(sortForDisplay(entries));
  }, [visible, entries]);

  const persist = async (nextOrder: WeeklyPlanEntry[]) => {
    setSaving(true);
    try {
      const inputs = nextOrder.map((entry, idx) => ({
        id: entry.id,
        dayKey: entry.dayKey,
        muscleGroupId: entry.muscleGroupId,
        exerciseId: entry.exerciseId,
        sets: entry.sets,
        reps: entry.reps,
        sortOrder: idx,
        note: entry.note,
      }));
      const nextPlans = await upsertWeeklyPlanEntries(inputs, userKey, activePlanId);
      onSaved(nextPlans);
    } finally {
      setSaving(false);
    }
  };

  const move = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= order.length) return;
    const next = [...order];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    setOrder(next);
    void persist(next);
  };

  const handleDragStart = (entryId: string) => {
    const idx = order.findIndex((e) => e.id === entryId);
    dragStartIndexRef.current = idx;
    setDraggingId(entryId);
    setHoverIndex(idx);
  };

  const handleDragUpdate = (translationY: number) => {
    const delta = Math.round(translationY / ROW_HEIGHT);
    const next = Math.max(0, Math.min(order.length - 1, dragStartIndexRef.current + delta));
    setHoverIndex((prev) => (prev === next ? prev : next));
  };

  const handleDragEnd = (entryId: string) => {
    setDraggingId(null);
    const from = order.findIndex((e) => e.id === entryId);
    const to = hoverIndex ?? from;
    setHoverIndex(null);
    if (from === -1 || from === to) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setOrder(next);
    void persist(next);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.gestureRoot}>
        <Pressable style={styles.overlay} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <ArrowUpDown color={Colors.text} size={18} strokeWidth={2.2} />
              <Text style={styles.title}>Thứ tự tập — {dayLabel}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <X color={Colors.textSecondary} size={20} strokeWidth={2} />
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>
            Đây là thứ tự Focus Mode sẽ chạy qua — kéo tay cầm hoặc bấm mũi tên để đổi, không phân biệt nhóm cơ.
          </Text>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false} scrollEnabled={!draggingId}>
            {order.map((entry, idx) => {
              const ex = entry.exerciseId ? exerciseById[entry.exerciseId] : null;
              const tone = colorByMuscle[entry.muscleGroupId] ?? getGroupTone();
              const isDragging = draggingId === entry.id;
              return (
                <OrderRow
                  key={entry.id}
                  entry={entry}
                  index={idx}
                  total={order.length}
                  ex={ex}
                  tone={tone}
                  muscleLabel={muscleNameById[entry.muscleGroupId] ?? ''}
                  isDragging={isDragging}
                  showDropLineAbove={hoverIndex === idx && !isDragging}
                  disabled={saving}
                  onMoveUp={() => move(idx, 'up')}
                  onMoveDown={() => move(idx, 'down')}
                  onDragStart={() => handleDragStart(entry.id)}
                  onDragUpdate={handleDragUpdate}
                  onDragEnd={() => handleDragEnd(entry.id)}
                  onPrepSecondsCommit={(value) => ex && void commitPrepSeconds(ex.id, value)}
                />
              );
            })}
            {hoverIndex === order.length && <View style={styles.dropLine} />}
          </ScrollView>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  gestureRoot: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '75%',
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 6, marginBottom: 12 },
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  rowIndex: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, width: 16, textAlign: 'center' },
  dot: { width: 30, height: 30, borderRadius: 8 },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  rowMuscle: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  prepRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  prepInput: {
    width: 36, fontSize: 11, color: Colors.text, fontWeight: '600',
    borderWidth: 1, borderColor: Colors.border, borderRadius: 6,
    paddingHorizontal: 4, paddingVertical: 1, backgroundColor: Colors.surfaceElevated,
  },
  prepUnit: { fontSize: 10, color: Colors.textMuted },
  arrowCol: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  dragHandle: { paddingHorizontal: 4, paddingVertical: 10 },
  dropLine: { height: 3, borderRadius: 2, backgroundColor: Colors.accent, marginBottom: 5, marginHorizontal: 2 },
});
