import { describe, expect, it } from 'vitest';
import type { Agenda, AvailabilityWindow, DayOfWeek, ResolvedTimeBlock, Task } from '../types.js';
import type { PrayerBlock } from '../prayer/blocks.js';
import {
  BINDING_KINDS,
  conflictMessages,
  detectViolations,
  isAllowedForSmartAllocation,
  occupiedIntervals,
  requiresOverrideConfirmation,
  type Placement,
  type ViolationContext,
} from './violations.js';

const JKT = 'Asia/Jakarta';
/** Jakarta is UTC+7, so 09:00 local on 2026-08-25 (Tuesday) is 02:00Z. */
const z = (utc: string) => `2026-08-25T${utc}:00.000Z`;

const win = (dayOfWeek: DayOfWeek, startTime = '08:00', endTime = '17:00'): AvailabilityWindow => ({
  id: `w${dayOfWeek}`,
  userId: 'u1',
  createdAt: z('00:00'),
  updatedAt: z('00:00'),
  dayOfWeek,
  startTime,
  endTime,
});

const task: Pick<Task, 'id' | 'categoryId' | 'priority' | 'dueDate'> = {
  id: 't1',
  categoryId: 'cat-work',
  priority: 'P2',
  dueDate: null,
};

const context = (over: Partial<ViolationContext> = {}): ViolationContext => ({
  timezone: JKT,
  windows: [win(2), win(6, '06:00', '20:00')],
  prayerBlocks: [],
  timeBlocks: [],
  existingAgendas: [],
  taskTitles: {},
  externalBusy: [],
  ...over,
});

const placement = (over: Partial<Placement> = {}): Placement => ({
  // 09:00-10:00 Jakarta
  interval: { startAt: z('02:00'), endAt: z('03:00') },
  bufferBeforeMin: 0,
  bufferAfterMin: 10,
  task,
  tagIds: [],
  ...over,
});

describe('a clean placement', () => {
  it('produces no violations at all', () => {
    expect(detectViolations(placement(), context())).toEqual([]);
    expect(isAllowedForSmartAllocation([])).toBe(true);
    expect(requiresOverrideConfirmation([])).toBe(false);
  });
});

describe('availability (§5.5)', () => {
  it('names the day and the exact window it fell outside of — never a generic message', () => {
    // 22:00-23:00 Jakarta on a Tuesday, whose window is 08:00-17:00.
    const conflicts = detectViolations(
      placement({ interval: { startAt: z('15:00'), endAt: z('16:00') } }),
      context(),
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ kind: 'outside_availability' });
    expect(conflicts[0]?.message).toBe('Di luar jam Selasa 08:00–17:00');
  });

  it('flags a placement that only partly overhangs the window', () => {
    // 16:30-17:30 Jakarta — starts inside, ends outside.
    const conflicts = detectViolations(
      placement({ interval: { startAt: z('09:30'), endAt: z('10:30') } }),
      context(),
    );
    expect(conflicts.map((c) => c.kind)).toContain('outside_availability');
  });

  it('says so plainly when the day has no window at all', () => {
    const conflicts = detectViolations(placement(), context({ windows: [win(6)] }));
    expect(conflicts[0]?.message).toBe('Di luar jam Selasa tidak ada jam tersedia');
  });
});

describe('prayer blocks (§5.4, D6)', () => {
  const asr: PrayerBlock = {
    label: 'asr',
    displayName: 'Ashar',
    dateKey: '2026-08-25',
    startAt: z('02:30'),
    endAt: z('03:00'),
  };

  it('names the prayer it collides with', () => {
    const conflicts = detectViolations(placement(), context({ prayerBlocks: [asr] }));
    expect(conflicts).toEqual([
      { kind: 'prayer_block', message: 'Menabrak blok Ashar 09:30–10:00' },
    ]);
  });

  it('is binding for the engine but overridable by hand', () => {
    const conflicts = detectViolations(placement(), context({ prayerBlocks: [asr] }));
    expect(isAllowedForSmartAllocation(conflicts)).toBe(false); // §5.4
    expect(requiresOverrideConfirmation(conflicts)).toBe(true); // §5.5 — dialog, not refusal
  });
});

describe('time blocks (§4.7)', () => {
  const deepWork: ResolvedTimeBlock = {
    timeBlockId: 'tb1',
    title: 'Kerja Dalam',
    startAt: z('01:00'),
    endAt: z('05:00'),
    filter: { categoryIds: ['cat-research'] },
  };

  it('explains which part of the filter failed', () => {
    const conflicts = detectViolations(placement(), context({ timeBlocks: [deepWork] }));
    expect(conflicts).toEqual([
      { kind: 'time_block_filter', message: 'Blok Kerja Dalam — kategori tidak cocok' },
    ]);
  });

  it('stays silent for a task the block welcomes', () => {
    const welcome = { ...deepWork, filter: { categoryIds: ['cat-work'] } };
    expect(detectViolations(placement(), context({ timeBlocks: [welcome] }))).toEqual([]);
  });
});

describe('agenda overlap and buffer (§4.4, §5.3)', () => {
  const other: Agenda = {
    id: 'a-other',
    userId: 'u1',
    taskId: 't-other',
    createdAt: z('00:00'),
    updatedAt: z('00:00'),
    startAt: z('03:05'),
    endAt: z('04:00'),
    bufferBeforeMin: 0,
    bufferAfterMin: 10,
    status: 'planned',
    syncState: 'synced',
  };

  it('treats a gap smaller than the buffer as a collision, and names the other agenda', () => {
    // Placement ends 10:00 with a 10-minute buffer; the next agenda starts 10:05.
    const conflicts = detectViolations(
      placement(),
      context({ existingAgendas: [other], taskTitles: { 't-other': 'Rapat tim' } }),
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.kind).toBe('agenda_overlap');
    expect(conflicts[0]?.message).toBe('Bertabrakan dengan “Rapat tim” 10:05–11:00');
  });

  it('allows a back-to-back placement once the buffer clears', () => {
    const later = { ...other, startAt: z('03:10'), endAt: z('04:00') };
    expect(detectViolations(placement(), context({ existingAgendas: [later] }))).toEqual([]);
  });

  it('does not collide an agenda with itself while it is being moved', () => {
    const self = { ...other, id: 'a-self', startAt: z('02:00'), endAt: z('03:00') };
    expect(
      detectViolations(
        placement({ excludeAgendaId: 'a-self' }),
        context({ existingAgendas: [self] }),
      ),
    ).toEqual([]);
  });

  it('ignores skipped and deleted agendas', () => {
    const skipped = { ...other, status: 'skipped' as const };
    const deleted = { ...other, id: 'a-del', deletedAt: z('01:00') };
    expect(detectViolations(placement(), context({ existingAgendas: [skipped, deleted] }))).toEqual(
      [],
    );
  });
});

describe('external busy (§7)', () => {
  it('reports the overlapping slice of the Google Calendar event', () => {
    const conflicts = detectViolations(
      placement(),
      context({ externalBusy: [{ startAt: z('02:30'), endAt: z('06:00') }] }),
    );
    expect(conflicts).toEqual([
      { kind: 'external_busy', message: 'Bentrok dengan acara Google Calendar 09:30–10:00' },
    ]);
  });
});

describe('advisory violations (D5, §6.5)', () => {
  it('flags a past-due placement without making it binding', () => {
    const conflicts = detectViolations(
      placement({ task: { ...task, dueDate: '2026-08-24' } }),
      context(),
    );
    expect(conflicts).toEqual([{ kind: 'past_due', message: 'Lewat tenggat 24 Agu' }]);
    expect(isAllowedForSmartAllocation(conflicts)).toBe(true);
    expect(BINDING_KINDS.has('past_due')).toBe(false);
  });

  it('accepts a placement that ends on the due date itself', () => {
    expect(
      detectViolations(placement({ task: { ...task, dueDate: '2026-08-25' } }), context()),
    ).toEqual([]);
  });

  it('names an unfinished prerequisite instead of blocking (§5.6)', () => {
    const conflicts = detectViolations(
      placement(),
      context({ unfinishedDependencies: [{ taskId: 't0', title: 'Kumpulkan data' }] }),
    );
    expect(conflictMessages(conflicts)).toEqual(['Prasyarat belum selesai: “Kumpulkan data”']);
    expect(isAllowedForSmartAllocation(conflicts)).toBe(true);
  });
});

describe('multiple violations', () => {
  it('reports every one of them so the override sheet can list them all', () => {
    const conflicts = detectViolations(
      placement({ interval: { startAt: z('15:00'), endAt: z('16:00') } }),
      context({
        prayerBlocks: [
          {
            label: 'isha',
            displayName: 'Isya',
            dateKey: '2026-08-25',
            startAt: z('15:00'),
            endAt: z('15:30'),
          },
        ],
        externalBusy: [{ startAt: z('15:40'), endAt: z('16:00') }],
      }),
    );
    expect(conflicts.map((c) => c.kind).sort()).toEqual([
      'external_busy',
      'outside_availability',
      'prayer_block',
    ]);
  });
});

describe('occupiedIntervals', () => {
  it('merges agendas, prayer blocks and busy time into one blocked set', () => {
    const agenda: Agenda = {
      id: 'a1',
      userId: 'u1',
      taskId: 't9',
      createdAt: z('00:00'),
      updatedAt: z('00:00'),
      startAt: z('02:00'),
      endAt: z('03:00'),
      bufferBeforeMin: 0,
      bufferAfterMin: 10,
      status: 'planned',
      syncState: 'synced',
    };
    expect(
      occupiedIntervals(
        context({
          existingAgendas: [agenda],
          externalBusy: [{ startAt: z('03:10'), endAt: z('04:00') }],
        }),
      ),
    ).toEqual([{ startAt: z('02:00'), endAt: z('04:00') }]);
  });
});
