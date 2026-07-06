import { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  ScrollView,
  Platform,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, LogOut, User as UserIcon, Lock, ChevronDown, ChevronUp } from 'lucide-react-native';
import { Colors } from '@/src/constants/colors';
import { useAuth } from '@/src/context/AuthContext';
import { useSync } from '@/src/context/SyncContext';
import { getMyProfile, saveProfile } from '@/src/lib/repository';
import { ActivityHeatmap } from '@/src/components/community-tabs/ActivityHeatmap';
import { getMyActivityCalendar, FriendActivityDay } from '@/src/services/socialService';

export function UserAccountModal() {
  const { user, signOut } = useAuth();
  const { offlineTestMode, setOfflineTestMode } = useSync();
  const [visible, setVisible] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [bioDraft, setBioDraft] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileDirty, setProfileDirty] = useState(false);
  const [activity, setActivity] = useState<FriendActivityDay[] | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [showAccountInfo, setShowAccountInfo] = useState(false);

  useEffect(() => {
    if (!visible || !user) return;
    let cancelled = false;

    setProfileLoading(true);
    getMyProfile()
      .then((profile) => {
        if (cancelled) return;
        const fallbackName = user.name || user.user_metadata?.name || user.email?.split('@')[0] || '';
        setDisplayNameDraft(profile?.display_name ?? fallbackName);
        setBioDraft(profile?.bio ?? '');
        setIsPrivate(profile?.is_private ?? false);
        setProfileDirty(false);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });

    setActivityLoading(true);
    getMyActivityCalendar()
      .then((data) => { if (!cancelled) setActivity(data); })
      .catch(() => { if (!cancelled) setActivity([]); })
      .finally(() => { if (!cancelled) setActivityLoading(false); });

    return () => { cancelled = true; };
  }, [visible, user]);

  if (!user) {
    return null;
  }

  const userName =
    user.name || user.user_metadata?.name || user.email?.split('@')[0] || 'User';
  const userEmail = user.email || 'No email';
  const userId = user.id;
  const providers = user.app_metadata?.providers;
  const rawProvider = Array.isArray(providers)
    ? providers[0]
    : user.app_metadata?.provider || 'google';
  const provider = typeof rawProvider === 'string' ? rawProvider : 'google';

  const handleSignOut = async () => {
    try {
      await signOut();
      setVisible(false);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      await saveProfile({
        // Never persist an empty display name — a nameless profile is a dead
        // end for friend search/discovery, so fall back to the Google name.
        displayName: displayNameDraft.trim() || userName,
        bio: bioDraft.trim() || null,
        isPrivate,
      });
      setProfileDirty(false);
    } catch (error) {
      console.error('Save profile error:', error);
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <TouchableOpacity
        style={styles.triggerButton}
        onPress={() => setVisible(true)}
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      >
        <UserIcon color={Colors.accent} size={20} strokeWidth={1.8} />
      </TouchableOpacity>

      {/* Modal */}
      <Modal
        visible={visible}
        animationType="slide"
        transparent={true}
        statusBarTranslucent
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.backdropTouch}
            activeOpacity={1}
            onPress={() => setVisible(false)}
          />

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheet}>
            {/* Drag Handle */}
            <View style={styles.dragHandle} />

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Tài khoản của bạn</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setVisible(false)}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              >
                <X color={Colors.textMuted} size={18} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {/* Avatar Section */}
              <View style={styles.avatarSection}>
                <View style={styles.avatarRing}>
                  <View style={styles.avatar}>
                    <UserIcon color={Colors.accent} size={40} strokeWidth={1.5} />
                  </View>
                </View>
                <Text style={styles.displayName}>{userName}</Text>
                <Text style={styles.displayEmail}>{userEmail}</Text>
              </View>

              {/* Public profile — editable */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Hồ sơ công khai</Text>

                <Text style={styles.fieldLabel}>Tên hiển thị</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={displayNameDraft}
                  onChangeText={(v) => { setDisplayNameDraft(v); setProfileDirty(true); }}
                  placeholder={userName}
                  placeholderTextColor={Colors.textMuted}
                  editable={!profileLoading}
                />

                <Text style={styles.fieldLabel}>Giới thiệu (tuỳ chọn)</Text>
                <TextInput
                  style={[styles.fieldInput, styles.fieldInputMultiline]}
                  value={bioDraft}
                  onChangeText={(v) => { setBioDraft(v); setProfileDirty(true); }}
                  placeholder="Vài dòng giới thiệu về bạn..."
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  editable={!profileLoading}
                />

                <View style={styles.privacyRow}>
                  <View style={styles.privacyIconWrap}>
                    <Lock color={Colors.accent} size={16} strokeWidth={1.8} />
                  </View>
                  <View style={styles.infoTextWrap}>
                    <Text style={styles.toggleTitle}>Riêng tư tập luyện</Text>
                    <Text style={styles.privacyHint}>
                      Ẩn nhật ký, kế hoạch và tiến độ tập luyện khỏi người khác — tên và ảnh đại diện luôn hiển thị.
                    </Text>
                  </View>
                  <Switch
                    value={isPrivate}
                    onValueChange={(value) => { setIsPrivate(value); setProfileDirty(true); }}
                    trackColor={{ false: Colors.border, true: Colors.accent + '55' }}
                    thumbColor={isPrivate ? Colors.accent : '#f4f3f4'}
                    disabled={profileLoading}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.saveProfileButton, (!profileDirty || profileSaving) && styles.saveProfileButtonDisabled]}
                  onPress={handleSaveProfile}
                  disabled={!profileDirty || profileSaving}
                >
                  <Text style={styles.saveProfileButtonText}>
                    {profileSaving ? 'Đang lưu...' : 'Lưu hồ sơ'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Activity heatmap — same visual as viewing a friend's profile */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Quá trình tập luyện</Text>
                {activityLoading ? (
                  <ActivityIndicator color={Colors.accent} style={{ paddingVertical: 12 }} />
                ) : (
                  <ActivityHeatmap days={activity ?? []} />
                )}
              </View>

              {/* Account info — collapsible, read-only, de-emphasized */}
              <View style={styles.sectionCard}>
                <TouchableOpacity
                  style={styles.collapsibleHeader}
                  onPress={() => setShowAccountInfo((v) => !v)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.sectionTitle}>Thông tin tài khoản</Text>
                  {showAccountInfo ? (
                    <ChevronUp color={Colors.textMuted} size={16} strokeWidth={2} />
                  ) : (
                    <ChevronDown color={Colors.textMuted} size={16} strokeWidth={2} />
                  )}
                </TouchableOpacity>

                {showAccountInfo && (
                  <>
                    <View style={styles.compactList}>
                      <View style={styles.compactRow}>
                        <Text style={styles.compactLabel}>Email</Text>
                        <Text style={styles.compactValue} numberOfLines={1}>{userEmail}</Text>
                      </View>
                      <View style={[styles.compactRow, styles.compactRowBorder]}>
                        <Text style={styles.compactLabel}>User ID</Text>
                        <Text style={styles.compactValueCode} numberOfLines={1} ellipsizeMode="middle">{userId}</Text>
                      </View>
                      <View style={[styles.compactRow, styles.compactRowBorder]}>
                        <Text style={styles.compactLabel}>Nhà cung cấp</Text>
                        <Text style={styles.compactValue}>{provider.charAt(0).toUpperCase() + provider.slice(1)}</Text>
                      </View>
                    </View>
                    <Text style={styles.noticeText}>
                      Thông tin tài khoản được cung cấp bởi Google. Dữ liệu tập luyện của bạn được lưu trữ an toàn và tách riêng theo tài khoản.
                    </Text>
                  </>
                )}
              </View>

              {/* Settings */}
              <View style={styles.toggleCard}>
                <Text style={styles.toggleTitle}>Mô phỏng offline</Text>
                <Switch
                  value={offlineTestMode}
                  onValueChange={(value) => {
                    void setOfflineTestMode(value);
                  }}
                  trackColor={{ false: Colors.border, true: Colors.border }}
                  thumbColor={offlineTestMode ? Colors.error : '#f4f3f4'}
                />
              </View>

              {/* Sign Out */}
              <TouchableOpacity
                style={styles.signOutButton}
                onPress={handleSignOut}
                activeOpacity={0.75}
              >
                <LogOut color={Colors.error} size={18} strokeWidth={2} />
                <Text style={styles.signOutText}>Đăng xuất</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Safe area bottom padding */}
            <SafeAreaView style={styles.safeBottom} />
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  triggerButton: {
    padding: 8,
  },

  // Overlay + Sheet
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    // KEY FIX: use maxHeight instead of relying on ScrollView flex
    maxHeight: '88%',
  },

  // Drag handle
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textMuted,
    alignSelf: 'center',
    opacity: 0.4,
    marginBottom: 16,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.3,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Scroll
  scrollContent: {
    paddingBottom: 16,
  },

  // Avatar
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    opacity: 0.9,
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  displayName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  displayEmail: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '400',
  },

  infoTextWrap: {
    flex: 1,
  },

  // Compact key/value rows (account info section)
  compactList: {
    marginTop: 10,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 12,
  },
  compactRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  compactLabel: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  compactValue: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text,
    flexShrink: 1,
    textAlign: 'right',
  },
  compactValueCode: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flexShrink: 1,
    textAlign: 'right',
  },

  noticeText: {
    fontSize: 11,
    lineHeight: 16,
    color: Colors.textMuted,
    marginTop: 10,
  },

  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    marginBottom: 14,
  },
  fieldInputMultiline: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  privacyIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: `${Colors.accent}18`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  privacyHint: {
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 15,
    marginTop: 2,
  },
  saveProfileButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.accent,
  },
  saveProfileButtonDisabled: {
    opacity: 0.5,
  },
  saveProfileButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.bg,
  },

  toggleCard: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },

  // Sign out
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: `${Colors.error}12`,
    borderWidth: 1,
    borderColor: `${Colors.error}40`,
    marginBottom: 4,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.error,
  },

  safeBottom: {
    backgroundColor: Colors.bg,
  },
});
