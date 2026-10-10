# VectorCam progress dashboard

The default Progress view opens on Uganda and the last three completed months.
It shows active reporting locations, image scans, a map of reporting activity,
and monthly scans. Selecting a district updates the headline figures and monthly
chart together. Developers can explicitly switch to Internal. The coverage
footnote reads “Locations reporting during the selected period.”

The presentation emphasizes the two headline figures and a tall district map. At
desktop widths of 1280 pixels and above, the map and monthly chart sit side by
side in approximately 70/30 columns. Smaller screens stack the panels. The map
uses 680–920 pixels of height on desktop, 640 pixels on tablets, and 560 pixels
on phones. Committed country outlines and Uganda district boundaries provide
geographic context even when external tiles are unavailable. The map refits when
its viewport changes and keeps map controls accessible. Reporting areas are
filled using reference polygons at each program's recorded geographic level:
districts in Uganda and Ghana, Turkana County in Kenya, departments/capital
district in Colombia, and health districts in Cameroon. Darker shading
represents larger scan totals, with a stronger selected outline. Reporting-area
names are bold in the detailed view, with leader lines where needed. Zooming out
switches to country summaries and hides granular area names, individual markers,
district hover actions and persistent district tooltips. Country summaries are
used below zoom 6, and until zoom 7 for compact reporting footprints. Shaded
reporting polygons remain visible as context. A shaded area means it has
reporting sites, not that every part has been sampled. Exact normalized
country/name matches and a small set of explicitly reviewed, country-scoped
aliases preserve the original reporting counts; ambiguous or unmatched names
never receive a guessed polygon. Known boundaries can be drawn even when a
reporting record has no point coordinates. The additional boundary registry
covers the 18 reporting areas registered in the approved site metadata for
Colombia, Ghana, Kenya and Cameroon. Further unmatched names retain reporting
points. Its overview summarizes each reporting country with a compact label. The
map caption explains that selecting an area reveals its reporting locations and
scans. If an area has no point coordinates, the note identifies its name and
country, using “Area not recorded” when its name is missing. These records stay
in all scan totals and monthly charts, including when a known boundary can still
be shaded. Generic introductory copy, the duplicate chart note and the visible
surveillance-scope footer have been removed; counting definitions remain in the
collapsed explanation. Country and point-group activation only zooms, without
changing the reporting filters or making another data request. District areas
support hover, click, Enter and Space, keeping the original district's exact
counts. Labels avoid other markers, controls and each other. Only mapped
districts contribute to map group totals; other data remains in the headline and
chart totals. Monthly charts show exact values above every bar. Long ranges use
a horizontally scrollable chart with adequate space for each month and its
value. Chart sizing uses Recharts' native responsive chart support, avoiding its
legacy responsive container's unmeasured negative initial dimensions. The
monthly chart is 280 pixels tall on desktop, 260 on tablets and 220 on phones.
The geographic scan breakdown takes the freed space beside the fixed-height map;
on stacked layouts its list can use up to 440 pixels before scrolling. The
design keeps the same metrics across desktop and mobile. The reporting-program
dropdown supports multiple selections, with country names above actual program
names. Its authorized program list is supplied with the page so the selector can
be used before reporting totals arrive. Geographic coverage shows a total above
individual country/program counts, including when Uganda, Ghana and Kenya all
count households. Programs remain separate even within the same country. A
shared reporting unit keeps its specific headline label; mixed units use “active
reporting locations” and retain each program's unit beside its numeric count.
This total sums program-specific locations at their reviewed reporting levels,
rather than claiming an equivalent household count or deduplicating physical
sites across programs. An incomplete total remains unavailable while individual
known counts are shown. Both cards share their heading, total, breakdown and
footer grid tracks, with matching row typography. Long program names truncate
with their full names available in the title, preserving aligned row dividers.
The “Data captured” card includes per-program image scan counts and their total,
retaining zero-count programs and labeling unavailable programs explicitly.
Shared reporting areas keep each program's original image counts rather than
inferring attribution from coverage. The space beneath the chart shows “Where
scans come from”: the six highest-volume reporting areas across the selected
programs and period, with exact image scan counts and small comparison bars.
Selecting a row focuses its reporting area using the already loaded data; the
comparison continues to show all selected programs. Areas without map
coordinates or a recorded area name remain eligible, and the list scrolls within
the available desktop panel height. Areas with zero scans remain in reporting
coverage but have no scan contribution to rank. The map canvas retains its
existing fixed height at each breakpoint. Map panning is bounded by the
displayed country mainland outlines and located reporting points, with a 20%
framing margin (at least one degree), clamped to world/Mercator limits. The
minimum zoom adapts to the viewport and extent while retaining the country
overview; maximum zoom is 12. Hard drag bounds and non-wrapping tiles prevent
drifting into duplicate worlds. Touch pinch and map-local trackpad pinch zoom
around their gesture anchor and obey the same limits. Unmodified wheel scrolling
remains page scrolling. Navigation limits update for changed geography or
viewport size, without refitting on ordinary pan or zoom.

## Loading behavior

The page and dashboard layout render synchronous Suspense boundaries with a
static, branded dashboard skeleton. Session cookies, viewer permissions and the
authorized program list are read inside the page's async child, after its
boundary is established. The authorization gate remains inside the layout
boundary. This lets both direct visits and page navigation show a visible
loading shell without waiting for runtime session data; authorized program
selections and dashboard content still wait for their checks to complete. The
same reporting skeleton is used while the client data query loads. No session
reads are cached, and instant navigation validation remains enabled.

A cold reporting snapshot reads the selected programs' complete surveillance
history in 100-record pages with bounded concurrency, then applies the reporting
period locally. This preserves collection-date/time-zone rules and the fallback
for missing collection dates. A genuine cold cache can still be slow; no new
production latency measurements were made during this work.

Small donor summaries now cache by selected programs and reporting period, after
authorization. Complete summaries use the existing hourly cache profile; partial
or unavailable data uses a short retry profile. The donor page skips export-only
device calculations. These are memory caches and do not survive every deployment
or cold server instance.

Display-only geography is generated from the original local boundaries with
`node scripts/build-progress-geography.mjs`; `--check` verifies reproducibility,
closed rings and a maximum deviation below 0.003 degrees. Original geometry and
reporting-marker positions remain unchanged. The earlier Uganda/base display
asset's gzip size fell from 385,269 to 231,988 bytes (about 40%). The new
reference source metadata changes that base to approximately 232 KB gzip;
additional country polygons are separate chunks.

## Counting rules

- Only surveillance collections are included. Practice, calibration, other
  collection types, and the `Other` test location are excluded on the server.
- Reporting coverage counts distinct locations with at least one eligible
  collection in the selected period, including zero-catch collections. Uganda,
  Ghana and Kenya count households; Colombia counts municipalities; Cameroon
  counts health districts. The reporting unit is shown with every count.
  Repeated visits count once. Parent administrative nodes do not count as
  households. Missing required location metadata produces an unavailable
  coverage figure while scans remain included. Different reporting units remain
  labeled separately in the breakdown, map and export. The donor coverage card
  can combine them only as generic reporting locations, with each program's
  actual reporting level retained in its row.
- One image is one scan. A specimen with two images contributes two scans; 100
  specimens with two images each contribute 200 scans. All images are requested
  with `includeAllImages=true`; only image IDs are retained. Duplicate image IDs
  within a program count once. A missing images array fails validation instead
  of producing a misleading zero count. Zero-image specimens contribute zero
  scans, so `hasImages=true` does not change the image-count definition.
- Reporting months use collection dates in the program's collection-cycle time
  zone, falling back to submission dates where collection dates are missing.
- Districts merge across programs within the same country. Image and location
  identities remain scoped to their source program. Records without GPS or a
  known district remain in headline and monthly totals.
- Failed programs are identified explicitly. When all selected programs fail,
  totals are unavailable rather than shown as zero.

The Excel export separates `Monthly actuals`, `Targets`, and `Internal metrics`.
It exports all areas for the selected programs and period, as labeled beside the
download button. Actuals include the numeric reporting-location total using the
same helper as the headline card, a labeled coverage-unit breakdown, and a
program table with each program's exact image scans and active reporting count.
Monthly, district and district/month tables retain numeric scan values and real
zeros. Incomplete coverage is unavailable rather than silently counted as zero.
Scans per reporting device appear only in Excel. Missing device identities
suppress ratios. Planning sources and snapshot dates are labeled, and a saved
plan is never represented as current observed reporting activity.

The reviewed production site metadata on October 10 contains 330 Uganda
household paths within 33 communities, 112 Ghana household paths, 30 Kenya
household paths within 3 communities, 12 Colombia municipal collection paths,
and 6 Cameroon health-district paths. These are registered locations from site
metadata, not active-reporting counts for a selected period. Uganda's sampling
plan uses three communities per district; this is not three households and is
never a fixed cap on observed reporting coverage. The implemented reporting
level uses each program's collection model rather than whichever number is
larger.

## Production request boundary for agent work

The supplied credentials are production credentials. The agent must obtain
approval for the exact method, URL, query parameters, and purpose before any
further production request. No production data mutations are authorized.

The new donor data loaders use the existing server-only GET allowlist and
viewer/program authorization. The donor export reads planning with
`loadCoverage(true)` and cannot persist a workbook backup to Blob storage.
Existing Internal coverage persistence is unchanged and is not used by the donor
progress page.

Before the production restriction was clarified, validation performed one
unsuccessful `POST /auth/login` (HTTP 401) and the following GET request
templates against the configured API base:

```text
GET /users/permissions
GET /programs?limit=100&offset={offset}
GET /sessions/?programId=1&type=SURVEILLANCE&sortBy=id&sortOrder=asc&limit=100&offset={offset}
GET /specimens/?programId=1&sessionType=SURVEILLANCE&hasImages=true&includeAllImages=false&sortBy=id&sortOrder=asc&limit=100&offset={offset}
GET /sites/?programId=1&sortBy=id&sortOrder=asc&limit=100&offset={offset}
GET /programs/1/collection-cycles?startDate=2000-01-01&endDate=2100-01-01
```

Paginated reads fetched complete eligible Uganda records and applied the
July–September reporting period locally. Individual HTTP page offsets were not
retained in a request log. No endpoints that edit program, session, specimen,
site, or device records were called.

That captured July–September 2026 response reconciled to 33 active locations, 11
districts, and 4,945 image-backed specimens (July 1,328; August 1,573; September
2,044), using the previous one-specimen-per-scan definition. These historical
figures are not verified image counts under the current definition and are not
constants in the dashboard.

Subsequent checks ran with network connections blocked and mocked API data. The
local visual review uses the already captured response plus clearly named Ghana
fixtures for multiselect and continental-layout checks, blocks production
requests and external map tiles, and removes its temporary route afterward.

Validation passed: 331 mocked tests, TypeScript, an offline production build,
and desktop/mobile browser checks for counts, district filtering, monthly
values, keyboard map selection, program multiselect, early selector
availability, country overview and drill-down without new data requests,
country-card collision avoidance, exact district tooltips, district polygon
selection and highlight styles, keyboard area selection, and mobile polygon
bounds and overflow. External map tiles and optimized logo requests were blocked
during browser checks, so those assets were not visually verified. The temporary
review route and debugger setting were removed, and the review server was
stopped.

On October 9, 2026 (America/New_York), the user separately approved one exact
production
`GET /programs/?country=Uganda&limit=100&offset=0&sortBy=id&sortOrder=asc`
against `https://api.vectorcam.org`. It returned one Uganda program, ID 1,
National Malaria Elimination Division. The user then explicitly approved the
session, image-backed specimen, site, and collection-cycle GET templates above
for program 1, with offsets 0–29900 in steps of 100, stopping at the reported
total, at most three simultaneous requests, and no retries or redirects.

The approved all-time verification made 231 data GETs (24 session pages, 202
specimen pages, 4 site pages, and 1 collection-cycle request); all returned 200.
Exact request URLs and status codes were retained in a local audit. The complete
snapshot contained 2,359 surveillance sessions, 20,176 image-backed surveillance
specimens, and 331 sites. Reusing the pure dashboard counting code produced
**17,182 image-backed specimens** across 33 reporting locations and 11
districts, with January 2021–October 2026 reporting dates. The current month is
included. Monthly and district totals both reconcile to 17,182; the same
snapshot's July–September total remains 4,945. These are captured verification
figures under the previous specimen-count definition, not current image scan
totals or dashboard constants. No production mutations, login requests, image
downloads, or unapproved endpoints were used for this verification.

The October 10 local-only update changes all donor counts, monthly/district map
totals and Excel actuals to image counts. Snapshot, summary and browser query
cache keys include `image-count-v1`, preventing reuse of the old definition. No
production API requests or browser sessions were run for this update. Validation
passed with outbound connections blocked: 351 mocked tests in 58 files,
TypeScript, targeted ESLint/Prettier, and a webpack production build. Google
font responses were mocked with a local font for the compilation check. The new
image totals and final styling have not been checked against live data or in a
browser; the user will review the running dashboard separately.

The user then approved a separate program/site metadata review for choosing
reporting levels. It used one program-metadata GET and nine site GETs against
`https://api.vectorcam.org`, all returning HTTP 200:

```text
GET /programs/?limit=100&offset=0&sortBy=id&sortOrder=asc
GET /sites/?programId={programId}&sortBy=id&sortOrder=asc&limit=100&offset={offset}
```

Actual site offsets were 0, 100, 200 and 300 for Uganda (program 1); 0 for
Colombia (2); 0 and 100 for Ghana (3); 0 for Kenya (4); and 0 for Cameroon (6).
The approved scope allowed at most three concurrent GETs, stopped at each
reported total, and excluded retries, redirects, authentication requests and
image downloads. Exact URLs and statuses were retained in a local audit. No
mutations or other production requests were made in this review. No sessions or
images were fetched, so this metadata review does not verify current active
counts or scan totals.

The corresponding implementation changes coverage units consistently across the
headline card, district/map tooltips and Excel actuals. Summary and browser
query cache keys include a counting-definition version, so previously cached
community counts cannot appear under household labels. Raw image/site snapshots
retain the image-count version because their recorded data shape is unchanged.
Mixed reporting units have separate labeled counts, and incomplete location
metadata produces unavailable coverage instead of an assumed count.

Colombia's legacy `villageName` field stores municipal names such as Medellín,
Turbo and Mocoa, while `district` stores their parent departments. The donor
unit is now `municipality`, following
[DANE's DIVIPOLA terminology](https://www.dane.gov.co/index.php/sistema-estadistico-nacional-sen/normas-y-estandares/nomenclaturas-y-clasificaciones/nomenclaturas/codificacion-de-la-division-politica-administrativa-de-colombia-divipola).
Canonical identities still use the same recorded parent/location paths; this
label change does not invent more reporting sites or change scans. Explicit
Department/Municipality hierarchy levels and their Spanish equivalents are
supported alongside the legacy fields. Generic community units remain valid for
other, unreviewed program models. Summary/browser cache keys now use
`image-count-v1-locations-v3` so older coverage labels or summaries without
per-program scan counts cannot remain cached.

One saved Colombia entry pairs Angostura with Chocó, whereas the
[official DANE Angostura profile](https://sitios.dane.gov.co/cnpv/app/views/informacion/fichas/05038.pdf)
identifies the municipality in Antioquia. This is a metadata ambiguity requiring
program-owner review, not permission to silently reassign collections. The
dashboard preserves the API's recorded parent area and location counts.

The subsequent UI refinement reduces the headline number sizes to 34–48 pixels
on desktop and approximately 27–34 pixels on phones, while preserving bold
weights. Both cards use tighter padding and row spacing, with matching 22-pixel
breakdown figures on desktop. The duplicate “View monthly values” table is
removed; exact chart tooltips and keyboard accessibility remain. The existing
two headline figures, 70/30 desktop split and taller map are retained.

The other programs now have reference polygons for all 18 registered parent
reporting areas: four Ghana districts, Turkana County in Kenya, seven Colombia
departments/capital district, and six Cameroon health districts. The latter use
[Cameroon's Ministry-approved UNAIDS health boundaries](https://adr.unaids.org/en/geographic-data-package-3/cameroon-geographic-health-boundaries),
not a substitute administrative-district map. The remaining additions use pinned
[geoBoundaries open datasets](https://www.geoboundaries.org/). Source versions,
original hashes, represented years, licenses, modifications and reviewed naming
aliases are recorded in
[progress-reporting-area-sources.json](../src/features/dashboard/data/progress-reporting-area-sources.json).
The source extract contains public polygon data only, without site or household
metadata. Further new names remain unmatched rather than receiving guessed
polygons; their scans still contribute to dashboard totals.

Additional country geometry loads on selection, keeping Uganda's initial display
payload unchanged. The generator and its `--check` mode operate entirely on
committed local originals/extracts, preserving all polygon rings and the
0.003-degree maximum display simplification error. Country-source attribution
and simplification notices accompany the rendered layers. These are reference
boundaries with disclosed source years, not a claim that all areas have been
sampled or that the boundaries were surveyed in 2026.

Final validation for this update passed with outbound connections blocked: 422
tests in 64 files, TypeScript, targeted ESLint/Prettier, a webpack production
build, and the read-only geography regeneration check. All 18 registered-area
polygon matches, source IDs and reviewed aliases are tested, including
wrong-country and ambiguous-alias rejection. All 527 rings and 526 polygons
remain, with maximum display deviation 0.002999751 degrees. Selection stays
focused while country geometry loads and when the map resizes; ordinary pan/zoom
does not reset selection. Zoom-transition tests preserve country scan totals and
zero-catch locations while switching granular visibility. In-memory React server
chart renders reproduce the old negative-size warning and verify that the new
responsive chart path avoids it for short and all-time ranges. Navigation tests
cover geographic framing, viewport-aware zoom limits and pinch zoom clamping;
scan attribution tests reconcile totals across shared districts and source
programs, including duplicate images, zero catches and failed snapshots.
Coverage card render tests retain the shared household total and its separate
program rows, distinguish unavailable data from zero, and reject mixed-unit
totals. In-memory React server streaming tests show the public skeleton before
deferred viewer, program and authorization checks resolve; authorized defaults
and the chosen dashboard view are preserved afterward. The generated prerendered
HTML and page navigation payload both contain the static loading shell. Google
font responses used a bundled local font for the compilation check. No new
browser session, production API request or production mutation was made for this
map/UI refinement; live activity counts were not re-fetched.

The subsequent content update names the image-count card “Data captured” and
replaces upload recency with geographic scan contributions. Ranking tests verify
exact counts, cross-country comparisons, deterministic ties, the six-area limit,
and inclusion of records without coordinates or area names. The replacement uses
the existing dashboard response and area-selection controls; it introduces no
additional data requests. Validation passed with all network connections
blocked: 425 tests in 65 files, targeted ESLint/Prettier, TypeScript and a
webpack production build. No production request, mutation or browser session was
made for this content update.

The all-program card refinement retains the coverage headline for mixed units
under the generic reporting-location label. Both headline cards use shared grid
tracks for their four sections, and identical per-program row typography, so
totals and dividers remain aligned. Coverage units accompany the numeric counts
while numeric counts stay aligned on the right. Render tests cover all five
programs together, zero-only selections, singular locations, empty selections
and incomplete mixed coverage. Validation passed with all network connections
blocked: 428 tests in 65 files, TypeScript, targeted ESLint/Prettier and a
webpack production build. No production requests, mutations or browser sessions
were made for this refinement.

The subsequent copy/export refinement removes redundant visible copy and names
areas missing coordinates. The workbook now includes the headline reporting
location total and per-program scan/count figures. Tests write the actual XLSX
bytes and reopen them, reconciling five-program totals with monthly, district,
district/month and internal-sheet values for both a selected period and all
time. Fixtures include multiple images, duplicate IDs within a program,
identical IDs across programs, zero catches, repeated
household/municipality/health-district paths, missing device identities and
excluded practice/Other collections. Incomplete coverage remains unavailable.
Validation passed with all network connections blocked: 430 tests in 66 files,
TypeScript, targeted ESLint/Prettier and a webpack production build. No
production records were fetched, and no production mutations or browser sessions
were made during this refinement.
