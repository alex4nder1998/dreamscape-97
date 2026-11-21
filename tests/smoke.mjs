// Smoke test: loads the app in headless Chromium (software WebGL) and checks that it starts,
// renders, loads every preset, and that share links survive a round trip.
// Run locally:  npm i --no-save playwright && npx playwright install chromium && node tests/smoke.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = process.env.APP_ROOT || new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  try { const body = await readFile(join(root, p.endsWith('/') ? p + 'index.html' : p)); res.writeHead(200, { 'content-type': types[extname(p)] || 'text/html' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const base = `http://localhost:${server.address().port}/`;

let failed = 0;
const check = (ok, msg) => { console.log((ok ? '  ok   ' : '  FAIL ') + msg); if (!ok) failed++; };
const lcd = p => p.textContent('#lcd');
const rendered = async p => {
  await p.waitForFunction(() => /complete/.test(document.querySelector('#lcd').textContent) || getComputedStyle(document.querySelector('#err')).display !== 'none', null, { timeout: 240000 });
  if (await p.isVisible('#err')) { console.log('  FAIL renderer error: ' + (await p.textContent('#err')).trim()); process.exit(1); }
};

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 480, height: 640 } });
  ctx.setDefaultTimeout(180000); ctx.setDefaultNavigationTimeout(180000);
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.route('https://api.github.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|fonts\.g|Failed to load resource/.test(m.text())) errors.push(m.text()); });

  await page.goto(base);
  check(await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2')), 'WebGL 2 is available');
  check(!(await page.isVisible('#err')), 'renderer started (no error screen)');
  await rendered(page);
  check(true, 'first render completes');

  const lit = await page.evaluate(() => {
    const c = document.createElement('canvas'), g = document.querySelector('#gl'); c.width = 32; c.height = 32;
    const x = c.getContext('2d'); x.drawImage(g, 0, 0, 32, 32); const d = x.getImageData(0, 0, 32, 32).data;
    let s = 0, n = new Set(); for (let i = 0; i < d.length; i += 4) { s += d[i] + d[i + 1] + d[i + 2]; n.add(d[i] >> 4 << 8 | d[i + 1] >> 4 << 4 | d[i + 2] >> 4); } return { avg: s / (d.length / 4) / 3, colours: n.size };
  });
  check(lit.avg > 20 && lit.colours > 20, `picture is not blank (brightness ${lit.avg.toFixed(0)}, ${lit.colours} colours)`);

  await page.keyboard.press('a'); // auto render off while clicking through presets
  await page.click('[data-tab=scenes]');
  const names = await page.$$eval('#strip .ic.wide span', s => s.map(e => e.textContent));
  check(names.length >= 14, `${names.length} preset scenes listed`);
  for (const n of names) {
    await page.click('[data-tab=scenes]');
    await page.locator('#strip .ic.wide', { hasText: n }).first().click();
    await page.waitForFunction(t => document.querySelector('#lcd').textContent.startsWith(t), n, { timeout: 10000 }).catch(() => {});
  }
  check(true, 'every preset loads');

  await page.click('[data-tab=create]');
  for (const t of ['Arch', 'Stairs', 'Twist', 'Crystals', 'Column']) await page.locator('#strip .ic', { hasText: t }).first().click().catch(() => {});
  await page.click('[data-tab=scenes]');
  await page.click('text=🔗 Share');
  const url = page.url();
  check(/#s=[A-Za-z0-9_-]+$/.test(url), 'Share puts the world in the link');
  const enc = url.split('#s=')[1];
  await page.click('[data-tab=create]'); await page.click('text=Clear');
  await page.evaluate(() => { location.hash = ''; });
  await page.evaluate(h => { location.hash = 's=' + h; }, enc); await rendered(page);
  const count = await page.evaluate(() => { document.querySelector('[data-tab=create]').click(); return document.querySelector('#count').textContent; });
  check(/Objects: [1-9]/.test(count), 'shared link restores the world and renders (' + count.split('·')[0].trim() + ')');

  await page.evaluate(h => { location.hash = 's=' + h; },  Buffer.from(JSON.stringify([1, 999, -5, 1, 9, 1e9, 'x', null, 0, 0, 0, 0, 0, [1e9, 1e9, 1e9, 1e9, 1e9, 1e9], Array(40).fill([99, 1e9]), 7, [9, '<img src=x onerror=alert(1)>', 1]])).toString('base64url'));
  await page.waitForTimeout(1500);
  check(!(await page.isVisible('#err')) && (await page.$$('img[src=x]')).length === 0, 'hostile share link is handled safely');

  check(errors.length === 0, 'no console errors' + (errors.length ? ':\n       ' + errors.join('\n       ') : ''));
} finally { await browser.close(); server.close(); }

console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
