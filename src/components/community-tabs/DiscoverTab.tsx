import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Search, UserPlus, Lock } from 'lucide-react-native';
import { Colors } from '@/src/constants/colors';
import { useAuth } from '@/src/context/AuthContext';
import {
  getMyFriendships,
  getUserTag,
  PublicProfile,
  removeFriendship,
  searchProfiles,
  sendFriendRequest,
} from '@/src/services/socialService';
import { ProfileDetailModal, ProfileRelation } from './ProfileDetailModal';
import { AvatarCircle } from './AvatarCircle';

export function DiscoverTab() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [statusByUserId, setStatusByUserId] = useState<Record<string, 'friend' | 'pending' | 'none'>>({});
  const [friendshipIdByUserId, setFriendshipIdByUserId] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [selectedProfile, setSelectedProfile] = useState<PublicProfile | null>(null);

  const load = useCallback(async (q: string) => {
    if (!user) return;
    setError('');
    try {
      const [profiles, friendships] = await Promise.all([searchProfiles(q), getMyFriendships()]);
      const statusMap: Record<string, 'friend' | 'pending' | 'none'> = {};
      const idMap: Record<string, string> = {};
      for (const f of friendships) {
        const other = f.requesterId === user.id ? f.addresseeId : f.requesterId;
        statusMap[other] = f.status === 'accepted' ? 'friend' : f.status === 'pending' ? 'pending' : 'none';
        idMap[other] = f.id;
      }
      setStatusByUserId(statusMap);
      setFriendshipIdByUserId(idMap);
      setResults(profiles);
    } catch (e: any) {
      setError(e?.message || 'Không thể tải danh sách người dùng.');
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load('').finally(() => setLoading(false));
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load(query);
    setRefreshing(false);
  };

  const runSearch = async () => {
    setLoading(true);
    await load(query);
    setLoading(false);
  };

  const addFriend = async (targetUserId: string) => {
    try {
      await sendFriendRequest(targetUserId);
      setSentTo((prev) => new Set(prev).add(targetUserId));
    } catch (e: any) {
      setError(e?.message || 'Không thể gửi lời mời.');
    }
  };

  const unfriend = async (targetUserId: string) => {
    const friendshipId = friendshipIdByUserId[targetUserId];
    if (!friendshipId) return;
    try {
      await removeFriendship(friendshipId);
      setSelectedProfile(null);
      await load(query);
    } catch (e: any) {
      setError(e?.message || 'Không thể huỷ kết bạn.');
    }
  };

  const getRelation = (profile: PublicProfile): ProfileRelation => {
    if (profile.userId === user?.id) return 'self';
    const status = statusByUserId[profile.userId] ?? 'none';
    if (status === 'friend') return 'friend';
    if (status === 'pending' || sentTo.has(profile.userId)) return 'pending';
    return 'none';
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
    >
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Search color={Colors.textMuted} size={16} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Tìm theo tên hiển thị (để trống để xem tất cả)..."
            placeholderTextColor={Colors.textMuted}
            onSubmitEditing={runSearch}
            returnKeyType="search"
          />
        </View>
        <TouchableOpacity style={styles.searchBtn} onPress={runSearch} disabled={loading}>
          <Text style={styles.searchBtnText}>{loading ? '...' : 'Tìm'}</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.list}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={[styles.mutedText, { marginTop: 12 }]}>Đang tải...</Text>
          </View>
        ) : (
          <>
            {results.map((profile) => {
              const isMe = profile.userId === user?.id;
              const status = statusByUserId[profile.userId] ?? 'none';
              const justSent = sentTo.has(profile.userId);
              return (
                <TouchableOpacity
                  key={profile.userId}
                  style={styles.row}
                  activeOpacity={0.7}
                  onPress={() => setSelectedProfile(profile)}
                >
                  <AvatarCircle uri={profile.avatarUrl} />
                  <View style={styles.rowInfo}>
                    <View style={styles.rowNameRow}>
                      <Text style={styles.rowName}>{profile.displayName || 'Người dùng'}</Text>
                      <Text style={styles.rowTag}>#{getUserTag(profile.userId)}</Text>
                      {isMe && (
                        <View style={styles.meBadge}>
                          <Text style={styles.meBadgeText}>Bạn</Text>
                        </View>
                      )}
                    </View>
                    {profile.isPrivate ? (
                      <View style={styles.privateBadge}>
                        <Lock color={Colors.textMuted} size={10} strokeWidth={2} />
                        <Text style={styles.privateBadgeText}>Riêng tư</Text>
                      </View>
                    ) : profile.bio ? (
                      <Text style={styles.rowBio} numberOfLines={1}>{profile.bio}</Text>
                    ) : null}
                  </View>
                  {isMe ? null : status === 'friend' ? (
                    <Text style={styles.statusText}>Bạn bè</Text>
                  ) : status === 'pending' || justSent ? (
                    <Text style={styles.statusText}>Đã gửi</Text>
                  ) : (
                    <TouchableOpacity
                      style={styles.addBtn}
                      onPress={(e) => { e.stopPropagation(); addFriend(profile.userId); }}
                    >
                      <UserPlus color={Colors.bg} size={13} strokeWidth={2.5} />
                      <Text style={styles.addBtnText}>Kết bạn</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}
            {results.length === 0 && (
              <Text style={styles.mutedText}>
                {query.trim() ? 'Không tìm thấy người dùng nào.' : 'Chưa có ai trong hệ thống.'}
              </Text>
            )}
          </>
        )}
      </View>

      <ProfileDetailModal
        visible={!!selectedProfile}
        profile={selectedProfile}
        relation={selectedProfile ? getRelation(selectedProfile) : 'none'}
        onClose={() => setSelectedProfile(null)}
        onAddFriend={(targetUserId) => { addFriend(targetUserId); }}
        onUnfriend={unfriend}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16 },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 10, color: Colors.text, fontSize: 14 },
  searchBtn: {
    paddingHorizontal: 16, borderRadius: 10, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  searchBtnText: { color: Colors.bg, fontWeight: '700', fontSize: 13 },
  errorText: { color: Colors.error, fontSize: 13 },
  mutedText: { color: Colors.textMuted, fontSize: 13 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  list: { gap: 10 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12, gap: 10,
  },
  rowInfo: { flex: 1, minWidth: 0 },
  rowNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  rowTag: { fontSize: 11, fontWeight: '500', color: Colors.textMuted, fontFamily: 'monospace' },
  rowBio: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  meBadge: {
    backgroundColor: Colors.accent + '20', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999,
  },
  meBadgeText: { fontSize: 9, fontWeight: '700', color: Colors.accent },
  privateBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, alignSelf: 'flex-start',
    backgroundColor: Colors.bg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999,
  },
  privateBadgeText: { fontSize: 9, color: Colors.textMuted, fontWeight: '600' },
  statusText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.accent, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7,
  },
  addBtnText: { fontSize: 12, fontWeight: '700', color: Colors.bg },
});
