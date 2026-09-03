/**
 * Empty states carry the product's tone: calm, firm, never scolding (§1).
 *
 * They speak to the person using FOQUS, not to the person building it — "milestone" is a word
 * from the build plan, not from the user's day. Where a screen is genuinely unfinished it still
 * says so plainly (DECISIONS U1), just in the user's vocabulary.
 */
export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-4 rounded-2xl border border-dashed hairline px-4 py-8 text-center">
      <p className="font-display text-base font-semibold">{title}</p>
      <p className="mt-2 text-meta text-muted">{body}</p>
    </div>
  );
}
