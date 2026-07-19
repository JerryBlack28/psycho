import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Platform,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import {
  AppButton,
  AppScreen,
  Chip,
  MutedText,
  PageTitle,
  SectionHeading,
  Surface,
} from '@/components/ui';
import { MicIcon } from '@/components/icons';
import { VoiceModeModal } from '@/components/voice-mode-modal';
import { palette, radius, shadow, spacing, useAppTheme } from '@/constants/theme';
import { genericThemes, localReplies, storyCards, tideMeta } from '@/data/content';
import { containsCrisisLanguage, sendModelMessage } from '@/lib/model-api';
import { deriveProfileActions } from '@/lib/profile-runtime';
import { createId } from '@/lib/storage';
import { useAppState } from '@/providers/app-state';
import type { ChatMessage, StoryChoice, TideKey, TideLevels } from '@/types';

type ChapterStage = 'notes' | 'theme' | 'intro' | 'cards' | 'chat' | 'action' | 'echo' | 'complete';

const initialTides: TideLevels = {
  insight: 32,
  grounding: 32,
  connection: 32,
  vitality: 32,
};

const localActions = [
  ['提交前，只做最后一次检查', '给“已经够用”一个明确的停点'],
  ['离开屏幕两分钟，松开肩膀', '先让身体收到“可以暂停”的信号'],
  ['给信任的人发一句真实近况', '例如：“我今天有一点绷紧。”'],
];

const stageOrder: ChapterStage[] = ['notes', 'theme', 'intro', 'cards', 'chat', 'action', 'echo', 'complete'];
const useNativeAnimations = Platform.OS !== 'web';

export default function ChapterScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const appState = useAppState();
  const { collectCard } = appState;
  const [stage, setStage] = useState<ChapterStage>('notes');
  const [notes, setNotes] = useState(['', '']);
  const [noteImages, setNoteImages] = useState<string[]>([]);
  const [imageRights, setImageRights] = useState(false);
  const [notesPersonalize, setNotesPersonalize] = useState(true);
  const [selectedTheme, setSelectedTheme] = useState('');
  const [customTheme, setCustomTheme] = useState('');
  const [cardIndex, setCardIndex] = useState(0);
  const [tides, setTides] = useState<TideLevels>(initialTides);
  const [unlocked, setUnlocked] = useState<TideKey[]>([]);
  const [reward, setReward] = useState<TideKey | null>(null);
  const [lastResult, setLastResult] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [flowMessages, setFlowMessages] = useState<ChatMessage[]>([]);
  const [flowDraft, setFlowDraft] = useState('');
  const [flowDraftFromVoice, setFlowDraftFromVoice] = useState(false);
  const [flowSending, setFlowSending] = useState(false);
  const [flowCrisis, setFlowCrisis] = useState(false);
  const [flowVoiceVisible, setFlowVoiceVisible] = useState(false);
  const [echoText, setEchoText] = useState('');
  const [echoDelay, setEchoDelay] = useState(1);
  const [saveEcho, setSaveEcho] = useState(false);
  const [savedEchoText, setSavedEchoText] = useState('');
  const [cardLocked, setCardLocked] = useState(false);
  const cardPan = useRef(new Animated.ValueXY()).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const choiceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentCard = storyCards[cardIndex];
  const themeText = selectedTheme || customTheme.trim();
  const progress = Math.round(((cardIndex + 1) / storyCards.length) * 100);
  const dominantTide = useMemo(
    () => (Object.entries(tides) as Array<[TideKey, number]>).sort((a, b) => b[1] - a[1])[0][0],
    [tides],
  );
  const echoCandidates = useMemo(() => [
    tideMeta[dominantTide].quotes[0],
    selectedAction ? `记得：${selectedAction}。` : '今天先不解决全部，也可以。',
    '未来的我，希望你仍愿意听见自己的节奏。',
  ], [dominantTide, selectedAction]);
  const chapterThemes = useMemo(() => {
    if (!appState.profileEnabled || !appState.profile) return genericThemes;
    const profile = appState.profile.profile;
    const candidates = [
      ...profile.reflection_questions.map((question) => question.replace(/[？?]+$/, '')),
      ...profile.current_state.map((item) => `我想梳理：${item.title}`),
      ...profile.needs_and_preferences.map((item) => `我想梳理：${item.title}`),
      ...genericThemes,
    ].filter((item, index, all) => item && all.indexOf(item) === index);
    return candidates.slice(0, 3);
  }, [appState.profile, appState.profileEnabled]);
  const actions = useMemo(() => {
    const personalized = appState.profileEnabled ? deriveProfileActions(appState.profile) : [];
    return personalized.length ? personalized.map((item) => [item.label, item.rationale] as [string, string]) : localActions;
  }, [appState.profile, appState.profileEnabled]);

  const stepLabel: Record<ChapterStage, string> = {
    notes: '01 / 06',
    theme: '02 / 06',
    intro: '今日章节',
    cards: '03 / 06',
    chat: '04 / 06',
    action: '05 / 06',
    echo: '06 / 06',
    complete: '完成',
  };

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => stage === 'cards' && !cardLocked && Math.abs(gesture.dx) > 8,
    onPanResponderMove: (_, gesture) => cardPan.setValue({ x: gesture.dx, y: 0 }),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx < -86) {
        chooseDirection('left');
      } else if (gesture.dx > 86) {
        chooseDirection('right');
      } else {
        Animated.spring(cardPan, { toValue: { x: 0, y: 0 }, damping: 18, stiffness: 190, useNativeDriver: useNativeAnimations }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(cardPan, { toValue: { x: 0, y: 0 }, damping: 18, stiffness: 190, useNativeDriver: useNativeAnimations }).start();
    },
  }), [cardLocked, cardPan, currentCard, stage]);

  useEffect(() => {
    if (stage !== 'cards') return;
    setCardLocked(false);
    setLastResult('');
    cardPan.setValue({ x: 0, y: 22 });
    cardOpacity.setValue(0);
    cardScale.setValue(0.96);
    Animated.parallel([
      Animated.timing(cardPan, { toValue: { x: 0, y: 0 }, duration: 450, easing: Easing.bezier(0.18, 0.82, 0.24, 1), useNativeDriver: useNativeAnimations }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 450, easing: Easing.bezier(0.18, 0.82, 0.24, 1), useNativeDriver: useNativeAnimations }),
      Animated.timing(cardScale, { toValue: 1, duration: 450, easing: Easing.bezier(0.18, 0.82, 0.24, 1), useNativeDriver: useNativeAnimations }),
    ]).start();
  }, [cardIndex, cardOpacity, cardPan, cardScale, stage]);

  useEffect(() => () => {
    if (choiceTimer.current) clearTimeout(choiceTimer.current);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || stage !== 'cards') return;
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') chooseDirection('left');
      if (event.key === 'ArrowRight') chooseDirection('right');
      if (event.key === 'ArrowDown') chooseNeutral();
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [currentCard, stage]);

  function goBack() {
    const index = stageOrder.indexOf(stage);
    if (index <= 0) router.back();
    else if (stage === 'cards' && cardIndex > 0) setCardIndex((value) => value - 1);
    else setStage(stageOrder[index - 1]);
  }

  function updateNote(index: number, value: string) {
    setNotes((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)));
  }

  async function chooseNoteImages() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, 4 - noteImages.length),
      quality: 0.7,
    });
    if (!result.canceled) {
      setNoteImages((current) => [...current, ...result.assets.map((asset) => asset.uri)].slice(0, 4));
      setImageRights(false);
    }
  }

  function applyChoice(choice: StoryChoice) {
    const next = { ...tides };
    (Object.entries(choice.tides) as Array<[TideKey, number]>).forEach(([key, value]) => {
      next[key] = Math.min(100, next[key] + value);
    });
    const newReward = (Object.keys(next) as TideKey[]).find(
      (key) => next[key] >= 88 && !unlocked.includes(key),
    );
    setTides(next);
    setLastResult(choice.result);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (newReward) setUnlocked((current) => [...current, newReward]);
    return newReward;
  }

  function chooseDirection(direction: 'left' | 'right' | 'neutral') {
    if (cardLocked || !currentCard) return;
    setCardLocked(true);
    const choice = direction === 'left'
      ? currentCard.left
      : direction === 'right'
        ? currentCard.right
        : {
            label: '两个都不像',
            result: '不必勉强自己落在两个选项里，这也是一条有效线索。',
            tides: { insight: 20, grounding: 8 },
          } satisfies StoryChoice;
    const newReward = applyChoice(choice);
    void appState.refreshProfile('choices', [{
      source_id: `choice:${cardIndex + 1}`,
      source: 'card_choice',
      content: `${currentCard.prompt} / ${choice.label}：${choice.result}`,
    }]);
    const targetX = direction === 'left' ? -550 : direction === 'right' ? 550 : 0;
    const targetY = direction === 'neutral' ? 42 : 0;

    Animated.parallel([
      Animated.timing(cardPan, {
        toValue: { x: targetX, y: targetY },
        duration: 320,
        easing: Easing.bezier(0.2, 0.86, 0.2, 1),
        useNativeDriver: useNativeAnimations,
      }),
      Animated.timing(cardOpacity, { toValue: 0, duration: 280, useNativeDriver: useNativeAnimations }),
      Animated.timing(cardScale, { toValue: direction === 'neutral' ? 0.9 : 1, duration: 320, useNativeDriver: useNativeAnimations }),
    ]).start();

    if (choiceTimer.current) clearTimeout(choiceTimer.current);
    choiceTimer.current = setTimeout(() => {
      choiceTimer.current = null;
      if (newReward) setReward(newReward);
      else advanceCard();
    }, 760);
  }

  function chooseNeutral() {
    chooseDirection('neutral');
  }

  function advanceCard() {
    setCardLocked(false);
    setLastResult('');
    if (cardIndex >= storyCards.length - 1) {
      setFlowMessages([{ id: 'flow-opening', role: 'assistant', content: `关于“${themeText}”，走过这些选择之后，此刻最想先说哪一部分？` }]);
      setStage('chat');
      return;
    }
    setCardIndex((value) => value + 1);
  }

  async function sendFlowMessage(value = flowDraft) {
    const content = value.trim();
    if (!content || flowSending) return;
    const userMessage: ChatMessage = { id: createId('flow-user'), role: 'user', content };
    const evidenceSource = flowDraftFromVoice ? 'voice_transcript' : 'response';
    const next = [...flowMessages, userMessage];
    setFlowMessages(next);
    setFlowDraft('');
    setFlowDraftFromVoice(false);
    if (containsCrisisLanguage(content)) {
      setFlowCrisis(true);
      setFlowMessages((current) => [...current, { id: createId('flow-safety'), role: 'assistant', content: '先把安全放在这里。如果你或他人正处于即时危险，请立即联系所在地紧急服务，或一位能马上到场的可信任对象。' }]);
      return;
    }
    void appState.refreshProfile('chat', [{ source_id: `chat:${userMessage.id}`, source: evidenceSource, content }]);
    setFlowSending(true);
    try {
      const reply = appState.aiEnabled && appState.apiSettings.apiKey
        ? await sendModelMessage(appState.apiSettings, next)
        : localReplies[next.length % localReplies.length];
      setFlowMessages((current) => [...current, { id: createId('flow-assistant'), role: 'assistant', content: reply }]);
    } catch {
      setFlowMessages((current) => [...current, { id: createId('flow-fallback'), role: 'assistant', content: localReplies[current.length % localReplies.length] }]);
    } finally {
      setFlowSending(false);
    }
  }

  async function finishEcho() {
    const chosen = echoText.trim();
    if (saveEcho && chosen) {
      await appState.addEcho(chosen, echoDelay);
      setSavedEchoText(chosen);
    } else {
      setSavedEchoText('本次没有保存未来回响');
    }
    setStage('complete');
  }

  function selectAction(label: string) {
    setSelectedAction(label);
    void appState.refreshProfile('action', [{ source_id: 'action:selected', source: 'selected_action', content: label }]);
  }

  function restartFlow() {
    setStage('notes');
    setNotes(['', '']);
    setNoteImages([]);
    setImageRights(false);
    setSelectedTheme('');
    setCustomTheme('');
    setCardIndex(0);
    setTides(initialTides);
    setUnlocked([]);
    setLastResult('');
    setSelectedAction('');
    setFlowMessages([]);
    setFlowDraft('');
    setEchoText('');
    setEchoDelay(1);
    setSaveEcho(false);
    setSavedEchoText('');
  }

  async function closeReward(keep: boolean) {
    if (reward && keep) {
      const meta = tideMeta[reward];
      const quoteIndex = unlocked.filter((item) => item === reward).length % meta.quotes.length;
      await collectCard({
        id: `tide-${reward}-${quoteIndex}`,
        tide: reward,
        label: meta.label,
        symbol: meta.symbol,
        quote: meta.quotes[quoteIndex],
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setReward(null);
    advanceCard();
  }

  function renderNotesStage() {
    const completed = notes.filter((note) => note.trim()).length;
    return (
      <AppScreen testID="chapter-notes-screen" contentStyle={styles.flowContent}>
        <FlowHeader step="01" progress={16} onBack={goBack} />
        <View style={styles.flowHeading}>
          <Text style={styles.flowEyebrow}>序章 · 接住闪念</Text>
          <Text style={styles.flowTitle}>此刻，有哪些话{`\n`}正在脑海里经过？</Text>
          <Text style={styles.flowDescription}>不必写完整，也不需要解释。留下 2–4 张便贴就好。</Text>
        </View>
        <View style={styles.chapterNoteList}>
          {notes.map((note, index) => {
            const colors = ['#ECD9A9', '#DCB19A', '#BDC9AE', '#C4BAD1'];
            const rotations = ['-0.45deg', '0.55deg', '-0.35deg', '0.4deg'];
            return <View key={index} style={[styles.chapterNote, { backgroundColor: colors[index], transform: [{ rotate: rotations[index] }] }]}><Text style={styles.chapterNoteIndex}>0{index + 1}</Text><TextInput value={note} onChangeText={(value) => updateNote(index, value)} multiline maxLength={160} placeholder={index === 0 ? '例如：刚才又担心自己做得不够好' : '例如：其实已经很累了'} placeholderTextColor="rgba(32,49,41,.45)" style={styles.chapterNoteInput} />{notes.length > 2 ? <Pressable accessibilityLabel={`移除第 ${index + 1} 张便贴`} onPress={() => setNotes((current) => current.filter((_, itemIndex) => itemIndex !== index))} style={styles.removeChapterNote}><Text style={styles.removeChapterNoteText}>×</Text></Pressable> : null}</View>;
          })}
        </View>
        <View style={styles.noteTools}><Pressable disabled={notes.length >= 4} onPress={() => setNotes((current) => [...current, ''])} style={styles.ghostSmall}><Text style={styles.ghostSmallText}>＋ 再加一张</Text></Pressable><Pressable onPress={() => setNotes(['我总担心自己还做得不够好', '其实已经有一点累了'])}><Text style={styles.textLink}>一键使用示例</Text></Pressable></View>

        <View style={styles.noteImageUpload}>
          <View style={styles.noteImageTop}><View style={styles.noteImageCopy}><Text style={styles.noteImageTitle}>补充图片线索（可选）</Text><Text style={styles.noteImageDescription}>手写记录、截图或作品；不会根据脸、表情或外貌推断心理状态</Text></View><Pressable disabled={noteImages.length >= 4} onPress={() => void chooseNoteImages()} style={styles.imagePicker}><Text style={styles.imagePickerText}>＋ 选择图片</Text></Pressable></View>
          {noteImages.length ? <View style={styles.chapterImageList}>{noteImages.map((uri, index) => <View key={uri} style={styles.chapterImageItem}><Image source={{ uri }} style={styles.chapterImageThumb} /><Text numberOfLines={1} style={styles.chapterImageName}>图片线索 {index + 1}</Text><Pressable onPress={() => setNoteImages((current) => current.filter((_, itemIndex) => itemIndex !== index))} style={styles.chapterImageRemove}><Text style={styles.chapterImageRemoveText}>×</Text></Pressable></View>)}</View> : null}
          {noteImages.length ? <Pressable onPress={() => setImageRights((value) => !value)} style={styles.chapterRights}><View style={[styles.chapterCheckbox, imageRights ? styles.chapterCheckboxChecked : null]}><Text style={styles.chapterCheck}>{imageRights ? '✓' : ''}</Text></View><Text style={styles.chapterRightsText}>我确认有权处理这些图片，并同意在开启持续画像后将其发送给 AI 端点一次</Text></Pressable> : null}
          <Text style={styles.noteImageStatus}>可选，最多 4 张；图片不会写入本地存储</Text>
        </View>

        <Pressable onPress={() => setNotesPersonalize((value) => !value)} style={styles.privacyToggle}>
          <View style={[styles.toggleTrack, notesPersonalize ? styles.toggleTrackOn : null]}><View style={[styles.toggleKnob, notesPersonalize ? styles.toggleKnobOn : null]} /></View>
          <View style={styles.toggleText}><Text style={styles.toggleStrong}>参与本次梳理</Text><Text style={styles.toggleSmall}>关闭后不用于生成主题；离开本次体验即清除</Text></View>
        </Pressable>
        <Text style={styles.profileStatus}>{appState.profileStatus.message}</Text>
        <View style={styles.flowFooter}><Text style={styles.formHint}>{completed >= 2 ? '已经可以继续' : '写满至少两张，就可以继续'}</Text><FlowPrimaryButton label="看看这些闪念指向哪里" disabled={completed < 2} onPress={() => setStage('theme')} /></View>
      </AppScreen>
    );
  }

  function renderThemeStage() {
    return (
      <AppScreen testID="chapter-theme-screen" contentStyle={styles.flowContent}>
        <FlowHeader step="02" progress={32} onBack={goBack} />
        <View style={[styles.flowHeading, styles.compactFlowHeading]}><Text style={styles.flowEyebrow}>主题确认 · 由你决定</Text><Text style={[styles.flowTitle, styles.compactFlowTitle]}>哪条线索，最接近{`\n`}你今天想梳理的？</Text><Text style={styles.flowDescription}>这些只是临时候选，不是对你的定义。你可以纠正或自己写一句。</Text></View>
        <View style={styles.chapterThemeList}>{chapterThemes.map((item, index) => { const active = selectedTheme === item; return <Pressable key={item} onPress={() => { setSelectedTheme(item); setCustomTheme(''); }} style={[styles.chapterThemeOption, active ? styles.chapterThemeActive : null]}><Text style={[styles.chapterThemeNumber, active ? styles.chapterThemeActiveText : null]}>0{index + 1}</Text><Text style={[styles.chapterThemeText, active ? styles.chapterThemeActiveText : null]}>{item}</Text><Text style={[styles.chapterThemeMark, active ? styles.chapterThemeMarkActive : null]}>{active ? '●' : '○'}</Text></Pressable>; })}</View>
        <View style={styles.customThemeCard}><Text style={styles.customThemeLabel}>都不太像？写下你的版本</Text><TextInput value={customTheme} onChangeText={(value) => { setCustomTheme(value); setSelectedTheme(''); }} multiline maxLength={80} placeholder="例如：我想知道，为什么总是不敢停下来" placeholderTextColor="#78877F" style={styles.customThemeInput} /><Pressable disabled={!customTheme.trim()} onPress={() => setSelectedTheme('')} style={[styles.smallButton, !customTheme.trim() ? styles.smallButtonDisabled : null]}><Text style={styles.smallButtonText}>用这句话</Text></Pressable></View>
        <View style={styles.flowFooter}><Text style={styles.formHint}>{themeText ? '将由你确认这条本次线索' : '请选择或写下一条本次线索'}</Text><FlowPrimaryButton label="确认这条线索" disabled={!themeText} onPress={() => setStage('intro')} /></View>
      </AppScreen>
    );
  }

  function renderIntroStage() {
    const routeItems = [
      ['01', '情境选择', '6 张卡 · 没有标准答案', '约 2 分钟'],
      ['02', '情绪陪伴对话', '自由表达 · 随时结束', ''],
      ['03', '带走一小步', '行动与未来回响', ''],
    ];
    return (
      <LinearGradient colors={['#12211C', '#28443A', '#1A2C26']} locations={[0, 0.62, 1]} style={styles.introBackground}>
        <AppScreen testID="chapter-intro-screen" backgroundColor="transparent" contentStyle={styles.introContent}>
          <FlowHeader pill="今日章节" dark onBack={goBack} />
          <View style={styles.introHero}><Text style={styles.chapterNumber}>CHAPTER 01</Text><View style={styles.chapterGlyph}><View style={styles.chapterGlyphOuter} /><View style={styles.chapterGlyphOrbit} /><Text style={styles.chapterGlyphText}>◐</Text></View><Text style={styles.introSmall}>今天想一起看见</Text><Text style={styles.introTitle}>在反复确认之前，{`\n`}先听见自己</Text><Text style={styles.introNarrative}>这六个情境会沿着本次线索展开，没有标准答案。</Text></View>
          <Text style={styles.confirmedThemeQuote}>“{themeText}”</Text>
          <View style={styles.introTideLegend}><View style={styles.introLegendHead}><Text style={styles.introLegendTitle}>四股潮向</Text><Text style={styles.introLegendMeta}>本章资源 · 不是测评</Text></View><View style={styles.introLegendItems}>{(Object.keys(tideMeta) as TideKey[]).map((key) => <View key={key} style={styles.introLegendItem}><Text style={styles.introLegendSymbol}>{tideMeta[key].symbol}</Text><Text style={styles.introLegendName}>{tideMeta[key].label}</Text></View>)}</View><Text style={styles.introLegendCopy}>选择会改变潮位；满潮时，一张短句会来到途中。章节结束不计算总分。</Text></View>
          <View>{routeItems.map(([number, title, copy, time], index) => <View key={number} style={styles.routeItem}><Text style={[styles.routeNumber, index === 0 ? styles.routeNumberActive : null]}>{number}</Text><View style={styles.routeCopy}><Text style={styles.routeTitle}>{title}</Text><Text style={styles.routeDescription}>{copy}</Text></View>{time ? <Text style={styles.routeTime}>{time}</Text> : null}</View>)}</View>
          <View style={styles.boundaryNote}><View style={styles.boundaryIcon}><Text style={styles.boundaryIconText}>i</Text></View><Text style={styles.boundaryText}>选择只用于调整本次对话开场和建议，不判断人格或心理状况。</Text></View>
          <Text style={styles.narrativeStatus}>当前使用内置叙事。</Text>
          <View style={styles.flowFooter}><FlowPrimaryButton light label="进入第一章" onPress={() => setStage('cards')} /></View>
        </AppScreen>
      </LinearGradient>
    );
  }

  function renderChatStage() {
    return (
      <AppScreen testID="chapter-chat-screen" scroll={false}>
        <View style={styles.flowChatScreen}>
          <View style={styles.flowHeader}><Pressable accessibilityLabel="返回上一页" onPress={goBack} style={styles.flowBack}><Text style={styles.flowBackText}>←</Text></Pressable><View style={styles.flowPill}><Text style={styles.flowPillText}>情绪陪伴 · AI</Text></View><Pressable accessibilityLabel="打开实时语音转写" onPress={() => setFlowVoiceVisible(true)} style={styles.flowBack}><MicIcon color="#315C4F" size={20} /></Pressable></View>
          <View style={styles.flowChatHeading}><View style={styles.flowChatAvatar}><Text style={styles.flowChatAvatarText}>潮</Text></View><View style={styles.flowChatHeadingCopy}><Text style={styles.flowEyebrow}>第二章 · 对话</Text><Text style={styles.flowChatTitle}>和潮伴聊一会儿</Text><Text style={styles.flowChatSubtitle}>你可以纠正我、跳过问题，或随时结束。</Text></View></View>
          <ScrollView style={styles.flowChatLog} contentContainerStyle={styles.flowChatLogContent} showsVerticalScrollIndicator={false}>{flowMessages.map((message) => <View key={message.id} style={[styles.flowChatMessage, message.role === 'user' ? styles.flowChatUser : styles.flowChatBot]}><Text style={[styles.flowChatMessageText, message.role === 'user' ? styles.flowChatUserText : styles.flowChatBotText]}>{message.content}</Text></View>)}{flowSending ? <View style={[styles.flowChatMessage, styles.flowChatBot, styles.flowTyping]}><Text style={styles.flowTypingText}>•••</Text></View> : null}</ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.flowPromptScroller} contentContainerStyle={styles.flowChatPrompts}>{[['我只想说说', '我只想说说，暂时不需要建议。'], ['帮我拆小压力', '帮我把眼前的压力拆小一点。'], ['我现在有点累', '我现在有点累，不知道从哪里开始。']].map(([label, value]) => <Pressable key={label} onPress={() => void sendFlowMessage(value)} style={styles.flowPrompt}><Text style={styles.flowPromptText}>{label}</Text></Pressable>)}</ScrollView>
          {flowCrisis ? <View style={styles.flowCrisisExact}><Text style={styles.flowCrisisTitle}>先把安全放在这里</Text><Text style={styles.flowCrisisText}>如果你或他人正处于即时危险，请尽快联系所在地紧急服务、支持资源，或一位能马上来到身边的可信任对象。</Text></View> : null}
          <View style={styles.flowChatComposer}><Pressable accessibilityLabel="开始实时语音转写" onPress={() => setFlowVoiceVisible(true)} style={styles.flowVoiceInput}><MicIcon color="#315C4F" size={20} /></Pressable><TextInput value={flowDraft} onChangeText={(value) => { setFlowDraft(value); setFlowDraftFromVoice(false); }} multiline maxLength={400} placeholder="此刻最想说的是……" placeholderTextColor="#78877F" style={styles.flowChatInput} /><Pressable accessibilityLabel="发送消息" disabled={!flowDraft.trim() || flowSending} onPress={() => void sendFlowMessage()} style={[styles.flowChatSend, !flowDraft.trim() || flowSending ? styles.flowChatSendDisabled : null]}><Text style={styles.flowChatSendText}>↑</Text></Pressable></View>
          <Text style={styles.flowChatStatus}>聊天内容只在本次页面内存中使用</Text>
          <FlowPrimaryButton label="聊到这里，继续" onPress={() => setStage('action')} />
        </View>
        <VoiceModeModal visible={flowVoiceVisible} settings={appState.asrSettings} initialText={flowDraft} onTranscript={(value) => { setFlowDraft(value); setFlowDraftFromVoice(true); }} onClose={() => setFlowVoiceVisible(false)} />
      </AppScreen>
    );
  }

  function renderActionStage() {
    return (
      <AppScreen testID="chapter-action-screen" contentStyle={styles.flowContent}>
        <FlowHeader pill="第三章 · 一小步" onBack={goBack} />
        <View style={[styles.flowHeading, styles.compactFlowHeading]}><Text style={styles.flowEyebrow}>MICRO ACTION</Text><Text style={[styles.flowTitle, styles.compactFlowTitle]}>不必解决全部，{`\n`}只带走一小步。</Text><Text style={styles.flowDescription}>因为你选择梳理“{themeText}”，这里有三个低负担选项。</Text></View>
        <View style={styles.exactActionList}>{actions.map(([label, copy], index) => { const active = selectedAction === label; return <Pressable key={label} onPress={() => selectAction(label)} style={[styles.exactAction, active ? styles.exactActionActive : null]}><View style={[styles.exactActionIcon, active ? styles.exactActionIconActive : null]}><Text style={[styles.exactActionNumber, active ? styles.exactActionNumberActive : null]}>0{index + 1}</Text></View><View style={styles.exactActionCopy}><Text style={[styles.exactActionTitle, active ? styles.exactActionTextActive : null]}>{label}</Text><Text style={[styles.exactActionDescription, active ? styles.exactActionDescriptionActive : null]}>{copy}</Text></View><Text style={[styles.exactActionMark, active ? styles.exactActionMarkActive : null]}>{active ? '●' : '○'}</Text></Pressable>; })}</View>
        <View style={styles.recommendation}><Text style={styles.recommendationText}>{selectedAction ? `你选择了“${selectedAction}”。可以只做这一小步。` : '选择一个最容易做到的，不需要选择“最正确”的。'}</Text></View>
        <View style={[styles.flowFooter, styles.twoActionFooter]}><Pressable onPress={() => setStage('echo')} style={styles.skipAction}><Text style={styles.skipActionText}>今天先不做</Text></Pressable><View style={styles.actionContinue}><FlowPrimaryButton label="带走这一步" disabled={!selectedAction} onPress={() => setStage('echo')} /></View></View>
      </AppScreen>
    );
  }

  function renderEchoStage() {
    return (
      <AppScreen testID="chapter-echo-screen" contentStyle={styles.flowContent}>
        <FlowHeader pill="留给未来" onBack={goBack} />
        <View style={[styles.flowHeading, styles.compactFlowHeading]}><Text style={styles.flowEyebrow}>FUTURE ECHO</Text><Text style={[styles.flowTitle, styles.compactFlowTitle]}>想把哪句话，{`\n`}留给之后的自己？</Text><Text style={styles.flowDescription}>它不会预测或实现什么，只会在你选定的那一天，原样回到这里。</Text></View>
        <View style={styles.exactEchoCandidates}>{echoCandidates.map((candidate, index) => { const active = echoText === candidate; return <Pressable key={candidate} onPress={() => setEchoText(candidate)} style={[styles.exactEchoCandidate, active ? styles.exactEchoCandidateActive : null]}><Text style={[styles.exactEchoNumber, active ? styles.exactEchoTextActive : null]}>0{index + 1}</Text><Text style={[styles.exactEchoText, active ? styles.exactEchoTextActive : null]}>{candidate}</Text><Text style={[styles.exactEchoMark, active ? styles.exactEchoMarkActive : null]}>{active ? '●' : '＋'}</Text></Pressable>; })}</View>
        <View style={styles.customEcho}><Text style={styles.customEchoLabel}>或者，写下自己的话</Text><TextInput value={echoCandidates.includes(echoText) ? '' : echoText} onChangeText={setEchoText} multiline maxLength={120} placeholder="未来的我，我想提醒你……" placeholderTextColor="#78877F" style={styles.customEchoInput} /></View>
        <Text style={styles.delayLegend}>什么时候再看见</Text><View style={styles.delayOptions}>{[[1, '明天'], [3, '3 天后'], [7, '7 天后']].map(([days, label]) => <Pressable key={days} onPress={() => setEchoDelay(Number(days))} style={[styles.delayButton, echoDelay === Number(days) ? styles.delayButtonActive : null]}><Text style={[styles.delayText, echoDelay === Number(days) ? styles.delayTextActive : null]}>{label}</Text></Pressable>)}</View>
        <Pressable onPress={() => setSaveEcho((value) => !value)} style={styles.exactSaveConsent}><View style={[styles.saveCheckBox, saveEcho ? styles.saveCheckBoxActive : null]}><Text style={styles.saveCheckText}>{saveEcho ? '✓' : ''}</Text></View><View style={styles.saveConsentCopy}><Text style={styles.saveConsentTitle}>主动保存在这台设备</Text><Text style={styles.saveConsentDescription}>只有勾选后，这句话和解封日期才会写入本地；便贴、主题与选择不会保存。可随时删除。</Text></View></Pressable>
        <View style={styles.flowFooter}><Text style={styles.formHint}>{saveEcho ? (echoText.trim() ? '将保存这句话和解封日期' : '请选择或写下一句话') : '不勾选也可以完成，本次内容会在离开后消失'}</Text><FlowPrimaryButton label={saveEcho ? '保存并完成本次梳理' : '不保存，完成本次梳理'} disabled={saveEcho && !echoText.trim()} onPress={() => void finishEcho()} /></View>
      </AppScreen>
    );
  }

  function renderCompleteStage() {
    return (
      <LinearGradient colors={['#10201B', '#29493E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.completeBackground}>
        <AppScreen testID="chapter-complete-screen" backgroundColor="transparent" contentStyle={styles.completeContent}>
          <Pressable accessibilityLabel="返回今天" onPress={() => router.replace('/')} style={styles.completeBrand}><Text style={styles.completeBrandSymbol}>◐</Text><Text style={styles.completeBrandName}>心潮</Text></Pressable>
          <View style={styles.completionOrbit}><View style={styles.completionRing} /><View style={[styles.completionRing, styles.completionRingLeft]} /><View style={[styles.completionRing, styles.completionRingRight]} /><Text style={styles.completionSymbol}>◐</Text></View>
          <Text style={styles.completeEyebrow}>TODAY&apos;S REFLECTION</Text>
          <Text style={styles.completeTitleExact}>你没有急着得到答案，{`\n`}而是听完了一次自己。</Text>
          <View style={styles.completionCard}><Text style={styles.completionLabel}>今天看见的线索</Text><Text style={styles.completionTheme}>“{themeText}”</Text><View style={styles.completionRow}><Text style={styles.completionRowLabel}>带走的一小步</Text><Text style={styles.completionRowValue}>{selectedAction || '今天先不选择，也可以。'}</Text></View><View style={styles.completionRow}><Text style={styles.completionRowLabel}>未来回响</Text><Text style={styles.completionRowValue}>{savedEchoText}</Text></View></View>
          {unlocked.length ? <View style={styles.completionCollection}><View style={styles.collectionHeading}><View><Text style={styles.collectionEyebrow}>本章收进卡槽</Text><Text style={styles.collectionTitle}>潮笺可以在结束后继续回顾</Text></View><Pressable onPress={() => router.push('/cards')}><Text style={styles.collectionLink}>打开卡槽</Text></Pressable></View>{unlocked.map((key) => <Pressable key={key} onPress={() => router.push('/cards')} style={styles.completeTideCard}><Text style={styles.completeTideSymbol}>{tideMeta[key].symbol}</Text><View><Text style={styles.completeTideLabel}>{tideMeta[key].label}</Text><Text style={styles.completeTideQuote}>{tideMeta[key].quotes[0]}</Text></View></Pressable>)}</View> : null}
          <Text style={styles.completionNoteExact}>这是一张本次心理地图，不是对你的长期定义。明天再来时，可以从新的闪念重新开始。</Text>
          <Pressable onPress={restartFlow} style={styles.restartButton}><Text style={styles.restartText}>再走一次</Text><Text style={styles.restartText}>↻</Text></Pressable>
        </AppScreen>
      </LinearGradient>
    );
  }

  function renderGame() {
    if (!currentCard) return null;
    const rotation = cardPan.x.interpolate({
      inputRange: [-550, -216, 0, 216, 550],
      outputRange: ['-20deg', '-12deg', '0deg', '12deg', '20deg'],
      extrapolate: 'clamp',
    });
    const leftPreviewOpacity = cardPan.x.interpolate({
      inputRange: [-90, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });
    const rightPreviewOpacity = cardPan.x.interpolate({
      inputRange: [0, 90],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });
    const portraitBackgrounds = ['#31584B', '#536A49', '#764E42', '#51495E', '#31584B', '#31584B'];

    return (
      <LinearGradient
        testID="chapter-card-game"
        colors={['#101B18', '#233A32', '#E7DBC8', '#F3EEE3']}
        locations={[0, 0.535, 0.537, 1]}
        style={styles.gameScreen}>
        <View style={styles.gameHeader}>
          <Pressable accessibilityRole="button" accessibilityLabel="暂时离开章节" onPress={goBack} style={styles.darkBackButton}>
            <Text style={styles.darkBackText}>←</Text>
          </Pressable>
          <View style={styles.gameProgress}>
            <Text style={styles.gameProgressLabel}>{cardIndex + 1} / {storyCards.length}</Text>
            <View style={styles.gameProgressTrack}>
              <View style={[styles.gameProgressFill, { width: `${progress}%` }]} />
            </View>
          </View>
          <View style={styles.gameHeaderSpacer} />
        </View>

        <View style={styles.gameContext}>
          <Text style={styles.gameEyebrow}>第一章 · 看见</Text>
          <Text style={styles.gameTitle}>情境选择</Text>
          <Text style={styles.gameTheme} numberOfLines={1}>本次线索 · {themeText}</Text>
        </View>

        <View style={styles.gameTides} accessibilityLabel="本章四股潮向；满潮会遇见一张短句">
          {(Object.keys(tides) as TideKey[]).map((key) => (
            <GameTideMeter key={key} tideKey={key} value={tides[key]} />
          ))}
        </View>

        <View style={styles.scene} pointerEvents="none">
          <View style={styles.sceneHaloOuter} />
          <View style={styles.sceneHalo} />
          <View style={[styles.scenePortrait, { backgroundColor: portraitBackgrounds[cardIndex] }]}>
            <Text style={styles.scenePortraitText}>{currentCard.portrait}</Text>
          </View>
          <View style={styles.sceneLine} />
        </View>

        <View style={styles.cardZone}>
          <Animated.View style={[styles.choicePreview, styles.choicePreviewLeft, { opacity: leftPreviewOpacity }]}>
            <Text style={styles.choicePreviewLeftText}>{currentCard.left.label}</Text>
          </Animated.View>
          <Animated.View style={[styles.choicePreview, styles.choicePreviewRight, { opacity: rightPreviewOpacity }]}>
            <Text style={styles.choicePreviewRightText}>{currentCard.right.label}</Text>
          </Animated.View>
          <Animated.View
            {...panResponder.panHandlers}
            accessibilityLabel={`${currentCard.speaker}：${currentCard.prompt}`}
            style={[
              styles.gameStoryCard,
              {
                opacity: cardOpacity,
                transform: [
                  { translateX: cardPan.x },
                  { translateY: cardPan.y },
                  { rotate: rotation },
                  { scale: cardScale },
                ],
              },
            ]}>
            <View style={styles.gameCardMeta}>
              <View>
                <Text style={styles.gameSpeaker}>{currentCard.speaker}</Text>
                <Text style={styles.gameSpeakerRole}>{currentCard.role}</Text>
              </View>
              <Text style={styles.gameCardSymbol}>◌</Text>
            </View>
            <Text style={styles.gamePrompt}>{currentCard.prompt}</Text>
            <View>
              <View style={styles.gameCardDivider} />
              <Text style={styles.gameCardWhisper}>{currentCard.whisper}</Text>
            </View>
          </Animated.View>
        </View>

        <View style={styles.gameChoiceActions}>
          <Pressable
            disabled={cardLocked}
            accessibilityLabel={`${currentCard.left.label}；牵动 ${tideHint(currentCard.left)}`}
            onPress={() => chooseDirection('left')}
            style={({ pressed }) => [styles.gameChoiceButton, pressed ? styles.gamePressed : null]}>
            <Text style={styles.gameChoiceArrow}>←</Text>
            <View style={styles.gameChoiceCopyLeft}>
              <Text style={styles.gameChoiceLabel}>{currentCard.left.label}</Text>
              <Text style={styles.gameChoiceHint}>{tideHint(currentCard.left)}</Text>
            </View>
          </Pressable>
          <Pressable
            disabled={cardLocked}
            accessibilityLabel={`${currentCard.right.label}；牵动 ${tideHint(currentCard.right)}`}
            onPress={() => chooseDirection('right')}
            style={({ pressed }) => [styles.gameChoiceButton, pressed ? styles.gamePressed : null]}>
            <View style={styles.gameChoiceCopyRight}>
              <Text style={styles.gameChoiceLabel}>{currentCard.right.label}</Text>
              <Text style={styles.gameChoiceHint}>{tideHint(currentCard.right)}</Text>
            </View>
            <Text style={styles.gameChoiceArrow}>→</Text>
          </Pressable>
          <Pressable disabled={cardLocked} onPress={chooseNeutral} style={styles.gameNeutralButton}>
            <Text style={styles.gameNeutralText}>两个都不像</Text>
          </Pressable>
        </View>
        <Text style={styles.gameSwipeHelp}>滑动、点击，或使用键盘 ← → ↓</Text>
        {lastResult ? <View style={styles.gameResultToast}><Text style={styles.gameResultText}>{lastResult}</Text></View> : null}
      </LinearGradient>
    );
  }

  const initialStageScreen = stage === 'notes'
    ? renderNotesStage()
    : stage === 'theme'
      ? renderThemeStage()
      : stage === 'intro'
        ? renderIntroStage()
        : null;
  if (initialStageScreen) return initialStageScreen;
  if (stage === 'cards' && currentCard) return renderGame();
  const closingStageScreen = stage === 'chat'
    ? renderChatStage()
    : stage === 'action'
      ? renderActionStage()
      : stage === 'echo'
        ? renderEchoStage()
        : stage === 'complete'
          ? renderCompleteStage()
          : null;
  if (closingStageScreen) return closingStageScreen;

  return (
    <AppScreen testID="chapter-screen">
      <View style={styles.header}>
        <AppButton label="← 返回" variant="ghost" onPress={goBack} style={styles.back} />
        <Text style={[styles.stageLabel, { color: theme.secondaryText }]}>今日章节 · {stepLabel[stage]}</Text>
      </View>

      {stage === 'notes' ? (
        <>
          <PageTitle
            eyebrow="序章 · 接住闪念"
            title={'此刻，有哪些话\n正在脑海里经过？'}
            description="不必写完整，也不需要解释。先留下两张便贴就好；离开本次章节后会清除。"
          />
          {notes.map((note, index) => (
            <Surface key={index} elevated style={styles.noteSurface}>
              <Text style={[styles.noteIndex, { color: theme.accent }]}>0{index + 1}</Text>
              <TextInput
                value={note}
                onChangeText={(value) => updateNote(index, value)}
                multiline
                maxLength={160}
                placeholder={index === 0 ? '例如：刚才又担心自己做得不够好' : '例如：其实已经很累了'}
                placeholderTextColor={theme.secondaryText}
                style={[styles.noteInput, { color: theme.text }]}
              />
            </Surface>
          ))}
          {notes.length < 4 ? (
            <AppButton label="＋ 再加一张" variant="secondary" onPress={() => setNotes((current) => [...current, ''])} />
          ) : null}
          <Surface style={styles.noteImagesCard}>
            <View style={styles.noteImagesHead}><View style={styles.noteImagesCopy}><Text style={[styles.actionTitle, { color: theme.text }]}>补充图片线索（可选）</Text><MutedText>手写记录、截图或作品；不会根据脸、表情或外貌推断心理状态</MutedText></View><AppButton label="＋ 选择图片" variant="secondary" disabled={noteImages.length >= 4} onPress={() => void chooseNoteImages()} style={styles.imagePickerButton} /></View>
            {noteImages.length ? <View style={styles.imageGrid}>{noteImages.map((uri, index) => <View key={uri} style={styles.imagePreview}><Image source={{ uri }} style={styles.image} /><Pressable onPress={() => setNoteImages((current) => current.filter((_, itemIndex) => itemIndex !== index))} style={styles.imageRemove}><Text style={styles.imageRemoveText}>×</Text></Pressable></View>)}</View> : null}
            {noteImages.length ? <View style={styles.saveConsent}><Switch value={imageRights} onValueChange={setImageRights} trackColor={{ true: theme.accent }} /><MutedText style={styles.saveCopy}>我确认有权处理这些图片，并同意在开启持续画像后将其发送给自定义 AI 端点一次</MutedText></View> : null}
            <MutedText>可选，最多 4 张；图片不会写入本地存储</MutedText>
          </Surface>
          <AppButton
            label="看看这些闪念指向哪里"
            disabled={notes.filter((note) => note.trim()).length < 2}
            onPress={() => setStage('theme')}
          />
        </>
      ) : null}

      {stage === 'theme' ? (
        <>
          <PageTitle
            eyebrow="主题确认 · 由你决定"
            title={'哪条线索，最接近\n你今天想梳理的？'}
            description="这些只是临时候选，不是对你的定义。你可以纠正，或自己写一句。"
          />
          <View style={styles.themeList}>
            {chapterThemes.map((item, index) => (
              <Pressable
                key={item}
                onPress={() => { setSelectedTheme(item); setCustomTheme(''); }}
                style={({ pressed }) => [
                  styles.themeOption,
                  {
                    backgroundColor: selectedTheme === item ? theme.softAccent : theme.surface,
                    borderColor: selectedTheme === item ? theme.accent : theme.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}>
                <Text style={[styles.themeNumber, { color: theme.accent }]}>0{index + 1}</Text>
                <Text style={[styles.themeText, { color: theme.text }]}>{item}</Text>
                <Text style={[styles.themeCheck, { color: theme.accent }]}>{selectedTheme === item ? '●' : '○'}</Text>
              </Pressable>
            ))}
          </View>
          <Surface style={styles.customTheme}>
            <MutedText>都不太像？写下你的版本</MutedText>
            <TextInput
              value={customTheme}
              onChangeText={(value) => { setCustomTheme(value); setSelectedTheme(''); }}
              multiline
              maxLength={80}
              placeholder="我想知道，为什么……"
              placeholderTextColor={theme.secondaryText}
              style={[styles.customInput, { color: theme.text, borderColor: theme.border }]}
            />
          </Surface>
          <AppButton label="确认这条线索" disabled={!themeText} onPress={() => setStage('intro')} />
        </>
      ) : null}

      {stage === 'intro' ? (
        <>
          <PageTitle eyebrow="CHAPTER 01" title={'在反复确认之前，\n先听见自己。'} />
          <Surface elevated style={styles.confirmedTheme}>
            <MutedText>今天想一起看见</MutedText>
            <Text style={[styles.confirmedThemeText, { color: theme.text }]}>“{themeText}”</Text>
          </Surface>
          <SectionHeading caption="FOUR TIDES" title="本章四股潮向" />
          <View style={styles.tideLegend}>
            {(Object.keys(tideMeta) as TideKey[]).map((key) => (
              <Surface key={key} style={styles.legendItem}>
                <Text style={[styles.legendSymbol, { color: theme.accent }]}>{tideMeta[key].symbol}</Text>
                <Text style={[styles.legendLabel, { color: theme.text }]}>{tideMeta[key].label}</Text>
                <MutedText>{tideMeta[key].description}</MutedText>
              </Surface>
            ))}
          </View>
          <MutedText>选择会改变本章潮位；满潮时会遇见一张短句。章节结束不计算总分。</MutedText>
          <AppButton label="进入第一章" onPress={() => setStage('cards')} />
        </>
      ) : null}

      {stage === 'cards' && currentCard ? (
        <>
          <View style={styles.cardProgressRow}>
            <Text style={[styles.cardProgressText, { color: theme.text }]}>{cardIndex + 1} / {storyCards.length}</Text>
            <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
              <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: theme.accent }]} />
            </View>
          </View>
          <Text style={[styles.thread, { color: theme.secondaryText }]} numberOfLines={2}>{themeText}</Text>
          <View style={styles.tides}>
            {(Object.keys(tides) as TideKey[]).map((key) => (
              <TideMeter key={key} tideKey={key} value={tides[key]} />
            ))}
          </View>

          <Animated.View
            {...panResponder.panHandlers}
            style={{ transform: [{ translateX: cardPan.x }, { translateY: cardPan.y }, { rotate: cardPan.x.interpolate({ inputRange: [-300, 0, 300], outputRange: ['-8deg', '0deg', '8deg'] }) }] }}>
            <Surface elevated style={styles.storyCard}>
              <View style={styles.speakerRow}>
                <View style={[styles.portrait, { backgroundColor: theme.softAccent }]}> 
                  <Text style={[styles.portraitText, { color: theme.accent }]}>{currentCard.portrait}</Text>
                </View>
                <View style={styles.speakerCopy}>
                  <Text style={[styles.speaker, { color: theme.text }]}>{currentCard.speaker}</Text>
                  <MutedText>{currentCard.role}</MutedText>
                </View>
              </View>
              <Text style={[styles.prompt, { color: theme.text }]}>{currentCard.prompt}</Text>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <MutedText style={styles.whisper}>{currentCard.whisper}</MutedText>
            </Surface>
          </Animated.View>

          {lastResult ? <Text style={[styles.result, { color: theme.accent }]}>{lastResult}</Text> : null}
          <View style={styles.choiceRow}>
            <AppButton label={`← ${currentCard.left.label}`} variant="secondary" onPress={() => applyChoice(currentCard.left)} style={styles.choice} />
            <AppButton label={`${currentCard.right.label} →`} onPress={() => applyChoice(currentCard.right)} style={styles.choice} />
          </View>
          <AppButton label="两个都不像" variant="ghost" onPress={chooseNeutral} />
          <MutedText style={styles.result}>滑动、点击，或使用键盘 ← → ↓</MutedText>
        </>
      ) : null}

      {stage === 'chat' ? (
        <>
          <View style={styles.chatHeading}>
            <View style={[styles.chatAvatar, { backgroundColor: theme.accent }]}><Text style={styles.chatAvatarText}>潮</Text></View>
            <View style={styles.chatHeadingCopy}><Text style={[styles.rewardEyebrow, { color: theme.accent }]}>第二章 · 对话</Text><Text style={[styles.chatTitle, { color: theme.text }]}>和潮伴聊一会儿</Text><MutedText>你可以纠正我、跳过问题，或随时结束。</MutedText></View>
          </View>
          <View style={styles.chatLog}>
            {flowMessages.map((message) => <View key={message.id} style={[styles.chatMessage, message.role === 'user' ? styles.chatUser : styles.chatAssistant, { backgroundColor: message.role === 'user' ? theme.accent : theme.elevated, borderColor: theme.border }]}><Text style={[styles.chatMessageText, { color: message.role === 'user' ? palette.white : theme.text }]}>{message.content}</Text></View>)}
          </View>
          <View style={styles.chatPrompts}>
            {[['我只想说说', '我只想说说，暂时不需要建议。'], ['帮我拆小压力', '帮我把眼前的压力拆小一点。'], ['我现在有点累', '我现在有点累，不知道从哪里开始。']].map(([label, value]) => <Pressable key={label} onPress={() => void sendFlowMessage(value)}><Chip label={label} /></Pressable>)}
          </View>
          {flowCrisis ? <Surface style={styles.flowCrisis}><Text style={[styles.crisisTitle, { color: theme.text }]}>先把安全放在这里</Text><MutedText>如果你或他人正处于即时危险，请尽快联系所在地紧急服务，或一位能马上到场的可信任对象。</MutedText></Surface> : null}
          <View style={[styles.chatComposer, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
            <Text style={[styles.composerMic, { color: theme.text }]}>⌁</Text>
            <TextInput value={flowDraft} onChangeText={setFlowDraft} multiline maxLength={400} placeholder="此刻最想说的是……" placeholderTextColor={theme.secondaryText} style={[styles.chatInput, { color: theme.text }]} />
            <Pressable accessibilityLabel="发送消息" disabled={!flowDraft.trim() || flowSending} onPress={() => void sendFlowMessage()} style={[styles.chatSend, { backgroundColor: flowDraft.trim() ? theme.accent : theme.border }]}><Text style={styles.chatSendText}>↑</Text></Pressable>
          </View>
          <MutedText style={styles.result}>聊天内容只在本次页面内存中使用</MutedText>
          <AppButton label="聊到这里，继续  →" onPress={() => setStage('action')} />
        </>
      ) : null}

      {stage === 'action' ? (
        <>
          <PageTitle
            eyebrow="MICRO ACTION"
            title={'不必解决全部，\n只带走一小步。'}
            description={`因为你选择梳理“${themeText}”，这里有三个低负担选项。`}
          />
          {actions.map(([label, copy]) => (
            <Pressable
              key={label}
              onPress={() => selectAction(label)}
              style={({ pressed }) => [
                styles.actionOption,
                {
                  backgroundColor: selectedAction === label ? theme.softAccent : theme.surface,
                  borderColor: selectedAction === label ? theme.accent : theme.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}>
              <Text style={[styles.actionCheck, { color: theme.accent }]}>{selectedAction === label ? '●' : '○'}</Text>
              <View style={styles.actionCopy}>
                <Text style={[styles.actionTitle, { color: theme.text }]}>{label}</Text>
                <MutedText>{copy}</MutedText>
              </View>
            </Pressable>
          ))}
          <MutedText>选择一个最容易做到的，不需要选择“最正确”的。</MutedText>
          <AppButton label="带走这一步  →" disabled={!selectedAction} onPress={() => setStage('echo')} />
          <AppButton label="今天先不做" variant="ghost" onPress={() => setStage('echo')} />
        </>
      ) : null}

      {stage === 'echo' ? (
        <>
          <PageTitle eyebrow="FUTURE ECHO" title={'想把哪句话，\n留给之后的自己？'} description="它不会预测或实现什么，只会在你选定的那一天，原样回到这里。" />
          <View style={styles.themeList}>
            {echoCandidates.map((candidate, index) => <Pressable key={candidate} onPress={() => setEchoText(candidate)} style={[styles.themeOption, { backgroundColor: echoText === candidate ? theme.softAccent : theme.surface, borderColor: echoText === candidate ? theme.accent : theme.border }]}><Text style={[styles.themeNumber, { color: theme.accent }]}>0{index + 1}</Text><Text style={[styles.themeText, { color: theme.text }]}>{candidate}</Text><Text style={[styles.themeCheck, { color: theme.accent }]}>{echoText === candidate ? '●' : '＋'}</Text></Pressable>)}
          </View>
          <Surface style={styles.customTheme}><MutedText>或者，写下自己的话</MutedText><TextInput value={echoCandidates.includes(echoText) ? '' : echoText} onChangeText={setEchoText} multiline maxLength={120} placeholder="未来的我，我想提醒你……" placeholderTextColor={theme.secondaryText} style={[styles.customInput, { color: theme.text, borderColor: theme.border }]} /></Surface>
          <MutedText>什么时候再看见</MutedText>
          <View style={styles.chatPrompts}>{[[1, '明天'], [3, '3 天后'], [7, '7 天后']].map(([days, label]) => <Pressable key={days} onPress={() => setEchoDelay(Number(days))}><Chip label={String(label)} selected={echoDelay === Number(days)} /></Pressable>)}</View>
          <Surface style={styles.saveConsent}><Switch value={saveEcho} onValueChange={setSaveEcho} trackColor={{ true: theme.accent }} /><View style={styles.saveCopy}><Text style={[styles.actionTitle, { color: theme.text }]}>主动保存在这台设备</Text><MutedText>只有勾选后，这句话和解封日期才会写入本地；便贴、主题与选择不会保存。可随时删除。</MutedText></View></Surface>
          <MutedText>{saveEcho ? (echoText.trim() ? '将保存这句话和解封日期' : '请选择或写下一句话') : '不勾选也可以完成，本次内容会在离开后消失'}</MutedText>
          <AppButton label={saveEcho ? '保存并完成本次梳理  →' : '不保存，完成本次梳理  →'} disabled={saveEcho && !echoText.trim()} onPress={() => void finishEcho()} />
        </>
      ) : null}

      {stage === 'complete' ? (
        <>
          <View style={styles.completeHero}>
            <Text style={[styles.completeSymbol, { color: theme.accent }]}>◐</Text>
            <PageTitle eyebrow="TODAY'S REFLECTION" title={'你没有急着得到答案，\n而是听完了一次自己。'} />
          </View>
          <Surface elevated style={styles.summaryCard}>
            <MutedText>今天梳理的线索</MutedText>
            <Text style={[styles.summaryText, { color: theme.text }]}>“{themeText}”</Text>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <MutedText>愿意带走的一小步</MutedText>
            <Text style={[styles.summaryText, { color: theme.text }]}>{selectedAction || '今天先不选择，也可以。'}</Text>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <MutedText>未来回响</MutedText>
            <Text style={[styles.summaryText, { color: theme.text }]}>{savedEchoText}</Text>
          </Surface>
          {unlocked.length ? <Surface style={styles.summaryCard}><Text style={[styles.actionTitle, { color: theme.text }]}>本章遇见 {unlocked.length} 张满潮潮笺</Text><MutedText>主动收下的潮笺可以在卡槽继续回顾。</MutedText><AppButton label="打开卡槽" variant="secondary" onPress={() => router.push('/cards')} /></Surface> : null}
          <MutedText>这是一张本次心理地图，不是对你的长期定义。明天再来时，可以从新的闪念重新开始。</MutedText>
          <AppButton label="再走一次  ↻" onPress={restartFlow} />
          <AppButton label="回到今天" variant="secondary" onPress={() => router.replace('/')} />
        </>
      ) : null}

      <Modal visible={Boolean(reward)} transparent animationType="fade" onRequestClose={() => void closeReward(false)}>
        <View style={styles.modalBackdrop}>
          {reward ? (
            <View style={[styles.rewardCard, { backgroundColor: theme.elevated, borderColor: theme.border }, shadow]}>
              <Text style={[styles.rewardSymbol, { color: theme.accent }]}>{tideMeta[reward].symbol}</Text>
              <Text style={[styles.rewardEyebrow, { color: theme.accent }]}>{tideMeta[reward].label} · 已经来到潮面</Text>
              <Text style={[styles.rewardQuote, { color: theme.text }]}>“{tideMeta[reward].quotes[0]}”</Text>
              <MutedText>{tideMeta[reward].description}</MutedText>
              <View style={styles.rewardActions}>
                <AppButton label="让它经过" variant="ghost" onPress={() => void closeReward(false)} style={styles.rewardButton} />
                <AppButton label="收进卡槽" onPress={() => void closeReward(true)} style={styles.rewardButton} />
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </AppScreen>
  );
}

function FlowHeader({ step, progress = 0, pill, dark = false, onBack }: { step?: string; progress?: number; pill?: string; dark?: boolean; onBack: () => void }) {
  return <View style={styles.flowHeader}><Pressable accessibilityLabel="返回上一页" onPress={onBack} style={[styles.flowBack, dark ? styles.flowBackDark : null]}><Text style={[styles.flowBackText, dark ? styles.flowBackTextDark : null]}>←</Text></Pressable>{step ? <View style={styles.stepIndicator}><Text style={styles.stepCurrent}>{step}</Text><View style={styles.stepTrack}><View style={[styles.stepFill, { width: `${progress}%` }]} /></View><Text style={styles.stepTotal}>06</Text></View> : <View style={[styles.flowPill, dark ? styles.flowPillDark : null]}><Text style={[styles.flowPillText, dark ? styles.flowPillTextDark : null]}>{pill}</Text></View>}<View style={styles.flowHeaderSpacer} /></View>;
}

function FlowPrimaryButton({ label, disabled, light = false, onPress }: { label: string; disabled?: boolean; light?: boolean; onPress: () => void }) {
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.flowPrimary, light ? styles.flowPrimaryLight : null, disabled ? styles.flowPrimaryDisabled : null]}><Text style={[styles.flowPrimaryText, light ? styles.flowPrimaryTextDark : null]}>{label}</Text><Text style={[styles.flowPrimaryText, light ? styles.flowPrimaryTextDark : null]}>→</Text></Pressable>;
}

function tideHint(choice: StoryChoice) {
  return (Object.entries(choice.tides) as Array<[TideKey, number]>)
    .map(([key, value]) => `${tideMeta[key].label} +${value}`)
    .join(' · ');
}

function GameTideMeter({ tideKey, value }: { tideKey: TideKey; value: number }) {
  const meta = tideMeta[tideKey];
  const colors: Record<TideKey, string> = {
    insight: '#D8BB78',
    grounding: '#91B39F',
    connection: '#D79A83',
    vitality: '#B6A8CF',
  };
  return (
    <View style={styles.gameTideMeter} accessibilityLabel={`${meta.label} ${Math.min(100, value)}`}>
      <View style={styles.gameTideLabel}>
        <Text style={[styles.gameTideSymbol, { color: colors[tideKey] }]}>{meta.symbol}</Text>
        <Text style={styles.gameTideName}>{meta.label}</Text>
      </View>
      <View style={styles.gameTideTrack}>
        <View style={[styles.gameTideFill, { width: `${Math.min(100, value)}%`, backgroundColor: colors[tideKey] }]} />
      </View>
    </View>
  );
}

function TideMeter({ tideKey, value }: { tideKey: TideKey; value: number }) {
  const theme = useAppTheme();
  const meta = tideMeta[tideKey];
  return (
    <View style={styles.tideMeter}>
      <View style={styles.tideLabelRow}>
        <Text style={[styles.tideLabel, { color: theme.text }]}>{meta.symbol} {meta.label}</Text>
        <Text style={[styles.tideValue, { color: theme.secondaryText }]}>{Math.min(100, value)}</Text>
      </View>
      <View style={[styles.tideTrack, { backgroundColor: theme.border }]}>
        <View style={[styles.tideFill, { width: `${Math.min(100, value)}%`, backgroundColor: theme.accent }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gameScreen: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    paddingTop: 48,
    paddingHorizontal: 24,
    paddingBottom: 22,
  },
  gameHeader: {
    zIndex: 20,
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  darkBackButton: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.25)',
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkBackText: { color: '#F7F0E4', fontSize: 18 },
  gameHeaderSpacer: { width: 38, height: 38 },
  gameProgress: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  gameProgressLabel: { color: '#B6C6BF', fontSize: 10, fontWeight: '700' },
  gameProgressTrack: { width: 56, height: 2, borderRadius: 99, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,.15)' },
  gameProgressFill: { height: '100%', backgroundColor: '#D8BB78' },
  gameContext: { marginTop: 12, alignItems: 'center' },
  gameEyebrow: { color: '#D2BD87', fontSize: 10, fontWeight: '800', letterSpacing: 1.7 },
  gameTitle: { marginVertical: 4, color: '#F5EEE1', fontFamily: 'Georgia', fontSize: 21, fontWeight: '500' },
  gameTheme: { maxWidth: 270, color: '#96AAA0', fontSize: 10 },
  gameTides: {
    zIndex: 8,
    flexDirection: 'row',
    gap: 7,
    marginTop: 10,
    marginHorizontal: 2,
    paddingVertical: 8,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.09)',
    borderRadius: 15,
    backgroundColor: 'rgba(8,18,15,.24)',
  },
  gameTideMeter: { minWidth: 0, flex: 1 },
  gameTideLabel: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  gameTideSymbol: { fontFamily: 'Georgia', fontSize: 11 },
  gameTideName: { color: '#B7C6BF', fontSize: 8, fontWeight: '700' },
  gameTideTrack: { height: 3, marginTop: 5, overflow: 'hidden', borderRadius: 99, backgroundColor: 'rgba(255,255,255,.12)' },
  gameTideFill: { height: '100%', borderRadius: 99 },
  scene: { position: 'absolute', top: 183, left: 0, right: 0, height: 193, overflow: 'hidden' },
  sceneHaloOuter: { position: 'absolute', top: -27, left: '50%', marginLeft: -126, width: 252, height: 252, borderWidth: 1, borderColor: 'rgba(255,255,255,.012)', borderRadius: 126 },
  sceneHalo: { position: 'absolute', top: 20, left: '50%', marginLeft: -79, width: 158, height: 158, borderWidth: 1, borderColor: 'rgba(216,187,120,.25)', borderRadius: 79 },
  scenePortrait: { position: 'absolute', bottom: 16, left: '50%', marginLeft: -53, width: 106, height: 138, borderWidth: 1, borderColor: 'rgba(255,255,255,.14)', borderRadius: 54, borderBottomLeftRadius: 17, borderBottomRightRadius: 17, alignItems: 'center', justifyContent: 'center', boxShadow: '0 18px 40px rgba(0,0,0,.22)' },
  scenePortraitText: { color: '#EAD098', fontFamily: 'Georgia', fontSize: 34 },
  sceneLine: { position: 'absolute', right: 0, bottom: 0, left: 0, height: 15, backgroundColor: 'rgba(0,0,0,.14)' },
  cardZone: { position: 'absolute', top: 332, left: 24, right: 24, height: 284 },
  gameStoryCard: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 4, paddingTop: 22, paddingHorizontal: 21, paddingBottom: 18, borderWidth: 1, borderColor: 'rgba(49,92,79,.12)', borderRadius: 25, backgroundColor: '#FFFDF8', boxShadow: '0 15px 36px rgba(24,43,36,.2)', justifyContent: 'space-between' },
  gameCardMeta: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  gameSpeaker: { color: '#315C4F', fontSize: 12, fontWeight: '800' },
  gameSpeakerRole: { marginTop: 3, color: '#89958F', fontSize: 9 },
  gameCardSymbol: { color: '#B4A06E', fontFamily: 'Georgia', fontSize: 20 },
  gamePrompt: { color: '#182520', fontFamily: 'Georgia', fontSize: 20, lineHeight: 31.6, textAlign: 'center' },
  gameCardDivider: { width: 31, height: 1, marginHorizontal: 'auto', marginBottom: 11, backgroundColor: '#C8B88D' },
  gameCardWhisper: { color: '#75847C', fontSize: 10, lineHeight: 15, textAlign: 'center' },
  choicePreview: { position: 'absolute', top: 24, zIndex: 7, paddingVertical: 7, paddingHorizontal: 10, borderWidth: 1, borderRadius: 8 },
  choicePreviewLeft: { left: 15, borderColor: '#A25E59', transform: [{ rotate: '-8deg' }] },
  choicePreviewRight: { right: 15, borderColor: '#477665', transform: [{ rotate: '8deg' }] },
  choicePreviewLeftText: { color: '#A25E59', fontSize: 10, fontWeight: '800' },
  choicePreviewRightText: { color: '#477665', fontSize: 10, fontWeight: '800' },
  gameChoiceActions: { position: 'absolute', right: 24, bottom: 47, left: 24, flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  gameChoiceButton: { width: '48%', minHeight: 53, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7, paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(49,92,79,.17)', borderRadius: 14, backgroundColor: 'rgba(255,253,248,.82)' },
  gameChoiceArrow: { color: '#315C4F', fontSize: 13 },
  gameChoiceCopyLeft: { minWidth: 0, flex: 1, alignItems: 'flex-start' },
  gameChoiceCopyRight: { minWidth: 0, flex: 1, alignItems: 'flex-end' },
  gameChoiceLabel: { color: '#52645C', fontSize: 10, lineHeight: 13, fontWeight: '700' },
  gameChoiceHint: { marginTop: 3, color: '#89978F', fontSize: 7, lineHeight: 9, fontWeight: '700' },
  gameNeutralButton: { width: '100%', minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  gameNeutralText: { color: '#718078', fontSize: 11, fontWeight: '700' },
  gameSwipeHelp: { position: 'absolute', right: 0, bottom: 25, left: 0, color: '#78857E', fontSize: 9, textAlign: 'center' },
  gameResultToast: { position: 'absolute', bottom: 116, left: 24, right: 24, zIndex: 30, alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: 'rgba(16,26,24,.94)', boxShadow: '0 10px 24px rgba(0,0,0,.18)' },
  gameResultText: { color: '#FFF9EE', fontSize: 11, lineHeight: 16, textAlign: 'center' },
  gamePressed: { opacity: 0.72 },
  flowContent: { maxWidth: undefined, paddingTop: 48, paddingHorizontal: 24, paddingBottom: 34, gap: 0 },
  flowHeader: { zIndex: 5, minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flowBack: { width: 38, height: 38, borderWidth: 1, borderColor: 'rgba(24,37,32,.18)', borderRadius: 19, backgroundColor: 'rgba(255,255,255,.42)', alignItems: 'center', justifyContent: 'center' },
  flowBackDark: { borderColor: 'rgba(255,255,255,.22)', backgroundColor: 'rgba(255,255,255,.05)' },
  flowBackText: { color: '#182520', fontSize: 18 },
  flowBackTextDark: { color: '#F7F0E4' },
  flowHeaderSpacer: { width: 38, height: 38 },
  stepIndicator: { flexDirection: 'row', gap: 7, alignItems: 'center' },
  stepCurrent: { color: '#315C4F', fontSize: 10, fontWeight: '800' },
  stepTrack: { width: 58, height: 2, overflow: 'hidden', borderRadius: 99, backgroundColor: 'rgba(49,92,79,.16)' },
  stepFill: { height: '100%', backgroundColor: '#315C4F' },
  stepTotal: { color: '#9AA59F', fontSize: 10 },
  flowPill: { paddingVertical: 7, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(49,92,79,.22)', borderRadius: 99 },
  flowPillDark: { borderColor: 'rgba(219,197,143,.25)' },
  flowPillText: { color: '#315C4F', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  flowPillTextDark: { color: '#DBC58F' },
  flowHeading: { marginTop: 28 },
  compactFlowHeading: { marginTop: 22 },
  flowEyebrow: { color: '#315C4F', fontSize: 10, fontWeight: '800', letterSpacing: 1.7 },
  flowTitle: { marginTop: 9, marginBottom: 12, color: '#182520', fontFamily: 'Georgia', fontSize: 31, fontWeight: '500', lineHeight: 41.85 },
  compactFlowTitle: { fontSize: 28, lineHeight: 37.8 },
  flowDescription: { color: '#52645C', fontSize: 14, lineHeight: 23.8 },
  chapterNoteList: { gap: 12, marginTop: 22 },
  chapterNote: { position: 'relative', minHeight: 112, paddingTop: 16, paddingRight: 40, paddingBottom: 14, paddingLeft: 16, borderRadius: 18, borderTopLeftRadius: 4, boxShadow: '0 10px 20px rgba(55,43,25,.08)' },
  chapterNoteIndex: { marginBottom: 7, color: 'rgba(24,37,32,.55)', fontSize: 9, fontWeight: '800', letterSpacing: 1.26 },
  chapterNoteInput: { minHeight: 58, color: '#203129', fontFamily: 'Georgia', fontSize: 16, lineHeight: 24.8, textAlignVertical: 'top' },
  removeChapterNote: { position: 'absolute', top: 9, right: 9, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,.34)', alignItems: 'center', justifyContent: 'center' },
  removeChapterNoteText: { color: 'rgba(24,37,32,.65)', fontSize: 18 },
  noteTools: { marginTop: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ghostSmall: { minHeight: 44, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(24,37,32,.13)', borderRadius: 16, backgroundColor: 'rgba(255,255,255,.45)', alignItems: 'center', justifyContent: 'center' },
  ghostSmallText: { color: '#315C4F', fontSize: 13, fontWeight: '700' },
  textLink: { color: '#315C4F', fontSize: 12, fontWeight: '700' },
  noteImageUpload: { marginTop: 14, padding: 13, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(49,92,79,.24)', borderRadius: 17, backgroundColor: 'rgba(255,255,255,.34)' },
  noteImageTop: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  noteImageCopy: { flex: 1 },
  noteImageTitle: { color: '#182520', fontSize: 12, fontWeight: '700' },
  noteImageDescription: { marginTop: 3, color: '#78877F', fontSize: 9, lineHeight: 13.05 },
  imagePicker: { paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(24,37,32,.13)', borderRadius: 12, backgroundColor: '#FFFDF8' },
  imagePickerText: { color: '#315C4F', fontSize: 10, fontWeight: '700' },
  chapterImageList: { gap: 6, paddingTop: 9 },
  chapterImageItem: { minHeight: 42, paddingVertical: 7, paddingHorizontal: 9, borderRadius: 11, backgroundColor: 'rgba(49,92,79,.07)', flexDirection: 'row', alignItems: 'center', gap: 8 },
  chapterImageThumb: { width: 28, height: 28, borderRadius: 6 },
  chapterImageName: { minWidth: 0, flex: 1, color: '#182520', fontSize: 10, fontWeight: '700' },
  chapterImageRemove: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,.7)', alignItems: 'center', justifyContent: 'center' },
  chapterImageRemoveText: { color: '#78877F', fontSize: 15 },
  chapterRights: { marginTop: 9, flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  chapterCheckbox: { width: 14, height: 14, marginTop: 1, borderWidth: 1, borderColor: '#315C4F', borderRadius: 2, alignItems: 'center', justifyContent: 'center' },
  chapterCheckboxChecked: { backgroundColor: '#315C4F' },
  chapterCheck: { color: '#FFFFFF', fontSize: 9 },
  chapterRightsText: { flex: 1, color: '#52645C', fontSize: 9, lineHeight: 13.05 },
  noteImageStatus: { marginTop: 8, color: '#78877F', fontSize: 9, lineHeight: 12.6 },
  privacyToggle: { marginTop: 18, padding: 13, borderWidth: 1, borderColor: 'rgba(24,37,32,.13)', borderRadius: 17, backgroundColor: 'rgba(255,255,255,.44)', flexDirection: 'row', gap: 12, alignItems: 'center' },
  toggleTrack: { width: 42, height: 25, borderRadius: 99, backgroundColor: '#B7BDB7', padding: 3 },
  toggleTrackOn: { backgroundColor: '#315C4F' },
  toggleKnob: { width: 19, height: 19, borderRadius: 10, backgroundColor: '#FFFFFF' },
  toggleKnobOn: { transform: [{ translateX: 17 }] },
  toggleText: { flex: 1 },
  toggleStrong: { color: '#182520', fontSize: 12, fontWeight: '700' },
  toggleSmall: { marginTop: 2, color: '#78877F', fontSize: 10, lineHeight: 14 },
  profileStatus: { marginTop: 8, color: '#78877F', fontSize: 9, lineHeight: 12.6 },
  flowFooter: { marginTop: 22, paddingTop: 22, paddingBottom: 6 },
  formHint: { minHeight: 17, marginBottom: 8, color: '#78877F', fontSize: 11, textAlign: 'center' },
  flowPrimary: { width: '100%', minHeight: 56, paddingHorizontal: 21, borderRadius: 16, backgroundColor: '#315C4F', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 12px 28px rgba(49,92,79,.22)' },
  flowPrimaryLight: { backgroundColor: '#EFE2C6' },
  flowPrimaryDisabled: { opacity: 0.38, boxShadow: 'none' },
  flowPrimaryText: { color: '#FFFAF0', fontSize: 13, fontWeight: '700' },
  flowPrimaryTextDark: { color: '#182520' },
  chapterThemeList: { gap: 10, marginTop: 21 },
  chapterThemeOption: { minHeight: 76, paddingVertical: 13, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(24,37,32,.13)', borderRadius: 19, backgroundColor: 'rgba(255,255,255,.56)', flexDirection: 'row', gap: 10, alignItems: 'center' },
  chapterThemeActive: { borderColor: '#315C4F', backgroundColor: '#315C4F', transform: [{ translateY: -1 }] },
  chapterThemeNumber: { width: 32, color: '#D79576', fontFamily: 'Georgia', fontSize: 12 },
  chapterThemeText: { flex: 1, color: '#182520', fontFamily: 'Georgia', fontSize: 15, fontWeight: '500', lineHeight: 22.5 },
  chapterThemeMark: { width: 24, color: '#8D9B94', textAlign: 'center' },
  chapterThemeActiveText: { color: '#F8F1E5' },
  chapterThemeMarkActive: { color: '#D8BB78' },
  customThemeCard: { marginTop: 12, padding: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(49,92,79,.28)', borderRadius: 18, backgroundColor: 'rgba(255,255,255,.3)' },
  customThemeLabel: { color: '#52645C', fontSize: 11, fontWeight: '700' },
  customThemeInput: { minHeight: 62, marginTop: 8, marginBottom: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(24,37,32,.18)', color: '#182520', fontSize: 14, lineHeight: 21.7, textAlignVertical: 'top' },
  smallButton: { minHeight: 42, paddingHorizontal: 16, alignSelf: 'flex-start', borderRadius: 16, backgroundColor: '#315C4F', alignItems: 'center', justifyContent: 'center' },
  smallButtonDisabled: { opacity: 0.38 },
  smallButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  introBackground: { flex: 1 },
  introContent: { maxWidth: undefined, paddingTop: 48, paddingHorizontal: 24, paddingBottom: 34, gap: 0 },
  introHero: { marginTop: 18, alignItems: 'center' },
  chapterNumber: { color: '#B1C2BA', fontSize: 9, fontWeight: '800', letterSpacing: 1.62 },
  chapterGlyph: { position: 'relative', width: 112, height: 112, marginTop: 13, marginBottom: 7, alignItems: 'center', justifyContent: 'center' },
  chapterGlyphOuter: { position: 'absolute', inset: 0, borderWidth: 1, borderColor: 'rgba(216,187,120,.3)', borderRadius: 56 },
  chapterGlyphOrbit: { position: 'absolute', top: 18, right: -20, bottom: 18, left: -20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(216,187,120,.16)', borderRadius: 56, transform: [{ rotate: '17deg' }] },
  chapterGlyphText: { color: '#E0C680', fontFamily: 'Georgia', fontSize: 39 },
  introSmall: { color: '#A9BBB2', fontSize: 11 },
  introTitle: { marginTop: 7, color: '#F6EEE1', fontFamily: 'Georgia', fontSize: 27, fontWeight: '500', lineHeight: 38.34, textAlign: 'center' },
  introNarrative: { maxWidth: 300, marginTop: 9, color: '#8FA69B', fontSize: 9, lineHeight: 13.95, textAlign: 'center' },
  confirmedThemeQuote: { marginVertical: 17, paddingVertical: 12, paddingHorizontal: 15, borderLeftWidth: 2, borderLeftColor: '#D8BB78', color: '#E4D7BD', backgroundColor: 'rgba(255,255,255,.045)', fontFamily: 'Georgia', fontSize: 13, lineHeight: 20.15 },
  introTideLegend: { marginBottom: 10, paddingVertical: 12, paddingHorizontal: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,.09)', borderRadius: 16, backgroundColor: 'rgba(255,255,255,.04)' },
  introLegendHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  introLegendTitle: { color: '#EAD7AA', fontFamily: 'Georgia', fontSize: 12, fontWeight: '500' },
  introLegendMeta: { color: '#82988E', fontSize: 8, letterSpacing: 0.64 },
  introLegendItems: { marginTop: 9, flexDirection: 'row', gap: 5 },
  introLegendItem: { flex: 1, flexDirection: 'row', gap: 4, alignItems: 'center' },
  introLegendSymbol: { color: '#D8BB78', fontFamily: 'Georgia', fontSize: 12 },
  introLegendName: { color: '#C0CEC7', fontSize: 9 },
  introLegendCopy: { marginTop: 8, color: '#8FA39A', fontSize: 8, lineHeight: 11.6 },
  routeItem: { minHeight: 58, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,.08)', flexDirection: 'row', gap: 9, alignItems: 'center' },
  routeNumber: { width: 30, color: '#81998E', fontFamily: 'Georgia', fontSize: 12 },
  routeNumberActive: { color: '#D8BB78' },
  routeCopy: { flex: 1 },
  routeTitle: { color: '#F6EEE1', fontFamily: 'Georgia', fontSize: 13, fontWeight: '500' },
  routeDescription: { marginTop: 2, color: '#8DA198', fontSize: 9 },
  routeTime: { color: '#91A69C', fontSize: 9 },
  boundaryNote: { marginTop: 15, paddingVertical: 11, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,.08)', borderRadius: 14, backgroundColor: 'rgba(255,255,255,.035)', flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  boundaryIcon: { width: 20, height: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,.2)', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  boundaryIconText: { color: '#F6EEE1', fontSize: 10 },
  boundaryText: { flex: 1, color: '#9FB2A9', fontSize: 10, lineHeight: 15.5 },
  narrativeStatus: { minHeight: 28, marginTop: 8, marginHorizontal: 3, color: '#93A99E', fontSize: 9, lineHeight: 13.5, textAlign: 'center' },
  flowChatScreen: { flex: 1, paddingTop: 48, paddingHorizontal: 24, paddingBottom: 22 },
  flowChatHeading: { marginTop: 13, flexDirection: 'row', gap: 11, alignItems: 'center' },
  flowChatAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#315349', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(30,51,43,.18)' },
  flowChatAvatarText: { color: '#F0DBA9', fontFamily: 'Georgia', fontSize: 17 },
  flowChatHeadingCopy: { flex: 1 },
  flowChatTitle: { marginTop: 2, color: '#182520', fontFamily: 'Georgia', fontSize: 20, fontWeight: '500' },
  flowChatSubtitle: { marginTop: 2, color: '#78877F', fontSize: 9 },
  flowChatLog: { minHeight: 190, flex: 1, marginTop: 10, marginHorizontal: -4 },
  flowChatLogContent: { flexGrow: 1, gap: 9, paddingTop: 3, paddingHorizontal: 4, paddingBottom: 10 },
  flowChatMessage: { maxWidth: '86%', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 17 },
  flowChatBot: { alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(49,92,79,.12)', borderTopLeftRadius: 5, backgroundColor: '#FFFDF8', boxShadow: '0 7px 17px rgba(31,52,44,.06)' },
  flowChatUser: { alignSelf: 'flex-end', borderTopRightRadius: 5, backgroundColor: '#315C4F' },
  flowChatMessageText: { fontSize: 11, lineHeight: 17.38 },
  flowChatBotText: { color: '#52645C' },
  flowChatUserText: { color: '#FFF9F1' },
  flowTyping: { width: 56 },
  flowTypingText: { color: '#8A9992', letterSpacing: 1.98 },
  flowChatPrompts: { gap: 6, paddingTop: 3, paddingBottom: 7 },
  flowPromptScroller: { maxHeight: 42, flexGrow: 0, flexShrink: 0 },
  flowPrompt: { minHeight: 32, paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(24,37,32,.13)', borderRadius: 99, backgroundColor: 'rgba(255,255,255,.55)', alignItems: 'center', justifyContent: 'center' },
  flowPromptText: { color: '#52645C', fontSize: 9 },
  flowCrisisExact: { marginTop: 2, marginBottom: 7, padding: 12, borderWidth: 1, borderColor: 'rgba(169,95,86,.25)', borderRadius: 15, backgroundColor: '#F4DFDB' },
  flowCrisisTitle: { color: '#743E39', fontFamily: 'Georgia', fontSize: 14, fontWeight: '500' },
  flowCrisisText: { marginTop: 5, color: '#743E39', fontSize: 9, lineHeight: 13.5 },
  flowChatComposer: { minHeight: 54, padding: 7, borderWidth: 1, borderColor: 'rgba(24,37,32,.13)', borderRadius: 18, backgroundColor: 'rgba(255,255,255,.7)', flexDirection: 'row', gap: 5, alignItems: 'flex-end' },
  flowVoiceInput: { width: 38, height: 38, borderWidth: 1, borderColor: 'rgba(49,92,79,.16)', borderRadius: 19, backgroundColor: 'rgba(49,92,79,.07)', alignItems: 'center', justifyContent: 'center' },
  flowChatInput: { minHeight: 38, maxHeight: 82, flex: 1, paddingVertical: 9, paddingHorizontal: 8, color: '#182520', fontSize: 11, lineHeight: 15.95, textAlignVertical: 'top' },
  flowChatSend: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#315C4F', alignItems: 'center', justifyContent: 'center' },
  flowChatSendDisabled: { opacity: 0.35 },
  flowChatSendText: { color: '#FFFFFF', fontSize: 16 },
  flowChatStatus: { minHeight: 13, marginVertical: 4, color: '#78877F', fontSize: 8, textAlign: 'center' },
  exactActionList: { gap: 10, marginTop: 21 },
  exactAction: { minHeight: 80, paddingVertical: 12, paddingHorizontal: 13, borderWidth: 1, borderColor: 'rgba(24,37,32,.13)', borderRadius: 19, backgroundColor: 'rgba(255,255,255,.58)', flexDirection: 'row', gap: 10, alignItems: 'center' },
  exactActionActive: { borderColor: '#315C4F', backgroundColor: '#315C4F', transform: [{ translateY: -1 }] },
  exactActionIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#DCE5DC', alignItems: 'center', justifyContent: 'center' },
  exactActionIconActive: { backgroundColor: '#D8BB78' },
  exactActionNumber: { color: '#315C4F', fontFamily: 'Georgia', fontSize: 11 },
  exactActionNumberActive: { color: '#182520' },
  exactActionCopy: { flex: 1 },
  exactActionTitle: { color: '#182520', fontFamily: 'Georgia', fontSize: 14, fontWeight: '500', lineHeight: 20.3 },
  exactActionDescription: { marginTop: 3, color: '#78877F', fontSize: 10, lineHeight: 14 },
  exactActionTextActive: { color: '#FFF7EC' },
  exactActionDescriptionActive: { color: '#B9CBC2' },
  exactActionMark: { width: 22, color: '#8D9B94' },
  exactActionMarkActive: { color: '#D8BB78' },
  recommendation: { marginTop: 13, paddingVertical: 11, paddingHorizontal: 13, borderRadius: 14, backgroundColor: 'rgba(216,187,120,.15)' },
  recommendationText: { color: '#52645C', fontSize: 11, lineHeight: 17.05 },
  twoActionFooter: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  skipAction: { width: 96, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  skipActionText: { color: '#315C4F', fontSize: 13, fontWeight: '700' },
  actionContinue: { flex: 1 },
  exactEchoCandidates: { gap: 8, marginTop: 20 },
  exactEchoCandidate: { minHeight: 60, paddingVertical: 10, paddingHorizontal: 13, borderWidth: 1, borderColor: 'rgba(24,37,32,.13)', borderRadius: 17, backgroundColor: 'rgba(255,255,255,.55)', flexDirection: 'row', gap: 8, alignItems: 'center' },
  exactEchoCandidateActive: { borderColor: '#315C4F', backgroundColor: '#315C4F' },
  exactEchoNumber: { width: 28, color: '#D79576', fontFamily: 'Georgia', fontSize: 10 },
  exactEchoText: { flex: 1, color: '#182520', fontFamily: 'Georgia', fontSize: 13, fontWeight: '500', lineHeight: 18.85 },
  exactEchoMark: { width: 22, color: '#315C4F', fontSize: 17 },
  exactEchoTextActive: { color: '#FFF7EC' },
  exactEchoMarkActive: { color: '#D8BB78' },
  customEcho: { marginTop: 12, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(49,92,79,.27)', borderRadius: 17, backgroundColor: 'rgba(255,255,255,.3)' },
  customEchoLabel: { color: '#52645C', fontSize: 11, fontWeight: '700' },
  customEchoInput: { minHeight: 60, marginTop: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(24,37,32,.18)', color: '#182520', fontSize: 14, lineHeight: 21.7, textAlignVertical: 'top' },
  delayLegend: { marginTop: 15, marginBottom: 7, color: '#52645C', fontSize: 11, fontWeight: '700' },
  delayOptions: { flexDirection: 'row', gap: 8 },
  delayButton: { minHeight: 43, flex: 1, borderWidth: 1, borderColor: 'rgba(24,37,32,.13)', borderRadius: 13, backgroundColor: 'rgba(255,255,255,.46)', alignItems: 'center', justifyContent: 'center' },
  delayButtonActive: { borderColor: '#315C4F', backgroundColor: '#315C4F' },
  delayText: { color: '#52645C', fontSize: 12, fontWeight: '700' },
  delayTextActive: { color: '#FFFFFF' },
  exactSaveConsent: { marginTop: 14, padding: 12, borderWidth: 1, borderColor: 'rgba(24,37,32,.13)', borderRadius: 16, backgroundColor: 'rgba(255,255,255,.42)', flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  saveCheckBox: { width: 25, height: 25, borderWidth: 1, borderColor: 'rgba(49,92,79,.3)', borderRadius: 8, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  saveCheckBoxActive: { borderColor: '#315C4F', backgroundColor: '#315C4F' },
  saveCheckText: { color: '#FFFFFF', fontSize: 12 },
  saveConsentCopy: { flex: 1 },
  saveConsentTitle: { color: '#182520', fontSize: 12, fontWeight: '700' },
  saveConsentDescription: { marginTop: 3, color: '#78877F', fontSize: 9, lineHeight: 13.05 },
  completeBackground: { flex: 1 },
  completeContent: { maxWidth: undefined, paddingTop: 48, paddingHorizontal: 24, paddingBottom: 34, gap: 0, alignItems: 'center' },
  completeBrand: { width: '100%', minHeight: 38, flexDirection: 'row', gap: 8, alignItems: 'center' },
  completeBrandSymbol: { color: '#D8BB78', fontFamily: 'Georgia', fontSize: 21 },
  completeBrandName: { color: '#F7F0E4', fontFamily: 'Georgia', fontSize: 17, fontWeight: '500', letterSpacing: 2 },
  completionOrbit: { position: 'relative', width: 132, height: 132, marginTop: 29, marginBottom: 15, alignItems: 'center', justifyContent: 'center' },
  completionRing: { position: 'absolute', inset: 0, borderWidth: 1, borderColor: 'rgba(216,195,143,.27)', borderRadius: 66 },
  completionRingLeft: { transform: [{ rotate: '60deg' }, { scaleX: 0.58 }] },
  completionRingRight: { transform: [{ rotate: '-60deg' }, { scaleX: 0.58 }] },
  completionSymbol: { color: '#E1C880', fontFamily: 'Georgia', fontSize: 44 },
  completeEyebrow: { color: '#D7C18A', fontSize: 10, fontWeight: '800', letterSpacing: 1.7 },
  completeTitleExact: { marginTop: 12, marginBottom: 18, color: '#F6EEE1', fontFamily: 'Georgia', fontSize: 27, fontWeight: '500', lineHeight: 39.15, textAlign: 'center' },
  completionCard: { width: '100%', padding: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,.1)', borderRadius: 21, backgroundColor: 'rgba(255,255,255,.055)' },
  completionLabel: { color: '#91A69C', fontSize: 9 },
  completionTheme: { marginTop: 7, marginBottom: 14, color: '#F6EEE1', fontFamily: 'Georgia', fontSize: 15, lineHeight: 23.25 },
  completionRow: { paddingVertical: 9, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,.08)', flexDirection: 'row', gap: 8 },
  completionRowLabel: { width: 88, color: '#93A99F', fontSize: 9 },
  completionRowValue: { flex: 1, color: '#F6EEE1', fontSize: 11, lineHeight: 15.95, fontWeight: '600' },
  completionCollection: { width: '100%', marginTop: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(216,187,120,.2)', borderRadius: 20, backgroundColor: 'rgba(216,187,120,.07)' },
  collectionHeading: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'space-between' },
  collectionEyebrow: { color: '#D4BD83', fontSize: 9, fontWeight: '800', letterSpacing: 0.72 },
  collectionTitle: { marginTop: 3, color: '#F6EEE1', fontFamily: 'Georgia', fontSize: 12, fontWeight: '500' },
  collectionLink: { color: '#E4CF9E', fontSize: 9, fontWeight: '700' },
  completeTideCard: { width: '100%', marginTop: 7, paddingVertical: 9, paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,.1)', borderRadius: 13, backgroundColor: 'rgba(255,255,255,.045)', flexDirection: 'row', gap: 8, alignItems: 'center' },
  completeTideSymbol: { width: 28, color: '#D8BB78', fontFamily: 'Georgia', fontSize: 18, textAlign: 'center' },
  completeTideLabel: { color: '#9EB0A7', fontSize: 8 },
  completeTideQuote: { marginTop: 2, color: '#F4ECDE', fontFamily: 'Georgia', fontSize: 10, lineHeight: 14.5 },
  completionNoteExact: { marginVertical: 14, marginHorizontal: 5, color: '#99ADA4', fontSize: 10, lineHeight: 16, textAlign: 'center' },
  restartButton: { width: '100%', minHeight: 56, marginTop: 'auto', paddingHorizontal: 21, borderRadius: 16, backgroundColor: '#EFE2C6', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  restartText: { color: '#182520', fontSize: 13, fontWeight: '700' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { alignSelf: 'flex-start', minHeight: 42 },
  stageLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  noteSurface: { flexDirection: 'row', gap: spacing.three, minHeight: 115 },
  noteIndex: { fontSize: 12, fontWeight: '900', paddingTop: 5 },
  noteInput: { flex: 1, minHeight: 75, fontSize: 16, lineHeight: 25, textAlignVertical: 'top' },
  noteImagesCard: { gap: spacing.four },
  noteImagesHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.three },
  noteImagesCopy: { flex: 1, minWidth: 220, gap: 3 },
  imagePickerButton: { minHeight: 42 },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.two },
  imagePreview: { width: 82, height: 82, borderRadius: radius.small, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  imageRemove: { position: 'absolute', top: 3, right: 3, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.62)', alignItems: 'center', justifyContent: 'center' },
  imageRemoveText: { color: palette.white, fontSize: 17 },
  themeList: { gap: spacing.three },
  themeOption: { borderWidth: 1, borderRadius: radius.medium, padding: spacing.four, flexDirection: 'row', alignItems: 'center', gap: spacing.three },
  themeNumber: { fontSize: 11, fontWeight: '900' },
  themeText: { flex: 1, fontSize: 15, lineHeight: 23, fontWeight: '700' },
  themeCheck: { fontSize: 16 },
  customTheme: { gap: spacing.three },
  customInput: { minHeight: 85, borderWidth: 1, borderRadius: radius.small, padding: spacing.three, fontSize: 15, textAlignVertical: 'top' },
  confirmedTheme: { gap: spacing.three },
  confirmedThemeText: { fontSize: 21, lineHeight: 32, fontWeight: '700' },
  tideLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.three },
  legendItem: { flex: 1, minWidth: 230, gap: spacing.two },
  legendSymbol: { fontSize: 27 },
  legendLabel: { fontSize: 16, fontWeight: '900' },
  cardProgressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.three },
  cardProgressText: { fontSize: 12, fontWeight: '900' },
  progressTrack: { flex: 1, height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.pill },
  thread: { fontSize: 13, lineHeight: 20 },
  tides: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.three },
  tideMeter: { width: '47%', minWidth: 150, flexGrow: 1, gap: 5 },
  tideLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  tideLabel: { fontSize: 11, fontWeight: '800' },
  tideValue: { fontSize: 10 },
  tideTrack: { height: 5, borderRadius: radius.pill, overflow: 'hidden' },
  tideFill: { height: '100%', borderRadius: radius.pill },
  storyCard: { minHeight: 330, justifyContent: 'space-between', gap: spacing.five },
  speakerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.three },
  portrait: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  portraitText: { fontSize: 20, fontWeight: '900' },
  speakerCopy: { flex: 1 },
  speaker: { fontSize: 15, fontWeight: '900', marginBottom: 2 },
  prompt: { fontSize: 24, lineHeight: 36, fontWeight: '800' },
  divider: { height: StyleSheet.hairlineWidth, width: '100%' },
  whisper: { fontStyle: 'italic' },
  result: { fontSize: 13, textAlign: 'center', fontWeight: '700' },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.three },
  choice: { flex: 1, minWidth: 210 },
  chatHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.four, paddingVertical: spacing.four },
  chatAvatar: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center' },
  chatAvatarText: { color: palette.white, fontSize: 25, fontWeight: '900' },
  chatHeadingCopy: { flex: 1, gap: 3 },
  chatTitle: { fontSize: 25, fontWeight: '900' },
  chatLog: { gap: spacing.three, minHeight: 160 },
  chatMessage: { maxWidth: '88%', borderRadius: radius.medium, borderWidth: StyleSheet.hairlineWidth, padding: spacing.four },
  chatUser: { alignSelf: 'flex-end', borderBottomRightRadius: 5 },
  chatAssistant: { alignSelf: 'flex-start', borderBottomLeftRadius: 5 },
  chatMessageText: { fontSize: 15, lineHeight: 24 },
  chatPrompts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.two },
  flowCrisis: { gap: spacing.three, borderColor: palette.rust, borderWidth: 1 },
  crisisTitle: { fontSize: 18, fontWeight: '900' },
  chatComposer: { minHeight: 64, borderRadius: radius.large, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'flex-end', padding: spacing.two, gap: spacing.two },
  composerMic: { width: 40, textAlign: 'center', fontSize: 22, paddingBottom: 10 },
  chatInput: { flex: 1, minHeight: 42, maxHeight: 120, fontSize: 15, lineHeight: 22, paddingVertical: 9 },
  chatSend: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  chatSendText: { color: palette.white, fontSize: 22, fontWeight: '900' },
  actionOption: { borderWidth: 1, borderRadius: radius.medium, padding: spacing.four, flexDirection: 'row', alignItems: 'center', gap: spacing.three },
  actionCheck: { fontSize: 17 },
  actionCopy: { flex: 1, gap: 3 },
  actionTitle: { fontSize: 16, fontWeight: '900' },
  saveConsent: { flexDirection: 'row', alignItems: 'center', gap: spacing.four },
  saveCopy: { flex: 1, gap: 3 },
  completeHero: { alignItems: 'center' },
  completeSymbol: { fontSize: 64 },
  summaryCard: { gap: spacing.three },
  summaryText: { fontSize: 18, lineHeight: 28, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(8,16,13,0.62)', alignItems: 'center', justifyContent: 'center', padding: spacing.five },
  rewardCard: { width: '100%', maxWidth: 520, borderRadius: radius.large, borderWidth: StyleSheet.hairlineWidth, padding: spacing.six, alignItems: 'center', gap: spacing.four },
  rewardSymbol: { fontSize: 54 },
  rewardEyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  rewardQuote: { fontSize: 22, lineHeight: 34, textAlign: 'center', fontWeight: '700' },
  rewardActions: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.three },
  rewardButton: { flex: 1, minWidth: 160 },
});
