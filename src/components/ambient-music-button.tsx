import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAmbientAudio } from '@/providers/ambient-audio';

export function AmbientMusicButton() {
  const { playing, toggle } = useAmbientAudio();
  const levels = useRef([0.45, 0.72, 0.48, 0.88].map((value) => new Animated.Value(value))).current;

  useEffect(() => {
    if (!playing) {
      levels.forEach((level, index) => level.setValue([0.3, 0.72, 0.48, 0.88][index]));
      return;
    }
    const animations = levels.map((level, index) => Animated.loop(Animated.sequence([
      Animated.delay(index * 95),
      Animated.timing(level, { toValue: 1.08, duration: 450, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(level, { toValue: 0.45, duration: 450, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
    ])));
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [levels, playing]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={playing ? '暂停雨声背景音乐' : '播放雨声背景音乐'}
      onPress={toggle}
      style={({ pressed }) => [
        styles.button,
        playing ? styles.buttonPlaying : null,
        pressed ? styles.pressed : null,
      ]}>
      <View style={styles.bars}>
        {[17, 17, 17, 17].map((height, index) => (
          <Animated.View key={index} style={[styles.bar, { height, transform: [{ scaleY: levels[index] }] }]} />
        ))}
      </View>
      <View>
        <Text style={[styles.title, playing ? styles.playingText : null]}>雨声</Text>
        <Text style={[styles.status, playing ? styles.playingText : null]}>{playing ? '暂停' : '播放'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minWidth: 77, height: 36, borderWidth: 1, borderColor: 'rgba(49,92,79,.15)', borderRadius: 99, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#315C4F', backgroundColor: 'rgba(255,253,248,.8)', boxShadow: '0 8px 22px rgba(31,52,44,.1)' },
  buttonPlaying: { backgroundColor: 'rgba(49,92,79,.94)', boxShadow: '0 9px 24px rgba(31,52,44,.2)' },
  bars: { width: 15, height: 17, flexDirection: 'row', gap: 2, alignItems: 'center', justifyContent: 'center' },
  bar: { width: 2, borderRadius: 99, backgroundColor: '#315C4F' },
  title: { color: '#315C4F', fontSize: 9, lineHeight: 9.5, fontWeight: '700' },
  status: { marginTop: 3, color: '#315C4F', fontSize: 7, lineHeight: 7.5, opacity: 0.72 },
  playingText: { color: '#F5E6BD' },
  pressed: { opacity: 0.72 },
});
