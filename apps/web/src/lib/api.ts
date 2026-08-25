/**
 * HTTP client for the FOQUS API.
 *
 * Session lives in an httpOnly cookie, so every request is `credentials: 'include'` and the
 * client never holds a token of its own (§7). A 401 is not an error to show — it means the
 * session lapsed, and the caller routes to the login screen.
 */

import type { Bootstrap, SessionUser } from '@foqus/shared';

export class ApiError extends Error {
  constructor(
    override readonly message: string,
    readonly status: number,
    readonly code = 'unknown',
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class UnauthenticatedError extends ApiError {
  constructor(message = 'Sesi berakhir. Silakan masuk lagi.') {
    super(message, 401, 'unauthenticated');
    this.name = 'UnauthenticatedError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    headers: { accept: 'application/json', ...(init.headers ?? {}) },
    ...init,
  });

  if (response.status === 401) throw new UnauthenticatedError();

  if (!response.ok) {
    let message = 'Terjadi kesalahan. Coba lagi.';
    let code = String(response.status);
    try {
      const body = (await response.json()) as { error?: { message?: string; code?: string } };
      if (body.error?.message) message = body.error.message;
      if (body.error?.code) code = body.error.code;
    } catch {
      // A non-JSON body (an HTML error page from the platform, say) — keep the generic message.
    }
    if (code === 'FUNCTION_INVOCATION_FAILED') {
      // Vercel's own error, not ours: the function crashed before any FOQUS code ran. Almost
      // always a module that could not be loaded, or a missing build step (DECISIONS T18).
      message = 'Fungsi server gagal dijalankan. Periksa log Vercel.';
    }
    throw new ApiError(message, response.status, code);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  health: () => request<{ ok: boolean; time: string }>('/api/health'),
  me: () => request<SessionUser>('/api/auth/me'),
  bootstrap: () => request<Bootstrap>('/api/bootstrap'),
  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
};

/** Full-page navigation, not fetch: the OAuth flow is a browser redirect (§7). */
export function startGoogleLogin(): void {
  window.location.href = '/api/auth/google/start';
}
