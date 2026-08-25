import { describe, expect, it } from 'vitest';
import { uuidv7 } from '@foqus/core';
import { createAgendaSchema, createTaskSchema, taskSchema } from './dto.js';
import { clockTimeSchema, isoDateSchema, uuidSchema } from './primitives.js';
import { offlineMutationSchema } from './api.js';

describe('primitives', () => {
  it('accepts client-minted UUIDv7 ids (§4)', () => {
    expect(uuidSchema.safeParse(uuidv7()).success).toBe(true);
  });

  it('rejects a non-uuid id', () => {
    expect(uuidSchema.safeParse('not-an-id').success).toBe(false);
  });

  it('holds date-only values to YYYY-MM-DD', () => {
    expect(isoDateSchema.safeParse('2026-08-25').success).toBe(true);
    expect(isoDateSchema.safeParse('2026-08-25T00:00:00Z').success).toBe(false);
  });

  it('allows 24:00 as a window end', () => {
    expect(clockTimeSchema.safeParse('24:00').success).toBe(true);
    expect(clockTimeSchema.safeParse('25:00').success).toBe(false);
  });
});

describe('task DTOs', () => {
  it('requires a non-empty title, in Indonesian', () => {
    const result = createTaskSchema.safeParse({ id: uuidv7(), title: '' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Judul tidak boleh kosong');
  });

  it('accepts a minimal create payload', () => {
    expect(createTaskSchema.safeParse({ id: uuidv7(), title: 'Baca paper' }).success).toBe(true);
  });

  it('caps pomodoro allocation at a sane number', () => {
    expect(taskSchema.shape.allocatedPomodoros.safeParse(0).success).toBe(false);
    expect(taskSchema.shape.allocatedPomodoros.safeParse(4).success).toBe(true);
  });
});

describe('agenda DTOs', () => {
  it('carries the acknowledged override so the API can record it (§5.5, D6)', () => {
    const parsed = createAgendaSchema.parse({
      id: uuidv7(),
      taskId: uuidv7(),
      startAt: '2026-08-25T02:00:00.000Z',
      endAt: '2026-08-25T03:00:00.000Z',
      overrideAcknowledged: true,
      acknowledgedConflicts: ['Menabrak blok Ashar 09:30–10:00'],
    });
    expect(parsed.overrideAcknowledged).toBe(true);
  });

  it('defaults the override flag to false', () => {
    const parsed = createAgendaSchema.parse({
      id: uuidv7(),
      taskId: uuidv7(),
      startAt: '2026-08-25T02:00:00.000Z',
      endAt: '2026-08-25T03:00:00.000Z',
    });
    expect(parsed).toMatchObject({ overrideAcknowledged: false, acknowledgedConflicts: [] });
  });
});

describe('offline mutations (§8)', () => {
  it('accepts only the three kinds allowed offline', () => {
    expect(
      offlineMutationSchema.safeParse({
        kind: 'task_completion',
        taskId: uuidv7(),
        done: true,
        at: '2026-08-25T02:00:00.000Z',
      }).success,
    ).toBe(true);

    expect(
      offlineMutationSchema.safeParse({
        kind: 'task_create',
        taskId: uuidv7(),
      }).success,
    ).toBe(false);
  });
});
