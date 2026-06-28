import { Hono } from "hono";
import { exchangeGoogleCode, googleAuthUrl } from "./auth";
import {
  hostPage,
  landingPage,
  listenPage,
  privacyPage,
  termsPage,
} from "./html";
import { randomCode } from "./html";
import { Room } from "./room";
import { loadSecrets, type SecretBinding } from "./secrets";
import {
  clearSessionCookie,
  createSession,
  getSession,
  readSessionId,
  saveSession,
  sessionCookie,
} from "./session";
import { searchVideos } from "./youtube";
import type {
  ActiveRoom,
  LiveStatus,
  PlaybackState,
  RoomSnapshot,
  SessionUser,
} from "./types";

export type Env = {
  ASSETS: Fetcher;
  SESSIONS: KVNamespace;
  ROOM: DurableObjectNamespace;
  YOUTUBE_DATA_API_KEY: string | SecretBinding;
  SESSION_SECRET: string | SecretBinding;
  SOUNDMOB_OAUTH_CLIENT_ID?: string | SecretBinding;
  SOUNDMOB_OAUTH_CLIENT_SECRET?: string | SecretBinding;
  SOUNDMOB_OPERATOR_EMAIL?: string | SecretBinding;
};

const OAUTH_STATE_TTL = 600;
const LIVE_ROOM_KEY = "live:room";

type LiveRoomRecord = { code: string; updatedAt: number };

const app = new Hono<{ Bindings: Env }>();

function origin(c: { req: { url: string } }): string {
  return new URL(c.req.url).origin;
}

function isSecure(c: { req: { url: string } }): boolean {
  return new URL(c.req.url).protocol === "https:";
}

function redirectUri(originUrl: string): string {
  return `${originUrl}/auth/google/callback`;
}

function secretBindings(env: Env) {
  return {
    youtubeApiKey: env.YOUTUBE_DATA_API_KEY,
    sessionSecret: env.SESSION_SECRET,
    oauthClientId: env.SOUNDMOB_OAUTH_CLIENT_ID,
    oauthClientSecret: env.SOUNDMOB_OAUTH_CLIENT_SECRET,
    operatorEmail: env.SOUNDMOB_OPERATOR_EMAIL,
  };
}

type RequestCtx = {
  env: Env;
  req: { header: (name: string) => string | undefined; url: string };
};

function isOperatorEmail(email: string, configured: string): boolean {
  const norm = (value: string) => value.trim().toLowerCase();
  const allowed = norm(configured);
  return Boolean(allowed && norm(email) === allowed);
}

async function roomSnapshotCheck(
  env: Env,
  code: string,
): Promise<{ ok: true } | { ok: false; reason: "missing" | "gone" }> {
  const stub = env.ROOM.get(env.ROOM.idFromName(code));
  const res = await stub.fetch("https://do/snapshot");
  if (!res.ok) return { ok: false, reason: "missing" };
  const body = (await res.json()) as { error?: string };
  if (body.error === "not_initialized") return { ok: false, reason: "gone" };
  return { ok: true };
}

async function fetchRoomSnapshot(
  env: Env,
  code: string,
): Promise<RoomSnapshot | null> {
  const stub = env.ROOM.get(env.ROOM.idFromName(code));
  const res = await stub.fetch("https://do/snapshot");
  if (!res.ok) return null;
  const body = (await res.json()) as RoomSnapshot | { error?: string };
  if ("error" in body && body.error) return null;
  if (!("code" in body)) return null;
  return body;
}

async function getLiveRoomRecord(env: Env): Promise<LiveRoomRecord | null> {
  const raw = await env.SESSIONS.get(LIVE_ROOM_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LiveRoomRecord;
    if (typeof parsed.code === "string") return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

async function setLiveRoom(env: Env, code: string): Promise<void> {
  const record: LiveRoomRecord = { code, updatedAt: Date.now() };
  await env.SESSIONS.put(LIVE_ROOM_KEY, JSON.stringify(record));
}

async function clearLiveRoom(env: Env): Promise<void> {
  await env.SESSIONS.delete(LIVE_ROOM_KEY);
}

async function resolveLiveStatus(
  env: Env,
  originUrl: string,
): Promise<LiveStatus> {
  const record = await getLiveRoomRecord(env);
  if (!record) return { live: false };

  const snap = await fetchRoomSnapshot(env, record.code);
  if (!snap) {
    await clearLiveRoom(env);
    return { live: false };
  }

  return {
    live: true,
    code: snap.code,
    joinUrl: `${originUrl}/listen?code=${snap.code}`,
    hostName: snap.hostName,
    listeners: snap.listeners,
    playback: {
      videoId: snap.playback.videoId,
      title: snap.playback.title,
      thumbnail: snap.playback.thumbnail,
      playing: snap.playback.playing,
      positionSec: snap.playback.positionSec,
    },
  };
}

async function requireUser(c: RequestCtx): Promise<SessionUser | null> {
  const sessionId = readSessionId(c.req.header("Cookie"));
  return getSession(c.env.SESSIONS, sessionId);
}

async function requireUserWithSession(
  c: RequestCtx,
): Promise<{ user: SessionUser; sessionId: string } | null> {
  const sessionId = readSessionId(c.req.header("Cookie"));
  if (!sessionId) return null;
  const user = await getSession(c.env.SESSIONS, sessionId);
  if (!user) return null;
  return { user, sessionId };
}

async function stripNonOperatorActiveRoom(
  c: RequestCtx,
  sessionId: string,
  user: SessionUser,
  operatorEmail: string,
): Promise<SessionUser> {
  if (!user.activeRoom) return user;
  if (isOperatorEmail(user.email, operatorEmail)) return user;
  const { activeRoom: _, ...rest } = user;
  await saveSession(c.env.SESSIONS, sessionId, rest);
  return rest;
}

type OperatorGate =
  | { ok: true; user: SessionUser; sessionId?: string }
  | { ok: false; status: 403 | 503; error: string };

async function requireOperator(c: RequestCtx): Promise<OperatorGate> {
  const secrets = await loadSecrets(secretBindings(c.env));
  if (!secrets.operatorEmail.trim()) {
    return { ok: false, status: 503, error: "operator_not_configured" };
  }

  const auth = await requireUserWithSession(c);
  if (!auth) return { ok: false, status: 403, error: "not_operator" };

  let { user, sessionId } = auth;
  user = await stripNonOperatorActiveRoom(
    c,
    sessionId,
    user,
    secrets.operatorEmail,
  );

  if (!isOperatorEmail(user.email, secrets.operatorEmail)) {
    return { ok: false, status: 403, error: "not_operator" };
  }

  return { ok: true, user, sessionId };
}

async function clearActiveRoom(
  c: RequestCtx,
  sessionId: string,
  user: SessionUser,
) {
  const { activeRoom: _, ...rest } = user;
  await saveSession(c.env.SESSIONS, sessionId, rest);
}

function roomPayload(originUrl: string, active: ActiveRoom) {
  return {
    code: active.code,
    joinUrl: `${originUrl}/listen?code=${active.code}`,
  };
}

app.get("/health", (c) => c.json({ ok: true, service: "soundmob" }));

app.get("/api/youtube/status", async (c) => {
  const secrets = await loadSecrets(secretBindings(c.env));
  return c.json({
    configured: Boolean(secrets.youtubeApiKey),
    oauth: Boolean(secrets.oauthClientId && secrets.oauthClientSecret),
    operator: Boolean(secrets.operatorEmail.trim()),
  });
});

app.get("/api/live", async (c) => {
  const live = await resolveLiveStatus(c.env, origin(c));
  return c.json(live);
});

app.get("/", async (c) => {
  const live = await resolveLiveStatus(c.env, origin(c));
  const secrets = await loadSecrets(secretBindings(c.env));
  const user = await requireUser(c);
  const isOperator = Boolean(
    user &&
      secrets.operatorEmail.trim() &&
      isOperatorEmail(user.email, secrets.operatorEmail),
  );
  return c.html(landingPage({ origin: origin(c), live, isOperator }));
});

app.get("/privacy", (c) => c.html(privacyPage()));

app.get("/terms", (c) => c.html(termsPage()));

app.get("/listen", (c) => {
  const code = c.req.query("code")?.toUpperCase() ?? "";
  return c.html(listenPage(code));
});

app.get("/host", async (c) => {
  const gate = await requireOperator(c);
  if (!gate.ok) {
    if (gate.status === 503) {
      return c.text("operator not configured", 503);
    }
    return c.redirect("/");
  }
  return c.html(hostPage(gate.user.name, gate.user.picture));
});

app.get("/api/me", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ authenticated: false }, 401);
  const secrets = await loadSecrets(secretBindings(c.env));
  const sessionId = readSessionId(c.req.header("Cookie"));
  let profile = user;
  if (sessionId) {
    profile = await stripNonOperatorActiveRoom(
      c,
      sessionId,
      user,
      secrets.operatorEmail,
    );
  }
  const isOperator = Boolean(
    secrets.operatorEmail.trim() &&
      isOperatorEmail(profile.email, secrets.operatorEmail),
  );
  return c.json({
    authenticated: true,
    name: profile.name,
    picture: profile.picture,
    email: profile.email,
    isOperator,
  });
});

app.get("/api/rooms/active", async (c) => {
  const gate = await requireOperator(c);
  if (!gate.ok) {
    return c.json({ error: gate.error }, gate.status);
  }

  const { user, sessionId } = gate;
  if (!user.activeRoom) return c.json({ error: "no_active_room" }, 404);

  const snap = await roomSnapshotCheck(c.env, user.activeRoom.code);
  if (!snap.ok) {
    if (sessionId) await clearActiveRoom(c, sessionId, user);
    await clearLiveRoom(c.env);
    return c.json({ error: "room_gone" }, 404);
  }

  await setLiveRoom(c.env, user.activeRoom.code);
  return c.json(roomPayload(origin(c), user.activeRoom));
});

app.get("/auth/google", async (c) => {
  const secrets = await loadSecrets(secretBindings(c.env));
  if (!secrets.oauthClientId || !secrets.oauthClientSecret) {
    return c.html(
      `<!DOCTYPE html><html><body style="font-family:system-ui;background:#0a0a0b;color:#f4f0e8;padding:2rem"><h1>soundmob</h1><p>google oauth is not configured yet.</p><p><a href="/">back</a></p></body></html>`,
      503,
    );
  }
  const state = crypto.randomUUID();
  await c.env.SESSIONS.put(`oauth-state:${state}`, "1", {
    expirationTtl: OAUTH_STATE_TTL,
  });
  const url = googleAuthUrl(
    secrets.oauthClientId,
    redirectUri(origin(c)),
    state,
  );
  return c.redirect(url);
});

app.get("/api/oauth/config", async (c) => {
  const secrets = await loadSecrets(secretBindings(c.env));
  const redirect = redirectUri(origin(c));
  return c.json({
    redirectUri: redirect,
    javascriptOrigin: origin(c),
    oauthConfigured: Boolean(
      secrets.oauthClientId && secrets.oauthClientSecret,
    ),
    scopes: ["openid", "email", "profile"],
    consoleHint:
      "Google Auth Platform → Clients → your Web client → add redirectUri + javascriptOrigin exactly as above.",
  });
});

app.get("/auth/google/callback", async (c) => {
  const oauthError = c.req.query("error");
  const oauthErrorDescription = c.req.query("error_description");
  if (oauthError) {
    const redirect = redirectUri(origin(c));
    return c.html(
      `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>soundmob · sign-in failed</title><style>body{font-family:system-ui;background:#0a0a0b;color:#f4f0e8;padding:2rem;max-width:40rem;line-height:1.5}code{background:rgba(255,255,255,.08);padding:.15rem .35rem;border-radius:.25rem;word-break:break-all}a{color:#e8a849}</style></head><body><h1>soundmob</h1><p><strong>google sign-in failed:</strong> ${escapeHtml(oauthError)}</p>${oauthErrorDescription ? `<p>${escapeHtml(oauthErrorDescription)}</p>` : ""}<p>register this redirect URI in <strong>Google Auth Platform → Clients</strong>:</p><p><code>${escapeHtml(redirect)}</code></p><p>also add JavaScript origin: <code>${escapeHtml(origin(c))}</code></p><p><a href="/">back</a></p></body></html>`,
      400,
    );
  }

  const state = c.req.query("state");
  if (!state) return c.text("missing state", 400);
  const stateKey = `oauth-state:${state}`;
  const stateOk = await c.env.SESSIONS.get(stateKey);
  if (!stateOk) return c.text("invalid state", 400);
  await c.env.SESSIONS.delete(stateKey);

  const code = c.req.query("code");
  if (!code) return c.text("missing code", 400);

  const secrets = await loadSecrets(secretBindings(c.env));

  try {
    const user = await exchangeGoogleCode(
      code,
      secrets.oauthClientId,
      secrets.oauthClientSecret,
      redirectUri(origin(c)),
    );
    const sessionId = await createSession(c.env.SESSIONS, user);
    c.header("Set-Cookie", sessionCookie(sessionId, { secure: isSecure(c) }));
    const dest =
      secrets.operatorEmail.trim() &&
      isOperatorEmail(user.email, secrets.operatorEmail)
        ? "/host"
        : "/";
    return c.redirect(dest);
  } catch (err) {
    const message = err instanceof Error ? err.message : "authentication failed";
    return c.html(
      `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><title>soundmob · auth error</title><style>body{font-family:system-ui;background:#0a0a0b;color:#f4f0e8;padding:2rem;max-width:40rem}code{background:rgba(255,255,255,.08);padding:.15rem .35rem;border-radius:.25rem;word-break:break-all}</style></head><body><h1>soundmob</h1><p>authentication failed after google redirected back.</p><p><code>${escapeHtml(message)}</code></p><p>check redirect URI matches <a href="/api/oauth/config">/api/oauth/config</a></p><p><a href="/">back</a></p></body></html>`,
      500,
    );
  }
});

app.get("/auth/logout", async (c) => {
  const sessionId = readSessionId(c.req.header("Cookie"));
  if (sessionId) {
    const user = await getSession(c.env.SESSIONS, sessionId);
    if (user?.activeRoom) {
      const record = await getLiveRoomRecord(c.env);
      if (record?.code === user.activeRoom.code) {
        await clearLiveRoom(c.env);
      }
    }
    await c.env.SESSIONS.delete(`session:${sessionId}`);
  }
  c.header("Set-Cookie", clearSessionCookie({ secure: isSecure(c) }));
  return c.redirect("/");
});

app.get("/api/youtube/search", async (c) => {
  const gate = await requireOperator(c);
  if (!gate.ok) {
    return c.json({ error: gate.error }, gate.status);
  }

  const q = c.req.query("q")?.trim();
  if (!q) return c.json({ items: [] });

  const secrets = await loadSecrets(secretBindings(c.env));

  try {
    const items = await searchVideos(secrets.youtubeApiKey, q);
    return c.json({ items });
  } catch {
    return c.json({ error: "search_failed" }, 502);
  }
});

app.post("/api/rooms", async (c) => {
  const gate = await requireOperator(c);
  if (!gate.ok) {
    return c.json({ error: gate.error }, gate.status);
  }

  const { user, sessionId } = gate;
  const secrets = await loadSecrets(secretBindings(c.env));
  const code = randomCode(6);
  const playback: PlaybackState = {
    videoId: null,
    title: "",
    thumbnail: "",
    playing: false,
    positionSec: 0,
    updatedAt: Date.now(),
  };

  const stub = c.env.ROOM.get(c.env.ROOM.idFromName(code));
  const initRes = await stub.fetch("https://do/init", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Soundmob-Internal": secrets.sessionSecret,
    },
    body: JSON.stringify({
      code,
      hostId: user.id,
      hostName: user.name,
      playback,
      queue: [],
    }),
  });

  if (!initRes.ok) {
    const detail = initRes.status === 403 ? "room_init_forbidden" : "room_init_failed";
    return c.json({ error: "room_create_failed", detail }, 500);
  }

  const activeRoom = { code };
  if (sessionId) {
    await saveSession(c.env.SESSIONS, sessionId, { ...user, activeRoom });
  }
  await setLiveRoom(c.env, code);

  return c.json(roomPayload(origin(c), activeRoom));
});

app.get("/room/:code/ws", async (c) => {
  const code = c.req.param("code").toUpperCase();
  const role = c.req.query("role");

  const headers = new Headers(c.req.raw.headers);
  if (role === "host") {
    const gate = await requireOperator(c);
    if (!gate.ok) {
      return c.text(gate.error, gate.status);
    }
    headers.set("X-Host-Id", gate.user.id);
  }

  const url = new URL(c.req.url);
  url.pathname = "/ws";

  const stub = c.env.ROOM.get(c.env.ROOM.idFromName(code));
  return stub.fetch(new Request(url.toString(), { headers, method: "GET" }));
});

app.all("*", async (c) => {
  const asset = await c.env.ASSETS.fetch(c.req.raw);
  if (asset.status !== 404) return asset;
  return c.notFound();
});

export { Room };
export default app;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
