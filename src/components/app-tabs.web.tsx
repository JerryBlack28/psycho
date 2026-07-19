import { Tabs, TabList, TabSlot, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { MicIcon } from '@/components/icons';
import { useAppTheme } from '@/constants/theme';

export default function AppTabs() {
  const theme = useAppTheme();
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList style={styles.tabList}>
        <TabTrigger name="home" href="/" asChild>
          <WebTab label="今天" symbol="◐" />
        </TabTrigger>
        <TabTrigger name="thoughts" href="/thoughts" asChild>
          <WebTab label="闪念" symbol="＋" />
        </TabTrigger>
        <TabTrigger name="chat" href="/chat" asChild>
          <WebTab label="对话" symbol="mic" />
        </TabTrigger>
        <TabTrigger name="profile" href="/profile" asChild>
          <WebTab label="我的" symbol="○" />
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}

function WebTab({ label, symbol, isFocused, ...props }: TabTriggerSlotProps & { label: string; symbol: string }) {
  const theme = useAppTheme();
  return (
    <Pressable
      {...props}
      style={({ pressed }) => [
        styles.tabButton,
        isFocused ? styles.tabButtonFocused : null,
        pressed ? styles.pressed : null,
      ]}>
      {symbol === 'mic'
        ? <MicIcon color={isFocused ? '#F0DDB1' : '#7F9389'} size={19} />
        : <Text style={[styles.symbol, { color: isFocused ? '#F0DDB1' : '#7F9389' }]}>{symbol}</Text>}
      <Text style={[styles.label, { color: isFocused ? '#F0DDB1' : '#7F9389' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabList: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 12,
    height: 65,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.12)',
    backgroundColor: 'rgba(15,25,22,.94)',
    boxShadow: '0 13px 32px rgba(0,0,0,.24)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 7,
    zIndex: 60,
  },
  tabButton: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabButtonFocused: { backgroundColor: 'rgba(255,255,255,.07)' },
  symbol: { fontFamily: 'Georgia', fontSize: 18 },
  label: { fontSize: 9, fontWeight: '700' },
  pressed: { opacity: 0.65 },
});
