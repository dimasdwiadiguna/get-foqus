/**
 * `packages/core` is environment-agnostic by design (BRIEF §3): no DOM lib, no `@types/node`,
 * so it compiles identically for the browser, a Vercel function, and Vitest.
 *
 * It touches exactly one platform global — WebCrypto, as the default random source in
 * `uuidv7()` — declared here rather than by widening `lib`, which would also make `document`
 * and friends silently available.
 */
declare const crypto: {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
};
