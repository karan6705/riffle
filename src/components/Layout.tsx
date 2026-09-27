import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Icon, type IconName } from './Icon';
import { Logo } from './Visuals';
import { useStore } from '../state/store';

const NAV: { to: string; label: string; icon: IconName; primary?: boolean }[] = [
  { to: '/', label: 'Today', icon: 'home' },
  { to: '/map', label: 'Map', icon: 'map' },
  { to: '/check', label: 'Check a stream', icon: 'plus', primary: true },
  { to: '/alerts', label: 'Alerts', icon: 'bell' },
  { to: '/me', label: 'Me', icon: 'user' },
];

const MORE: { to: string; label: string; icon: IconName }[] = [
  { to: '/review', label: 'Expert review', icon: 'shield' },
  { to: '/learn', label: 'Learn', icon: 'book' },
  { to: '/data', label: 'Open data & FHIR', icon: 'code' },
];

export function Layout() {
  const { pathname } = useLocation();
  const pending = useStore((s) => s.assessments.filter((a) => a.status === 'needs-review').length);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  const inWizard = pathname.startsWith('/check');

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[240px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 btn btn-primary">
        Skip to content
      </a>

      {/* Desktop side rail */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-1 border-r border-line px-4 py-6 md:flex">
        <NavLink to="/" className="mb-6 px-2" aria-label="Riffle home">
          <Logo />
        </NavLink>
        {NAV.map((n) =>
          n.primary ? (
            <NavLink key={n.to} to={n.to} className="btn btn-accent my-3 justify-start">
              <Icon name="plus" /> {n.label}
            </NavLink>
          ) : (
            <RailLink key={n.to} {...n} />
          ),
        )}
        <div className="rule my-4" />
        {MORE.map((n) => (
          <RailLink key={n.to} {...n} badge={n.to === '/review' ? pending : undefined} />
        ))}
        <p className="mt-auto px-2 text-xs leading-relaxed text-ink-3">
          Built for the IEEE OneAquaHealth Global Hackathon 2026 · From streams to systems.
        </p>
      </aside>

      <div className="min-w-0">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper/90 px-4 py-3 backdrop-blur md:hidden">
          <NavLink to="/" aria-label="Riffle home">
            <Logo size={26} />
          </NavLink>
          <nav className="flex gap-1" aria-label="More">
            {MORE.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                aria-label={n.label}
                className={({ isActive }) => `relative rounded-full p-2 ${isActive ? 'bg-paper-2 text-river' : 'text-ink-2'}`}
              >
                <Icon name={n.icon} />
                {n.to === '/review' && pending > 0 && (
                  <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-kingfisher" />
                )}
              </NavLink>
            ))}
          </nav>
        </header>

        <main id="main" className={`mx-auto w-full max-w-6xl px-4 pt-5 md:px-8 md:pt-8 ${inWizard ? 'pb-10' : 'pb-28 md:pb-12'}`}>
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      {!inWizard && (
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-card/95 px-2 pb-[max(env(safe-area-inset-bottom),0.4rem)] pt-1.5 backdrop-blur md:hidden"
        >
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-1 text-[0.68rem] font-semibold ${isActive ? 'text-river' : 'text-ink-3'}`
              }
            >
              {n.primary ? (
                <span className="-mt-6 grid size-14 place-items-center rounded-full bg-kingfisher text-white shadow-lg ring-4 ring-paper">
                  <Icon name="plus" size={26} strokeWidth={2.2} />
                </span>
              ) : (
                <Icon name={n.icon} size={22} />
              )}
              <span className={n.primary ? 'text-kingfisher' : ''}>{n.primary ? 'Check' : n.label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}

function RailLink({ to, label, icon, badge }: { to: string; label: string; icon: IconName; badge?: number }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.95rem] font-medium transition-colors ${
          isActive ? 'bg-paper-2 text-river' : 'text-ink-2 hover:bg-paper-2/60'
        }`
      }
    >
      <Icon name={icon} />
      <span className="flex-1">{label}</span>
      {!!badge && <span className="chip bg-kingfisher text-white">{badge}</span>}
    </NavLink>
  );
}
