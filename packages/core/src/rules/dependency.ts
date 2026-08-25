/**
 * Task dependency graph (§4.3).
 *
 * Two rules live here:
 *  - cycles are rejected **at write time** (DFS), so every reader downstream may assume a DAG;
 *  - an unfinished dependency is a **warning, never a gate** (D5, §5.6) — the caller gets the
 *    prerequisite's name so the UI can say which one, not a generic "blocked".
 */

import type { Task, TaskDependency } from '../types.js';

export interface DependencyEdge {
  taskId: string;
  dependsOnTaskId: string;
}

function adjacency(edges: DependencyEdge[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const edge of edges) {
    const list = map.get(edge.taskId);
    if (list) list.push(edge.dependsOnTaskId);
    else map.set(edge.taskId, [edge.dependsOnTaskId]);
  }
  return map;
}

/**
 * Returns the cycle as a path (first node repeated at the end) if adding `candidate` to
 * `edges` would create one, otherwise null.
 */
export function findCycle(edges: DependencyEdge[], candidate?: DependencyEdge): string[] | null {
  const all = candidate ? [...edges, candidate] : edges;
  const graph = adjacency(all);
  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];

  const visit = (node: string): string[] | null => {
    const current = state.get(node);
    if (current === 'done') return null;
    if (current === 'visiting') {
      const start = stack.indexOf(node);
      return [...stack.slice(start), node];
    }
    state.set(node, 'visiting');
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    stack.pop();
    state.set(node, 'done');
    return null;
  };

  for (const node of graph.keys()) {
    const cycle = visit(node);
    if (cycle) return cycle;
  }
  return null;
}

/** True when `candidate` is safe to persist. */
export function canAddDependency(edges: DependencyEdge[], candidate: DependencyEdge): boolean {
  if (candidate.taskId === candidate.dependsOnTaskId) return false;
  return findCycle(edges, candidate) === null;
}

/**
 * Topological order, most-depended-upon first (§6.1).
 * Ties are broken by the caller-provided order so the engine stays deterministic.
 */
export function topologicalOrder(taskIds: string[], edges: DependencyEdge[]): string[] {
  const inScope = new Set(taskIds);
  const graph = adjacency(
    edges.filter((e) => inScope.has(e.taskId) && inScope.has(e.dependsOnTaskId)),
  );
  const visited = new Set<string>();
  const order: string[] = [];

  const visit = (node: string, guard: Set<string>) => {
    if (visited.has(node) || guard.has(node)) return;
    guard.add(node);
    for (const next of graph.get(node) ?? []) visit(next, guard);
    guard.delete(node);
    visited.add(node);
    order.push(node);
  };

  for (const taskId of taskIds) visit(taskId, new Set());
  return order;
}

export interface UnfinishedDependency {
  taskId: string;
  title: string;
}

/**
 * Prerequisites of `taskId` that are not done yet. Used for the inline warning in §5.6 —
 * it names them, and scheduling proceeds regardless.
 */
export function unfinishedDependencies(
  taskId: string,
  edges: DependencyEdge[],
  tasks: Pick<Task, 'id' | 'title' | 'status'>[],
): UnfinishedDependency[] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  return edges
    .filter((edge) => edge.taskId === taskId)
    .map((edge) => byId.get(edge.dependsOnTaskId))
    .filter((task): task is Pick<Task, 'id' | 'title' | 'status'> => Boolean(task))
    .filter((task) => task.status !== 'done' && task.status !== 'archived')
    .map((task) => ({ taskId: task.id, title: task.title }));
}

export function toEdges(dependencies: TaskDependency[]): DependencyEdge[] {
  return dependencies.map(({ taskId, dependsOnTaskId }) => ({ taskId, dependsOnTaskId }));
}

/** Depth of a task in the parent/child hierarchy; FOQUS caps display nesting at 3 levels (§4.1). */
export const MAX_TASK_DEPTH = 3;

export function taskDepth(taskId: string, tasks: Pick<Task, 'id' | 'parentTaskId'>[]): number {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  let depth = 1;
  let current = byId.get(taskId)?.parentTaskId ?? null;
  while (current && depth < 50) {
    depth += 1;
    current = byId.get(current)?.parentTaskId ?? null;
  }
  return depth;
}

export function canNestUnder(
  parentId: string | null,
  tasks: Pick<Task, 'id' | 'parentTaskId'>[],
): boolean {
  if (!parentId) return true;
  return taskDepth(parentId, tasks) < MAX_TASK_DEPTH;
}
