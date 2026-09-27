// Records the Riffle demo video: drives the live app scene by scene, timed to
// pre-generated narration, then writes scene start times for audio muxing.
// Usage: node record.cjs <playwright-module-dir> <base-url>
const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(process.argv[2], 'playwright'));

const BASE = process.argv[3] || 'https://karan6705.github.io/riffle/';
const OUT = __dirname;
const durations = JSON.parse(fs.readFileSync(path.join(OUT, 'durations.json'), 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CURSOR = `
(() => {
  const add = () => {
    if (document.getElementById('demo-cursor') || !document.body) return;
    const c = document.createElement('div');
    c.id = 'demo-cursor';
    c.style.cssText = 'position:fixed;left:640px;top:400px;width:22px;height:22px;z-index:2147483647;pointer-events:none;transition:left .55s cubic-bezier(.3,.7,.2,1),top .55s cubic-bezier(.3,.7,.2,1);';
    c.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2l16 9-7 2-3 7z" fill="#0f2e2d" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    const st = document.createElement('style');
    st.textContent = '@keyframes demo-ripple{from{transform:scale(.2);opacity:.7}to{transform:scale(1.8);opacity:0}} .demo-ripple{position:fixed;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;background:#d9622b;pointer-events:none;z-index:2147483646;animation:demo-ripple .5s ease-out forwards}';
    document.head.appendChild(st);
  };
  document.addEventListener('DOMContentLoaded', add);
  setInterval(add, 500);
})();`;

function card(kind) {
  const title = kind === 'title';
  return `<!doctype html><html><head><link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,400..800,50..100&family=Instrument+Sans:wght@400..700&display=swap" rel="stylesheet">
  <style>
    body{margin:0;height:100vh;display:grid;place-items:center;background:#0f3b3a;color:#f4efe4;font-family:'Instrument Sans',sans-serif;overflow:hidden}
    svg.bg{position:fixed;inset:0;width:100%;height:100%}
    .flow{stroke-dasharray:220 180;animation:f 14s linear infinite}
    @keyframes f{to{stroke-dashoffset:-400}}
    @keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
    main{position:relative;text-align:center;max-width:980px;padding:0 40px}
    main>*{animation:rise .9s cubic-bezier(.2,.7,.2,1) both}
    .logo{display:inline-flex;align-items:center;gap:18px;animation-delay:.1s}
    h1{font-family:Fraunces,serif;font-variation-settings:'SOFT' 100;font-weight:600;font-size:92px;margin:0;letter-spacing:-1px}
    h2{font-family:Fraunces,serif;font-weight:500;font-size:40px;line-height:1.2;margin:22px 0 0;animation-delay:.35s}
    p{font-size:22px;opacity:.85;margin:28px 0 0;animation-delay:.6s}
    .pill{display:inline-block;margin-top:34px;padding:10px 22px;border-radius:999px;background:#d9622b;font-weight:700;font-size:22px;animation-delay:.85s}
  </style></head><body>
  <svg class="bg" viewBox="0 0 800 300" preserveAspectRatio="none">${Array.from({ length: 9 }, (_, i) => {
    const y = 25 + i * 30, a = 18 + (i % 3) * 8;
    return `<path class="flow" style="animation-delay:${-i * 1.7}s;animation-duration:${12 + i * 1.3}s" d="M-20 ${y} C 120 ${y - a}, 220 ${y + a}, 380 ${y} S 640 ${y - a}, 820 ${y + a * 0.4}" fill="none" stroke="#a9d3c9" stroke-width="${i % 2 ? 1.2 : 1.8}" opacity="${0.12 + (i % 3) * 0.06}"/>`;
  }).join('')}</svg>
  <main>
    <div class="logo"><svg width="96" height="96" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#f4efe4"/><path d="M10 26c8-6 14 6 22 0s14 6 22 0M10 38c8-6 14 6 22 0s14 6 22 0" fill="none" stroke="#0f3b3a" stroke-width="4" stroke-linecap="round"/><circle cx="46" cy="18" r="5" fill="#d9622b"/></svg><h1>Riffle</h1></div>
    ${title
      ? `<h2>An explainable AI co-pilot for citizen stream science</h2><p>IEEE OneAquaHealth Global Hackathon 2026 · Track 3 — AI-Supported Assessment</p><div class="pill">From streams to systems</div>`
      : `<h2>From streams to systems.</h2><p>Live demo: <b>karan6705.github.io/riffle</b><br>Code: <b>github.com/karan6705/riffle</b></p><div class="pill">Healthy waters · healthy ecosystems · healthy communities</div>`}
  </main></body></html>`;
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: path.join(OUT, 'raw'), size: { width: 1280, height: 800 } },
    geolocation: { latitude: 40.2195, longitude: -8.4205 },
    permissions: ['geolocation'],
  });
  await context.addInitScript(CURSOR);
  const page = await context.newPage();
  const t0 = Date.now();
  const starts = {};

  const cursorTo = async (loc) => {
    await loc.scrollIntoViewIfNeeded();
    const b = await loc.boundingBox();
    if (!b) return;
    await page.evaluate(([x, y]) => {
      const c = document.getElementById('demo-cursor');
      if (c) { c.style.left = x + 'px'; c.style.top = y + 'px'; }
    }, [b.x + b.width / 2, b.y + b.height / 2]);
    await sleep(650);
    return b;
  };
  const click = async (loc, pause = 500) => {
    const b = await cursorTo(loc);
    if (b) {
      await page.evaluate(([x, y]) => {
        const r = document.createElement('div');
        r.className = 'demo-ripple'; r.style.left = x + 'px'; r.style.top = y + 'px';
        document.body.appendChild(r); setTimeout(() => r.remove(), 600);
      }, [b.x + b.width / 2, b.y + b.height / 2]);
    }
    await loc.click();
    await sleep(pause);
  };
  const scrollTo = async (loc, block = 'start') => {
    await loc.evaluate((el, block) => el.scrollIntoView({ behavior: 'smooth', block }), block);
    await sleep(1100);
  };
  const scrollBy = async (y, wait = 1200) => {
    await page.evaluate((y) => window.scrollBy({ top: y, behavior: 'smooth' }), y);
    await sleep(wait);
  };
  const scene = async (key, fn) => {
    starts[key] = (Date.now() - t0) / 1000;
    const min = durations[key] * 1000 + 700;
    const begun = Date.now();
    await fn();
    const left = min - (Date.now() - begun);
    if (left > 0) await sleep(left);
    console.log(key, starts[key].toFixed(1));
  };

  // Fresh demo state, forecast warmed up, before the camera "starts" on the title card.
  await page.goto(BASE + '#/');
  await page.evaluate(() => localStorage.clear());

  await scene('s00_title', async () => {
    await page.setContent(card('title'));
  });

  await scene('s01_home', async () => {
    await page.goto(BASE + '?demo=1#/');
    await page.waitForSelector('text=Your stream, read like');
    await sleep(2500);
    await cursorTo(page.getByText('Look, smell and lift a few stones'));
    await sleep(2200);
    await cursorTo(page.getByText('The co-pilot double-checks with you'));
    await sleep(2200);
    await cursorTo(page.getByText('Get a One Health reading'));
  });

  await scene('s02_today', async () => {
    await scrollTo(page.locator('#today-q'), 'start');
    await scrollBy(-90, 800);
    await cursorTo(page.getByRole('figure'));
    await sleep(3500);
    await cursorTo(page.getByText('Keep dogs on the lead').first());
    await sleep(3000);
    await cursorTo(page.locator('text=Ecosystem').first());
  });

  await scene('s03_water', async () => {
    await click(page.locator('aside').getByRole('link', { name: /Check a stream/ }), 1200);
    await click(page.getByRole('radio', { name: /Coselhas — urban reach/ }), 500);
    await click(page.getByRole('button', { name: /Next/ }), 600);
    await click(page.getByRole('radio', { name: /Murky/ }), 250);
    await click(page.getByRole('radio', { name: /Grey/ }), 250);
    await click(page.getByRole('radio', { name: /Sewage/ }), 2200);
    await click(page.getByRole('button', { name: /Next/ }), 600);
    await click(page.locator('fieldset', { hasText: 'Litter in or next' }).getByRole('radio', { name: 'A lot' }), 250);
    await click(page.locator('fieldset', { hasText: 'Any pipes' }).getByRole('radio', { name: /^Yes/ }), 300);
  });

  await scene('s04_bugs', async () => {
    await click(page.getByRole('button', { name: /Next/ }), 800);
    await click(page.getByRole('button', { name: /5-min timer/ }), 1200);
    await click(page.getByRole('button', { name: 'How to tell' }).first(), 2400);
    await click(page.getByRole('button', { name: 'Stoneflies', exact: true }), 500);
    await click(page.getByRole('button', { name: 'Flat & crawling mayflies', exact: true }), 500);
    await click(page.getByRole('button', { name: 'Worms', exact: true }), 500);
  });

  await scene('s05_copilot', async () => {
    await click(page.getByRole('button', { name: /^Next/ }), 800);
    await click(page.getByRole('button', { name: /Skip photo/ }), 1500);
    await cursorTo(page.getByText('Your animals vs. what the stream suggests'));
    await sleep(3000);
    await click(page.locator('summary'), 1200);
    await cursorTo(page.getByText('Why does the co-pilot expect that?'));
    await sleep(4000);
    await scrollTo(page.locator('#flags'), 'start');
    await cursorTo(page.getByText('Very sensitive animals in sewage-like water'));
    await sleep(3500);
    await cursorTo(page.getByText(/More sensitive life than expected/).first());
  });

  await scene('s06_decide', async () => {
    const first = page.locator('li.card', { hasText: 'Very sensitive animals' });
    await cursorTo(first.getByRole('button', { name: /Go back & check/ }));
    await sleep(900);
    await click(first.getByRole('button', { name: "I'm sure" }), 500);
    await first.getByRole('textbox').pressSequentially('Counted two tails on three animals', { delay: 45 });
    await sleep(600);
    await scrollBy(600, 1200);
  });

  await scene('s07_result', async () => {
    await click(page.getByRole('button', { name: /Submit my check/ }), 3500);
    await cursorTo(page.getByText(/XP earned/));
    await sleep(2500);
    await scrollTo(page.locator('#fhir'), 'center');
    await cursorTo(page.getByText('Structurally valid'));
    await sleep(1500);
    await click(page.getByRole('button', { name: /View JSON/ }), 1200);
    await scrollTo(page.locator('pre'), 'start');
    await page.locator('pre').evaluate((el) => el.scrollTo({ top: 900, behavior: 'smooth' }));
    await sleep(1500);
  });

  await scene('s08_review', async () => {
    await click(page.locator('aside').getByRole('link', { name: /Expert review/ }), 1500);
    await cursorTo(page.getByText(/of flagged records turned out valid/));
    await sleep(2500);
    await scrollTo(page.locator('main li.card').first(), 'start');
    await scrollBy(-80, 600);
    await cursorTo(page.getByText(/Citizen: “Counted two tails/).first());
    await sleep(2500);
    await cursorTo(page.getByRole('button', { name: /Verify/ }).first());
  });

  await scene('s09_map', async () => {
    await click(page.locator('aside').getByRole('link', { name: 'Map' }), 3500);
    await cursorTo(page.getByText('What is stressing the streams?'));
    await sleep(1800);
    await click(page.getByRole('tab', { name: '7-day risk' }), 1200);
  });

  await scene('s10_site', async () => {
    await page.evaluate(() => { location.hash = '#/site/coselhas-urban'; });
    await sleep(1800);
    await cursorTo(page.getByText('Trend over time'));
    await sleep(3200);
    await scrollTo(page.locator('#life'), 'start');
    await scrollBy(-60, 500);
    await cursorTo(page.locator('#life').locator('..').getByText('Stoneflies'));
  });

  await scene('s11_alerts', async () => {
    await click(page.locator('aside').getByRole('link', { name: 'Alerts' }), 3500);
    await click(page.getByRole('tab', { name: /Storm/ }), 2500);
    await cursorTo(page.locator('main li.card').first());
    await sleep(2500);
    await scrollBy(420, 1500);
  });

  await scene('s12_learn', async () => {
    await click(page.locator('aside').getByRole('link', { name: 'Learn' }), 1800);
    await scrollBy(520, 2200);
    await scrollBy(520, 2200);
    await scrollTo(page.locator('#glossary'), 'start');
  });

  await scene('s13_data', async () => {
    await click(page.locator('aside').getByRole('link', { name: /Open data/ }), 2200);
    await scrollTo(page.locator('#arch'), 'start');
    await sleep(2800);
    await scrollTo(page.locator('#model-card'), 'start');
    await sleep(2500);
    await scrollTo(page.locator('#privacy'), 'center');
  });

  await scene('s14_end', async () => {
    await page.setContent(card('end'));
  });
  await sleep(1500);

  const video = page.video();
  await context.close();
  await browser.close();
  const raw = await video.path();
  fs.writeFileSync(path.join(OUT, 'timeline.json'), JSON.stringify({ raw, starts, total: (Date.now() - t0) / 1000 }, null, 1));
  console.log('video', raw);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
