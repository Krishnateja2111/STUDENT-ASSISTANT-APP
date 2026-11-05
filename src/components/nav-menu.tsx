import { router } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from './avatar';
import { ListRow } from './list-row';
import { ThemedText } from './themed-text';

import { CardShadow, IconColors, Spacing, StatusColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/state/app-state';
import { useContentState } from '@/state/content-state';

export interface NavMenuProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * App-wide nav menu, opened from the hamburger button in ScreenHeader.
 * Deliberately doesn't repeat the 5 screens already in the bottom tab bar
 * (Dashboard/Calendar/Courses/Documents/Profile) — just what's not: Weekly
 * Progress, Notifications, Settings, and Sign out. Slides in from the left
 * edge rather than ConfirmDialog's centered pattern, matching what a
 * hamburger menu is expected to do.
 */
export function NavMenu({ visible, onClose }: NavMenuProps) {
  const theme = useTheme();
  const { logout } = useAppState();
  const { profile } = useContentState();

  const go = (href: Parameters<typeof router.push>[0]) => {
    onClose();
    router.push(href);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Swallows the tap so pressing the panel itself doesn't bubble to the backdrop's close. */}
        <Pressable onPress={() => {}} style={[styles.panel, { backgroundColor: theme.backgroundElement }]}>
          <ScrollView contentContainerStyle={styles.panelContent}>
            <Pressable onPress={() => go('/(tabs)/profile')} style={styles.identityRow}>
              <Avatar name={profile.name} size={40} />
              <View style={styles.identityText}>
                <ThemedText type="cardTitle">{profile.name}</ThemedText>
                <ThemedText type="meta" themeColor="textSecondary">
                  View profile
                </ThemedText>
              </View>
            </Pressable>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <ListRow
              icon="bar-chart"
              iconColor={IconColors.denim}
              label="Weekly progress"
              description="Planned vs. completed, by week"
              onPress={() => go('/weekly-progress')}
            />
            <ListRow
              icon="notifications"
              iconColor={IconColors.marigold}
              label="Notifications"
              onPress={() => go('/notifications')}
            />
            <ListRow
              icon="settings"
              iconColor={IconColors.umber}
              label="Settings"
              description="Privacy, notifications, and more"
              onPress={() => go('/settings')}
            />
            <ListRow
              icon="contrast"
              iconColor={IconColors.dustyTeal}
              label="Appearance"
              description="Light, dark, or match your device"
              onPress={() => go('/appearance')}
            />
            <ListRow
              icon="information-circle"
              iconColor={IconColors.slate}
              label="About"
              description="Data & privacy, app version"
              onPress={() => go('/about')}
            />

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <ListRow
              icon="log-out"
              label="Sign out"
              iconColor={StatusColors.danger}
              onPress={() => {
                onClose();
                logout();
                router.replace('/auth');
              }}
            />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(15,17,19,0.45)',
  },
  panel: {
    width: '78%',
    maxWidth: 320,
    height: '100%',
    ...CardShadow,
  },
  panelContent: {
    padding: Spacing.four,
    paddingTop: Spacing.six,
    gap: Spacing.one,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: Spacing.three,
  },
  identityText: {
    flex: 1,
    gap: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.two,
  },
});
