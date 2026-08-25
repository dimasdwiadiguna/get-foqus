/**
 * App header: wordmark, and a quiet connection indicator (§8 — "halus dan tidak mengganggu").
 */

import { Wordmark } from './Wordmark.js';
import { useOnlineStatus } from '../lib/useOnlineStatus.js';

export function AppHeader({ pendingCount = 0 }: { pendingCount?: number }) {
  const online = useOnlineStatus();

  return (
    <header className="surface sticky top-0 z-20 border-b hairline">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <Wordmark className="text-xl" />
        <div className="flex items-center gap-2 text-[11px] text-muted">
          {!online && <span className="rounded-full bg-mist/20 px-2 py-1 font-medium">Luring</span>}
          {pendingCount > 0 && (
            <span className="font-mono tabular-nums" title="Menunggu tersinkron">
              {pendingCount} tertunda
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
