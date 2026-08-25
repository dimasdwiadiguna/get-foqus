/**
 * The day ribbon — FOQUS's signature element (BRIEF §11).
 *
 * One continuous vertical ribbon is one day. What makes it different from a 24-hour grid:
 *  - **prayer times are fixed notches** at the ribbon's edge, so the day reads as five natural
 *    segments rather than uniform hours;
 *  - **buffer is drawn as diagonal hatching**, never as empty space — the gap is protected on
 *    purpose, not a hole waiting to be filled;
 *  - pomodoro dots live *inside* the agenda block.
 *
 * M0 renders the ribbon with prayer notches and the unavailable regions. Agenda blocks and
 * pomodoro dots arrive with M2/M4; the props are already shaped for them.
 */

import { useMemo } from 'react';
import {
  PRAYER_LABELS,
  formatTime,
  localClockTime,
  localTimeOn,
  type ISODate,
  type PrayerBlock,
  type TimeZone,
} from '@foqus/core';
import type { Interval } from '@foqus/core';

/**
 * Diagonal hatching for buffer (§11): the gap is protected on purpose, not empty space.
 * A CSS gradient rather than an SVG `<pattern>` — a pattern id cannot be referenced from a
 * CSS `background` on an HTML element, only from SVG paint attributes.
 */
const BUFFER_HATCH =
  'repeating-linear-gradient(45deg, color-mix(in oklab, var(--color-tea) 32%, transparent) 0 2px, transparent 2px 7px)';

export interface RibbonAgenda {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  colorHex?: string;
  allocatedPomodoros: number;
  completedPomodoros: number;
}

export interface DayRibbonProps {
  dateKey: ISODate;
  timezone: TimeZone;
  /** Visible clock range. Defaults to a full day. */
  fromTime?: string;
  toTime?: string;
  prayerBlocks: PrayerBlock[];
  unavailable: Interval[];
  agendas?: RibbonAgenda[];
  now?: string;
  pxPerHour?: number;
}

export function DayRibbon({
  dateKey,
  timezone,
  fromTime = '04:00',
  toTime = '23:00',
  prayerBlocks,
  unavailable,
  agendas = [],
  now,
  pxPerHour = 56,
}: DayRibbonProps) {
  const start = useMemo(
    () => localTimeOn(dateKey, fromTime, timezone).getTime(),
    [dateKey, fromTime, timezone],
  );
  const end = useMemo(
    () => localTimeOn(dateKey, toTime, timezone).getTime(),
    [dateKey, toTime, timezone],
  );
  const totalMs = Math.max(1, end - start);
  const height = ((totalMs / 3_600_000) * pxPerHour) | 0;

  const toY = (instant: string | number) => {
    const value = typeof instant === 'number' ? instant : new Date(instant).getTime();
    return ((value - start) / totalMs) * height;
  };

  const hourMarks = useMemo(() => {
    const marks: { y: number; label: string }[] = [];
    for (let t = start; t <= end; t += 3_600_000) {
      marks.push({ y: toY(t), label: localClockTime(new Date(t), timezone) });
    }
    return marks;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, height, timezone]);

  const nowY =
    now && new Date(now).getTime() >= start && new Date(now).getTime() <= end ? toY(now) : null;

  return (
    <div className="px-4">
      <div className="relative flex" style={{ height }}>
        {/* Hour labels, in Martian Mono — data type, not UI type (§11). */}
        <div className="relative w-12 shrink-0">
          {hourMarks.map((mark) => (
            <span
              key={mark.label}
              className="absolute right-2 -translate-y-1/2 font-mono text-[10px] text-muted tabular-nums"
              style={{ top: mark.y }}
            >
              {mark.label}
            </span>
          ))}
        </div>

        {/* The ribbon itself. */}
        <div className="relative flex-1 overflow-hidden rounded-xl border hairline surface-raised">
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden="true"
            role="presentation"
          >
            {hourMarks.map((mark) => (
              <line
                key={mark.label}
                x1="0"
                x2="100%"
                y1={mark.y}
                y2={mark.y}
                stroke="var(--line)"
                strokeWidth="1"
              />
            ))}
          </svg>

          {/* Outside available hours — dimmed, with the reason available on hover/focus (§10.5). */}
          {unavailable.map((interval) => {
            const top = Math.max(0, toY(interval.startAt));
            const bottom = Math.min(height, toY(interval.endAt));
            if (bottom <= 0 || top >= height) return null;
            return (
              <div
                key={`off-${interval.startAt}`}
                className="absolute inset-x-0 bg-mist/25"
                style={{ top, height: Math.max(0, bottom - top) }}
                title="Di luar jam tersedia"
              />
            );
          })}

          {/* Prayer blocks: soft blocks the engine avoids, the user may override (D6, §4.8). */}
          {prayerBlocks.map((block) => {
            const top = toY(block.startAt);
            const bottom = toY(block.endAt);
            if (bottom <= 0 || top >= height) return null;
            return (
              <div
                key={block.label}
                className="absolute inset-x-0 border-y border-dusk/40 bg-dusk/15"
                style={{ top, height: Math.max(6, bottom - top) }}
              >
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-dusk">
                  {PRAYER_LABELS[block.label]}
                </span>
              </div>
            );
          })}

          {agendas.map((agenda) => {
            const bufferTop = toY(
              new Date(
                new Date(agenda.startAt).getTime() - agenda.bufferBeforeMin * 60_000,
              ).toISOString(),
            );
            const top = toY(agenda.startAt);
            const bottom = toY(agenda.endAt);
            const bufferBottom = toY(
              new Date(
                new Date(agenda.endAt).getTime() + agenda.bufferAfterMin * 60_000,
              ).toISOString(),
            );
            return (
              <div key={agenda.id}>
                {bufferTop < top && (
                  <div
                    className="absolute inset-x-1 rounded-t-lg"
                    style={{ top: bufferTop, height: top - bufferTop, background: BUFFER_HATCH }}
                    title={`Buffer ${agenda.bufferBeforeMin} menit`}
                  />
                )}
                <div
                  // Never render a target too small to touch (§10.10): 44px floor, label clipped.
                  className="absolute inset-x-1 overflow-hidden rounded-lg bg-tea px-2 py-1 text-paper"
                  style={{ top, height: Math.max(44, bottom - top) }}
                >
                  <p className="truncate text-xs font-semibold">{agenda.title}</p>
                  <p className="flex items-center gap-2 font-mono text-[10px] opacity-80">
                    <span>
                      {formatTime(agenda.startAt, timezone)}–{formatTime(agenda.endAt, timezone)}
                    </span>
                    {/* Pomodoro dots live inside the block and fill in as sessions complete (§11). */}
                    <span
                      aria-label={`${agenda.completedPomodoros} dari ${agenda.allocatedPomodoros} pomodoro`}
                    >
                      {'●'.repeat(Math.min(agenda.completedPomodoros, agenda.allocatedPomodoros))}
                      {'○'.repeat(
                        Math.max(0, agenda.allocatedPomodoros - agenda.completedPomodoros),
                      )}
                    </span>
                  </p>
                </div>
                {bufferBottom > bottom && (
                  <div
                    className="absolute inset-x-1 rounded-b-lg"
                    style={{ top: bottom, height: bufferBottom - bottom, background: BUFFER_HATCH }}
                    title={`Buffer ${agenda.bufferAfterMin} menit`}
                  />
                )}
              </div>
            );
          })}

          {nowY !== null && (
            <div className="absolute inset-x-0 z-10 flex items-center" style={{ top: nowY }}>
              <span className="h-2 w-2 rounded-full bg-ember" />
              <span className="h-px flex-1 bg-ember" />
            </div>
          )}
        </div>

        {/* Prayer notches on the ribbon's outer edge — the anchors that never move (§11). */}
        <div className="relative w-3 shrink-0">
          {prayerBlocks.map((block) => (
            <span
              key={`notch-${block.label}`}
              className="absolute left-0 h-0.5 w-2.5 rounded-full bg-dusk"
              style={{ top: toY(block.startAt) }}
              title={`${PRAYER_LABELS[block.label]} ${formatTime(block.startAt, timezone)}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
