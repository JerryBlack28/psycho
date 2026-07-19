import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AmbientMusicButton } from '@/components/ambient-music-button';
import { AppScreen } from '@/components/ui';
import { OnboardingModal } from '@/components/onboarding-modal';
import { reportForCards } from '@/data/content';
import { readJson, storageKeys, writeJson } from '@/lib/storage';
import { deriveProfileReport } from '@/lib/profile-runtime';
import { useAppState } from '@/providers/app-state';

function formatToday() {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date());
}

export default function TodayScreen() {
  const router = useRouter();
  const { answer, drawAnswer, echoes, cards, aiEnabled, profileEnabled, profile } = useAppState();
  const [answerText, setAnswerText] = useState(answer);
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  const dueEchoes = useMemo(() => echoes.filter((echo) => echo.revealAt <= Date.now()), [echoes]);
  const report = useMemo(() => (profileEnabled ? deriveProfileReport(profile) : null) || reportForCards(cards), [cards, profile, profileEnabled]);
  const reportMode = (report as { mode?: string }).mode || '基础日报';

  useEffect(() => {
    void readJson(storageKeys.onboarding, false).then((seen) => setOnboardingVisible(!seen));
  }, []);

  function closeOnboarding() {
    setOnboardingVisible(false);
    void writeJson(storageKeys.onboarding, true);
  }

  async function handleDraw() {
    const next = await drawAnswer();
    setAnswerText(next);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  return (
    <AppScreen testID="today-screen" contentStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <Text style={styles.brandSymbol}>◐</Text>
          <Text style={styles.brandName}>心潮</Text>
        </View>
        <View style={styles.headerActions}>
          <AmbientMusicButton />
          <Pressable accessibilityRole="button" accessibilityLabel="查看新手说明" onPress={() => setOnboardingVisible(true)} style={styles.helpButton}>
            <Text style={styles.helpText}>?</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.welcome}>
        <Text style={styles.eyebrow}>{formatToday()}</Text>
        <Text style={styles.welcomeTitle}>今天不必一次走完，{`\n`}先把下一步放稳。</Text>
        <Text style={styles.welcomeCopy}>这里有一份今日潮汐，也有一段随时可以结束的陪伴对话。</Text>
      </View>

      <LinearGradient colors={['#55354F', '#8F719E', '#BCA8D0']} locations={[0, 0.54, 1]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.reportCard}>
        <View style={styles.reportAuroraOuter} />
        <View style={styles.reportAuroraInner} />
        <Text style={styles.reportAuroraSymbol}>◐</Text>
        <View style={styles.reportMeta}>
          <Text style={styles.reportMetaLabel}>今日潮汐</Text>
          <Text style={styles.reportMode}>{reportMode}</Text>
        </View>
        <Text style={styles.reportTitle}>{report.headline}</Text>
        <View style={styles.reportChips}>
          {report.basis.map((item) => <View key={item} style={styles.reportChip}><Text style={styles.reportChipText}>{item}</Text></View>)}
        </View>
        <Text style={styles.reportQuote}>“{report.quote}”</Text>
        <Pressable onPress={() => router.push('/daily-report')} style={styles.reportOpen}>
          <Text style={styles.reportOpenText}>展开今天的专属建议</Text>
          <Text style={styles.reportOpenText}>↗</Text>
        </Pressable>
      </LinearGradient>

      <View style={styles.entryList}>
        <HomeEntry symbol="◐" title="走一段今日章节" copy="闪念 · 选择 · 潮笺" onPress={() => router.push('/chapter')} />
        <HomeEntry symbol="⌁" title="打开未来回响" copy="看看已经回来，或仍在封存的话" echo onPress={() => router.push('/echoes')} />
      </View>

      <View style={styles.answerBook}>
        <View style={styles.answerOrb} />
        <View style={styles.answerTopline}><Text style={styles.answerEyebrow}>DAILY CARD</Text><Text style={styles.answerDate}>今天</Text></View>
        <Text style={styles.answerTitle}>答案之书</Text>
        <Text style={styles.answerPrompt}>在心里想一个问题，然后抽取今天唯一的一张卡。</Text>
        {answerText ? <Text style={styles.answerQuote}>“{answerText}”</Text> : null}
        <Pressable disabled={Boolean(answerText)} onPress={() => void handleDraw()} style={[styles.answerButton, answerText ? styles.answerButtonDisabled : null]}>
          <Text style={[styles.answerButtonText, answerText ? styles.answerButtonTextDisabled : null]}>{answerText ? '今天已经抽过' : '抽取今日答案'}</Text>
          <Text style={[styles.answerButtonText, answerText ? styles.answerButtonTextDisabled : null]}>✦</Text>
        </Pressable>
        <Text style={styles.answerStatus}>每天一次，不记录你想的问题</Text>
      </View>

      <Text style={styles.privacy}><Text style={styles.privacySymbol}>⌁ </Text>{aiEnabled ? 'AI 已按次启用' : 'AI 尚未启用；当前使用本地内容'} · 随时可以停下</Text>
      {dueEchoes.length ? (
        <View style={styles.dueEcho}>
          <View style={styles.tinyOrb} />
          <View><Text style={styles.dueEchoText}>有一句话已经回到今天</Text><Pressable onPress={() => router.push('/echoes')}><Text style={styles.dueEchoLink}>去看看</Text></Pressable></View>
        </View>
      ) : null}
      <OnboardingModal visible={onboardingVisible} onClose={closeOnboarding} />
    </AppScreen>
  );
}

function HomeEntry({ symbol, title, copy, echo = false, onPress }: { symbol: string; title: string; copy: string; echo?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.entry, echo ? styles.echoEntry : null, pressed ? styles.pressed : null]}>
      <View style={[styles.entryIcon, echo ? styles.echoEntryIcon : null]}><Text style={styles.entrySymbol}>{symbol}</Text></View>
      <View style={styles.entryCopy}><Text style={styles.entryTitle}>{title}</Text><Text style={styles.entryDescription}>{copy}</Text></View>
      <Text style={styles.entryArrow}>→</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { maxWidth: undefined, paddingTop: 48, paddingHorizontal: 24, paddingBottom: 98, gap: 0 },
  header: { zIndex: 5, minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  brandSymbol: { color: '#D8BB78', fontFamily: 'Georgia', fontSize: 21 },
  brandName: { color: '#182520', fontFamily: 'Georgia', fontSize: 17, fontWeight: '500', letterSpacing: 2 },
  headerActions: { marginLeft: 'auto', flexDirection: 'row', gap: 8, alignItems: 'center' },
  helpButton: { width: 38, height: 38, borderWidth: 1, borderColor: 'rgba(24,37,32,.18)', borderRadius: 19, backgroundColor: 'rgba(255,255,255,.42)', alignItems: 'center', justifyContent: 'center' },
  helpText: { color: '#315C4F', fontSize: 15, fontWeight: '800' },
  welcome: { marginTop: 20 },
  eyebrow: { color: '#315C4F', fontSize: 10, fontWeight: '800', letterSpacing: 1.7 },
  welcomeTitle: { marginTop: 8, marginBottom: 8, color: '#182520', fontFamily: 'Georgia', fontSize: 27, fontWeight: '500', lineHeight: 37.26 },
  welcomeCopy: { color: '#52645C', fontSize: 11, lineHeight: 17.05 },
  reportCard: { position: 'relative', marginTop: 17, padding: 17, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,.16)', borderRadius: 27, boxShadow: '0 18px 36px rgba(67,45,68,.18)' },
  reportAuroraOuter: { position: 'absolute', top: -23, right: -17, width: 118, height: 118, borderRadius: 59, backgroundColor: 'rgba(255,255,255,.035)' },
  reportAuroraInner: { position: 'absolute', top: -8, right: -2, width: 88, height: 88, borderWidth: 1, borderColor: 'rgba(255,255,255,.22)', borderRadius: 44 },
  reportAuroraSymbol: { position: 'absolute', top: 20, right: 29, color: '#F4DFAD', fontFamily: 'Georgia', fontSize: 26 },
  reportMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reportMetaLabel: { color: '#F2DBA8', fontSize: 9, fontWeight: '800', letterSpacing: 1.08 },
  reportMode: { paddingVertical: 5, paddingHorizontal: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,.17)', borderRadius: 99, color: '#E2D4E7', fontSize: 8 },
  reportTitle: { maxWidth: 270, marginTop: 13, marginBottom: 12, color: '#FFF7EF', fontFamily: 'Georgia', fontSize: 20, fontWeight: '500', lineHeight: 31 },
  reportChips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  reportChip: { paddingVertical: 5, paddingHorizontal: 7, borderRadius: 99, backgroundColor: 'rgba(255,255,255,.1)' },
  reportChipText: { color: '#EFE7F2', fontSize: 8, lineHeight: 10.4 },
  reportQuote: { marginTop: 13, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,.12)', color: '#F4E1B4', fontFamily: 'Georgia', fontSize: 12, lineHeight: 18.6 },
  reportOpen: { minHeight: 39, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reportOpenText: { color: '#FFFAF2', fontSize: 10, fontWeight: '700' },
  entryList: { gap: 9, marginTop: 14 },
  entry: { minHeight: 59, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(24,37,32,.13)', borderRadius: 18, backgroundColor: 'rgba(255,255,255,.56)', flexDirection: 'row', gap: 9, alignItems: 'center' },
  echoEntry: { borderColor: 'rgba(93,113,103,.2)', backgroundColor: 'rgba(255,255,255,.48)' },
  entryIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#315C4F', alignItems: 'center', justifyContent: 'center' },
  echoEntryIcon: { backgroundColor: '#5D7469' },
  entrySymbol: { color: '#F4DFAE', fontFamily: 'Georgia', fontSize: 17 },
  entryCopy: { flex: 1 },
  entryTitle: { color: '#182520', fontFamily: 'Georgia', fontSize: 13, fontWeight: '500' },
  entryDescription: { marginTop: 2, color: '#78877F', fontSize: 8 },
  entryArrow: { color: '#315C4F', fontSize: 14 },
  pressed: { opacity: 0.72 },
  answerBook: { position: 'relative', marginTop: 10, paddingVertical: 14, paddingHorizontal: 15, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(49,92,79,.16)', borderRadius: 21, backgroundColor: 'rgba(255,253,248,.65)' },
  answerOrb: { position: 'absolute', top: -28, right: -17, width: 92, height: 92, borderWidth: 1, borderColor: 'rgba(49,92,79,.08)', borderRadius: 46, backgroundColor: 'rgba(216,187,120,.08)' },
  answerTopline: { flexDirection: 'row', justifyContent: 'space-between' },
  answerEyebrow: { color: '#315C4F', fontSize: 8, fontWeight: '800', letterSpacing: 1.04 },
  answerDate: { color: '#78877F', fontSize: 8 },
  answerTitle: { marginTop: 7, marginBottom: 4, color: '#182520', fontFamily: 'Georgia', fontSize: 18, fontWeight: '500' },
  answerPrompt: { marginBottom: 10, color: '#52645C', fontSize: 9, lineHeight: 13.95 },
  answerQuote: { marginVertical: 8, color: '#182520', fontFamily: 'Georgia', fontSize: 14, lineHeight: 23.1 },
  answerButton: { minHeight: 39, paddingHorizontal: 12, borderRadius: 13, backgroundColor: '#315C4F', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  answerButtonDisabled: { backgroundColor: 'rgba(49,92,79,.1)' },
  answerButtonText: { color: '#FFF8ED', fontSize: 10, fontWeight: '700' },
  answerButtonTextDisabled: { color: '#315C4F' },
  answerStatus: { marginTop: 7, color: '#78877F', fontSize: 8, textAlign: 'center' },
  privacy: { marginTop: 9, color: '#78877F', fontSize: 9, textAlign: 'center' },
  privacySymbol: { color: '#315C4F' },
  dueEcho: { marginTop: 10, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(24,37,32,.13)', borderRadius: 16, backgroundColor: 'rgba(255,255,255,.5)', flexDirection: 'row', gap: 12, alignItems: 'center' },
  tinyOrb: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#C59B74' },
  dueEchoText: { color: '#182520', fontSize: 12 },
  dueEchoLink: { minHeight: 26, color: '#315C4F', fontSize: 13, fontWeight: '700' },
});
