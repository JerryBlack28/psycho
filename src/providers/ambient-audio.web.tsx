import { Asset } from 'expo-asset';
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

const rain = require('../../prototype/assets/sleepy-rain.mp3');

type AmbientAudioValue = { playing: boolean; toggle: () => void };
const AmbientAudioContext = createContext<AmbientAudioValue | null>(null);

export function AmbientAudioProvider({ children }: PropsWithChildren) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (typeof Audio === 'undefined') return;

    const audio = new Audio(Asset.fromModule(rain).uri);
    audio.loop = true;
    audio.volume = 0.38;
    const handlePlay = () => setPlaying(true);
    const handlePause = () => setPlaying(false);

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handlePause);
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handlePause);
      audioRef.current = null;
    };
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      void audio.play().catch(() => setPlaying(false));
    } else {
      audio.pause();
    }
  }, []);

  const value = useMemo(() => ({ playing, toggle }), [playing, toggle]);
  return <AmbientAudioContext.Provider value={value}>{children}</AmbientAudioContext.Provider>;
}

export function useAmbientAudio() {
  const value = useContext(AmbientAudioContext);
  if (!value) throw new Error('useAmbientAudio must be used inside AmbientAudioProvider');
  return value;
}
