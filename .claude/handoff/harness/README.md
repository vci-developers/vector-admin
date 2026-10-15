# Real-data screenshot harness

Renders the real dashboard (internal or Stakeholder) with live prod data in a
headless browser, without a user session. GET-only: the route calls the same
server functions as the BFF routes with the server's admin credentials.

1. `S=$(openssl rand -hex 16)`; keep `$S` in a scratch dir as `secret`.
2. Copy `route.ts.txt` to `src/app/api/zz/[name]/route.ts` with `__SECRET__`
   replaced by `$S`, and `page.tsx.txt` to `src/app/zz-preview/page.tsx`.
3. In a scratch dir: `npm i playwright-core`, copy `shot.mjs.txt` there as
   `shot.mjs`, put the `secret` file beside it. Run
   `node shot.mjs "/zz-preview?d=compact" 1440 out.png dark` (params: path,
   width, output, optional theme). `?v=stakeholder` renders the Stakeholder
   view. `WAIT=<selector>` changes what it waits for (default
   `#summary-heading`). Chromium:
   `~/Library/Caches/ms-playwright/ chromium_headless_shell-1223`.
4. **Always delete** `src/app/api/zz` and `src/app/zz-preview` afterwards. The
   dev server listens on all interfaces; the secret header is the only guard.

The proxy only checks that an `accessToken` cookie exists, so the script sets a
placeholder one. Overlay scrollbars: launch with
`ignoreDefaultArgs: ['--hide-scrollbars'], args: ['--enable-features=OverlayScrollbar']`.
