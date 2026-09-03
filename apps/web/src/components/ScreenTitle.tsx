/**
 * Screen headings are the one place Bricolage Grotesque is used for running text (§11).
 *
 * The title row also carries what used to be a separate app header. Two stacked title bars —
 * wordmark above, screen name below — spent about a hundred vertical pixels per screen on a
 * phone; the wordmark now appears where it means something (Hari Ini, and login) and the
 * connection indicator rides on the right of this row.
 */

export function ScreenTitle({
  children,
  sub,
  eyebrow,
  actions,
}: {
  children: React.ReactNode;
  sub?: string;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="surface sticky top-0 z-20 px-4 pb-2 pt-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow}
          <h1 className="font-display text-2xl font-bold tracking-tight">{children}</h1>
          {sub && <p className="mt-0.5 text-meta text-muted">{sub}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1 pt-1">{actions}</div>}
      </div>
    </div>
  );
}
