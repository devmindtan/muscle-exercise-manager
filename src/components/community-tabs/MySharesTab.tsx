import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  Image,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Share2,
  Trash2,
  Users,
  Link as LinkIcon,
  Globe,
  X,
  FolderOpen,
  Library,
  Compass,
  Download,
  Upload,
} from 'lucide-react-native';
import { Colors } from '@/src/constants/colors';
import { useAuth } from '@/src/context/AuthContext';
import { SegmentedSubTabs, SubTabItem } from '@/src/components/common/SegmentedSubTabs';
import { getWorkoutPlans, WorkoutPlan, WEEK_DAYS, WeekDayKey } from '@/src/services/weeklyPlanService';
import {
  createPlanShare,
  getMyPlanShares,
  importPlanEntries,
  listPublicPlanShares,
  resolveSharedPlan,
  revokePlanShare,
  PlanShareItem,
  PublicPlanShareItem,
  SharedPlanEntryRow,
} from '@/src/services/socialService';
import {
  exportWorkoutPlan,
  pickAndReadJsonFile,
  parsePlanExportFile,
  saveAndShareJson,
} from '@/src/services/planExportImportService';

const DAY_LABEL: Record<string, string> = WEEK_DAYS.reduce((acc, d) => {
  acc[d.key] = d.label;
  return acc;
}, {} as Record<string, string>);

// Đổi tên: "Của tôi" -> "Giáo án của tôi", "Khám phá" -> "Cộng đồng"
const TAB_LIBRARY = 'library';
const TAB_COMMUNITY = 'community';

export function MySharesTab() {
  const { user } = useAuth();
  const userKey = user?.id || 'guest';

  const [activeSubTab, setActiveSubTab] = useState(TAB_LIBRARY);
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [shares, setShares] = useState<PlanShareItem[]>([]);
  const [publicShares, setPublicShares] = useState<PublicPlanShareItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [importCode, setImportCode] = useState('');
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState('');

  const [previewShareCode, setPreviewShareCode] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<SharedPlanEntryRow[]>([]);
  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState('');

  const [shareMenuForPlanId, setShareMenuForPlanId] = useState<string | null>(null);
  const [exportingPlanId, setExportingPlanId] = useState<string | null>(null);
  const [fileImportBusy, setFileImportBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [nextPlans, nextShares, nextPublicShares] = await Promise.all([
        getWorkoutPlans(userKey),
        getMyPlanShares(),
        listPublicPlanShares(),
      ]);
      setPlans(nextPlans);
      setShares(nextShares);
      setPublicShares(nextPublicShares);
      setError('');
    } catch (e: any) {
      setError(e?.message || 'Không thể tải dữ liệu chia sẻ.');
    } finally {
      setLoading(false);
    }
  }, [userKey]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const share = async (planId: string, visibility: 'link' | 'friends', isPublic: boolean) => {
    try {
      await createPlanShare(planId, visibility, isPublic);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Không thể tạo link chia sẻ.');
    } finally {
      setShareMenuForPlanId(null);
    }
  };

  const revoke = async (id: string) => {
    await revokePlanShare(id);
    await load();
  };

  const openPreview = async (shareCode: string) => {
    const trimmed = shareCode.trim();
    if (!trimmed) return;
    setPreviewBusy(true);
    setPreviewError('');
    try {
      const rows = await resolveSharedPlan(trimmed);
      if (rows.length === 0) {
        setPreviewError('Không tìm thấy kế hoạch chia sẻ, hoặc bạn không có quyền xem.');
        return;
      }
      setPreviewRows(rows);
      setPreviewShareCode(trimmed);
      setImportMessage('');
    } catch (e: any) {
      setPreviewError(e?.message || 'Không thể xem trước kế hoạch.');
    } finally {
      setPreviewBusy(false);
    }
  };

  const closePreview = () => {
    setPreviewShareCode(null);
    setPreviewRows([]);
    setImportMessage('');
  };

  const confirmImport = async () => {
    if (previewRows.length === 0) return;
    setImportBusy(true);
    try {
      const result = await importPlanEntries(previewRows, previewRows[0]?.plan_name || 'Kế hoạch đã nhập');
      setImportMessage(`Đã nhập "${result.planName}" (${result.importedEntries} mục).`);
      setImportCode('');
      await load();
    } catch (e: any) {
      setImportMessage(e?.message || 'Không thể nhập kế hoạch.');
    } finally {
      setImportBusy(false);
    }
  };

  const exportPlan = async (plan: WorkoutPlan) => {
    setExportingPlanId(plan.id);
    try {
      const json = await exportWorkoutPlan(userKey, plan.id, plan.name);
      await saveAndShareJson(json, plan.name);
    } catch (e: any) {
      setError(e?.message || 'Không thể xuất file kế hoạch.');
    } finally {
      setExportingPlanId(null);
    }
  };

  const importFromFile = async () => {
    setFileImportBusy(true);
    setPreviewError('');
    try {
      const json = await pickAndReadJsonFile();
      if (!json) return;
      const { entries } = parsePlanExportFile(json);
      setImportMessage('');
      setPreviewRows(entries);
    } catch (e: any) {
      setPreviewError(e?.message || 'Không thể đọc file kế hoạch.');
    } finally {
      setFileImportBusy(false);
    }
  };

  const sharesByPlan = shares.reduce<Record<string, PlanShareItem[]>>((acc, s) => {
    (acc[s.planId] ??= []).push(s);
    return acc;
  }, {});

  const previewByDay = previewRows.reduce<Record<string, SharedPlanEntryRow[]>>((acc, row) => {
    (acc[row.day_key] ??= []).push(row);
    return acc;
  }, {});

  const activeShareCount = shares.length;

  const subTabs: SubTabItem[] = [
    {
      key: TAB_LIBRARY,
      label: 'Giáo án của tôi',
      icon: ({ color, size, strokeWidth }) => (
        <Library color={color} size={size} strokeWidth={strokeWidth} />
      ),
      count: activeShareCount,
    },
    {
      key: TAB_COMMUNITY,
      label: 'Cộng đồng',
      icon: ({ color, size, strokeWidth }) => (
        <Compass color={color} size={size} strokeWidth={strokeWidth} />
      ),
      count: publicShares.length,
    },
  ];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={[styles.mutedText, { marginTop: 12 }]}>Đang tải dữ liệu...</Text>
      </View>
    );
  }

  const renderLibrary = () => (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
      }
    >
      <View style={styles.summaryContainer}>
        <Text style={styles.subTabSummary}>
          {plans.length} kế hoạch tổng hợp ·{' '}
          <Text style={{ color: Colors.accent }}>{activeShareCount} đang chia sẻ</Text>
        </Text>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {plans.length === 0 ? (
        <View style={styles.emptyState}>
          <FolderOpen color={Colors.textMuted} size={40} strokeWidth={1.5} />
          <Text style={styles.emptyText}>Chưa có kế hoạch nào.</Text>
          <Text style={styles.emptySubText}>Hãy tạo kế hoạch mới ở tab "Tập luyện" trước nhé!</Text>
        </View>
      ) : (
        plans.map((plan) => {
          const planShares = sharesByPlan[plan.id] || [];
          return (
            <View key={plan.id} style={styles.planCard}>
              <View style={styles.planCardHeader}>
                <Text style={styles.planName} numberOfLines={1}>{plan.name}</Text>
                <TouchableOpacity
                  style={styles.exportPlanBtn}
                  onPress={() => exportPlan(plan)}
                  disabled={exportingPlanId === plan.id}
                  activeOpacity={0.7}
                >
                  {exportingPlanId === plan.id ? (
                    <ActivityIndicator size="small" color={Colors.textSecondary} />
                  ) : (
                    <>
                      <Download color={Colors.textSecondary} size={13} strokeWidth={2} />
                      <Text style={styles.exportPlanBtnText}>Xuất file</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.shareMenuBtn}
                  onPress={() => setShareMenuForPlanId(plan.id)}
                  activeOpacity={0.7}
                >
                  <Share2 color={Colors.accent} size={13} strokeWidth={2} />
                  <Text style={styles.shareMenuBtnText}>Chia sẻ</Text>
                </TouchableOpacity>
              </View>

              {planShares.length > 0 && (
                <View style={styles.shareChipsRow}>
                  {planShares.map((s) => (
                    <View key={s.id} style={styles.shareChip}>
                      {s.isPublic ? (
                        <Globe color={Colors.accent} size={12} strokeWidth={2} />
                      ) : s.visibility === 'friends' ? (
                        <Users color={Colors.accent} size={12} strokeWidth={2} />
                      ) : (
                        <LinkIcon color={Colors.accent} size={12} strokeWidth={2} />
                      )}
                      <Text style={styles.shareChipCode}>{s.shareCode}</Text>
                      <TouchableOpacity onPress={() => revoke(s.id)} hitSlop={8}>
                        <X color={Colors.error} size={12} strokeWidth={2.5} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );

  const renderCommunity = () => (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
      }
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Nhập mã nhận giáo án</Text>
        <View style={styles.importRow}>
          <TextInput
            style={styles.importInput}
            value={importCode}
            onChangeText={setImportCode}
            placeholder="Nhập mã chia sẻ (VD: AB3D9F2K)"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="characters"
          />
          <TouchableOpacity
            style={[styles.importBtn, !importCode.trim() && styles.disabledBtn]}
            onPress={() => openPreview(importCode)}
            disabled={previewBusy || !importCode.trim()}
            activeOpacity={0.8}
          >
            {previewBusy ? (
              <ActivityIndicator size="small" color={Colors.bg} />
            ) : (
              <Text style={styles.importBtnText}>Xem trước</Text>
            )}
          </TouchableOpacity>
        </View>
        {previewError ? <Text style={styles.errorText}>{previewError}</Text> : null}

        <View style={styles.orDivider}>
          <View style={styles.orDividerLine} />
          <Text style={styles.orDividerText}>hoặc</Text>
          <View style={styles.orDividerLine} />
        </View>

        <TouchableOpacity
          style={styles.fileImportBtn}
          onPress={importFromFile}
          disabled={fileImportBusy}
          activeOpacity={0.8}
        >
          {fileImportBusy ? (
            <ActivityIndicator size="small" color={Colors.accent} />
          ) : (
            <>
              <Upload color={Colors.accent} size={14} strokeWidth={2} />
              <Text style={styles.fileImportBtnText}>Nhập từ file JSON</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cộng đồng chia sẻ ({publicShares.length})</Text>
        {publicShares.length === 0 ? (
          <View style={styles.emptyStateMini}>
            <Text style={styles.mutedText}>Chưa có kế hoạch công khai nào xuất hiện.</Text>
          </View>
        ) : (
          publicShares.map((s) => (
            <TouchableOpacity
              key={s.shareCode}
              style={styles.publicShareCard}
              onPress={() => openPreview(s.shareCode)}
              activeOpacity={0.8}
            >
              <View style={styles.publicShareInfo}>
                <Text style={styles.publicSharePlanName} numberOfLines={1}>{s.planName}</Text>
                <Text style={styles.publicShareAuthor} numberOfLines={1}>
                  Tác giả:{' '}
                  <Text style={{ fontWeight: '600', color: Colors.textSecondary }}>
                    {s.ownerDisplayName || 'Ẩn danh'}
                  </Text>{' '}
                  · Mã: {s.shareCode}
                </Text>
              </View>
              <View style={styles.circleArrow}>
                <Globe color={Colors.accent} size={14} strokeWidth={2} />
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <SegmentedSubTabs tabs={subTabs} activeKey={activeSubTab} onChange={setActiveSubTab} />

      {activeSubTab === TAB_LIBRARY ? renderLibrary() : renderCommunity()}

      {/* Xem trước kế hoạch chia sẻ trước khi tải về */}
      <Modal visible={previewRows.length > 0} transparent animationType="slide" onRequestClose={closePreview}>
        <Pressable style={styles.overlay} onPress={closePreview} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {previewRows[0]?.plan_name || 'Xem trước kế hoạch'}
            </Text>
            <TouchableOpacity onPress={closePreview} style={styles.closeSheetBtn}>
              <X color={Colors.textSecondary} size={18} />
            </TouchableOpacity>
          </View>
          <Text style={styles.previewAuthor}>
            Người tạo:{' '}
            <Text style={{ fontWeight: '600' }}>{previewRows[0]?.owner_display_name || 'Người dùng'}</Text>
          </Text>

          <ScrollView style={styles.previewScroll} showsVerticalScrollIndicator={true}>
            {WEEK_DAYS.map(({ key }) => {
              const rows = previewByDay[key as WeekDayKey];
              if (!rows || rows.length === 0) return null;
              return (
                <View key={key} style={styles.previewDayBlock}>
                  <View style={styles.dayLabelBadge}>
                    <Text style={styles.previewDayLabel}>{DAY_LABEL[key]}</Text>
                  </View>
                  {rows.map((row, idx) => (
                    <View key={idx} style={styles.previewEntryRow}>
                      {row.exercise_image_uri ? (
                        <Image source={{ uri: row.exercise_image_uri }} style={styles.previewEntryImg} />
                      ) : (
                        <View style={[styles.previewEntryImg, styles.fallbackImgPlaceholder]} />
                      )}
                      <View style={styles.previewEntryInfo}>
                        <Text style={styles.previewEntryMuscle}>{row.muscle_group_name}</Text>
                        {row.exercise_name ? (
                          <Text style={styles.previewEntryExercise}>
                            {row.exercise_name}
                            {row.parent_exercise_name ? ` (${row.parent_exercise_name})` : ''}
                          </Text>
                        ) : null}
                        <View style={styles.setsBadge}>
                          <Text style={styles.previewEntrySets}>{row.sets} Sets</Text>
                        </View>
                        {row.note ? <Text style={styles.previewEntryNote}>* {row.note}</Text> : null}
                      </View>
                    </View>
                  ))}
                </View>
              );
            })}
          </ScrollView>

          {importMessage ? (
            <View style={styles.messageBanner}>
              <Text style={styles.importMessage}>{importMessage}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.saveBtn, importBusy && styles.saveBtnDisabled]}
            onPress={confirmImport}
            disabled={importBusy}
            activeOpacity={0.8}
          >
            {importBusy ? (
              <ActivityIndicator size="small" color={Colors.bg} />
            ) : (
              <Text style={styles.saveBtnText}>Tải giáo án này về máy</Text>
            )}
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Menu chọn kiểu chia sẻ mới — thay cho 3 nút luôn hiện trên mỗi thẻ,
          giữ thẻ kế hoạch gọn khi có nhiều kế hoạch. */}
      <Modal
        visible={!!shareMenuForPlanId}
        transparent
        animationType="fade"
        onRequestClose={() => setShareMenuForPlanId(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setShareMenuForPlanId(null)} />
        <View style={styles.shareMenuSheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.shareMenuTitle}>Chia sẻ kế hoạch</Text>
          <TouchableOpacity
            style={styles.shareMenuOption}
            onPress={() => shareMenuForPlanId && share(shareMenuForPlanId, 'link', true)}
            activeOpacity={0.7}
          >
            <Globe color={Colors.accent} size={16} strokeWidth={2} />
            <View style={{ flex: 1 }}>
              <Text style={styles.shareMenuOptionTitle}>Công khai</Text>
              <Text style={styles.shareMenuOptionSub}>Ai cũng thấy trong danh sách cộng đồng</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.shareMenuOption}
            onPress={() => shareMenuForPlanId && share(shareMenuForPlanId, 'link', false)}
            activeOpacity={0.7}
          >
            <Share2 color={Colors.accent} size={16} strokeWidth={2} />
            <View style={{ flex: 1 }}>
              <Text style={styles.shareMenuOptionTitle}>Mã bí mật</Text>
              <Text style={styles.shareMenuOptionSub}>Chỉ ai có mã mới xem/tải được</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.shareMenuOption}
            onPress={() => shareMenuForPlanId && share(shareMenuForPlanId, 'friends', false)}
            activeOpacity={0.7}
          >
            <Users color={Colors.accent} size={16} strokeWidth={2} />
            <View style={{ flex: 1 }}>
              <Text style={styles.shareMenuOptionTitle}>Bạn bè</Text>
              <Text style={styles.shareMenuOptionSub}>Chỉ bạn bè đã kết nối mới xem được</Text>
            </View>
          </TouchableOpacity>
          <View style={{ height: 12 }} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg },
  mutedText: { color: Colors.textMuted, fontSize: 13 },
  errorText: { color: Colors.error, fontSize: 13, fontWeight: '500' },
  errorBanner: { backgroundColor: Colors.error + '15', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.error + '30' },
  summaryContainer: { marginBottom: 4 },
  subTabSummary: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  section: { gap: 12, marginBottom: 8 },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  importRow: { flexDirection: 'row', gap: 8 },
  importInput: {
    flex: 1, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: Colors.text, fontSize: 14,
  },
  importBtn: {
    paddingHorizontal: 16, borderRadius: 12, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center', minWidth: 90,
  },
  importBtnText: { color: Colors.bg, fontWeight: '700', fontSize: 13 },
  disabledBtn: { opacity: 0.5 },
  messageBanner: { backgroundColor: Colors.accent + '10', padding: 10, borderRadius: 8, marginVertical: 8 },
  importMessage: { fontSize: 12, color: Colors.accent, fontWeight: '600', textAlign: 'center' },
  orDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  orDividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  orDividerText: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  fileImportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: Colors.accent + '40', backgroundColor: Colors.accent + '10',
    borderRadius: 12, paddingVertical: 12,
  },
  fileImportBtnText: { fontSize: 13, fontWeight: '700', color: Colors.accent },

  // Empty states
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 8 },
  emptyStateMini: { backgroundColor: Colors.surface, padding: 20, borderRadius: 12, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: Colors.border },
  emptyText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary, marginTop: 8 },
  emptySubText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },

  // Cards
  publicShareCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    padding: 14, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 }, android: { elevation: 1 } }),
  },
  publicShareInfo: { flex: 1, gap: 4, marginRight: 8 },
  publicSharePlanName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  publicShareAuthor: { fontSize: 12, color: Colors.textMuted },
  circleArrow: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.accent + '10', alignItems: 'center', justifyContent: 'center' },

  planCard: {
    backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12, gap: 8,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2 }, android: { elevation: 1 } }),
  },
  planCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  planName: { fontSize: 14, fontWeight: '700', color: Colors.text, flex: 1 },
  shareMenuBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: Colors.accent + '40', backgroundColor: Colors.accent + '10',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  shareMenuBtnText: { fontSize: 11, fontWeight: '700', color: Colors.accent },
  exportPlanBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  exportPlanBtnText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },

  // Share chips — 1 dòng gọn/mã, thay vì thẻ đầy đủ như trước
  shareChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  shareChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.bg, borderRadius: 8, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 8, paddingVertical: 5,
  },
  shareChipCode: {
    fontSize: 12, fontWeight: '700', color: Colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  // Menu chọn kiểu chia sẻ (bottom sheet nhỏ)
  shareMenuSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: 12,
    position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  shareMenuTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  shareMenuOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  shareMenuOptionTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  shareMenuOptionSub: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },

  // Bottom Sheet Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 24,
    maxHeight: '80%',
    position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  sheetHandle: {
    width: 40, height: 5, borderRadius: 2.5, backgroundColor: Colors.border,
    alignSelf: 'center', marginVertical: 12,
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, flex: 1, marginRight: 8 },
  closeSheetBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  previewAuthor: { fontSize: 13, color: Colors.textMuted, marginBottom: 16 },
  previewScroll: { maxHeight: 350, marginBottom: 12 },

  // Preview components inside modal
  previewDayBlock: { marginBottom: 16 },
  dayLabelBadge: { backgroundColor: Colors.text + '05', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 8 },
  previewDayLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  previewEntryRow: {
    flexDirection: 'row', gap: 12, backgroundColor: Colors.bg,
    borderRadius: 12, padding: 12, marginBottom: 8, alignItems: 'center',
  },
  previewEntryImg: { width: 48, height: 48, borderRadius: 8, backgroundColor: Colors.border },
  fallbackImgPlaceholder: { borderWidth: 1, borderStyle: 'dashed' },
  previewEntryInfo: { flex: 1, gap: 2 },
  previewEntryMuscle: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' },
  previewEntryExercise: { fontSize: 14, color: Colors.text, fontWeight: '600' },
  setsBadge: { backgroundColor: Colors.accent + '10', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginTop: 2 },
  previewEntrySets: { fontSize: 11, color: Colors.accent, fontWeight: '600' },
  previewEntryNote: { fontSize: 11, color: Colors.textMuted, fontStyle: 'italic', marginTop: 2 },

  saveBtn: {
    backgroundColor: Colors.accent, padding: 16, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', height: 54,
  },
  saveBtnText: { color: Colors.bg, fontWeight: '700', fontSize: 15 },
  saveBtnDisabled: { opacity: 0.6 },
});