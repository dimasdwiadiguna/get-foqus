/**
 * Smart allocation engine (§6).
 *
 * The contract is fixed here from M0 so callers can be written against it; the greedy +
 * scoring implementation lands in **M6** together with its test suite. Everything the engine
 * will stand on — `freeIntervals`, `candidateSlots`, `detectViolations`, `topologicalOrder` —
 * is already implemented and tested in this package.
 *
 * Non-negotiables when it is implemented:
 *  - pure, deterministic, no I/O, no LLM (§6);
 *  - identical input ⇒ identical output;
 *  - never emits a slot with a binding violation (§5.4, `BINDING_KINDS`);
 *  - every `DraftItem` carries an Indonesian `reason` (§6.8), every unallocated task an
 *    Indonesian explanation (§6.7).
 */

import type {
  Agenda,
  AvailabilityWindow,
  DraftItem,
  ISODateTime,
  ResolvedTimeBlock,
  Settings,
  Task,
  TaskDependency,
  UnallocatedTask,
} from '../types.js';
import type { Interval } from '../time/interval.js';
import type { PrayerBlock } from '../prayer/blocks.js';
import type { Horizon } from './availability.js';

export interface AllocateInput {
  /** Tasks from the weekly plan, in the user's chosen order. */
  tasks: Task[];
  /** taskId → tag ids, needed to evaluate time block filters. */
  tagsByTask: Record<string, string[]>;
  dependencies: TaskDependency[];
  horizon: Horizon;
  windows: AvailabilityWindow[];
  prayerBlocks: PrayerBlock[];
  timeBlocks: ResolvedTimeBlock[];
  existingAgendas: Agenda[];
  externalBusy: Interval[];
  settings: Settings;
  now: ISODateTime;
}

export interface AllocateResult {
  items: DraftItem[];
  unallocated: UnallocatedTask[];
}

export type AllocateFn = (input: AllocateInput) => AllocateResult;
