/**
 * Time block filters (§4.7).
 *
 * Semantics chosen here (recorded in DECISIONS.md): a task passes a filter when, for every
 * criterion group the filter actually specifies, the task matches at least one member.
 * OR inside a group, AND across groups. A filter with no criteria at all accepts everything.
 *
 * This matters because the result is *binding* for smart allocation (D6): a task that fails
 * the filter disqualifies the slot entirely (§6.5), it does not merely score lower.
 */

import type { Task, TimeBlockFilter } from '../types.js';

export interface FilterSubject {
  task: Pick<Task, 'id' | 'categoryId' | 'priority'>;
  tagIds: string[];
}

export type FilterMismatch = 'category' | 'tag' | 'task' | 'priority';

/** Which criterion groups the subject fails — used to phrase the specific message in §5.5. */
export function filterMismatches(
  filter: TimeBlockFilter,
  subject: FilterSubject,
): FilterMismatch[] {
  const mismatches: FilterMismatch[] = [];

  if (filter.categoryIds?.length) {
    if (!subject.task.categoryId || !filter.categoryIds.includes(subject.task.categoryId)) {
      mismatches.push('category');
    }
  }
  if (filter.tagIds?.length) {
    if (!subject.tagIds.some((tagId) => filter.tagIds?.includes(tagId))) {
      mismatches.push('tag');
    }
  }
  if (filter.taskIds?.length) {
    if (!filter.taskIds.includes(subject.task.id)) {
      mismatches.push('task');
    }
  }
  if (filter.priorities?.length) {
    if (!filter.priorities.includes(subject.task.priority)) {
      mismatches.push('priority');
    }
  }

  return mismatches;
}

export function passesFilter(filter: TimeBlockFilter, subject: FilterSubject): boolean {
  return filterMismatches(filter, subject).length === 0;
}

const MISMATCH_LABELS: Record<FilterMismatch, string> = {
  category: 'kategori tidak cocok',
  tag: 'tag tidak cocok',
  task: 'task tidak termasuk',
  priority: 'prioritas tidak cocok',
};

/** e.g. `Blok Kerja Dalam — kategori tidak cocok` (§10.2 Jalur B). */
export function describeMismatch(blockTitle: string, mismatches: FilterMismatch[]): string {
  if (mismatches.length === 0) return blockTitle;
  const reasons = mismatches.map((mismatch) => MISMATCH_LABELS[mismatch]);
  return `Blok ${blockTitle} — ${reasons.join(', ')}`;
}
