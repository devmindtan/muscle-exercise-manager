import { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/src/constants/colors';
import type { BodyMeasurement } from '@/src/types/database';

interface InBodyRecord {
  key: string;
  measuredAt: string;
  note: string;
  rowsByMetric: Record<string, BodyMeasurement>;
}

interface HistoryTabProps {
  inBodyRecords: InBodyRecord[];
  formatDateFull: (value?: string | null) => string;
  onEditRecord: (record: InBodyRecord) => void;
  onDeleteRecord: (record: InBodyRecord) => void;
}

function HistoryTabComponent({
  inBodyRecords,
  formatDateFull,
  onEditRecord,
  onDeleteRecord,
}: HistoryTabProps) {
  return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Lịch sử</Text>
        <Text style={styles.sectionHint}>{inBodyRecords.length} bản InBody</Text>
      </View>

      {inBodyRecords.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Chưa có bản InBody nào</Text>
        </View>
      ) : (
        inBodyRecords.map((record) => {
          const totalMetrics = Object.keys(record.rowsByMetric).length;
          const focusMetric = record.rowsByMetric.skeletal_muscle_mass;
          return (
            <View key={record.key} style={styles.historyCard}>
              <View>
                <Text style={styles.historyTitle}>InBody - {formatDateFull(record.measuredAt)}</Text>
                <Text style={styles.historyDate}>{totalMetrics} chỉ số đã lưu</Text>
                {focusMetric ? (
                  <Text style={styles.historyDate}>
                    SMM: {focusMetric.value} {focusMetric.unit}
                  </Text>
                ) : null}
              </View>
              <View style={styles.historyRight}>
                <TouchableOpacity style={styles.editBtn} onPress={() => onEditRecord(record)} activeOpacity={0.75}>
                  <Text style={styles.editBtnText}>Sửa</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => onDeleteRecord(record)} activeOpacity={0.75}>
                  <Text style={styles.deleteBtnText}>Xóa</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}
    </>
  );
}

export const HistoryTab = memo(HistoryTabComponent);

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  sectionHint: { fontSize: 12, color: Colors.textSecondary },
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
  historyTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  historyDate: { fontSize: 11, color: Colors.textMuted, marginTop: 3 },
  historyRight: { alignItems: 'flex-end', gap: 8 },
  editBtn: {
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  editBtnText: { color: Colors.accent, fontSize: 12, fontWeight: '700' },
  deleteBtn: {
    borderWidth: 1,
    borderColor: Colors.warning,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deleteBtnText: { color: Colors.warning, fontSize: 12, fontWeight: '700' },
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
