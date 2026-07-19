import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/ui';
import { reportForCards } from '@/data/content';
import { deriveProfileReport } from '@/lib/profile-runtime';
import { useAppState } from '@/providers/app-state';

export default function DailyReportScreen() {
  const router = useRouter();
  const { cards, profile, profileEnabled } = useAppState();
  const profileReport = profileEnabled ? deriveProfileReport(profile) : null;
  const report = profileReport || reportForCards(cards);
  const [feedback, setFeedback] = useState<'helpful' | 'not-me' | ''>('');

  return (
    <AppScreen testID="daily-report-screen" contentStyle={styles.content}>
      <View style={styles.header}><Pressable accessibilityLabel="返回今天" onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>←</Text></Pressable><View style={styles.pill}><Text style={styles.pillText}>今日潮汐</Text></View><View style={styles.spacer} /></View>
      <LinearGradient colors={['#4C2D47', '#8C6B9C', '#BFAAD5']} locations={[0, 0.55, 1]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.hero}>
        <View style={styles.heroOrb} />
        <View style={styles.heroMeta}><Text style={styles.heroDate}>今天</Text><Text style={styles.heroMode}>{profileReport?.mode || '基础日报'}</Text></View>
        <Text style={styles.heroTitle}>{report.headline}</Text>
        <View style={styles.basis}>{report.basis.map((item) => <View key={item} style={styles.basisItem}><Text style={styles.basisCheck}>✓</Text><Text style={styles.basisText}>{item}</Text></View>)}</View>
        <Text style={styles.heroQuote}>“{report.quote}”</Text>
      </LinearGradient>

      <View style={styles.section}>
        <SectionHeader index="01" caption="DAILY GUIDANCE" title="今天可能有帮助" />
        <Text style={styles.summary}>{report.summary}</Text>
        {report.suggestions.map(([label, copy]) => <View key={label} style={styles.suggestion}><View style={styles.suggestionIndex}><Text style={styles.suggestionIndexText}>{label.slice(0, 1)}</Text></View><View style={styles.suggestionCopy}><Text style={styles.suggestionTitle}>{label}</Text><Text style={styles.suggestionText}>{copy}</Text></View></View>)}
      </View>

      <View style={styles.section}>
        <SectionHeader index="02" caption="WHY THIS REPORT" title="这份日报从哪里来" />
        <Text style={styles.sourceCopy}>{profileReport ? '这份日报来自你已授权保存在本机的连续画像，并会随着新线索继续修正。它不是人格、诊断或固定结论。' : '当前没有足够的近期收藏信号，因此只展示基础内容。日报不会把短期选择解释成人格、诊断或固定结论。'}</Text>
        <Text style={styles.boundary}>{profileReport ? '模型请求只在持续画像开启时发生；本机保存文字化观察，不保存原始语音。' : '只使用你主动保存在本机的潮笺类型和时间；不读取未保存的章节选择与聊天。'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.feedbackTitle}>这份日报像你今天的状态吗？</Text>
        <View style={styles.feedbackButtons}><FeedbackButton label="有一点帮助" active={feedback === 'helpful'} onPress={() => setFeedback('helpful')} /><FeedbackButton label="不太像我" active={feedback === 'not-me'} onPress={() => setFeedback('not-me')} /></View>
        <Text style={styles.feedbackStatus}>{feedback ? '已记录在这台设备，仅用于调整之后的表达方式。' : '反馈只用于调整之后的表达方式。'}</Text>
      </View>
      <Pressable onPress={() => router.replace('/chat')} style={styles.chatButton}><Text style={styles.chatButtonText}>想聊聊这份日报</Text><Text style={styles.chatButtonText}>→</Text></Pressable>
    </AppScreen>
  );
}

function SectionHeader({ index, caption, title }: { index: string; caption: string; title: string }) {
  return <View style={styles.sectionHeader}><Text style={styles.sectionIndex}>{index}</Text><View><Text style={styles.sectionCaption}>{caption}</Text><Text style={styles.sectionTitle}>{title}</Text></View></View>;
}

function FeedbackButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.feedbackButton, active ? styles.feedbackActive : null]}><Text style={[styles.feedbackButtonText, active ? styles.feedbackActiveText : null]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  content: { maxWidth: undefined, paddingTop: 0, paddingHorizontal: 0, paddingBottom: 40, gap: 0 },
  header: { minHeight: 86, paddingTop: 48, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 38, height: 38, borderWidth: 1, borderColor: 'rgba(24,37,32,.18)', borderRadius: 19, backgroundColor: 'rgba(255,255,255,.42)', alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#182520', fontSize: 18 },
  pill: { paddingVertical: 7, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(49,92,79,.22)', borderRadius: 99 },
  pillText: { color: '#315C4F', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  spacer: { width: 38, height: 38 },
  hero: { position: 'relative', marginTop: 15, paddingTop: 24, paddingHorizontal: 24, paddingBottom: 27, overflow: 'hidden' },
  heroOrb: { position: 'absolute', top: -35, right: -30, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,.08)' },
  heroMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroDate: { color: '#F2DDA9', fontSize: 9, fontWeight: '800', letterSpacing: 1.08 },
  heroMode: { paddingVertical: 5, paddingHorizontal: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,.2)', borderRadius: 99, color: '#EEE3F2', fontSize: 8 },
  heroTitle: { marginTop: 19, marginBottom: 13, color: '#FFF8F0', fontFamily: 'Georgia', fontSize: 28, fontWeight: '500', lineHeight: 42 },
  basis: { flexDirection: 'row', gap: 8 },
  basisItem: { flex: 1, flexDirection: 'row', gap: 6 },
  basisCheck: { width: 16, color: '#F1D99D', fontSize: 9, fontWeight: '800' },
  basisText: { flex: 1, color: '#EEE7F1', fontSize: 9, lineHeight: 13.05 },
  heroQuote: { marginTop: 19, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,.14)', color: '#F6DFAC', fontFamily: 'Georgia', fontSize: 14, lineHeight: 23.1 },
  section: { marginTop: 15, marginHorizontal: 18, padding: 18, borderWidth: 1, borderColor: 'rgba(24,37,32,.1)', borderRadius: 22, backgroundColor: 'rgba(255,253,248,.72)' },
  sectionHeader: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  sectionIndex: { color: '#D79576', fontFamily: 'Georgia', fontSize: 12 },
  sectionCaption: { color: '#78877F', fontSize: 8, fontWeight: '800', letterSpacing: 0.96 },
  sectionTitle: { marginTop: 2, color: '#182520', fontFamily: 'Georgia', fontSize: 18, fontWeight: '500' },
  summary: { marginVertical: 14, color: '#52645C', fontSize: 12, lineHeight: 20.64 },
  suggestion: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(24,37,32,.13)', flexDirection: 'row', gap: 9 },
  suggestionIndex: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#315C4F', alignItems: 'center', justifyContent: 'center' },
  suggestionIndexText: { color: '#FFFFFF', fontSize: 9 },
  suggestionCopy: { flex: 1 },
  suggestionTitle: { color: '#182520', fontSize: 11, fontWeight: '700' },
  suggestionText: { marginTop: 3, color: '#52645C', fontSize: 10, lineHeight: 15.5 },
  sourceCopy: { marginTop: 13, color: '#52645C', fontSize: 11, lineHeight: 18.15 },
  boundary: { marginTop: 9, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 12, backgroundColor: 'rgba(49,92,79,.07)', color: '#52645C', fontSize: 9, lineHeight: 13.95 },
  feedbackTitle: { marginBottom: 11, color: '#182520', fontFamily: 'Georgia', fontSize: 15, fontWeight: '500' },
  feedbackButtons: { flexDirection: 'row', gap: 8 },
  feedbackButton: { minHeight: 42, flex: 1, borderWidth: 1, borderColor: 'rgba(24,37,32,.13)', borderRadius: 13, backgroundColor: '#FFFDF8', alignItems: 'center', justifyContent: 'center' },
  feedbackActive: { borderColor: '#315C4F', backgroundColor: '#315C4F' },
  feedbackButtonText: { color: '#52645C', fontSize: 10, fontWeight: '700' },
  feedbackActiveText: { color: '#FFFFFF' },
  feedbackStatus: { marginTop: 9, color: '#78877F', fontSize: 9 },
  chatButton: { minHeight: 56, marginTop: 15, marginHorizontal: 18, paddingHorizontal: 21, borderRadius: 16, backgroundColor: '#315C4F', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chatButtonText: { color: '#FFFAF0', fontSize: 13, fontWeight: '700' },
});
