/* Hub per kelas: signed-in hub at several sizes, the profile editor, switching
 * kelas changes the sheet texts and level counts, the game sheet (open, fit, X closes), and the level-up banner.
 * Screenshots go to $SHOTS (default tests/shots). */
const fs = require('fs');
const path = require('path');
const { serve, launch, watch } = require('./lib');
const SHOTS = process.env.SHOTS || path.join(__dirname, 'shots');
const SIZES = { phoneWide: [1000, 452], phoneLandscape: [844, 390], phonePortrait: [412, 915], tablet: [1180, 820] };

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const { server, base } = await serve();
  const browser = await launch();
  let failed = 0;
  const check = (msg, ok) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) failed++; };
  for (const [name, [w, h]] of Object.entries(SIZES)) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: name !== 'tablet' ? true : true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const errors = watch(page, base);
    await page.goto(base + 'welcome.html?autotest');
    await page.evaluate(async () => {
      MS.auth._.saveProfile({ name: 'Dimfad', kelas: '1', avatar: 'p0' });
      await MS.auth._.loginEmail('test@matsains.id', 'test');
    });
    await page.goto(base + 'index.html?autotest'); await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(SHOTS, 'hub-' + name + '.png') });
    // the map must reach both edges of its box (no empty strips)
    const fill = await page.evaluate(() => { const m = document.getElementById('map'); const r = m.getBoundingClientRect(); const vb = m.viewBox.baseVal; return { w: r.width, vbx: vb.x }; });
    check(name + ': map fills width (viewBox x ' + fill.vbx.toFixed(0) + ')', fill.w >= Math.min(w, 980) - 1);
    const overflowHead = await page.evaluate(() => { const t = document.querySelector('.head-tools').getBoundingClientRect(); return t.right <= innerWidth + 1; });
    check(name + ': header tools inside the screen', overflowHead);
    if (name === 'phoneWide' || name === 'phonePortrait') {
      await page.click('#tierBtn'); await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SHOTS, 'editor-' + name + '.png') });
      const inside = await page.evaluate(() => { const c = document.querySelector('.ms-pe .gs-card').getBoundingClientRect(); const x = document.querySelector('.ms-pe-close').getBoundingClientRect(); return x.top >= c.top && x.right <= c.right + 1; });
      check(name + ': editor close button inside the card', inside);
      await page.click('.ms-pe-tier[data-kelas="3"]');
      await page.fill('#ms-pe-name', 'Dimas');
      await page.click('#ms-pe-save');
      await page.waitForTimeout(1200);
      const label = await page.textContent('#tierLabel');
      await page.evaluate(() => document.querySelector('.node[data-id="timbangan"]').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
      await page.waitForTimeout(500);
      const desc = await page.textContent('#sheetDesc');
      check(name + ': kelas switched to ' + label, label === 'Kelas 3' && /Perkalian/.test(desc));
      const chip = await page.textContent('#profile');
      check(name + ': name changed', chip.includes('Dimas') || name === 'phonePortrait');
    }
    // tapping a place opens its sheet (what it teaches, Main!, X); X closes it again
    await page.reload(); await page.waitForTimeout(900);
    const lm = await page.$('.node[data-id="katak"] .lm');
    await lm.scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
    const lb = await lm.boundingBox();
    await page.touchscreen.tap(lb.x + lb.width / 2, lb.y + lb.height / 2); await page.waitForTimeout(600);
    const sh = await page.evaluate(() => {
      const c = document.querySelector('.sheet-card').getBoundingClientRect(), x = document.getElementById('sheetX').getBoundingClientRect(), p = document.getElementById('sheetPlay').getBoundingClientRect();
      return { open: !document.getElementById('sheet').hidden, href: document.getElementById('sheetPlay').getAttribute('href'), title: document.getElementById('sheetTitle').textContent,
        fits: c.top >= -1 && c.bottom <= innerHeight + 1 && c.left >= -1 && c.right <= innerWidth + 1, xIn: x.top >= c.top && x.right <= c.right + 1, playIn: p.bottom <= innerHeight, playH: p.height };
    });
    await page.screenshot({ path: path.join(SHOTS, 'sheet-' + name + '.png') });
    check(name + ': tapping a place opens its sheet (' + sh.title + ')', sh.open && sh.href === 'games/katak/index.html' && sh.title === 'Lompat Katak');
    check(name + ': sheet fits the screen with X and Main! visible', sh.fits && sh.xIn && sh.playIn && sh.playH >= 56);
    await page.tap('#sheetX'); await page.waitForTimeout(500);
    check(name + ': X closes the sheet and stays on the map', (await page.evaluate(() => document.getElementById('sheet').hidden)) && /index\.html/.test(page.url()));
    if (errors.length) { failed++; console.log('FAIL ' + name + ' errors:\n  ' + errors.join('\n  ')); }
    await ctx.close();
  }
  // level-up banner when every level of the tier has a star
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const page = await ctx.newPage();
  await page.goto(base + 'welcome.html?autotest');
  await page.evaluate(async () => {
    MS.auth._.saveProfile({ name: 'Dimfad', kelas: 'TK', avatar: 'p0' });
    await MS.auth._.loginEmail('test@matsains.id', 'test');
    ['timbangan', 'angkot', 'katak', 'ketapel', 'perahu', 'martabak', 'bibit', 'kembalian', 'jam', 'wayang'].forEach(g => GS.store.set('stars.' + g + '@tk', [3, 3, 2, 3, 1, 3]));
  });
  await page.goto(base + 'index.html?autotest'); await page.waitForTimeout(900);
  check('level-up banner shown after finishing TK', await page.isVisible('#levelUp'));
  await page.locator('#levelUp').screenshot({ path: path.join(SHOTS, 'levelup.png') });
  await page.click('#levelUpGo'); await page.waitForTimeout(1200);
  check('level-up moves to Kelas 1', (await page.textContent('#tierLabel')) === 'Kelas 1');
  await browser.close(); server.close();
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
