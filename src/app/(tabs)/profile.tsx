import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { OnboardingModal } from '@/components/onboarding-modal';
import { AmbientMusicButton } from '@/components/ambient-music-button';
import {
  AppButton,
  AppScreen,
  BrandHeader,
  Chip,
  MutedText,
  Surface,
} from '@/components/ui';
import { useAppTheme } from '@/constants/theme';
import { sendModelMessage, testApiSettings } from '@/lib/model-api';
import { asrErrorMessage, testAsrConnection } from '@/lib/realtime-asr';
import { createId } from '@/lib/storage';
import { useAppState } from '@/providers/app-state';
import type { ApiSettings, AsrSettings } from '@/types';

const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

export default function ProfileScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const state = useAppState();
  const [apiForm, setApiForm] = useState<ApiSettings>(state.apiSettings);
  const [asrForm, setAsrForm] = useState<AsrSettings>(state.asrSettings);
  const [apiStatus, setApiStatus] = useState('尚未配置自定义 API。');
  const [asrStatus, setAsrStatus] = useState('尚未保存自定义语音转写配置。');
  const [testingApi, setTestingApi] = useState(false);
  const [testingAsr, setTestingAsr] = useState(false);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate());
  const [monthlySummary, setMonthlySummary] = useState('当前显示本地日历，不会自动发送内容。');
  const [generatingMonth, setGeneratingMonth] = useState(false);
  const [tutorialVisible, setTutorialVisible] = useState(false);

  const monthEntries = useMemo(() => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    return [
      ...state.notes.map((note) => ({
        id: note.id,
        type: 'thought' as const,
        text: note.text,
        date: new Date(note.createdAt),
      })),
      ...state.echoes.map((echo) => ({
        id: echo.id,
        type: 'echo' as const,
        text: echo.text,
        date: new Date(echo.revealAt),
      })),
    ].filter((entry) => entry.date.getFullYear() === year && entry.date.getMonth() === monthIndex);
  }, [month, state.echoes, state.notes]);

  const days = useMemo(() => {
    const firstWeekday = month.getDay();
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array.from({ length: firstWeekday }, () => null), ...Array.from({ length: count }, (_, index) => index + 1)];
  }, [month]);

  const selectedEntries = monthEntries.filter((entry) => entry.date.getDate() === selectedDay);

  function shiftMonth(offset: number) {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setMonth(next);
    setSelectedDay(1);
    setMonthlySummary('当前显示本地日历，不会自动发送内容。');
  }

  async function testConnection() {
    setTestingApi(true);
    try {
      setApiStatus(await testApiSettings(apiForm));
    } catch (error) {
      setApiStatus(error instanceof Error ? error.message : '连接失败');
    } finally {
      setTestingApi(false);
    }
  }

  async function saveApi() {
    await state.saveApiSettings({
      ...apiForm,
      baseUrl: apiForm.baseUrl.trim().replace(/\/+$/, ''),
      apiKey: apiForm.apiKey.trim(),
      model: apiForm.model.trim(),
    });
    setApiStatus('已保存到当前设备。');
  }

  async function saveAsr() {
    if (!asrForm.appId.trim() || !asrForm.apiKey.trim() || !asrForm.apiSecret.trim()) {
      setAsrStatus('请填写 APPID、APIKey 和 APISecret。');
      return;
    }
    await state.saveAsrSettings({
      appId: asrForm.appId.trim(),
      apiKey: asrForm.apiKey.trim(),
      apiSecret: asrForm.apiSecret.trim(),
    });
    setAsrStatus('已保存；三个麦克风入口会使用这组凭据。');
  }

  async function testAsr() {
    if (!asrForm.appId.trim() || !asrForm.apiKey.trim() || !asrForm.apiSecret.trim()) {
      setAsrStatus('请先填写全部字段。');
      return;
    }
    setTestingAsr(true);
    setAsrStatus('正在建立一次不发送音频的 WebSocket 测试…');
    try {
      const sessionId = await testAsrConnection(asrForm);
      setAsrStatus(`连接成功${sessionId ? ` · 会话 ${sessionId.slice(0, 8)}` : ''}；未发送音频。`);
    } catch (error) {
      setAsrStatus(asrErrorMessage(error));
    } finally {
      setTestingAsr(false);
    }
  }

  async function generateMonthlyReflection() {
    if (!monthEntries.length) {
      setMonthlySummary('这个月还没有可整理的闪念或已解封回响。');
      return;
    }
    setGeneratingMonth(true);
    try {
      if (state.aiEnabled && state.profileEnabled && state.apiSettings.apiKey) {
        const excerpts = monthEntries.slice(-30).map((entry) => `${entry.date.getDate()}日：${entry.text}`).join('\n');
        const reply = await sendModelMessage(state.apiSettings, [
          {
            id: createId('monthly'),
            role: 'user',
            content: `请把下面当月片段整理成一段可修正、非诊断性的温和回顾，并提出一个可跳过的问题：\n${excerpts}`,
          },
        ]);
        setMonthlySummary(reply);
      } else {
        const thoughtCount = monthEntries.filter((entry) => entry.type === 'thought').length;
        const echoCount = monthEntries.filter((entry) => entry.type === 'echo').length;
        setMonthlySummary(`本月留下 ${thoughtCount} 条闪念，遇见 ${echoCount} 条未来回响。这里只整理日期与数量，不推断心理状态。`);
      }
    } catch (error) {
      setMonthlySummary(error instanceof Error ? `${error.message}；仍保留本地日历。` : '生成失败；仍保留本地日历。');
    } finally {
      setGeneratingMonth(false);
    }
  }

  function confirmClear(label: string, action: () => Promise<void>) {
    Alert.alert(`清除${label}？`, '这项操作只影响当前设备，无法撤销。', [
      { text: '取消', style: 'cancel' },
      { text: '清除', style: 'destructive', onPress: () => void action() },
    ]);
  }

  return (
    <AppScreen testID="profile-screen" contentStyle={styles.content}>
      <BrandHeader
        eyebrow="YOUR SPACE"
        action={
          <View style={styles.headerActions}>
            <AmbientMusicButton />
            <Pressable onPress={() => setTutorialVisible(true)} style={[styles.help, { borderColor: theme.border }]}> 
              <Text style={[styles.helpText, { color: theme.text }]}>?</Text>
            </Pressable>
          </View>
        }
      />
      <View style={styles.pageHeading}><Text style={styles.pageEyebrow}>YOUR SPACE</Text><Text style={styles.pageTitle}>我的</Text><Text style={styles.pageDescription}>你决定留下什么，也可以随时把它带走。</Text></View>

      <Surface elevated style={styles.memoryCard}>
        <View style={styles.memoryHead}>
          <View>
            <Text style={styles.memoryEyebrow}>MY TRACE</Text>
            <Text style={styles.memoryTitle}>我的时光</Text>
          </View>
          <View style={styles.monthSwitcher}>
            <Pressable onPress={() => shiftMonth(-1)}><Text style={styles.monthArrow}>‹</Text></Pressable>
            <Text style={styles.monthLabel}>{month.getFullYear()}年{month.getMonth() + 1}月</Text>
            <Pressable onPress={() => shiftMonth(1)}><Text style={styles.monthArrow}>›</Text></Pressable>
          </View>
        </View>
        <Text style={styles.memoryIntro}>闪念与未来回响会落在各自的日期里，慢慢连成一张只属于你的时间卡。</Text>
        <View style={styles.weekRow}>
          {weekdays.map((day) => <Text key={day} style={styles.weekday}>{day}</Text>)}
        </View>
        <View style={styles.calendar}>
          {days.map((day, index) => {
            const entries = day ? monthEntries.filter((entry) => entry.date.getDate() === day) : [];
            const active = day === selectedDay;
            const hasThought = entries.some((entry) => entry.type === 'thought');
            const hasEcho = entries.some((entry) => entry.type === 'echo');
            return (
              <Pressable
                key={`${day ?? 'blank'}-${index}`}
                disabled={!day}
                onPress={() => day && setSelectedDay(day)}
                style={[
                  styles.day,
                  hasThought ? styles.dayThought : null,
                  hasEcho ? styles.dayEcho : null,
                  hasThought && hasEcho ? styles.dayBoth : null,
                  active ? styles.dayActive : null,
                ]}>
                {day ? <Text style={[styles.dayText, active ? styles.dayTextActive : null]}>{day}</Text> : null}
              </Pressable>
            );
          })}
        </View>
        <View style={styles.legend}>
          <Text style={styles.legendText}>● 闪念</Text><Text style={styles.legendEcho}>● 未来回响</Text><Text style={styles.legendTotal}>{monthEntries.length ? `${monthEntries.length} 个片段` : '还没有留下记录'}</Text>
        </View>
        <Surface style={styles.selectedDayCard}>
          <View style={styles.selectedHead}>
            <View><Text style={styles.memoryPanelEyebrow}>SELECTED DAY</Text><Text style={styles.memoryPanelTitle}>{month.getMonth() + 1}月{selectedDay}日</Text></View>
            <Text style={styles.memoryPanelCount}>{selectedEntries.length} 个片段</Text>
          </View>
          {selectedEntries.length ? selectedEntries.map((entry) => (
            <Text key={entry.id} style={styles.memoryEntryText}>{entry.type === 'thought' ? '闪念' : '回响'} · {entry.text}</Text>
          )) : <Text style={styles.memoryEmpty}>这一天还没有主动留下的内容。</Text>}
          <View style={styles.inlineActions}>
            <AppButton label="写一条闪念" variant="secondary" onPress={() => router.push('/thoughts')} style={[styles.flexButton, styles.memoryButton]} />
            <AppButton label="打开未来回响" variant="secondary" onPress={() => router.push('/echoes')} style={[styles.flexButton, styles.memoryButton]} />
          </View>
        </Surface>
        <Surface style={styles.monthlyPanel}>
          <View style={styles.selectedHead}>
            <View style={styles.monthlyTitle}><Text style={styles.memoryPanelEyebrow}>MONTHLY REFLECTION · AI</Text><Text style={styles.memoryPanelTitle}>本月回顾</Text></View>
            <AppButton label="生成" variant="secondary" loading={generatingMonth} onPress={generateMonthlyReflection} style={[styles.generateButton, styles.memoryButton]} />
          </View>
          <Text style={styles.monthlySummary}>{monthlySummary}</Text>
        </Surface>
      </Surface>

      <SettingsTitle title="自定义模型 API" copy="应用直接调用 OpenAI 兼容端点，不再经过心潮后端。" />
      <Surface elevated style={styles.form}>
        <Field label="API Base URL"><SettingsInput value={apiForm.baseUrl} onChangeText={(baseUrl) => setApiForm((current) => ({ ...current, baseUrl }))} placeholder="https://your-provider.example/v1" /></Field>
        <Field label="API Key"><SettingsInput value={apiForm.apiKey} onChangeText={(apiKey) => setApiForm((current) => ({ ...current, apiKey }))} placeholder="sk-…" secureTextEntry /></Field>
        <Field label="模型名称"><SettingsInput value={apiForm.model} onChangeText={(model) => setApiForm((current) => ({ ...current, model }))} placeholder="gpt-5.6-sol" /></Field>
        <Field label="图片理解精度">
          <View style={styles.chips}>{(['high', 'auto', 'low'] as const).map((value) => <Pressable key={value} onPress={() => setApiForm((current) => ({ ...current, imageDetail: value }))}><Chip label={value === 'high' ? '高' : value === 'auto' ? '自动' : '低（更省 token）'} selected={apiForm.imageDetail === value} /></Pressable>)}</View>
        </Field>
        <Text style={[styles.security, { color: theme.secondaryText }]}>请留意：前端本机保存的 Key 可被同设备脚本或扩展读取。Web 端点必须允许 CORS，HTTPS 页面不能调用 HTTP 地址。</Text>
        <MutedText>{apiStatus}</MutedText>
        <View style={styles.actions}><AppButton label="测试当前表单" variant="secondary" loading={testingApi} onPress={testConnection} style={styles.flexButton} /><AppButton label="保存到本机" onPress={saveApi} style={styles.flexButton} /></View>
        <AppButton label="清除 API 配置" variant="ghost" onPress={() => { void state.clearApiSettings(); setApiForm({ baseUrl: '', apiKey: '', model: 'gpt-5.6-sol', imageDetail: 'high' }); setApiStatus('已清除 API 配置。'); }} />
      </Surface>

      <SettingsTitle title="自定义语音转写" copy="使用你自己的讯飞凭据直连实时语音转写服务。" />
      <Surface elevated style={styles.form}>
        <Field label="讯飞 APPID"><SettingsInput value={asrForm.appId} onChangeText={(appId) => setAsrForm((current) => ({ ...current, appId }))} placeholder="填写控制台中的 APPID" /></Field>
        <Field label="讯飞 APIKey"><SettingsInput value={asrForm.apiKey} onChangeText={(apiKey) => setAsrForm((current) => ({ ...current, apiKey }))} placeholder="填写实时语音转写 APIKey" secureTextEntry /></Field>
        <Field label="讯飞 APISecret"><SettingsInput value={asrForm.apiSecret} onChangeText={(apiSecret) => setAsrForm((current) => ({ ...current, apiSecret }))} placeholder="填写实时语音转写 APISecret" secureTextEntry /></Field>
        <Text style={[styles.security, { color: theme.secondaryText }]}>纯前端无法隐藏 APISecret，请使用可轮换、限额的独立凭据。</Text>
        <MutedText>{asrStatus}</MutedText>
        <View style={styles.actions}><AppButton label={testingAsr ? '测试中…' : '测试当前表单'} variant="secondary" disabled={testingAsr} onPress={() => void testAsr()} style={styles.flexButton} /><AppButton label="保存到本机" onPress={saveAsr} style={styles.flexButton} /></View>
        <AppButton label="清除语音转写配置" variant="ghost" onPress={() => { void state.clearAsrSettings(); setAsrForm({ appId: '', apiKey: '', apiSecret: '' }); setAsrStatus('已清除语音转写配置。'); }} />
      </Surface>

      <Surface elevated style={styles.impression}>
        <View style={styles.impressionMeta}><Text style={styles.impressionEyebrow}>初印象</Text><Text style={styles.impressionMetaText}>轻量画像 · 可随时修正</Text></View>
        <Text style={styles.impressionTitle}>{state.profile?.profile.headline || '你似乎愿意先看清一点，再决定下一步。'}</Text>
        <Text style={styles.impressionCopy}>{state.profile?.profile.summary || '这是根据你主动留下的内容形成的温和提示，不是分数，也不是固定标签。'}</Text>
        <View style={styles.impressionChips}>{(state.profile ? [...state.profile.profile.current_state, ...state.profile.profile.needs_and_preferences].map((item) => item.title).slice(0, 3) : ['愿意观察', '保留选择权', '可以慢一点']).map((label) => <View key={label} style={styles.impressionChip}><Text style={styles.impressionChipText}>{label}</Text></View>)}</View>
      </Surface>

      <SettingsTitle title="AI 与持续画像" copy="两项授权彼此独立，关闭后立即停止新的请求。" />
      <Surface style={styles.form}>
        <ToggleRow label="按次使用 AI 服务" copy="把当次聊天或明确选中的材料直接发送到你配置的模型服务商" value={state.aiEnabled} onChange={(value) => void state.setAiEnabled(value)} />
        <ToggleRow label="持续更新本机画像" copy="关键节点异步合并文字、图片理解与互动；只保存文字化结果，不保存原图" value={state.profileEnabled} disabled={!state.aiEnabled || !state.apiSettings.apiKey} onChange={(value) => void state.setProfileEnabled(value)} />
        <MutedText>{state.profileStatus.message}</MutedText>
        <View style={styles.actions}><AppButton label="立即更新画像" variant="secondary" disabled={!state.profileEnabled || state.profileStatus.state === 'updating'} onPress={() => void state.refreshProfile('interaction')} style={styles.flexButton} /><AppButton label="删除本机画像" variant="ghost" disabled={!state.profile} onPress={() => confirmClear('本机连续画像', state.clearProfile)} style={styles.flexButton} /></View>
      </Surface>

      <SettingsTitle title="我的收藏" />
      <View style={styles.mySpaceLinks}><CollectionLink symbol="▱" title="潮笺卡槽" copy={state.cards.length ? `已收下 ${state.cards.length} 张潮笺` : '看看满潮时收下的短句'} onPress={() => router.push('/cards')} /><CollectionLink symbol="⌁" title="未来回响" copy={state.echoes.length ? `${state.echoes.length} 句话正在这里` : '看看留给未来的话'} onPress={() => router.push('/echoes')} /></View>

      <SettingsTitle title="你的内容与偏好" />
      <Surface style={styles.form}>
        {[
          ['随手闪念', '文字、日期和表达类型保存在本机；图片与录音不落盘。'],
          ['章节选择', '仅用于本次对话开场与建议，离开后清除。'],
          ['潮笺卡槽', '只保存内置卡片编号与收藏时间。'],
          ['陪伴对话', '原始录音不落盘；主动发送后文字才进入对话。'],
          ['模型与语音 API', '端点、Key 和 Secret 只保存在当前设备。'],
          ['未来回响', '只有主动勾选后保存在这台设备。'],
        ].map(([title, copy]) => <View key={title} style={[styles.boundaryRow, { borderBottomColor: theme.border }]}><Text style={[styles.boundaryTitle, { color: theme.text }]}>{title}</Text><MutedText>{copy}</MutedText></View>)}
        <AppButton label={state.notes.length ? `删除全部 ${state.notes.length} 条闪念` : '闪念目前为空'} variant="secondary" disabled={!state.notes.length} onPress={() => confirmClear('全部闪念', state.clearNotes)} />
        <AppButton label={state.cards.length ? `清空 ${state.cards.length} 张潮笺` : '卡槽目前为空'} variant="secondary" disabled={!state.cards.length} onPress={() => confirmClear('潮笺卡槽', state.clearCards)} />
        <AppButton label={state.echoes.length ? `删除全部 ${state.echoes.length} 条回响` : '未来回响目前为空'} variant="secondary" disabled={!state.echoes.length} onPress={() => confirmClear('未来回响', state.clearEchoes)} />
      </Surface>

      <Surface style={styles.form}><Text style={[styles.cardTitle, { color: theme.text }]}>第一次来，不知道从哪里开始？</Text><MutedText>用 30 秒看懂“今天、闪念、对话和回响”各自适合什么时候使用。</MutedText><AppButton label="再看一次新手说明" variant="ghost" onPress={() => setTutorialVisible(true)} /></Surface>
      <Surface><Text style={[styles.version, { color: theme.text }]}>原型版本</Text><MutedText>V0.8 · Expo / React Native 一比一迁移版。</MutedText></Surface>
      <OnboardingModal visible={tutorialVisible} onClose={() => setTutorialVisible(false)} />
    </AppScreen>
  );
}

function SettingsTitle({ title, copy }: { title: string; copy?: string }) {
  const theme = useAppTheme();
  return <View style={styles.settingsTitle}><View style={styles.settingsTitleCopy}><Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text>{copy ? <MutedText>{copy}</MutedText> : null}</View><View style={styles.localBadge}><Text style={styles.localBadgeText}>仅本机</Text></View></View>;
}

function CollectionLink({ symbol, title, copy, onPress }: { symbol: string; title: string; copy: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.collectionLink}><View style={styles.collectionIcon}><Text style={styles.collectionSymbol}>{symbol}</Text></View><View style={styles.collectionCopy}><Text style={styles.collectionTitle}>{title}</Text><Text style={styles.collectionDescription}>{copy}</Text></View><Text style={styles.collectionArrow}>→</Text></Pressable>;
}

function Field({ label, children }: React.PropsWithChildren<{ label: string }>) {
  const theme = useAppTheme();
  return <View style={styles.field}><Text style={[styles.fieldLabel, { color: theme.text }]}>{label}</Text>{children}</View>;
}

function SettingsInput(props: React.ComponentProps<typeof TextInput>) {
  const theme = useAppTheme();
  return <TextInput {...props} autoCapitalize="none" autoCorrect={false} placeholderTextColor={theme.secondaryText} style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }, props.style]} />;
}

function ToggleRow({ label, copy, value, disabled, onChange }: { label: string; copy: string; value: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  const theme = useAppTheme();
  return <View style={[styles.toggleRow, { opacity: disabled ? 0.45 : 1 }]}><View style={styles.toggleCopy}><Text style={[styles.toggleTitle, { color: theme.text }]}>{label}</Text><MutedText>{copy}</MutedText></View><Switch disabled={disabled} value={value} onValueChange={onChange} trackColor={{ true: theme.accent }} /></View>;
}

const styles = StyleSheet.create({
  content: { maxWidth: undefined, paddingTop: 48, paddingHorizontal: 24, paddingBottom: 104, gap: 0 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  help: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: 'rgba(24,37,32,.18)', backgroundColor: 'rgba(255,255,255,.42)', alignItems: 'center', justifyContent: 'center' },
  helpText: { color: '#315C4F', fontSize: 15, fontWeight: '800' },
  pageHeading: { marginTop: 30 },
  pageEyebrow: { color: '#315C4F', fontSize: 10, fontWeight: '800', letterSpacing: 1.7 },
  pageTitle: { marginTop: 9, marginBottom: 12, color: '#182520', fontFamily: 'Georgia', fontSize: 42, fontWeight: '500', lineHeight: 56.7 },
  pageDescription: { color: '#52645C', fontSize: 14, lineHeight: 23.8 },
  memoryCard: { position: 'relative', marginTop: 16, paddingTop: 19, paddingHorizontal: 17, paddingBottom: 17, overflow: 'hidden', borderColor: 'rgba(255,255,255,.08)', borderRadius: 26, backgroundColor: '#101A24', boxShadow: '0 18px 38px rgba(25,39,34,.18)' },
  memoryHead: { zIndex: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  memoryEyebrow: { color: '#8EAAA0', fontSize: 8, fontWeight: '800', letterSpacing: 1.2 },
  memoryTitle: { marginTop: 3, color: '#F7F1E6', fontFamily: 'Georgia', fontSize: 19, fontWeight: '500' },
  monthSwitcher: { minHeight: 31, padding: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,.08)', borderRadius: 99, backgroundColor: 'rgba(255,255,255,.045)', flexDirection: 'row', alignItems: 'center', gap: 3 },
  monthArrow: { width: 28, height: 27, color: '#AAC0B6', fontSize: 17, textAlign: 'center', lineHeight: 27 },
  monthLabel: { minWidth: 70, color: '#EDE8DD', fontSize: 10, fontWeight: '700', textAlign: 'center' },
  memoryIntro: { zIndex: 2, maxWidth: 285, marginTop: 12, marginBottom: 15, color: '#A9B8B1', fontSize: 9, lineHeight: 13.95 },
  weekRow: { flexDirection: 'row' },
  weekday: { width: '14.285%', marginBottom: 6, color: '#698078', textAlign: 'center', fontSize: 7 },
  calendar: { flexDirection: 'row', flexWrap: 'wrap' },
  day: { width: '14.285%', aspectRatio: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,.025)', borderRadius: 99, backgroundColor: 'rgba(255,255,255,.035)', alignItems: 'center', justifyContent: 'center' },
  dayThought: { backgroundColor: 'rgba(74,111,97,.42)' },
  dayEcho: { backgroundColor: 'rgba(94,85,110,.5)', boxShadow: 'inset -3px -4px 7px rgba(0,0,0,.26), 0 0 10px rgba(170,188,211,.15)' },
  dayBoth: { backgroundColor: 'rgba(91,119,112,.72)' },
  dayActive: { borderColor: 'rgba(240,224,188,.68)', boxShadow: 'inset -4px -5px 8px rgba(0,0,0,.24), 0 0 0 3px rgba(255,255,255,.055), 0 0 17px rgba(171,196,229,.32)', transform: [{ scale: 1.08 }] },
  dayText: { color: '#6E7C77', fontSize: 7 },
  dayTextActive: { color: '#FFFAF0' },
  legend: { zIndex: 2, marginTop: 13, marginHorizontal: 1, flexDirection: 'row', gap: 10, alignItems: 'center' },
  legendText: { color: '#6E9485', fontSize: 7 },
  legendEcho: { color: '#D8CBA8', fontSize: 7 },
  legendTotal: { marginLeft: 'auto', color: '#ABBCB4', fontSize: 7, fontWeight: '600' },
  selectedDayCard: { zIndex: 3, marginTop: 14, padding: 13, borderColor: 'rgba(255,255,255,.08)', borderRadius: 18, backgroundColor: 'rgba(8,16,16,.62)' },
  selectedHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  memoryPanelEyebrow: { color: '#728D82', fontSize: 7, fontWeight: '800', letterSpacing: 0.84 },
  memoryPanelTitle: { marginTop: 2, color: '#F7F1E6', fontFamily: 'Georgia', fontSize: 15, fontWeight: '500' },
  memoryPanelCount: { paddingVertical: 4, paddingHorizontal: 7, borderRadius: 99, color: '#CDBB91', backgroundColor: 'rgba(216,187,120,.08)', fontSize: 7 },
  memoryEntryText: { marginTop: 7, padding: 8, borderRadius: 12, color: '#8FA39A', backgroundColor: 'rgba(255,255,255,.045)', fontSize: 8, lineHeight: 11.6 },
  memoryEmpty: { paddingVertical: 8, paddingHorizontal: 2, color: '#83958D', fontSize: 8, lineHeight: 12.4 },
  inlineActions: { marginTop: 10, flexDirection: 'row', gap: 7 },
  memoryButton: { minHeight: 34, borderColor: 'rgba(255,255,255,.08)', backgroundColor: 'rgba(255,255,255,.045)' },
  monthlyPanel: { zIndex: 3, marginTop: 14, padding: 13, borderColor: 'rgba(255,255,255,.08)', borderRadius: 18, backgroundColor: '#29463C' },
  monthlyTitle: { flex: 1 },
  monthlySummary: { marginTop: 10, color: '#A9BBB2', fontSize: 9, lineHeight: 14.4 },
  generateButton: { minHeight: 34, minWidth: 48 },
  settingsTitle: { marginTop: 16, marginBottom: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  settingsTitleCopy: { flex: 1, gap: 3 },
  cardTitle: { color: '#182520', fontFamily: 'Georgia', fontSize: 18, fontWeight: '500' },
  localBadge: { paddingVertical: 4, paddingHorizontal: 7, borderRadius: 99, backgroundColor: 'rgba(49,92,79,.09)' },
  localBadgeText: { color: '#315C4F', fontSize: 8, fontWeight: '800', letterSpacing: 0.48 },
  form: { marginTop: 0, gap: 11 },
  field: { gap: 5 },
  fieldLabel: { fontSize: 10, fontWeight: '700' },
  input: { minHeight: 42, borderWidth: 1, borderRadius: 12, paddingHorizontal: 11, fontSize: 11 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  security: { padding: 10, borderRadius: 12, color: '#795C35', backgroundColor: 'rgba(216,187,120,.16)', fontSize: 9, lineHeight: 13.95 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  flexButton: { flex: 1, minWidth: 0 },
  impression: { marginTop: 16, borderColor: 'rgba(255,255,255,.12)', backgroundColor: '#203A31' },
  impressionMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  impressionEyebrow: { color: '#EFD99F', fontSize: 9, fontWeight: '800', letterSpacing: 1.17 },
  impressionMetaText: { color: '#9FB4AA', fontSize: 8 },
  impressionTitle: { marginTop: 15, marginBottom: 8, color: '#FFF8EE', fontSize: 20, lineHeight: 31, fontWeight: '700' },
  impressionCopy: { color: '#B8C7BF', fontSize: 10, lineHeight: 15.5 },
  impressionChips: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  impressionChip: { paddingVertical: 6, paddingHorizontal: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,.1)', borderRadius: 99, backgroundColor: 'rgba(255,255,255,.06)' },
  impressionChipText: { color: '#E9DFCC', fontSize: 8 },
  toggleRow: { paddingVertical: 11, borderTopWidth: 1, borderTopColor: 'rgba(24,37,32,.13)', flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  toggleCopy: { flex: 1, gap: 3 },
  toggleTitle: { fontSize: 11, fontWeight: '700' },
  mySpaceLinks: { marginTop: 0, gap: 8 },
  collectionLink: { minHeight: 62, paddingVertical: 9, paddingHorizontal: 11, borderWidth: 1, borderColor: 'rgba(24,37,32,.13)', borderRadius: 16, backgroundColor: 'rgba(255,255,255,.45)', flexDirection: 'row', gap: 9, alignItems: 'center' },
  collectionIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#315C4F', alignItems: 'center', justifyContent: 'center' },
  collectionSymbol: { color: '#F1DCA9', fontFamily: 'Georgia', fontSize: 17 },
  collectionCopy: { flex: 1 },
  collectionTitle: { color: '#182520', fontFamily: 'Georgia', fontSize: 13, fontWeight: '500' },
  collectionDescription: { marginTop: 2, color: '#78877F', fontSize: 8 },
  collectionArrow: { color: '#315C4F', fontSize: 14 },
  boundaryRow: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 3 },
  boundaryTitle: { fontSize: 12, fontWeight: '700' },
  version: { fontFamily: 'Georgia', fontSize: 18, fontWeight: '500', marginBottom: 12 },
});
