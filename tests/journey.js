/* End-to-end journey as a new player on a phone, with the login guard active:
 * hub -> redirected to the landing page -> tap the CTA -> welcome -> 3 questions -> login with the dev account ->
 * hub with profile chip -> tap the Timbangan landmark -> its sheet -> Main! -> start gate -> playing.
 * Screenshots go to $SHOTS (default: tests/shots). Usage: node tests/journey.js [phoneLandscape|phonePortrait|tablet] */
const fs = require('fs');
const path = require('path');
const { serve, launch, VIEWPORTS, watch } = require('./lib');
const vpName = process.argv[2] || 'phoneLandscape';
const SHOTS = process.env.SHOTS || path.join(__dirname, 'shots');

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const { server, base } = await serve();
  const browser = await launch();
  const ctx = await browser.newContext(VIEWPORTS[vpName]);
  // Behave like a real browser so the login guard and start gate are active.
  await ctx.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }));
  const page = await ctx.newPage();
  const errors = watch(page, base);
  const shot = n => page.screenshot({ path: path.join(SHOTS, vpName + '-' + n + '.png') });
  const step = (msg, ok) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) errors.push(msg); };

  await page.goto(base + 'index.html');
  await page.waitForURL(/landing\.html/, { timeout: 8000 }).catch(() => {});
  step('unauthenticated hub redirects to the landing page', /landing\.html/.test(page.url()));
  await page.waitForTimeout(900);
  await shot('0-landing');
  const cta = await page.$('.hero .cta');
  const cb = cta && await cta.boundingBox();
  step('landing CTA is visible without scrolling', !!cb && cb.y + cb.height <= (VIEWPORTS[vpName].viewport.height));
  if (cb) await page.touchscreen.tap(cb.x + cb.width / 2, cb.y + cb.height / 2);
  await page.waitForURL(/welcome\.html/, { timeout: 8000 }).catch(() => {});
  step('landing CTA opens welcome', /welcome\.html/.test(page.url()));
  await page.waitForSelector('#nick', { timeout: 8000 });
  await page.waitForTimeout(1200); // let the screen transition finish, as a person would
  await shot('1-name');
  await page.fill('#nick', 'Dimas');
  await page.click('#f-name button[type=submit]');
  await page.waitForSelector('.tile', { timeout: 8000 });
  await page.waitForTimeout(700);
  step('tiles fit inside the card', await page.evaluate(() => { const c = document.querySelector('.tiles').getBoundingClientRect(); return [...document.querySelectorAll('.tile')].every(t => { const r = t.getBoundingClientRect(); return r.right <= c.right + 1 && r.left >= c.left - 1; }); }));
  await shot('2-kelas');
  await page.click('.tile[data-k]:nth-child(2)');
  await page.waitForSelector('.av', { timeout: 8000 });
  await shot('3-avatar');
  await page.click('.av:nth-child(1)');
  await page.waitForSelector('#tab-in', { timeout: 8000 });
  await page.click('#tab-in');
  await page.fill('#in-email', 'test@matsains.id');
  await page.fill('#in-pw', 'test');
  await shot('4-login');
  await page.click('#f-in button[type=submit]');
  await page.waitForSelector('#go', { timeout: 8000 });
  await shot('5-success');
  await page.click('#go');
  await page.waitForURL(/index\.html/, { timeout: 8000 });
  await page.waitForTimeout(900);
  step('hub shows the profile chip', await page.$eval('#profile', el => el.textContent.includes('Dimas')).catch(() => false));
  await shot('6-hub');

  // Tap the Timbangan landmark: it stays in place and opens its sheet; "Main!" opens the game.
  const lm = await page.$('.node .lm');
  await lm.evaluate(el => el.scrollIntoView({ block: 'center' }));
  const b0 = await lm.boundingBox();
  await page.touchscreen.tap(b0.x + b0.width / 2, b0.y + b0.height / 2);
  await page.waitForTimeout(120);
  const b1 = await lm.boundingBox().catch(() => null);
  step('landmark stays in place when tapped', !b1 || Math.hypot(b1.x - b0.x, b1.y - b0.y) < 25);
  await page.waitForTimeout(600);
  step('tap opens the game sheet, not the game', /index\.html/.test(page.url()) && await page.isVisible('#sheetPlay'));
  await shot('6b-sheet');
  const pb = await (await page.$('#sheetPlay')).boundingBox();
  await page.touchscreen.tap(pb.x + pb.width / 2, pb.y + pb.height / 2);
  await page.waitForURL(/games\/timbangan/, { timeout: 8000 });
  await page.waitForTimeout(1200);
  const gate = await page.$('.gs-gate, [class*=gate]');
  step('game shows the start gate', !!gate);
  await shot('7-gate');
  if (gate) {
    const btn = await page.$('.gs-gate button');
    const r = btn && await btn.boundingBox();
    if (r) await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
    await page.waitForTimeout(1500);
  }
  step('gate closes after tapping Main!', !(await page.$('.gs-gate.show, .gs-gate:not([hidden])')) || !(await page.isVisible('.gs-gate')));
  await shot('8-playing');
  const scale = await page.evaluate(() => { const s = document.querySelector('svg.gs-stage'); const r = s && s.getBoundingClientRect(); return r ? [r.width, r.height] : null; });
  step('stage is visible', !!scale && scale[0] > 300);

  console.log(errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'journey ok');
  await browser.close(); server.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
