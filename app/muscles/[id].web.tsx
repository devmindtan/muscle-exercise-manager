import React from 'react';
import { View, StyleSheet } from 'react-native';
import MuscleDetailScreen from './[id]';
import { WebDemoOverlay } from '@/components/WebDemoOverlay';

export default function MuscleDetailScreenWeb() {
  return (
    <View style={styles.wrapper}>
      <View style={styles.contentDisabled}>
        <MuscleDetailScreen />
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
