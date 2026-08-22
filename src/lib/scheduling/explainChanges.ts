import { TASK_TYPE_LABEL } from './priority';
import { ReasonCode } from './types';
import type { ExplanationEntry, RescheduleResult, ScheduledBlock, Task } from './types';

function formatBlockTime(block: ScheduledBlock): string {
  const day = new Date(block.start).toLocaleDateString('en-US', { weekday: 'long' });
  const time = new Date(block.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const endTime = new Date(block.end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} ${time}–${endTime}`;
}

/**
 * Deterministic, template-based — keyed off reasonCode + task data, never an
 * LLM call. Voice matches what was already validated on the Schedule Update
 * screen ("Problem Set 4 was moved to Sunday 11:00–12:30...").
 */
export function explainChanges(result: RescheduleResult, tasks: Task[]): ExplanationEntry[] {
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  return result.changes.map((change): ExplanationEntry => {
    const task = taskById.get(change.taskId);
    const title = task?.title ?? 'This task';
    const typeLabel = task ? TASK_TYPE_LABEL[task.taskType] : 'task';

    switch (change.reasonCode) {
      case ReasonCode.MISSED_TASK_REINSERTED: {
        if (!change.newBlock) {
          return { taskId: change.taskId, reasonCode: change.reasonCode, message: `${title} couldn't be rescheduled yet — there's no open time before it needs to happen.` };
        }
        const deadlineMs = task ? new Date(task.dueDate).getTime() : Infinity;
        const newStartMs = new Date(change.newBlock.start).getTime();
        const isPastDeadline = newStartMs > deadlineMs;
        const when = formatBlockTime(change.newBlock);
        const message = isPastDeadline
          ? `${title} was moved to ${when}. It's a ${typeLabel} that's now overdue, so it jumped ahead of lower-priority work to get rescheduled first.`
          : `${title} was moved to ${when}. It still fits before its deadline, so it was slotted into the next open time.`;
        return { taskId: change.taskId, reasonCode: change.reasonCode, message };
      }

      case ReasonCode.OVERFLOW_DEFERRED:
        return {
          taskId: change.taskId,
          reasonCode: change.reasonCode,
          message: `${title} couldn't be fit in before its deadline given everything else scheduled. It's been left unscheduled — consider freeing up time or moving its deadline.`,
        };

      case ReasonCode.DEADLINE_PROXIMITY:
        return {
          taskId: change.taskId,
          reasonCode: change.reasonCode,
          message: change.newBlock
            ? `${title} moved to ${formatBlockTime(change.newBlock)} because another task's deadline is closer and needed that time first.`
            : `${title} was bumped because another task's deadline is closer and needed that time first.`,
        };

      case ReasonCode.HIGH_PRIORITY_TASK_TYPE:
        return {
          taskId: change.taskId,
          reasonCode: change.reasonCode,
          message: `${title} moved because higher-priority work (exam prep or a graded assignment) took that time slot.`,
        };

      case ReasonCode.AVAILABILITY_FREED:
        return {
          taskId: change.taskId,
          reasonCode: change.reasonCode,
          message: change.newBlock
            ? `${title} moved earlier to ${formatBlockTime(change.newBlock)} now that more free time opened up.`
            : `${title} moved now that more free time opened up.`,
        };

      case ReasonCode.DEPENDENCY_ORDER:
        return {
          taskId: change.taskId,
          reasonCode: change.reasonCode,
          message: `${title} moved to stay after the task it depends on.`,
        };

      default: {
        const _exhaustive: never = change.reasonCode;
        return { taskId: change.taskId, reasonCode: _exhaustive, message: `${title} was rescheduled.` };
      }
    }
  });
}
