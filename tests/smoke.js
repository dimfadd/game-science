/* Loads every public page at four device sizes and fails on any error.
 * Usage: node tests/smoke.js            (repo root)
 *        SITE_DIR=dist node tests/smoke.js (after scripts/build.sh) */
const { serve, launch, VIEWPORTS, watch } = require('./lib');
const GAMES = ['timbangan', 'angkot', 'katak', 'ketapel', 'perahu', 'martabak', 'bibit', 'kembalian', 'jam', 'wayang'];
const PAGES = ['index.html', 'welcome.html', 'landing.html', ...GAMES.map(g => 'games/' + g + '/index.html')];

(async () => {
  const { server, base } = await serve();
  const browser = await launch();
  let failed = 0;
  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    const ctx = await browser.newContext(vp);
    for (const p of PAGES) {
      const page = await ctx.newPage();
      const errors = watch(page, base);
      await page.goto(base + p + '?autotest');
      await page.waitForTimeout(900);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      if (overflow) errors.push('horizontal overflow');
      console.log((errors.length ? 'FAIL' : 'ok  ') + ' ' + vpName.padEnd(14) + p + (errors.length ? '\n     ' + errors.join('\n     ') : ''));
      failed += errors.length ? 1 : 0;
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
  server.close();
  console.log(failed ? failed + ' page(s) failed' : 'all pages ok');
  process.exit(failed ? 1 : 0);
})();
