import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import React, { createContext, useContext, useEffect, useMemo, type PropsWithChildren } from 'react';

const rain = require('../../prototype/assets/sleepy-rain.mp3');

type AmbientAudioValue = { playing: boolean; toggle: () => void };
const AmbientAudioContext = createContext<AmbientAudioValue | null>(null);

export function AmbientAudioProvider({ children }: PropsWithChildren) {
  const player = useAudioPlayer(rain, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);
  useEffect(() => {
    player.loop = true;
    player.volume = 0.38;
  }, [player]);
  const value = useMemo(() => ({
    playing: status.playing,
    toggle: () => status.playing ? player.pause() : player.play(),
  }), [player, status.playing]);
  return <AmbientAudioContext.Provider value={value}>{children}</AmbientAudioContext.Provider>;
}

export function useAmbientAudio() {
  const value = useContext(AmbientAudioContext);
  if (!value) throw new Error('useAmbientAudio must be used inside AmbientAudioProvider');
  return value;
}
