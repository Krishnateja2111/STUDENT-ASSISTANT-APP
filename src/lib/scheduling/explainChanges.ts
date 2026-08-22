import { mockExplanationEntries } from './mockData';
import type { ExplanationEntry, RescheduleResult } from './types';

/**
 * TODO(scheduling-engine): replace with the real template-based generator,
 * keyed off reasonCode + task/course data, deterministic — never an LLM
 * call for this text. AI (later, separately) only narrates follow-up
 * questions using ExplanationEntry as read-only context; it never produces
 * the explanation itself.
 */
export function explainChanges(_result: RescheduleResult): ExplanationEntry[] {
  return mockExplanationEntries;
}
