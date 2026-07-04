import { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Pressable, Alert, ActivityIndicator } from 'react-native';
import { Lock, UserMinus, UserPlus, X } from 'lucide-react-native';
import { Colors } from '@/src/constants/colors';
import { getUserTag, getFriendActivityCalendar, FriendActivityDay, PublicProfile } from '@/src/services/socialService';
import { AvatarCircle } from './AvatarCircle';
import { ActivityHeatmap } from './ActivityHeatmap';

export type ProfileRelation = 'self' | 'friend' | 'pending' | 'none';

interface ProfileDetailModalProps {
  visible: boolean;
  profile: PublicProfile | null;
  relation: ProfileRelation;
  onClose: () => void;
  onAddFriend?: (userId: string) => void;
  onUnfriend?: (userId: string) => void;
}

export function ProfileDetailModal({
  visible,
  profile,
  relation,
  onClose,
  onAddFriend,
  onUnfriend,
}: ProfileDetailModalProps) {
  const [activity, setActivity] = useState<FriendActivityDay[] | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');

  useEffect(() => {
    if (!visible || !profile || relation !== 'friend' || profile.isPrivate) {
      setActivity(null);
      setActivityError('');
      return;
    }
    setActivityLoading(true);
    getFriendActivityCalendar(profile.userId)
      .then(setActivity)
      .catch((e) => setActivityError(e?.message || 'Không thể tải quá trình tập luyện.'))
      .finally(() => setActivityLoading(false));
  }, [visible, profile, relation]);

  if (!profile) return null;

  const confirmUnfriend = () => {
    Alert.alert(
      'Huỷ kết bạn?',
      `Bạn sẽ không còn xem được quá trình tập luyện của ${profile.displayName || 'người này'} nữa.`,
      [
        { text: 'Không', style: 'cancel' },
        { text: 'Huỷ kết bạn', style: 'destructive', onPress: () => onUnfriend?.(profile.userId) },
      ],
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Hồ sơ</Text>
          <TouchableOpacity onPress={onClose}>
            <X color={Colors.textSecondary} size={20} />
          </TouchableOpacity>
        </View>

        <View style={styles.avatarWrap}>
          <AvatarCircle uri={profile.avatarUrl} size={84} />
        </View>

        <View style={styles.nameRow}>
          <Text style={styles.name}>{profile.displayName || 'Người dùng'}</Text>
          <Text style={styles.tag}>#{getUserTag(profile.userId)}</Text>
        </View>

        {relation === 'self' && (
          <View style={styles.selfBadge}>
            <Text style={styles.selfBadgeText}>Đây là bạn</Text>
          </View>
        )}

        {profile.isPrivate ? (
          <View style={styles.privateNotice}>
            <Lock color={Colors.textMuted} size={14} strokeWidth={2} />
            <Text style={styles.privateNoticeText}>
              Người này đã ẩn nhật ký, kế hoạch và tiến độ tập luyện.
            </Text>
          </View>
        ) : profile.bio ? (
          <Text style={styles.bio}>{profile.bio}</Text>
        ) : (
          <Text style={styles.bioEmpty}>Chưa có giới thiệu.</Text>
        )}

        {relation === 'friend' && !profile.isPrivate && (
          <View style={styles.overviewBox}>
            <Text style={styles.overviewTitle}>Quá trình tập luyện</Text>
            {activityLoading ? (
              <ActivityIndicator color={Colors.accent} />
            ) : activityError ? (
              <Text style={styles.overviewError}>{activityError}</Text>
            ) : (
              <ActivityHeatmap days={activity ?? []} />
            )}
          </View>
        )}

        {relation === 'none' && onAddFriend && (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => onAddFriend(profile.userId)}>
            <UserPlus color={Colors.bg} size={15} strokeWidth={2.5} />
            <Text style={styles.primaryBtnText}>Kết bạn</Text>
          </TouchableOpacity>
        )}
        {relation === 'pending' && (
          <View style={styles.pendingBox}>
            <Text style={styles.pendingBoxText}>Đang chờ chấp nhận lời mời kết bạn</Text>
          </View>
        )}
        {relation === 'friend' && onUnfriend && (
          <TouchableOpacity style={styles.secondaryBtn} onPress={confirmUnfriend}>
            <UserMinus color={Colors.textSecondary} size={15} strokeWidth={2} />
            <Text style={styles.secondaryBtnText}>Huỷ kết bạn</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 24 }} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#00000088' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 20, paddingTop: 8, alignItems: 'center',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.textMuted,
    alignSelf: 'stretch', opacity: 0.4, marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    alignSelf: 'stretch', marginBottom: 16,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  avatarWrap: { marginBottom: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 8 },
  name: { fontSize: 19, fontWeight: '700', color: Colors.text },
  tag: { fontSize: 12, fontWeight: '500', color: Colors.textMuted, fontFamily: 'monospace' },
  selfBadge: {
    backgroundColor: Colors.accent + '20', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 3, marginBottom: 12,
  },
  selfBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.accent },
  privateNotice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.bg, borderRadius: 12, padding: 12,
    alignSelf: 'stretch', marginBottom: 16,
  },
  privateNoticeText: { flex: 1, fontSize: 12, color: Colors.textMuted, lineHeight: 17 },
  bio: {
    fontSize: 13, color: Colors.textSecondary, textAlign: 'center',
    lineHeight: 19, marginBottom: 16, alignSelf: 'stretch',
  },
  bioEmpty: { fontSize: 12, color: Colors.textMuted, fontStyle: 'italic', marginBottom: 16 },
  overviewBox: {
    alignSelf: 'stretch', backgroundColor: Colors.bg, borderRadius: 14,
    padding: 14, marginBottom: 16, gap: 8,
  },
  overviewTitle: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  overviewError: { fontSize: 12, color: Colors.error },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 12,
    alignSelf: 'stretch',
  },
  primaryBtnText: { fontSize: 14, fontWeight: '700', color: Colors.bg },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingVertical: 12, alignSelf: 'stretch',
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  pendingBox: {
    backgroundColor: Colors.bg, borderRadius: 12, paddingVertical: 12,
    alignSelf: 'stretch', alignItems: 'center',
  },
  pendingBoxText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
});
