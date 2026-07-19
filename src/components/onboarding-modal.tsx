import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { MicIcon } from '@/components/icons';
import { AppButton, MutedText } from '@/components/ui';
import { useAppTheme } from '@/constants/theme';

const steps = [
  ['◐', '今天', '看日报、抽答案卡，或进入一段完整章节。'],
  ['＋', '闪念', '随手写一句、拍一张，不用立刻开始梳理。'],
  ['mic', '对话', '文字、语音输入或语音陪伴，想说多少都可以。'],
  ['⌁', '回响', '把一句话留给未来，再在某一天重新遇见。'],
];

export function OnboardingModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useAppTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme.elevated }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="关闭新手说明" onPress={onClose} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable>
          <Text style={[styles.eyebrow, { color: theme.accent }]}>30 秒认识心潮</Text>
          <Text style={[styles.title, { color: theme.text }]}>按此刻的需要，选一个入口就好。</Text>
          <View style={styles.steps}>
            {steps.map(([symbol, title, copy]) => (
              <View key={title} style={styles.step}>
                <View style={styles.symbol}>
                  {symbol === 'mic' ? <MicIcon color="#F0DBA9" size={17} /> : <Text style={styles.symbolText}>{symbol}</Text>}
                </View>
                <View style={styles.stepCopy}>
                  <Text style={[styles.stepTitle, { color: theme.text }]}>{title}</Text>
                  <MutedText>{copy}</MutedText>
                </View>
              </View>
            ))}
          </View>
          <AppButton label="从今天开始  →" onPress={onClose} style={styles.startButton} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(7,14,12,.7)', alignItems: 'flex-end', padding: 16 },
  card: { position: 'relative', width: '100%', borderRadius: 27, paddingTop: 25, paddingHorizontal: 21, paddingBottom: 21, boxShadow: '0 -17px 48px rgba(0,0,0,.24)' },
  close: { position: 'absolute', top: 13, right: 13, zIndex: 2, width: 36, height: 36, borderRadius: 18, backgroundColor: '#EEE7DA', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#182520', fontSize: 21 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.7 },
  title: { marginTop: 8, marginBottom: 13, paddingRight: 32, fontFamily: 'Georgia', fontSize: 23, lineHeight: 32.66, fontWeight: '500' },
  steps: { gap: 9, marginVertical: 16, marginBottom: 18 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  symbol: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#315C4F', alignItems: 'center', justifyContent: 'center' },
  symbolText: { color: '#F0DBA9', fontFamily: 'Georgia', fontSize: 17 },
  stepCopy: { flex: 1 },
  stepTitle: { fontSize: 11, fontWeight: '700' },
  startButton: { minHeight: 50, borderRadius: 16 },
});
