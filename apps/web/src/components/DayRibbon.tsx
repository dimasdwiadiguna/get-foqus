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
 * Three layout rules earn their complexity here:
 *
 *  1. **The ribbon scrolls itself and lands on "now".** A full 04:00–23:00 day at 56px/hour is
 *     over a thousand pixels; sharing the page's scroll meant a phone opened on 4am and the
 *     user had to hunt for the current hour.
 *  2. **Long stretches outside available hours collapse** to a labelled band that can be tapped
 *     open. Nothing is hidden — the hours are named — but dead time stops costing screen.
 *  3. **Overlapping agendas share the width.** A 15-minute block is floored to 44px so it stays
 *     touchable (§10.10), and that floor is exactly what used to make short blocks cover their
 *     neighbours. Blocks that overlap *visually* are split into columns.
 *
 * Reasons are rendered as text, never as `title=` tooltips: a tooltip does not exist on a
 * touch screen, and §10.5 requires the dimmed areas to say why they are dimmed.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PRAYER_LABELS,
  formatTime,
  localClockTime,
  localTimeOn,
  type ISODate,
  type PrayerBlock,
  type TimeZone,
} from '@foqus/core';
import { makeInterval, subtract, type Interval } from '@foqus/core';
import { PomodoroDots } from './PomodoroDots.js';

/**
 * Diagonal hatching for buffer (§11): the gap is protected on purpose, not empty space.
 * A CSS gradient rather than an SVG `<pattern>` — a pattern id cannot be referenced from a
 * CSS `background` on an HTML element, only from SVG paint attributes.
 */
const BUFFER_HATCH =
  'repeating-linear-gradient(45deg, color-mix(in oklab, var(--color-tea) 32%, transparent) 0 2px, transparent 2px 7px)';

/** Below this, collapsing an unavailable stretch saves less than the band itself costs. */
const MIN_COLLAPSE_MIN = 45;
const COLLAPSED_PX = 34;
/** Left gutter inside the ribbon, reserved for prayer labels so agendas never cover them. */
const LABEL_GUTTER_PX = 54;
const MIN_BLOCK_PX = 44;

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
  /** Cap on the ribbon's own scroll viewport. */
  maxHeight?: string;
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
  maxHeight = '58vh',
}: DayRibbonProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  const start = useMemo(
    () => localTimeOn(dateKey, fromTime, timezone).getTime(),
    [dateKey, fromTime, timezone],
  );
  const end = useMemo(
    () => localTimeOn(dateKey, toTime, timezone).getTime(),
    [dateKey, toTime, timezone],
  );

  /** Stretches outside available hours that hold nothing, so nothing is lost by folding them. */
  const collapsible = useMemo(
    () => findCollapsible({ start, end, unavailable, prayerBlocks, agendas }),
    [start, end, unavailable, prayerBlocks, agendas],
  );

  const collapsed = collapsible.filter((band) => !expanded.has(band.key));
  const scale = useMemo(
    () => buildScale({ start, end, pxPerHour, collapsed }),
    // `collapsed` is derived; its identity changes with `expanded`, which is the intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [start, end, pxPerHour, collapsed.map((band) => band.key).join('|')],
  );
  const { toY, height } = scale;

  const hourMarks = useMemo(() => {
    const marks: { y: number; label: string; key: string }[] = [];
    for (let t = start; t <= end; t += 3_600_000) {
      // A label inside a folded band would sit on top of the band's own caption.
      if (collapsed.some((band) => t > band.from && t < band.to)) continue;
      marks.push({ y: toY(t), label: localClockTime(new Date(t), timezone), key: String(t) });
    }
    return marks;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, height, timezone, scale]);

  const nowMs = now ? new Date(now).getTime() : null;
  const nowY = nowMs !== null && nowMs >= start && nowMs <= end ? toY(nowMs) : null;

  // Land on the current hour rather than on the top of the day.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || nowY === null) return;
    const target = Math.max(0, nowY - container.clientHeight / 2);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    container.scrollTo({ top: target, behavior: reduced ? 'auto' : 'smooth' });
    // Only on a change of day: re-centring every clock tick would fight the user's own scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey]);

  const placed = useMemo(
    () => layoutAgendas(agendas, toY),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agendas, scale],
  );

  const toggle = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  return (
    <div className="px-4">
      <div
        ref={scrollRef}
        className="relative overflow-y-auto overscroll-contain"
        style={{ maxHeight }}
      >
        <div className="relative flex" style={{ height }}>
          {/* Hour labels, in Martian Mono — data type, not UI type (§11). */}
          <div className="relative w-12 shrink-0">
            {hourMarks.map((mark) => (
              <span
                key={mark.key}
                // The first mark sits at y=0, where centring it would clip half the label off
                // the top of the ribbon.
                className={`absolute right-2 font-mono text-label text-muted tabular-nums ${
                  mark.y < 8 ? '' : '-translate-y-1/2'
                }`}
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
                  key={mark.key}
                  x1="0"
                  x2="100%"
                  y1={mark.y}
                  y2={mark.y}
                  stroke="var(--line)"
                  strokeWidth="1"
                />
              ))}
            </svg>

            {/* Outside available hours. The reason is written on the band, not in a tooltip. */}
            {unavailable.map((interval) => {
              const top = Math.max(0, toY(interval.startAt));
              const bottom = Math.min(height, toY(interval.endAt));
              if (bottom <= 0 || top >= height) return null;
              return (
                <div
                  key={`off-${interval.startAt}`}
                  className="absolute inset-x-0 bg-mist/25"
                  style={{ top, height: Math.max(0, bottom - top) }}
                >
                  {bottom - top >= 24 && (
                    /* Right-aligned: the left gutter belongs to the prayer labels. */
                    <span className="absolute right-2 top-1 text-label text-muted">
                      Di luar jam tersedia
                    </span>
                  )}
                </div>
              );
            })}

            {/* Folded stretches: named, tappable, and never silently hidden. */}
            {collapsible.map((band) => {
              const folded = !expanded.has(band.key);
              const top = toY(band.from);
              const bottom = toY(band.to);
              const label = `${localClockTime(new Date(band.from), timezone)}–${localClockTime(new Date(band.to), timezone)}`;
              return (
                <button
                  key={`fold-${band.key}`}
                  type="button"
                  onClick={() => toggle(band.key)}
                  aria-expanded={!folded}
                  className={`absolute inset-x-0 flex items-center justify-center gap-2 border-y border-dashed hairline text-label text-muted ${
                    folded ? '' : 'h-6'
                  }`}
                  style={folded ? { top, height: Math.max(0, bottom - top) } : { top }}
                >
                  <span className="font-mono tabular-nums">{label}</span>
                  <span>· di luar jam tersedia</span>
                  <span aria-hidden="true">{folded ? '⌄' : '⌃'}</span>
                </button>
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
                  {/* Sits in the reserved gutter, so an agenda at the same hour cannot cover it. */}
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-label font-medium text-dusk">
                    {PRAYER_LABELS[block.label]}
                  </span>
                </div>
              );
            })}

            {placed.map(({ agenda, top, blockHeight, column, columns }) => {
              const width = `calc((100% - ${LABEL_GUTTER_PX}px) / ${columns})`;
              const left = `calc(${LABEL_GUTTER_PX}px + (100% - ${LABEL_GUTTER_PX}px) * ${column} / ${columns})`;
              const bufferTop = toY(shiftBy(agenda.startAt, -agenda.bufferBeforeMin));
              const bufferBottom = toY(shiftBy(agenda.endAt, agenda.bufferAfterMin));
              const bottom = top + blockHeight;
              return (
                <div key={agenda.id}>
                  {bufferTop < top && (
                    <div
                      className="absolute rounded-t-lg"
                      style={{
                        top: bufferTop,
                        height: top - bufferTop,
                        left,
                        width,
                        background: BUFFER_HATCH,
                      }}
                      aria-label={`Buffer ${agenda.bufferBeforeMin} menit sebelum ${agenda.title}`}
                    />
                  )}
                  <div
                    // Never render a target too small to touch (§10.10): 44px floor, label clipped.
                    className="absolute overflow-hidden rounded-lg bg-tea px-2 py-1 text-paper"
                    style={{ top, height: blockHeight, left, width }}
                  >
                    <p className="truncate text-label font-semibold">{agenda.title}</p>
                    <p className="flex items-center gap-2 font-mono text-label opacity-80">
                      <span className="truncate">
                        {formatTime(agenda.startAt, timezone)}–{formatTime(agenda.endAt, timezone)}
                      </span>
                      {/* Pomodoro dots live inside the block and fill in as sessions complete (§11). */}
                      <PomodoroDots
                        allocated={agenda.allocatedPomodoros}
                        completed={agenda.completedPomodoros}
                      />
                    </p>
                  </div>
                  {bufferBottom > bottom && (
                    <div
                      className="absolute rounded-b-lg"
                      style={{
                        top: bottom,
                        height: bufferBottom - bottom,
                        left,
                        width,
                        background: BUFFER_HATCH,
                      }}
                      aria-label={`Buffer ${agenda.bufferAfterMin} menit setelah ${agenda.title}`}
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
                aria-label={`${PRAYER_LABELS[block.label]} ${formatTime(block.startAt, timezone)}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function shiftBy(instant: string, minutes: number): number {
  return new Date(instant).getTime() + minutes * 60_000;
}

interface Band {
  key: string;
  from: number;
  to: number;
}

/**
 * The empty stretches inside unavailable hours, long enough to be worth folding.
 *
 * Subtracting what is occupied rather than disqualifying the whole stretch is the difference
 * between this working and not: the pre-dawn hours hold Subuh, so a rule that dropped any band
 * touching a prayer folded nothing at all, and the ribbon still opened on 350px of grey.
 */
function findCollapsible(input: {
  start: number;
  end: number;
  unavailable: Interval[];
  prayerBlocks: PrayerBlock[];
  agendas: RibbonAgenda[];
}): Band[] {
  const occupied: Interval[] = [
    ...input.prayerBlocks.map((block) => makeInterval(block.startAt, block.endAt)),
    ...input.agendas.map((agenda) =>
      makeInterval(
        new Date(shiftBy(agenda.startAt, -agenda.bufferBeforeMin)).toISOString(),
        new Date(shiftBy(agenda.endAt, agenda.bufferAfterMin)).toISOString(),
      ),
    ),
  ];

  const clipped = input.unavailable
    .map((interval) => ({
      from: Math.max(input.start, new Date(interval.startAt).getTime()),
      to: Math.min(input.end, new Date(interval.endAt).getTime()),
    }))
    .filter((band) => band.to > band.from)
    .map((band) =>
      makeInterval(new Date(band.from).toISOString(), new Date(band.to).toISOString()),
    );

  return subtract(clipped, occupied)
    .map((interval) => ({
      key: interval.startAt,
      from: new Date(interval.startAt).getTime(),
      to: new Date(interval.endAt).getTime(),
    }))
    .filter((band) => band.to - band.from >= MIN_COLLAPSE_MIN * 60_000);
}

interface Scale {
  toY: (instant: string | number) => number;
  height: number;
}

/**
 * A piecewise-linear time→pixel scale: real minutes everywhere except inside a folded band,
 * which is worth a fixed number of pixels no matter how many hours it swallows.
 */
function buildScale(input: {
  start: number;
  end: number;
  pxPerHour: number;
  collapsed: Band[];
}): Scale {
  const pxPerMs = input.pxPerHour / 3_600_000;
  const bands = [...input.collapsed].sort((a, b) => a.from - b.from);
  const segments: Array<{ from: number; to: number; fromY: number; toY: number }> = [];

  let cursor = input.start;
  let y = 0;
  for (const band of bands) {
    const from = Math.max(cursor, band.from);
    const to = Math.min(input.end, band.to);
    if (to <= from) continue;
    if (from > cursor) {
      const span = (from - cursor) * pxPerMs;
      segments.push({ from: cursor, to: from, fromY: y, toY: y + span });
      y += span;
    }
    segments.push({ from, to, fromY: y, toY: y + COLLAPSED_PX });
    y += COLLAPSED_PX;
    cursor = to;
  }
  if (cursor < input.end) {
    const span = (input.end - cursor) * pxPerMs;
    segments.push({ from: cursor, to: input.end, fromY: y, toY: y + span });
    y += span;
  }

  const height = Math.round(y);
  const toY = (instant: string | number) => {
    const value = typeof instant === 'number' ? instant : new Date(instant).getTime();
    if (value <= input.start) return 0;
    if (value >= input.end) return height;
    for (const segment of segments) {
      if (value <= segment.to) {
        const ratio = (value - segment.from) / (segment.to - segment.from);
        return segment.fromY + ratio * (segment.toY - segment.fromY);
      }
    }
    return height;
  };

  return { toY, height };
}

interface PlacedAgenda {
  agenda: RibbonAgenda;
  top: number;
  blockHeight: number;
  column: number;
  columns: number;
}

/**
 * Splits agendas that overlap *on screen* into columns.
 *
 * The overlap that matters is visual, not temporal: a 15-minute block floored to 44px covers
 * the half hour after it even though the two never share a minute. So the clustering runs on
 * rendered pixels, and a cluster's column count applies to every block in it — otherwise two
 * blocks in the same cluster would disagree about how wide they are.
 */
function layoutAgendas(agendas: RibbonAgenda[], toY: Scale['toY']): PlacedAgenda[] {
  const boxes = agendas
    .map((agenda) => {
      const top = toY(agenda.startAt);
      const blockHeight = Math.max(MIN_BLOCK_PX, toY(agenda.endAt) - top);
      return { agenda, top, blockHeight };
    })
    .sort((a, b) => a.top - b.top || b.blockHeight - a.blockHeight);

  const placed: PlacedAgenda[] = [];
  let cluster: Array<{ box: (typeof boxes)[number]; column: number }> = [];
  let clusterBottom = -Infinity;
  let columnEnds: number[] = [];

  const flush = () => {
    const columns = Math.max(1, columnEnds.length);
    for (const { box, column } of cluster) {
      placed.push({ ...box, column, columns });
    }
    cluster = [];
    columnEnds = [];
    clusterBottom = -Infinity;
  };

  for (const box of boxes) {
    if (box.top >= clusterBottom) flush();
    let column = columnEnds.findIndex((end) => end <= box.top);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(0);
    }
    columnEnds[column] = box.top + box.blockHeight;
    cluster.push({ box, column });
    clusterBottom = Math.max(clusterBottom, box.top + box.blockHeight);
  }
  flush();

  return placed;
}
