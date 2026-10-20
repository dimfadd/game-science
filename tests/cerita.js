/* Petualangan (story mode, cerita.html + shared/cerita.js).
 * 1. Chapter data: every step's level exists in every kelas.
 * 2. New chapter: start card, opening comic, the mascot walks to stop 1, the villager asks,
 *    "Ayo bantu!" opens the real game in story mode; a locked stop opens nothing.
 * 3. Inside the game: the step's level, no level picker, Home goes to the chapter, a win shows
 *    the outcome card, saves the chapter progress AND the normal level stars.
 * 4. Back on the route the next villager asks right away; after the last stop the closing
 *    comic and the badge.
 * 5. Comic panel and route fit at 4 screen sizes, no horizontal scroll.
 * Usage: node tests/cerita.js   (screenshots in $SHOTS, default tests/shots) */
const fs = require('fs');
const path = require('path');
const { serve, launch, watch, VIEWPORTS } = require('./lib');
const SHOTS = process.env.SHOTS || path.join(__dirname, 'shots');

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const { server, base } = await serve();
  const browser = await launch();
  let failed = 0;
  const check = (msg, ok) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) failed++; };
  const until = async (page, fn, arg, ms = 8000) => { try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch (e) { return false; } };
  // same as tests/levels.js: faster animations, solve() again after each round, up to a minute
  async function solveLevel(page) {
    await page.evaluate(() => window.__game.speed && window.__game.speed(4));
    const t0 = Date.now();
    let busy = false;
    while (Date.now() - t0 < 60000) {
      if (await page.$('.st-ov')) return true;
      if (!busy) {
        busy = true;
        page.evaluate(() => { document.querySelectorAll('.gs-overlay').forEach(x => x.remove()); window.__game.solve(); }).catch(() => {}).finally(() => setTimeout(() => { busy = false; }, 1500));
      }
      await page.waitForTimeout(250);
    }
    return false;
  }

  // ---------- 1 + 2 + 3 + 4 on a phone ----------
  {
    const ctx = await browser.newContext(VIEWPORTS.phoneLandscape);
    const page = await ctx.newPage();
    const errors = watch(page, base);
    await page.goto(base + 'cerita.html?autotest&tier=k2');
    await page.waitForTimeout(400);
    const bad = await page.evaluate(() => {
      const out = [];
      MS.cerita.chapters.forEach(ch => ch.steps.forEach((st, i) => MS.kur.TIERS.forEach(t => {
        const n = MS.kur.levels(t.id), lv = MS.cerita.level(st, t.id);
        if (!(lv >= 0 && lv < n)) out.push(ch.id + ' step ' + i + ' ' + t.id + ': ' + lv);
      })));
      return out;
    });
    check('every step has a level in every kelas' + (bad.length ? ' (' + bad.join('; ') + ')' : ''), !bad.length);
    check('new chapter: the start card', await page.isVisible('#goIntro'));
    await page.click('#goIntro');
    check('opening comic: 4 panels', await until(page, () => { const c = __cerita.comic(); return c && c.n === 4; }));
    for (let k = 0; k < 4; k++) { await page.click('#cmNext'); await page.waitForTimeout(150); }
    check('the mascot walks to stop 1 and the villager asks', await until(page, () => { const c = __cerita.comic(); return c && c.i === 0 && /Terminal/.test(document.querySelector('.cm-tag').textContent); }, null, 6000));
    await page.click('#cmSkip');
    await page.click('.node[data-i="3"]', { force: true });
    await page.waitForTimeout(300);
    check('a locked stop opens nothing', !(await page.evaluate(() => __cerita.comic())));
    await page.click('.node[data-i="0"]', { force: true });
    await until(page, () => __cerita.comic());
    await page.click('#cmNext'); await page.waitForTimeout(150);
    check('the last panel says "Ayo bantu!"', /Ayo bantu/.test(await page.textContent('#cmNext')));
    await page.click('#cmNext');
    check('"Ayo bantu!" opens the game in story mode', await until(page, () => /games\/angkot\/index\.html\?story=festival&step=0/.test(location.href)));
    // the guard-free test URL keeps the kelas
    await page.goto(base + 'games/angkot/index.html?autotest&story=festival&step=0&tier=k2');
    await page.waitForTimeout(700);
    const g = await page.evaluate(() => ({ cur: GS._runner.current, want: MS.cerita.level(MS.cerita.get('festival').steps[0], 'k2'), home: document.querySelector('.gs-home').getAttribute('href'), picker: getComputedStyle(document.querySelector('.gs-levels')).display }));
    check('game: plays the step\'s level (' + g.cur + ')', g.cur === g.want);
    check('game: no level picker, Home goes to the chapter', g.picker === 'none' && /cerita\.html/.test(g.home));
    check('game: a win shows the outcome card', await solveLevel(page));
    await page.screenshot({ path: path.join(SHOTS, 'cerita-outcome.png') });
    const saved = await page.evaluate(lv => ({ p: MS.cerita.progress('festival'), stars: GS.store.stars('angkot')[lv] }), g.want);
    check('game: chapter progress and level stars saved', saved.p.done.indexOf(0) >= 0 && saved.p.stars[0] >= 1 && saved.stars >= 1);
    await page.click('#stNext');
    await page.waitForURL(/cerita\.html/); await page.waitForTimeout(300);
    check('back on the route: the next villager asks', await until(page, () => window.__cerita && __cerita.comic() && /Pasar/.test(document.querySelector('.cm-tag').textContent), null, 8000));
    // finish the chapter: remaining steps solved through the games
    const games = await page.evaluate(() => MS.cerita.get('festival').steps.map(s => s.game));
    for (let i = 1; i < games.length; i++) {
      await page.goto(base + 'games/' + games[i] + '/index.html?autotest&story=festival&step=' + i + '&tier=k2');
      await page.waitForTimeout(700);
      check('step ' + (i + 1) + ' (' + games[i] + ') solved', await solveLevel(page));
    }
    await page.click('#stNext');
    await page.waitForURL(/cerita\.html/); await page.waitForTimeout(300);
    check('after the last stop: the closing comic', await until(page, () => { const c = __cerita.comic(); return c && c.n === 4; }));
    await page.screenshot({ path: path.join(SHOTS, 'cerita-outro.png') });
    for (let k = 0; k < 4; k++) { await page.click('#cmNext'); await page.waitForTimeout(150); }
    check('then the badge', await until(page, () => /Lencana/.test(document.getElementById('card').textContent) && !document.getElementById('cardOv').hidden));
    await page.screenshot({ path: path.join(SHOTS, 'cerita-badge.png') });
    check('no errors', !errors.length);
    if (errors.length) console.log('  ' + errors.join('\n  '));
    await ctx.close();
  }

  // ---------- 5. fit ----------
  for (const name of ['phoneLandscape', 'phonePortrait', 'tablet', 'desktop']) {
    const ctx = await browser.newContext(VIEWPORTS[name]);
    const page = await ctx.newPage();
    await page.goto(base + 'cerita.html?autotest');
    await page.waitForTimeout(400);
    await page.click('#goIntro'); await page.waitForTimeout(300);
    const fit = await page.evaluate(() => {
      const r = el => el.getBoundingClientRect(), inV = b => b.left >= -1 && b.top >= -1 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1;
      const sv = document.querySelector('#cmArt svg.panel'), nx = document.getElementById('cmNext'), tx = document.getElementById('cmTxt');
      return { ok: inV(r(sv)) && inV(r(nx)) && inV(r(tx)) && r(sv).width > 250 && r(nx).height >= 54, scroll: document.documentElement.scrollWidth <= innerWidth + 1, font: parseFloat(getComputedStyle(tx).fontSize) };
    });
    await page.screenshot({ path: path.join(SHOTS, 'cerita-comic-' + name + '.png') });
    check(name + ': comic panel, text and button on screen (text ' + fit.font + 'px)', fit.ok && fit.scroll && fit.font >= 18);
    await page.click('#cmSkip'); await page.waitForTimeout(300);
    const route = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('.node .lm-art')].map(n => n.getBoundingClientRect());
      const bar = document.querySelector('.bar').getBoundingClientRect();
      return { inside: nodes.every(b => b.left >= -2 && b.right <= innerWidth + 2 && b.bottom <= innerHeight + 2 && b.top >= bar.bottom - 6), small: Math.min(...nodes.map(b => Math.min(b.width, b.height))) };
    });
    await page.screenshot({ path: path.join(SHOTS, 'cerita-route-' + name + '.png') });
    check(name + ': all 6 stops on screen below the bar, big enough (' + Math.round(route.small) + 'px)', route.inside && route.small >= 64);
    await ctx.close();
  }

  await browser.close(); server.close();
  console.log(failed ? failed + ' FAIL' : 'cerita ok');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
