import { describe, expect, it } from 'vitest';
import type { Agenda, AvailabilityWindow, DayOfWeek, ResolvedTimeBlock, Task } from '../types.js';
import type { PrayerBlock } from '../prayer/blocks.js';
import {
  candidateSlots,
  disqualifyingBlocks,
  freeIntervals,
  usableIntervals,
} from './freeIntervals.js';

const JKT = 'Asia/Jakarta';
const z = (local: string) => `2026-08-25T${local}:00.000Z`; // UTC helper; Jakarta = UTC+7

const win = (dayOfWeek: DayOfWeek): AvailabilityWindow => ({
  id: `w${dayOfWeek}`,
  userId: 'u1',
  createdAt: z('00:00'),
  updatedAt: z('00:00'),
  dayOfWeek,
  startTime: '08:00',
  endTime: '17:00',
});

const task: Pick<Task, 'id' | 'categoryId' | 'priority'> = {
  id: 't1',
  categoryId: 'cat-work',
  priority: 'P2',
};

const baseInput = {
  // Tuesday 2026-08-25, 08:00-17:00 Jakarta = 01:00Z - 10:00Z
  horizon: { from: z('00:00'), to: z('16:00') },
  timezone: JKT,
  windows: [win(2)],
  prayerBlocks: [] as PrayerBlock[],
  timeBlocks: [] as ResolvedTimeBlock[],
  existingAgendas: [] as Agenda[],
  externalBusy: [],
  task,
  tagIds: [] as string[],
};

describe('freeIntervals (§6.3)', () => {
  it('starts from the availability window alone', () => {
    expect(freeIntervals(baseInput)).toEqual([{ startAt: z('01:00'), endAt: z('10:00') }]);
  });

  it('subtracts prayer blocks', () => {
    const dhuhr: PrayerBlock = {
      label: 'dhuhr',
      displayName: 'Zuhur',
      dateKey: '2026-08-25',
      startAt: z('05:00'),
      endAt: z('05:30'),
    };
    expect(freeIntervals({ ...baseInput, prayerBlocks: [dhuhr] })).toEqual([
      { startAt: z('01:00'), endAt: z('05:00') },
      { startAt: z('05:30'), endAt: z('10:00') },
    ]);
  });

  it('subtracts an existing agenda including its buffer', () => {
    const agenda: Agenda = {
      id: 'a1',
      userId: 'u1',
      taskId: 'other',
      createdAt: z('00:00'),
      updatedAt: z('00:00'),
      startAt: z('03:00'),
      endAt: z('04:00'),
      bufferBeforeMin: 0,
      bufferAfterMin: 10,
      status: 'planned',
      syncState: 'synced',
    };
    expect(freeIntervals({ ...baseInput, existingAgendas: [agenda] })).toEqual([
      { startAt: z('01:00'), endAt: z('03:00') },
      { startAt: z('04:10'), endAt: z('10:00') },
    ]);
  });

  it('lets the agenda being moved through, so it does not block itself', () => {
    const agenda: Agenda = {
      id: 'moving',
      userId: 'u1',
      taskId: 't1',
      createdAt: z('00:00'),
      updatedAt: z('00:00'),
      startAt: z('03:00'),
      endAt: z('04:00'),
      bufferBeforeMin: 0,
      bufferAfterMin: 10,
      status: 'planned',
      syncState: 'synced',
    };
    expect(
      freeIntervals({ ...baseInput, existingAgendas: [agenda], excludeAgendaId: 'moving' }),
    ).toEqual([{ startAt: z('01:00'), endAt: z('10:00') }]);
  });

  it('subtracts external GCal busy time', () => {
    expect(
      freeIntervals({ ...baseInput, externalBusy: [{ startAt: z('06:00'), endAt: z('07:00') }] }),
    ).toEqual([
      { startAt: z('01:00'), endAt: z('06:00') },
      { startAt: z('07:00'), endAt: z('10:00') },
    ]);
  });

  it('removes time blocks whose filter the task fails, and keeps the ones it passes', () => {
    const deepWork: ResolvedTimeBlock = {
      timeBlockId: 'tb1',
      title: 'Kerja Dalam',
      startAt: z('02:00'),
      endAt: z('04:00'),
      filter: { categoryIds: ['cat-work'] },
    };
    const teaching: ResolvedTimeBlock = {
      timeBlockId: 'tb2',
      title: 'Mengajar',
      startAt: z('08:00'),
      endAt: z('09:00'),
      filter: { categoryIds: ['cat-teach'] },
    };
    const input = { ...baseInput, timeBlocks: [deepWork, teaching] };
    expect(disqualifyingBlocks(input).map((b) => b.timeBlockId)).toEqual(['tb2']);
    expect(freeIntervals(input)).toEqual([
      { startAt: z('01:00'), endAt: z('08:00') },
      { startAt: z('09:00'), endAt: z('10:00') },
    ]);
  });

  it('never offers a slot in the past', () => {
    expect(freeIntervals({ ...baseInput, now: z('07:00') })).toEqual([
      { startAt: z('07:00'), endAt: z('10:00') },
    ]);
  });

  it('returns nothing when the whole day is taken', () => {
    expect(
      usableIntervals(
        { ...baseInput, externalBusy: [{ startAt: z('00:00'), endAt: z('16:00') }] },
        60,
      ),
    ).toEqual([]);
  });
});

describe('candidateSlots', () => {
  it('snaps candidate starts to the step size', () => {
    const slots = candidateSlots([{ startAt: z('01:07'), endAt: z('02:00') }], 30, 15);
    expect(slots[0]).toEqual({ startAt: z('01:15'), endAt: z('01:45') });
    expect(slots).toHaveLength(2);
  });

  it('falls back to the exact interval start when only a flush fit works', () => {
    const slots = candidateSlots([{ startAt: z('01:07'), endAt: z('01:37') }], 30, 15);
    expect(slots).toEqual([{ startAt: z('01:07'), endAt: z('01:37') }]);
  });

  it('produces nothing when the interval is too short', () => {
    expect(candidateSlots([{ startAt: z('01:00'), endAt: z('01:20') }], 30, 15)).toEqual([]);
  });
});
