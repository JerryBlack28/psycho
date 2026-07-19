import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AmbientMusicButton } from '@/components/ambient-music-button';
import { AppScreen } from '@/components/ui';
import { useAppState } from '@/providers/app-state';
import type { TideCard, TideKey } from '@/types';

const tideColors: Record<TideKey, string> = { insight: '#D8BB78', grounding: '#78A58E', connection: '#CF8B72', vitality: '#9D8DB8' };

export default function CardsScreen() {
  const router = useRouter();
  const { cards } = useAppState();
  const [selected, setSelected] = useState<TideCard | null>(null);
  const slots = Array.from({ length: 12 }, (_, index) => cards[index] ?? null);

  return (
    <AppScreen testID="cards-screen" contentStyle={styles.content}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="返回上一页" onPress={() => router.back()} style={styles.brand}><Text style={styles.brandSymbol}>◐</Text><Text style={styles.brandName}>心潮</Text></Pressable>
        <AmbientMusicButton />
      </View>
      <Pressable accessibilityLabel="返回上一页" onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>←</Text></Pressable>
      <View style={styles.heading}><Text style={styles.eyebrow}>MY TIDE CARDS</Text><Text style={styles.title}>潮笺卡槽</Text><Text style={styles.description}>满潮时选择「收进卡槽」，那张短句就会留在这里。它和未来回响是两件不同的事。</Text></View>

      <View style={styles.summary}><View style={styles.summaryTop}><Text style={styles.summaryLabel}>已收集</Text><Text style={styles.summaryCount}>{cards.length} / 12</Text></View><Text style={styles.summaryCopy}>{cards.length ? '这些都是你在章节中主动收下的内置潮笺。' : '满潮时选择收进卡槽，第一张潮笺就会出现在这里。'}</Text></View>
      <View style={styles.grid}>
        {slots.map((card, index) => card ? <TideSlot key={card.id} card={card} onPress={() => setSelected(card)} /> : <View key={`empty-${index}`} style={[styles.slot, styles.lockedSlot]}><View style={styles.slotMeta}><Text style={styles.lockedSymbol}>◌</Text><Text style={styles.lockedLabel}>第 {String(index + 1).padStart(2, '0')} 槽</Text></View><Text style={styles.lockedQuote}>尚未遇见</Text><Text style={styles.slotFoot}>完成章节，满潮时可能出现</Text></View>)}
      </View>
      <View style={styles.privacy}><Text style={styles.privacySymbol}>⌁</Text><View style={styles.privacyCopy}><Text style={styles.privacyTitle}>卡槽不保存你的心理内容</Text><Text style={styles.privacyText}>本机只记录内置卡片编号和收藏时间；不保存闪念、选择、潮位或画像。</Text></View></View>
      <Pressable onPress={() => router.push('/profile')} style={styles.manage}><Text style={styles.manageText}>管理本地卡槽</Text></Pressable>

      <Modal visible={Boolean(selected)} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.backdrop}>
          {selected ? <LinearGradient colors={['#29463B', '#101C18']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.detail}>
            <View style={styles.orbit}><View style={styles.orbitRing} /><Text style={styles.detailSymbol}>{selected.symbol}</Text></View>
            <Text style={styles.detailEyebrow}>潮笺卡槽 · {selected.label}</Text>
            <Text style={styles.detailTitle}>{selected.label}潮笺</Text>
            <Text style={styles.detailQuote}>“{selected.quote}”</Text>
            <Text style={styles.detailDescription}>这是一张你在满潮时主动收下的内置短句，不是测评结论。</Text>
            <Text style={styles.detailDate}>{new Date(selected.collectedAt).toLocaleDateString('zh-CN')} 收进卡槽</Text>
            <Pressable onPress={() => setSelected(null)} style={styles.detailButton}><Text style={styles.detailButtonText}>收好</Text><Text style={styles.detailButtonText}>↓</Text></Pressable>
          </LinearGradient> : null}
        </View>
      </Modal>
    </AppScreen>
  );
}

function TideSlot({ card, onPress }: { card: TideCard; onPress: () => void }) {
  const color = tideColors[card.tide];
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.slot, { borderColor: `${color}66`, opacity: pressed ? 0.72 : 1 }]}><LinearGradient colors={[`${color}26`, '#FFFDF8']} style={StyleSheet.absoluteFill} /><View style={styles.slotMeta}><Text style={[styles.slotSymbol, { color }]}>{card.symbol}</Text><Text style={styles.slotLabel}>{card.label}</Text></View><Text style={styles.slotQuote}>“{card.quote}”</Text><Text style={styles.slotFoot}>{new Date(card.collectedAt).toLocaleDateString('zh-CN')} 收下</Text></Pressable>;
}

const styles = StyleSheet.create({
  content: { maxWidth: undefined, paddingTop: 48, paddingHorizontal: 24, paddingBottom: 40, gap: 0 },
  header: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  brandSymbol: { color: '#D8BB78', fontFamily: 'Georgia', fontSize: 21 },
  brandName: { color: '#182520', fontFamily: 'Georgia', fontSize: 17, fontWeight: '500', letterSpacing: 2 },
  back: { width: 32, height: 32, marginTop: 12, borderWidth: 1, borderColor: 'rgba(24,37,32,.16)', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#182520', fontSize: 16 },
  heading: { marginTop: 14 },
  eyebrow: { color: '#315C4F', fontSize: 10, fontWeight: '800', letterSpacing: 1.7 },
  title: { marginTop: 9, marginBottom: 12, color: '#182520', fontFamily: 'Georgia', fontSize: 42, fontWeight: '500', lineHeight: 56.7 },
  description: { color: '#52645C', fontSize: 14, lineHeight: 23.8 },
  summary: { marginTop: 19, paddingVertical: 14, paddingHorizontal: 15, borderWidth: 1, borderColor: 'rgba(49,92,79,.14)', borderRadius: 18, backgroundColor: 'rgba(255,255,255,.5)' },
  summaryTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  summaryLabel: { color: '#52645C', fontSize: 9, fontWeight: '800', letterSpacing: 0.9 },
  summaryCount: { color: '#315C4F', fontFamily: 'Georgia', fontSize: 20, fontWeight: '500' },
  summaryCopy: { marginTop: 6, color: '#78877F', fontSize: 10, lineHeight: 15 },
  grid: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slot: { position: 'relative', width: '48%', minHeight: 164, padding: 13, overflow: 'hidden', borderWidth: 1, borderRadius: 20, borderTopLeftRadius: 8, backgroundColor: '#FFFDF8', justifyContent: 'space-between', boxShadow: '0 10px 22px rgba(31,52,44,.08)' },
  lockedSlot: { borderColor: 'rgba(140,153,146,.35)', borderStyle: 'dashed', backgroundColor: 'rgba(255,255,255,.28)', boxShadow: 'none' },
  slotMeta: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  slotSymbol: { fontFamily: 'Georgia', fontSize: 17 },
  slotLabel: { color: '#315C4F', fontSize: 9, fontWeight: '800', letterSpacing: 0.72 },
  slotQuote: { color: '#182520', fontFamily: 'Georgia', fontSize: 13, lineHeight: 20.15 },
  slotFoot: { color: '#78877F', fontSize: 8, lineHeight: 11.2 },
  lockedSymbol: { color: '#8C9992', fontFamily: 'Georgia', fontSize: 17 },
  lockedLabel: { color: '#8C9992', fontSize: 9, fontWeight: '800' },
  lockedQuote: { color: '#9AA59F', fontFamily: 'Georgia', fontSize: 12, textAlign: 'center' },
  privacy: { marginTop: 15, marginBottom: 10, padding: 12, borderRadius: 15, backgroundColor: 'rgba(49,92,79,.07)', flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  privacySymbol: { color: '#315C4F', fontSize: 18 },
  privacyCopy: { flex: 1 },
  privacyTitle: { color: '#182520', fontSize: 10, fontWeight: '700' },
  privacyText: { marginTop: 3, color: '#78877F', fontSize: 8, lineHeight: 11.6 },
  manage: { width: '100%', minHeight: 44, borderWidth: 1, borderColor: 'rgba(24,37,32,.13)', borderRadius: 16, backgroundColor: 'rgba(255,255,255,.45)', alignItems: 'center', justifyContent: 'center' },
  manageText: { color: '#315C4F', fontSize: 13, fontWeight: '700' },
  backdrop: { flex: 1, padding: 20, backgroundColor: 'rgba(7,14,12,.78)', alignItems: 'center', justifyContent: 'center' },
  detail: { width: '100%', paddingTop: 24, paddingHorizontal: 21, paddingBottom: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(216,187,120,.28)', borderRadius: 29, alignItems: 'center', boxShadow: '0 24px 55px rgba(0,0,0,.4)' },
  orbit: { position: 'relative', width: 82, height: 82, marginBottom: 15, alignItems: 'center', justifyContent: 'center' },
  orbitRing: { position: 'absolute', inset: 0, borderWidth: 1, borderColor: 'rgba(216,187,120,.34)', borderRadius: 41 },
  detailSymbol: { color: '#D8BB78', fontFamily: 'Georgia', fontSize: 31 },
  detailEyebrow: { color: '#CBB77F', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  detailTitle: { marginTop: 8, marginBottom: 13, color: '#F6EEE2', fontFamily: 'Georgia', fontSize: 21, fontWeight: '500', lineHeight: 30.45 },
  detailQuote: { width: '100%', paddingVertical: 17, paddingHorizontal: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,.1)', color: '#F1DFB7', fontFamily: 'Georgia', fontSize: 18, lineHeight: 30.6, textAlign: 'center' },
  detailDescription: { marginTop: 13, color: '#ADBBB4', fontSize: 10, lineHeight: 15.5, textAlign: 'center' },
  detailDate: { marginTop: 10, marginBottom: 17, color: '#8FA49A', fontSize: 9 },
  detailButton: { width: '100%', minHeight: 56, paddingHorizontal: 21, borderRadius: 16, backgroundColor: '#EAD8AD', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailButtonText: { color: '#182520', fontSize: 13, fontWeight: '700' },
});
