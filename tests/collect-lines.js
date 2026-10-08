/* Plays every level (like levels.js), records every line passed to GS.say and
 * writes the recording list in docs/NARASI.md between the LINES markers.
 * Lines containing digits vary per session, so they are listed separately. */
const fs = require('fs');
const path = require('path');
const { serve, launch, VIEWPORTS } = require('./lib');
const COUNTS = { timbangan: 12, angkot: 10, katak: 10, ketapel: 10, perahu: 10, martabak: 10 };

(async () => {
  const { server, base } = await serve();
  const browser = await launch();
  const byGame = {};
  for (const [game, count] of Object.entries(COUNTS)) {
    const ctx = await browser.newContext(VIEWPORTS.desktop);
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      window.__lines = [];
      const hook = () => {
        if (!window.GS || !window.GS.say || window.GS.say.__wrapped) return;
        const orig = window.GS.say;
        window.GS.say = function (t, o) { if (t) window.__lines.push(String(t)); return orig.call(this, t, o); };
        window.GS.say.__wrapped = true;
      };
      document.addEventListener('DOMContentLoaded', hook);
      const iv = setInterval(hook, 5);
      setTimeout(() => clearInterval(iv), 3000);
    });
    await page.goto(base + 'games/' + game + '/index.html?autotest');
    await page.waitForFunction(() => window.__game && window.__game.go, null, { timeout: 10000 });
    await page.evaluate(() => window.__game.speed && window.__game.speed(4));
    for (let i = 0; i < count; i++) {
      await page.evaluate(() => document.querySelectorAll('.gs-overlay').forEach(o => o.remove()));
      await page.evaluate(i => window.__game.go(i), i);
      await page.waitForTimeout(700);
      const t0 = Date.now(); let busy = false;
      while (Date.now() - t0 < 60000) {
        if (await page.$('.gs-win')) break;
        if (!busy) { busy = true; page.evaluate(() => window.__game.solve()).catch(() => {}).finally(() => setTimeout(() => { busy = false; }, 1500)); }
        await page.waitForTimeout(250);
      }
    }
    byGame[game] = [...new Set(await page.evaluate(() => window.__lines))];
    console.log(game, byGame[game].length, 'lines');
    await ctx.close();
  }
  await browser.close();
  server.close();

  const key = t => t.toLowerCase().replace(/[.,!?;:"'()]/g, '').replace(/\s+/g, ' ').trim();
  let n = 0, out = '';
  const dynamic = [];
  for (const [game, lines] of Object.entries(byGame)) {
    const fixed = lines.filter(l => !/\d/.test(l));
    dynamic.push(...lines.filter(l => /\d/.test(l)).map(l => [game, l]));
    out += '\n### ' + game + '\n\n| No | File | Kalimat |\n|---|---|---|\n';
    for (const l of fixed) { n++; out += '| ' + n + ' | `' + game + '-' + String(n).padStart(3, '0') + '.m4a` | ' + l.replace(/\|/g, '/') + ' |\n'; }
  }
  out += '\n### Kalimat dengan angka (berubah tiap main, sementara memakai suara perangkat)\n\n';
  for (const [g, l] of dynamic.slice(0, 80)) out += '- ' + g + ': ' + l + '\n';
  const file = path.join(__dirname, '..', 'docs', 'NARASI.md');
  const doc = fs.readFileSync(file, 'utf8');
  const next = doc.replace(/<!-- LINES:START -->[\s\S]*<!-- LINES:END -->/, '<!-- LINES:START -->\n' + out + '\n<!-- LINES:END -->');
  fs.writeFileSync(file, next);
  console.log('wrote', n, 'fixed lines and', dynamic.length, 'dynamic lines to docs/NARASI.md');
})();
