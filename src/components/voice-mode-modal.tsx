import { RecordingPresets, requestRecordingPermissionsAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton, MutedText } from '@/components/ui';
import { palette, radius, shadow, spacing, useAppTheme } from '@/constants/theme';
import type { AsrSettings } from '@/types';

export function VoiceModeModal({ visible, settings, initialText = '', onTranscript, onClose }: { visible: boolean; settings: AsrSettings; initialText?: string; onTranscript?: (text: string) => void; onClose: () => void }) {
  const theme = useAppTheme();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const [status, setStatus] = useState('准备好时，点一下开始');

  async function toggle() {
    if (state.isRecording) {
      await recorder.stop();
      onTranscript?.(initialText);
      setStatus(settings.appId && settings.apiKey && settings.apiSecret ? '录音已结束；原生端暂不上传音频，文字输入仍需手动确认。' : '录音已结束；请先在“我的”配置讯飞实时转写。');
      return;
    }
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) { setStatus('需要麦克风权限才能开始。'); return; }
    await recorder.prepareToRecordAsync();
    recorder.record();
    setStatus(settings.appId && settings.apiKey && settings.apiSecret ? '正在本机录音；原始音频不会保存。' : '正在录音；当前未配置讯飞转写凭据。');
  }

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.backdrop}><View style={[styles.card, { backgroundColor: theme.elevated, borderColor: theme.border }, shadow]}><Text style={[styles.eyebrow, { color: theme.accent }]}>VOICE COMPANION · RECORDING</Text><Text style={[styles.title, { color: theme.text }]}>用声音，慢慢说。</Text><MutedText>原生端当前只进行临时本机录音，原始音频不会保存；网页版可使用讯飞 PCM 实时转写并回填文字。</MutedText><Pressable accessibilityLabel={state.isRecording ? '停止语音录音' : '开始语音录音'} onPress={() => void toggle()} style={[styles.orb, { backgroundColor: state.isRecording ? palette.rust : theme.accent }]}><Text style={styles.mic}>⌁</Text></Pressable><Text style={[styles.status, { color: theme.text }]}>{state.isRecording ? `${Math.max(1, Math.round(state.durationMillis / 1000))} 秒 · 再点一次结束` : status}</Text><AppButton label="关闭" variant="ghost" onPress={onClose} /></View></View></Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(8,16,13,0.65)', alignItems: 'center', justifyContent: 'center', padding: spacing.five },
  card: { width: '100%', maxWidth: 520, borderRadius: radius.large, borderWidth: StyleSheet.hairlineWidth, padding: spacing.six, alignItems: 'center', gap: spacing.four },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  title: { fontSize: 28, fontWeight: '900' },
  orb: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center', marginVertical: spacing.four },
  mic: { color: palette.white, fontSize: 42 },
  status: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
