/**
 * Google OAuth and token exchange (§7, D10).
 *
 * One consent step covers sign-in *and* Calendar access, so onboarding is a single tap.
 *
 * Vercel trap, repeated from the brief: every preview deployment gets its own URL, and Google
 * rejects any redirect URI that is not registered. FOQUS therefore uses **one fixed redirect
 * URI on the production domain** (`GOOGLE_REDIRECT_URI`) — see README.
 */

import { GOOGLE_OAUTH_SCOPES } from '@foqus/core';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiresInSec: number;
  scopes: string[];
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

export function buildAuthUrl(options: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: options.clientId,
    redirect_uri: options.redirectUri,
    response_type: 'code',
    scope: GOOGLE_OAUTH_SCOPES.join(' '),
    state: options.state,
    // `offline` + `consent` is what actually returns a refresh token; without `prompt=consent`
    // Google only issues one on the very first authorisation, which makes re-linking silently fail.
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export async function exchangeCode(options: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<GoogleTokens> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: options.code,
      client_id: options.clientId,
      client_secret: options.clientSecret,
      redirect_uri: options.redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    throw new Error(`Gagal menukar kode Google: ${response.status} ${await response.text()}`);
  }

  const body = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
  };

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresInSec: body.expires_in,
    scopes: body.scope ? body.scope.split(' ') : GOOGLE_OAUTH_SCOPES,
  };
}

/** Exchanges a stored refresh token for a short-lived access token. Never leaves the server. */
export async function refreshAccessToken(options: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ accessToken: string; expiresInSec: number }> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: options.refreshToken,
      client_id: options.clientId,
      client_secret: options.clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error(`Gagal memperbarui token Google: ${response.status} ${await response.text()}`);
  }

  const body = (await response.json()) as { access_token: string; expires_in: number };
  return { accessToken: body.access_token, expiresInSec: body.expires_in };
}

export async function fetchProfile(accessToken: string): Promise<GoogleProfile> {
  const response = await fetch(USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Gagal membaca profil Google: ${response.status}`);
  }
  return (await response.json()) as GoogleProfile;
}
