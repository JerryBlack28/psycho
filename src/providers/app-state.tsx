import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { answerBookCards } from '@/data/content';
import { analyzeProfile, type ProfileEvidencePayload } from '@/lib/model-api';
import { evidenceFingerprint, profileContextForModel, sanitizeProfileEnvelope, scrubProfileSources, validProfileEnvelope } from '@/lib/profile-runtime';
import { createId, readJson, removeValue, storageKeys, writeJson } from '@/lib/storage';
import type { ApiSettings, AsrSettings, FutureEcho, ProfileEnvelope, ProfileStatus, QuickNote, TideCard } from '@/types';

const emptyApiSettings: ApiSettings = {
  baseUrl: '',
  apiKey: '',
  model: 'gpt-5.6-sol',
  imageDetail: 'high',
};

const emptyAsrSettings: AsrSettings = { appId: '', apiKey: '', apiSecret: '' };

type AnswerRecord = { day: string; index: number } | null;
type ProfileTextEvidence = { source_id: string; source: string; content: string };

type AppStateValue = {
  ready: boolean;
  notes: QuickNote[];
  cards: TideCard[];
  echoes: FutureEcho[];
  answer: string | null;
  apiSettings: ApiSettings;
  asrSettings: AsrSettings;
  aiEnabled: boolean;
  profileEnabled: boolean;
  profile: ProfileEnvelope | null;
  profileStatus: ProfileStatus;
  addNote: (input: Omit<QuickNote, 'id' | 'createdAt'>) => Promise<void>;
  removeNote: (id: string) => Promise<void>;
  collectCard: (card: Omit<TideCard, 'collectedAt'>) => Promise<void>;
  removeCard: (id: string) => Promise<void>;
  addEcho: (text: string, delayDays: number) => Promise<void>;
  removeEcho: (id: string) => Promise<void>;
  drawAnswer: () => Promise<string>;
  saveApiSettings: (settings: ApiSettings) => Promise<void>;
  clearApiSettings: () => Promise<void>;
  saveAsrSettings: (settings: AsrSettings) => Promise<void>;
  clearAsrSettings: () => Promise<void>;
  setAiEnabled: (enabled: boolean) => Promise<void>;
  setProfileEnabled: (enabled: boolean) => Promise<void>;
  refreshProfile: (reason?: string, extraTexts?: ProfileTextEvidence[]) => Promise<void>;
  clearProfile: () => Promise<void>;
  clearNotes: () => Promise<void>;
  clearCards: () => Promise<void>;
  clearEchoes: () => Promise<void>;
  clearLocalData: () => Promise<void>;
};

const AppStateContext = createContext<AppStateValue | null>(null);

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AppStateProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [cards, setCards] = useState<TideCard[]>([]);
  const [echoes, setEchoes] = useState<FutureEcho[]>([]);
  const [answerRecord, setAnswerRecord] = useState<AnswerRecord>(null);
  const [apiSettings, setApiSettingsState] = useState<ApiSettings>(emptyApiSettings);
  const [asrSettings, setAsrSettingsState] = useState<AsrSettings>(emptyAsrSettings);
  const [aiEnabled, setAiEnabledState] = useState(false);
  const [profileEnabled, setProfileEnabledState] = useState(false);
  const [profile, setProfile] = useState<ProfileEnvelope | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>({ state: 'idle', message: '尚未启用持续画像' });
  const profileRef = useRef<ProfileEnvelope | null>(null);
  const profileRunRef = useRef<Promise<void> | null>(null);
  const profileQueueRef = useRef<{ reason: string; extraTexts: ProfileTextEvidence[] } | null>(null);
  const profileControllerRef = useRef<AbortController | null>(null);
  const profileGenerationRef = useRef(0);
  const refreshProfileRef = useRef<(reason?: string, extraTexts?: ProfileTextEvidence[]) => Promise<void>>(async () => undefined);

  useEffect(() => {
    let active = true;
    Promise.all([
      readJson<QuickNote[]>(storageKeys.notes, []),
      readJson<TideCard[]>(storageKeys.cards, []),
      readJson<FutureEcho[]>(storageKeys.echoes, []),
      readJson<AnswerRecord>(storageKeys.answer, null),
      readJson<ApiSettings>(storageKeys.api, emptyApiSettings),
      readJson<AsrSettings>(storageKeys.asr, emptyAsrSettings),
      readJson<boolean>(storageKeys.aiEnabled, false),
      readJson<boolean>(storageKeys.profileEnabled, false),
      readJson<ProfileEnvelope | null>(storageKeys.profile, null),
    ]).then(([storedNotes, storedCards, storedEchoes, storedAnswer, storedApi, storedAsr, storedAi, storedProfileEnabled, storedProfile]) => {
      if (!active) return;
      setNotes(storedNotes);
      setCards(storedCards);
      setEchoes(storedEchoes);
      setAnswerRecord(storedAnswer);
      setApiSettingsState(storedApi);
      setAsrSettingsState(storedAsr);
      setAiEnabledState(storedAi);
      setProfileEnabledState(storedProfileEnabled);
      const validProfile = validProfileEnvelope(storedProfile) ? storedProfile : null;
      setProfile(validProfile);
      profileRef.current = validProfile;
      setProfileStatus({
        state: validProfile ? 'ready' : 'idle',
        message: storedProfileEnabled ? (validProfile ? '已加载本机连续画像' : '持续画像已启用，等待新的可用线索') : '尚未启用持续画像',
      });
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const forgetProfileSources = useCallback(async (sourceIds: string[]) => {
    const next = scrubProfileSources(profileRef.current, sourceIds);
    if (next === profileRef.current) return;
    profileRef.current = next;
    setProfile(next);
    if (next) await writeJson(storageKeys.profile, next);
  }, []);

  const addNote = useCallback(async (input: Omit<QuickNote, 'id' | 'createdAt'>) => {
    const note: QuickNote = { ...input, id: createId('note'), createdAt: Date.now() };
    setNotes((current) => {
      const next = [note, ...current].slice(0, 365);
      void writeJson(storageKeys.notes, next);
      return next;
    });
  }, []);

  const removeNote = useCallback(async (id: string) => {
    setNotes((current) => {
      const next = current.filter((item) => item.id !== id);
      void writeJson(storageKeys.notes, next);
      return next;
    });
    await forgetProfileSources([`quick-note:${id}`, `quick-note-image:${id}`]);
  }, [forgetProfileSources]);

  const collectCard = useCallback(async (card: Omit<TideCard, 'collectedAt'>) => {
    setCards((current) => {
      if (current.some((item) => item.id === card.id)) return current;
      const next = [{ ...card, collectedAt: Date.now() }, ...current];
      void writeJson(storageKeys.cards, next);
      return next;
    });
  }, []);

  const removeCard = useCallback(async (id: string) => {
    setCards((current) => {
      const next = current.filter((item) => item.id !== id);
      void writeJson(storageKeys.cards, next);
      return next;
    });
    await forgetProfileSources([`tidecard:${id}`]);
  }, [forgetProfileSources]);

  const addEcho = useCallback(async (text: string, delayDays: number) => {
    const now = Date.now();
    const echo: FutureEcho = {
      id: createId('echo'),
      text: text.trim(),
      createdAt: now,
      revealAt: now + delayDays * 24 * 60 * 60 * 1000,
    };
    setEchoes((current) => {
      const next = [echo, ...current];
      void writeJson(storageKeys.echoes, next);
      return next;
    });
  }, []);

  const removeEcho = useCallback(async (id: string) => {
    setEchoes((current) => {
      const next = current.filter((item) => item.id !== id);
      void writeJson(storageKeys.echoes, next);
      return next;
    });
    await forgetProfileSources([`echo:${id}`]);
  }, [forgetProfileSources]);

  const drawAnswer = useCallback(async () => {
    const currentDay = todayKey();
    if (answerRecord?.day === currentDay) return answerBookCards[answerRecord.index];
    const dayNumber = Math.floor(Date.now() / 86_400_000);
    const index = dayNumber % answerBookCards.length;
    const next = { day: currentDay, index };
    setAnswerRecord(next);
    await writeJson(storageKeys.answer, next);
    return answerBookCards[index];
  }, [answerRecord]);

  const saveApiSettings = useCallback(async (settings: ApiSettings) => {
    setApiSettingsState(settings);
    await writeJson(storageKeys.api, settings);
  }, []);

  const clearApiSettings = useCallback(async () => {
    profileGenerationRef.current += 1;
    profileQueueRef.current = null;
    profileControllerRef.current?.abort();
    setApiSettingsState(emptyApiSettings);
    setAiEnabledState(false);
    setProfileEnabledState(false);
    await Promise.all([
      removeValue(storageKeys.api),
      removeValue(storageKeys.aiEnabled),
      removeValue(storageKeys.profileEnabled),
    ]);
  }, []);

  const saveAsrSettings = useCallback(async (settings: AsrSettings) => {
    setAsrSettingsState(settings);
    await writeJson(storageKeys.asr, settings);
  }, []);

  const clearAsrSettings = useCallback(async () => {
    setAsrSettingsState(emptyAsrSettings);
    await removeValue(storageKeys.asr);
  }, []);

  const setAiEnabled = useCallback(async (enabled: boolean) => {
    if (!enabled) {
      profileGenerationRef.current += 1;
      profileQueueRef.current = null;
      profileControllerRef.current?.abort();
      setProfileStatus({ state: 'idle', message: 'AI 已关闭；持续画像不会发起新请求' });
      setProfileEnabledState(false);
      await writeJson(storageKeys.profileEnabled, false);
    }
    setAiEnabledState(enabled);
    await writeJson(storageKeys.aiEnabled, enabled);
  }, []);

  const setProfileEnabled = useCallback(async (enabled: boolean) => {
    if (!enabled) {
      profileGenerationRef.current += 1;
      profileQueueRef.current = null;
      profileControllerRef.current?.abort();
      setProfileStatus({ state: 'idle', message: '持续画像已关闭；本机已有结果仍保留' });
    } else {
      setProfileStatus({ state: 'idle', message: '持续画像已启用，等待新的可用线索' });
    }
    setProfileEnabledState(enabled);
    await writeJson(storageKeys.profileEnabled, enabled);
  }, []);

  const refreshProfile = useCallback(async (reason = 'interaction', extraTexts: ProfileTextEvidence[] = []) => {
    if (!ready || !aiEnabled || !profileEnabled || !apiSettings.apiKey.trim()) return;
    if (profileRunRef.current) {
      profileQueueRef.current = { reason, extraTexts };
      setProfileStatus({ state: 'queued', message: '新变化已合并到下一次画像更新' });
      await profileRunRef.current;
      return;
    }

    const texts: ProfileTextEvidence[] = [
      ...notes.slice(0, 12).filter((note) => note.text.trim()).map((note) => ({
        source_id: `quick-note:${note.id}`,
        source: note.voiceDuration ? 'voice_transcript' : 'note',
        content: note.text.trim().slice(0, 1_200),
      })),
      ...echoes.slice(0, 8).filter((echo) => echo.text.trim()).map((echo) => ({
        source_id: `echo:${echo.id}`,
        source: 'future_echo',
        content: echo.text.trim().slice(0, 1_200),
      })),
      ...extraTexts.map((item) => ({ ...item, content: item.content.trim().slice(0, 1_200) })).filter((item) => item.content),
    ];
    const signals = cards.slice(0, 16).map((card) => ({
      source_id: `tidecard:${card.id}`,
      source: 'app_interaction',
      name: 'kept_tide_card',
      value: card.tide,
      context: card.quote,
    }));
    const processedImageIds = new Set(profileRef.current?.profile.multimodal_observations.flatMap((item) => item.source_ids) ?? []);
    const images = notes.filter((note) => note.hasImage && note.imageUri && note.imageRightsConfirmed && !processedImageIds.has(`quick-note-image:${note.id}`)).slice(0, 4).map((note) => ({
      source_id: `quick-note-image:${note.id}`,
      uri: note.imageUri!,
      description: '用户主动提交的图片闪念；只读取明确文字、作品、物体和语境，不根据人脸、身体、穿着或外貌推断心理属性。',
    }));
    if (!texts.length && !signals.length && !images.length) {
      setProfileStatus({ state: 'idle', message: '目前没有新的可用线索' });
      return;
    }
    const fingerprint = evidenceFingerprint({ texts, signals, image_source_ids: images.map((image) => image.source_id) });
    if (fingerprint === profileRef.current?.last_evidence_fingerprint) {
      setProfileStatus({ state: 'idle', message: '画像已是最新，没有重复发送相同线索' });
      return;
    }

    const generation = profileGenerationRef.current;
    const controller = new AbortController();
    profileControllerRef.current = controller;
    const focus: Record<string, string> = {
      notes: '根据用户主动提供的闪念和已确认语音转写更新暂时性画像；转写可能有误，只给出可供确认的主题线索。',
      chat: '结合用户主动发送的近期对话表达更新沟通偏好、当下需要和低负担行动。',
      choices: '结合结构化选择信号更新暂时性画像；不要把卡片选择解释为人格测评。',
      action: '结合用户主动选择或跳过的微行动更新可执行偏好。',
      interaction: '用用户主动保存的近期材料形成连续但可修正的暂时性反思画像。',
    };
    const payload: ProfileEvidencePayload = {
      locale: 'zh-CN',
      analysis_focus: focus[reason] ?? focus.interaction,
      texts,
      signals,
      images,
      previous_profile_context: profileContextForModel(profileRef.current),
    };
    setProfileStatus({ state: 'updating', message: '正在后台更新本机连续画像…' });
    const run = (async () => {
      try {
        const response = await analyzeProfile(apiSettings, payload, controller.signal);
        if (generation !== profileGenerationRef.current || controller.signal.aborted) return;
        const safety = response.profile?.safety_notice?.level;
        if (safety && safety !== 'not_indicated') {
          setProfileStatus({ state: 'safety', message: '普通画像更新已暂停，请先查看安全支持说明' });
          return;
        }
        const next = sanitizeProfileEnvelope(response, fingerprint, profileRef.current);
        profileRef.current = next;
        setProfile(next);
        await writeJson(storageKeys.profile, next);
        setProfileStatus({ state: 'ready', message: '画像已更新；本机只保存文字化观察' });
      } catch (error) {
        if (controller.signal.aborted || generation !== profileGenerationRef.current) return;
        setProfileStatus({ state: 'error', message: error instanceof Error ? error.message : '画像更新暂时失败' });
      } finally {
        profileControllerRef.current = null;
      }
    })();
    profileRunRef.current = run;
    await run;
    if (profileRunRef.current === run) profileRunRef.current = null;
    const queued = profileQueueRef.current;
    profileQueueRef.current = null;
    if (queued && generation === profileGenerationRef.current) {
      Promise.resolve().then(() => refreshProfileRef.current(queued.reason, queued.extraTexts));
    }
  }, [aiEnabled, apiSettings, cards, echoes, notes, profileEnabled, ready]);
  refreshProfileRef.current = refreshProfile;

  const clearProfile = useCallback(async () => {
    profileGenerationRef.current += 1;
    profileQueueRef.current = null;
    profileControllerRef.current?.abort();
    profileRef.current = null;
    setProfile(null);
    setProfileStatus({ state: 'idle', message: '本机连续画像已删除' });
    await removeValue(storageKeys.profile);
  }, []);

  const clearNotes = useCallback(async () => {
    setNotes([]);
    await removeValue(storageKeys.notes);
    await forgetProfileSources(notes.flatMap((note) => [`quick-note:${note.id}`, `quick-note-image:${note.id}`]));
  }, [forgetProfileSources, notes]);

  const clearCards = useCallback(async () => {
    setCards([]);
    await removeValue(storageKeys.cards);
    await forgetProfileSources(cards.map((card) => `tidecard:${card.id}`));
  }, [cards, forgetProfileSources]);

  const clearEchoes = useCallback(async () => {
    setEchoes([]);
    await removeValue(storageKeys.echoes);
    await forgetProfileSources(echoes.map((echo) => `echo:${echo.id}`));
  }, [echoes, forgetProfileSources]);

  const clearLocalData = useCallback(async () => {
    await Promise.all([
      removeValue(storageKeys.notes),
      removeValue(storageKeys.cards),
      removeValue(storageKeys.echoes),
      removeValue(storageKeys.answer),
    ]);
    setNotes([]);
    setCards([]);
    setEchoes([]);
    setAnswerRecord(null);
  }, []);

  useEffect(() => {
    if (!ready || !aiEnabled || !profileEnabled || !apiSettings.apiKey.trim()) return;
    const timer = setTimeout(() => void refreshProfile('interaction'), 700);
    return () => clearTimeout(timer);
  }, [aiEnabled, apiSettings.apiKey, cards, echoes, notes, profileEnabled, ready, refreshProfile]);

  const answer =
    answerRecord?.day === todayKey() ? answerBookCards[answerRecord.index] ?? null : null;

  const value = useMemo<AppStateValue>(
    () => ({
      ready,
      notes,
      cards,
      echoes,
      answer,
      apiSettings,
      asrSettings,
      aiEnabled,
      profileEnabled,
      profile,
      profileStatus,
      addNote,
      removeNote,
      collectCard,
      removeCard,
      addEcho,
      removeEcho,
      drawAnswer,
      saveApiSettings,
      clearApiSettings,
      saveAsrSettings,
      clearAsrSettings,
      setAiEnabled,
      setProfileEnabled,
      refreshProfile,
      clearProfile,
      clearNotes,
      clearCards,
      clearEchoes,
      clearLocalData,
    }),
    [
      ready,
      notes,
      cards,
      echoes,
      answer,
      apiSettings,
      asrSettings,
      aiEnabled,
      profileEnabled,
      profile,
      profileStatus,
      addNote,
      removeNote,
      collectCard,
      removeCard,
      addEcho,
      removeEcho,
      drawAnswer,
      saveApiSettings,
      clearApiSettings,
      saveAsrSettings,
      clearAsrSettings,
      setAiEnabled,
      setProfileEnabled,
      refreshProfile,
      clearProfile,
      clearNotes,
      clearCards,
      clearEchoes,
      clearLocalData,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const value = useContext(AppStateContext);
  if (!value) throw new Error('useAppState must be used inside AppStateProvider');
  return value;
}
