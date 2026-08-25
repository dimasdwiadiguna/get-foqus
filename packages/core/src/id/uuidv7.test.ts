import { describe, expect, it } from 'vitest';
import { uuidv7, uuidv7Timestamp } from './uuidv7.js';

const zeroBytes = (length: number) => new Uint8Array(length);

describe('uuidv7', () => {
  it('produces a well-formed v7 uuid with the RFC 9562 variant bits', () => {
    const id = uuidv7();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('embeds the millisecond timestamp so ids are time-sortable', () => {
    const now = 1_756_000_000_000;
    expect(uuidv7Timestamp(uuidv7({ now }))).toBe(now);
  });

  it('keeps creation order for ids minted inside the same millisecond', () => {
    const now = 1_756_000_000_000;
    const ids = Array.from({ length: 50 }, () => uuidv7({ now, randomBytes: zeroBytes }));
    expect([...ids].sort()).toEqual(ids);
  });

  it('sorts later timestamps after earlier ones', () => {
    const earlier = uuidv7({ now: 1_700_000_000_000, randomBytes: zeroBytes });
    const later = uuidv7({ now: 1_800_000_000_000, randomBytes: zeroBytes });
    expect(earlier < later).toBe(true);
  });
});
