import { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/src/constants/colors';
import type { MuscleGoal } from '@/src/types/database';

interface GoalsTabProps {
  prioritizedGoals: MuscleGoal[];
  completedGoals: MuscleGoal[];
  goalFilterMode: 'all' | 'lean' | 'fat' | 'done';
  onChangeGoalFilterMode: (mode: 'all' | 'lean' | 'fat' | 'done') => void;
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
    if (isLean) return Math.min(Math.round((current / target) * 100), 100);
    if (current <= 0) return 100;
    return Math.min(Math.round((target / current) * 100), 100);
  };

  const applyMetricFilter = (goals: MuscleGoal[]) =>
    goals.filter((g) => {
      if (goalFilterMode === 'all' || goalFilterMode === 'done') return true;
      return goalFilterMode === 'lean'
        ? g.metric_key.startsWith('segmental_lean_')
        : g.metric_key.startsWith('segmental_fat_');
    });

  const filteredActive = goalFilterMode === 'done' ? [] : applyMetricFilter(prioritizedGoals);
  const filteredCompleted = applyMetricFilter(completedGoals);

  const totalGoals = prioritizedGoals.length + completedGoals.length;
  const goodCount = prioritizedGoals.filter((g) => getGoalProgressPct(g) >= 60).length;
  const warnCount = prioritizedGoals.length - goodCount;

  const renderActiveGoalCard = (goal: MuscleGoal) => {
    const current = goal.current_value ?? 0;
    const isLean = goal.metric_key.startsWith('segmental_lean_');
    const pct = getGoalProgressPct(goal);
    const gap = Math.abs(goal.target_value - current);
    const isGood = pct >= 60;
    const daysLeft = goal.target_date
      ? Math.max(0, Math.ceil((new Date(goal.target_date).getTime() - Date.now()) / 86400000))
      : null;
    const isUrgent = daysLeft != null && daysLeft <= 7;

    return (
      <View key={goal.id} style={styles.activeCard}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.statusDot} />
          <Text style={styles.activeCardTitle}>{getMetricLabel(goal.metric_key)}</Text>
          <View style={[styles.pctBadge, isGood ? styles.pctBadgeGood : styles.pctBadgeWarn]}>
            <Text style={[styles.pctBadgeText, isGood ? styles.pctGoodText : styles.pctWarnText]}>
              {pct}%
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                isGood ? styles.progressFillGood : styles.progressFillWarn,
                { width: `${pct}%` },
              ]}
            />
          </View>
          <Text style={[styles.progressPctLabel, isGood ? styles.pctGoodText : styles.pctWarnText]}>
            {pct}%
          </Text>
        </View>

        {/* Numbers */}
        <View style={styles.numsRow}>
          <View style={styles.numBox}>
            <Text style={styles.numLabel}>Hiện tại</Text>
            <Text style={styles.numVal}>
              {current} {goal.unit}
            </Text>
          </View>

          <View style={[styles.gapBox, isGood ? styles.gapBoxGood : styles.gapBoxWarn]}>
            <Text style={styles.gapLabel}>{isLean ? 'Còn thiếu' : 'Còn phải giảm'}</Text>
            <Text style={[styles.gapVal, isLean ? styles.pctGoodText : styles.pctWarnText]}>
              {isLean ? '+' : '-'}
              {gap.toFixed(2)} {goal.unit}
            </Text>
          </View>

          <View style={styles.numBoxRight}>
            <Text style={styles.numLabel}>Mục tiêu</Text>
            <Text style={[styles.numVal, isGood ? styles.pctGoodText : styles.pctWarnText]}>
              {goal.target_value.toFixed(2)} {goal.unit}
            </Text>
          </View>
        </View>

        {/* Deadline */}
        {daysLeft != null && (
          <View style={[styles.deadlineRow, isUrgent && styles.deadlineRowUrgent]}>
            <Text style={[styles.deadlineIcon]}>{isUrgent ? '⚠️' : '📅'}</Text>
            <Text style={[styles.deadlineText, isUrgent && styles.deadlineTextUrgent]}>
              {goal.target_date ? formatDateFull(goal.target_date) : ''} — còn{' '}
              <Text style={{ fontWeight: '700' }}>{daysLeft} ngày</Text>
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => onEditGoal(goal)} activeOpacity={0.8}>
            <Text style={styles.actionBtnText}>Sửa</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnDanger]}
            onPress={() => onDeleteGoal(goal)}
            activeOpacity={0.8}
          >
            <Text style={[styles.actionBtnText, styles.actionBtnDangerText]}>Xóa</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderCompletedGoalCard = (goal: MuscleGoal) => {
    const current = goal.current_value ?? 0;

    return (
      <View key={goal.id} style={styles.completedCard}>
        <View style={styles.completedCardInner}>
          {/* Checkmark badge */}
          <View style={styles.checkBadge}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.completedCardTitle}>{getMetricLabel(goal.metric_key)}</Text>
            {goal.target_date && (
              <Text style={styles.completedCardDate}>Đạt vào: {formatDateFull(goal.target_date)}</Text>
            )}

            <View style={styles.completedNumsRow}>
              <Text style={styles.completedNum}>
                {current} {goal.unit}
              </Text>
              <Text style={styles.completedArrow}>→</Text>
              <Text style={styles.completedTarget}>
                {goal.target_value.toFixed(2)} {goal.unit}
              </Text>
              <View style={styles.completedChip}>
                <Text style={styles.completedChipText}>Đã đạt</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Full green progress bar */}
        <View style={styles.completedTrack}>
          <View style={styles.completedFill} />
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => onEditGoal(goal)} activeOpacity={0.8}>
            <Text style={styles.actionBtnText}>Sửa</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnDanger]}
            onPress={() => onDeleteGoal(goal)}
            activeOpacity={0.8}
          >
            <Text style={[styles.actionBtnText, styles.actionBtnDangerText]}>Xóa</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <>
      {/* Summary */}
      {totalGoals > 0 && (
        <View style={styles.summaryRow}>
          {[
            { label: 'Tổng goals', value: String(totalGoals), color: Colors.text },
            { label: 'Tiến tốt', value: String(goodCount), color: Colors.success },
            { label: 'Cần chú ý', value: String(warnCount), color: Colors.warning },
            { label: 'Đã đạt', value: String(completedGoals.length), color: Colors.success },
          ].map((item) => (
            <View key={item.label} style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{item.label}</Text>
              <Text style={[styles.summaryVal, { color: item.color }]}>{item.value}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Filter chips */}
      <View style={styles.chipRow}>
        {(['all', 'lean', 'fat', 'done'] as const).map((m) => (
          <TouchableOpacity
            key={m}
            style={[
              styles.chip,
              goalFilterMode === m && (m === 'done' ? styles.chipActiveDone : styles.chipActive),
            ]}
            onPress={() => onChangeGoalFilterMode(m)}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.chipText,
                goalFilterMode === m &&
                  (m === 'done' ? styles.chipTextActiveDone : styles.chipTextActive),
              ]}
            >
              {m === 'all'
                ? 'Tất cả'
                : m === 'lean'
                  ? 'Lean (Cơ)'
                  : m === 'fat'
                    ? 'Fat (Mỡ)'
                    : 'Đã đạt' +
                      (completedGoals.length > 0 ? ` (${completedGoals.length})` : '')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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
          {/* Active section */}
          {filteredActive.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionDot, styles.sectionDotActive]} />
                <Text style={styles.sectionTitle}>Đang thực hiện</Text>
                <View style={styles.sectionBadge}>
                  <Text style={styles.sectionBadgeText}>{filteredActive.length}</Text>
                </View>
              </View>
              {filteredActive.map(renderActiveGoalCard)}
            </>
          )}

          {/* Completed section */}
          {filteredCompleted.length > 0 && (
            <>
              <View style={[styles.sectionHeader, filteredActive.length > 0 && { marginTop: 18 }]}>
                <View style={[styles.sectionDot, styles.sectionDotDone]} />
                <Text style={[styles.sectionTitle, styles.sectionTitleDone]}>Đã đạt mục tiêu</Text>
                <View style={[styles.sectionBadge, styles.sectionBadgeDone]}>
                  <Text style={[styles.sectionBadgeText, styles.sectionBadgeTextDone]}>
                    {filteredCompleted.length}
                  </Text>
                </View>
              </View>
              {filteredCompleted.map(renderCompletedGoalCard)}
            </>
          )}
        </>
      )}
    </>
  );
}

export const GoalsTab = memo(GoalsTabComponent);

const styles = StyleSheet.create({
  // Summary
  summaryRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryLabel: { fontSize: 10, color: Colors.textMuted, marginBottom: 4 },
  summaryVal: { fontSize: 18, fontWeight: '700' },

  // Chips
  chipRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '20' },
  chipActiveDone: { borderColor: Colors.success, backgroundColor: Colors.success + '20' },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: Colors.accent },
  chipTextActiveDone: { color: Colors.success },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionDotActive: { backgroundColor: Colors.accent },
  sectionDotDone: { backgroundColor: Colors.success },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    flex: 1,
  },
  sectionTitleDone: { color: Colors.success },
  sectionBadge: {
    backgroundColor: Colors.accent + '25',
    borderRadius: 99,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  sectionBadgeDone: { backgroundColor: Colors.success + '25' },
  sectionBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.accent },
  sectionBadgeTextDone: { color: Colors.success },

  // Active goal card
  activeCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },
  activeCardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  pctBadge: {
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pctBadgeGood: { backgroundColor: Colors.success + '25' },
  pctBadgeWarn: { backgroundColor: Colors.warning + '25' },
  pctBadgeText: { fontSize: 11, fontWeight: '700' },
  pctGoodText: { color: Colors.success },
  pctWarnText: { color: Colors.warning },

  // Progress bar
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  progressTrack: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 999 },
  progressFillGood: { backgroundColor: Colors.success },
  progressFillWarn: { backgroundColor: Colors.warning },
  progressPctLabel: { fontSize: 11, fontWeight: '700', minWidth: 32, textAlign: 'right' },

  // Numbers row
  numsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  numBox: {},
  numBoxRight: { alignItems: 'flex-end' },
  numLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  numVal: { fontSize: 14, fontWeight: '700', color: Colors.text },
  gapBox: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  gapBoxGood: { backgroundColor: Colors.success + '15' },
  gapBoxWarn: { backgroundColor: Colors.warning + '15' },
  gapLabel: { fontSize: 10, color: Colors.textMuted, marginBottom: 2 },
  gapVal: { fontSize: 13, fontWeight: '700' },

  // Deadline
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  deadlineRowUrgent: {
    backgroundColor: Colors.error + '15',
    borderWidth: 1,
    borderColor: Colors.error + '40',
  },
  deadlineIcon: { fontSize: 12 },
  deadlineText: { fontSize: 12, color: Colors.textMuted },
  deadlineTextUrgent: { color: Colors.error },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 2,
  },
  actionBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.surfaceElevated,
  },
  actionBtnDanger: {
    borderColor: Colors.error + '66',
    backgroundColor: Colors.error + '15',
  },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  actionBtnDangerText: { color: Colors.error },

  // Completed card
  completedCard: {
    backgroundColor: Colors.success + '0D',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.success + '35',
    marginBottom: 10,
  },
  completedCardInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  checkBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkIcon: { fontSize: 16, color: '#fff', fontWeight: '700' },
  completedCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 3,
  },
  completedCardDate: { fontSize: 11, color: Colors.textMuted, marginBottom: 8 },
  completedNumsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  completedNum: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  completedArrow: { fontSize: 12, color: Colors.textMuted },
  completedTarget: { fontSize: 13, color: Colors.success, fontWeight: '700' },
  completedChip: {
    backgroundColor: Colors.success,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 4,
  },
  completedChipText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  completedTrack: {
    height: 4,
    backgroundColor: Colors.success + '30',
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 10,
  },
  completedFill: {
    height: '100%',
    width: '100%',
    backgroundColor: Colors.success,
    borderRadius: 999,
  },

  // Empty
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
