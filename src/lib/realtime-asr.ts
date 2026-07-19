import type { AsrSettings } from '@/types';

export type TranscriptSnapshot = { text: string; confirmedText: string; interimText: string };

export class AsrError extends Error {
  code: string;

  constructor(message: string, code = 'asr_error') {
    super(message);
    this.name = 'AsrError';
    this.code = code;
  }
}

export async function testAsrConnection(_settings: AsrSettings): Promise<string> {
  throw new AsrError('原生端尚无可用的实时 PCM 采集模块；请先在网页版测试讯飞连接。', 'native_pcm_unavailable');
}

export class RealtimeAsrSession {
  constructor(_options: {
    settings: AsrSettings;
    onState?: (state: string) => void;
    onTranscript?: (snapshot: TranscriptSnapshot) => void;
    onError?: (error: AsrError) => void;
  }) {}

  async start(): Promise<void> {
    throw new AsrError('原生端当前保留本机录音入口；实时讯飞转写请使用网页版。', 'native_pcm_unavailable');
  }

  async stop(): Promise<TranscriptSnapshot> {
    return { text: '', confirmedText: '', interimText: '' };
  }

  async cancel(): Promise<void> {}
}

export function asrErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '实时语音转写暂时不可用';
}
