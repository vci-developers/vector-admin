# VectorAdmin v1: cross-program metrics dashboard

## Problem Statement

The VectorCam team tracks adoption across Programs in a hand-maintained sheet
(Active Devices, Scans, Unique Specimens, Scans per Active Device, by Program
and month). Every number is pulled by hand, program by program, because
VectorVerify only ever sees the logged-in user's own Program. There is no view
of data quality (missing metadata, DHIS2 upload rate, uncertified Sessions)
across Programs, and no map of where devices are and whether they are working.

## Solution

A single-page dashboard in the new vector-admin repo, open to `isDeveloper`
users only. It shows every Program side by side per Reporting Month: the
measured metrics as sheet-shaped tables, data-quality metrics, and a map of
every registered Device with its Device Status. Clicking a Program-month opens
the Sessions behind it. Filters (Program Filter, Reporting Range) live in the
URL. No backend changes: the BFF reads all Programs with the admin token
(ADR-0001) and computes everything itself.

Terms below are defined in vector-admin's `CONTEXT.md`.

## User Stories

1. As a Viewer, I want to log in with my VectorCam account, so that I don't need
   a separate credential.
2. As a non-developer VectorCam user, I want to be refused access clearly, so
   that I know the dashboard isn't broken.
3. As a Viewer, I want every Program shown by default, so that I see the whole
   deployment at once.
4. As a Viewer, I want program 5 (Johns Hopkins University) deselected by
   default, so that possible internal test data doesn't skew totals.
5. As a Viewer, I want to select a hidden-by-default Program, so that I can
   investigate what it contains.
6. As a Viewer, I want a new Program to appear selected automatically, so that
   the dashboard never silently omits one.
7. As a Viewer, I want to pick a Reporting Range from presets (Last 3/6/12
   months, Year to date, All time), so that common views are one click.
8. As a Viewer, I want a custom from/to month range, so that I can match a
   report period.
9. As a Viewer, I want Last 12 months as the default, so that a bare URL shows
   recent data.
10. As a Viewer, I want filters in the URL, so that I can share or bookmark a
    view.
11. As a Viewer, I want a bookmarked preset to track the current month, so that
    old bookmarks stay current.
12. As a Viewer, I want Monthly Active Devices per Program per month, so that I
    can report adoption.
13. As a Viewer, I want Scans per Program per month, so that I can report usage
    volume.
14. As a Viewer, I want Unique Specimens per Program per month, so that I can
    report surveillance output.
15. As a Viewer, I want Scans per Active Device, so that I can compare device
    utilisation across Programs.
16. As a Viewer, I want Scans per Active Device blank when there are no active
    devices, so that 0 isn't mistaken for measured idleness.
17. As a Viewer, I want a Total row per metric, so that I can report the whole
    deployment.
18. As a Viewer, I want tables laid out like the team sheet (Programs as rows,
    months as columns), so that I can copy numbers straight into it.
19. As a Viewer, I want each month labelled with its overlapping Cycle(s) for a
    single Program, so that a quiet month can be read against the cycle.
20. As a Viewer, I want Metadata Completeness per Program per month, so that I
    can see data-quality trends.
21. As a Viewer, I want Field Completeness per required field, so that I can
    tell which field is failing.
22. As a Viewer, I want the DHIS2 Upload Rate per Program per month, so that I
    can see how much send-ready data reached DHIS2.
23. As a Viewer, I want DHIS2 Upload Rate blank for Programs with no Certified
    or Submitted Sessions, so that non-DHIS2 Programs don't read as 0%.
24. As a Viewer, I want to click a Program-month cell and see its Sessions, so
    that I can find out why a number looks wrong.
25. As a Viewer, I want each Session's state, device, site, collection date and
    submitted date, so that I can trace it.
26. As a Viewer, I want each Session's Time to Confirmation, so that I can see
    slow reviews.
27. As a Viewer, I want uncertified Sessions clearly marked, oldest first, so
    that I can chase stuck reviews.
28. As a Viewer, I want each Session's missing Required Metadata Fields shown,
    so that I can see what to fix.
29. As a Viewer, I want a map of every registered Device, so that I can see
    where devices are deployed.
30. As a Viewer, I want each Device's status (Active, Inactive, Never Used) for
    the last month of the range, so that I can spot silent devices.
31. As a Viewer, I want devices clustered when zoomed out, so that the world
    view stays readable.
32. As a Viewer, I want a cluster to show its device count, green if any device
    is active and grey otherwise, so that the colour means one thing.
33. As a Viewer, I want to click a cluster or marker and see a list of its
    devices, so that every map number can be checked.
34. As a Viewer, I want each device's ID, Android ID (ssaid), model, Program,
    status and last submitted date in that list, so that I can identify the
    phone.
35. As a Viewer, I want unplaced devices (no GPS, or GPS outside the Program's
    country) listed and counted beside the map, so that bad locations are
    visible, not hidden.
36. As a Viewer, I want Never Used devices listed beside the map, so that I can
    see devices handed out but never used.
37. As a Viewer, I want a "last updated" time, so that I know how fresh the data
    is.
38. As a Viewer, I want a refresh button, so that I can pull fresh data after a
    known change.
39. As a Viewer, I want a loading state on a cold load, so that a slow first
    fetch doesn't look broken.
40. As a Viewer, I want a clear error when a Program fails to load, so that I
    don't read partial totals as complete.
41. As a developer, I want the admin token never sent to the browser, so that a
    full-access credential can't leak.
42. As a developer, I want the admin token used only on read endpoints, so that
    a bug can't write through it.
43. As a developer, I want all copy in `messages/en.json`, so that
    French/Spanish can be added later.
44. As a developer, I want the counting rules in pure, tested functions, so that
    the numbers can be trusted and changed safely.

## Implementation Decisions

**Repo setup.** Fresh `create-next-app`, not a fork of VectorVerify. Same stack:
Next 16, TanStack Query, nuqs, Zod, next-intl (English only), react-leaflet +
react-leaflet-cluster. Copy VectorVerify's `Result<T, E>`, network helpers
(`safeApiCall`, query-string/URL construction, `NetworkError`), auth-session
cookie helpers and proxy, `.claude/docs/architecture.md`,
`.claude/docs/best-practices.md`, the code-standards part of `CLAUDE.md`, and
the grill-with-docs and to-prd skills. Do not copy VectorVerify's `CONTEXT.md`,
ADRs or any feature code.

**Environment.** `API_BASE_URL` (test/prod) and `ADMIN_AUTH_TOKEN`, both server
only. Hidden-by-Default Program ids are a per-environment config value (prod:
`[5]`; test: the TEST/demo programs).

**Modules.**

1. **Viewer gate.** Login posts to `/auth/login` and stores the user token in an
   httpOnly cookie (VectorVerify's flow). The dashboard layout calls
   `GET /users/permissions` with the user token and requires
   `permissions.devMode` (the backend's `isDeveloper`; `/users/profile` does
   not return it); otherwise it redirects to a no-access page. Every BFF route
   repeats the check (`withViewer`) before touching the admin token.
2. **Admin data loader** (server only, deep module). Interface:
   `loadProgramSnapshot(programId) → Result<ProgramSnapshot, NetworkError>`.
   Pages `/sessions/?programId`, `/specimens/?programId&includeAllImages=true`,
   `/devices/?programId` (100 per page, following VectorVerify's `getAll…`
   loop), plus `/programs/{id}/collection-cycles`. Uses the admin token through
   a GET-only wrapper that has no way to send other methods. Each Program's
   snapshot is cached server-side for one hour and tagged, so refresh
   invalidates it; the snapshot carries its fetch time. Fetches all history per
   Program (no range filter), so every Reporting Range and "All time" come from
   one cache entry. `safeApiCall` sets `no-cache`, so caching sits at the
   snapshot level, not the fetch level.
3. **`buildMonthlyMetrics`** (pure, deep module). Input: Program snapshots and a
   Reporting Range. Output: per Program per Reporting Month — Monthly Active
   Devices, Scans, Unique Specimens, Scans per Active Device, Metadata
   Completeness, Field Completeness per field, DHIS2 Upload Rate, Cycle Labels —
   plus Total rows. Bucketing: Specimens and Scans take their Session's
   `collectionDate`; months are computed in the Program's timezone, taken from
   its latest Collection Cycle, falling back to UTC. Scans = length of a
   Specimen's `images`. Species comes from the thumbnail image (the one DHIS2
   counts). DHIS2 Upload Rate = `SUBMITTED` ÷ (`CERTIFIED` + `SUBMITTED`)
   Sessions, blank when the denominator is 0.
4. **`classifyDevices`** (pure, deep module). Input: devices, Sessions, a
   Reporting Month, the Program's country. Output: one row per Device with
   status (Active / Inactive / Never Used), latest-Session GPS position or
   `unplaced`, last `submittedAt`. Each Device appears once (latest Session,
   VectorVerify ADR-0005 rule).
5. **`checkRecordFields`** (pure). Input: a Specimen, its Session, the Program's
   country. Output: pass/fail per Required Metadata Field. Geolocation passes
   when lat/lng fall inside a static per-country bounding box keyed by **Program
   Country** (six countries today; a Program whose country has no box fails
   geolocation and is flagged in the UI). Operator ID passes on a non-empty
   trimmed `collectorName`. Shared by `buildMonthlyMetrics`, `classifyDevices`
   (for the GPS check) and the Session list.
6. **BFF routes + hooks.** `GET /api/dashboard?programIds&from&to` → metric
   tables + device rows for the last month of the range + snapshot times
   (`useGetDashboard`). `GET /api/program-month-sessions?programId&month` →
   Session rows with state, Time to Confirmation, missing fields
   (`useGetProgramMonthSessions`). `POST /api/refresh?programIds` invalidates
   those snapshots. Responses are Zod-validated end to end.
7. **UI** (single page). Filter bar (Program Filter multi-select, Reporting
   Range presets + custom month pair, last-updated + refresh) on nuqs, with
   defaults omitted from the URL. One table per metric. Device map with clusters
   (react-leaflet-cluster, clustering off from about zoom 7), coloured by
   any-active, plus a side list for the clicked cluster, and separate Unplaced
   and Never Used lists. A Session panel opened from a table cell.

**Partial failure.** If one Program's snapshot fails, the dashboard renders the
others and marks that Program's rows as failed; Total rows show as incomplete,
never as a smaller number.

## Testing Decisions

- Add Vitest; VectorVerify has no unit-test setup, so there is no in-repo prior
  art. Tests hit public functions with hand-built fixtures only, never internal
  helpers.
- `buildMonthlyMetrics`: month bucketing in a non-UTC timezone across a month
  boundary; Scans vs Unique Specimens with multi-image Specimens; blank ratio
  with zero active devices; DHIS2 rate blank at zero denominator; Total rows;
  Cycle Labels for a two-month cycle and for a Program with no schedule.
- `classifyDevices`: Active / Inactive / Never Used; a roaming device counted
  once at its latest Session; null and out-of-country GPS → `unplaced`.
- `checkRecordFields`: each field's pass/fail, including whitespace-only
  `collectorName`, missing thumbnail species, a Program with no country box.
- Acceptance check: prod numbers for Uganda, Ghana and Kenya in Jan–Jun 2026
  compared against the team sheet; differences explained or fixed before
  sharing.

## Commit Plan

**Commit 1 — Scaffold the app**: Fresh Next 16 app with the agreed dependencies,
next-intl (English), Vitest, and the copied `.claude` docs, skills and
`CLAUDE.md` standards; builds and renders an empty page. Files: `package.json`,
app shell, `messages/en.json`, i18n config, Vitest config, `.claude/docs/*`,
`.claude/skills/*`, `.claude/CLAUDE.md`.

**Commit 2 — Log in and require isDeveloper**: Copy `Result`, network helpers,
auth-session cookies and proxy; add login page, `devMode` check in the
dashboard layout, and no-access page. Files: `lib/result`, `lib/network`,
`lib/auth-session`, `proxy`, login and no-access routes, dashboard layout.

**Commit 3 — Load and cache Program snapshots**: Admin GET-only client, schemas
for sessions/specimens/devices/cycles/programs, `loadProgramSnapshot` with
one-hour tagged cache, refresh route. Files: `api/admin-client`,
`api/*/validation/*`, snapshot loader, refresh BFF route.

**Commit 4 — Compute the metrics**: `checkRecordFields`, `buildMonthlyMetrics`,
`classifyDevices`, country bounding boxes, and their Vitest suites; no UI yet.
Files: `features/dashboard/utils/*`, their tests.

**Commit 5 — Render filters and metric tables**: Dashboard BFF route and hook,
nuqs filter bar, metric tables with Total rows and Cycle Labels, last-updated
and refresh. Files: dashboard route and hook, `features/dashboard/components/*`
(filters, tables), page.

**Commit 6 — Add the device map**: Clustered map, cluster/marker device list,
Unplaced and Never Used lists. Files: `features/dashboard/components/*` (map,
device lists).

**Commit 7 — Add the Session panel**: Program-month Sessions route and hook,
panel opened from a table cell with state, Time to Confirmation and missing
fields. Files: program-month-sessions route and hook, session panel component.

## Out of Scope

- Stakeholder (non-`isDeveloper`) access and per-stakeholder Program scoping.
- Planning data: Projected Devices, Program Potential, stage, updates,
  opportunities (stay in the sheet).
- Mind the Gap (not a backend Program).
- A monthly summary of Time to Confirmation.
- Notifications of any kind.
- Export to the sheet (copy from the tables).
- Any backend change, including the DHIS2 first-sync bug (`vectorcam-api`
  `handlers/dhis2/sync.ts`, first-sync branch marks Sessions `SUBMITTED` with no
  event id), a sync-task list endpoint, and server-side aggregates. These go to
  the backend team separately.
- IMEI: not stored and not readable on Android 10+; Devices are identified by
  `Device.id` and `ssaid`.
- Languages other than English.

## Further Notes

- Session GPS is recorded at upload, not collection (VectorVerify
  `geographical-summary.md`). On test Uganda only 68% of Sessions fall inside
  the country, and 2 of 137 in 2026. Expect many unplaced devices; the Unplaced
  count is the finding, not a bug.
- Cold load is the risk: prod Uganda is about 200 specimen pages. If the first
  real load is unacceptable, the fallback is backend aggregate endpoints
  (ADR-0001), not more frontend caching.
- Which month the map shows (last of the range) is provisional until it can be
  seen.
- A factory-reset phone that re-registers counts as a new Device; device counts
  can exceed phones.
