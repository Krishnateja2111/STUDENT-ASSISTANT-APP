import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { ThemedText } from '@/components/themed-text';
import { CourseAccentPalette, Radius, Spacing, StatusColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { useAppState } from '@/state/app-state';

export default function CourseEntryScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { courses, addCourse, updateCourse } = useAppState();
  const theme = useTheme();

  const existing = id ? courses.find((c) => c.id === id) : undefined;

  const [initial] = useState(() => ({
    name: existing?.name ?? '',
    colorTag: existing?.colorTag ?? CourseAccentPalette[0],
  }));

  const [name, setName] = useState(initial.name);
  const [colorTag, setColorTag] = useState(initial.colorTag);

  const hasChanges = name !== initial.name || colorTag !== initial.colorTag;
  const { showDiscardDialog, confirmDiscard, cancelDiscard, leaveWithoutPrompt } = useUnsavedChangesGuard(hasChanges);

  const canSave = name.trim().length > 0;

  // Bug fix: router.back() is a silent no-op with no in-app navigation
  // history to go back to (a direct URL load, a page refresh while already
  // on this screen — reproduced live on Weekly Progress/Notifications).
  const safeBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/courses');
  };

  const handleSave = () => {
    if (!canSave) return;
    if (existing) {
      updateCourse(existing.id, { name: name.trim(), colorTag });
    } else {
      addCourse({ name: name.trim(), colorTag });
    }
    leaveWithoutPrompt();
    safeBack();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <Pressable onPress={safeBack} hitSlop={8} style={styles.headerAction}>
              <ThemedText type="default" themeColor="textSecondary">
                Cancel
              </ThemedText>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={handleSave} disabled={!canSave} hitSlop={8} style={styles.headerAction}>
              <ThemedText
                type="default"
                style={{ color: canSave ? StatusColors.brand : theme.textMuted, fontWeight: '700' }}>
                Save
              </ThemedText>
            </Pressable>
          ),
        }}
      />

      <ThemedText type="meta" themeColor="textMuted" style={styles.label}>
        COURSE NAME
      </ThemedText>
      <TextInput
        style={[
          styles.input,
          { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement },
        ]}
        placeholder="e.g. CS 301 – Algorithms"
        placeholderTextColor={theme.textMuted}
        value={name}
        onChangeText={setName}
      />

      <ThemedText type="meta" themeColor="textMuted" style={styles.label}>
        ACCENT COLOR
      </ThemedText>
      <View style={styles.swatchRow}>
        {CourseAccentPalette.map((color) => (
          <Pressable key={color} onPress={() => setColorTag(color)} style={styles.swatchTarget}>
            <View
              style={[
                styles.swatch,
                { backgroundColor: color },
                colorTag === color && { borderWidth: 3, borderColor: theme.text },
              ]}
            />
          </Pressable>
        ))}
      </View>

      <ConfirmDialog
        visible={showDiscardDialog}
        title="Discard changes?"
        description="You have unsaved changes. Are you sure you want to leave?"
        cancelLabel="Keep Editing"
        confirmLabel="Discard"
        destructive
        onConfirm={confirmDiscard}
        onCancel={cancelDiscard}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  label: {
    letterSpacing: 0.6,
    marginTop: Spacing.two,
    marginBottom: Spacing.one,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  swatchTarget: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
  },
  headerAction: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
});
