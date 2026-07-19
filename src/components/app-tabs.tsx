import { NativeTabs } from 'expo-router/unstable-native-tabs';
import React from 'react';

import { useAppTheme } from '@/constants/theme';

export default function AppTabs() {
  const theme = useAppTheme();
  return (
    <NativeTabs
      backgroundColor={theme.tab}
      tintColor={theme.accent}
      labelStyle={{ selected: { color: theme.accent } }}>
      <NativeTabs.Trigger name="index" disableTransparentOnScrollEdge>
        <NativeTabs.Trigger.Label>今天</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'sun.horizon', selected: 'sun.horizon.fill' }} md="today" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="thoughts" disableTransparentOnScrollEdge>
        <NativeTabs.Trigger.Label>闪念</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="square.and.pencil" md="edit_note" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chat" disableTransparentOnScrollEdge>
        <NativeTabs.Trigger.Label>对话</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'bubble.left', selected: 'bubble.left.fill' }} md="chat_bubble" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile" disableTransparentOnScrollEdge>
        <NativeTabs.Trigger.Label>我的</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
