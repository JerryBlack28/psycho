import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '@/global.css';
import { AppFrame } from '@/components/app-frame';
import { useAppTheme } from '@/constants/theme';
import { AppStateProvider } from '@/providers/app-state';
import { AmbientAudioProvider } from '@/providers/ambient-audio';

export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = useAppTheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AmbientAudioProvider>
            <AppStateProvider>
              <AppFrame>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    animation: 'slide_from_right',
                    contentStyle: { backgroundColor: theme.background },
                  }}>
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="daily-report" />
                  <Stack.Screen name="chapter" />
                  <Stack.Screen name="cards" />
                  <Stack.Screen name="echoes" />
                </Stack>
              </AppFrame>
              <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
            </AppStateProvider>
          </AmbientAudioProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
