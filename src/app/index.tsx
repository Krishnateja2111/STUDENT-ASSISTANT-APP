import { Redirect } from 'expo-router';

import { useAppState } from '@/state/app-state';

export default function Index() {
  const { isAuthed } = useAppState();
  return <Redirect href={isAuthed ? '/(tabs)/dashboard' : '/auth'} />;
}
