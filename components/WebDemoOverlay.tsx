import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '@/constants/colors';

export function WebDemoOverlay() {
  return (
    <View style={styles.overlay}>
      <View style={styles.modal}>
        <Text style={styles.title}>📱 Demo Giao Diện</Text>
        <Text style={styles.message}>
          Tính năng này chỉ hoạt động trên di động (iOS/Android).
        </Text>
        <Text style={styles.subtitle}>
          Web được dùng để xem trước giao diện thôi!
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  modal: {
    backgroundColor: Colors.bg,
    borderRadius: 16,
    padding: 24,
    maxWidth: 400,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
