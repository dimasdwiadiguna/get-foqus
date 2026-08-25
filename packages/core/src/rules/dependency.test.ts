import { describe, expect, it } from 'vitest';
import {
  canAddDependency,
  canNestUnder,
  findCycle,
  taskDepth,
  topologicalOrder,
  unfinishedDependencies,
} from './dependency.js';

const edge = (taskId: string, dependsOnTaskId: string) => ({ taskId, dependsOnTaskId });

describe('cycle detection (§4.3)', () => {
  it('accepts a chain', () => {
    const edges = [edge('c', 'b'), edge('b', 'a')];
    expect(findCycle(edges)).toBeNull();
    expect(canAddDependency(edges, edge('d', 'c'))).toBe(true);
  });

  it('rejects a dependency that would close the loop', () => {
    const edges = [edge('c', 'b'), edge('b', 'a')];
    expect(canAddDependency(edges, edge('a', 'c'))).toBe(false);
    expect(findCycle(edges, edge('a', 'c'))).toContain('a');
  });

  it('rejects a self-dependency', () => {
    expect(canAddDependency([], edge('a', 'a'))).toBe(false);
  });
});

describe('topologicalOrder (§6.1)', () => {
  it('places prerequisites before their dependents', () => {
    const order = topologicalOrder(['c', 'a', 'b'], [edge('c', 'b'), edge('b', 'a')]);
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'));
  });

  it('is deterministic for identical input', () => {
    const edges = [edge('c', 'b'), edge('b', 'a'), edge('d', 'a')];
    expect(topologicalOrder(['d', 'c', 'b', 'a'], edges)).toEqual(
      topologicalOrder(['d', 'c', 'b', 'a'], edges),
    );
  });
});

describe('unfinishedDependencies (D5, §5.6)', () => {
  const tasks = [
    { id: 'a', title: 'Kumpulkan data', status: 'active' as const },
    { id: 'b', title: 'Analisis', status: 'done' as const },
  ];

  it('names the prerequisites that are still open, rather than blocking', () => {
    expect(unfinishedDependencies('c', [edge('c', 'a'), edge('c', 'b')], tasks)).toEqual([
      { taskId: 'a', title: 'Kumpulkan data' },
    ]);
  });
});

describe('hierarchy depth (§4.1)', () => {
  const tasks = [
    { id: 'root', parentTaskId: null },
    { id: 'mid', parentTaskId: 'root' },
    { id: 'leaf', parentTaskId: 'mid' },
  ];

  it('measures depth from the root', () => {
    expect(taskDepth('root', tasks)).toBe(1);
    expect(taskDepth('leaf', tasks)).toBe(3);
  });

  it('caps nesting at three levels', () => {
    expect(canNestUnder('mid', tasks)).toBe(true);
    expect(canNestUnder('leaf', tasks)).toBe(false);
    expect(canNestUnder(null, tasks)).toBe(true);
  });
});
