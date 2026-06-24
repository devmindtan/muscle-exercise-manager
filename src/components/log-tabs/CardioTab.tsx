import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Check,
  X,
  Clock,
  Search,
  Flame,
  Timer,
} from 'lucide-react-native';
import {
  insertCardioLog,
  getRecentCardioLogs,
  softDeleteCardioLog,
} from '@/src/lib/repository';
import type { CardioLog } from '@/src/lib/repository';
import { Colors } from '@/src/constants/colors';
import { useSync } from '@/src/context/SyncContext';
import { CardioHistoryTabSection, groupCardioLogsByWeek, groupCardioLogsByMonth } from './CardioGrowthChart';

const CARDIO_ACCENT = '#F97316';
const PAGE_SIZE = 10;

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

export default function CardioTab() {
  const { lastSyncAt, sync } = useSync();
  const [cardioLogs, setCardioLogs] = useState<CardioLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);

  const [cardioName, setCardioName] = useState('');
  const [cardioDuration, setCardioDuration] = useState('');
  const [cardioNote, setCardioNote] = useState('');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [selectedWeekKey, setSelectedWeekKey] = useState<string | null>(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);

  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); }, []);

  const weeklyHistory = useMemo(() => groupCardioLogsByWeek(cardioLogs), [cardioLogs]);
  const monthlyHistory = useMemo(() => groupCardioLogsByMonth(cardioLogs), [cardioLogs]);

  const load = useCallback(async () => {
    try {
      const logs = await getRecentCardioLogs();
      setCardioLogs(logs);
      setVisibleCount(PAGE_SIZE);
    } catch (e: unknown) {
      console.error('Failed to load cardio logs:', e);
      setError(e instanceof Error ? e.message : 'Không thể tải dữ liệu cardio');
      setCardioLogs([]);
    } finally {
      setLoading(false);
    }
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

  const logCardio = async () => {
    if (!cardioName.trim()) { setError('Nhập tên cardio'); return; }
    if (!cardioDuration || isNaN(Number(cardioDuration)) || Number(cardioDuration) <= 0) {
      setError('Nhập thời gian hợp lệ'); return;
    }
    setSaving(true);
    setError('');
    try {
      await insertCardioLog({
        name: cardioName.trim(),
        duration_minutes: parseInt(cardioDuration),
        note: cardioNote.trim() || null,
        logged_at: new Date().toISOString(),
      });
      await sync();
      setSaved(true);
      savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
      setCardioName('');
      setCardioDuration('');
      setCardioNote('');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Lỗi không xác định');
    } finally {
      setSaving(false);
    }
  };

  const deleteLog = async (logId: string) => {
    await softDeleteCardioLog(logId);
    await load();
  };

  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return cardioLogs;
    const q = searchQuery.trim().toLowerCase();
    return cardioLogs.filter((l) => l.name.toLowerCase().includes(q));
  }, [cardioLogs, searchQuery]);

  const displayedLogs = filteredLogs.slice(0, visibleCount);
  const hasMore = visibleCount < filteredLogs.length;

  return (
    <>
      {/* ── Form card ── */}
      <View style={styles.card}>
        <Text style={styles.label}>Tên cardio</Text>
        <TextInput
          style={styles.nameInput}
          placeholder="VD: Chạy bộ, Đạp xe, Jump rope..."
          placeholderTextColor={Colors.textMuted}
          value={cardioName}
          onChangeText={setCardioName}
        />

        <Text style={styles.label}>Thời gian</Text>
        <View style={styles.inputWrapper}>
          <Timer color={Colors.textMuted} size={15} strokeWidth={1.8} style={{ marginRight: 6 }} />
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            placeholder="—"
            placeholderTextColor={Colors.textMuted}
            value={cardioDuration}
            onChangeText={setCardioDuration}
          />
          <Text style={styles.inputUnit}>phút</Text>
        </View>

        <Text style={styles.label}>Ghi chú</Text>
        <TextInput
          style={styles.noteInput}
          placeholder="VD: nhịp tim ổn, mệt nhẹ cuối..."
          placeholderTextColor={Colors.textMuted}
          value={cardioNote}
          onChangeText={setCardioNote}
          multiline
          numberOfLines={3}
        />

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.logBtn, saved && styles.logBtnSaved, saving && styles.logBtnSaving]}
          onPress={logCardio}
          disabled={saving || saved}
          activeOpacity={0.85}
        >
          {saved ? (
            <>
              <Check color="#fff" size={18} strokeWidth={2.5} />
              <Text style={styles.logBtnText}>Đã lưu!</Text>
            </>
          ) : (
            <>
              <Flame color="#fff" size={18} strokeWidth={2} />
              <Text style={styles.logBtnText}>{saving ? 'Đang lưu...' : 'Lưu cardio'}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ── History chart ── */}
      <CardioHistoryTabSection
        historyLoading={loading}
        weeklyHistory={weeklyHistory}
        monthlyHistory={monthlyHistory}
        selectedWeekKey={selectedWeekKey}
        selectedMonthKey={selectedMonthKey}
        setSelectedWeekKey={setSelectedWeekKey}
        setSelectedMonthKey={setSelectedMonthKey}
      />

      {/* ── Log list ── */}
      {cardioLogs.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Gần đây</Text>
          </View>

          {/* Search */}
          <View style={styles.searchBar}>
            <Search color={Colors.textMuted} size={15} strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm tên cardio..."
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={(t) => { setSearchQuery(t); setVisibleCount(PAGE_SIZE); }}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X color={Colors.textMuted} size={14} />
              </TouchableOpacity>
            )}
          </View>

          {displayedLogs.length === 0 && (
            <Text style={styles.noResults}>Không tìm thấy kết quả</Text>
          )}

          <View style={styles.logList}>
            {displayedLogs.map((log) => (
              <View key={log.id} style={styles.logRow}>
                <View style={styles.logAccent} />
                <View style={styles.logBody}>
                  <View style={styles.logTopRow}>
                    <Text style={styles.logName} numberOfLines={1}>{log.name}</Text>
                    <TouchableOpacity
                      onPress={() => deleteLog(log.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <X color={Colors.textMuted} size={14} strokeWidth={2} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.logStats}>
                    <View style={styles.logTag}>
                      <Text style={styles.logTagText}>Cardio</Text>
                    </View>
                    <Timer color={Colors.textSecondary} size={11} strokeWidth={1.8} />
                    <Text style={styles.logStatText}>{log.duration_minutes} phút</Text>
                  </View>

                  {log.note ? (
                    <Text style={styles.logNote} numberOfLines={2}>{log.note}</Text>
                  ) : null}

                  <View style={styles.logTimeRow}>
                    <Clock color={Colors.textMuted} size={10} strokeWidth={1.8} />
                    <Text style={styles.logTimeText}>{formatTime(log.logged_at)}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {hasMore && (
            <TouchableOpacity
              style={styles.loadMoreBtn}
              onPress={() => setVisibleCount((v) => v + PAGE_SIZE)}
              activeOpacity={0.7}
            >
              <Text style={styles.loadMoreText}>
                Xem thêm · {filteredLogs.length - visibleCount} mục
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  /* Form card */
  card: {
    marginHorizontal: 16,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 28,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  nameInput: {
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 18,
    color: Colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 18,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  inputUnit: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  noteInput: {
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
    minHeight: 80,
    marginBottom: 18,
    color: Colors.text,
    fontSize: 14,
  },

  /* Error */
  errorBanner: {
    backgroundColor: Colors.error + '15',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.error + '30',
  },
  errorText: { color: Colors.error, fontSize: 13, fontWeight: '500' },

  /* Log button */
  logBtn: {
    backgroundColor: CARDIO_ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  logBtnSaved: { backgroundColor: Colors.success },
  logBtnSaving: { opacity: 0.7 },
  logBtnText: { fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },

  /* Section header */
  sectionHeader: { paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  /* Search */
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14 },
  noResults: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: 13,
    paddingVertical: 24,
  },

  /* Log list */
  logList: { paddingHorizontal: 16, gap: 8 },
  logRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: 8,
  },
  logAccent: {
    width: 4,
    backgroundColor: CARDIO_ACCENT,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  logBody: { flex: 1, padding: 14 },
  logTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  logName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
    marginRight: 8,
  },
  logStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  logTag: {
    backgroundColor: CARDIO_ACCENT + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  logTagText: { fontSize: 11, fontWeight: '700', color: CARDIO_ACCENT },
  logStatText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  logNote: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 17,
    marginBottom: 6,
    fontStyle: 'italic',
  },
  logTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  logTimeText: { fontSize: 11, color: Colors.textMuted },

  /* Load more */
  loadMoreBtn: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  loadMoreText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
});