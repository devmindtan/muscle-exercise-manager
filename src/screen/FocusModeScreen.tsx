import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Minus, Plus, Pause, Play, SkipForward, Dumbbell, Trophy } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer } from 'expo-audio';
import { useKeepAwake } from 'expo-keep-awake';
import { useAuth } from '@/src/context/AuthContext';
import {
  getExercises,
  getWorkoutLogs,
  insertWorkoutLog,
  getExercisePersonalRecord,
  getMuscleGroups,
} from '@/src/lib/repository';
import { getGroupTone } from '@/src/lib/planTone';
import { ExerciseThumb } from '@/src/components/plan/ExerciseThumb';
import { ExercisePickerSheet } from '@/src/components/plan/ExercisePickerSheet';
import { ExerciseInfoModal } from '@/src/components/plan/ExerciseInfoModal';
import { getWeeklyPlanEntries, getWorkoutPlans, WeeklyPlanEntry } from '@/src/services/weeklyPlanService';
import { Exercise, MuscleGroup } from '@/src/types/database';

// Reuse cùng bảng màu "gym scoreboard" với WeeklyPlanScreen để 2 màn hình
// (điểm vào + phiên tập) cảm giác cùng 1 hệ thống thị giác.
const INK = '#0E1210';
const INK_RAISED = '#161C19';
const CHALK = '#F3F6EF';
const LIME = '#D6FF3F';
const HAIRLINE = 'rgba(243,246,239,0.10)';

const DEFAULT_REST_SECONDS = 90;
const DEFAULT_PREP_SECONDS = 120;

type SetStep = {
  entry: WeeklyPlanEntry;
  // null khi ô kế hoạch chỉ chọn theo nhóm cơ, chưa gắn bài tập cụ thể —
  // Focus Mode vẫn chạy bình thường, người tập có thể chọn bài ngay tại màn
  // ghi nhanh (xem resolvedExerciseByEntryId).
  exercise: Exercise | null;
  setIndex: number;
  totalSets: number;
};

function sortEntriesForFocus(entries: WeeklyPlanEntry[]): WeeklyPlanEntry[] {
  // Cùng tiêu chí với sortPlans() trong WeeklyPlanScreen.tsx: nhóm cơ trước
  // (thứ tự "tình cờ" theo UUID, chấp nhận là giới hạn MVP), rồi trong cùng
  // 1 nhóm cơ ưu tiên sort_order (gán lúc lưu kế hoạch), fallback createdAt.
  return [...entries].sort((a, b) => {
    if (a.muscleGroupId !== b.muscleGroupId) return a.muscleGroupId.localeCompare(b.muscleGroupId);
    const aHas = a.sortOrder != null;
    const bHas = b.sortOrder != null;
    if (aHas && bHas) return (a.sortOrder as number) - (b.sortOrder as number);
    if (aHas !== bHas) return aHas ? -1 : 1;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m} phút ${s.toString().padStart(2, '0')} giây`;
}

type Phase = 'exercise' | 'logging' | 'resting' | 'prepping' | 'complete';

export default function FocusModeScreen() {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const { dayKey } = useLocalSearchParams<{ dayKey: string }>();
  const { user } = useAuth();
  const userKey = user?.id || 'guest';
  const player = useAudioPlayer(require('../../assets/sounds/focus-alert.m4a'));

  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<SetStep[]>([]);
  const [muscleNameById, setMuscleNameById] = useState<Record<string, string>>({});
  const [exerciseById, setExerciseById] = useState<Record<string, Exercise>>({});

  // Bài tập người dùng tự chọn ngay trong phiên, cho các ô kế hoạch chỉ chọn
  // theo nhóm cơ (không có exerciseId) — key là entry.id, áp dụng cho mọi set
  // của entry đó trong phiên này, không ghi ngược lại kế hoạch đã lưu.
  const [resolvedExerciseByEntryId, setResolvedExerciseByEntryId] = useState<Record<string, Exercise>>({});
  const [pickerForEntryId, setPickerForEntryId] = useState<string | null>(null);
  const [exercisePR, setExercisePR] = useState<{ bestReps: number | null; bestWeight: number | null } | null>(null);
  const [infoModalExercise, setInfoModalExercise] = useState<Exercise | null>(null);

  const [phase, setPhase] = useState<Phase>('exercise');
  const [stepIndex, setStepIndex] = useState(0);
  const stepIndexRef = useRef(0);
  useEffect(() => { stepIndexRef.current = stepIndex; }, [stepIndex]);

  const [totalLoggedSets, setTotalLoggedSets] = useState(0);
  const [sessionStartAt] = useState(() => Date.now());

  const [logReps, setLogReps] = useState('');
  const [logWeight, setLogWeight] = useState('');
  const [logNote, setLogNote] = useState('');
  const [saving, setSaving] = useState(false);

  const [countEndAt, setCountEndAt] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [pauseRemainingMs, setPauseRemainingMs] = useState<number | null>(null);
  const finishedRef = useRef(false);
  const lastLogCacheRef = useRef<Record<string, { reps: number | null; weight: number | null } | null>>({});

  // ── Load hàng đợi của ngày ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [groups, plans, allExercises] = await Promise.all([
        getMuscleGroups() as Promise<MuscleGroup[]>,
        getWorkoutPlans(userKey),
        getExercises() as Promise<Exercise[]>,
      ]);
      const active = plans.find((p) => p.isActive) ?? plans[0] ?? null;
      const entries = await getWeeklyPlanEntries(userKey, active?.id ?? null);
      const exMap = allExercises.reduce<Record<string, Exercise>>((acc, ex) => { acc[ex.id] = ex; return acc; }, {});

      // Giữ cả entry chỉ-theo-nhóm-cơ (exerciseId null) — Focus Mode vẫn chạy
      // được, người tập chọn bài cụ thể (hoặc bỏ qua) ngay tại màn ghi nhanh.
      const dayEntries = entries.filter((e) => e.dayKey === dayKey);
      const sorted = sortEntriesForFocus(dayEntries);

      const nextQueue: SetStep[] = [];
      sorted.forEach((entry) => {
        const exercise = entry.exerciseId ? exMap[entry.exerciseId] ?? null : null;
        const totalSets = Math.max(1, entry.sets);
        for (let i = 1; i <= totalSets; i += 1) {
          nextQueue.push({ entry, exercise, setIndex: i, totalSets });
        }
      });

      if (cancelled) return;
      setMuscleNameById(groups.reduce<Record<string, string>>((acc, g) => { acc[g.id] = g.name; return acc; }, {}));
      setExerciseById(exMap);
      setQueue(nextQueue);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [dayKey, userKey]);

  // ── Đếm ngược dựa trên mốc thời gian thật, không phải interval đơn thuần ──
  useEffect(() => {
    if (phase !== 'resting' && phase !== 'prepping') return;
    if (countEndAt == null || pauseRemainingMs != null) return;
    const tick = () => {
      const remaining = Math.max(0, countEndAt - Date.now());
      setRemainingMs(remaining);
      if (remaining <= 0) handleCountdownFinished();
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, countEndAt, pauseRemainingMs]);

  // ── App bị đưa xuống nền giữa lúc đếm ngược: tính lại ngay khi quay lại ──
  useEffect(() => {
    const appStateRef = { current: AppState.currentState };
    const sub = AppState.addEventListener('change', (next) => {
      const wasBackground = appStateRef.current !== 'active';
      appStateRef.current = next;
      if (next === 'active' && wasBackground && countEndAt != null && pauseRemainingMs == null) {
        const remaining = Math.max(0, countEndAt - Date.now());
        setRemainingMs(remaining);
        if (remaining <= 0) handleCountdownFinished();
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countEndAt, pauseRemainingMs]);

  // ── Chặn nút back vật lý Android — buổi tập không nên thoát lỡ tay ──
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      confirmExit();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentStep = queue[stepIndex] as SetStep | undefined;
  const upcomingStep = queue[stepIndex + 1] as SetStep | undefined;
  const tone = currentStep ? getGroupTone() : undefined;

  // Bài tập "hiệu lực" cho bước hiện tại: bài đã gán sẵn trong kế hoạch, hoặc
  // bài người dùng vừa tự chọn trong phiên này cho entry chỉ-theo-nhóm-cơ.
  const effectiveExercise = currentStep
    ? currentStep.exercise ?? resolvedExerciseByEntryId[currentStep.entry.id] ?? null
    : null;
  const upcomingEffectiveExercise = upcomingStep
    ? upcomingStep.exercise ?? resolvedExerciseByEntryId[upcomingStep.entry.id] ?? null
    : null;

  function confirmExit() {
    Alert.alert(
      'Kết thúc buổi tập?',
      'Các set đã ghi lại vẫn được lưu. Bạn có chắc muốn thoát sớm?',
      [
        { text: 'Tiếp tục tập', style: 'cancel' },
        { text: 'Kết thúc', style: 'destructive', onPress: () => router.back() },
      ],
    );
  }

  async function getLastLogDefaults(exerciseId: string) {
    if (exerciseId in lastLogCacheRef.current) return lastLogCacheRef.current[exerciseId];
    try {
      const logs = await getWorkoutLogs(undefined, undefined, exerciseId);
      const last = logs[0] as any;
      const result = last ? { reps: last.reps ?? null, weight: last.weight ?? null } : null;
      lastLogCacheRef.current[exerciseId] = result;
      return result;
    } catch {
      return null;
    }
  }

  async function enterLogging() {
    const step = queue[stepIndexRef.current];
    if (!step) return;
    const ex = step.exercise ?? resolvedExerciseByEntryId[step.entry.id] ?? null;
    setLogNote('');
    setLogReps(step.entry.reps != null ? String(step.entry.reps) : '');
    setLogWeight('');
    setExercisePR(null);
    setPhase('logging');
    if (!ex) return;
    const [cached, pr] = await Promise.all([
      getLastLogDefaults(ex.id),
      getExercisePersonalRecord(ex.id),
    ]);
    setExercisePR(pr);
    if (cached) {
      setLogReps((prev) => prev || (cached.reps != null ? String(cached.reps) : ''));
      setLogWeight((prev) => prev || (cached.weight != null ? String(cached.weight) : ''));
    }
  }

  function openExercisePickerForCurrentStep() {
    const step = queue[stepIndexRef.current];
    if (!step) return;
    setPickerForEntryId(step.entry.id);
  }

  function handlePickExercise(exerciseId: string) {
    if (!pickerForEntryId) return;
    const ex = exerciseById[exerciseId];
    if (!ex) return;
    setResolvedExerciseByEntryId((prev) => ({ ...prev, [pickerForEntryId]: ex }));
    setPickerForEntryId(null);
    if (phase === 'logging') {
      setExercisePR(null);
      Promise.all([getLastLogDefaults(ex.id), getExercisePersonalRecord(ex.id)]).then(([cached, pr]) => {
        setExercisePR(pr);
        if (cached) {
          setLogReps((prev) => prev || (cached.reps != null ? String(cached.reps) : ''));
          setLogWeight((prev) => prev || (cached.weight != null ? String(cached.weight) : ''));
        }
      });
    }
  }

  function handleClearPickedExercise() {
    if (!pickerForEntryId) return;
    const entryId = pickerForEntryId;
    setResolvedExerciseByEntryId((prev) => {
      const next = { ...prev };
      delete next[entryId];
      return next;
    });
  }

  function startCountdown(seconds: number, nextPhase: 'resting' | 'prepping') {
    finishedRef.current = false;
    setPauseRemainingMs(null);
    setRemainingMs(seconds * 1000);
    setCountEndAt(Date.now() + seconds * 1000);
    setPhase(nextPhase);
  }

  function goToNextStep() {
    const nextIndex = stepIndexRef.current + 1;
    if (nextIndex >= queue.length) {
      setPhase('complete');
      return;
    }
    setStepIndex(nextIndex);
    setPhase('exercise');
  }

  function proceedAfterLog(step: SetStep) {
    const nextIndex = stepIndexRef.current + 1;
    if (nextIndex >= queue.length) {
      setCountEndAt(null);
      setPhase('complete');
      return;
    }
    const nextStep = queue[nextIndex];
    const stepExercise = step.exercise ?? resolvedExerciseByEntryId[step.entry.id] ?? null;
    const nextStepExercise = nextStep.exercise ?? resolvedExerciseByEntryId[nextStep.entry.id] ?? null;
    if (nextStep.entry.id === step.entry.id) {
      startCountdown(stepExercise?.rest_seconds ?? DEFAULT_REST_SECONDS, 'resting');
    } else {
      startCountdown(nextStepExercise?.prep_seconds ?? DEFAULT_PREP_SECONDS, 'prepping');
    }
  }

  function handleCountdownFinished() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try {
      player.seekTo(0).then(() => player.play()).catch(() => {});
    } catch {
      // no-op — âm thanh chỉ là phụ trợ, không chặn luồng chính nếu lỗi
    }
    setCountEndAt(null);
    setPauseRemainingMs(null);
    goToNextStep();
  }

  function skipCountdown() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setCountEndAt(null);
    setPauseRemainingMs(null);
    goToNextStep();
  }

  function togglePause() {
    if (pauseRemainingMs != null) {
      const remaining = pauseRemainingMs;
      setPauseRemainingMs(null);
      setCountEndAt(Date.now() + remaining);
    } else if (countEndAt != null) {
      setPauseRemainingMs(Math.max(0, countEndAt - Date.now()));
    }
  }

  function adjustCountdown(deltaSeconds: number) {
    if (pauseRemainingMs != null) {
      setPauseRemainingMs((r) => Math.max(0, (r ?? 0) + deltaSeconds * 1000));
      return;
    }
    setCountEndAt((prev) => (prev == null ? prev : Math.max(Date.now(), prev + deltaSeconds * 1000)));
  }

  async function handleLogSubmit(skip: boolean) {
    const step = queue[stepIndexRef.current];
    if (!step) return;
    const ex = step.exercise ?? resolvedExerciseByEntryId[step.entry.id] ?? null;
    if (!skip) {
      if (!ex) {
        Alert.alert('Chưa chọn bài tập', 'Chọn 1 bài tập cụ thể để ghi log, hoặc bấm "Bỏ qua, không ghi".');
        return;
      }
      setSaving(true);
      const repsNum = logReps.trim() ? Number(logReps) : NaN;
      const weightNum = logWeight.trim() ? Number(logWeight) : NaN;
      try {
        await insertWorkoutLog({
          exerciseId: ex.id,
          muscleGroupId: step.entry.muscleGroupId,
          sets: 1,
          reps: Number.isFinite(repsNum) ? Math.round(repsNum) : null,
          weight: Number.isFinite(weightNum) ? weightNum : null,
          note: logNote.trim() || null,
          loggedAt: new Date().toISOString(),
        });
        setTotalLoggedSets((c) => c + 1);
      } catch {
        setSaving(false);
        Alert.alert('Lỗi', 'Không thể lưu log, vui lòng thử lại.');
        return;
      }
      setSaving(false);
    }
    proceedAfterLog(step);
  }

  const displayRemainingMs = pauseRemainingMs != null ? pauseRemainingMs : remainingMs;
  const isPaused = pauseRemainingMs != null;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={confirmExit} style={styles.exitBtn} hitSlop={10}>
          <X color={CHALK} size={20} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>TẬP TRUNG</Text>
        <Text style={styles.topBarProgress}>
          {phase === 'complete' || queue.length === 0 ? '' : `${stepIndex + 1}/${queue.length}`}
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={LIME} />
        </View>
      ) : queue.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Ngày này chưa có lịch tập nào.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()}>
            <Text style={styles.primaryBtnText}>QUAY LẠI</Text>
          </TouchableOpacity>
        </View>
      ) : phase === 'complete' ? (
        <View style={styles.center}>
          <Text style={styles.completeTitle}>HOÀN THÀNH BUỔI TẬP</Text>
          <Text style={styles.completeStat}>{totalLoggedSets} set đã ghi lại</Text>
          <Text style={styles.completeSub}>{formatDuration(Date.now() - sessionStartAt)}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()}>
            <Text style={styles.primaryBtnText}>XONG</Text>
          </TouchableOpacity>
        </View>
      ) : phase === 'exercise' && currentStep ? (
        <ScrollView contentContainerStyle={styles.centerContent}>
          <Text style={styles.muscleLabel}>
            {(muscleNameById[currentStep.entry.muscleGroupId] ?? '').toUpperCase()}
          </Text>
          {effectiveExercise ? (
            <ExerciseThumb ex={effectiveExercise} tone={tone} size={110} />
          ) : (
            <View style={styles.groupOnlyThumb}>
              <Dumbbell color={LIME} size={40} strokeWidth={1.5} />
            </View>
          )}
          <Text style={styles.exerciseName}>
            {effectiveExercise?.name ?? 'Chưa chọn bài tập cụ thể'}
          </Text>
          <Text style={styles.setLabel}>SET {currentStep.setIndex}/{currentStep.totalSets}</Text>
          {currentStep.entry.reps ? (
            <Text style={styles.targetReps}>Mục tiêu {currentStep.entry.reps} reps</Text>
          ) : null}
          {!effectiveExercise ? (
            <TouchableOpacity style={styles.pickExerciseBtn} onPress={openExercisePickerForCurrentStep}>
              <Text style={styles.pickExerciseBtnText}>Chọn bài tập (tuỳ chọn)</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.primaryBtn} onPress={enterLogging}>
            <Text style={styles.primaryBtnText}>XONG SET NÀY</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : phase === 'logging' && currentStep ? (
        <ScrollView contentContainerStyle={styles.loggingContent}>
          <View style={styles.loggingHeader}>
            <Text style={styles.muscleLabel}>GHI NHANH</Text>
            {effectiveExercise ? (
              <ExerciseThumb ex={effectiveExercise} tone={tone} size={110} />
            ) : (
              <View style={styles.groupOnlyThumb}>
                <Dumbbell color={LIME} size={40} strokeWidth={1.5} />
              </View>
            )}
            <Text style={styles.exerciseName}>
              {effectiveExercise?.name ?? 'Chưa chọn bài tập cụ thể'}
            </Text>
            {effectiveExercise && exercisePR && (exercisePR.bestReps != null || exercisePR.bestWeight != null) ? (
              <View style={styles.prRow}>
                <Trophy color={LIME} size={16} strokeWidth={2} />
                {exercisePR.bestReps != null && (
                  <View style={styles.prChip}>
                    <Text style={styles.prChipValue}>{exercisePR.bestReps}</Text>
                    <Text style={styles.prChipUnit}>reps</Text>
                  </View>
                )}
                {exercisePR.bestWeight != null && (
                  <View style={styles.prChip}>
                    <Text style={styles.prChipValue}>{exercisePR.bestWeight}</Text>
                    <Text style={styles.prChipUnit}>kg</Text>
                  </View>
                )}
              </View>
            ) : null}
            <Text style={styles.setLabel}>SET {currentStep.setIndex}/{currentStep.totalSets}</Text>
            {!effectiveExercise ? (
              <TouchableOpacity style={styles.pickExerciseBtn} onPress={openExercisePickerForCurrentStep}>
                <Text style={styles.pickExerciseBtnText}>Chọn bài tập để ghi log</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.logRow}>
            <View style={styles.logField}>
              <Text style={styles.logFieldLabel}>Reps</Text>
              <TextInput
                style={styles.logInput}
                value={logReps}
                onChangeText={setLogReps}
                keyboardType="number-pad"
                placeholder="—"
                placeholderTextColor="rgba(243,246,239,0.3)"
              />
            </View>
            <View style={styles.logField}>
              <Text style={styles.logFieldLabel}>Khối lượng (kg)</Text>
              <TextInput
                style={styles.logInput}
                value={logWeight}
                onChangeText={setLogWeight}
                keyboardType="decimal-pad"
                placeholder="—"
                placeholderTextColor="rgba(243,246,239,0.3)"
              />
            </View>
          </View>

          <Text style={styles.logFieldLabel}>Ghi chú (tuỳ chọn)</Text>
          <TextInput
            style={[styles.logInput, styles.logNoteInput]}
            value={logNote}
            onChangeText={setLogNote}
            placeholder="VD: cảm giác nặng hơn tuần trước"
            placeholderTextColor="rgba(243,246,239,0.3)"
            multiline
          />

          <TouchableOpacity style={styles.primaryBtn} disabled={saving} onPress={() => handleLogSubmit(false)}>
            <Text style={styles.primaryBtnText}>{saving ? 'ĐANG LƯU...' : 'LƯU & TIẾP TỤC'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipLogBtn} disabled={saving} onPress={() => handleLogSubmit(true)}>
            <Text style={styles.skipLogBtnText}>Bỏ qua, không ghi</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (phase === 'resting' || phase === 'prepping') && currentStep ? (
        <View style={styles.centerContent}>
          <Text style={styles.muscleLabel}>{phase === 'resting' ? 'NGHỈ GIỮA SET' : 'CHUẨN BỊ BÀI TIẾP THEO'}</Text>
          <Text style={styles.countdown}>{formatCountdown(displayRemainingMs)}</Text>

          {upcomingStep ? (
            <TouchableOpacity
              style={styles.upNextRow}
              activeOpacity={upcomingEffectiveExercise ? 0.7 : 1}
              disabled={!upcomingEffectiveExercise}
              onPress={() => upcomingEffectiveExercise && setInfoModalExercise(upcomingEffectiveExercise)}
            >
              {upcomingEffectiveExercise ? (
                <ExerciseThumb ex={upcomingEffectiveExercise} tone={tone} size={44} />
              ) : (
                <View style={[styles.groupOnlyThumb, styles.groupOnlyThumbSmall]}>
                  <Dumbbell color={LIME} size={18} strokeWidth={1.5} />
                </View>
              )}
              <View style={styles.upNextInfo}>
                <Text style={styles.upNextLabel}>Tiếp theo</Text>
                <Text style={styles.upNextName} numberOfLines={1}>
                  {upcomingEffectiveExercise?.name ?? (muscleNameById[upcomingStep.entry.muscleGroupId] ?? 'Chưa chọn bài tập')}
                </Text>
                <Text style={styles.upNextSub}>Set {upcomingStep.setIndex}/{upcomingStep.totalSets}</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          <View style={styles.countdownControls}>
            <TouchableOpacity style={styles.roundBtn} onPress={() => adjustCountdown(-15)}>
              <Minus color={CHALK} size={18} strokeWidth={2.5} />
              <Text style={styles.roundBtnLabel}>15s</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.roundBtn, styles.roundBtnAccent]} onPress={togglePause}>
              {isPaused ? <Play color={INK} size={18} strokeWidth={2.5} /> : <Pause color={INK} size={18} strokeWidth={2.5} />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.roundBtn} onPress={() => adjustCountdown(15)}>
              <Plus color={CHALK} size={18} strokeWidth={2.5} />
              <Text style={styles.roundBtnLabel}>15s</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.skipCountdownBtn} onPress={skipCountdown}>
            <SkipForward color={LIME} size={14} strokeWidth={2.5} />
            <Text style={styles.skipCountdownText}>Bỏ qua</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ExercisePickerSheet
        muscleGroupId={pickerForEntryId ? (queue.find((s) => s.entry.id === pickerForEntryId)?.entry.muscleGroupId ?? null) : null}
        muscleGroupName={
          pickerForEntryId
            ? muscleNameById[queue.find((s) => s.entry.id === pickerForEntryId)?.entry.muscleGroupId ?? '']
            : undefined
        }
        chosenExerciseIds={
          pickerForEntryId && resolvedExerciseByEntryId[pickerForEntryId]
            ? [resolvedExerciseByEntryId[pickerForEntryId].id]
            : []
        }
        onToggle={handlePickExercise}
        onClearAll={handleClearPickedExercise}
        onDone={() => setPickerForEntryId(null)}
        muscleNameById={muscleNameById}
      />

      <ExerciseInfoModal
        exercise={infoModalExercise}
        muscleNameById={muscleNameById}
        onClose={() => setInfoModalExercise(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: INK },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  centerContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 10 },
  loggingContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 16, gap: 10 },
  loggingHeader: { alignItems: 'center', gap: 4, marginBottom: 4 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: HAIRLINE,
  },
  exitBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: LIME },
  topBarProgress: { fontSize: 12, fontWeight: '700', color: CHALK, opacity: 0.6, minWidth: 32, textAlign: 'right' },

  emptyText: { fontSize: 14, color: CHALK, opacity: 0.6, textAlign: 'center', lineHeight: 20, marginBottom: 20 },

  muscleLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, color: LIME, marginBottom: 4 },
  exerciseName: { fontSize: 22, fontWeight: '800', color: CHALK, textAlign: 'center', marginTop: 8 },
  setLabel: { fontSize: 13, fontWeight: '700', color: CHALK, opacity: 0.55, marginTop: 4 },
  targetReps: { fontSize: 13, color: LIME, fontWeight: '700', marginTop: 2 },
  prRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  prChip: {
    flexDirection: 'row', alignItems: 'baseline', gap: 4,
    backgroundColor: 'rgba(214,255,63,0.14)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  prChipValue: { fontSize: 18, fontWeight: '800', color: LIME },
  prChipUnit: { fontSize: 13, fontWeight: '700', color: LIME, opacity: 0.7 },

  groupOnlyThumb: {
    width: 110, height: 110, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
    backgroundColor: INK_RAISED, borderWidth: 1, borderColor: HAIRLINE,
  },
  groupOnlyThumbSmall: { width: 44, height: 44, borderRadius: 10 },
  pickExerciseBtn: {
    marginTop: 10, borderWidth: 1, borderColor: 'rgba(214,255,63,0.4)', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  pickExerciseBtnText: { fontSize: 12, fontWeight: '700', color: LIME },

  primaryBtn: {
    marginTop: 24, backgroundColor: LIME, borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 32, alignItems: 'center', alignSelf: 'stretch',
  },
  primaryBtnText: { fontSize: 14, fontWeight: '800', letterSpacing: 0.6, color: INK },

  logRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  logField: { flex: 1 },
  logFieldLabel: { fontSize: 11, color: CHALK, opacity: 0.55, marginBottom: 6, fontWeight: '700' },
  logInput: {
    borderWidth: 1, borderColor: HAIRLINE, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, fontWeight: '700',
    color: CHALK, backgroundColor: INK_RAISED,
  },
  logNoteInput: { minHeight: 60, textAlignVertical: 'top', fontWeight: '400', fontSize: 14 },
  skipLogBtn: { marginTop: 10, alignItems: 'center', paddingVertical: 10 },
  skipLogBtnText: { fontSize: 13, color: CHALK, opacity: 0.5, fontWeight: '600' },

  countdown: { fontSize: 64, fontWeight: '800', color: CHALK, letterSpacing: -1.5, marginVertical: 8 },

  upNextRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: INK_RAISED, borderRadius: 12, borderWidth: 1, borderColor: HAIRLINE,
    paddingHorizontal: 12, paddingVertical: 10, marginTop: 8, alignSelf: 'stretch',
  },
  upNextInfo: { flex: 1, minWidth: 0 },
  upNextLabel: { fontSize: 10, color: CHALK, opacity: 0.5, fontWeight: '700', letterSpacing: 0.4 },
  upNextName: { fontSize: 14, color: CHALK, fontWeight: '700', marginTop: 1 },
  upNextSub: { fontSize: 11, color: CHALK, opacity: 0.5, marginTop: 1 },

  countdownControls: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 24 },
  roundBtn: {
    width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    backgroundColor: INK_RAISED, borderWidth: 1, borderColor: HAIRLINE,
  },
  roundBtnAccent: { backgroundColor: LIME, borderColor: LIME, width: 64, height: 64, borderRadius: 32 },
  roundBtnLabel: { fontSize: 9, fontWeight: '700', color: CHALK, opacity: 0.6, marginTop: 1 },

  skipCountdownBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 18, padding: 8 },
  skipCountdownText: { fontSize: 12, fontWeight: '700', color: LIME },

  completeTitle: { fontSize: 18, fontWeight: '800', color: CHALK, letterSpacing: 0.6 },
  completeStat: { fontSize: 28, fontWeight: '800', color: LIME, marginTop: 14 },
  completeSub: { fontSize: 13, color: CHALK, opacity: 0.55, marginTop: 4 },
});
