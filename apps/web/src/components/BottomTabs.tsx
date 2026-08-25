/**
 * Bottom tab bar (§10.1) — four destinations, all reachable by thumb. Not a drawer.
 *
 * Targets are ≥44px and the bar sits above the iOS home indicator via `safe-area-inset-bottom`.
 */

import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/', label: 'Hari Ini', icon: SunIcon, end: true },
  { to: '/tugas', label: 'Tugas', icon: ListIcon, end: false },
  { to: '/kalender', label: 'Kalender', icon: CalendarIcon, end: false },
  { to: '/setelan', label: 'Setelan', icon: GearIcon, end: false },
];

export function BottomTabs() {
  return (
    <nav
      aria-label="Navigasi utama"
      className="surface-raised sticky bottom-0 z-20 border-t hairline"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-2xl">
        {TABS.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                [
                  'flex min-h-touch flex-col items-center justify-center gap-1 px-2 py-2 text-[11px] font-medium transition-colors',
                  isActive ? 'text-tea' : 'text-muted',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <tab.icon active={isActive} />
                  <span>{tab.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

interface IconProps {
  active: boolean;
}

const stroke = (active: boolean) => ({
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: active ? 2 : 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

function SunIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" {...stroke(active)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
    </svg>
  );
}

function ListIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" {...stroke(active)}>
      <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  );
}

function CalendarIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" {...stroke(active)}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function GearIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" {...stroke(active)}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6" />
    </svg>
  );
}
