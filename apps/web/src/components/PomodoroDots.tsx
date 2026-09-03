/**
 * The ○ / ● / ⬤ series (§4.5, §11).
 *
 * Rendered as elements rather than as `'○'.repeat(n)` text: repeated glyphs give a width that
 * depends on the font, and eight of them eat a task row. Long series collapse to a count, so a
 * task allocated twelve pomodoros never pushes its own title out of the row.
 *
 * One `aria-label` for the whole series — a screen reader should hear "2 dari 4 pomodoro", not
 * four separate dots. Overflow past the allocation is drawn with a ring, never as a failure (§4.5).
 */

const MAX_VISIBLE = 5;

export function PomodoroDots({
  allocated,
  completed = 0,
  className = '',
}: {
  allocated: number;
  completed?: number;
  className?: string;
}) {
  const total = Math.max(allocated, completed);
  const overflow = Math.max(0, completed - allocated);
  const label =
    overflow > 0
      ? `${completed} dari ${allocated} pomodoro, ${overflow} melebihi alokasi`
      : `${completed} dari ${allocated} pomodoro`;

  if (total > MAX_VISIBLE) {
    return (
      <span
        className={`inline-flex items-center gap-1 font-mono text-label tabular-nums ${className}`}
        aria-label={label}
      >
        <Dot state={completed > 0 ? 'done' : 'todo'} />
        <span aria-hidden="true">
          {completed}/{allocated}
        </span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 ${className}`} aria-label={label}>
      {Array.from({ length: total }, (_, index) => (
        <Dot
          key={index}
          state={index >= allocated ? 'extra' : index < completed ? 'done' : 'todo'}
        />
      ))}
    </span>
  );
}

function Dot({ state }: { state: 'todo' | 'done' | 'extra' }) {
  const base = 'inline-block h-1.5 w-1.5 rounded-full';
  const style =
    state === 'done'
      ? 'bg-current'
      : state === 'extra'
        ? 'bg-current ring-1 ring-current ring-offset-1 ring-offset-transparent'
        : 'border border-current opacity-45';
  return <span className={`${base} ${style}`} aria-hidden="true" />;
}
