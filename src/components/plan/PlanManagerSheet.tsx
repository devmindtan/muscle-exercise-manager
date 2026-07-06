import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Check, Pencil, Trash2, X } from 'lucide-react-native';
import { Colors } from '@/src/constants/colors';
import {
  createWorkoutPlan,
  deleteWorkoutPlan,
  getWeeklyPlanEntries,
  renameWorkoutPlan,
  setActiveWorkoutPlan,
  WeeklyPlanEntry,
  WorkoutPlan,
} from '@/src/services/weeklyPlanService';

interface PlanManagerSheetProps {
  visible: boolean;
  onClose: () => void;
  workoutPlans: WorkoutPlan[];
  activePlanId: string | null;
  userKey: string;
  onWorkoutPlansChange: (next: WorkoutPlan[]) => void;
  onActivePlanChange: (id: string | null) => void;
  onPlansReload: (nextPlans: WeeklyPlanEntry[]) => void;
}

// Bottom sheet quản lý các "kế hoạch" (workout_plans) — chọn/đổi tên/tạo/xoá —
// tách khỏi WeeklyPlanScreen để màn chính gọn hơn.
export function PlanManagerSheet({
  visible,
  onClose,
  workoutPlans,
  activePlanId,
  userKey,
  onWorkoutPlansChange,
  onActivePlanChange,
  onPlansReload,
}: PlanManagerSheetProps) {
  const [planNameDraft, setPlanNameDraft] = useState('');
  const [renamingPlanId, setRenamingPlanId] = useState<string | null>(null);
  const [planActionError, setPlanActionError] = useState('');
  const [planActionBusy, setPlanActionBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setPlanActionError('');
    setPlanNameDraft('');
    setRenamingPlanId(null);
  }, [visible]);

  const switchWorkoutPlan = async (planId: string) => {
    if (planId === activePlanId) return;
    setPlanActionBusy(true);
    try {
      const nextWorkoutPlans = await setActiveWorkoutPlan(planId, userKey);
      onWorkoutPlansChange(nextWorkoutPlans);
      onActivePlanChange(planId);
      const nextPlans = await getWeeklyPlanEntries(userKey, planId);
      onPlansReload(nextPlans);
    } finally {
      setPlanActionBusy(false);
    }
  };

  const submitCreatePlan = async () => {
    const name = planNameDraft.trim();
    if (!name) { setPlanActionError('Vui lòng nhập tên kế hoạch.'); return; }
    setPlanActionBusy(true);
    try {
      const nextWorkoutPlans = await createWorkoutPlan(name, userKey);
      onWorkoutPlansChange(nextWorkoutPlans);
      setPlanNameDraft('');
      setPlanActionError('');
    } catch {
      setPlanActionError('Không thể tạo kế hoạch. Vui lòng thử lại.');
    } finally {
      setPlanActionBusy(false);
    }
  };

  const startRenamePlan = (plan: WorkoutPlan) => {
    setRenamingPlanId(plan.id);
    setPlanNameDraft(plan.name);
    setPlanActionError('');
  };

  const submitRenamePlan = async () => {
    if (!renamingPlanId) return;
    const name = planNameDraft.trim();
    if (!name) { setPlanActionError('Vui lòng nhập tên kế hoạch.'); return; }
    setPlanActionBusy(true);
    try {
      const nextWorkoutPlans = await renameWorkoutPlan(renamingPlanId, name, userKey);
      onWorkoutPlansChange(nextWorkoutPlans);
      setRenamingPlanId(null);
      setPlanNameDraft('');
      setPlanActionError('');
    } catch {
      setPlanActionError('Không thể đổi tên. Vui lòng thử lại.');
    } finally {
      setPlanActionBusy(false);
    }
  };

  const removePlan = async (planId: string) => {
    if (workoutPlans.length <= 1) {
      setPlanActionError('Cần giữ lại ít nhất 1 kế hoạch.');
      return;
    }
    setPlanActionBusy(true);
    try {
      const nextWorkoutPlans = await deleteWorkoutPlan(planId, userKey);
      onWorkoutPlansChange(nextWorkoutPlans);
      const nextActive = nextWorkoutPlans.find((p) => p.isActive) ?? nextWorkoutPlans[0] ?? null;
      onActivePlanChange(nextActive?.id ?? null);
      const nextPlans = await getWeeklyPlanEntries(userKey, nextActive?.id ?? null);
      onPlansReload(nextPlans);
    } catch {
      setPlanActionError('Không thể xoá kế hoạch. Vui lòng thử lại.');
    } finally {
      setPlanActionBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Chọn kế hoạch</Text>
          <TouchableOpacity onPress={onClose}>
            <X color={Colors.textSecondary} size={20} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ maxHeight: 280 }}>
          {workoutPlans.map((plan) => {
            const isActive = plan.id === activePlanId;
            return (
              <TouchableOpacity
                key={plan.id}
                style={styles.planManageRow}
                activeOpacity={0.7}
                disabled={planActionBusy}
                onPress={async () => {
                  await switchWorkoutPlan(plan.id);
                  onClose();
                }}
              >
                <View style={styles.planManageInfo}>
                  <View style={[styles.planManageCheck, isActive && styles.planManageCheckActive]}>
                    {isActive && <Check color={Colors.bg} size={12} strokeWidth={3} />}
                  </View>
                  <Text style={[styles.planManageName, isActive && styles.planManageNameActive]} numberOfLines={1}>
                    {plan.name}
                  </Text>
                </View>
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.planManageIconBtn}
                    onPress={(e) => { e.stopPropagation(); startRenamePlan(plan); }}
                  >
                    <Pencil color={Colors.textSecondary} size={14} strokeWidth={2} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.planManageIconBtn, workoutPlans.length <= 1 && styles.saveBtnDisabled]}
                    onPress={(e) => { e.stopPropagation(); removePlan(plan.id); }}
                    disabled={workoutPlans.length <= 1}
                  >
                    <Trash2 color={Colors.error} size={14} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.inputLabel}>
          {renamingPlanId ? 'Đổi tên kế hoạch' : 'Tạo kế hoạch mới'}
        </Text>
        <TextInput
          style={styles.input}
          value={planNameDraft}
          onChangeText={setPlanNameDraft}
          placeholder="VD: Kế hoạch mùa hè, Kế hoạch tăng cơ..."
          placeholderTextColor={Colors.textMuted}
        />

        {planActionError ? <Text style={styles.errorText}>{planActionError}</Text> : null}

        <View style={styles.planManageActions}>
          {renamingPlanId && (
            <TouchableOpacity
              style={[styles.saveBtn, styles.planManageCancelBtn]}
              onPress={() => { setRenamingPlanId(null); setPlanNameDraft(''); setPlanActionError(''); }}
            >
              <Text style={styles.planManageCancelBtnText}>Huỷ</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.saveBtn, { flex: 1 }, planActionBusy && styles.saveBtnDisabled]}
            onPress={renamingPlanId ? submitRenamePlan : submitCreatePlan}
            disabled={planActionBusy}
          >
            <Text style={styles.saveBtnText}>
              {planActionBusy ? 'Đang lưu...' : renamingPlanId ? 'Lưu tên mới' : 'Tạo kế hoạch'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 24 }} />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#00000088' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16, paddingTop: 8,
    maxHeight: '90%',
  },
  sheetHandle: {
    width: 44, height: 4, borderRadius: 999, backgroundColor: Colors.textMuted,
    alignSelf: 'center', marginBottom: 12, opacity: 0.4,
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  inputLabel: { color: Colors.textSecondary, marginBottom: 8, marginTop: 10, fontSize: 12, fontWeight: '600' },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    backgroundColor: Colors.surfaceElevated, color: Colors.text,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
  },
  errorText: { marginTop: 10, color: Colors.error, fontSize: 12 },
  saveBtn: {
    marginTop: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, backgroundColor: Colors.accent,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: Colors.bg, fontWeight: '700', fontSize: 14 },

  actionRow: { flexDirection: 'row', gap: 5 },
  planManageRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 8,
  },
  planManageInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  planManageCheck: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg,
  },
  planManageCheckActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  planManageName: { fontSize: 14, fontWeight: '500', color: Colors.text, flexShrink: 1 },
  planManageNameActive: { fontWeight: '700', color: Colors.accent },
  planManageIconBtn: {
    width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center',
  },
  planManageActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  planManageCancelBtn: { backgroundColor: Colors.surfaceElevated, paddingHorizontal: 18 },
  planManageCancelBtnText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 14 },
});
