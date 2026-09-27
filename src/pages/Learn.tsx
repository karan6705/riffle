import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TAXA_BY_ID } from '../core/taxa';
import { BugIcon } from '../components/BugIcon';
import { Icon, type IconName } from '../components/Icon';
import { FlowLines } from '../components/Visuals';

const STORY: { icon: IconName; kicker: string; title: string; text: string; bug?: string }[] = [
  { icon: 'rain', kicker: '06:00', title: 'A storm over Coimbra', text: 'Rain hits roofs, roads and car parks. Sealed surfaces can’t soak it up, so within minutes it rushes into drains — carrying oil, tyre dust, fertiliser and dog waste.' },
  { icon: 'wave', kicker: '06:40', title: 'The sewers overflow', text: 'Old combined sewers carry rainwater and household waste in the same pipe. When they fill up, the mix spills straight into the Ribeira de Coselhas.' },
  { icon: 'drop', kicker: '09:00', title: 'Oxygen runs out', text: 'Bacteria feast on the sewage and use up the oxygen in the water. Stoneflies and flat mayflies — which breathe through delicate gills — are the first to suffocate.', bug: 'stoneflies' },
  { icon: 'leaf', kicker: 'Next week', title: 'The food web thins out', text: 'Fewer insects means less food for trout, dippers, kingfishers and bats. Hardy worms and red bloodworms take over the mud.', bug: 'true-flies' },
  { icon: 'paw', kicker: 'Summer', title: 'A dog goes for a swim', text: 'Nutrients from the spill plus a heatwave feed a bloom of cyanobacteria in the slow park outlet. Its toxins can kill a dog within hours.' },
  { icon: 'people', kicker: 'Same afternoon', title: 'Children play at the edge', text: 'Kids splash where the outfall enters. Gut bacteria from sewage cause stomach upsets and skin infections. Nobody knew — there was no warning.' },
  { icon: 'spark', kicker: 'With Riffle', title: 'A neighbour notices first', text: 'A 5-minute check finds stoneflies gone and a sewage smell. The co-pilot confirms it’s unusual, an expert verifies, the utility traces a misconnected drain, and dog walkers get an alert before the heatwave.' },
];

const GLOSSARY: [string, string, string][] = [
  ['Macroinvertebrates', 'River bugs', 'Animals without a backbone that you can see without a microscope: insect larvae, snails, worms, shrimps.'],
  ['Biotic index (miniSASS)', 'Bug score', 'The average “sensitivity” of the groups you find. Clean water hosts sensitive animals, so the score goes up.'],
  ['Riparian zone', 'The banks', 'The strip of land and plants along the stream. It shades the water, filters runoff and feeds the stream with leaves.'],
  ['Substrate', 'Stream bed', 'What the bottom is made of — stones, gravel, sand or mud. Different beds naturally host different animals.'],
  ['Turbidity', 'Cloudiness', 'How much fine particles (soil, algae, waste) make the water hazy. It blocks light and clogs gills.'],
  ['Eutrophication', 'Over-fertilised water', 'Too many nutrients (from fertiliser or sewage) make algae grow out of control, then rot and use up oxygen.'],
  ['Cyanobacteria', 'Blue-green algae', 'Microbes that form green scum in warm, still water. Some make toxins dangerous to pets, livestock and people.'],
  ['CSO', 'Sewer overflow', 'Combined sewer overflow: in heavy rain, pipes that carry both rain and sewage spill into rivers.'],
  ['One Health', 'Shared health', 'The idea that the health of people, animals and ecosystems is connected — so we should monitor and protect them together.'],
];

const QUIZ = [
  { q: 'You find lots of stoneflies. What does it tell you?', options: ['The water is polluted', 'The water is clean and oxygen-rich', 'Nothing — they live everywhere'], correct: 1 },
  { q: 'After heavy rain in a city, when should you avoid touching stream water?', options: ['Never, rain cleans rivers', 'For about 48 hours', 'Only if it smells'], correct: 1 },
  { q: 'Green scum on a warm, still pond. What do you do with your dog?', options: ['Let it drink — it’s natural', 'Keep it on the lead and away from the water', 'Rinse it in the pond afterwards'], correct: 1 },
];

export default function Learn() {
  const [answers, setAnswers] = useState<(number | null)[]>(QUIZ.map(() => null));
  const [hover, setHover] = useState<'people' | 'animals' | 'environment' | null>(null);
  const score = answers.filter((a, i) => a === QUIZ[i].correct).length;
  const done = answers.every((a) => a !== null);

  return (
    <div className="grid gap-10">
      <header className="relative overflow-hidden rounded-3xl bg-river p-6 text-paper md:p-10">
        <FlowLines className="pointer-events-none absolute inset-0 h-full w-full text-shallows" opacity={0.4} />
        <div className="relative max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-kingfisher-soft">Learn · One Health</p>
          <h1 className="font-display mt-2 text-4xl font-semibold leading-tight md:text-5xl">One raindrop, three kinds of health.</h1>
          <p className="mt-3 text-lg opacity-85">Follow a storm through the city to see why a tiny insect in your local stream says something about your dog, your kids and your neighbourhood.</p>
        </div>
      </header>

      <section aria-labelledby="story">
        <h2 id="story" className="sr-only">The story</h2>
        <ol className="relative grid gap-4 border-l-2 border-dashed border-river/30 pl-6 md:pl-10">
          {STORY.map((s, i) => (
            <li key={s.title} className="card rise relative p-5" style={{ animationDelay: `${i * 70}ms` }}>
              <span className={`absolute -left-[2.6rem] top-5 grid size-9 place-items-center rounded-full md:-left-[3.6rem] ${i === STORY.length - 1 ? 'bg-kingfisher text-white' : 'bg-river text-paper'}`}>
                <Icon name={s.icon} size={18} />
              </span>
              <div className="flex gap-4">
                <div className="flex-1">
                  <p className="font-mono text-xs text-ink-3">{s.kicker}</p>
                  <h3 className="font-display text-xl font-semibold">{s.title}</h3>
                  <p className="mt-1 text-ink-2">{s.text}</p>
                </div>
                {s.bug && <BugIcon taxon={TAXA_BY_ID[s.bug]} size={72} className={i === 2 ? 'opacity-50 grayscale' : ''} />}
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-6 text-center">
          <Link to="/check" className="btn btn-accent">Be that neighbour — check a stream</Link>
        </div>
      </section>

      <section className="grid items-center gap-8 md:grid-cols-2" aria-labelledby="oh">
        <div>
          <h2 id="oh" className="font-display text-3xl font-semibold">What is One Health?</h2>
          <p className="mt-2 text-ink-2">
            People, animals and the environment share the same water. When a stream gets sick, so can the dog that drinks from it and
            the child who plays in it. Riffle turns one citizen observation into three readings, so everyone can see their stake.
          </p>
          <p className="mt-3 min-h-[3rem] rounded-xl bg-paper-2/60 p-3 text-sm" aria-live="polite">
            {hover === 'people' && 'People: stomach bugs and skin infections from sewage, toxins from blooms, and the mental-health benefit of healthy green-blue spaces.'}
            {hover === 'animals' && 'Animals: dogs and livestock poisoned by cyanobacteria; birds, fish and bats losing their insect food.'}
            {hover === 'environment' && 'Environment: oxygen, habitat and biodiversity — the stream’s own health, read through its insects.'}
            {!hover && 'Hover or tap a circle to explore.'}
          </p>
        </div>
        <svg viewBox="0 0 300 260" className="mx-auto w-full max-w-sm" role="img" aria-label="One Health Venn diagram: people, animals, environment">
          {([
            ['people', 110, 100, 'var(--kingfisher)', 'People'],
            ['animals', 190, 100, '#5b7fd9', 'Animals'],
            ['environment', 150, 170, 'var(--good)', 'Environment'],
          ] as const).map(([k, cx, cy, c, label]) => (
            <g key={k} onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover(null)} onClick={() => setHover(k)} onFocus={() => setHover(k)} tabIndex={0} role="button" aria-label={label} className="cursor-pointer outline-none">
              <circle cx={cx} cy={cy} r="72" fill={c} opacity={hover === k ? 0.45 : 0.22} stroke={c} strokeWidth="2" style={{ transition: 'opacity .2s' }} />
              <text x={k === 'people' ? cx - 30 : k === 'animals' ? cx + 30 : cx} y={k === 'environment' ? cy + 38 : cy - 20} textAnchor="middle" fontFamily="var(--font-display)" fontSize="16" fontWeight="600" fill="var(--ink)">{label}</text>
            </g>
          ))}
          <text x="150" y="128" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--ink)">Stream</text>
        </svg>
      </section>

      <section aria-labelledby="glossary">
        <h2 id="glossary" className="font-display text-3xl font-semibold">Jargon, translated</h2>
        <p className="text-ink-3">Riffle always uses the plain words — here is what scientists call them.</p>
        <dl className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {GLOSSARY.map(([term, plain, def]) => (
            <div key={term} className="card p-4">
              <dt>
                <span className="font-display text-lg font-semibold">{plain}</span>
                <span className="ml-2 font-mono text-xs text-ink-3">{term}</span>
              </dt>
              <dd className="mt-1 text-sm text-ink-2">{def}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="card p-5 md:p-6" aria-labelledby="quiz">
        <h2 id="quiz" className="font-display text-2xl font-semibold">Quick check: are you stream-smart?</h2>
        <ol className="mt-4 grid gap-5">
          {QUIZ.map((q, i) => (
            <li key={q.q}>
              <p className="font-medium">{i + 1}. {q.q}</p>
              <div className="mt-2 flex flex-wrap gap-2" role="radiogroup">
                {q.options.map((o, j) => {
                  const picked = answers[i] === j;
                  const show = answers[i] !== null;
                  const cls = show && j === q.correct ? 'border-good bg-good-soft' : picked ? 'border-warning bg-warning-soft' : '';
                  return (
                    <button key={o} role="radio" aria-checked={picked} disabled={show}
                      onClick={() => setAnswers(answers.map((a, k) => (k === i ? j : a)))}
                      className={`tile px-3 py-2 text-sm ${cls}`}>{o}</button>
                  );
                })}
              </div>
            </li>
          ))}
        </ol>
        {done && (
          <p className="mt-5 font-semibold" aria-live="polite">
            {score}/{QUIZ.length} — {score === QUIZ.length ? 'Stream-smart! You’re ready for your first check.' : 'Nice try — the green answers show what to remember.'}
          </p>
        )}
      </section>
    </div>
  );
}
