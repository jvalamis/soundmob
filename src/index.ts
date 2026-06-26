import { Hono } from "hono";
import { exchangeGoogleCode, googleAuthUrl, refreshAccessToken } from "./auth";
import { hostPage, landingPage, listenPage } from "./html";
import { randomCode } from "./html";
import { Room } from "./room";
import { loadSecrets, type SecretBinding } from "./secrets";
import {
  clearSessionCookie,
  createSession,
  getSession,
  readSessionId,
  sessionCookie,
} from "./session";
import { searchVideos } from "./youtube";
import type { PlaybackState, SessionUser } from "./types";

export type Env = {
  ASSETS: Fetcher;
  SESSIONS: KVNamespace;
  ROOM: DurableObjectNamespace;
  YOUTUBE_DATA_API_KEY: string | SecretBinding;
  SESSION_SECRET: string | SecretBinding;
  GOOGLE_OAUTH_CLIENT_ID?: string | SecretBinding;
  GOOGLE_OAUTH_CLIENT_SECRET?: string | SecretBinding;
};

const app = new Hono<{ Bindings: Env }>();

function origin(c: { req: { url: string } }): string {
  return new URL(c.req.url).origin;
}

function redirectUri(originUrl: string): string {
  return `${originUrl}/auth/google/callback`;
}

function secretBindings(env: Env) {
  return {
    youtubeApiKey: env.YOUTUBE_DATA_API_KEY,
    sessionSecret: env.SESSION_SECRET,
    oauthClientId: env.GOOGLE_OAUTH_CLIENT_ID,
    oauthClientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
  };
}

async function requireUser(
  c: {
    env: Env;
    req: { header: (name: string) => string | undefined };
  },
): Promise<SessionUser | null> {
  const sessionId = readSessionId(c.req.header("Cookie"));
  let user = await getSession(c.env.SESSIONS, sessionId);
  if (!user) return null;

  const secrets = await loadSecrets(secretBindings(c.env));
  user = await refreshAccessToken(
    user,
    secrets.oauthClientId,
    secrets.oauthClientSecret,
  );

  if (sessionId) {
    await c.env.SESSIONS.put(`session:${sessionId}`, JSON.stringify(user), {
      expirationTtl: 60 * 60 * 24 * 7,
    });
  }

  return user;
}

app.get("/health", (c) => c.json({ ok: true, service: "soundmob" }));

app.get("/api/youtube/status", async (c) => {
  const secrets = await loadSecrets(secretBindings(c.env));
  return c.json({
    configured: Boolean(secrets.youtubeApiKey),
    oauth: Boolean(secrets.oauthClientId && secrets.oauthClientSecret),
  });
});

app.get("/", (c) => c.html(landingPage(origin(c))));

app.get("/listen", (c) => {
  const code = c.req.query("code")?.toUpperCase() ?? "";
  return c.html(listenPage(code));
});

app.get("/host", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.redirect("/");
  return c.html(hostPage(user.name, user.picture));
});

app.get("/api/me", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ authenticated: false }, 401);
  return c.json({
    authenticated: true,
    name: user.name,
    picture: user.picture,
    email: user.email,
  });
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
  const url = googleAuthUrl(
    secrets.oauthClientId,
    redirectUri(origin(c)),
    state,
  );
  return c.redirect(url);
});

app.get("/auth/google/callback", async (c) => {
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
    c.header("Set-Cookie", sessionCookie(sessionId));
    return c.redirect("/host");
  } catch {
    return c.text("authentication failed", 500);
  }
});

app.get("/auth/logout", async (c) => {
  const sessionId = readSessionId(c.req.header("Cookie"));
  if (sessionId) await c.env.SESSIONS.delete(`session:${sessionId}`);
  c.header("Set-Cookie", clearSessionCookie());
  return c.redirect("/");
});

app.get("/api/youtube/search", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

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
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const secrets = await loadSecrets(secretBindings(c.env));
  const code = randomCode(6);
  const passcode = randomCode(8);
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
      passcode,
      hostId: user.id,
      hostName: user.name,
      playback,
      queue: [],
    }),
  });

  if (!initRes.ok) {
    return c.json({ error: "room_create_failed" }, 500);
  }

  const joinUrl = `${origin(c)}/listen?code=${code}`;
  return c.json({ code, passcode, joinUrl });
});

app.get("/room/:code/ws", async (c) => {
  const code = c.req.param("code").toUpperCase();
  const role = c.req.query("role");

  const headers = new Headers(c.req.raw.headers);
  if (role === "host") {
    const user = await requireUser(c);
    if (!user) return c.text("unauthorized", 401);
    headers.set("X-Host-Id", user.id);
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
