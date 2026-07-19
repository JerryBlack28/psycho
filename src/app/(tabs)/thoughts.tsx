import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AmbientMusicButton } from '@/components/ambient-music-button';
import { MicIcon } from '@/components/icons';
import { AppScreen } from '@/components/ui';
import { VoiceModeModal } from '@/components/voice-mode-modal';
import { useAppState } from '@/providers/app-state';
import type { QuickNote } from '@/types';

function durationLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.max(0, seconds % 60)).padStart(2, '0')}`;
}

function noteDate(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
}

export default function ThoughtsScreen() {
  const router = useRouter();
  const appState = useAppState();
  const { notes, addNote, removeNote } = appState;
  const [text, setText] = useState('');
  const [imageUri, setImageUri] = useState('');
  const [imageRights, setImageRights] = useState(false);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [status, setStatus] = useState('文字、日期和表达类型保存在本机；原图与语音文件不保存');
  const [deckIndex, setDeckIndex] = useState(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState('');
  const [voiceVisible, setVoiceVisible] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const effectiveVoiceDuration = recorderState.isRecording ? Math.max(1, Math.round(recorderState.durationMillis / 1000)) : voiceDuration;
  const orderedNotes = useMemo(() => notes.length
    ? notes.slice(deckIndex % notes.length).concat(notes.slice(0, deckIndex % notes.length))
    : [], [deckIndex, notes]);
  const visibleNotes = orderedNotes.slice(0, 4);
  const frontNote = visibleNotes[0];
  const deckHeight = frontNote?.hasImage ? 315 : frontNote?.voiceDuration ? 260 : 220;

  async function pickImage(camera = false) {
    const result = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    setAttachmentOpen(false);
    if (!result.canceled) {
      setImageUri(result.assets[0]?.uri ?? '');
      setImageRights(false);
    }
  }

  async function toggleVoice() {
    if (Platform.OS === 'web') {
      setVoiceVisible(true);
      return;
    }
    if (recorderState.isRecording) {
      await recorder.stop();
      setVoiceDuration(Math.max(1, Math.round(recorderState.durationMillis / 1000)));
      setStatus('语音文件不会保存；请确认或补充转写文字后再提交。');
      return;
    }
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setStatus('需要麦克风权限才能记录语音闪念。');
      return;
    }
    await recorder.prepareToRecordAsync();
    recorder.record();
    setStatus('正在录音；再次点击麦克风结束。');
  }

  async function save() {
    if (!text.trim() && !imageUri && !voiceDuration) return;
    if (imageUri && !imageRights) {
      setStatus('请先确认你有权处理这张图片。');
      return;
    }
    await addNote({
      text: text.trim() || (imageUri ? '一张图片闪念' : '一段语音闪念'),
      mood: '闪念',
      hasImage: Boolean(imageUri),
      imageUri: imageUri || undefined,
      imageRightsConfirmed: imageRights,
      voiceDuration,
    });
    setText('');
    setImageUri('');
    setImageRights(false);
    setVoiceDuration(0);
    setDeckIndex(0);
    setStatus('已保存文字、日期和表达类型；原图与语音文件未保存。');
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function requestDelete(note: QuickNote) {
    if (confirmDeleteId !== note.id) {
      setConfirmDeleteId(note.id);
      setStatus('再次点击“确认删除”以移除这张闪念。');
      return;
    }
    await removeNote(note.id);
    setConfirmDeleteId('');
    setDeckIndex(0);
    setStatus('已移除这条闪念，初印象也会随之更新。');
  }

  const canSave = Boolean(text.trim() || imageUri || voiceDuration || recorderState.isRecording);

  return (
    <AppScreen testID="thoughts-screen" contentStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.brand}><Text style={styles.brandSymbol}>◐</Text><Text style={styles.brandName}>心潮</Text></View>
        <AmbientMusicButton />
      </View>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>QUICK THOUGHTS</Text>
        <Text style={styles.title}>闪念</Text>
        <Text style={styles.description}>写一句、放一张图片，或者用声音说下来。不同形式也可以留在同一条闪念里。</Text>
      </View>

      <View style={styles.library}>
        <View style={styles.libraryHeading}><Text style={styles.libraryTitle}>最近的闪念</Text><Text style={styles.libraryTotal}>{notes.length} 张</Text></View>
        {notes.length ? (
          <>
            <View style={[styles.deck, { height: deckHeight + 78 }]}>
              {[...visibleNotes].reverse().map((note, reverseIndex) => {
                const position = visibleNotes.length - 1 - reverseIndex;
                return (
                  <NoteCard
                    key={note.id}
                    note={note}
                    position={position}
                    height={deckHeight}
                    confirming={confirmDeleteId === note.id}
                    onReveal={() => setDeckIndex(notes.findIndex((item) => item.id === note.id))}
                    onUse={() => router.push('/chapter')}
                    onDelete={() => void requestDelete(note)}
                  />
                );
              })}
            </View>
            {notes.length > 1 ? (
              <View style={styles.deckNav}>
                <Pressable accessibilityLabel="查看上一张闪念" onPress={() => setDeckIndex((value) => (value - 1 + notes.length) % notes.length)} style={styles.deckArrowButton}><Text style={styles.deckArrow}>←</Text></Pressable>
                <Text style={styles.deckPosition}>{(deckIndex % notes.length) + 1} / {notes.length}</Text>
                <Pressable accessibilityLabel="查看下一张闪念" onPress={() => setDeckIndex((value) => (value + 1) % notes.length)} style={styles.deckArrowButton}><Text style={styles.deckArrow}>→</Text></Pressable>
              </View>
            ) : null}
          </>
        ) : <EmptyDeck />}
        <Text style={styles.libraryStatus}>{notes.length ? status : ''}</Text>
      </View>

      <LinearGradient colors={['#FFFBEE', '#EFDFB8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.composer}>
        <View style={styles.composerTape} />
        <View style={styles.foldCorner} />
        <View style={styles.paperHeading}><Text style={styles.paperTitle}>随手便签</Text><Text style={styles.paperMode}>写 · 拍 · 说</Text></View>

        {imageUri || effectiveVoiceDuration ? (
          <View style={styles.previewRow}>
            {imageUri ? <View style={styles.photoPreview}><Image source={{ uri: imageUri }} style={styles.photo} /><Pressable accessibilityLabel="移除图片" onPress={() => { setImageUri(''); setImageRights(false); }} style={styles.removePhoto}><Text style={styles.removePhotoText}>×</Text></Pressable></View> : null}
            {effectiveVoiceDuration ? <View style={styles.voicePreview}><View style={styles.voiceDot} /><View style={styles.voiceCopy}><Text style={styles.voiceTitle}>{recorderState.isRecording ? '正在记录语音闪念' : '语音闪念'}</Text><Text style={styles.voiceDuration}>{durationLabel(effectiveVoiceDuration)}</Text></View>{!recorderState.isRecording ? <Pressable onPress={() => setVoiceDuration(0)}><Text style={styles.previewRemove}>移除</Text></Pressable> : null}</View> : null}
          </View>
        ) : null}
        {imageUri ? <Pressable onPress={() => setImageRights((value) => !value)} style={styles.rightsRow}><View style={[styles.checkbox, imageRights ? styles.checkboxChecked : null]}><Text style={styles.checkmark}>{imageRights ? '✓' : ''}</Text></View><Text style={styles.rightsCopy}>我确认有权处理这张图片，并同意在持续画像已开启时将它发送给自定义 AI 端点一次</Text></Pressable> : null}

        <View style={styles.messageBar}>
          <TextInput
            testID="quick-note-input"
            value={text}
            onChangeText={setText}
            multiline
            maxLength={200}
            placeholder="留下一点此刻的想法……"
            placeholderTextColor="#908C7D"
            style={styles.input}
          />
          <View style={styles.composerControls}>
            <Pressable accessibilityLabel="添加图片" onPress={() => setAttachmentOpen((value) => !value)} style={[styles.controlButton, attachmentOpen ? styles.plusOpen : null]}><Text style={[styles.plus, attachmentOpen ? styles.controlLight : null]}>＋</Text></Pressable>
            <Text style={styles.attachmentHint}>添加图片 · 语音</Text>
            <Pressable accessibilityLabel={recorderState.isRecording ? '停止语音闪念' : '开始实时语音转写闪念'} onPress={() => void toggleVoice()} style={[styles.controlButton, recorderState.isRecording ? styles.recordingButton : null]}><MicIcon color={recorderState.isRecording ? '#FFFFFF' : '#4B5C54'} size={22} /></Pressable>
            <Pressable accessibilityLabel="提交闪念" disabled={!canSave} onPress={() => void save()} style={[styles.controlButton, styles.sendButton, !canSave ? styles.sendDisabled : null]}><Text style={[styles.sendText, !canSave ? styles.sendTextDisabled : null]}>↑</Text></Pressable>
          </View>
          {attachmentOpen ? <View style={styles.attachmentMenu}><AttachmentItem symbol="▧" title="图片" copy="从相册选择" onPress={() => void pickImage(false)} /><View style={styles.attachmentDivider} /><AttachmentItem symbol="◎" title="随手拍" copy="拍下此刻" onPress={() => void pickImage(true)} /></View> : null}
        </View>
        <View style={styles.composerMeta}><Text style={styles.metaText}>{text.length} / 200</Text><Text style={styles.metaStatus}>{status}</Text></View>
      </LinearGradient>
      <VoiceModeModal
        visible={voiceVisible}
        settings={appState.asrSettings}
        initialText={text}
        onTranscript={(value) => {
          setText(value);
          setVoiceDuration(1);
          setStatus('实时转写已回填；请确认或补充文字后再提交。');
        }}
        onClose={() => setVoiceVisible(false)}
      />
    </AppScreen>
  );
}

function NoteCard({ note, position, height, confirming, onReveal, onUse, onDelete }: { note: QuickNote; position: number; height: number; confirming: boolean; onReveal: () => void; onUse: () => void; onDelete: () => void }) {
  const offsets = [
    { translateX: 0, translateY: 0, rotate: '0deg' },
    { translateX: -7, translateY: 12, rotate: '-2.2deg' },
    { translateX: 7, translateY: 22, rotate: '2deg' },
    { translateX: -2, translateY: 31, rotate: '-0.7deg' },
  ];
  const modalities = ['文字', note.hasImage ? '图片' : '', note.voiceDuration ? '语音' : ''].filter(Boolean).join(' · ');
  return (
    <Pressable accessibilityRole={position ? 'button' : undefined} accessibilityLabel={position ? `把第 ${position + 1} 张闪念移到最上层` : undefined} onPress={position ? onReveal : undefined} style={[styles.noteCard, { zIndex: 5 - position, transform: [{ translateX: offsets[position].translateX }, { translateY: offsets[position].translateY }, { rotate: offsets[position].rotate }] }]}>
      <LinearGradient colors={note.hasImage ? ['transparent', 'transparent'] : ['#FFFAF0', '#F0DFB8']} style={[styles.noteVisual, { height }, note.hasImage ? styles.photoNoteVisual : null]}>
        {!note.hasImage ? <View style={styles.noteTape} /> : null}
        {note.hasImage && note.imageUri ? <Image source={{ uri: note.imageUri }} style={styles.notePhoto} /> : null}
        <View style={[styles.noteSheet, note.hasImage ? styles.photoNoteSheet : null]}>
          <View style={styles.noteMeta}><Text style={styles.noteMetaText}>{modalities}闪念</Text><Text style={styles.noteMetaText}>{noteDate(note.createdAt)}</Text></View>
          <Text numberOfLines={4} style={[styles.noteQuote, note.hasImage ? styles.photoNoteQuote : null]}>{note.text || (note.voiceDuration ? '一段还没有转成文字的声音。' : '一张图片闪念（原图未保存）。')}</Text>
          {note.voiceDuration ? <View style={styles.noteVoice}><View style={styles.notePlay}><Text style={styles.notePlayText}>▶</Text></View><View style={styles.waveform}>{Array.from({ length: 11 }, (_, index) => <View key={index} style={[styles.waveBar, { height: index % 3 === 0 ? 18 : index % 4 === 1 ? 12 : 9 }]} />)}</View><Text style={styles.waveDuration}>{durationLabel(note.voiceDuration)}</Text></View> : null}
        </View>
      </LinearGradient>
      {!position ? <View style={styles.noteActions}><Pressable onPress={onUse} style={styles.useNote}><Text style={styles.useNoteText}>用它开始梳理</Text></Pressable><Pressable onPress={onDelete} style={styles.deleteNote}><Text style={styles.deleteNoteText}>{confirming ? '确认删除' : '删除'}</Text></Pressable></View> : null}
    </Pressable>
  );
}

function EmptyDeck() {
  return <View style={styles.emptyWrap}><View style={[styles.emptyBehind, styles.emptyBehindLeft]} /><View style={[styles.emptyBehind, styles.emptyBehindRight]} /><LinearGradient colors={['#FFFAF0', '#F0DFB8']} style={styles.empty}><View style={styles.emptyLines}><View style={styles.emptyLine} /><View style={[styles.emptyLine, styles.emptyLineFaint]} /><View style={[styles.emptyLine, styles.emptyLineFainter]} /></View><Text style={styles.emptyTitle}>还没有留下闪念</Text><Text style={styles.emptyCopy}>从下面写、拍或说一点。它们会在这里一张张叠起来。</Text></LinearGradient></View>;
}

function AttachmentItem({ symbol, title, copy, onPress }: { symbol: string; title: string; copy: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.attachmentItem}><View style={styles.attachmentSymbol}><Text style={styles.attachmentSymbolText}>{symbol}</Text></View><View><Text style={styles.attachmentTitle}>{title}</Text><Text style={styles.attachmentCopy}>{copy}</Text></View></Pressable>;
}

const styles = StyleSheet.create({
  content: { maxWidth: undefined, paddingTop: 48, paddingHorizontal: 24, paddingBottom: 104, gap: 0 },
  header: { zIndex: 5, minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  brandSymbol: { color: '#D8BB78', fontFamily: 'Georgia', fontSize: 21 },
  brandName: { color: '#182520', fontFamily: 'Georgia', fontSize: 17, fontWeight: '500', letterSpacing: 2 },
  heading: { marginTop: 22 },
  eyebrow: { color: '#315C4F', fontSize: 10, fontWeight: '800', letterSpacing: 1.7 },
  title: { marginTop: 9, marginBottom: 12, color: '#182520', fontFamily: 'Georgia', fontSize: 42, fontWeight: '500', lineHeight: 56.7 },
  description: { color: '#52645C', fontSize: 14, lineHeight: 23.8 },
  library: { marginTop: 22 },
  libraryHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 14 },
  libraryTitle: { color: '#182520', fontFamily: 'Georgia', fontSize: 18, fontWeight: '500' },
  libraryTotal: { color: '#78877F', fontSize: 9 },
  deck: { position: 'relative', marginTop: 19, marginHorizontal: 8 },
  noteCard: { position: 'absolute', top: 0, right: 0, left: 0, paddingTop: 4, paddingHorizontal: 3 },
  noteVisual: { position: 'relative', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(125,102,67,.2)', borderRadius: 24, borderTopLeftRadius: 6, borderTopRightRadius: 27, boxShadow: '0 18px 34px rgba(82,62,30,.14)' },
  photoNoteVisual: { paddingTop: 4, paddingRight: 22, paddingBottom: 52, paddingLeft: 4, borderWidth: 0, backgroundColor: 'transparent', boxShadow: 'none' },
  noteTape: { position: 'absolute', top: -7, left: '50%', marginLeft: -38, width: 76, height: 22, backgroundColor: 'rgba(223,203,159,.64)', transform: [{ rotate: '-2deg' }] },
  notePhoto: { width: '88%', height: 248, borderWidth: 1, borderColor: 'rgba(91,69,51,.16)', borderRadius: 24, borderTopLeftRadius: 7, borderTopRightRadius: 29, transform: [{ rotate: '-1.4deg' }] },
  noteSheet: { flex: 1, paddingTop: 24, paddingHorizontal: 22, paddingBottom: 21 },
  photoNoteSheet: { position: 'absolute', right: 2, bottom: 5, width: '76%', minHeight: 150, paddingTop: 15, paddingHorizontal: 16, paddingBottom: 16, borderWidth: 2, borderColor: '#7B6A5D', borderRadius: 14, backgroundColor: '#F4F1EB', transform: [{ rotate: '2.5deg' }], boxShadow: '0 13px 24px rgba(46,37,29,.19)' },
  noteMeta: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 9, borderBottomWidth: 2, borderBottomColor: '#8B6F38' },
  noteMetaText: { color: '#8B6F38', fontSize: 8, fontWeight: '800', letterSpacing: 0.56 },
  noteQuote: { marginTop: 18, color: '#182520', fontFamily: 'Georgia', fontSize: 18, lineHeight: 30.6 },
  photoNoteQuote: { marginTop: 12, color: '#5F5148', fontSize: 14, lineHeight: 21.7 },
  noteVoice: { marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(95,81,72,.22)', flexDirection: 'row', gap: 8, alignItems: 'center' },
  notePlay: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#315C4F', alignItems: 'center', justifyContent: 'center' },
  notePlayText: { color: '#FFFAF0', fontSize: 8 },
  waveform: { height: 25, flex: 1, flexDirection: 'row', gap: 3, alignItems: 'center' },
  waveBar: { width: 2, borderRadius: 99, backgroundColor: 'rgba(49,92,79,.46)' },
  waveDuration: { color: '#78877F', fontSize: 8 },
  noteActions: { zIndex: 3, marginTop: 13, marginHorizontal: 4, flexDirection: 'row', gap: 8, alignItems: 'center' },
  useNote: { minHeight: 37, flex: 1, borderRadius: 12, backgroundColor: '#315C4F', alignItems: 'center', justifyContent: 'center' },
  useNoteText: { color: '#FFFAF0', fontSize: 9, fontWeight: '700' },
  deleteNote: { minHeight: 37, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(169,95,86,.2)', borderRadius: 12, backgroundColor: 'rgba(255,255,255,.45)', alignItems: 'center', justifyContent: 'center' },
  deleteNoteText: { color: '#A95F56', fontSize: 9, fontWeight: '700' },
  deckNav: { marginTop: 8, marginBottom: 2, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  deckArrowButton: { width: 32, height: 32, borderWidth: 1, borderColor: 'rgba(49,92,79,.13)', borderRadius: 16, backgroundColor: 'rgba(255,253,248,.68)', alignItems: 'center', justifyContent: 'center' },
  deckArrow: { color: '#315C4F', fontSize: 14 },
  deckPosition: { minWidth: 48, color: '#78877F', fontSize: 8, fontWeight: '700', letterSpacing: 0.64, textAlign: 'center' },
  emptyWrap: { position: 'relative', minHeight: 253, marginTop: 23, marginHorizontal: 11, marginBottom: 25 },
  emptyBehind: { position: 'absolute', top: 5, right: 5, bottom: 43, left: 5, borderWidth: 1, borderColor: 'rgba(122,100,66,.14)', borderRadius: 24, backgroundColor: '#F8EED8', boxShadow: '0 12px 24px rgba(82,62,30,.08)' },
  emptyBehindLeft: { transform: [{ rotate: '-3deg' }, { translateX: -9 }, { translateY: 5 }] },
  emptyBehindRight: { transform: [{ rotate: '2.6deg' }, { translateX: 8 }, { translateY: 7 }] },
  empty: { minHeight: 205, padding: 28, borderWidth: 1, borderColor: 'rgba(122,100,66,.17)', borderRadius: 24, borderTopLeftRadius: 9, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-0.7deg' }], boxShadow: '0 17px 34px rgba(82,62,30,.12)' },
  emptyLines: { width: 42, gap: 3 },
  emptyLine: { height: 5, borderRadius: 99, backgroundColor: 'rgba(139,111,56,.32)' },
  emptyLineFaint: { backgroundColor: 'rgba(139,111,56,.18)' },
  emptyLineFainter: { backgroundColor: 'rgba(139,111,56,.1)' },
  emptyTitle: { marginTop: 29, color: '#182520', fontFamily: 'Georgia', fontSize: 20, fontWeight: '500' },
  emptyCopy: { maxWidth: 260, marginTop: 9, color: '#52645C', fontSize: 10, lineHeight: 16.5, textAlign: 'center' },
  libraryStatus: { minHeight: 16, marginTop: 8, color: '#315C4F', fontSize: 9, textAlign: 'center' },
  composer: { position: 'relative', zIndex: 4, marginTop: 36, marginHorizontal: 3, marginBottom: 2, paddingTop: 22, paddingHorizontal: 16, paddingBottom: 12, overflow: 'visible', borderWidth: 1, borderColor: 'rgba(122,100,66,.2)', borderRadius: 24, borderTopLeftRadius: 6, borderTopRightRadius: 25, transform: [{ rotate: '-0.28deg' }], boxShadow: '0 18px 38px rgba(82,62,30,.18)' },
  composerTape: { position: 'absolute', top: -9, left: '50%', marginLeft: -41, width: 82, height: 23, backgroundColor: 'rgba(218,193,142,.72)', transform: [{ rotate: '-2.5deg' }], boxShadow: '0 3px 7px rgba(74,55,25,.09)' },
  foldCorner: { position: 'absolute', right: -1, bottom: -1, width: 25, height: 25, borderBottomRightRadius: 21, backgroundColor: '#E4D2AB', opacity: 0.72 },
  paperHeading: { paddingHorizontal: 2, paddingBottom: 9, borderBottomWidth: 2, borderBottomColor: 'rgba(119,93,53,.48)', flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  paperTitle: { color: '#785F38', fontFamily: 'Georgia', fontSize: 14, fontWeight: '600', letterSpacing: 1.12 },
  paperMode: { color: '#785F38', fontSize: 8, letterSpacing: 0.96, opacity: 0.72 },
  previewRow: { paddingTop: 11, paddingHorizontal: 2, paddingBottom: 2, borderBottomWidth: 1, borderBottomColor: 'rgba(120,94,53,.2)', flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  photoPreview: { position: 'relative', width: 76, minHeight: 76, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(95,72,42,.15)', borderRadius: 14, borderTopLeftRadius: 5, borderTopRightRadius: 16, backgroundColor: '#E7E1D6', transform: [{ rotate: '-1.5deg' }] },
  photo: { width: '100%', height: 76 },
  removePhoto: { position: 'absolute', top: 4, right: 4, width: 23, height: 23, borderRadius: 12, backgroundColor: 'rgba(16,26,24,.72)', alignItems: 'center', justifyContent: 'center' },
  removePhotoText: { color: '#FFFFFF', fontSize: 14 },
  voicePreview: { minWidth: 0, flex: 1, paddingVertical: 10, paddingHorizontal: 11, borderWidth: 1, borderColor: 'rgba(49,92,79,.1)', borderRadius: 14, borderTopLeftRadius: 5, borderTopRightRadius: 15, backgroundColor: 'rgba(249,241,220,.78)', flexDirection: 'row', gap: 9, alignItems: 'center', transform: [{ rotate: '0.7deg' }] },
  voiceDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#C55F59', boxShadow: '0 0 0 5px rgba(197,95,89,.12)' },
  voiceCopy: { minWidth: 0, flex: 1 },
  voiceTitle: { color: '#315C4F', fontSize: 10, fontWeight: '700' },
  voiceDuration: { marginTop: 3, color: '#78877F', fontSize: 8 },
  previewRemove: { color: '#A95F56', fontSize: 8 },
  rightsRow: { marginTop: 9, marginHorizontal: 2, flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  checkbox: { width: 14, height: 14, marginTop: 1, borderWidth: 1, borderColor: '#315C4F', borderRadius: 2, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#315C4F' },
  checkmark: { color: '#FFFFFF', fontSize: 9 },
  rightsCopy: { flex: 1, color: '#52645C', fontSize: 8, lineHeight: 11.6 },
  messageBar: { position: 'relative', minHeight: 146, paddingTop: 9, paddingHorizontal: 1, paddingBottom: 2 },
  input: { width: '100%', minHeight: 96, maxHeight: 126, paddingTop: 10, paddingHorizontal: 5, paddingBottom: 7, color: '#182520', fontFamily: 'Georgia', fontSize: 14, lineHeight: 30, textAlignVertical: 'top' },
  composerControls: { minHeight: 38, marginTop: 9, flexDirection: 'row', gap: 7, alignItems: 'center' },
  controlButton: { width: 36, height: 36, borderWidth: 1, borderColor: 'rgba(99,78,45,.14)', borderRadius: 10, backgroundColor: 'rgba(255,250,237,.72)', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 11px rgba(91,68,32,.07)' },
  plusOpen: { backgroundColor: '#315C4F', transform: [{ rotate: '45deg' }] },
  plus: { color: '#6B765F', fontFamily: 'Georgia', fontSize: 23, lineHeight: 24 },
  controlLight: { color: '#FFF8E7' },
  attachmentHint: { flex: 1, color: 'rgba(99,85,59,.62)', fontSize: 7, letterSpacing: 0.42 },
  recordingButton: { backgroundColor: '#C55F59' },
  sendButton: { backgroundColor: '#315C4F' },
  sendDisabled: { backgroundColor: 'rgba(225,215,191,.72)' },
  sendText: { color: '#FFFAF0', fontSize: 20, fontWeight: '700' },
  sendTextDisabled: { color: '#A7A18E' },
  attachmentMenu: { position: 'absolute', bottom: 52, left: -3, zIndex: 8, width: 198, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(106,82,48,.2)', borderRadius: 16, borderTopLeftRadius: 5, borderTopRightRadius: 18, backgroundColor: '#FFF9E9', transform: [{ rotate: '0.8deg' }], boxShadow: '0 18px 40px rgba(74,54,24,.2)' },
  attachmentItem: { minHeight: 58, paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', gap: 9, alignItems: 'center' },
  attachmentDivider: { height: 1, backgroundColor: 'rgba(106,82,48,.12)' },
  attachmentSymbol: { width: 34, height: 34, borderRadius: 9, backgroundColor: '#315C4F', alignItems: 'center', justifyContent: 'center' },
  attachmentSymbolText: { color: '#F6E7BE', fontSize: 17 },
  attachmentTitle: { color: '#182520', fontSize: 11, fontWeight: '700' },
  attachmentCopy: { marginTop: 2, color: '#78877F', fontSize: 8 },
  composerMeta: { paddingTop: 9, paddingHorizontal: 3, paddingBottom: 1, borderTopWidth: 1, borderTopColor: 'rgba(120,94,53,.14)', flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  metaText: { color: '#7C7668', fontSize: 7, lineHeight: 9.8 },
  metaStatus: { maxWidth: '73%', color: '#7C7668', fontSize: 7, lineHeight: 9.8, textAlign: 'right' },
});
