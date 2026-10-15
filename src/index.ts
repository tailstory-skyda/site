import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Env } from "./env";
import { securityHeaders } from "./headers";
import { homePage, pageCSP } from "./page";
import { SESSION_COOKIE, verifyToken } from "./session";

const app = new Hono<{ Bindings: Env }>();

app.use("*", securityHeaders);

/** Session changes only come from this site's own pages. */
function fromThisSite(c: Context): boolean {
  return c.req.header("origin") === new URL(c.req.url).origin;
}

app.get("/", async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  const verified = token ? await verifyToken(token, c.env.ID_URL) : null;
  c.header("Content-Security-Policy", pageCSP(c.env.ID_URL));
  return c.html(homePage({ idURL: c.env.ID_URL, person: verified?.person ?? null, url: c.req.url }));
});

// The page hands over a token it fetched from Skyda ID. The site keeps it as
// its session until the token expires, then the page fetches a fresh one.
app.post("/session", async (c) => {
  if (!fromThisSite(c)) return c.body(null, 403);
  const { token } = await c.req.json<{ token?: unknown }>().catch(() => ({ token: undefined }));
  const verified = typeof token === "string" ? await verifyToken(token, c.env.ID_URL) : null;
  if (!verified) return c.body(null, 401);
  setCookie(c, SESSION_COOKIE, token as string, {
    secure: true,
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: Math.max(0, verified.expires - Math.floor(Date.now() / 1000)),
  });
  return c.body(null, 204);
});

app.post("/sign-out", (c) => {
  if (!fromThisSite(c)) return c.body(null, 403);
  deleteCookie(c, SESSION_COOKIE, { secure: true, path: "/" });
  return c.body(null, 204);
});

export default app;
