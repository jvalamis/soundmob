const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomCode(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

export const BRAND = "soundmob";

export const TOKENS = {
  bg: "#0a0a0b",
  ink: "#f4f0e8",
  gold: "#e8a849",
  pink: "#ff4d8d",
  muted: "rgba(244, 240, 232, 0.72)",
} as const;

export function baseStyles(): string {
  return `
    :root {
      color-scheme: dark;
      --bg: ${TOKENS.bg};
      --ink: ${TOKENS.ink};
      --gold: ${TOKENS.gold};
      --pink: ${TOKENS.pink};
      --muted: ${TOKENS.muted};
    }
    * { box-sizing: border-box; margin: 0; }
    body {
      min-height: 100svh;
      background: var(--bg);
      color: var(--ink);
      font-family: system-ui, -apple-system, Segoe UI, sans-serif;
      line-height: 1.5;
    }
    a { color: var(--gold); }
    .wrap { max-width: 56rem; margin: 0 auto; padding: 1.25rem; }
    .eyebrow {
      font-size: 0.65rem;
      letter-spacing: 0.24em;
      text-transform: lowercase;
      color: var(--gold);
      margin-bottom: 0.5rem;
    }
    h1 {
      font-size: clamp(1.75rem, 4vw, 2.5rem);
      letter-spacing: -0.02em;
      margin-bottom: 0.75rem;
    }
    p.lead { color: var(--muted); max-width: 36rem; margin-bottom: 1.5rem; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.7rem 1.1rem;
      border-radius: 999px;
      border: 1px solid rgba(232, 168, 73, 0.45);
      background: rgba(232, 168, 73, 0.12);
      color: var(--ink);
      text-decoration: none;
      font-weight: 600;
      cursor: pointer;
    }
    .btn:hover { background: rgba(232, 168, 73, 0.22); }
    .btn.secondary {
      border-color: rgba(244, 240, 232, 0.2);
      background: rgba(244, 240, 232, 0.06);
    }
    .panel {
      border: 1px solid rgba(244, 240, 232, 0.12);
      border-radius: 1rem;
      padding: 1rem;
      background: rgba(255, 255, 255, 0.03);
    }
    input, textarea {
      width: 100%;
      padding: 0.65rem 0.8rem;
      border-radius: 0.6rem;
      border: 1px solid rgba(244, 240, 232, 0.18);
      background: rgba(0, 0, 0, 0.35);
      color: var(--ink);
    }
    label { display: block; font-size: 0.85rem; color: var(--muted); margin-bottom: 0.35rem; }
    .stack { display: grid; gap: 0.75rem; }
    .row { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; }
    .tag {
      font-size: 0.75rem;
      letter-spacing: 0.12em;
      text-transform: lowercase;
      color: var(--pink);
    }
  `;
}

import type { LiveStatus } from "./types";

export type LandingParams = {
  origin: string;
  live: LiveStatus;
  isOperator: boolean;
};

export function landingPage({ live, isOperator }: LandingParams): string {
  const hostBtn = isOperator
    ? `<a class="btn" href="/host">open host session</a>`
    : "";

  let liveCard = `<div class="panel live-idle"><p class="meta">no session live right now.</p></div>`;
  if (live.live) {
    const playing = live.playback.playing ? "playing" : "paused";
    const title = live.playback.title || "nothing queued yet";
    const thumb = live.playback.thumbnail
      ? `<img class="live-thumb" src="${escapeHtml(live.playback.thumbnail)}" alt="" />`
      : "";
    liveCard = `<div class="panel live-card stack">
      <p class="tag">live now · ${escapeHtml(live.hostName)}</p>
      <div class="live-row">${thumb}<div>
        <p class="meta">room <code>${escapeHtml(live.code)}</code> · ${live.listeners} listener${live.listeners === 1 ? "" : "s"} · ${playing}</p>
        <p><strong>${escapeHtml(title)}</strong></p>
      </div></div>
      <a class="btn" href="${escapeHtml(live.joinUrl)}">join live</a>
    </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${BRAND}</title>
  <meta name="description" content="${BRAND} — synced listening rooms." />
  <link rel="preload" href="/images/hero-1.jpg" as="image" type="image/jpeg" />
  <style>
    ${baseStyles()}
    .hero {
      position: relative;
      min-height: 100svh;
      overflow: hidden;
      background: #000;
    }
    .hero img.bg {
      position: absolute; inset: 0; width: 100%; height: 100%;
      object-fit: cover; object-position: center 42%;
    }
    .hero::after {
      content: ""; position: absolute; inset: 0;
      background: linear-gradient(to top, rgba(10,10,11,.92), rgba(10,10,11,.2));
      pointer-events: none;
    }
    .hero-inner {
      position: relative; z-index: 1; min-height: 100svh;
      display: flex; flex-direction: column; justify-content: flex-end;
      padding: 1.5rem 1.25rem 2rem;
    }
    .actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.25rem; }
    .live-card { margin-top: 1.25rem; max-width: 28rem; }
    .live-idle { margin-top: 1.25rem; max-width: 28rem; }
    .live-row { display: flex; gap: 0.75rem; align-items: flex-start; }
    .live-thumb { width: 5.5rem; height: 3.1rem; object-fit: cover; border-radius: 0.35rem; }
    .mark {
      position: absolute; right: 1.5rem; bottom: 1.75rem; z-index: 2;
      font-size: 0.7rem; font-weight: 600; letter-spacing: 0.24em;
      text-transform: lowercase; color: rgba(244,240,232,.92);
    }
  </style>
</head>
<body>
  <main class="hero">
    <img class="bg" src="/images/hero-1.jpg" alt="" width="2752" height="1536" decoding="async" />
    <div class="hero-inner wrap">
      <p class="eyebrow">${BRAND}</p>
      <h1>synced listening, host-controlled.</h1>
      <p class="lead">the operator session is public on this page. listeners join with the room code — no password.</p>
      ${liveCard}
      <div class="actions">
        ${hostBtn}
        <a class="btn secondary" href="/listen">join a room</a>
      </div>
    </div>
    <p class="mark">${BRAND}</p>
    <p class="mark" style="left:1.25rem;right:auto;letter-spacing:0.08em;font-size:0.65rem">
      <a href="/privacy" style="color:inherit;text-decoration:none;margin-right:0.75rem">privacy</a>
      <a href="/terms" style="color:inherit;text-decoration:none">terms</a>
    </p>
  </main>
</body>
</html>`;
}

export function listenPage(code = ""): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${BRAND} · listen</title>
  <style>${baseStyles()}
    #player { aspect-ratio: 16/9; background: #000; border-radius: 0.75rem; overflow: hidden; }
    #chat { max-height: 12rem; overflow: auto; font-size: 0.9rem; }
    .chat-line { padding: 0.25rem 0; border-bottom: 1px solid rgba(255,255,255,.06); }
    .meta { font-size: 0.85rem; color: var(--muted); }
  </style>
  <script src="https://www.youtube.com/iframe_api" async></script>
</head>
<body>
  <div class="wrap stack">
    <p class="eyebrow">${BRAND} · listen</p>
    <h1>join the room</h1>
    <p class="lead">enter the room code from the landing page or your host.</p>

    <form id="join-form" class="panel stack">
      <div>
        <label for="code">room code</label>
        <input id="code" name="code" value="${escapeHtml(code)}" placeholder="e.g. K7P2M9" autocapitalize="characters" required autofocus />
      </div>
      <div>
        <label for="name">display name</label>
        <input id="name" name="name" placeholder="optional" maxlength="64" />
      </div>
      <button class="btn" type="submit">connect</button>
      <p id="join-error" class="tag" hidden></p>
    </form>

    <section id="room" class="stack" hidden>
      <p class="meta">listening with <strong id="host-name">host</strong> · <span id="listener-count">0</span> listeners</p>
      <div id="player"></div>
      <p id="now-playing" class="meta"></p>
      <div class="panel stack">
        <div id="chat"></div>
        <form id="chat-form" class="row">
          <input id="chat-input" placeholder="say something…" maxlength="500" style="flex:1" />
          <button class="btn secondary" type="submit">send</button>
        </form>
      </div>
    </section>
  </div>
  <script src="/js/listen.js" type="module"></script>
</body>
</html>`;
}

export function hostPage(userName: string, userPicture: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${BRAND} · host</title>
  <style>${baseStyles()}
    .profile { display: flex; align-items: center; gap: 0.75rem; }
    .profile img { width: 2.5rem; height: 2.5rem; border-radius: 999px; }
    #player { aspect-ratio: 16/9; background: #000; border-radius: 0.75rem; overflow: hidden; }
    .results { display: grid; gap: 0.5rem; }
    .result {
      display: grid; grid-template-columns: 4.5rem 1fr auto; gap: 0.75rem; align-items: center;
      padding: 0.5rem; border-radius: 0.6rem; border: 1px solid rgba(255,255,255,.08);
      cursor: pointer;
    }
    .result img { width: 4.5rem; height: 2.6rem; object-fit: cover; border-radius: 0.35rem; }
    .share code { font-size: 1.1rem; letter-spacing: 0.14em; }
    #chat { max-height: 10rem; overflow: auto; font-size: 0.9rem; }
    .meta { font-size: 0.85rem; color: var(--muted); }
    #host-status.error { color: var(--pink); }
    .legal { max-width: 40rem; }
    .legal h2 { font-size: 1.1rem; margin: 1.25rem 0 0.5rem; }
    .legal p, .legal li { color: var(--muted); margin-bottom: 0.75rem; }
  </style>
  <script src="https://www.youtube.com/iframe_api" async></script>
</head>
<body>
  <div class="wrap stack">
    <div class="row" style="justify-content: space-between">
      <div>
        <p class="eyebrow">${BRAND} · host</p>
        <h1>your session</h1>
      </div>
      <div class="profile">
        <img src="${escapeHtml(userPicture)}" alt="" />
        <div>
          <div>${escapeHtml(userName)}</div>
          <a href="/auth/logout">sign out</a>
        </div>
      </div>
    </div>

    <section id="setup" class="panel stack">
      <p id="host-status" class="lead" style="margin:0">starting your room…</p>
      <button id="create-room" class="btn" type="button" hidden>create room</button>
    </section>

    <section id="live" class="stack" hidden>
      <div class="panel share stack">
        <p class="tag">share with listeners</p>
        <p>code: <code id="room-code"></code></p>
        <p class="meta">join link: <a id="join-link" href="/listen"></a></p>
        <p class="meta"><span id="listener-count">0</span> listeners connected</p>
      </div>

      <div id="player"></div>

      <form id="search-form" class="row">
        <input id="search-input" placeholder="search youtube…" style="flex:1" />
        <button class="btn secondary" type="submit">search</button>
      </form>
      <div id="results" class="results"></div>

      <div class="panel stack">
        <p class="tag">queue</p>
        <div id="queue"></div>
      </div>

      <div class="panel stack">
        <div id="chat"></div>
        <form id="chat-form" class="row">
          <input id="chat-input" placeholder="chat to the room…" maxlength="500" style="flex:1" />
          <button class="btn secondary" type="submit">send</button>
        </form>
      </div>
    </section>
  </div>
  <script src="/js/host.js" type="module"></script>
</body>
</html>`;
}

export function privacyPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${BRAND} · privacy</title>
  <style>${baseStyles()}</style>
</head>
<body>
  <div class="wrap legal stack">
    <p class="eyebrow">${BRAND}</p>
    <h1>privacy policy</h1>
    <p class="lead">soundmob is a synced listening room service operated by the project owner.</p>
    <h2>what we collect</h2>
    <ul>
      <li><strong>Google sign-in:</strong> email, name, and profile picture to identify hosts.</li>
      <li><strong>Room data:</strong> room codes, playback state, and chat messages while a room is active.</li>
      <li><strong>YouTube search:</strong> search queries are sent to YouTube using a server API key; we do not use your Google account to search.</li>
    </ul>
    <h2>how we use data</h2>
    <p>Host identity is used to authorize room creation. Room state is stored in Cloudflare Workers (KV and Durable Objects) for sync between host and listeners. We do not sell personal data.</p>
    <h2>retention</h2>
    <p>Host sessions expire after seven days. Room data persists in Durable Objects until the room is replaced or evicted.</p>
    <h2>contact</h2>
    <p>Questions: use the operator contact on the Google OAuth consent screen for this app.</p>
    <p><a href="/">← back</a></p>
  </div>
</body>
</html>`;
}

export function termsPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${BRAND} · terms</title>
  <style>${baseStyles()}</style>
</head>
<body>
  <div class="wrap legal stack">
    <p class="eyebrow">${BRAND}</p>
    <h1>terms of use</h1>
    <p class="lead">By using soundmob you agree to these terms.</p>
    <h2>service</h2>
    <p>soundmob lets a host control a YouTube playback queue for private listener rooms. The service is provided as-is without warranty.</p>
    <h2>acceptable use</h2>
    <p>Do not use soundmob to harass others, stream infringing content, or abuse YouTube or Google APIs. Room codes are shared on the landing page when a session is live.</p>
    <h2>third parties</h2>
    <p>YouTube playback and search are subject to YouTube's terms. Google sign-in is subject to Google's policies.</p>
    <p><a href="/privacy">privacy policy</a> · <a href="/">home</a></p>
  </div>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
