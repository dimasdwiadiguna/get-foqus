/**
 * UUIDv7 generated on the client (BRIEF §4) so an offline mutation never needs a
 * round-trip to learn its own id.
 *
 * Implemented here rather than pulled from a package: it is ~30 lines of pure code and
 * `packages/core` is meant to stay dependency-light. Layout per RFC 9562 §5.7 —
 * 48-bit big-endian Unix milliseconds, 4-bit version, 12-bit sub-millisecond counter,
 * 2-bit variant, 62 bits of randomness.
 */

const HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

let lastTimestamp = -1;
let counter = 0;

export interface Uuidv7Options {
  /** Unix milliseconds. Defaults to `Date.now()`. Injectable so tests stay deterministic. */
  now?: number;
  /** Random byte source. Defaults to `crypto.getRandomValues`. */
  randomBytes?: (length: number) => Uint8Array;
}

function defaultRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Monotonic within a single millisecond: ids minted in the same millisecond keep their
 * creation order, which is what makes UUIDv7 usable as a database sort key.
 */
export function uuidv7(options: Uuidv7Options = {}): string {
  const timestamp = options.now ?? Date.now();
  const randomBytes = options.randomBytes ?? defaultRandomBytes;

  if (timestamp === lastTimestamp) {
    counter += 1;
  } else {
    lastTimestamp = timestamp;
    counter = 0;
  }
  // The counter field is 12 bits; past 4096 ids in one millisecond we fall back to
  // pure randomness for the ordering bits rather than colliding.
  const seq = counter & 0xfff;

  const bytes = new Uint8Array(16);
  bytes[0] = (timestamp / 2 ** 40) & 0xff;
  bytes[1] = (timestamp / 2 ** 32) & 0xff;
  bytes[2] = (timestamp / 2 ** 24) & 0xff;
  bytes[3] = (timestamp / 2 ** 16) & 0xff;
  bytes[4] = (timestamp / 2 ** 8) & 0xff;
  bytes[5] = timestamp & 0xff;

  bytes[6] = 0x70 | ((seq >> 8) & 0x0f); // version 7 + counter high nibble
  bytes[7] = seq & 0xff;

  const random = randomBytes(8);
  bytes[8] = 0x80 | ((random[0] ?? 0) & 0x3f); // variant 10xx
  for (let i = 1; i < 8; i += 1) {
    bytes[8 + i] = random[i] ?? 0;
  }

  const hex = (index: number) => HEX[bytes[index] ?? 0] ?? '00';
  return (
    hex(0) +
    hex(1) +
    hex(2) +
    hex(3) +
    '-' +
    hex(4) +
    hex(5) +
    '-' +
    hex(6) +
    hex(7) +
    '-' +
    hex(8) +
    hex(9) +
    '-' +
    hex(10) +
    hex(11) +
    hex(12) +
    hex(13) +
    hex(14) +
    hex(15)
  );
}

/** Reads the embedded Unix-millisecond timestamp back out of a UUIDv7. */
export function uuidv7Timestamp(id: string): number {
  const hex = id.replace(/-/g, '').slice(0, 12);
  return Number.parseInt(hex, 16);
}
