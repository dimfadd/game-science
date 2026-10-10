/* Regression test: hovering or pressing a hub landmark must not move it away
 * (a CSS transform on an SVG group replaces its transform attribute). */
const { serve, launch, VIEWPORTS } = require('./lib');
(async () => {
  const { server, base } = await serve();
  const browser = await launch();
  const page = await (await browser.newContext(VIEWPORTS.desktop)).newPage();
  await page.goto(base + 'index.html?autotest');
  await page.waitForTimeout(800);
  let failed = 0;
  const n = await page.$$eval('.node .lm', els => els.length);
  const want = await page.evaluate(() => Object.keys(MS.kur.GAMES).length);
  if (n !== want || n < 10) { failed++; console.log('FAIL expected ' + want + ' landmarks on the map, found ' + n); }
  for (let i = 0; i < n; i++) {
    const box = () => page.evaluate(i => { const r = document.querySelectorAll('.node .lm')[i].getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, i);
    const rest = await box();
    await page.mouse.move(rest.x, rest.y); await page.waitForTimeout(350);
    const hover = await box();
    await page.mouse.down(); await page.waitForTimeout(350);
    const press = await box();
    await page.mouse.up({ button: 'left' }).catch(() => {});
    const far = p => Math.hypot(p.x - rest.x, p.y - rest.y) > 25;
    const bad = far(hover) || far(press);
    if (bad) failed++;
    console.log((bad ? 'FAIL ' : 'ok   ') + 'landmark ' + i, JSON.stringify({ rest, hover, press }));
    await page.goto(base + 'index.html?autotest'); await page.waitForTimeout(600);
  }
  await browser.close(); server.close();
  process.exit(failed ? 1 : 0);
})();
