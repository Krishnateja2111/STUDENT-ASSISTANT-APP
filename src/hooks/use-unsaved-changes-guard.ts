import { useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

/**
 * Intercepts every way a screen can be left — header back, Android hardware
 * back, swipe-back gesture, and programmatic router.back() — uniformly,
 * via React Navigation's 'beforeRemove' event (exposed through expo-router's
 * useNavigation, no extra dependency needed). Only asks for confirmation
 * when hasChanges is true; otherwise navigation proceeds normally.
 */
export function useUnsavedChangesGuard(hasChanges: boolean) {
  const navigation = useNavigation();
  const hasChangesRef = useRef(hasChanges);
  useEffect(() => {
    hasChangesRef.current = hasChanges;
  }, [hasChanges]);
  // Set synchronously right before a deliberate exit (save/delete succeeded)
  // so the very next removal isn't mistaken for someone abandoning changes.
  const bypassRef = useRef(false);
  const [pendingAction, setPendingAction] = useState<Parameters<typeof navigation.dispatch>[0] | null>(null);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (bypassRef.current || !hasChangesRef.current) {
        bypassRef.current = false;
        return;
      }
      e.preventDefault();
      setPendingAction(e.data.action);
    });
    return unsubscribe;
  }, [navigation]);

  const confirmDiscard = () => {
    if (pendingAction) navigation.dispatch(pendingAction);
    setPendingAction(null);
  };
  const cancelDiscard = () => setPendingAction(null);
  const leaveWithoutPrompt = () => {
    bypassRef.current = true;
  };

  return { showDiscardDialog: pendingAction !== null, confirmDiscard, cancelDiscard, leaveWithoutPrompt };
}
