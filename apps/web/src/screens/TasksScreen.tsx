/**
 * Tugas (§10.4).
 *
 * M0 shows the backlog read from the Dexie mirror, grouped by category, so the seed data is
 * visibly there. CRUD, swipe actions, filters and selection mode are M1.
 */

import { useMemo } from 'react';
import { formatDateShort } from '@foqus/core';
import { ScreenTitle } from '../components/ScreenTitle.js';
import { EmptyState } from '../components/EmptyState.js';
import { useMirroredCategories, useMirroredTasks } from '../lib/queries.js';

const PRIORITY_TINT: Record<string, string> = {
  P1: 'text-ember',
  P2: 'text-tea',
  P3: 'text-muted',
  P4: 'text-muted',
};

export function TasksScreen() {
  const tasks = useMirroredTasks();
  const categories = useMirroredCategories();

  const categoryName = useMemo(() => {
    const map = new Map((categories ?? []).map((category) => [category.id, category]));
    return (id?: string | null) => (id ? map.get(id) : undefined);
  }, [categories]);

  const open = (tasks ?? []).filter((task) => task.status !== 'done' && task.status !== 'archived');
  const roots = open.filter((task) => !task.parentTaskId);
  const childrenOf = (id: string) => open.filter((task) => task.parentTaskId === id);

  return (
    <div className="pb-6">
      <ScreenTitle sub={`${open.length} task terbuka`}>Tugas</ScreenTitle>

      {roots.length === 0 ? (
        <EmptyState
          title="Backlog kosong"
          body="Membuat dan mengelola task masuk di milestone berikutnya."
        />
      ) : (
        <ul className="divide-y hairline border-y hairline">
          {roots.map((task) => {
            const children = childrenOf(task.id);
            const category = categoryName(task.categoryId);
            return (
              <li key={task.id} className="px-4 py-3">
                <div className="flex min-h-touch items-center gap-3">
                  <span
                    className={`font-mono text-[10px] ${PRIORITY_TINT[task.priority] ?? 'text-muted'}`}
                  >
                    {task.priority}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{task.title}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                      {category && (
                        <span className="inline-flex items-center gap-1">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: category.colorHex }}
                          />
                          {category.name}
                        </span>
                      )}
                      {task.dueDate && <span>· {formatDateShort(task.dueDate)}</span>}
                      {children.length > 0 && <span>· {children.length} sub-task</span>}
                    </p>
                  </div>
                  <span className="font-mono text-[10px] text-muted">
                    {'○'.repeat(Math.min(task.allocatedPomodoros, 8))}
                  </span>
                </div>

                {children.length > 0 && (
                  <ul className="mt-2 space-y-1 border-l-2 hairline pl-4">
                    {children.map((child) => (
                      <li
                        key={child.id}
                        className="flex min-h-[32px] items-center gap-2 text-[13px]"
                      >
                        <span className="flex-1">{child.title}</span>
                        <span className="font-mono text-[10px] text-muted">
                          {'○'.repeat(Math.min(child.allocatedPomodoros, 8))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
