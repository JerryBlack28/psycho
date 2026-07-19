import type { ProfileAction, ProfileEnvelope, ProfileInsight, ReflectiveProfile } from '@/types';

export const PROFILE_STORAGE_KEY = 'xinchao.reflective-profile.v2';
const PIPELINE_META = /(本次没有新增|第一人称近况|此前获授权|此前摘要|主要依据仍是|用于画像的|较稳妥的更新|延续轻量|把是否展开|交给用户决定)/;

function compact(value: unknown, maxLength = 1_200, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLength) || fallback;
}

function cleanText(value: unknown, fallback = '') {
  const text = compact(value, 1_600);
  if (!text) return fallback;
  const kept = text.split(/(?<=[。！？!?])\s*/).filter((sentence) => !PIPELINE_META.test(sentence));
  return compact(kept.join(''), 1_200, fallback);
}

function unique(items: unknown, limit: number, maxLength = 160) {
  const result: string[] = [];
  (Array.isArray(items) ? items : []).forEach((item) => {
    const value = compact(item, maxLength);
    if (value && !result.includes(value)) result.push(value);
  });
  return result.slice(0, limit);
}

function insight(value: any): ProfileInsight | null {
  const title = cleanText(value?.title);
  if (!title) return null;
  return {
    title: title.slice(0, 120),
    description: cleanText(value?.description).slice(0, 500),
    confidence: ['low', 'medium', 'high'].includes(value?.confidence) ? value.confidence : 'low',
    uncertainty: cleanText(value?.uncertainty).slice(0, 300),
    evidence_source_ids: unique(value?.evidence_source_ids ?? value?.evidence?.map((item: any) => item?.source_id), 6, 100),
  };
}

function insights(value: unknown) {
  return (Array.isArray(value) ? value : []).map(insight).filter((item): item is ProfileInsight => Boolean(item)).slice(0, 4);
}

function action(value: any): ProfileAction | null {
  const next = cleanText(value?.action);
  if (!next) return null;
  return {
    title: cleanText(value?.title, '一小步').slice(0, 100),
    action: next.slice(0, 220),
    rationale: cleanText(value?.rationale).slice(0, 300),
  };
}

export function validProfileEnvelope(value: unknown): value is ProfileEnvelope {
  const envelope = value as ProfileEnvelope | null;
  return Boolean(envelope?.local_profile_version === '2.0' && envelope.profile_id && envelope.generated_at && envelope.profile?.headline && envelope.profile?.summary);
}

export function sanitizeProfileEnvelope(response: any, fingerprint: string, previous: ProfileEnvelope | null): ProfileEnvelope {
  const raw = response?.profile ?? response;
  const profile: ReflectiveProfile = {
    analysis_status: raw?.analysis_status === 'sufficient' ? 'sufficient' : 'limited',
    headline: cleanText(raw?.headline, '一份仍可继续修正的当下观察').slice(0, 120),
    summary: cleanText(raw?.summary, '这份暂时性画像会随着你之后主动提供的线索继续修正。').slice(0, 1_200),
    current_state: insights(raw?.current_state),
    recurring_patterns: insights(raw?.recurring_patterns),
    strengths_and_resources: insights(raw?.strengths_and_resources),
    needs_and_preferences: insights(raw?.needs_and_preferences),
    multimodal_observations: (Array.isArray(raw?.multimodal_observations) ? raw.multimodal_observations : []).map((item: any) => ({
      source_ids: unique(item?.source_ids, 4, 100),
      modality: item?.modality === 'cross_modal' ? 'cross_modal' as const : 'image' as const,
      observation: cleanText(item?.observation).slice(0, 600),
      contribution_to_profile: cleanText(item?.contribution_to_profile).slice(0, 600),
      uncertainty: cleanText(item?.uncertainty).slice(0, 300),
    })).filter((item: any) => item.observation && item.contribution_to_profile).slice(0, 8),
    communication_preferences: unique(raw?.communication_preferences, 5),
    gentle_actions: (Array.isArray(raw?.gentle_actions) ? raw.gentle_actions : []).map(action).filter((item: ProfileAction | null): item is ProfileAction => Boolean(item)).slice(0, 4),
    reflection_questions: unique(raw?.reflection_questions, 4, 220),
    uncertainties: unique(raw?.uncertainties, 6, 240),
    safety_notice: raw?.safety_notice && ['not_indicated', 'urgent_support_recommended', 'immediate_danger'].includes(raw.safety_notice.level)
      ? { level: raw.safety_notice.level, message: compact(raw.safety_notice.message, 500) }
      : { level: 'not_indicated', message: '' },
  };
  const previousModalities = previous?.modalities_used ?? [];
  return {
    local_profile_version: '2.0',
    profile_id: compact(response?.profile_id, 120, previous?.profile_id ?? `profile-${Date.now()}`),
    generated_at: compact(response?.generated_at, 80, new Date().toISOString()),
    model: compact(response?.model, 120, previous?.model ?? 'unknown'),
    modalities_used: unique([...previousModalities, ...(Array.isArray(response?.modalities_used) ? response.modalities_used : ['text', 'app_signal'])], 4, 30),
    last_evidence_fingerprint: fingerprint,
    profile,
  };
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().filter((key) => record[key] !== undefined).map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`;
}

export function evidenceFingerprint(value: unknown) {
  const text = stableSerialize(value);
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ (code + index), 0x85ebca6b);
  }
  return `v1-${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`;
}

export function profileContextForModel(envelope: ProfileEnvelope | null) {
  if (!envelope) return null;
  return {
    profile_id: envelope.profile_id,
    generated_at: envelope.generated_at,
    modalities_used: envelope.modalities_used,
    profile: envelope.profile,
  };
}

export function deriveProfileActions(envelope: ProfileEnvelope | null) {
  return (envelope?.profile.gentle_actions ?? []).slice(0, 3).map((item, index) => ({
    id: `profile-action-${index}`,
    label: item.action,
    title: item.title,
    rationale: item.rationale,
  }));
}

export function deriveProfileReport(envelope: ProfileEnvelope | null) {
  if (!envelope) return null;
  const profile = envelope.profile;
  const actions = deriveProfileActions(envelope);
  if (!actions.length) return null;
  const basis = [...profile.current_state, ...profile.needs_and_preferences, ...profile.strengths_and_resources].map((item) => item.title).filter((item, index, all) => all.indexOf(item) === index).slice(0, 2);
  return {
    headline: profile.headline,
    basis: basis.length ? basis : ['来自最近一次授权画像'],
    quote: profile.reflection_questions[0] || '今天只带走一个足够小的下一步。',
    summary: profile.summary,
    suggestions: actions.map((item) => [item.title, item.label] as [string, string]),
    dominant: 'profile',
    mode: envelope.modalities_used.includes('image') ? '多模态画像日报 · 本机' : 'AI 画像日报 · 本机',
  };
}

export function scrubProfileSources(envelope: ProfileEnvelope | null, sourceIds: string[]) {
  if (!envelope || !sourceIds.length) return envelope;
  const removed = new Set(sourceIds);
  const scrubInsights = (items: ProfileInsight[]) => items.map((item) => {
    const evidence = item.evidence_source_ids.filter((id) => !removed.has(id));
    return item.evidence_source_ids.length && !evidence.length ? null : { ...item, evidence_source_ids: evidence };
  }).filter((item): item is ProfileInsight => Boolean(item));
  return {
    ...envelope,
    last_evidence_fingerprint: null,
    profile: {
      ...envelope.profile,
      current_state: scrubInsights(envelope.profile.current_state),
      recurring_patterns: scrubInsights(envelope.profile.recurring_patterns),
      strengths_and_resources: scrubInsights(envelope.profile.strengths_and_resources),
      needs_and_preferences: scrubInsights(envelope.profile.needs_and_preferences),
      multimodal_observations: envelope.profile.multimodal_observations.filter((item) => !item.source_ids.some((id) => removed.has(id))),
      uncertainties: unique([...envelope.profile.uncertainties, '用户已删除部分来源，相关观察已从本机画像中移除；整体总结将在下一次更新时继续修正。'], 6, 240),
    },
  };
}
