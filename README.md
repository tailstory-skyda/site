# site

Skyda's main site at `skyda.dev`. A Cloudflare Worker that shows who is signed in to Skyda.

## How sign-in works

People sign in at [Skyda ID](https://github.com/tailstory-skyda/skyda-id) (`id.skyda.dev`). When this site has no session, the page asks Skyda ID for a token in the background. A visitor who is signed in to Skyda gets a 15-minute ES256 token, which the page hands to `POST /session`. The Worker checks it against Skyda ID's published keys and keeps it in a `__Host-session` cookie until it expires, then the page fetches a fresh one. Visitors who aren't signed in get a 401 and stay signed out.

Signing out signs out of Skyda ID first, then clears this site's cookie.

## Develop

Run Skyda ID on port 8787 (see its README), then:

```sh
npm ci
echo 'ID_URL=http://localhost:8787' > .dev.vars
npm run dev
```

Open http://localhost:8788/.

## Deploy

`npm run deploy`. There are no secrets; `ID_URL` is set in `wrangler.jsonc`.
