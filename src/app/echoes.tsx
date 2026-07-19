import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AmbientMusicButton } from '@/components/ambient-music-button';
import { AppScreen } from '@/components/ui';
import { useAppState } from '@/providers/app-state';

export default function EchoesScreen() {
  const router = useRouter();
  const { echoes, removeEcho, clearEchoes } = useAppState();

  function confirmClear() {
    Alert.alert('清空全部回响？', '只会删除当前设备中主动保存的未来回响。', [
      { text: '取消', style: 'cancel' },
      { text: '清空', style: 'destructive', onPress: () => void clearEchoes() },
    ]);
  }

  return (
    <AppScreen testID="echoes-screen" contentStyle={styles.content}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="返回上一页" onPress={() => router.back()} style={styles.brand}><Text style={styles.brandSymbol}>◐</Text><Text style={styles.brandName}>心潮</Text></Pressable>
        <AmbientMusicButton />
      </View>
      <Pressable accessibilityLabel="返回上一页" onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>←</Text></Pressable>
      <View style={styles.heading}><Text style={styles.eyebrow}>MY ECHOES</Text><Text style={styles.title}>回响</Text><Text style={styles.description}>这里只出现你主动保存在这台设备上的话。未到日期前，它会保持封存。</Text></View>

      {echoes.length ? <View style={styles.list}>{echoes.map((echo) => {
        const unlocked = echo.revealAt <= Date.now();
        return <View key={echo.id} style={[styles.record, !unlocked ? styles.sealedRecord : null]}><Pressable accessibilityLabel="删除这条回响" onPress={() => removeEcho(echo.id)} style={styles.delete}><Text style={styles.deleteText}>×</Text></Pressable><Text style={styles.recordState}>{unlocked ? '已经回到今天' : '仍在封存'}</Text><Text style={styles.recordQuote}>{unlocked ? `“${echo.text}”` : '这句话仍在路上，到了约定日期才会显示。'}</Text><Text style={styles.recordMeta}>{new Date(echo.revealAt).toLocaleDateString('zh-CN')} 解封</Text></View>;
      })}</View> : <View style={styles.empty}><Text style={styles.emptySymbol}>⌁</Text><Text style={styles.emptyTitle}>还没有保存的回响</Text><Text style={styles.emptyCopy}>完成一次梳理后，你可以选择留一句话给未来。</Text><Pressable onPress={() => router.replace('/chapter')} style={styles.startButton}><Text style={styles.startText}>开始一次梳理</Text></Pressable></View>}
      {echoes.length ? <Pressable onPress={confirmClear} style={styles.clearButton}><Text style={styles.clearText}>清空全部回响</Text></Pressable> : null}
    </AppScreen>
  );
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
  list: { gap: 12, marginTop: 22 },
  record: { position: 'relative', padding: 18, borderWidth: 1, borderColor: 'rgba(24,37,32,.13)', borderRadius: 21, backgroundColor: '#FFFDF8', boxShadow: '0 10px 24px rgba(31,52,44,.08)' },
  sealedRecord: { backgroundColor: '#E5DCCD' },
  recordState: { marginBottom: 8, color: '#315C4F', fontSize: 9, fontWeight: '800', letterSpacing: 1.08 },
  recordQuote: { paddingRight: 26, color: '#182520', fontFamily: 'Georgia', fontSize: 16, lineHeight: 25.6 },
  recordMeta: { marginTop: 11, color: '#78877F', fontSize: 10 },
  delete: { position: 'absolute', top: 11, right: 11, zIndex: 2, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,.55)', alignItems: 'center', justifyContent: 'center' },
  deleteText: { color: '#78877F', fontSize: 18 },
  empty: { marginTop: 40, paddingVertical: 30, paddingHorizontal: 22, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(49,92,79,.25)', borderRadius: 24, alignItems: 'center' },
  emptySymbol: { color: '#D8BB78', fontSize: 37 },
  emptyTitle: { marginTop: 12, marginBottom: 7, color: '#182520', fontFamily: 'Georgia', fontSize: 20, fontWeight: '500' },
  emptyCopy: { marginBottom: 18, color: '#52645C', fontSize: 12, lineHeight: 19.2, textAlign: 'center' },
  startButton: { width: '100%', minHeight: 48, borderRadius: 16, backgroundColor: '#315C4F', alignItems: 'center', justifyContent: 'center' },
  startText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  clearButton: { minHeight: 44, marginTop: 15, alignItems: 'center', justifyContent: 'center' },
  clearText: { color: '#A95F56', fontSize: 13, fontWeight: '700' },
});
