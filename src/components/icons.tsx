import React from 'react';
import { StyleSheet, View } from 'react-native';

export function MicIcon({ color = 'currentColor', size = 20 }: { color?: string; size?: number }) {
  const scale = size / 20;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      <View style={[styles.micCapsule, { borderColor: color, transform: [{ scale }] }]} />
      <View style={[styles.micArc, { borderColor: color, transform: [{ scale }] }]} />
      <View style={[styles.micStem, { backgroundColor: color, transform: [{ scale }] }]} />
      <View style={[styles.micBase, { backgroundColor: color, transform: [{ scale }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  micCapsule: {
    position: 'absolute',
    top: 1,
    left: 6,
    width: 8,
    height: 12,
    borderWidth: 1.6,
    borderRadius: 5,
    transformOrigin: 'top left',
  },
  micArc: {
    position: 'absolute',
    top: 7,
    left: 3,
    width: 14,
    height: 9,
    borderBottomWidth: 1.6,
    borderLeftWidth: 1.6,
    borderRightWidth: 1.6,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    transformOrigin: 'top left',
  },
  micStem: {
    position: 'absolute',
    top: 15,
    left: 9.2,
    width: 1.6,
    height: 3,
    transformOrigin: 'top left',
  },
  micBase: {
    position: 'absolute',
    top: 18,
    left: 6,
    width: 8,
    height: 1.6,
    borderRadius: 1,
    transformOrigin: 'top left',
  },
});
