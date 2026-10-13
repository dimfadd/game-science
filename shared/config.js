/* Mat Sains: site configuration (safe to load on every page, before shared/auth.js).
 *
 * GOOGLE_CLIENT_ID: OAuth 2.0 client ID (type "Web application") from Google Cloud Console,
 * e.g. '1234567890-abc123.apps.googleusercontent.com'. Leave empty to keep the
 * "Masuk dengan Google (segera)" button inactive. The client ID is public by design
 * (it is not a secret), so it can live in this file.
 *
 * Authorized JavaScript origins for that client must include every origin the site is
 * served from, e.g. https://game-science-seven.vercel.app and http://localhost:8000.
 * Google sign-in does not work from file:// pages.
 *
 * SUPABASE_URL + SUPABASE_ANON_KEY: turn on online Balapan rooms (shared/net.js). Create a free
 * project at supabase.com, then copy Project Settings > API: the Project URL
 * (https://xxxx.supabase.co) and the "anon public" key. Both are meant to be public in a web
 * page. Only Realtime broadcast + presence is used: no tables, nothing is stored. Leave them
 * empty and Balapan works against bots only.
 */
window.MS = window.MS || {};
window.MS.config = Object.assign({
  GOOGLE_CLIENT_ID: '',
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: ''
}, window.MS.config || {});
