import React from 'react';
import { View, StyleSheet } from 'react-native';
import MusclesScreen from './muscles';
import { WebDemoOverlay } from '@/components/WebDemoOverlay';

export default function MusclesScreenWeb() {
  return (
    <View style={styles.wrapper}>
      <View style={styles.contentDisabled}>
        <MusclesScreen />
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
