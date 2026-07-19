import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton, MutedText } from '@/components/ui';
import { palette, radius, shadow, spacing, useAppTheme } from '@/constants/theme';
import { asrErrorMessage, RealtimeAsrSession } from '@/lib/realtime-asr';
import type { AsrSettings } from '@/types';

type Props = {
  visible: boolean;
  settings: AsrSettings;
  initialText?: string;
  onTranscript?: (text: string) => void;
  onClose: () => void;
};

export function VoiceModeModal({ visible, settings, initialText = '', onTranscript, onClose }: Props) {
  const theme = useAppTheme();
  const session = useRef<RealtimeAsrSession | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [phase, setPhase] = useState('idle');
  const [status, setStatus] = useState('准备好时，点一下开始');
  const [transcript, setTranscript] = useState('');
  const [seconds, setSeconds] = useState(0);
  const configured = Boolean(settings.appId && settings.apiKey && settings.apiSecret);
  const active = ['permission', 'connecting', 'recording', 'stopping', 'awaiting_final'].includes(phase);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    void session.current?.cancel();
  }, []);

  useEffect(() => {
    if (visible) return;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    void session.current?.cancel();
    session.current = null;
    setPhase('idle');
    setSeconds(0);
    setTranscript('');
    setStatus('准备好时，点一下开始');
  }, [visible]);

  async function toggle() {
    if (active) {
      setPhase('stopping');
      setStatus('正在确认最后一段文字…');
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      try {
        const result = await session.current?.stop();
        const text = result?.text.trim() ?? transcript.trim();
        if (text) onTranscript?.([initialText.trim(), text].filter(Boolean).join(initialText.trim() ? '\n' : ''));
        setTranscript(text);
        setStatus(text ? '转写完成；文字已回填到输入框，确认后再发送。' : '没有识别到清晰文字，可以再试一次。');
      } catch (error) {
        setStatus(asrErrorMessage(error));
      } finally {
        session.current = null;
        setPhase('idle');
      }
      return;
    }
    if (!configured) {
      setStatus('请先在“我的”中填写并保存讯飞 APPID、APIKey 和 APISecret。');
      return;
    }
    setTranscript('');
    setSeconds(0);
    setStatus('正在请求麦克风权限…');
    const next = new RealtimeAsrSession({
      settings,
      onState: (state) => {
        setPhase(state);
        if (state === 'connecting') setStatus('正在连接讯飞实时转写…');
        if (state === 'recording') setStatus('正在实时转写；再点一次结束。');
      },
      onTranscript: (snapshot) => {
        setTranscript(snapshot.text);
        setStatus(snapshot.text || '正在听…');
      },
      onError: (error) => setStatus(asrErrorMessage(error)),
    });
    session.current = next;
    try {
      await next.start();
      const startedAt = Date.now();
      timer.current = setInterval(() => setSeconds(Math.max(1, Math.round((Date.now() - startedAt) / 1000))), 250);
    } catch (error) {
      session.current = null;
      setPhase('idle');
      setStatus(asrErrorMessage(error));
    }
  }

  async function close() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    await session.current?.cancel();
    session.current = null;
    setPhase('idle');
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => void close()}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme.elevated, borderColor: theme.border }, shadow]}>
          <Text style={[styles.eyebrow, { color: theme.accent }]}>VOICE COMPANION · LIVE ASR</Text>
          <Text style={[styles.title, { color: theme.text }]}>用声音，慢慢说。</Text>
          <MutedText>音频会实时直达讯飞并转成当前输入框里的可编辑文字；确认发送前不会进入对话或画像，原音频不会保存。</MutedText>
          <Pressable accessibilityLabel={active ? '停止实时语音转写' : '开始实时语音转写'} onPress={() => void toggle()} style={[styles.orb, { backgroundColor: active ? palette.rust : theme.accent }]}>
            <Text style={styles.mic}>⌁</Text>
          </Pressable>
          <Text style={[styles.status, { color: theme.text }]}>{active && seconds ? `${seconds} 秒 · ${status}` : status}</Text>
          {transcript ? <Text style={[styles.transcript, { color: theme.secondaryText, borderColor: theme.border }]}>{transcript}</Text> : null}
          <AppButton label="关闭" variant="ghost" onPress={() => void close()} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(8,16,13,0.65)', alignItems: 'center', justifyContent: 'center', padding: spacing.five },
  card: { width: '100%', maxWidth: 520, borderRadius: radius.large, borderWidth: StyleSheet.hairlineWidth, padding: spacing.six, alignItems: 'center', gap: spacing.four },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  title: { fontSize: 28, fontWeight: '900' },
  orb: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center', marginVertical: spacing.four },
  mic: { color: palette.white, fontSize: 42 },
  status: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  transcript: { width: '100%', maxHeight: 110, padding: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, fontSize: 12, lineHeight: 19 },
});
