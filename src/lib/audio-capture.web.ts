const TARGET_SAMPLE_RATE = 16_000;
const PCM_FRAME_BYTES = 1_280;

export class AudioCaptureError extends Error {
  code: string;

  constructor(message: string, code = 'audio_capture_error', options?: ErrorOptions) {
    super(message, options);
    this.name = 'AudioCaptureError';
    this.code = code;
  }
}

function concatFloat32(first: Float32Array, second: Float32Array) {
  if (!first.length) return second.slice();
  const combined = new Float32Array(first.length + second.length);
  combined.set(first);
  combined.set(second, first.length);
  return combined;
}

function concatBytes(first: Uint8Array, second: Uint8Array) {
  if (!first.length) return second.slice();
  const combined = new Uint8Array(first.length + second.length);
  combined.set(first);
  combined.set(second, first.length);
  return combined;
}

export function float32ToPcm16(samples: ArrayLike<number>) {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  Array.from(samples).forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, Number(sample) || 0));
    const value = Math.round(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff);
    view.setInt16(index * 2, value, true);
  });
  return bytes;
}

export class StreamingPcm16Encoder {
  private readonly step: number;
  private buffer = new Float32Array(0);
  private position = 0;

  constructor(sourceSampleRate: number, targetSampleRate = TARGET_SAMPLE_RATE) {
    if (!Number.isFinite(sourceSampleRate) || sourceSampleRate <= 0) {
      throw new AudioCaptureError('无法确定麦克风采样率', 'invalid_sample_rate');
    }
    this.step = sourceSampleRate / targetSampleRate;
  }

  push(samples: Float32Array) {
    if (!samples.length) return new Uint8Array(0);
    this.buffer = concatFloat32(this.buffer, samples);
    const output: number[] = [];
    while (this.position + 1 < this.buffer.length) {
      const leftIndex = Math.floor(this.position);
      const fraction = this.position - leftIndex;
      output.push(this.buffer[leftIndex] + (this.buffer[leftIndex + 1] - this.buffer[leftIndex]) * fraction);
      this.position += this.step;
    }
    const consumed = Math.min(this.buffer.length, Math.floor(this.position + 1e-7));
    if (consumed) {
      this.buffer = this.buffer.slice(consumed);
      this.position = Math.max(0, this.position - consumed);
    }
    return float32ToPcm16(output);
  }

  flush() {
    const output: number[] = [];
    while (this.buffer.length && this.position < this.buffer.length) {
      const left = Math.min(this.buffer.length - 1, Math.floor(this.position));
      const right = Math.min(this.buffer.length - 1, left + 1);
      const fraction = this.position - left;
      output.push(this.buffer[left] + (this.buffer[right] - this.buffer[left]) * fraction);
      this.position += this.step;
    }
    this.buffer = new Float32Array(0);
    this.position = 0;
    return float32ToPcm16(output);
  }
}

export class PcmFrameChunker {
  private buffer = new Uint8Array(0);

  constructor(private readonly frameBytes = PCM_FRAME_BYTES) {}

  push(bytes: Uint8Array) {
    if (bytes.length) this.buffer = concatBytes(this.buffer, bytes);
    const frames: Uint8Array[] = [];
    while (this.buffer.length >= this.frameBytes) {
      frames.push(this.buffer.slice(0, this.frameBytes));
      this.buffer = this.buffer.slice(this.frameBytes);
    }
    return frames;
  }

  flush() {
    const remaining = this.buffer;
    this.buffer = new Uint8Array(0);
    return remaining;
  }
}

function microphoneError(error: unknown) {
  const name = error instanceof DOMException ? error.name : '';
  const known: Record<string, [string, string]> = {
    NotAllowedError: ['microphone_denied', '没有获得麦克风权限'],
    SecurityError: ['microphone_insecure', '麦克风只可在 HTTPS 或 localhost 使用'],
    NotFoundError: ['microphone_missing', '没有找到可用麦克风'],
    NotReadableError: ['microphone_busy', '麦克风正被其他应用占用'],
  };
  const [code, message] = known[name] ?? ['microphone_unavailable', '暂时无法使用麦克风'];
  return new AudioCaptureError(message, code, { cause: error });
}

export class BrowserPcmCapture {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private mute: GainNode | null = null;
  private encoder: StreamingPcm16Encoder | null = null;
  private chunker = new PcmFrameChunker();

  constructor(private readonly onFrame: (frame: Uint8Array) => void) {}

  async acquire() {
    if (globalThis.isSecureContext === false) {
      throw new AudioCaptureError('麦克风只可在 HTTPS 或 localhost 使用', 'microphone_insecure');
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new AudioCaptureError('当前浏览器不支持麦克风采集', 'microphone_unsupported');
    }
    if (this.stream) return this.stream;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      return this.stream;
    } catch (error) {
      throw microphoneError(error);
    }
  }

  async start() {
    await this.acquire();
    const AudioContextClass = globalThis.AudioContext;
    if (!AudioContextClass) throw new AudioCaptureError('当前浏览器不支持实时音频处理', 'audio_context_unsupported');
    try {
      this.context = new AudioContextClass({ latencyHint: 'interactive' });
      if (this.context.state === 'suspended') await this.context.resume();
      this.encoder = new StreamingPcm16Encoder(this.context.sampleRate);
      this.source = this.context.createMediaStreamSource(this.stream!);
      // ScriptProcessor is deliberately kept as a fallback-compatible path. It is the
      // same 40 ms PCM pipeline as the original prototype and works in the Expo export.
      this.processor = this.context.createScriptProcessor(2048, 1, 1);
      this.processor.onaudioprocess = (event) => {
        const bytes = this.encoder!.push(event.inputBuffer.getChannelData(0).slice());
        this.chunker.push(bytes).forEach(this.onFrame);
      };
      this.mute = this.context.createGain();
      this.mute.gain.value = 0;
      this.source.connect(this.processor);
      this.processor.connect(this.mute);
      this.mute.connect(this.context.destination);
    } catch (error) {
      await this.stop(false);
      if (error instanceof AudioCaptureError) throw error;
      throw new AudioCaptureError('无法启动实时音频处理', 'audio_start_failed', { cause: error });
    }
  }

  async stop(flush = true) {
    if (this.processor) this.processor.onaudioprocess = null;
    [this.source, this.processor, this.mute].forEach((node) => {
      try { node?.disconnect(); } catch { /* already disconnected */ }
    });
    this.source = null;
    this.processor = null;
    this.mute = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.context && this.context.state !== 'closed') await this.context.close().catch(() => undefined);
    this.context = null;
    if (!flush || !this.encoder) {
      this.encoder = null;
      this.chunker = new PcmFrameChunker();
      return new Uint8Array(0);
    }
    this.chunker.push(this.encoder.flush()).forEach(this.onFrame);
    const tail = this.chunker.flush();
    this.encoder = null;
    return tail;
  }
}

export const AUDIO_TARGETS = Object.freeze({ sampleRate: TARGET_SAMPLE_RATE, frameBytes: PCM_FRAME_BYTES, frameDurationMs: 40 });
