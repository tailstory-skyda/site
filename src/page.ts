import type { Person } from "./session";

function escape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function pageCSP(idURL: string): string {
  return [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self'",
    `connect-src 'self' ${new URL(idURL).origin}`,
    "form-action 'self'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function homePage({ idURL, person, url }: { idURL: string; person: Person | null; url: string }): string {
  const signInURL = `${idURL}/sign-in?return=${encodeURIComponent(url)}`;
  const body = person
    ? `<p>Signed in as <strong>${escape(person.name || person.email)}</strong>${person.name ? ` (${escape(person.email)})` : ""}.</p>
      <button type="button" id="sign-out">Sign out</button>`
    : `<a class="button" href="${escape(signInURL)}">Sign in</a>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Skyda</title>
  <link rel="stylesheet" href="/site.css">
  <script type="module" src="/app.js"></script>
</head>
<body>
  <main data-id-url="${escape(idURL)}" data-signed-in="${!!person}">
    <h1>Skyda</h1>
    ${body}
  </main>
</body>
</html>`;
}
