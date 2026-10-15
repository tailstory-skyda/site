import { env } from "cloudflare:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { beforeAll, describe, expect, it, vi } from "vitest";
import app from "../src/index";

const SITE = "http://localhost";
const ID = env.ID_URL;

const signing = await generateKeyPair("ES256");
const jwks = { keys: [{ ...(await exportJWK(signing.publicKey)), kid: "current", alg: "ES256" }] };

beforeAll(() => {
  // Skyda ID's published keys.
  const realFetch = globalThis.fetch;
  vi.spyOn(globalThis, "fetch").mockImplementation((input, init) =>
    new Request(input).url === `${ID}/api/auth/jwks` ? Promise.resolve(Response.json(jwks)) : realFetch(input, init),
  );
});

async function token(
  claims: Record<string, unknown> = {},
  { issuer = ID, audience = ID, expires = "15m", key = signing.privateKey } = {},
) {
  return new SignJWT({ name: "Brad", email: "brad@example.com", ...claims })
    .setProtectedHeader({ alg: "ES256", kid: "current" })
    .setSubject("user-1")
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(key);
}

function request(path: string, init?: RequestInit) {
  return app.fetch(new Request(`${SITE}${path}`, init), env);
}

function handOver(body: unknown, origin = SITE) {
  return request("/session", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  });
}

async function sessionCookie(): Promise<string> {
  const response = await handOver({ token: await token() });
  expect(response.status).toBe(204);
  const cookie = response.headers.getSetCookie().find((c) => c.startsWith("__Host-session="))!;
  return cookie.split(";")[0]!;
}

describe("home page", () => {
  it("offers sign-in that comes back here", async () => {
    const response = await request("/");
    const html = await response.text();
    expect(html).toContain(`href="${ID}/sign-in?return=${encodeURIComponent(`${SITE}/`)}"`);
    expect(html).toContain('data-signed-in="false"');
  });

  it("may only talk to itself and Skyda ID", async () => {
    const csp = (await request("/")).headers.get("content-security-policy")!;
    expect(csp).toContain(`connect-src 'self' ${ID}`);
    expect(csp).toContain("script-src 'self';");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("shows who is signed in", async () => {
    const response = await request("/", { headers: { cookie: await sessionCookie() } });
    const html = await response.text();
    expect(html).toContain("Brad");
    expect(html).toContain("brad@example.com");
    expect(html).toContain('id="sign-out"');
  });

  it("escapes names", async () => {
    const response = await handOver({ token: await token({ name: "<script>" }) });
    const cookie = response.headers.getSetCookie()[0]!.split(";")[0]!;
    const html = await (await request("/", { headers: { cookie } })).text();
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("taking over a Skyda session", () => {
  it("keeps a valid token in a __Host- cookie until it expires", async () => {
    const response = await handOver({ token: await token() });
    expect(response.status).toBe(204);
    const cookie = response.headers.getSetCookie()[0]!;
    expect(cookie).toMatch(/^__Host-session=/);
    expect(cookie).toMatch(/; Secure/i);
    expect(cookie).toMatch(/; HttpOnly/i);
    expect(cookie).toMatch(/; SameSite=Lax/i);
    expect(cookie).not.toMatch(/; Domain=/i);
    const maxAge = Number(cookie.match(/Max-Age=(\d+)/i)?.[1]);
    expect(maxAge).toBeGreaterThan(14 * 60);
    expect(maxAge).toBeLessThanOrEqual(15 * 60);
  });

  it.each([
    ["another issuer", () => token({}, { issuer: "http://evil.example" })],
    ["another audience", () => token({}, { audience: "http://evil.example" })],
    ["an expired token", () => token({}, { expires: "-1m" })],
    ["another key", async () => token({}, { key: (await generateKeyPair("ES256")).privateKey })],
    ["no token", async () => undefined],
    ["garbage", async () => "not-a-token"],
  ])("refuses %s", async (_, make) => {
    const response = await handOver({ token: await make() });
    expect(response.status).toBe(401);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("refuses tokens handed over by another site", async () => {
    const response = await handOver({ token: await token() }, "http://evil.example");
    expect(response.status).toBe(403);
  });

  it("ignores a session cookie that doesn't verify", async () => {
    const forged = await token({}, { key: (await generateKeyPair("ES256")).privateKey });
    const html = await (await request("/", { headers: { cookie: `__Host-session=${forged}` } })).text();
    expect(html).toContain('data-signed-in="false"');
  });
});

describe("sign-out", () => {
  it("clears the session cookie", async () => {
    const response = await request("/sign-out", { method: "POST", headers: { origin: SITE } });
    expect(response.status).toBe(204);
    expect(response.headers.getSetCookie()[0]).toMatch(/^__Host-session=;.*Max-Age=0/i);
  });

  it("is refused from another site", async () => {
    const response = await request("/sign-out", { method: "POST", headers: { origin: "http://evil.example" } });
    expect(response.status).toBe(403);
  });
});
