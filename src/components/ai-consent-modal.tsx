import React, { useState } from 'react';
import { Modal, StyleSheet, Switch, Text, View } from 'react-native';

import { AppButton, MutedText } from '@/components/ui';
import { radius, shadow, spacing, useAppTheme } from '@/constants/theme';

export function AiConsentModal({ visible, configured, onDecline, onAccept }: { visible: boolean; configured: boolean; onDecline: () => void; onAccept: (profile: boolean) => void }) {
  const theme = useAppTheme();
  const [profile, setProfile] = useState(false);
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onDecline}><View style={styles.backdrop}><View style={[styles.card, { backgroundColor: theme.elevated, borderColor: theme.border }, shadow]}><Text style={[styles.icon, { color: theme.accent }]}>◐</Text><Text style={[styles.eyebrow, { color: theme.accent }]}>AI PROCESSING</Text><Text style={[styles.title, { color: theme.text }]}>由你决定，哪些内容可以交给 AI。</Text><MutedText>应用会把本次授权内容直接发送到你在“我的”中配置的模型服务商；API 配置和文字画像只保存在这台设备。</MutedText><MutedText>这不是心理诊断、治疗或危机评估；你可以随时关闭。</MutedText>{!configured ? <Text style={styles.warning}>请先到“我的”保存并测试自定义 API。</Text> : null}<View style={styles.toggle}><View style={styles.toggleCopy}><Text style={[styles.toggleTitle, { color: theme.text }]}>另外开启持续画像</Text><MutedText>关键节点异步更新，并在本机保存可删除的文字画像；不默认勾选。</MutedText></View><Switch disabled={!configured} value={profile} onValueChange={setProfile} trackColor={{ true: theme.accent }} /></View><View style={styles.actions}><AppButton label="继续使用本地功能" variant="ghost" onPress={onDecline} style={styles.flex} /><AppButton label="同意并启用 AI" disabled={!configured} onPress={() => onAccept(profile)} style={styles.flex} /></View></View></View></Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(8,16,13,0.65)', alignItems: 'center', justifyContent: 'center', padding: spacing.five },
  card: { width: '100%', maxWidth: 560, borderRadius: radius.large, borderWidth: StyleSheet.hairlineWidth, padding: spacing.six, gap: spacing.four },
  icon: { fontSize: 46, alignSelf: 'center' },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.3, textAlign: 'center' },
  title: { fontSize: 25, lineHeight: 35, fontWeight: '900', textAlign: 'center' },
  warning: { color: '#A4473C', fontSize: 13, lineHeight: 20, fontWeight: '700' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.four },
  toggleCopy: { flex: 1 },
  toggleTitle: { fontSize: 14, fontWeight: '900', marginBottom: 3 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.three },
  flex: { flex: 1, minWidth: 180 },
});
