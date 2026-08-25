/**
 * The FOQUS API — one Vercel function, all routes (BRIEF §3).
 *
 * M0 covers health, the Google OAuth flow, session, and bootstrap. Later milestones add task,
 * agenda and sync routes here; nothing about the shape changes.
 *
 * Constraints this file is written under (D13, §12):
 *  - no module-level mutable state that correctness depends on — the next request may land on a
 *    different instance;
 *  - no filesystem writes;
 *  - every handler must finish well inside the 10-second Hobby limit.
 */

import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { HTTPException } from 'hono/http-exception';
import { createMiddleware } from 'hono/factory';
import { eq } from 'drizzle-orm';
import { getDatabase, googleAccounts, users } from '@foqus/db';
import { seedUser } from '@foqus/db/seed';
import { uuidv7 } from '@foqus/core';
import { buildBootstrap } from './_lib/bootstrap.js';
import { encryptSecret, randomToken } from './_lib/crypto.js';
import { readEnv } from './_lib/env.js';
import { buildAuthUrl, exchangeCode, fetchProfile } from './_lib/google.js';
import {
  clearSession,
  issueSession,
  readSession,
  setOAuthState,
  takeOAuthState,
  type SessionClaims,
} from './_lib/session.js';

export const config = { runtime: 'nodejs' };

type Variables = { session: SessionClaims };

const app = new Hono<{ Variables: Variables }>().basePath('/api');

/* --------------------------------------------------------------------- error */

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return c.json({ error: { code: String(error.status), message: error.message } }, error.status);
  }
  console.error('[foqus:api]', error);
  return c.json(
    { error: { code: 'internal', message: 'Terjadi kesalahan di server. Coba lagi.' } },
    500,
  );
});

/* -------------------------------------------------------------------- health */

app.get('/health', (c) =>
  c.json({
    ok: true,
    service: 'FOQUS',
    time: new Date().toISOString(),
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  }),
);

/* ---------------------------------------------------------------------- auth */

app.get('/auth/google/start', (c) => {
  const env = readEnv();
  const state = randomToken();
  setOAuthState(c, state);
  return c.redirect(
    buildAuthUrl({
      clientId: env.GOOGLE_CLIENT_ID,
      redirectUri: env.GOOGLE_REDIRECT_URI,
      state,
    }),
  );
});

app.get('/auth/google/callback', async (c) => {
  const env = readEnv();
  const code = c.req.query('code');
  const state = c.req.query('state');
  const expectedState = takeOAuthState(c);
  const oauthError = c.req.query('error');

  if (oauthError) {
    return c.redirect(`${env.APP_URL}/masuk?error=${encodeURIComponent(oauthError)}`);
  }
  if (!code) {
    throw new HTTPException(400, { message: 'Kode otorisasi Google tidak ada.' });
  }
  // CSRF: the state we handed to Google must be the one that comes back.
  if (!state || !expectedState || state !== expectedState) {
    throw new HTTPException(400, { message: 'State OAuth tidak cocok. Coba masuk lagi.' });
  }

  const tokens = await exchangeCode({
    code,
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_REDIRECT_URI,
  });
  const profile = await fetchProfile(tokens.accessToken);

  const db = getDatabase(env.DATABASE_URL);
  const existing = await db.select().from(users).where(eq(users.googleSub, profile.sub)).limit(1);

  const now = new Date().toISOString();
  let userId = existing[0]?.id;

  if (!userId) {
    userId = uuidv7();
    await db.insert(users).values({
      id: userId,
      email: profile.email,
      name: profile.name ?? null,
      pictureUrl: profile.picture ?? null,
      googleSub: profile.sub,
    });
  } else {
    await db
      .update(users)
      .set({
        email: profile.email,
        name: profile.name ?? null,
        pictureUrl: profile.picture ?? null,
        updatedAt: now,
      })
      .where(eq(users.id, userId));
  }

  /**
   * Google only returns a refresh token on a consent-granting exchange. When it withholds one
   * (a repeat login), keep the ciphertext already on file rather than overwriting it with
   * nothing — losing it would silently break every future Calendar push.
   */
  if (tokens.refreshToken) {
    const encrypted = await encryptSecret(tokens.refreshToken, env.TOKEN_ENC_KEY);
    await db
      .insert(googleAccounts)
      .values({ userId, refreshTokenEncrypted: encrypted, scopes: tokens.scopes })
      .onConflictDoUpdate({
        target: googleAccounts.userId,
        set: { refreshTokenEncrypted: encrypted, scopes: tokens.scopes, updatedAt: now },
      });
  }

  await seedUser(db, userId);
  await issueSession(c, env.SESSION_SECRET, { id: userId, email: profile.email });
  return c.redirect(env.APP_URL || '/');
});

app.post('/auth/logout', (c) => {
  clearSession(c);
  return c.json({ ok: true });
});

/* ----------------------------------------------------------------- protected */

const requireSession = createMiddleware<{ Variables: Variables }>(async (c, next) => {
  const env = readEnv();
  const session = await readSession(c, env.SESSION_SECRET);
  if (!session) {
    throw new HTTPException(401, { message: 'Sesi berakhir. Silakan masuk lagi.' });
  }
  c.set('session', session);
  await next();
});

app.use('/auth/me', requireSession);
app.use('/bootstrap', requireSession);

app.get('/auth/me', async (c) => {
  const env = readEnv();
  const session = c.get('session');
  const db = getDatabase(env.DATABASE_URL);
  const [user] = await db.select().from(users).where(eq(users.id, session.sub)).limit(1);
  if (!user) throw new HTTPException(401, { message: 'Pengguna tidak ditemukan.' });
  const [google] = await db
    .select()
    .from(googleAccounts)
    .where(eq(googleAccounts.userId, user.id))
    .limit(1);
  return c.json({
    id: user.id,
    email: user.email,
    name: user.name,
    pictureUrl: user.pictureUrl,
    googleConnected: Boolean(google),
    agendaCalendarId: google?.agendaCalendarId ?? null,
  });
});

app.get('/bootstrap', async (c) => {
  const env = readEnv();
  const session = c.get('session');
  const db = getDatabase(env.DATABASE_URL);
  return c.json(await buildBootstrap(db, session.sub));
});

/* ------------------------------------------------------------------ fallback */

app.all('*', (c) =>
  c.json({ error: { code: 'not_found', message: 'Rute tidak ditemukan.' } }, 404),
);

export default handle(app);
