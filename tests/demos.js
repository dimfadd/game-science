/* Worked examples ("Contoh", docs/CONTOH.md): every level of every tier must have one, and
 * each example must reach the solved state through the game's real input handlers.
 * Also checks that the child's level is rebuilt afterwards and that "Lewati" works.
 * Usage: node tests/demos.js [gameId] [tier] */
const { serve, launch, VIEWPORTS, watch } = require('./lib');
const GAMES = ['timbangan', 'angkot', 'katak', 'ketapel', 'perahu', 'martabak', 'bibit', 'kembalian', 'jam', 'wayang', 'tukang', 'robot', 'dapur', 'angklung', 'layangan', 'lampu'];
const TIERS = { tk: 6, k1: 8, k2: 8, k3: 8, k4: 8 };
const only = process.argv[2], onlyTier = process.argv[3];

(async () => {
  const { server, base } = await serve();
  const browser = await launch();
  let failed = 0;
  for (const game of GAMES) for (const [tier, count] of Object.entries(TIERS)) {
    if (only && only !== game) continue;
    if (onlyTier && onlyTier !== tier) continue;
    const ctx = await browser.newContext(VIEWPORTS.phoneLandscape || VIEWPORTS.desktop);
    const page = await ctx.newPage();
    const errors = watch(page, base);
    await page.goto(base + 'games/' + game + '/index.html?autotest&tier=' + tier);
    await page.waitForFunction(() => window.__game && window.__game.go, null, { timeout: 10000 });
    await page.evaluate(() => { GS.demo.speed = 3; window.__game.speed && window.__game.speed(3); });
    const line = [];
    for (let i = 0; i < count; i++) {
      await page.evaluate(() => document.querySelectorAll('.gs-overlay').forEach(o => o.remove()));
      await page.evaluate(i => window.__game.go(i), i);
      await page.waitForTimeout(400);
      const res = await page.evaluate(() => Promise.race([
        GS._runner.playDemo(),
        new Promise(r => setTimeout(() => r('timeout'), 90000))
      ]));
      const after = await page.evaluate(() => ({ active: GS.demo.active, layer: !!document.querySelector('.gs-demo') }));
      if (after.active) errors.push('L' + (i + 1) + ' demo still active');
      line.push('L' + (i + 1) + (res === 'success' ? '' : ' ' + String(res).toUpperCase()));
      if (res !== 'success') failed++;
    }
    // "Lewati": start the first example and skip it at once; the level must rebuild cleanly.
    await page.evaluate(() => window.__game.go(0));
    await page.waitForTimeout(300);
    const skip = await page.evaluate(async () => { const p = GS._runner.playDemo(); setTimeout(() => GS.demo.skip(), 500); return p; });
    if (skip !== 'skipped' && skip !== 'none') errors.push('skip returned ' + skip);
    // Auto-play: with ?demotest the first visit of a level plays its example once, then never again.
    {
      const ctx2 = await browser.newContext(VIEWPORTS.phoneLandscape);   // fresh storage: nothing seen yet
      const pg = await ctx2.newPage();
      const errs2 = watch(pg, base);
      await pg.goto(base + 'games/' + game + '/index.html?autotest&demotest&tier=' + tier);
      await pg.waitForFunction(() => window.__game && window.GS && GS._runner, null, { timeout: 10000 });
      const auto = await pg.evaluate(async () => {
        const spec = GS._runner.demoSpec;
        if (!spec || spec.auto === false) return 'n/a';
        await new Promise(r => setTimeout(r, 600));
        const first = GS.demo.active;
        GS.demo.skip();
        await new Promise(r => setTimeout(r, 900));
        window.__game.go(GS._runner.current);
        await new Promise(r => setTimeout(r, 600));
        return first && !GS.demo.active ? 'ok' : 'first=' + first + ' again=' + GS.demo.active;
      });
      if (auto !== 'ok' && auto !== 'n/a') errors.push('auto-play: ' + auto);
      errs2.forEach(e => errors.push(e));
      await ctx2.close();
    }
    failed += errors.length;
    console.log((line.some(l => l.includes(' ')) || errors.length ? 'FAIL ' : 'ok   ') + (game + '@' + tier).padEnd(14) + line.join(' ') + (errors.length ? '\n     ' + errors.join('\n     ') : ''));
    await ctx.close();
  }
  await browser.close();
  server.close();
  process.exit(failed ? 1 : 0);
})();
