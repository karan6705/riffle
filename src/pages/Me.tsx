import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BADGES, earnedBadges, LEVELS, levelFor, weekStreak, xpFor } from '../core/gamification';
import { oneHealth } from '../core/onehealth';
import { CATEGORIES } from '../core/scoring';
import { VERY_SENSITIVE } from '../core/taxa';
import { Icon } from '../components/Icon';
import { Meter } from '../components/Visuals';
import { fmtDate } from '../state/derived';
import { useMine, useStore } from '../state/store';
import { StatusChip } from './Review';

export default function Me() {
  const mine = useMine();
  const all = useStore((s) => s.assessments);
  const { userName, setUserName, resetDemo } = useStore();
  const [draft, setDraft] = useState(userName === 'You' ? '' : userName);
  const xp = mine.reduce((s, a) => s + xpFor(a).total, 0);
  const lvl = levelFor(xp);
  const earned = earnedBadges(mine);
  const streak = weekStreak(mine.map((a) => new Date(a.observedAt)));

  const weekStart = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); d.setHours(0, 0, 0, 0); return d; }, []);
  const thisWeek = mine.filter((a) => new Date(a.observedAt) >= weekStart);
  const challenges = [
    { title: 'Two streams this week', progress: new Set(thisWeek.map((a) => a.siteId)).size, goal: 2, reward: 60 },
    { title: 'Find a very sensitive animal', progress: thisWeek.some((a) => a.taxa.some((t) => VERY_SENSITIVE.includes(t))) ? 1 : 0, goal: 1, reward: 40 },
    { title: 'Add a water photo', progress: thisWeek.filter((a) => a.photo).length, goal: 1, reward: 20 },
  ];

  // Community leaderboard by number of trusted (non-rejected) checks — rewards reliability, not just volume.
  const board = useMemo(() => {
    const m = new Map<string, { checks: number; quality: number }>();
    for (const a of all) {
      if (a.status === 'rejected') continue;
      const name = a.demo ? a.observer : userName;
      const e = m.get(name) ?? { checks: 0, quality: 0 };
      e.checks++; e.quality += a.qualityScore;
      m.set(name, e);
    }
    return [...m.entries()].map(([name, e]) => ({ name, checks: e.checks, quality: Math.round(e.quality / e.checks) }))
      .sort((a, b) => b.checks * b.quality - a.checks * a.quality).slice(0, 8);
  }, [all, userName]);

  return (
    <div className="grid gap-6">
      <header className="card relative overflow-hidden p-6">
        <div className="flex flex-wrap items-center gap-5">
          <div className="font-display grid size-20 place-items-center rounded-full bg-river text-3xl font-semibold text-paper">
            {(userName === 'You' ? '?' : userName[0]).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <label className="block">
              <span className="sr-only">Your name</span>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => setUserName(draft)} placeholder="Add your name"
                className="font-display w-full max-w-xs border-b border-dashed border-line bg-transparent text-3xl font-semibold outline-none focus:border-river" />
            </label>
            <p className="mt-1 text-ink-2"><strong>{lvl.level.name}</strong> · {lvl.level.blurb}</p>
            <div className="mt-2 max-w-sm">
              <Meter value={lvl.progress * 100} colour="var(--kingfisher)" label="Level progress" />
              <p className="mt-1 text-xs text-ink-3">{xp} XP{lvl.next ? ` · ${lvl.next.min - xp} to ${lvl.next.name}` : ' · max level'}</p>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-3 text-center">
            {[[mine.length, 'checks'], [streak, 'week streak 🔥'], [earned.size, 'badges']].map(([v, l]) => (
              <div key={l as string}><dd className="font-display text-3xl font-semibold">{v}</dd><dt className="text-xs text-ink-3">{l}</dt></div>
            ))}
          </dl>
        </div>
        <ol className="mt-5 flex gap-1 overflow-x-auto scrollbar-none" aria-label="Levels">
          {LEVELS.map((l) => (
            <li key={l.name} className={`flex-1 whitespace-nowrap rounded-lg px-2 py-1 text-center text-[0.7rem] font-semibold ${xp >= l.min ? 'bg-river text-paper' : 'bg-paper-2 text-ink-3'}`}>{l.name}</li>
          ))}
        </ol>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5" aria-labelledby="challenges">
          <h2 id="challenges" className="font-display text-xl font-semibold">This week's challenges</h2>
          <ul className="mt-3 grid gap-3">
            {challenges.map((c) => {
              const done = c.progress >= c.goal;
              return (
                <li key={c.title} className="flex items-center gap-3">
                  <span className={`grid size-8 shrink-0 place-items-center rounded-full ${done ? 'bg-good text-white' : 'bg-paper-2 text-ink-3'}`}><Icon name={done ? 'check' : 'trophy'} size={16} /></span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{c.title} <span className="text-ink-3">· +{c.reward} XP</span></p>
                    <Meter value={(Math.min(c.progress, c.goal) / c.goal) * 100} colour={done ? 'var(--good)' : 'var(--river)'} label={c.title} />
                  </div>
                  <span className="font-mono text-xs">{Math.min(c.progress, c.goal)}/{c.goal}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card p-5" aria-labelledby="board">
          <h2 id="board" className="font-display text-xl font-semibold">Coimbra stream keepers</h2>
          <p className="text-xs text-ink-3">Ranked by trusted checks × data quality — careful beats fast.</p>
          <ol className="mt-3 grid gap-1.5">
            {board.map((b, i) => (
              <li key={b.name} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${b.name === userName ? 'bg-kingfisher-soft' : i % 2 ? '' : 'bg-paper-2/50'}`}>
                <span className="w-5 font-mono text-ink-3">{i + 1}</span>
                <span className="flex-1 truncate font-medium">{b.name}</span>
                <span className="font-mono text-xs text-ink-3">{b.checks} checks · Q{b.quality}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section aria-labelledby="badges">
        <h2 id="badges" className="font-display mb-3 text-2xl font-semibold">Badges</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {BADGES.map((b) => {
            const has = earned.has(b.id);
            return (
              <li key={b.id} className={`card flex flex-col items-center p-4 text-center ${has ? '' : 'opacity-50'}`}>
                <span className={`text-4xl ${has ? '' : 'grayscale'}`} aria-hidden="true">{b.icon}</span>
                <p className="mt-2 font-semibold">{b.name}</p>
                <p className="text-xs text-ink-3">{b.description}</p>
                <span className="sr-only">{has ? 'Earned' : 'Not earned yet'}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card p-5" aria-labelledby="mychecks">
        <h2 id="mychecks" className="font-display text-xl font-semibold">My checks</h2>
        {mine.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-ink-3">No checks yet — your first one earns the “First Dip” badge.</p>
            <Link to="/check" className="btn btn-accent mt-3">Start a stream check</Link>
          </div>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {[...mine].reverse().map((a) => {
              const oh = oneHealth(a);
              return (
                <li key={a.id}>
                  <Link to={`/record/${a.id}`} className="flex items-center gap-3 py-3 hover:bg-paper-2/50">
                    <span className="size-3 rounded-full" style={{ background: CATEGORIES[oh.category].colour }} />
                    <span className="flex-1">
                      <span className="block font-medium">{a.siteName}</span>
                      <span className="text-xs text-ink-3">{fmtDate(a.observedAt)} · +{xpFor(a).total} XP</span>
                    </span>
                    <StatusChip status={a.status} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-center text-xs text-ink-3">
        Data is stored on this device.{' '}
        <button className="underline" onClick={() => { if (confirm('Reset the demo data and remove your checks?')) resetDemo(); }}>Reset demo data</button>
      </p>
    </div>
  );
}
