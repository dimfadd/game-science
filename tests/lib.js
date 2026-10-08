/* Shared helpers: a tiny static server for the repo (or dist/) and a browser launcher. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..', process.env.SITE_DIR || '.');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg' };

function serve(port = 0) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(port, '127.0.0.1', () => r({ server, base: 'http://127.0.0.1:' + server.address().port + '/' })));
}

function chromiumPath() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  const dir = '/opt/pw-browsers';
  if (fs.existsSync(dir)) {
    const c = fs.readdirSync(dir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();
    if (c) return path.join(dir, c, 'chrome-linux', 'chrome');
  }
  return undefined; // let playwright find its own browser
}

const launch = () => chromium.launch({ executablePath: chromiumPath() });

const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 800 } },
  tablet: { viewport: { width: 1180, height: 820 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  phoneLandscape: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  phonePortrait: { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
};

/** Collect console errors, page errors and failed same-origin requests (fonts and Google are ignored). */
function watch(page, base) {
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|accounts\.google|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(base)) errors.push(r.status() + ' ' + r.url()); });
  return errors;
}

module.exports = { serve, launch, VIEWPORTS, watch, ROOT };
