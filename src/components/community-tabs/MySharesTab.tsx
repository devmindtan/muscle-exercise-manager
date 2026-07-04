import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Share2, Trash2, Users, Link as LinkIcon } from 'lucide-react-native';
import { Colors } from '@/src/constants/colors';
import { useAuth } from '@/src/context/AuthContext';
import { getWorkoutPlans, WorkoutPlan } from '@/src/services/weeklyPlanService';
import {
  createPlanShare,
  getMyPlanShares,
  importSharedPlan,
  PlanShareItem,
  revokePlanShare,
} from '@/src/services/socialService';

export function MySharesTab() {
  const { user } = useAuth();
  const userKey = user?.id || 'guest';

  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [shares, setShares] = useState<PlanShareItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [importCode, setImportCode] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const [nextPlans, nextShares] = await Promise.all([getWorkoutPlans(userKey), getMyPlanShares()]);
      setPlans(nextPlans);
      setShares(nextShares);
      setError('');
    } catch (e: any) {
      setError(e?.message || 'Không thể tải dữ liệu chia sẻ.');
    } finally {
      setLoading(false);
    }
  }, [userKey]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const share = async (planId: string, visibility: 'link' | 'friends') => {
    try {
      await createPlanShare(planId, visibility);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Không thể tạo link chia sẻ.');
    }
  };

  const revoke = async (id: string) => {
    await revokePlanShare(id);
    await load();
  };

  const doImport = async () => {
    if (!importCode.trim()) return;
    setImportBusy(true);
    setImportMessage('');
    try {
      const result = await importSharedPlan(importCode);
      setImportMessage(`Đã nhập "${result.planName}" (${result.importedEntries} mục).`);
      setImportCode('');
      await load();
    } catch (e: any) {
      setImportMessage(e?.message || 'Không thể nhập kế hoạch.');
    } finally {
      setImportBusy(false);
    }
  };

  const sharesByPlan = shares.reduce<Record<string, PlanShareItem[]>>((acc, s) => {
    (acc[s.planId] ??= []).push(s);
    return acc;
  }, {});

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.mutedText}>Đang tải...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Nhập kế hoạch bằng mã</Text>
        <View style={styles.importRow}>
          <TextInput
            style={styles.importInput}
            value={importCode}
            onChangeText={setImportCode}
            placeholder="Nhập mã chia sẻ (VD: AB3D9F2K)"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="characters"
          />
          <TouchableOpacity style={styles.importBtn} onPress={doImport} disabled={importBusy}>
            <Text style={styles.importBtnText}>{importBusy ? '...' : 'Nhập'}</Text>
          </TouchableOpacity>
        </View>
        {importMessage ? <Text style={styles.importMessage}>{importMessage}</Text> : null}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Chia sẻ kế hoạch của tôi</Text>
        {plans.length === 0 ? (
          <Text style={styles.mutedText}>Chưa có kế hoạch nào. Tạo kế hoạch ở tab &quot;Tập luyện&quot; trước.</Text>
        ) : (
          plans.map((plan) => {
            const planShares = sharesByPlan[plan.id] || [];
            return (
              <View key={plan.id} style={styles.planCard}>
                <Text style={styles.planName}>{plan.name}</Text>

                {planShares.map((s) => (
                  <View key={s.id} style={styles.shareRow}>
                    {s.visibility === 'friends' ? (
                      <Users color={Colors.accent} size={13} strokeWidth={2} />
                    ) : (
                      <LinkIcon color={Colors.accent} size={13} strokeWidth={2} />
                    )}
                    <Text style={styles.shareCode}>{s.shareCode}</Text>
                    <Text style={styles.shareVisibility}>
                      {s.visibility === 'friends' ? 'Chỉ bạn bè' : 'Ai có mã cũng xem được'}
                    </Text>
                    <TouchableOpacity style={styles.revokeBtn} onPress={() => revoke(s.id)}>
                      <Trash2 color={Colors.error} size={13} strokeWidth={2} />
                    </TouchableOpacity>
                  </View>
                ))}

                <View style={styles.planActions}>
                  <TouchableOpacity style={styles.shareActionBtn} onPress={() => share(plan.id, 'link')}>
                    <Share2 color={Colors.accent} size={12} strokeWidth={2} />
                    <Text style={styles.shareActionBtnText}>Tạo mã công khai</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.shareActionBtn} onPress={() => share(plan.id, 'friends')}>
                    <Users color={Colors.accent} size={12} strokeWidth={2} />
                    <Text style={styles.shareActionBtnText}>Chỉ chia sẻ cho bạn bè</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  mutedText: { color: Colors.textMuted, fontSize: 13 },
  errorText: { color: Colors.error, fontSize: 13 },
  section: { gap: 10 },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  importRow: { flexDirection: 'row', gap: 8 },
  importInput: {
    flex: 1, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: Colors.text, fontSize: 14,
  },
  importBtn: {
    paddingHorizontal: 16, borderRadius: 10, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  importBtnText: { color: Colors.bg, fontWeight: '700', fontSize: 13 },
  importMessage: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  planCard: {
    backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    padding: 14, gap: 8,
  },
  planName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  shareRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
  },
  shareCode: { fontSize: 13, fontWeight: '700', color: Colors.accent, fontFamily: 'monospace' },
  shareVisibility: { fontSize: 10, color: Colors.textMuted, flex: 1 },
  revokeBtn: { padding: 4 },
  planActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  shareActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: Colors.accent + '55', backgroundColor: Colors.accent + '10',
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6,
  },
  shareActionBtnText: { fontSize: 11, fontWeight: '600', color: Colors.accent },
});
