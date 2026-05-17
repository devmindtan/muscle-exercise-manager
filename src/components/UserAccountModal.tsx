import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  ScrollView,
  Platform,
  SafeAreaView,
  Switch,
} from 'react-native';
import { X, LogOut, User as UserIcon, Mail, Hash, Shield } from 'lucide-react-native';
import { Colors } from '@/src/constants/colors';
import { useAuth } from '@/src/context/AuthContext';
import { useSync } from '@/src/context/SyncContext';

export function UserAccountModal() {
  const { user, signOut } = useAuth();
  const { offlineTestMode, setOfflineTestMode } = useSync();
  const [visible, setVisible] = useState(false);

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

  const InfoRow = ({
    icon,
    label,
    value,
    isCode = false,
  }: {
    icon: React.ReactNode;
    label: string;
    value: string;
    isCode?: boolean;
  }) => (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>{icon}</View>
      <View style={styles.infoTextWrap}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text
          style={isCode ? styles.infoValueCode : styles.infoValue}
          numberOfLines={isCode ? 1 : undefined}
          ellipsizeMode={isCode ? 'middle' : undefined}
        >
          {value}
        </Text>
      </View>
    </View>
  );

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

          <View style={styles.sheet}>
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

              {/* Info Card */}
              <View style={styles.infoCard}>
                <InfoRow
                  icon={<UserIcon color={Colors.accent} size={16} strokeWidth={1.8} />}
                  label="Tên"
                  value={userName}
                />
                <View style={styles.divider} />
                <InfoRow
                  icon={<Mail color={Colors.accent} size={16} strokeWidth={1.8} />}
                  label="Email"
                  value={userEmail}
                />
                <View style={styles.divider} />
                <InfoRow
                  icon={<Hash color={Colors.accent} size={16} strokeWidth={1.8} />}
                  label="User ID"
                  value={userId}
                  isCode
                />
                <View style={styles.divider} />
                <InfoRow
                  icon={<Shield color={Colors.accent} size={16} strokeWidth={1.8} />}
                  label="Nhà cung cấp"
                  value={provider.charAt(0).toUpperCase() + provider.slice(1)}
                />
              </View>

              {/* Notice */}
              <View style={styles.noticeBox}>
                <Text style={styles.noticeText}>
                  Thông tin tài khoản được cung cấp bởi Google. Dữ liệu tập thể dục của bạn được lưu trữ an toàn và tách riêng theo UUID.
                </Text>
              </View>

              <View style={styles.toggleCard}>
                <View style={styles.toggleTextWrap}>
                  <Text style={styles.toggleTitle}>Mô phỏng offline</Text>
                  <Text style={styles.toggleSubtitle}>
                    Bật để test luồng offline dù vẫn đang có mạng.
                  </Text>
                </View>
                <Switch
                  value={offlineTestMode}
                  onValueChange={(value) => {
                    void setOfflineTestMode(value);
                  }}
                  trackColor={{ false: Colors.border, true: `${Colors.accent}88` }}
                  thumbColor={offlineTestMode ? Colors.accent : '#f4f3f4'}
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
          </View>
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
    maxHeight: '85%',
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
    marginBottom: 28,
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

  // Info card
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: `${Colors.accent}18`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoTextWrap: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  infoValueCode: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.accent,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.bg,
    marginLeft: 46,
  },

  // Notice
  noticeBox: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textMuted,
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
  toggleTextWrap: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 3,
  },
  toggleSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 17,
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