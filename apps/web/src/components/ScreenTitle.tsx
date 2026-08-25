/** Screen headings are the one place Bricolage Grotesque is used for running text (§11). */
export function ScreenTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="px-4 pb-2 pt-5">
      <h1 className="font-display text-2xl font-bold tracking-tight">{children}</h1>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </div>
  );
}
