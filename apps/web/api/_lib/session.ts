/**
 * FOQUS session (§7).
 *
 * The browser holds a signed JWT in an httpOnly cookie — FOQUS's own session, unrelated to
 * Google's tokens. `SameSite=Lax` is what lets the OAuth redirect land back with the cookie
 * intact; `Secure` is on everywhere except plain-HTTP localhost.
 */

import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { sign, verify } from 'hono/jwt';
import { isProduction } from './env.js';

export const SESSION_COOKIE = 'foqus_session';
export const OAUTH_STATE_COOKIE = 'foqus_oauth_state';

const SESSION_TTL_SEC = 60 * 60 * 24 * 60; // 60 days — a single-user app, re-login is friction

/** HMAC-SHA256. Pinned explicitly so a token can never be accepted under a different alg. */
const SESSION_ALG = 'HS256' as const;

export interface SessionClaims {
  sub: string; // FOQUS user id
  email: string;
  exp: number;
  iat: number;
}

export async function issueSession(
  c: Context,
  secret: string,
  user: { id: string; email: string },
) {
  const now = Math.floor(Date.now() / 1000);
  const token = await sign(
    { sub: user.id, email: user.email, iat: now, exp: now + SESSION_TTL_SEC },
    secret,
    SESSION_ALG,
  );
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_TTL_SEC,
  });
}

export async function readSession(c: Context, secret: string): Promise<SessionClaims | null> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  try {
    return (await verify(token, secret, SESSION_ALG)) as unknown as SessionClaims;
  } catch {
    return null;
  }
}

export function clearSession(c: Context) {
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

export function setOAuthState(c: Context, state: string) {
  setCookie(c, OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'Lax',
    path: '/',
    maxAge: 600, // the round trip to Google should take seconds, not hours
  });
}

export function takeOAuthState(c: Context): string | null {
  const state = getCookie(c, OAUTH_STATE_COOKIE) ?? null;
  deleteCookie(c, OAUTH_STATE_COOKIE, { path: '/' });
  return state;
}
