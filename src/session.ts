import { createRemoteJWKSet, jwtVerify } from "jose";

export interface Person {
  id: string;
  name: string;
  email: string;
}

export const SESSION_COOKIE = "__Host-session";

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

/** Skyda ID's published signing keys, fetched once per isolate and refreshed by jose when they rotate. */
function keys(idURL: string) {
  let set = keySets.get(idURL);
  if (!set) {
    set = createRemoteJWKSet(new URL("/api/auth/jwks", idURL));
    keySets.set(idURL, set);
  }
  return set;
}

/**
 * Checks a Skyda ID token: signed with Skyda ID's current ES256 key, issued by
 * and for Skyda ID, and not expired. Returns who it's for and when it expires,
 * or null for anything else.
 */
export async function verifyToken(token: string, idURL: string): Promise<{ person: Person; expires: number } | null> {
  try {
    const { payload } = await jwtVerify(token, keys(idURL), {
      issuer: idURL,
      audience: idURL,
      algorithms: ["ES256"],
    });
    if (!payload.sub || typeof payload.email !== "string" || !payload.exp) return null;
    return {
      person: { id: payload.sub, name: typeof payload.name === "string" ? payload.name : "", email: payload.email },
      expires: payload.exp,
    };
  } catch {
    return null;
  }
}
