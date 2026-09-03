/**
 * Connection state, quiet and out of the way (§8 — "halus dan tidak mengganggu").
 *
 * It rides along in the screen title rather than in a bar of its own: a dedicated header row
 * cost ~56px on every screen to show two words that are usually absent.
 *
 * Reads the cached bootstrap directly rather than taking a prop — TanStack Query already holds
 * it, so this costs no request and saves threading a count through four screens.
 */

import { useBootstrap } from '../lib/queries.js';
import { useOnlineStatus } from '../lib/useOnlineStatus.js';

export function ConnectionStatus() {
  const online = useOnlineStatus();
  const bootstrap = useBootstrap();
  const pending = bootstrap.data?.pendingSyncCount ?? 0;

  if (online && pending === 0) return null;

  return (
    <div className="flex items-center gap-2 text-label text-muted">
      {!online && <span className="rounded-full bg-mist/20 px-2 py-1 font-medium">Luring</span>}
      {pending > 0 && <span className="font-mono tabular-nums">{pending} tertunda</span>}
    </div>
  );
}
