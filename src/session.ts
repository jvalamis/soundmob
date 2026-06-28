import type { SessionUser } from "./types";

const COOKIE = "sm_session";
const TTL_SEC = 60 * 60 * 24 * 7;

export function normalizeSession(raw: unknown): SessionUser | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (
    typeof o.id !== "string" ||
    typeof o.email !== "string" ||
    typeof o.name !== "string" ||
    typeof o.picture !== "string"
  ) {
    return null;
  }

  const user: SessionUser = {
    id: o.id,
    email: o.email,
    name: o.name,
    picture: o.picture,
  };

  if (o.activeRoom && typeof o.activeRoom === "object") {
    const ar = o.activeRoom as Record<string, unknown>;
    if (typeof ar.code === "string") {
      user.activeRoom = { code: ar.code };
    }
  }

  return user;
}

export async function createSession(
  kv: KVNamespace,
  user: SessionUser,
): Promise<string> {
  const id = crypto.randomUUID();
  await saveSession(kv, id, user);
  return id;
}

export async function saveSession(
  kv: KVNamespace,
  sessionId: string,
  user: SessionUser,
): Promise<void> {
  await kv.put(`session:${sessionId}`, JSON.stringify(user), {
    expirationTtl: TTL_SEC,
  });
}

export async function getSession(
  kv: KVNamespace,
  sessionId: string | undefined,
): Promise<SessionUser | null> {
  if (!sessionId) return null;
  const raw = await kv.get(`session:${sessionId}`);
  if (!raw) return null;
  try {
    return normalizeSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function sessionCookie(id: string, options: { secure: boolean }): string {
  const secure = options.secure ? "; Secure" : "";
  return `${COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TTL_SEC}${secure}`;
}

export function clearSessionCookie(options: { secure: boolean }): string {
  const secure = options.secure ? "; Secure" : "";
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export function readSessionId(
  cookieHeader: string | undefined,
): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`${COOKIE}=([^;]+)`));
  return match?.[1];
}
