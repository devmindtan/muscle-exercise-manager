import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { UserPlus, Check, X } from 'lucide-react-native';
import { Colors } from '@/src/constants/colors';
import { useAuth } from '@/src/context/AuthContext';
import {
  FriendshipItem,
  getMyFriendships,
  getProfileByUserId,
  getUserTag,
  PublicProfile,
  removeFriendship,
  respondToFriendRequest,
} from '@/src/services/socialService';
import { ProfileDetailModal, ProfileRelation } from './ProfileDetailModal';
import { AvatarCircle } from './AvatarCircle';

type FriendRow = FriendshipItem & { otherProfile: PublicProfile | null; otherUserId: string };

export function FriendsTab() {
  const { user } = useAuth();
  const [rows, setRows] = useState<FriendRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selectedRow, setSelectedRow] = useState<FriendRow | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const friendships = await getMyFriendships();
      const withProfiles = await Promise.all(
        friendships.map(async (f) => {
          const otherUserId = f.requesterId === user.id ? f.addresseeId : f.requesterId;
          const otherProfile = await getProfileByUserId(otherUserId).catch(() => null);
          return { ...f, otherProfile, otherUserId };
        }),
      );
      withProfiles.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setRows(withProfiles);
      setError('');
    } catch (e: any) {
      setError(e?.message || 'Không thể tải danh sách bạn bè.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const accept = async (id: string) => {
    await respondToFriendRequest(id, 'accepted');
    await load();
  };
  const decline = async (id: string) => {
    await respondToFriendRequest(id, 'declined');
    await load();
  };
  const unfriend = async (targetUserId: string) => {
    const row = rows.find((r) => r.otherUserId === targetUserId);
    if (!row) return;
    await removeFriendship(row.id);
    setSelectedRow(null);
    await load();
  };

  const incoming = rows.filter((r) => r.status === 'pending' && r.requesterId !== user?.id);
  const outgoing = rows.filter((r) => r.status === 'pending' && r.requesterId === user?.id);
  const accepted = rows.filter((r) => r.status === 'accepted');

  const relationForRow = (r: FriendRow): ProfileRelation =>
    r.status === 'accepted' ? 'friend' : 'pending';

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.mutedText}>Đang tải...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
    >
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {incoming.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lời mời kết bạn ({incoming.length})</Text>
          {incoming.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => setSelectedRow(r)}
            >
              <AvatarCircle uri={r.otherProfile?.avatarUrl} />
              <View style={styles.rowInfo}>
                <Text style={styles.rowName}>
                  {r.otherProfile?.displayName || 'Người dùng'}
                  <Text style={styles.rowTag}> #{getUserTag(r.otherUserId)}</Text>
                </Text>
              </View>
              <View style={styles.rowActions}>
                <TouchableOpacity
                  style={styles.acceptBtn}
                  onPress={(e) => { e.stopPropagation(); accept(r.id); }}
                >
                  <Check color={Colors.bg} size={14} strokeWidth={2.5} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.declineBtn}
                  onPress={(e) => { e.stopPropagation(); decline(r.id); }}
                >
                  <X color={Colors.error} size={14} strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bạn bè ({accepted.length})</Text>
        {accepted.length === 0 ? (
          <Text style={styles.mutedText}>Chưa có bạn bè nào. Dùng tab &quot;Khám phá&quot; để tìm và kết bạn.</Text>
        ) : (
          accepted.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => setSelectedRow(r)}
            >
              <AvatarCircle uri={r.otherProfile?.avatarUrl} />
              <View style={styles.rowInfo}>
                <Text style={styles.rowName}>
                  {r.otherProfile?.displayName || 'Người dùng'}
                  <Text style={styles.rowTag}> #{getUserTag(r.otherUserId)}</Text>
                </Text>
                {r.otherProfile?.bio ? (
                  <Text style={styles.rowBio} numberOfLines={1}>{r.otherProfile.bio}</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {outgoing.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Đã gửi lời mời ({outgoing.length})</Text>
          {outgoing.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => setSelectedRow(r)}
            >
              <AvatarCircle uri={r.otherProfile?.avatarUrl} />
              <View style={styles.rowInfo}>
                <Text style={styles.rowName}>
                  {r.otherProfile?.displayName || 'Người dùng'}
                  <Text style={styles.rowTag}> #{getUserTag(r.otherUserId)}</Text>
                </Text>
                <Text style={styles.rowBio}>Đang chờ chấp nhận</Text>
              </View>
              <UserPlus color={Colors.textMuted} size={14} strokeWidth={2} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ProfileDetailModal
        visible={!!selectedRow}
        profile={selectedRow?.otherProfile ?? null}
        relation={selectedRow ? relationForRow(selectedRow) : 'none'}
        onClose={() => setSelectedRow(null)}
        onUnfriend={unfriend}
      />
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
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12, gap: 10,
  },
  rowInfo: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  rowTag: { fontSize: 11, fontWeight: '500', color: Colors.textMuted, fontFamily: 'monospace' },
  rowBio: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  rowActions: { flexDirection: 'row', gap: 8 },
  acceptBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  declineBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.error + '15',
    borderWidth: 1, borderColor: Colors.error + '40',
    alignItems: 'center', justifyContent: 'center',
  },
});
