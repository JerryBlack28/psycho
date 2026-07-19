import { AUDIO_TARGETS, AudioCaptureError, BrowserPcmCapture } from '@/lib/audio-capture.web';
import type { AsrSettings } from '@/types';

const ASR_ENDPOINT = 'wss://office-api-ast-dx.iflyaisol.com/ast/communicate/v1';
const READY_TIMEOUT = 10_000;
const FINAL_TIMEOUT = 7_000;
const MAX_BUFFERED = 256 * 1024;
const MAX_FRAMES = 50;

export type TranscriptSnapshot = { text: string; confirmedText: string; interimText: string };
type ParsedEvent =
  | { kind: 'noop' }
  | { kind: 'started'; sessionId: string }
  | ({ kind: 'result'; segmentId: number; finalSegment: boolean; finalSession: boolean } & TranscriptSnapshot)
  | { kind: 'error'; error: AsrError };

export class AsrError extends Error {
  code: string;
  retryable: boolean;
  details?: { provider_code?: string };

  constructor(message: string, code = 'asr_error', retryable = false, options?: ErrorOptions & { details?: { provider_code?: string } }) {
    super(message, options);
    this.name = 'AsrError';
    this.code = code;
    this.retryable = retryable;
    this.details = options?.details;
  }
}

function normalizedSettings(value: AsrSettings) {
  const settings = {
    appId: value?.appId?.trim().slice(0, 80) ?? '',
    apiKey: value?.apiKey?.trim().slice(0, 256) ?? '',
    apiSecret: value?.apiSecret?.trim().slice(0, 256) ?? '',
  };
  if (!settings.appId || !settings.apiKey || !settings.apiSecret) {
    throw new AsrError('请完整填写 APPID、APIKey 和 APISecret', 'asr_not_configured');
  }
  if (Object.values(settings).some((credential) => /[\r\n\0]/.test(credential))) {
    throw new AsrError('语音转写凭据格式无效', 'invalid_asr_settings');
  }
  return settings;
}

export function formatBeijingTimestamp(value = new Date()) {
  const beijing = new Date(value.getTime() + 8 * 60 * 60 * 1000);
  const part = (number: number) => String(number).padStart(2, '0');
  return `${beijing.getUTCFullYear()}-${part(beijing.getUTCMonth() + 1)}-${part(beijing.getUTCDate())}T${part(beijing.getUTCHours())}:${part(beijing.getUTCMinutes())}:${part(beijing.getUTCSeconds())}+0800`;
}

function encode(value: unknown) {
  return encodeURIComponent(String(value)).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function query(parameters: Record<string, string>) {
  return Object.entries(parameters).sort(([left], [right]) => left.localeCompare(right, 'en')).map(([key, value]) => `${encode(key)}=${encode(value)}`).join('&');
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

export async function buildAsrWebSocketUrl(settingsInput: AsrSettings, now = new Date(), uuid: string = crypto.randomUUID()) {
  const settings = normalizedSettings(settingsInput);
  const parameters = {
    accessKeyId: settings.apiKey,
    appId: settings.appId,
    audio_encode: 'pcm_s16le',
    lang: 'autodialect',
    samplerate: String(AUDIO_TARGETS.sampleRate),
    utc: formatBeijingTimestamp(now),
    uuid,
  };
  if (!crypto.subtle) throw new AsrError('当前环境不支持语音鉴权签名', 'web_crypto_unsupported');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(settings.apiSecret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const signature = bytesToBase64(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(query(parameters)))));
  return `${ASR_ENDPOINT}?${query({ ...parameters, signature })}`;
}

function maybeJson(value: unknown): any {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
}

function providerError(message: any, data: any) {
  const code = String(message?.code || data?.code || data?.detail?.code || 'provider_error');
  return new AsrError(message?.desc || data?.desc || data?.message || '讯飞语音服务返回异常', `xfyun_${code}`, !/^(35001|35002|35004|35005|35010|35017|35022|35031|100002|100013|100016|100019|100020)$/.test(code), { details: { provider_code: code } });
}

export function parseAsrServerMessage(raw: unknown): ParsedEvent {
  const message = maybeJson(raw);
  if (!message || typeof message !== 'object') return { kind: 'noop' };
  const data = maybeJson(message.data);
  const code = String(message.code ?? '0');
  const dataCode = String(data?.code ?? '0');
  if (code !== '0' || dataCode !== '0' || message.action === 'error' || (message.res_type === 'frc' && data?.normal === false)) {
    return { kind: 'error', error: providerError(message, data) };
  }
  const sessionId = data?.sessionId || message.sessionId || message.sid;
  if (message.action === 'started' || (message.msg_type === 'action' && sessionId)) return { kind: 'started', sessionId: String(sessionId || '') };
  if (message.res_type !== 'asr' && !data?.cn?.st) return { kind: 'noop' };
  const sentence = data?.cn?.st ?? {};
  const text = (Array.isArray(sentence.rt) ? sentence.rt : []).flatMap((turn: any) => Array.isArray(turn?.ws) ? turn.ws : []).map((word: any) => Array.isArray(word?.cw) ? word.cw[0]?.w : '').filter((word: unknown) => typeof word === 'string').join('');
  return {
    kind: 'result',
    segmentId: Number.isFinite(Number(data?.seg_id)) ? Number(data.seg_id) : 0,
    text,
    confirmedText: '',
    interimText: '',
    finalSegment: String(sentence.type) === '0',
    finalSession: data?.ls === true,
  };
}

class TranscriptAccumulator {
  private segments = new Map<number, { text: string; final: boolean }>();

  apply(event: Extract<ParsedEvent, { kind: 'result' }>) {
    const previous = this.segments.get(event.segmentId);
    if (!previous?.final || event.finalSegment) this.segments.set(event.segmentId, { text: event.text, final: event.finalSegment });
    return this.snapshot();
  }

  snapshot(): TranscriptSnapshot {
    const ordered = [...this.segments.entries()].sort(([left], [right]) => left - right);
    return {
      text: ordered.map(([, segment]) => segment.text).join(''),
      confirmedText: ordered.filter(([, segment]) => segment.final).map(([, segment]) => segment.text).join(''),
      interimText: ordered.filter(([, segment]) => !segment.final).map(([, segment]) => segment.text).join(''),
    };
  }
}

export async function testAsrConnection(settings: AsrSettings) {
  const url = await buildAsrWebSocketUrl(settings);
  return new Promise<string>((resolve, reject) => {
    const socket = new WebSocket(url);
    let settled = false;
    const finish = (error?: Error, sessionId = '') => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close();
      if (error) reject(error); else resolve(sessionId);
    };
    const timer = setTimeout(() => finish(new AsrError('语音服务连接测试超时', 'asr_ready_timeout', true)), READY_TIMEOUT);
    socket.onmessage = (event) => {
      const parsed = parseAsrServerMessage(event.data);
      if (parsed.kind === 'error') finish(parsed.error);
      if (parsed.kind === 'started') finish(undefined, parsed.sessionId);
    };
    socket.onerror = () => finish(new AsrError('语音服务连接失败', 'asr_socket_error', true));
    socket.onclose = () => finish(new AsrError('语音服务在完成测试前关闭了连接', 'asr_socket_closed', true));
  });
}

type SessionOptions = {
  settings: AsrSettings;
  onState?: (state: string) => void;
  onTranscript?: (snapshot: TranscriptSnapshot) => void;
  onError?: (error: AsrError) => void;
};

export class RealtimeAsrSession {
  private state = 'idle';
  private socket: WebSocket | null = null;
  private capture: BrowserPcmCapture | null = null;
  private queue: Uint8Array[] = [];
  private pump: ReturnType<typeof setInterval> | null = null;
  private accumulator = new TranscriptAccumulator();
  private sent = 0;
  private uuid = '';
  private sessionId = '';
  private readyResolve?: () => void;
  private readyReject?: (error: Error) => void;
  private finalResolve?: (snapshot: TranscriptSnapshot) => void;
  private closing = false;

  constructor(private readonly options: SessionOptions) {}

  private setState(state: string) {
    this.state = state;
    this.options.onState?.(state);
  }

  private enqueue(frame: Uint8Array) {
    if (!frame.length || !['recording', 'stopping'].includes(this.state)) return;
    if (this.queue.length >= MAX_FRAMES) {
      void this.fail(new AsrError('页面暂时无法实时发送音频，请重新开始', 'asr_audio_backpressure', true));
      return;
    }
    this.queue.push(frame);
  }

  private send(frame: Uint8Array) {
    if (this.socket?.readyState !== WebSocket.OPEN || this.socket.bufferedAmount > MAX_BUFFERED) return false;
    this.socket.send(frame.buffer.slice(frame.byteOffset, frame.byteOffset + frame.byteLength));
    this.sent += 1;
    return true;
  }

  async start() {
    if (this.state !== 'idle') return;
    normalizedSettings(this.options.settings);
    this.capture = new BrowserPcmCapture((frame) => this.enqueue(frame));
    try {
      this.setState('permission');
      await this.capture.acquire();
      this.uuid = crypto.randomUUID();
      const url = await buildAsrWebSocketUrl(this.options.settings, new Date(), this.uuid);
      this.setState('connecting');
      const ready = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new AsrError('语音服务连接超时', 'asr_ready_timeout', true)), READY_TIMEOUT);
        this.readyResolve = () => { clearTimeout(timer); resolve(); };
        this.readyReject = (error) => { clearTimeout(timer); reject(error); };
      });
      this.socket = new WebSocket(url);
      this.socket.binaryType = 'arraybuffer';
      this.socket.onmessage = (event) => this.handleMessage(event.data);
      this.socket.onerror = () => void this.fail(new AsrError('语音服务连接失败', 'asr_socket_error', true));
      this.socket.onclose = () => {
        if (!this.closing && !['closed', 'cancelled', 'error'].includes(this.state)) void this.fail(new AsrError('语音服务连接已中断', 'asr_socket_closed', true));
      };
      await ready;
      await this.capture.start();
      this.setState('recording');
      this.pump = setInterval(() => {
        if (this.queue[0] && this.send(this.queue[0])) this.queue.shift();
      }, AUDIO_TARGETS.frameDurationMs);
    } catch (error) {
      const normalized = error instanceof AsrError ? error : error instanceof AudioCaptureError ? new AsrError(error.message, error.code, false, { cause: error }) : new AsrError('无法启动实时语音转写', 'asr_start_failed', true, { cause: error });
      await this.fail(normalized);
      throw normalized;
    }
  }

  private handleMessage(raw: unknown) {
    const event = parseAsrServerMessage(raw);
    if (event.kind === 'error') { void this.fail(event.error); return; }
    if (event.kind === 'started') {
      this.sessionId = event.sessionId || this.uuid;
      this.readyResolve?.();
      this.readyResolve = undefined;
      this.readyReject = undefined;
      return;
    }
    if (event.kind === 'result') {
      const snapshot = this.accumulator.apply(event);
      this.options.onTranscript?.(snapshot);
      if (event.finalSession) this.finalResolve?.(snapshot);
    }
  }

  async stop() {
    try {
      return await this.stopGracefully();
    } catch (error) {
      const normalized = error instanceof AsrError ? error : new AsrError('无法结束实时语音转写', 'asr_stop_failed', true, { cause: error });
      await this.fail(normalized);
      throw normalized;
    }
  }

  private async stopGracefully() {
    if (!['recording', 'stopping'].includes(this.state)) return this.accumulator.snapshot();
    this.setState('stopping');
    if (this.pump) clearInterval(this.pump);
    this.pump = null;
    const tail = await this.capture?.stop(true);
    if (tail?.length) this.queue.push(tail);
    const deadline = Date.now() + 5_000;
    while (this.queue.length && this.socket?.readyState === WebSocket.OPEN && Date.now() < deadline) {
      if (this.send(this.queue[0])) this.queue.shift();
      await new Promise((resolve) => setTimeout(resolve, AUDIO_TARGETS.frameDurationMs));
    }
    if (this.queue.length) throw new AsrError('音频发送队列未能及时排空', 'asr_audio_backpressure', true);
    if (!this.sent || this.socket?.readyState !== WebSocket.OPEN) {
      await this.close('closed');
      return this.accumulator.snapshot();
    }
    this.setState('awaiting_final');
    this.socket.send(JSON.stringify({ end: true, sessionId: this.sessionId || this.uuid }));
    const snapshot = await new Promise<TranscriptSnapshot>((resolve) => {
      const timer = setTimeout(() => resolve(this.accumulator.snapshot()), FINAL_TIMEOUT);
      this.finalResolve = (value) => { clearTimeout(timer); resolve(value); };
    });
    await this.close('closed');
    return snapshot;
  }

  async cancel() {
    this.readyReject?.(new AsrError('语音转写已取消', 'asr_cancelled'));
    this.finalResolve?.(this.accumulator.snapshot());
    await this.close('cancelled');
  }

  private async fail(error: AsrError) {
    if (this.state === 'error' || this.closing) return;
    this.readyReject?.(error);
    this.finalResolve?.(this.accumulator.snapshot());
    this.setState('error');
    this.options.onError?.(error);
    await this.close('error', true);
  }

  private async close(state: string, preserveState = false) {
    this.closing = true;
    if (this.pump) clearInterval(this.pump);
    this.pump = null;
    this.queue = [];
    await this.capture?.stop(false);
    this.capture = null;
    if (this.socket) {
      this.socket.onmessage = null;
      this.socket.onerror = null;
      this.socket.onclose = null;
      this.socket.close();
    }
    this.socket = null;
    if (!preserveState) this.setState(state);
    this.closing = false;
  }
}

export function asrErrorMessage(error: unknown) {
  if (!(error instanceof AsrError)) return '实时语音转写暂时不可用';
  const code = error.details?.provider_code ?? '';
  if (/^(35001|35004|35010|35017|100002|100013|100016|100020)$/.test(code)) return '讯飞语音凭据或签名无效，请检查环境配置';
  if (/^(35002|35006|35022|37002)$/.test(code)) return '讯飞语音额度或并发暂时不可用';
  return error.message;
}
