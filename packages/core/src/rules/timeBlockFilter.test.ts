import { describe, expect, it } from 'vitest';
import { describeMismatch, filterMismatches, passesFilter } from './timeBlockFilter.js';

const subject = {
  task: { id: 't1', categoryId: 'cat-work', priority: 'P2' as const },
  tagIds: ['tag-deep'],
};

describe('time block filters (§4.7)', () => {
  it('accepts everything when no criteria are set', () => {
    expect(passesFilter({}, subject)).toBe(true);
  });

  it('ORs inside a group', () => {
    expect(passesFilter({ categoryIds: ['cat-other', 'cat-work'] }, subject)).toBe(true);
  });

  it('ANDs across groups', () => {
    expect(passesFilter({ categoryIds: ['cat-work'], priorities: ['P1'] }, subject)).toBe(false);
  });

  it('reports every failing group so the message can be specific', () => {
    expect(
      filterMismatches(
        { categoryIds: ['cat-other'], priorities: ['P1'], tagIds: ['tag-x'] },
        subject,
      ),
    ).toEqual(['category', 'tag', 'priority']);
  });

  it('matches a task pinned by id', () => {
    expect(passesFilter({ taskIds: ['t1'] }, subject)).toBe(true);
    expect(passesFilter({ taskIds: ['t2'] }, subject)).toBe(false);
  });

  it('phrases the mismatch the way the calendar overlay reads', () => {
    expect(describeMismatch('Kerja Dalam', ['category'])).toBe(
      'Blok Kerja Dalam — kategori tidak cocok',
    );
  });
});
