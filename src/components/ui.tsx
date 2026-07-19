import { LinearGradient } from 'expo-linear-gradient';
import React, { type PropsWithChildren, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette, radius, shadow, spacing, useAppTheme } from '@/constants/theme';

type AppScreenProps = PropsWithChildren<{
  scroll?: boolean;
  contentStyle?: ViewStyle;
  testID?: string;
  backgroundColor?: string;
}>;

export function AppScreen({ children, scroll = true, contentStyle, testID, backgroundColor }: AppScreenProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const paddingTop = Math.max(insets.top, spacing.four) + spacing.two;
  const paddingBottom = Platform.OS === 'web' ? 116 : Math.max(insets.bottom, spacing.four) + 28;

  if (!scroll) {
    return (
      <View
        collapsable={false}
        testID={testID}
        style={[styles.screen, { backgroundColor: backgroundColor ?? theme.background }]}> 
        {children}
      </View>
    );
  }

  return (
    <View collapsable={false} testID={testID} style={[styles.screen, { backgroundColor: backgroundColor ?? theme.background }]}> 
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          { paddingTop, paddingBottom },
          contentStyle,
        ]}>
        {children}
      </ScrollView>
    </View>
  );
}

export function BrandHeader({ eyebrow, action }: { eyebrow?: string; action?: ReactNode }) {
  const theme = useAppTheme();
  return (
    <View style={styles.brandHeader}>
      <View style={styles.brandRow}>
        <View style={styles.brandMark}>
          <Text style={styles.brandSymbol}>◐</Text>
        </View>
        <View>
          <Text style={[styles.brandName, { color: theme.text }]}>心潮</Text>
          {eyebrow ? <Text style={[styles.brandEyebrow, { color: theme.secondaryText }]}>{eyebrow}</Text> : null}
        </View>
      </View>
      {action}
    </View>
  );
}

export function PageTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.pageTitle}>
      {eyebrow ? <Text style={[styles.eyebrow, { color: theme.accent }]}>{eyebrow}</Text> : null}
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {description ? (
        <Text style={[styles.description, { color: theme.secondaryText }]}>{description}</Text>
      ) : null}
    </View>
  );
}

export function Surface({
  children,
  style,
  elevated = false,
}: PropsWithChildren<{ style?: ViewStyle | ViewStyle[]; elevated?: boolean }>) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.surface,
        { backgroundColor: elevated ? theme.elevated : theme.surface, borderColor: theme.border },
        elevated ? shadow : null,
        style,
      ]}>
      {children}
    </View>
  );
}

export function HeroCard({ children }: PropsWithChildren) {
  return (
    <LinearGradient
      colors={[palette.forest, '#315E50', '#6F8B75']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.heroCard}>
      <View style={styles.heroOrb} />
      {children}
    </LinearGradient>
  );
}

type ButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  style?: ViewStyle | ViewStyle[];
  testID?: string;
};

export function AppButton({
  label,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  style,
  testID,
}: ButtonProps) {
  const theme = useAppTheme();
  const backgroundColor =
    variant === 'primary'
      ? theme.accent
      : variant === 'danger'
        ? palette.danger
        : variant === 'secondary'
          ? theme.softAccent
          : 'transparent';
  const color =
    variant === 'primary' || variant === 'danger' ? palette.white : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          borderColor: variant === 'ghost' ? theme.border : backgroundColor,
          opacity: disabled ? 0.45 : pressed ? 0.78 : 1,
        },
        style,
      ]}>
      {loading ? <ActivityIndicator color={color} /> : <Text style={[styles.buttonText, { color }]}>{label}</Text>}
    </Pressable>
  );
}

export function Chip({ label, selected = false }: { label: string; selected?: boolean }) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.accent : theme.softAccent,
          borderColor: selected ? theme.accent : theme.border,
        },
      ]}>
      <Text style={[styles.chipText, { color: selected ? palette.white : theme.text }]}>{label}</Text>
    </View>
  );
}

export function SectionHeading({ index, title, caption }: { index?: string; title: string; caption?: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.sectionHeading}>
      {index ? <Text style={[styles.sectionIndex, { color: theme.accent }]}>{index}</Text> : null}
      <View style={styles.sectionCopy}>
        {caption ? <Text style={[styles.eyebrow, { color: theme.secondaryText }]}>{caption}</Text> : null}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      </View>
    </View>
  );
}

export function MutedText({ children, style }: PropsWithChildren<{ style?: TextStyle | TextStyle[] }>) {
  const theme = useAppTheme();
  return <Text style={[styles.muted, { color: theme.secondaryText }, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: spacing.five,
    gap: spacing.five,
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 38,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandMark: {
    width: 22,
    height: 28,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandSymbol: { color: '#D8BB78', fontFamily: 'Georgia', fontSize: 21 },
  brandName: { fontFamily: 'Georgia', fontSize: 17, fontWeight: '500', letterSpacing: 2 },
  brandEyebrow: { display: 'none' },
  pageTitle: { gap: spacing.two, paddingVertical: spacing.four },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6, textTransform: 'uppercase' },
  title: { fontSize: 34, lineHeight: 44, fontWeight: '800', letterSpacing: -0.8 },
  description: { fontSize: 15, lineHeight: 24, maxWidth: 560 },
  surface: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 21, padding: 18 },
  heroCard: { borderRadius: radius.large, padding: spacing.six, minHeight: 270, overflow: 'hidden' },
  heroOrb: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    right: -70,
    top: -90,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  button: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.1 },
  chip: {
    minHeight: 32,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 12, fontWeight: '700' },
  sectionHeading: { flexDirection: 'row', gap: spacing.three, alignItems: 'flex-start' },
  sectionIndex: { fontSize: 13, fontWeight: '900', paddingTop: 2 },
  sectionCopy: { flex: 1, gap: 3 },
  sectionTitle: { fontSize: 22, lineHeight: 30, fontWeight: '800' },
  muted: { fontSize: 10, lineHeight: 15.5 },
});
