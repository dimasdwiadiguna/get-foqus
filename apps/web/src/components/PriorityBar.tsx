/**
 * Priority as a colour bar on the row's leading edge, not as the literal text "P1".
 *
 * "P1" spelled out is a glyph the user has to decode, and it occupies the leading slot that M1
 * needs for a completion checkbox. A 3px bar reads at a glance and costs no horizontal space;
 * the meaning stays available to assistive tech through the label.
 */

import type { Priority } from '@foqus/core';

const TINT: Record<Priority, string> = {
  P1: 'bg-ember',
  P2: 'bg-tea',
  P3: 'bg-mist',
  P4: 'bg-transparent',
};

const LABEL: Record<Priority, string> = {
  P1: 'Prioritas 1, tertinggi',
  P2: 'Prioritas 2',
  P3: 'Prioritas 3',
  P4: 'Prioritas 4, terendah',
};

export function PriorityBar({ priority }: { priority: Priority }) {
  return (
    <span
      className={`absolute inset-y-1 left-0 w-[3px] rounded-full ${TINT[priority] ?? TINT.P3}`}
      role="img"
      aria-label={LABEL[priority] ?? LABEL.P3}
    />
  );
}
