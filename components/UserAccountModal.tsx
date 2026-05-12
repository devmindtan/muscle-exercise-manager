import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { X, LogOut, User as UserIcon } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';

export function UserAccountModal() {
  const { user, signOut } = useAuth();
  const [visible, setVisible] = useState(false);

  if (!user) {
    return null;
  }

  const userName =
    user.user_metadata?.name || user.email?.split('@')[0] || 'User';
  const userEmail = user.email || 'No email';
  const userId = user.id;
  const provider = user.app_metadata?.providers?.[0] || 'google';

  const handleSignOut = async () => {
    try {
      await signOut();
      setVisible(false);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <>
      {/* Trigger Button - shown as icon/text in header or toolbar */}
      <TouchableOpacity
        style={styles.triggerButton}
        onPress={() => setVisible(true)}
      >
        <UserIcon color={Colors.accent} size={20} strokeWidth={1.8} />
      </TouchableOpacity>

      {/* Modal */}
      <Modal
        visible={visible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Tài khoản của bạn</Text>
              <TouchableOpacity
                onPress={() => setVisible(false)}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              >
                <X color={Colors.text} size={24} strokeWidth={1.8} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.content}
              showsVerticalScrollIndicator={false}
            >
              {/* Avatar / Icon */}
              <View style={styles.avatarSection}>
                <View style={styles.avatar}>
                  <UserIcon color={Colors.accent} size={48} strokeWidth={1.5} />
                </View>
              </View>

              {/* User Info Card */}
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Tên</Text>
                  <Text style={styles.infoValue}>{userName}</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>{userEmail}</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>User ID (UUID)</Text>
                  <Text style={styles.infoValueCode}>{userId}</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Nhà cung cấp</Text>
                  <Text style={styles.infoValue}>
                    {provider.charAt(0).toUpperCase() + provider.slice(1)}
                  </Text>
                </View>
              </View>

              {/* Info text */}
              <View style={styles.infoSection}>
                <Text style={styles.infoText}>
                  Thông tin tài khoản này được cung cấp bởi Google. Dữ liệu tập
                  thể dục của bạn được lưu trữ an toàn trên Supabase và được
                  tách riêng theo UUID này.
                </Text>
              </View>

              {/* Separator */}
              <View style={styles.separator} />

              {/* Sign Out Button */}
              <TouchableOpacity
                style={styles.signOutButton}
                onPress={handleSignOut}
              >
                <LogOut color={Colors.error} size={20} strokeWidth={1.8} />
                <Text style={styles.signOutButtonText}>Đăng xuất</Text>
              </TouchableOpacity>

              {/* Footer spacing */}
              <View style={{ height: 20 }} />
            </ScrollView>
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '85%',
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  content: {
    flex: 1,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  infoRow: {
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
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
    height: 1,
    backgroundColor: Colors.bg,
    marginVertical: 8,
  },
  infoSection: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textMuted,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.surface,
    marginBottom: 16,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: `${Colors.error}15`,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  signOutButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.error,
  },
});
