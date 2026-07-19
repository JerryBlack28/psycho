import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AiConsentModal } from '@/components/ai-consent-modal';
import { MicIcon } from '@/components/icons';
import { AppScreen } from '@/components/ui';
import { SafetyModal } from '@/components/safety-modal';
import { VoiceModeModal } from '@/components/voice-mode-modal';
import { localReplies } from '@/data/content';
import { containsCrisisLanguage, sendModelMessage } from '@/lib/model-api';
import { createId } from '@/lib/storage';
import { useAppState } from '@/providers/app-state';
import type { ChatMessage } from '@/types';

const prompts = [
  ['我只想说说', '我只想说说，暂时不需要建议。'],
  ['帮我拆小压力', '帮我把眼前的压力拆小一点。'],
  ['我现在有点累', '我现在有点累，不知道从哪里开始。'],
];

const opening: ChatMessage = {
  id: 'opening',
  role: 'assistant',
  content: '我在这里。你可以只说一件刚刚发生的小事，也可以告诉我：此刻只想被听见，不需要建议。',
};

export default function ChatScreen() {
  const router = useRouter();
  const state = useAppState();
  const [messages, setMessages] = useState<ChatMessage[]>([opening]);
  const [draft, setDraft] = useState('');
  const [draftFromVoice, setDraftFromVoice] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('聊天内容只在本次页面内存中使用');
  const [crisis, setCrisis] = useState(false);
  const [voiceVisible, setVoiceVisible] = useState(false);
  const [safetyVisible, setSafetyVisible] = useState(false);
  const [consentVisible, setConsentVisible] = useState(false);

  async function send(value = draft) {
    const content = value.trim();
    if (!content || sending) return;
    const userMessage: ChatMessage = { id: createId('chat-user'), role: 'user', content };
    const evidenceSource = draftFromVoice ? 'voice_transcript' : 'response';
    const next = [...messages, userMessage];
    setMessages(next);
    setDraft('');
    setDraftFromVoice(false);
    if (containsCrisisLanguage(content)) {
      setCrisis(true);
      setMessages((current) => [...current, { id: createId('safety'), role: 'assistant', content: '先把安全放在这里。请尽快联系所在地紧急服务、支持资源，或一位能马上来到身边的可信任对象。' }]);
      setStatus('安全提示由本机规则触发，没有发送普通模型请求。');
      return;
    }
    void state.refreshProfile('chat', [{ source_id: `chat:${userMessage.id}`, source: evidenceSource, content }]);
    setSending(true);
    try {
      const reply = state.aiEnabled && state.apiSettings.apiKey
        ? await sendModelMessage(state.apiSettings, next)
        : localReplies[next.length % localReplies.length];
      setMessages((current) => [...current, { id: createId('assistant'), role: 'assistant', content: reply }]);
      setStatus(state.aiEnabled ? `由 ${state.apiSettings.model} 生成 · 当前页面结束后清除` : '当前使用本地陪伴回复；可在“我的”按次启用 AI。');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      setMessages((current) => [...current, { id: createId('fallback'), role: 'assistant', content: localReplies[current.length % localReplies.length] }]);
      setStatus(error instanceof Error ? `${error.message}；已切换到本地回复。` : '请求失败；已切换到本地回复。');
    } finally {
      setSending(false);
    }
  }

  function endChat() {
    setMessages([opening]);
    setCrisis(false);
    setStatus('聊天内容只在本次页面内存中使用');
    router.replace('/');
  }

  return (
    <AppScreen testID="chat-screen" scroll={false}>
      <View style={styles.screenContent}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="返回上一页" onPress={() => router.replace('/')} style={styles.iconButton}><Text style={styles.backIcon}>←</Text></Pressable>
          <View style={styles.pill}><Text style={styles.pillText}>情绪陪伴 · AI</Text></View>
          <Pressable accessibilityLabel="打开实时语音转写" onPress={() => setVoiceVisible(true)} style={styles.iconButton}><MicIcon color="#315C4F" size={20} /></Pressable>
        </View>

        <View style={styles.chatHeading}>
          <View style={styles.avatar}><Text style={styles.avatarText}>潮</Text></View>
          <View style={styles.headingCopy}><Text style={styles.eyebrow}>第二章 · 对话</Text><Text style={styles.title}>和潮伴聊一会儿</Text><Text style={styles.subtitle}>你可以纠正我、跳过问题，或随时结束。</Text></View>
        </View>

        <ScrollView contentContainerStyle={styles.logContent} style={styles.log} showsVerticalScrollIndicator={false}>
          {messages.map((message) => (
            <View key={message.id} style={[styles.message, message.role === 'user' ? styles.userMessage : styles.botMessage]}>
              <Text style={[styles.messageText, message.role === 'user' ? styles.userMessageText : styles.botMessageText]}>{message.content}</Text>
            </View>
          ))}
          {sending ? <View style={[styles.message, styles.botMessage, styles.typingMessage]}><Text style={styles.typingText}>•••</Text></View> : null}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.promptScroller} contentContainerStyle={styles.prompts}>
          {prompts.map(([label, value]) => <Pressable key={label} onPress={() => void send(value)} style={styles.promptButton}><Text style={styles.promptText}>{label}</Text></Pressable>)}
        </ScrollView>

        {crisis ? <View style={styles.crisis}><Text style={styles.crisisTitle}>先把安全放在这里</Text><Text style={styles.crisisCopy}>如果你或他人正处于即时危险，请尽快联系所在地紧急服务、支持资源，或一位能马上来到身边的可信任对象。</Text><Pressable onPress={() => setSafetyVisible(true)} style={styles.crisisButton}><Text style={styles.crisisButtonText}>查看支持说明</Text></Pressable></View> : null}

        <View style={styles.composer}>
          <Pressable accessibilityLabel="开始实时语音转写" onPress={() => setVoiceVisible(true)} style={styles.voiceInput}><MicIcon color="#315C4F" size={20} /></Pressable>
          <TextInput value={draft} onChangeText={(value) => { setDraft(value); setDraftFromVoice(false); }} multiline maxLength={400} placeholder="此刻最想说的是……" placeholderTextColor="#78877F" style={styles.input} />
          <Pressable accessibilityLabel="发送消息" disabled={!draft.trim() || sending} onPress={() => void send()} style={[styles.send, !draft.trim() || sending ? styles.sendDisabled : null]}><Text style={styles.sendText}>↑</Text></Pressable>
        </View>
        <Text style={styles.status}>{status}</Text>
        <View style={styles.exits}>
          {crisis ? <Pressable onPress={() => setSafetyVisible(true)} style={styles.quietExit}><Text style={styles.quietExitText}>我现在需要紧急帮助</Text></Pressable> : null}
          <Pressable onPress={endChat} style={styles.endButton}><Text style={styles.endButtonText}>聊到这里，继续</Text><Text style={styles.endButtonText}>→</Text></Pressable>
        </View>
      </View>

      <VoiceModeModal visible={voiceVisible} settings={state.asrSettings} initialText={draft} onTranscript={(value) => { setDraft(value); setDraftFromVoice(true); }} onClose={() => setVoiceVisible(false)} />
      <SafetyModal visible={safetyVisible} onClose={() => setSafetyVisible(false)} />
      <AiConsentModal visible={consentVisible} configured={Boolean(state.apiSettings.apiKey)} onDecline={() => setConsentVisible(false)} onAccept={(profile) => { void state.setAiEnabled(true); void state.setProfileEnabled(profile); setConsentVisible(false); }} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: { flex: 1, paddingTop: 48, paddingHorizontal: 24, paddingBottom: 92 },
  header: { zIndex: 5, minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 38, height: 38, borderWidth: 1, borderColor: 'rgba(24,37,32,.18)', borderRadius: 19, backgroundColor: 'rgba(255,255,255,.42)', alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: '#182520', fontSize: 18 },
  pill: { paddingVertical: 7, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(49,92,79,.22)', borderRadius: 99 },
  pillText: { color: '#315C4F', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  chatHeading: { marginTop: 13, flexDirection: 'row', gap: 11, alignItems: 'center' },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#315349', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(30,51,43,.18)' },
  avatarText: { color: '#F0DBA9', fontFamily: 'Georgia', fontSize: 17 },
  headingCopy: { flex: 1 },
  eyebrow: { color: '#315C4F', fontSize: 10, fontWeight: '800', letterSpacing: 1.7 },
  title: { marginTop: 2, color: '#182520', fontFamily: 'Georgia', fontSize: 20, fontWeight: '500' },
  subtitle: { marginTop: 2, color: '#78877F', fontSize: 9 },
  log: { minHeight: 190, flex: 1, marginTop: 10, marginHorizontal: -4 },
  logContent: { flexGrow: 1, gap: 9, paddingTop: 3, paddingHorizontal: 4, paddingBottom: 10 },
  message: { maxWidth: '86%', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 17 },
  botMessage: { alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(49,92,79,.12)', borderTopLeftRadius: 5, backgroundColor: '#FFFDF8', boxShadow: '0 7px 17px rgba(31,52,44,.06)' },
  userMessage: { alignSelf: 'flex-end', borderTopRightRadius: 5, backgroundColor: '#315C4F' },
  messageText: { fontSize: 11, lineHeight: 17.38 },
  botMessageText: { color: '#52645C' },
  userMessageText: { color: '#FFF9F1' },
  typingMessage: { width: 56 },
  typingText: { color: '#8A9992', letterSpacing: 1.98 },
  prompts: { gap: 6, paddingTop: 3, paddingBottom: 7 },
  promptScroller: { maxHeight: 42, flexGrow: 0, flexShrink: 0 },
  promptButton: { minHeight: 32, paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(24,37,32,.13)', borderRadius: 99, backgroundColor: 'rgba(255,255,255,.55)', alignItems: 'center', justifyContent: 'center' },
  promptText: { color: '#52645C', fontSize: 9 },
  crisis: { marginTop: 2, marginBottom: 7, padding: 12, borderWidth: 1, borderColor: 'rgba(169,95,86,.25)', borderRadius: 15, backgroundColor: '#F4DFDB' },
  crisisTitle: { color: '#743E39', fontFamily: 'Georgia', fontSize: 14, fontWeight: '500' },
  crisisCopy: { marginTop: 5, color: '#743E39', fontSize: 9, lineHeight: 13.5 },
  crisisButton: { minHeight: 38, marginTop: 8, borderRadius: 12, backgroundColor: '#315C4F', alignItems: 'center', justifyContent: 'center' },
  crisisButtonText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
  composer: { minHeight: 54, padding: 7, borderWidth: 1, borderColor: 'rgba(24,37,32,.13)', borderRadius: 18, backgroundColor: 'rgba(255,255,255,.7)', flexDirection: 'row', gap: 5, alignItems: 'flex-end' },
  voiceInput: { width: 38, height: 38, borderWidth: 1, borderColor: 'rgba(49,92,79,.16)', borderRadius: 19, backgroundColor: 'rgba(49,92,79,.07)', alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 38, maxHeight: 82, flex: 1, paddingVertical: 9, paddingHorizontal: 8, color: '#182520', fontSize: 11, lineHeight: 15.95, textAlignVertical: 'top' },
  send: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#315C4F', alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.35 },
  sendText: { color: '#FFFFFF', fontSize: 16 },
  status: { minHeight: 13, marginVertical: 4, color: '#78877F', fontSize: 8, textAlign: 'center' },
  exits: { gap: 8 },
  quietExit: { minHeight: 30, alignItems: 'center', justifyContent: 'center' },
  quietExitText: { color: '#315C4F', fontSize: 10, fontWeight: '700' },
  endButton: { minHeight: 45, paddingHorizontal: 21, borderRadius: 16, backgroundColor: '#315C4F', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  endButtonText: { color: '#FFFAF0', fontSize: 12, fontWeight: '700' },
});
