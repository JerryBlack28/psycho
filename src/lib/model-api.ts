import type { ApiSettings, ChatMessage } from '@/types';

const timeoutMs = 45_000;

function normalizeBaseUrl(value: string): string {
  const baseUrl = value.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(baseUrl)) {
    throw new Error('API 地址必须以 http:// 或 https:// 开头');
  }
  return baseUrl;
}

async function request(
  url: string,
  settings: ApiSettings,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const externalSignal = init.signal;
  const abortFromCaller = () => controller.abort();
  externalSignal?.addEventListener('abort', abortFromCaller, { once: true });
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${settings.apiKey.trim()}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('模型请求超时，请稍后再试');
    }
    throw new Error('无法连接模型服务；网页版还需要服务商允许 CORS');
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', abortFromCaller);
  }
}

export async function testApiSettings(settings: ApiSettings): Promise<string> {
  if (!settings.apiKey.trim() || !settings.model.trim()) {
    throw new Error('请填写 API Key 和模型名称');
  }
  const baseUrl = normalizeBaseUrl(settings.baseUrl);
  const response = await request(`${baseUrl}/models`, settings, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`模型服务返回 HTTP ${response.status}`);
  }
  return '连接成功；当前配置只保存在这台设备。';
}

export async function sendModelMessage(
  settings: ApiSettings,
  messages: ChatMessage[],
): Promise<string> {
  if (!settings.apiKey.trim()) throw new Error('请先在“我的”中配置 API');
  const baseUrl = normalizeBaseUrl(settings.baseUrl);
  const response = await request(`${baseUrl}/chat/completions`, settings, {
    method: 'POST',
    body: JSON.stringify({
      model: settings.model.trim(),
      temperature: 0.6,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content:
            '你是“潮伴”，提供简短、具体、非诊断性的中文情绪陪伴。先理解，再给至多一个低负担问题或小步骤。不得声称治疗、诊断或危机评估能力。',
        },
        ...messages.slice(-8).map(({ role, content }) => ({ role, content })),
      ],
    }),
  });

  const body = (await response.json().catch(() => null)) as
    | { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } }
    | null;
  if (!response.ok) {
    throw new Error(body?.error?.message || `模型服务返回 HTTP ${response.status}`);
  }
  const content = body?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('模型没有返回可显示的文字');
  return content;
}

export function containsCrisisLanguage(value: string): boolean {
  return /(自杀|不想活|结束生命|杀了自己|伤害自己|伤害别人|马上去死)/i.test(value);
}

const stringArray = (maxItems: number) => ({ type: 'array', items: { type: 'string' }, maxItems });
const insightSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    uncertainty: { type: 'string' },
    evidence_source_ids: stringArray(6),
  },
  required: ['title', 'description', 'confidence', 'uncertainty', 'evidence_source_ids'],
};
const profileSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    analysis_status: { type: 'string', enum: ['limited', 'sufficient'] },
    headline: { type: 'string' },
    summary: { type: 'string' },
    current_state: { type: 'array', items: insightSchema, maxItems: 4 },
    recurring_patterns: { type: 'array', items: insightSchema, maxItems: 4 },
    strengths_and_resources: { type: 'array', items: insightSchema, maxItems: 4 },
    needs_and_preferences: { type: 'array', items: insightSchema, maxItems: 4 },
    multimodal_observations: {
      type: 'array', maxItems: 8, items: {
        type: 'object', additionalProperties: false,
        properties: { source_ids: stringArray(4), modality: { type: 'string', enum: ['image', 'cross_modal'] }, observation: { type: 'string' }, contribution_to_profile: { type: 'string' }, uncertainty: { type: 'string' } },
        required: ['source_ids', 'modality', 'observation', 'contribution_to_profile', 'uncertainty'],
      },
    },
    communication_preferences: stringArray(5),
    gentle_actions: {
      type: 'array', maxItems: 4, items: {
        type: 'object', additionalProperties: false,
        properties: { title: { type: 'string' }, action: { type: 'string' }, rationale: { type: 'string' } },
        required: ['title', 'action', 'rationale'],
      },
    },
    reflection_questions: stringArray(4),
    uncertainties: stringArray(6),
    safety_notice: {
      type: 'object', additionalProperties: false,
      properties: { level: { type: 'string', enum: ['not_indicated', 'urgent_support_recommended', 'immediate_danger'] }, message: { type: 'string' } },
      required: ['level', 'message'],
    },
  },
  required: ['analysis_status', 'headline', 'summary', 'current_state', 'recurring_patterns', 'strengths_and_resources', 'needs_and_preferences', 'multimodal_observations', 'communication_preferences', 'gentle_actions', 'reflection_questions', 'uncertainties', 'safety_notice'],
};

export type ProfileEvidencePayload = {
  locale: string;
  analysis_focus: string;
  texts: Array<{ source_id: string; source: string; content: string }>;
  signals: Array<{ source_id: string; source: string; name: string; value: string; context?: string }>;
  images?: Array<{ source_id: string; uri: string; description: string }>;
  previous_profile_context: unknown;
};

function structuredContent(body: any) {
  const content = body?.choices?.[0]?.message?.content;
  const text = Array.isArray(content) ? content.map((part) => typeof part === 'string' ? part : part?.text).filter(Boolean).join('') : content;
  if (typeof text !== 'string') throw new Error('模型响应没有可读取的画像内容');
  const fenced = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  try {
    const parsed = JSON.parse(fenced?.[1] ?? text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    return parsed;
  } catch {
    throw new Error('模型没有返回有效的结构化画像 JSON');
  }
}

export async function analyzeProfile(
  settings: ApiSettings,
  payload: ProfileEvidencePayload,
  signal?: AbortSignal,
) {
  if (!settings.apiKey.trim()) throw new Error('请先在“我的”中配置 API');
  const baseUrl = normalizeBaseUrl(settings.baseUrl);
  const images = (payload.images ?? []).slice(0, 4);
  const imageParts = await Promise.all(images.map(async (image) => {
    const imageResponse = await fetch(image.uri);
    if (!imageResponse.ok) throw new Error('无法读取已选择的图片');
    const blob = await imageResponse.blob();
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('图片编码失败'));
      reader.onerror = () => reject(new Error('图片编码失败'));
      reader.readAsDataURL(blob);
    });
    return { type: 'image_url', image_url: { url, detail: settings.imageDetail } };
  }));
  const evidence = {
    task: '根据新证据更新一份可被用户纠正的连续画像。不要复述系统流程。',
    locale: payload.locale,
    analysis_focus: payload.analysis_focus,
    fresh_evidence: {
      texts: payload.texts,
      signals: payload.signals,
      image_contexts: images.map(({ source_id, description }) => ({ source_id, description })),
    },
    previous_profile_context: payload.previous_profile_context,
  };
  const response = await request(`${baseUrl}/chat/completions`, settings, {
    method: 'POST',
    signal,
    body: JSON.stringify({
      model: settings.model.trim(),
      messages: [
        {
          role: 'system',
          content: [
            '你是心潮的非诊断性反思画像助手。只返回符合 JSON Schema 的简体中文对象。',
            '只把 fresh_evidence 当作新证据；previous_profile_context 只用于连续性，不得伪装成用户本次陈述。',
            '每个判断都必须暂时、可修正、低负担，不得诊断、打分或贴人格标签。语音转写可能有误，不得根据声音特征推断。',
            '图片只可读取用户主动提供的文字、作品、物体和明确语境；禁止从脸、表情、身体、衣着或外貌推断情绪、人格或敏感属性。每张图片必须在 multimodal_observations 中引用对应 source_id。',
            '出现自伤、伤人或即时危险时只设置 safety_notice，不在普通画像中扩写危险细节。',
          ].join('\n'),
        },
        {
          role: 'user',
          content: imageParts.length ? [{ type: 'text', text: JSON.stringify(evidence) }, ...imageParts] : JSON.stringify(evidence),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'xinchao_reflective_profile', strict: true, schema: profileSchema },
      },
    }),
  });
  const body = await response.json().catch(() => null) as any;
  if (!response.ok) throw new Error(body?.error?.message || `模型服务返回 HTTP ${response.status}`);
  return {
    profile_id: `profile-${Date.now()}`,
    generated_at: new Date().toISOString(),
    model: settings.model.trim(),
    modalities_used: [payload.texts.length ? 'text' : '', payload.signals.length ? 'app_signal' : '', images.length ? 'image' : ''].filter(Boolean),
    processed_image_source_ids: images.map((image) => image.source_id),
    profile: structuredContent(body),
  };
}
