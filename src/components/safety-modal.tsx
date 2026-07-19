import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { AppButton, MutedText } from '@/components/ui';
import { radius, shadow, spacing, useAppTheme } from '@/constants/theme';

export function SafetyModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useAppTheme();
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.backdrop}><View style={[styles.card, { backgroundColor: theme.elevated, borderColor: theme.border }, shadow]}><Text style={[styles.icon, { color: theme.accent }]}>◌</Text><Text style={[styles.eyebrow, { color: theme.accent }]}>BEFORE YOU CONTINUE</Text><Text style={[styles.title, { color: theme.text }]}>这里是自我梳理体验，{`\n`}不是专业服务</Text><MutedText style={styles.copy}>卡片、四股潮向、日报和陪伴对话用于帮助你换一个角度观察当下，不代表心理诊断、人格判断、健康水平或正确答案，也不能替代心理咨询与医疗支持。</MutedText><MutedText style={styles.copy}>如果你或他人正面临即时危险，请暂停体验，联系所在地紧急服务、危机支持资源，或一位能够立刻陪伴你的可信任对象。</MutedText><AppButton label="我知道了" variant="secondary" onPress={onClose} /></View></View></Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(8,16,13,0.65)', alignItems: 'center', justifyContent: 'center', padding: spacing.five },
  card: { width: '100%', maxWidth: 540, borderRadius: radius.large, borderWidth: StyleSheet.hairlineWidth, padding: spacing.six, gap: spacing.four },
  icon: { fontSize: 48, alignSelf: 'center' },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.4, textAlign: 'center' },
  title: { fontSize: 25, lineHeight: 35, fontWeight: '900', textAlign: 'center' },
  copy: { fontSize: 14, lineHeight: 23 },
});
