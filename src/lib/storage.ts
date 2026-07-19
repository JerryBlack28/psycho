import AsyncStorage from '@react-native-async-storage/async-storage';

export const storageKeys = {
  notes: 'xinchao.quick-notes.v2',
  cards: 'xinchao.tide-cards.v2',
  echoes: 'xinchao.future-echoes.v2',
  answer: 'xinchao.answer-book.v2',
  api: 'xinchao.custom-api.v2',
  aiEnabled: 'xinchao.ai-enabled.v2',
  profileEnabled: 'xinchao.profile-enabled.v2',
  profile: 'xinchao.reflective-profile.v2',
  asr: 'xinchao.custom-asr.v2',
  onboarding: 'xinchao.onboarding.v2',
} as const;

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function writeJson<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function removeValue(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}

export function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
