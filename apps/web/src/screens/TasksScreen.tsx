/**
 * Tugas (§10.4).
 *
 * M0 shows the backlog read from the Dexie mirror so the seed data is visibly there. Quick
 * capture, swipe actions, filters and selection mode are M1.
 *
 * Two row details are settled here rather than left to M1, because M1 builds on top of them:
 * priority is a colour bar on the leading edge instead of the literal text "P1" (which had to
 * be decoded, and occupied the slot the completion checkbox needs), and the pomodoro series is
 * a component rather than repeated glyphs.
 */

import { useMemo } from 'react';
import { formatDateShort } from '@foqus/core';
import { ScreenTitle } from '../components/ScreenTitle.js';
import { ConnectionStatus } from '../components/ConnectionStatus.js';
import { EmptyState } from '../components/EmptyState.js';
import { PomodoroDots } from '../components/PomodoroDots.js';
import { PriorityBar } from '../components/PriorityBar.js';
import { useMirroredCategories, useMirroredTasks } from '../lib/queries.js';

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
      <ScreenTitle sub={`${open.length} task terbuka`} actions={<ConnectionStatus />}>
        Tugas
      </ScreenTitle>

      {roots.length === 0 ? (
        <EmptyState
          title="Backlog kosong"
          body="Belum ada task di sini. Menambah dan menyunting task belum bisa dilakukan di versi ini."
        />
      ) : (
        <ul className="divide-y hairline border-y hairline">
          {roots.map((task) => {
            const children = childrenOf(task.id);
            const category = categoryName(task.categoryId);
            return (
              <li key={task.id} className="relative px-4 py-3">
                <PriorityBar priority={task.priority} />
                <div className="flex min-h-touch items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-label text-muted">
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
                  <PomodoroDots allocated={task.allocatedPomodoros} className="text-muted" />
                </div>

                {children.length > 0 && (
                  <ul className="mt-2 space-y-1 border-l-2 hairline pl-4">
                    {children.map((child) => (
                      <li key={child.id} className="flex min-h-[32px] items-center gap-2 text-meta">
                        <span className="min-w-0 flex-1 truncate">{child.title}</span>
                        <PomodoroDots allocated={child.allocatedPomodoros} className="text-muted" />
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
