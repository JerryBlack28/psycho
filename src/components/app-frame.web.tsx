import React, { type PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/constants/theme';

export function AppFrame({ children }: PropsWithChildren) {
  const theme = useAppTheme();

  return (
    <View
      testID="web-prototype-stage"
      style={styles.stage}>
      <View
        testID="web-phone-frame"
        style={[styles.phone, { backgroundColor: theme.background }]}>
        {children}
      </View>
      <DesktopPrototypeNotes />
    </View>
  );
}

function DesktopPrototypeNotes() {
  const theme = useAppTheme();
  const steps = ['今日潮汐', '每日答案', '图片闪念', '主题确认', '情境选择', '潮笺收集', '文字与语音对话', '微行动', '未来回响', '初印象'];
  return (
    <View testID="web-prototype-notes" style={styles.desktopNotes}>
      <Text style={[styles.notesEyebrow, { color: theme.secondaryText }]}>PRODUCT PROTOTYPE · V0.5</Text>
      <Text testID="web-prototype-title" style={[styles.notesTitle, { color: theme.text }]}>从闪念开始，{`\n`}沿同一条线索走到底。</Text>
      <Text style={[styles.notesCopy, { color: theme.secondaryText }]}>心潮把今日潮汐、答案之书、图片便签、Reigns 式选择、四股潮向、文字与语音陪伴、未来回响和初印象放进同一个轻量空间。</Text>
      <View style={styles.notesList}>
        {steps.map((step, index) => <View key={step} style={[styles.notesRow, { borderBottomColor: theme.border }]}><Text style={[styles.notesNumber, { color: theme.accent }]}>{String(index + 1).padStart(2, '0')}</Text><Text style={[styles.notesStep, { color: theme.text }]}>{step}</Text></View>)}
      </View>
      <Text style={[styles.desktopTip, { color: theme.secondaryText }]}>可用鼠标、触控或键盘完成整条主线</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    minHeight: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    overflow: 'hidden',
  },
  phone: {
    position: 'relative',
    width: 390,
    maxWidth: '100%',
    minHeight: 680,
    overflow: 'hidden',
    borderRadius: 48,
    borderWidth: 8,
    borderColor: '#0B1311',
  },
  desktopNotes: { width: 430, maxWidth: 430 },
  notesEyebrow: { marginBottom: 18, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  notesTitle: { fontFamily: 'Georgia', fontWeight: '500' },
  notesCopy: { marginVertical: 24, fontSize: 15, lineHeight: 27.75 },
  notesList: { marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(24,37,32,.14)' },
  notesRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 17, borderBottomWidth: StyleSheet.hairlineWidth },
  notesNumber: { width: 20, fontSize: 9, fontWeight: '800' },
  notesStep: { fontFamily: 'Georgia', fontSize: 13, fontWeight: '500' },
  desktopTip: { fontSize: 10, marginTop: 20 },
});
