import React from 'react';
import { View, StyleSheet } from 'react-native';
import LogScreen from './log';
import { WebDemoOverlay } from '@/components/WebDemoOverlay';

export default function LogScreenWeb() {
  return (
    <View style={styles.wrapper}>
      <View style={styles.contentDisabled}>
        <LogScreen />
      </View>
      <WebDemoOverlay />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  contentDisabled: {
    flex: 1,
    pointerEvents: 'none',
    opacity: 0.7,
  },
});
