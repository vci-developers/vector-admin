---
status: accepted
---

# The BFF reads all Programs with the admin token and computes metrics itself

VectorAdmin reports across every Program, but user JWTs are silently scoped to
the user's own Program: `programId` for any other Program returns `total: 0`,
even at privilege 4. The admin token skips program scoping entirely
(`vectorcam-api/src/middleware/siteAccess.middleware.ts:53-61`). To ship without
backend changes, the BFF holds the admin token server-side and computes every
metric by paging `/sessions/`, `/specimens/` and `/devices/` (100 rows per
page), caching results for up to an hour.

## Considered Options

- **New backend aggregate endpoints (deferred).** Cheapest at runtime and the
  right long-term shape, but blocks v1 on backend work. Remains the fallback if
  BFF computation is too slow.
- **One service login per Program (rejected).** Stores several user credentials
  to fan out across Programs; a credentials hack.

## Consequences

- The admin token has full read-write access to all data. It lives only in
  server env, is never sent to the browser, and the BFF uses it only on an
  allowlist of `GET` endpoints.
- VectorAdmin enforces its own access: a viewer logs in with their VectorCam
  account and must have `isDeveloper`. The admin token is used only after that
  check.
- Cold loads page through every Program's Sessions and Specimens (prod Uganda
  alone is about 200 specimen pages), so data is served from a server cache with
  a visible "last updated" time and a manual refresh.
