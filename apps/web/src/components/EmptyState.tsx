/**
 * Empty states carry the product's tone: calm, firm, never scolding (§1).
 * They also say what the next milestone brings, so a half-built screen is honest rather than broken.
 */
export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-4 rounded-2xl border border-dashed hairline px-4 py-8 text-center">
      <p className="font-display text-base font-semibold">{title}</p>
      <p className="mt-2 text-sm text-muted">{body}</p>
    </div>
  );
}
