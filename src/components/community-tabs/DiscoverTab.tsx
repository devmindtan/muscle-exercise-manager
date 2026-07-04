import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Search, UserPlus, Lock } from 'lucide-react-native';
import { Colors } from '@/src/constants/colors';
import { useAuth } from '@/src/context/AuthContext';
import {
  getMyFriendships,
  PublicProfile,
  searchProfiles,
  sendFriendRequest,
} from '@/src/services/socialService';

export function DiscoverTab() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [statusByUserId, setStatusByUserId] = useState<Record<string, 'friend' | 'pending' | 'none'>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());

  const runSearch = useCallback(async () => {
    if (!query.trim() || !user) return;
    setLoading(true);
    setError('');
    try {
      const [profiles, friendships] = await Promise.all([searchProfiles(query), getMyFriendships()]);
      const statusMap: Record<string, 'friend' | 'pending' | 'none'> = {};
      for (const f of friendships) {
        const other = f.requesterId === user.id ? f.addresseeId : f.requesterId;
        statusMap[other] = f.status === 'accepted' ? 'friend' : f.status === 'pending' ? 'pending' : 'none';
      }
      setStatusByUserId(statusMap);
      setResults(profiles);
    } catch (e: any) {
      setError(e?.message || 'Không thể tìm kiếm.');
    } finally {
      setLoading(false);
    }
  }, [query, user]);

  const addFriend = async (targetUserId: string) => {
    try {
      await sendFriendRequest(targetUserId);
      setSentTo((prev) => new Set(prev).add(targetUserId));
    } catch (e: any) {
      setError(e?.message || 'Không thể gửi lời mời.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Search color={Colors.textMuted} size={16} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Tìm theo tên hiển thị..."
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
        {results.map((profile) => {
          const status = statusByUserId[profile.userId] ?? 'none';
          const justSent = sentTo.has(profile.userId);
          return (
            <View key={profile.userId} style={styles.row}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowName}>{profile.displayName || 'Người dùng'}</Text>
                {profile.isPrivate ? (
                  <View style={styles.privateBadge}>
                    <Lock color={Colors.textMuted} size={10} strokeWidth={2} />
                    <Text style={styles.privateBadgeText}>Riêng tư</Text>
                  </View>
                ) : profile.bio ? (
                  <Text style={styles.rowBio} numberOfLines={1}>{profile.bio}</Text>
                ) : null}
              </View>
              {status === 'friend' ? (
                <Text style={styles.statusText}>Bạn bè</Text>
              ) : status === 'pending' || justSent ? (
                <Text style={styles.statusText}>Đã gửi</Text>
              ) : (
                <TouchableOpacity style={styles.addBtn} onPress={() => addFriend(profile.userId)}>
                  <UserPlus color={Colors.bg} size={13} strokeWidth={2.5} />
                  <Text style={styles.addBtnText}>Kết bạn</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
        {!loading && query.trim() && results.length === 0 && (
          <Text style={styles.mutedText}>Không tìm thấy người dùng nào.</Text>
        )}
      </View>
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
  list: { gap: 10 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12, gap: 10,
  },
  rowInfo: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  rowBio: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
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
