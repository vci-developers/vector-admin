# Coverage metrics, Coverage layer and Stakeholder access

## Problem Statement

The team reports VectorCam's reach per Program in four ratios: Geographic
Coverage, Penetration, Instantaneous User Coverage and Program User Coverage
(Uganda: 11 / 14, 11 / 22, 51 / 66, 51 / 84). None of them can be derived from
VectorCam data. Which Districts are targeted or under surveillance is planning
data, and Field Users have no login. Today the figures live in people's heads and
slides, not next to the map that shows where VectorCam is actually used.

Stakeholders outside the dev team also need to see this. VectorAdmin admits only
`isDeveloper` users, and the full dashboard exposes every Program's Sessions,
users and collectors.

## Solution

The team keeps one workbook on SharePoint with two sheets: Units (one row per
**Coverage Unit** with its **Coverage Status**) and Field Users (one row per
Program). VectorAdmin reads it, holds onto the last good copy, and shows:

- A third row of summary cards: the four coverage metrics, one line per Program
  that has figures ("Uganda 11 / 14 · 79%"). No comparison arrow, no pooled total.
- A **Coverage layer** on the map, on by default in Map Filters: each unit's
  District boundary filled by status (Active, Targeted, Surveillance only), under
  the specimen and device points.

A **Stakeholder** is a VectorCam account whose email is on a server-side list
along with the Programs they may see. They get the map, its side panel and the
summary cards for those Programs only. The server withholds everything else.

Terms are defined in `.claude/CONTEXT.md` (**Coverage Unit**, **Coverage
Status**, **Field User**, **Viewer**, **Map Filter**). ADR-0001 still holds:
Stakeholder requests are served from the same admin-token snapshots, after
VectorAdmin's own access check.

## User Stories

1. As a Developer, I want the four coverage metrics on the dashboard, so that I stop rebuilding them by hand for slides.
2. As a Developer, I want each coverage card to list every selected Program with figures on its own line, so that Programs are compared side by side.
3. As a Developer, I want each line to show the count ("11 / 14") and the percentage, so that I can quote either.
4. As a Developer, I want Programs with no workbook rows left out of the coverage cards, so that a missing plan doesn't read as 0%.
5. As a Developer, I want a card to show a dash when no selected Program has figures, so that blank and zero look different.
6. As a Developer, I want the coverage cards' info icon to give the formula and the source (team-entered planning figures), so that nobody mistakes them for live counts.
7. As a Developer, I want the Districts filled by Coverage Status on the map, so that I can see where VectorCam is, where it's going and what's left.
8. As a Developer, I want Active, Targeted and Surveillance only on one sequential scale, so that the fills read as stages of rollout.
9. As a Developer, I want Districts outside a Program's surveillance list left unfilled, so that the program's footprint is visible.
10. As a Developer, I want the Coverage layer to sit under the specimen and device points, so that I see activity inside each District.
11. As a Developer, I want the Coverage layer on by default and switchable in Map Filters, so that I can hide it when it clutters the points.
12. As a Developer, I want the Coverage layer's on/off state kept in the URL, so that a shared link shows the same map.
13. As a Developer, I want the legend to say the fills are planning status that ignores the Reporting Period, so that a Targeted District with points isn't read as a bug.
14. As a Developer, I want hovering a District to show its name and status, so that I can identify it without a basemap label.
15. As a Developer, I want workbook rows whose unit has no boundary listed under the map, so that a misspelled District is caught.
16. As a Developer, I want District names matched ignoring case, spaces and hyphens, so that "Madi-Okollo" matches OSM's "Madi Okollo".
17. As a team member, I want to edit the figures in Excel Online, so that changing a status doesn't need a developer.
18. As a team member, I want a status dropdown in the Units sheet, so that I can't type a fourth status.
19. As a team member, I want my edit on the dashboard within an hour, or immediately on Refresh, so that I can check it.
20. As a team member, I want an invalid row reported with its sheet and row number, so that I can fix it.
21. As a Developer, I want the dashboard to keep showing the last good figures when SharePoint is down or the workbook is invalid, so that an outage doesn't blank the cards.
22. As a Developer, I want the cards labelled "Saved copy, <date>" when the fallback is in use, so that I know the figures may be stale.
23. As a Developer, I want the rest of the dashboard unaffected when coverage figures fail entirely, so that one bad file doesn't take down the page.
24. As a Developer, I want each Program in the workbook identified by `programId`, with its name for humans only, so that a renamed Program doesn't break the match.
25. As a Stakeholder, I want to log in with my VectorCam account, so that I don't need another password.
26. As a Stakeholder, I want to see only the Programs I was given, so that I'm not shown other programs' data.
27. As a Stakeholder, I want the Program Filter to list only my Programs, so that I'm not offered something I can't open.
28. As a Stakeholder, I want the map, its side panel and the summary cards, so that I can follow rollout and activity.
29. As a Stakeholder, I want the Reporting Period and Session Filter, so that I can look at other months.
30. As a Developer, I want Stakeholders not to see the summary table, Session panel, users section or Refresh button, so that operational detail stays internal.
31. As a Developer, I want the server to refuse Stakeholders the Session, user-login, report and refresh routes, so that devtools can't reach them.
32. As a Developer, I want the dashboard response cut to a Stakeholder's Programs on the server, so that other Programs never reach their browser.
33. As a Developer, I want a VectorCam account with a low privilege number but not on the list to stay on No access, so that existing privilege-1 users don't get in.
34. As a Developer, I want to add a Stakeholder by editing one env value and redeploying, so that access needs no admin page.
35. As a Developer, I want a Developer listed as a Stakeholder to still get the full dashboard, so that testing the list doesn't lock me out.
36. As a Developer, I want a malformed stakeholder list to fail closed, so that a typo never grants wider access.

## Implementation Decisions

**Workbook format.** Sheet `Units`: `programId, program, unit, status, note`.
`status` is one of `Active`, `Targeted`, `Surveillance only`. Sheet
`Field Users`: `programId, program, active, expected, targeted, note`. `program`
and `note` are never read by code. Uganda's dummy data (prod `programId` 1): the
22 GF Districts. Active (11) = the Districts with live Surveillance Sessions;
Targeted (3, dummy) = Amuru, Lamwo, Moyo; the other 8 Surveillance only.
"Arua-periurban" is drawn as OSM's Arua District, unconfirmed. Field Users 51 /
66 / 84 are example figures.

**Metrics.** Per Program: Geographic Coverage = Active ÷ (Active + Targeted);
Penetration = Active ÷ all rows; Instantaneous User Coverage = active ÷ expected;
Program User Coverage = active ÷ targeted. A zero denominator gives no value, not
0%. Never pooled across Programs. These are the user's definitions: don't change
them without asking.

**Workbook source.** The URL is a password-free SharePoint "Anyone" link in
`COVERAGE_WORKBOOK_URL`, fetched with `download=1`. SharePoint answers the first
request with a cookie and a redirect, and returns 401 without the cookie, so the
loader follows redirects by hand, carrying `Set-Cookie`. Parsed with `exceljs`
(already a dependency). Cached with `'use cache'` for about an hour under its own
tag, which the existing Refresh revalidates along with the Program snapshots.

**Holding onto the figures.** A copy of the workbook is committed to the repo.
The loader returns the live workbook when it fetches and validates, otherwise
the committed copy, with `source: 'live' | 'saved'` and the copy's date. Only if
both fail does the dashboard get a coverage error, and then only the coverage
cards and layer show "Coverage figures unavailable" with the first invalid
sheet/row. The copy is refreshed by hand when the plan changes.

**Deep modules.**

- `parseCoverageWorkbook(buffer) → Result<CoverageFigures, CoverageRowError[]>`:
  reads both sheets, validates rows with Zod (`coverageUnitRowSchema`,
  `fieldUsersRowSchema`), rejects duplicate units per Program and duplicate
  Field Users rows. Pure; no network.
- `buildCoverageMetrics(figures, programIds) → ProgramCoverage[]`: the four
  ratios with numerators and denominators, per selected Program that has rows,
  in Program order.
- `matchCoverageBoundaries(units, boundaries) → { fills, unmatched }`: normalises
  names (case, spaces, hyphens), joins rows to boundary features, and lists rows
  with no shape.
- `parseStakeholderList(value) → Result<Map<email, programId[]>, …>`: format
  `email:1|4,email:1`, emails lower-cased. Any malformed entry fails the whole
  list (fail closed).
- `resolveViewer(devMode, email, list) → { role: 'developer' } | { role:
  'stakeholder', programIds } | null`: `devMode` wins.

**Boundaries.** OSM `admin_level=4` relations for Uganda (Districts and Cities;
all 22 present, including the 2020 splits). geoBoundaries' UBOS 2020 set lacks
Terego, and gbOpen is from 2006. A one-off script pulls them from Overpass,
simplifies them and commits static GeoJSON per country. The app never calls
Overpass. The map already carries the OSM attribution that ODbL requires. Other
countries get a file when their Programs get workbook rows; their level is
chosen to match what the rows list.

**Dashboard response.** Gains `coverage`: per-Program metrics, unit fills, the
unmatched rows, `source` and the copy's date, or an error. Validated with the
dashboard schema's Zod like the rest.

**Coverage layer.** A new value in the existing `layers` Map Filter, on by
default. Drawn with react-leaflet's GeoJSON in its own pane under the points.
Fill strength runs Active > Targeted > Surveillance only on one hue; unlisted
Districts aren't drawn. The legend gains the three statuses and the
planning-status note.

**Coverage cards.** A third row under the existing eight cards, driven by
definitions like the existing metric definitions, but the value is a list of
Program lines and there's no previous-period delta. Moving them to the map's
side panel later only changes where the row renders.

**Viewer roles.** `withViewer` also reads the email from `/users/profile` and
returns the resolved role. The stakeholder list is in `STAKEHOLDER_EMAILS`
(server env only). Stakeholder accounts are registered in VectorCam but left
un-whitelisted, so VectorVerify gives them nothing. Privilege is never read.
**Unverified:** that a non-whitelisted account can log in and read
`/users/profile` and `/users/permissions`. Test it on the test API with a
throwaway account before building the role check.

**Stakeholder enforcement.** `/api/dashboard` intersects the requested Programs
with the Stakeholder's `programIds` before loading snapshots, and returns only
the cards' and map's data (no summary-table rows, no users). The Session panel,
user-login, report and refresh routes return 403 for Stakeholders. The site
locations route stays open, because the map needs it, but is limited to the
Stakeholder's Programs. The page reads the role from the dashboard response
(`viewer`), not from the gate, and doesn't render the summary table, Session
panel, users section or Refresh.

## Testing Decisions

Test pure functions through their public interface with hand-built fixtures, as
the existing utils do: build-area-metrics, search-map, check-record-fields and
summary-to-tsv are the prior art. Assert outputs, not how they're computed.

- `parseCoverageWorkbook`: build workbooks in memory with `exceljs`. Valid file;
  unknown status; missing sheet; non-numeric user figure; duplicate unit; the
  error's sheet and row number.
- `buildCoverageMetrics`: Uganda 11 / 14, 11 / 22, 51 / 66, 51 / 84; Program with
  units but no Field Users row; zero denominator; Program not selected; Program
  with no rows.
- `matchCoverageBoundaries`: "Madi-Okollo" vs "Madi Okollo", case, unmatched
  row, unlisted boundary not drawn.
- `parseStakeholderList` and `resolveViewer`: empty value, one malformed entry
  fails all, mixed-case email, `devMode` wins over the list, not listed → null.
- The SharePoint fetch and fallback switch aren't unit-tested. Check them once
  by hand against the real link, then against a broken URL.

## Commit Plan

**Commit 1 — Read the coverage workbook into the dashboard response**: adds the
committed workbook copy, `parseCoverageWorkbook` and `buildCoverageMetrics` with
tests, the cookie-following loader with fallback, and `coverage` in the
dashboard schema. Nothing renders it yet, so the page is unchanged. Files:
`src/api/coverage/*`, `src/features/dashboard/utils/parse-coverage-workbook*`,
`build-coverage-metrics*`, `src/api/dashboard/get-dashboard.ts`,
`dashboard-schema.ts`, the refresh route, `.env.example`.

**Commit 2 — Show the four coverage metrics as summary cards**: a third row of
cards with per-Program lines, info tooltips and the "Saved copy" / unavailable
states. Files: `kpi-tiles.tsx` or a sibling component, `period-summary.tsx`,
`messages/*`.

**Commit 3 — Draw the Coverage layer from OSM boundaries**: the boundary script
and the committed Uganda GeoJSON, `matchCoverageBoundaries` with tests, the
`coverage` value in `layers` (on by default), the fills pane, hover label,
legend and unmatched list. Files: `scripts/`, `public/` boundary file,
`use-dashboard-filters.ts`, `map-filters.tsx`, `surveillance-map.tsx`,
`map-legend.tsx`, `map-gaps.tsx`.

**Commit 4 — Admit Stakeholders and enforce their scope on the server**:
`parseStakeholderList` and `resolveViewer` with tests, the role from
`withViewer`, Program intersection and trimmed payload in `/api/dashboard`, and
403 on the Session, user-login, report and refresh routes. Developers see no
change. Files: `src/lib/auth-session/with-viewer*`, `src/api/user/*`, the API
routes, `.env.example`.

**Commit 5 — Render the Stakeholder view**: the gate passes the role down, and
the page hides the summary table, Session panel, users section and Refresh for
Stakeholders. Files: `viewer-gate.tsx`, `dashboard-view.tsx`,
`period-summary.tsx`, a small role context or prop.

Commits 1–3 and 4–5 are independent tracks.

## Out of Scope

- What a Stakeholder's map hides within their own Programs (exact GPS, Site and
  collector names). Flagged in CONTEXT.md; until it's decided they see what a
  Developer sees for those Programs.
- Coverage figures and boundaries for Colombia, Ghana, Kenya, Johns Hopkins and
  Cameroon.
- A UI for managing Stakeholders (Edge Config page). Env var until additions
  get frequent.
- Microsoft Graph access to SharePoint. Needed only if JHU disallows "Anyone"
  links or the file moves to a locked-down team site.
- History of coverage figures and period-over-period comparison.
- Deriving Active units from Sessions. Entered by hand by decision.
- Any VectorCam backend change, including a stakeholder privilege level.

## Further Notes

- The workbook lives on a personal OneDrive (`cmanel1_jh_edu`). Move it to a
  team SharePoint site before anyone else depends on it; the new link goes in
  the env var.
- Ask the Uganda team what "Arua-periurban" means (Arua District or Arua City).
- Prod has 7 privilege-1 users across Programs 1 and 4. That's why privilege is
  never the gate.
- The 11 Active Districts matched the live Area names exactly on 2026-10-07; the
  Test Site ("Other") was left out.
