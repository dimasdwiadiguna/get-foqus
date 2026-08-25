/**
 * `@foqus/shared` — the API contract, expressed once as Zod schemas and shared by the client
 * and the serverless function (§3). Validation happens at the API boundary and nowhere else.
 */

export * from './primitives.js';
export * from './dto.js';
export * from './api.js';
