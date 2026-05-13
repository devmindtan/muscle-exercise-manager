import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AlertCircle, Check, Cloud, CloudOff } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useSync } from '@/context/SyncContext';
import { UserAccountModal } from './UserAccountModal';

export function SyncStatusChip() {
  const { user, signIn, isGuestMode } = useAuth();
  const { status, lastSyncAt, sync } = useSync();

  if (!user) {
    return (
      <TouchableOpacity style={styles.chip} onPress={signIn}>
        <CloudOff color={Colors.textMuted} size={12} strokeWidth={1.8} />
        <Text style={styles.muted}>
          {isGuestMode ? 'Khách' : 'Đăng nhập'}
        </Text>
      </TouchableOpacity>
    );
  }

  let icon: React.ReactNode;
  let label = '';
  let errorBorder = false;

  switch (status) {
    case 'syncing':
      icon = <ActivityIndicator size={12} color={Colors.accent} />;
      label = 'Đang đồng bộ...';
      break;
    case 'synced':
      icon = <Check color={Colors.success} size={12} strokeWidth={2} />;
      label = lastSyncAt
        ? lastSyncAt.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'Đã đồng bộ';
      break;
    case 'error':
      icon = <AlertCircle color={Colors.error} size={12} strokeWidth={1.8} />;
      label = 'Lỗi đồng bộ';
      errorBorder = true;
      break;
    default:
      icon = <Cloud color={Colors.textMuted} size={12} strokeWidth={1.8} />;
      label = user.email?.split('@')[0] ?? 'Đã đăng nhập';
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.chip, errorBorder && styles.chipError]}
        onPress={sync}
      >
        {icon}
        <Text
          style={[styles.label, errorBorder && { color: Colors.error }]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </TouchableOpacity>
      <UserAccountModal />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    maxWidth: 160,
  },
  chipError: {
    borderColor: Colors.error,
  },
  label: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  muted: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },
});
