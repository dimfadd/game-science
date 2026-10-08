/* Plays every level of every game through window.__game.solve() and checks that
 * each one reaches the win overlay without errors. Usage: node tests/levels.js [gameId] */
const { serve, launch, VIEWPORTS, watch } = require('./lib');
const COUNTS = { timbangan: 12, angkot: 10, katak: 10, ketapel: 10, perahu: 10, martabak: 10 };
const only = process.argv[2];

(async () => {
  const { server, base } = await serve();
  const browser = await launch();
  let failed = 0;
  for (const [game, count] of Object.entries(COUNTS)) {
    if (only && only !== game) continue;
    const ctx = await browser.newContext(VIEWPORTS.desktop);
    const page = await ctx.newPage();
    const errors = watch(page, base);
    await page.goto(base + 'games/' + game + '/index.html?autotest');
    await page.waitForFunction(() => window.__game && window.__game.go, null, { timeout: 10000 });
    await page.evaluate(() => window.__game.speed && window.__game.speed(4));
    const line = [];
    for (let i = 0; i < count; i++) {
      await page.evaluate(() => document.querySelectorAll('.gs-overlay').forEach(o => o.remove()));
      await page.evaluate(i => window.__game.go(i), i);
      await page.waitForTimeout(700);
      const t0 = Date.now();
      let won = false, busy = false;
      while (Date.now() - t0 < 60000) {
        if (await page.$('.gs-win')) { won = true; break; }
        if (!busy) {
          busy = true;
          page.evaluate(() => window.__game.solve()).catch(e => errors.push('solve: ' + e.message)).finally(() => setTimeout(() => { busy = false; }, 1500));
        }
        await page.waitForTimeout(250);
      }
      line.push('L' + (i + 1) + (won ? '' : ' NO-WIN'));
      if (!won) failed++;
    }
    failed += errors.length;
    console.log((line.some(l => l.includes('NO-WIN')) || errors.length ? 'FAIL ' : 'ok   ') + game.padEnd(10) + line.join(' ') + (errors.length ? '\n     ' + errors.join('\n     ') : ''));
    await ctx.close();
  }
  await browser.close();
  server.close();
  process.exit(failed ? 1 : 0);
})();
