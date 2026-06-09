import { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/src/constants/colors';
import type { MuscleGoal } from '@/src/types/database';

interface GoalsTabProps {
  prioritizedGoals: MuscleGoal[];
  completedGoals: MuscleGoal[];
  goalFilterMode: 'all' | 'lean' | 'fat';
  onChangeGoalFilterMode: (mode: 'all' | 'lean' | 'fat') => void;
  onEditGoal: (goal: MuscleGoal) => void;
  onDeleteGoal: (goal: MuscleGoal) => void;
  getMetricLabel: (key: string) => string;
  formatDateFull: (value?: string | null) => string;
}

function GoalsTabComponent({
  prioritizedGoals,
  completedGoals,
  goalFilterMode,
  onChangeGoalFilterMode,
  onEditGoal,
  onDeleteGoal,
  getMetricLabel,
  formatDateFull,
}: GoalsTabProps) {
  const getGoalProgressPct = (goal: MuscleGoal) => {
    const current = goal.current_value ?? 0;
    const target = goal.target_value;
    if (target <= 0) return 0;

    const isLean = goal.metric_key.startsWith('segmental_lean_');
    if (isLean) {
      return Math.min(Math.round((current / target) * 100), 100);
    }

    if (current <= 0) return 100;
    return Math.min(Math.round((target / current) * 100), 100);
  };

  const applyFilter = (goals: MuscleGoal[]) =>
    goals.filter((g) => {
      if (goalFilterMode === 'all') return true;
      return goalFilterMode === 'lean'
        ? g.metric_key.startsWith('segmental_lean_')
        : g.metric_key.startsWith('segmental_fat_');
    });

  const filteredActive = applyFilter(prioritizedGoals);
  const filteredCompleted = applyFilter(completedGoals);

  const totalGoals = prioritizedGoals.length + completedGoals.length;
  const goodCount = prioritizedGoals.filter((g) => getGoalProgressPct(g) >= 60).length;
  const warnCount = prioritizedGoals.length - goodCount;

  const renderGoalCard = (goal: MuscleGoal, completed = false) => {
    const current = goal.current_value ?? 0;
    const isLean = goal.metric_key.startsWith('segmental_lean_');
    const pct = completed ? 100 : getGoalProgressPct(goal);
    const gap = Math.abs(goal.target_value - current);
    const isGood = pct >= 60;
    const daysLeft = goal.target_date
      ? Math.max(
          0,
          Math.ceil(
            (new Date(goal.target_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
          ),
        )
      : null;

    return (
      <View
        key={goal.id}
        style={[styles.goalCard, completed && styles.goalCardCompleted]}
      >
        <View style={styles.goalTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.goalName}>{getMetricLabel(goal.metric_key)}</Text>
            {goal.target_date ? (
              <Text style={styles.goalDate}>Đích: {formatDateFull(goal.target_date)}</Text>
            ) : null}
          </View>
          <View style={styles.goalTopRight}>
            {completed ? (
              <View style={[styles.badge, styles.badgeCompleted]}>
                <Text style={[styles.badgeText, styles.badgeCompletedText]}>✅ Đạt</Text>
              </View>
            ) : (
              <View style={[styles.badge, isGood ? styles.badgeGood : styles.badgeWarn]}>
                <Text
                  style={[
                    styles.badgeText,
                    isGood ? styles.badgeGoodText : styles.badgeWarnText,
                  ]}
                >
                  {pct}%
                </Text>
              </View>
            )}
            {!completed && daysLeft != null && (
              <Text style={styles.goalDate}>Còn {daysLeft} ngày</Text>
            )}
          </View>
        </View>

        <View style={styles.goalTrack}>
          <View
            style={[
              styles.goalFill,
              completed
                ? styles.goalFillCompleted
                : !isGood
                  ? styles.goalFillWarn
                  : undefined,
              { width: `${pct}%` },
            ]}
          />
        </View>

        <View style={styles.goalNumsRow}>
          <View>
            <Text style={styles.goalNumLabel}>Hiện tại</Text>
            <Text style={styles.goalNumVal}>
              {current} {goal.unit}
            </Text>
          </View>

          {completed ? (
            <View style={[styles.goalGapBox, styles.goalGapBoxCompleted]}>
              <Text style={styles.goalGapLabel}>Kết quả</Text>
              <Text style={[styles.goalGapVal, styles.deltaGood]}>Hoàn thành 🎉</Text>
            </View>
          ) : (
            <View style={styles.goalGapBox}>
              <Text style={styles.goalGapLabel}>
                {isLean ? 'Còn thiếu' : 'Còn phải giảm'}
              </Text>
              <Text
                style={[
                  styles.goalGapVal,
                  isLean ? styles.deltaGood : styles.deltaWarn,
                ]}
              >
                {isLean ? '+' : '-'}
                {gap.toFixed(2)} {goal.unit}
              </Text>
            </View>
          )}

          <View style={styles.goalTargetWrap}>
            <Text style={styles.goalNumLabel}>Mục tiêu</Text>
            <Text
              style={[
                styles.goalNumVal,
                completed
                  ? styles.deltaGood
                  : isGood
                    ? styles.deltaGood
                    : styles.deltaWarn,
              ]}
            >
              {goal.target_value.toFixed(2)} {goal.unit}
            </Text>
          </View>
        </View>

        <View style={styles.goalActionsRow}>
          <TouchableOpacity
            style={styles.goalActionBtn}
            onPress={() => onEditGoal(goal)}
            activeOpacity={0.8}
          >
            <Text style={styles.goalActionBtnText}>Sửa</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.goalActionBtn, styles.goalActionBtnDanger]}
            onPress={() => onDeleteGoal(goal)}
            activeOpacity={0.8}
          >
            <Text style={[styles.goalActionBtnText, styles.goalActionBtnDangerText]}>Xóa</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <>
      {/* ── Summary ── */}
      {totalGoals > 0 && (
        <View style={styles.goalSummaryRow}>
          {[
            { label: 'Tổng goals', value: String(totalGoals), color: Colors.text },
            { label: 'Đang tiến tốt', value: String(goodCount), color: Colors.success },
            { label: 'Cần chú ý', value: String(warnCount), color: Colors.warning },
            {
              label: 'Đã đạt',
              value: String(completedGoals.length),
              color: Colors.success,
            },
          ].map((item) => (
            <View key={item.label} style={styles.goalSummaryCard}>
              <Text style={styles.goalSummaryLabel}>{item.label}</Text>
              <Text style={[styles.goalSummaryVal, { color: item.color }]}>{item.value}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Filter chips ── */}
      <View style={styles.chipRow}>
        {(['all', 'lean', 'fat'] as const).map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.chip, goalFilterMode === m && styles.chipActive]}
            onPress={() => onChangeGoalFilterMode(m)}
            activeOpacity={0.75}
          >
            <Text style={[styles.chipText, goalFilterMode === m && styles.chipTextActive]}>
              {m === 'all' ? 'Tất cả' : m === 'lean' ? 'Lean (Cơ)' : 'Fat (Mỡ)'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Active goals ── */}
      {filteredActive.length === 0 && filteredCompleted.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            {totalGoals === 0
              ? 'Tạo goal để app gợi ý chỉ số nào cần ưu tiên tăng hoặc giảm'
              : 'Không có goal nào trong danh mục này'}
          </Text>
        </View>
      ) : (
        <>
          {filteredActive.map((goal) => renderGoalCard(goal, false))}

          {/* ── Completed goals ── */}
          {filteredCompleted.length > 0 && (
            <>
              <View style={styles.completedSectionHeader}>
                <View style={styles.completedDivider} />
                <Text style={styles.completedSectionTitle}>
                  ✅ Đã đạt mục tiêu ({filteredCompleted.length})
                </Text>
                <View style={styles.completedDivider} />
              </View>
              {filteredCompleted.map((goal) => renderGoalCard(goal, true))}
            </>
          )}
        </>
      )}
    </>
  );
}

export const GoalsTab = memo(GoalsTabComponent);

const styles = StyleSheet.create({
  goalSummaryRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  goalSummaryCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  goalSummaryLabel: { fontSize: 10, color: Colors.textMuted, marginBottom: 4 },
  goalSummaryVal: { fontSize: 18, fontWeight: '700' },

  chipRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '20' },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: Colors.accent },

  goalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  goalCardCompleted: {
    opacity: 0.72,
    borderColor: Colors.success + '55',
    backgroundColor: Colors.success + '08',
  },

  goalTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  goalTopRight: { alignItems: 'flex-end', gap: 4 },
  goalName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  goalDate: { fontSize: 11, color: Colors.textMuted, marginTop: 3 },

  badge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  badgeGood: { backgroundColor: Colors.success + '20' },
  badgeGoodText: { color: Colors.success },
  badgeWarn: { backgroundColor: Colors.warning + '20' },
  badgeWarnText: { color: Colors.warning },
  badgeCompleted: { backgroundColor: Colors.success + '25' },
  badgeCompletedText: { color: Colors.success },

  goalTrack: {
    height: 5,
    backgroundColor: Colors.border,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 10,
  },
  goalFill: { height: '100%', backgroundColor: Colors.accent, borderRadius: 999 },
  goalFillWarn: { backgroundColor: Colors.warning },
  goalFillCompleted: { backgroundColor: Colors.success },

  goalNumsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalTargetWrap: { alignItems: 'flex-end' },
  goalNumLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  goalNumVal: { fontSize: 14, fontWeight: '700', color: Colors.text },
  goalGapBox: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  goalGapBoxCompleted: {
    backgroundColor: Colors.success + '15',
  },
  goalGapLabel: { fontSize: 10, color: Colors.textMuted, marginBottom: 2 },
  goalGapVal: { fontSize: 13, fontWeight: '700' },

  goalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
  },
  goalActionBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.surfaceElevated,
  },
  goalActionBtnDanger: {
    borderColor: Colors.error + '66',
    backgroundColor: Colors.error + '15',
  },
  goalActionBtnText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  goalActionBtnDangerText: { color: Colors.error },

  deltaGood: { color: Colors.success },
  deltaWarn: { color: Colors.warning },

  // Completed section divider
  completedSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 14,
  },
  completedDivider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.success + '40',
  },
  completedSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.success,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  emptyBox: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  emptyText: { fontSize: 13, color: Colors.textMuted, lineHeight: 20 },
});