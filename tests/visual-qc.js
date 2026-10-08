/* Visual size QC (see docs/QC-VISUAL.md).
 * Opens every level of every tier on small phone screens and MEASURES, in CSS pixels:
 *   - every visible <text> in the game canvas (font size x canvas scale),
 *   - every drag target ([data-gs-drag], added by GS.drag) and tap target ([data-hit]),
 *   - HTML buttons in the dock and panels,
 *   - whether the canvas fills the screen width (no empty strips).
 * Text inside .gs-scene or [data-qc="decor"] is decoration and is skipped.
 * Usage: node tests/visual-qc.js [gameId] [tier]      (writes tests/shots/qc/*.png + report)
 * Exit code 1 when any level has a FAIL. */
const fs = require('fs');
const path = require('path');
const { serve, launch } = require('./lib');

const GAMES = ['timbangan', 'angkot', 'katak', 'ketapel', 'perahu', 'martabak'];
const TIERS = { tk: 6, k1: 8, k2: 8, k3: 8, k4: 8 };
// The smallest common Android phone in landscape, and a typical one.
const DEVICES = { phoneSmall: [740, 360], phone: [844, 390] };
const RULES = {
  textFail: 13, textWarn: 15,         // px: smallest readable label / comfortable label
  numFail: 16, numWarn: 20,           // px: digits a child must read to play
  targetFail: 40, targetWarn: 48,     // px: smallest side of a drag/tap target
  htmlTargetFail: 44                  // px: HTML buttons
};
const only = process.argv[2], onlyTier = process.argv[3];
const OUT = process.env.QC_DIR || path.join(__dirname, 'shots', 'qc');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { server, base } = await serve();
  const browser = await launch();
  const rows = [];
  for (const game of GAMES) {
    if (only && only !== game) continue;
    for (const [tier, count] of Object.entries(TIERS)) {
      if (onlyTier && onlyTier !== tier) continue;
      for (const [dev, [w, h]] of Object.entries(DEVICES)) {
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
        const page = await ctx.newPage();
        await page.goto(base + 'games/' + game + '/index.html?autotest&tier=' + tier);
        await page.waitForFunction(() => window.__game && window.__game.go, null, { timeout: 10000 });
        for (let i = 0; i < count; i++) {
          await page.evaluate(() => document.querySelectorAll('.gs-overlay').forEach(o => o.remove()));
          await page.evaluate(i => window.__game.go(i), i);
          await page.waitForTimeout(1100);
          // Hide the caption so it does not hide what we measure (it auto-hides in play too).
          await page.evaluate(() => document.querySelectorAll('.gs-caption').forEach(c => c.classList.remove('show')));
          const m = await page.evaluate((R) => {
            const svg = document.querySelector('svg.gs-stage');
            const vr = svg.getBoundingClientRect();
            const vis = el => {
              for (let n = el; n && n !== svg; n = n.parentNode) {
                if (n.classList && (n.classList.contains('gs-scene'))) return false;
                if (n.getAttribute && n.getAttribute('data-qc') === 'decor') return false;
                const cs = getComputedStyle(n);
                if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
              }
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.height > 0 && r.right > vr.left && r.left < vr.right && r.bottom > vr.top && r.top < vr.bottom;
            };
            const texts = [];
            svg.querySelectorAll('text').forEach(t => {
              if (!vis(t) || !t.textContent.trim()) return;
              const ctm = t.getScreenCTM();
              const scale = ctm ? Math.hypot(ctm.a, ctm.b) : 1;
              const px = parseFloat(getComputedStyle(t).fontSize) * scale;
              texts.push({ s: t.textContent.trim().slice(0, 18), px: Math.round(px * 10) / 10, num: /\d/.test(t.textContent) });
            });
            const targets = [];
            svg.querySelectorAll('[data-gs-drag], [data-hit]').forEach(el => {
              if (!vis(el)) return;
              const r = el.getBoundingClientRect();
              targets.push({ px: Math.round(Math.min(r.width, r.height)), id: (el.getAttribute('data-hit') || el.getAttribute('class') || el.tagName).slice(0, 20) });
            });
            const html = [];
            document.querySelectorAll('#dock button, .gs-dock button, button.gs-action').forEach(b => {
              const r = b.getBoundingClientRect(); const cs = getComputedStyle(b);
              if (!r.width || cs.visibility === 'hidden' || cs.display === 'none') return;
              html.push(Math.round(Math.min(r.width, r.height)));
            });
            const vb = svg.viewBox.baseVal, ctm = svg.getScreenCTM();
            const drawnW = vb.width * ctm.a;
            return { texts, targets, html, scale: Math.round(ctm.a * 1000) / 1000, fill: drawnW >= vr.width - 2 };
          }, RULES);
          const minT = m.texts.filter(t => !t.num).reduce((a, t) => Math.min(a, t.px), 99);
          const minN = m.texts.filter(t => t.num).reduce((a, t) => Math.min(a, t.px), 99);
          const minG = m.targets.reduce((a, t) => Math.min(a, t.px), 999);
          const minH = m.html.reduce((a, t) => Math.min(a, t), 999);
          const fails = [], warns = [];
          if (minT < RULES.textFail) fails.push('text ' + minT + 'px "' + m.texts.find(t => !t.num && t.px === minT).s + '"');
          else if (minT < RULES.textWarn) warns.push('text ' + minT + 'px');
          if (minN < RULES.numFail) fails.push('number ' + minN + 'px "' + m.texts.find(t => t.num && t.px === minN).s + '"');
          else if (minN < RULES.numWarn) warns.push('number ' + minN + 'px');
          if (minG < RULES.targetFail) fails.push('target ' + minG + 'px (' + m.targets.find(t => t.px === minG).id + ')');
          else if (minG < RULES.targetWarn) warns.push('target ' + minG + 'px');
          if (minH < RULES.htmlTargetFail) fails.push('button ' + minH + 'px');
          if (!m.fill) fails.push('canvas does not fill the width');
          const name = game + '-' + tier + '-L' + (i + 1) + '-' + dev;
          await page.screenshot({ path: path.join(OUT, name + '.png') });
          rows.push({ game, tier, level: i + 1, dev, scale: m.scale, minT, minN, minG, fails, warns });
          console.log((fails.length ? 'FAIL ' : warns.length ? 'warn ' : 'ok   ') + name.padEnd(30) + ' scale ' + m.scale + (fails.length ? '  ' + fails.join('; ') : '') + (warns.length && !fails.length ? '  ' + warns.join('; ') : ''));
        }
        await ctx.close();
      }
    }
  }
  await browser.close();
  server.close();
  const failed = rows.filter(r => r.fails.length);
  const md = ['# Visual QC report', '', 'Generated by `node tests/visual-qc.js`. Rules: docs/QC-VISUAL.md.', '',
    '| Result | Game | Tier | Level | Device | Scale | Min text px | Min number px | Min target px | Problems |', '|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map(r => `| ${r.fails.length ? 'FAIL' : r.warns.length ? 'warn' : 'ok'} | ${r.game} | ${r.tier} | ${r.level} | ${r.dev} | ${r.scale} | ${r.minT === 99 ? '-' : r.minT} | ${r.minN === 99 ? '-' : r.minN} | ${r.minG === 999 ? '-' : r.minG} | ${r.fails.concat(r.warns).join('; ')} |`)];
  fs.writeFileSync(path.join(OUT, 'report.md'), md.join('\n') + '\n');
  console.log('\n' + failed.length + ' of ' + rows.length + ' level views fail. Report: ' + path.join(OUT, 'report.md'));
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
