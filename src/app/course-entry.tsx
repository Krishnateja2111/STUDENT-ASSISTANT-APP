import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { CourseAccentPalette, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/state/app-state';

export default function CourseEntryScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { courses, addCourse, updateCourse } = useAppState();
  const theme = useTheme();

  const existing = id ? courses.find((c) => c.id === id) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [colorTag, setColorTag] = useState(existing?.colorTag ?? CourseAccentPalette[0]);

  const canSave = name.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    if (existing) {
      updateCourse(existing.id, { name: name.trim(), colorTag });
    } else {
      addCourse({ name: name.trim(), colorTag });
    }
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
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

      <Button
        label={existing ? 'Save changes' : 'Add course'}
        onPress={handleSave}
        disabled={!canSave}
        style={styles.saveButton}
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
  saveButton: {
    marginTop: Spacing.four,
  },
});
