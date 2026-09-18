import { router, Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Radius, Spacing, StatusColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useContentState } from '@/state/content-state';

/**
 * Appearance — pulled out of Settings into its own page (per request: the
 * theme toggle used to live below four separate availability sections
 * there, effectively buried behind "the availability page" from a user's
 * perspective, and hard to find). Settings now just links here via a
 * ListRow instead of embedding this inline.
 */
export default function AppearanceScreen() {
  const theme = useTheme();
  const { themePreference, setThemePreference } = useContentState();
  const colorScheme = useColorScheme();
  const appearanceLabel = colorScheme === 'dark' ? 'Dark' : 'Light';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen
        options={{
          title: 'Appearance',
          headerLeft: () => (
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'))}
              hitSlop={8}
              style={styles.headerAction}>
              <ThemedText type="default" style={{ color: StatusColors.brand, fontWeight: '600' }}>
                Done
              </ThemedText>
            </Pressable>
          ),
        }}
      />

      <Card style={styles.infoCard}>
        <View>
          <ThemedText type="cardTitle">Theme</ThemedText>
          <ThemedText type="meta" themeColor="textSecondary">
            {themePreference === 'system'
              ? `Following your device's system setting (currently ${appearanceLabel})`
              : `Pinned to ${appearanceLabel}, regardless of your device's setting`}
          </ThemedText>
        </View>
        <View style={styles.kindToggleRow}>
          {(['system', 'light', 'dark'] as const).map((pref) => {
            const selected = themePreference === pref;
            return (
              <Pressable
                key={pref}
                onPress={() => setThemePreference(pref)}
                style={[
                  styles.kindChip,
                  selected
                    ? { backgroundColor: StatusColors.brand }
                    : { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border },
                ]}>
                <ThemedText type="small" style={selected ? styles.chipTextSelected : undefined}>
                  {pref === 'system' ? 'System' : pref === 'light' ? 'Light' : 'Dark'}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerAction: {
    minHeight: MinTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  container: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  infoCard: {
    gap: Spacing.three,
  },
  kindToggleRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  kindChip: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
  chipTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
