/* Balapan inside a real game (shared/race.js).
 * 1. Bot race in Lompat Katak on a phone: 5 rounds, a round won moves by its stars, "Ganti soal"
 *    moves 0, bots finish, results ranked, race rounds leave the normal stars untouched.
 * 2. The same seed builds the same level content on two devices.
 * 3. A room over the test transport (?net=bc): the guest opens another game and is moved to the
 *    host's game, both see the same content and each other's steps, bots fill seats, results agree.
 * 4. Hub: the Balapan screen lists the 10 games and starts a bot race in the picked one.
 * Usage: node tests/race.js   (screenshots in $SHOTS, default tests/shots) */
const fs = require('fs');
const path = require('path');
const { serve, launch, watch } = require('./lib');
const SHOTS = process.env.SHOTS || path.join(__dirname, 'shots');
const PHONE = { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const { server, base } = await serve();
  const browser = await launch();
  let failed = 0;
  const check = (msg, ok) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) failed++; };
  const until = async (page, fn, arg, ms = 10000) => { try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch (e) { return false; } };
  const myQi = page => page.evaluate(() => { const m = __race.players().find(p => p.id === __race.me()); return m ? m.qi : -1; });
  const myDist = page => page.evaluate(() => __race.players().find(p => p.id === __race.me()).dist);
  const content = page => page.evaluate(() => [...document.querySelectorAll('svg.gs-stage text')].map(t => t.textContent).join('|'));
  // play the current round to the end through the game's own solve() (multi-round levels need several)
  async function solveRound(page) {
    const q = await myQi(page);
    for (let k = 0; k < 15 && (await myQi(page)) === q; k++) {
      await page.evaluate(() => { document.querySelectorAll('.gs-overlay').forEach(x => x.remove()); window.__game.solve(); });
      await page.waitForTimeout(900);
    }
    await until(page, () => __race.state() !== 'race' || document.getElementById('rcOv').hidden, null, 6000);
  }

  // ---------- 1. bot race ----------
  {
    const ctx = await browser.newContext(PHONE);
    const page = await ctx.newPage();
    const errors = watch(page, base);
    await page.goto(base + 'games/katak/index.html?autotest&race=bot&seed=t1&tier=k1');
    check('bot race starts with 4 racers and 5 rounds', await until(page, () => window.__race && __race.state() === 'race' && __race.players().length === 4 && __race.plan().length === 5));
    check('the level picker and example button are hidden', await page.evaluate(() => { const l = document.querySelector('.gs-levels'); return !l || getComputedStyle(l).display === 'none'; }));
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(SHOTS, 'race-round.png') });
    await solveRound(page);
    const d1 = await myDist(page);
    check('round 1 won moves by its stars (' + d1 + ')', d1 >= 1 && d1 <= 3);
    await page.evaluate(() => __race.skip());
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOTS, 'race-view.png') });
    check('"Ganti soal" moves 0 steps', (await myDist(page)) === d1 && (await myQi(page)) === 2);
    await until(page, () => document.getElementById('rcOv').hidden, null, 5000);
    for (let r = 2; r < 5; r++) await solveRound(page);
    const total = await myDist(page);
    check('all 5 rounds done (' + total + ' steps of 15)', await page.evaluate(() => __race.players().find(p => p.id === __race.me()).done));
    await page.evaluate(() => __race.finishBots());
    check('results after the bots finish', await until(page, () => __race.state() === 'end' && /juara/i.test(document.getElementById('rcCard').textContent)));
    const order = await page.evaluate(() => [...document.querySelectorAll('.rc-res .sc')].map(s => parseInt(s.textContent, 10)));
    check('results ranked by steps (' + order.join(',') + ')', order.length === 4 && order.every((v, i) => !i || order[i - 1] >= v));
    check('bots labelled BOT', (await page.$$('.rc-res .rc-tag.bot')).length === 3);
    check('race rounds leave the normal stars alone', await page.evaluate(() => GS.store.stars('katak').filter(Boolean).length === 0));
    await page.screenshot({ path: path.join(SHOTS, 'race-result.png') });
    check('bot race: no errors', !errors.length);
    if (errors.length) console.log('  ' + errors.join('\n  '));
    await ctx.close();
  }

  // ---------- 2. same seed, same content (each of the 10 games, round 1) ----------
  for (const g of ['timbangan', 'angkot', 'katak', 'ketapel', 'perahu', 'martabak', 'bibit', 'kembalian', 'jam', 'wayang']) {
    const sig = [];
    for (let k = 0; k < 2; k++) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await ctx.newPage();
      await page.goto(base + 'games/' + g + '/index.html?autotest&race=bot&seed=same&tier=k2');
      await until(page, () => window.__race && __race.state() === 'race');
      await page.waitForTimeout(500);
      sig.push(await content(page) + '#' + await page.evaluate(() => __race.plan().join(',')));
      await ctx.close();
    }
    check(g + ': same seed builds the same round 1', sig[0] === sig[1] && sig[0].length > 3);
  }

  // ---------- 3. room over the test transport ----------
  {
    const ctx = await browser.newContext(PHONE);
    const host = await ctx.newPage(), guest = await ctx.newPage();
    const eh = watch(host, base), eg = watch(guest, base);
    const code = 'TST' + String.fromCharCode(65 + Math.floor(Math.random() * 20)) + String.fromCharCode(65 + Math.floor(Math.random() * 20));
    await host.goto(base + 'games/katak/index.html?autotest&net=bc&race=host&room=' + code + '&tier=k1');
    await host.waitForTimeout(600);
    await guest.goto(base + 'games/timbangan/index.html?autotest&net=bc&race=join&room=' + code + '&tier=k3');
    check('room: the guest is moved to the host\'s game and kelas', await until(guest, () => /games\/katak\//.test(location.pathname) && /tier=k1/.test(location.search), null, 12000));
    check('room: host lobby lists 2 children', await until(host, () => document.querySelectorAll('.rc-list li:not(.empty)').length === 2, null, 12000));
    await host.screenshot({ path: path.join(SHOTS, 'race-lobby.png') });
    await host.evaluate(() => __race.start());
    check('room: both race, 2 children + 2 bots', await until(host, () => __race.state() === 'race' && __race.players().filter(p => p.bot).length === 2) && await until(guest, () => window.__race && __race.state() === 'race' && __race.players().length === 4));
    await host.waitForTimeout(500);
    check('room: same level content on both devices', (await content(host)) === (await content(guest)));
    await solveRound(guest);
    check('room: the host sees the guest move', await until(host, () => __race.players().some(p => !p.bot && p.id !== __race.me() && p.dist > 0)));
    for (let r = 0; r < 5; r++) { await solveRound(host); if (r) await solveRound(guest); }
    await host.evaluate(() => __race.finishBots());
    check('room: results on both', await until(host, () => __race.state() === 'end') && await until(guest, () => __race.state() === 'end'));
    const rs = p => p.evaluate(() => [...document.querySelectorAll('.rc-res .sc')].map(s => s.textContent.split(',')[0]).join('|'));
    const rh = await rs(host), rg = await rs(guest);
    check('room: both see the same steps (' + rh + ')', rh === rg);
    check('room: no errors', !eh.length && !eg.length);
    if (eh.length || eg.length) console.log('  ' + eh.concat(eg).join('\n  '));
    await ctx.close();
  }

  // ---------- 4. hub ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(base + 'index.html?autotest#balapan'); await page.waitForTimeout(700);
    check('hub: 10 games to race in', (await page.$$('#raceGames .rg')).length === 10);
    await page.click('#raceHost'); await page.waitForTimeout(200);
    check('hub: without a server the room buttons explain online is off', await page.isVisible('#raceOff'));
    await page.click('#raceGames .rg[data-g="jam"]');
    await page.screenshot({ path: path.join(SHOTS, 'race-hub.png'), fullPage: true });
    await page.click('#raceBot');
    check('hub: "Lawan bot" opens a race in the picked game', await until(page, () => /games\/jam\/index\.html\?race=bot/.test(location.href)));
    await ctx.close();
  }

  await browser.close(); server.close();
  console.log(failed ? failed + ' FAIL' : 'race ok');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
