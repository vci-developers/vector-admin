# VectorAdmin

VectorAdmin is the internal and stakeholder-facing monitoring dashboard for
VectorCam deployments across all programs. It reports program-level adoption and
data-quality metrics month by month. Domain terms shared with VectorVerify
(Program, Site, Session, Specimen, Device, Collection Cycle, Submission, Sync
Task) keep VectorVerify's definitions.

## Language

**Viewer**: A VectorCam user allowed into VectorAdmin, in one of two roles. A
**Developer** (`isDeveloper`) sees everything. A **Stakeholder** is a VectorCam
account whose email is on VectorAdmin's stakeholder list, with the Programs they
may see; left un-whitelisted, it can do nothing in VectorVerify. They see only
their Programs, and of those the map (specimens per Area), its side panel, three
headline cards (Unique specimens, Metadata complete, DHIS2 upload) and the four
coverage cards: summaries only, never a Session's own record (Session ids are
renumbered; collectors reach the page only as numbers), the other activity
cards, user and login counts, the summary table, the device lists, Never Used
devices, the Session panel or the users section; the server withholds them, not
just the page. A Developer can preview this view with the header switch.
VectorCam privilege never grants entry: prod has privilege-1 users in several
Programs. _Avoid_: admin (collides with the admin token)

**Program Filter**: A multi-select over every Program from `GET /programs`.
Defaults to all Programs except a **Hidden-by-Default** list (currently prod
program 5, Johns Hopkins University, whose nature is unconfirmed); a hidden
Program can still be selected. New Programs appear selected automatically.
_Avoid_: all programs (means the default selection, not literally every Program)

**Reporting Month**: The calendar month a Session belongs to, evaluated in the
Program's timezone, so programs are comparable side by side. A Session with no
`collectionDate` uses its `submittedAt` instead, so its Records still appear
(failing capture date). Periods are made of whole Reporting Months. _Avoid_:
cycle (when meaning a month)

**Session Filter**: The page-wide filter in the toolbar, applied to every
metric, the summary table, the map, the Session panel and Device Status, and
kept in the URL (`types`, `testSites`). Session types: Surveillance, Data
collection, Practice, Calibration; **default Surveillance only** (so Colombia,
mostly Data collection, shows little by default). It also leaves out the **Test
Site** unless "Include the test Site" is ticked.

**Test Site**: A Site whose top-level place is "Other": Uganda's Site 11, the
catch-all for testing and training (Kampala/Entebbe, Cameroon and Nairobi GPS,
nothing ever certified). The only one in prod across all Programs.

**Counted Session**: A Session that passes the Session Filter. Every "Session"
in the metric definitions below means a Counted Session; a Device with none is
Never Used.

**Program Country**: The Program's `country` from `GET /programs`, the key for
the static bounding box behind every GPS check (Device and Specimen Location,
and the location field's fallback). Boxes exist for Uganda, Kenya, Ghana,
Cameroon, Colombia and the United States of America (contiguous states only).

**Reporting Period**: The one time filter for the whole page: a span of whole
Reporting Months chosen from presets (This month, Last month, Last 3 / 6 / 12
months, Year to date, All time), a single chosen Month (picked from a grid or
stepped with arrows) or a custom from/to month pair (picking either end past the
other moves both). Defaults to Last month, the unit the team sheet uses. Presets
are relative, so a bookmarked preset tracks the calendar. Rolling presets and
Year to date end at the last complete month (Year to date in January is January
alone). A period that includes the current month is **In Progress**: labelled as
likely undercounted, because Sessions are uploaded after collection, and shown
with no KPI comparison. The map, KPI tiles, summary table, Device Status and
Session panel all show this period; there is no second month or range control.
Counts are summed over the period, Active Devices and Unique Users are counted
once each, and ratios are recomputed over the period, never averaged. KPI tiles
compare with the same-length period just before (none for All time or an In
Progress period). _Avoid_: range, summary month, date range

**Cycle Label**: The Collection Cycle(s) overlapping the Reporting Period, shown
beside each Program in the summary so a quiet period can be read against where
the program is in its cycle. Up to three are listed; more show as a span and
count ("Cycles 350–672 · 45"). Annotation only; never a bucket. Programs with no
Collection Schedule show none. _Avoid_: cycle view

**Active Device**: A Device with ≥1 Session in the Reporting Period, counted
once however many months it was active. Distinct from VectorVerify's **Device
Activity** (cycle-based, as-of-today). _Avoid_: Monthly Active Device (the
period is not always a month)

**Sentinel Site**: A place where collections happen, counted the same way in
every Program: where each VectorCam Site is a house (its place path ends in a
House: Uganda, Kenya), the village the houses sit in; otherwise the Site itself
(a town in Colombia, the deepest hierarchy point in Ghana and Cameroon). Houses
are counted beside it where they exist ("3 sentinel sites · 12 houses"). Named
for now; collection frequency is not part of it (in Uganda 18 of 33 villages had
Surveillance Sessions every month Apr–Sep 2026, 9 only once). _Avoid_: Site (the
VectorCam record: a house in Uganda), collection site

**Area**: A Program's top-level place: a District for Uganda and other legacy
Sites, a Region where Sites use their own `locationHierarchy`. Sessions at a
Site with no place names share one "No area" row. The Stakeholder map draws
specimens per Area, not per Session: one mark per Area at the mean of its
Sessions' positions, labelled with its specimen count and coloured on its own
scale (1–99, 100–499, 500–999, 1,000+).

**Team-sheet view**: The summary table, built to paste into the team's sheet
("Monthly Entry: VectorVerify log metrics", one row per District per month). Per
Program: one row per Area with data in the period, alphabetically, then
**Program total** (always every Area, computed from the period's data, never
averaged; a Device counts once). With several Programs a Total row follows.
Columns, in order: Active Devices, Images, Unique Specimens, Images per Active
Device, Unique Users and Logins (Program rows only: users log in to a Program,
not a Site), Metadata Completeness, DHIS2 Upload Rate, % species ID, % capture
date, % location, % operator ID, then Time between images as median, 25th pct,
75th pct, mean and SD in seconds. Copy is values only, no header or name: a
button per row, or tick rows and Copy selected. A Device that moved between
Areas is an Active Device in each. _Avoid_: Location Breakdown (the earlier
drill-down to every level, removed)

**Image**: One photo of a Specimen (`SpecimenImage`). A Specimen photographed
three times is three Images. Counted in the Reporting Month of its Session's
`collectionDate`, not its upload time. The team sheet still calls these Scans
until its column is renamed. _Avoid_: Scan (reads as one per mosquito), capture

**Unique Specimen**: One Specimen, however many Images it has. Counted in the
Reporting Month of its Session's `collectionDate`. _Avoid_: specimen count
(ambiguous with Images)

**Images per Active Device**: Images ÷ Active Devices for the same Program and
Reporting Period. Undefined (not zero) when there are no Active Devices.

**Device Status**: For the Reporting Period, every registered Device
(`GET /devices/?programId`) is **Active** (≥1 Session in the period),
**Inactive** (has Sessions, none in the period) or **Never Used** (no Sessions
ever). Uses the registry, unlike VectorVerify, because VectorAdmin scopes by
Program, not location, and must surface devices handed out but never used.

**Device Location**: Where a Device is drawn, in order: (1) the GPS of its
latest Session with an in-country fix (usually the latest Session); (2)
otherwise its latest Session's **Site Location**, drawn with a dashed outline
and labelled "Site location (no GPS)"; (3) otherwise it is **without a
location**: listed under the map with the reason ("Locating Site…" or "No
geocoded location") and counted, never drawn. Session GPS is recorded at upload,
not collection, so it is often wrong; GPS still wins whenever it is usable.
_Avoid_: unplaced (older term for "without a location")

**Site Location**: A Site's position geocoded from its place names with
OpenStreetMap Nominatim, using VectorVerify's rules (legacy Sites: village,
district, country; newer Sites: name, top region, country), broadening from most
to least specific and rejecting matches outside the Program Country; a
country-only match is never used. Geocoded one Site per second in the
background, cached in server memory, so the map fills in over the first minute
or two after a restart. Only a fallback when GPS cannot place something.

**Specimen Location**: Where a Specimen appears on the map: its Session's GPS
(or, when that is missing or out of country, the Session's Site Location,
dashed) `latitude`/`longitude`, drawn as one point per Session sized by specimen
count. The map covers the Reporting Period and shows specimens and devices
together: specimen circles on a one-hue red scale by Session count (0 hollow,
1–4, 5–19, 20–49, 50+; a cluster takes its worst Session's colour and is
labelled with its total), device rounded squares (green Active, grey otherwise)
drawn as badges up and to the right of their point so the two never hide each
other. The same in-country rule as Device Location applies; Sessions outside it
are counted as unplaced with their specimens, never drawn. Recorded at upload,
not at the trap. _Avoid_: trap location, site location

**Map Filter**: Filters that change only the map (and its "without a location"
device list), never the KPI tiles, summary table or users section. Specimens:
the current `species`, `sex` and `abdomenStatus` on the Specimen's thumbnail
image: the app's prediction at upload, replaced when a reviewer corrects it (the
`appSpecies`… fields keep the app's original and are not used). "Image upload
pending" means the field is empty: the Specimen has no thumbnail image yet, or
the app predicted nothing and no reviewer has set it (VectorCam's API calls the
first "Image Upload Pending" and the second "UNKNOWN"; we show both under the
first). A field the Specimen can never have is N/A, as in VectorCam: a male's
abdomen status, a non-mosquito's sex and abdomen status. N/A is never a filter
option and never hides a Specimen. By default the map shows identified
mosquitoes only: pending species, sex and abdomen status, the **Non-Mosquito**
toggle and Sessions with no specimens are off until turned on. A Session's
circle counts only its matching specimens, and a Session whose specimens all
fail the filter is dropped (it is not an empty trap). Devices: only Active
devices (with Sessions in the period) are drawn; there is no device filter.
Filters list hidden values, so a new species or status appears without opting
in. Kept in the URL. The Program Filter is never changed by the map; instead,
when a selected Program has nothing on the map, a "!" beside the map filters
opens to name it with the reason (no Sessions in the period, hidden by the map
filters, or no location yet). Every click on a point or cluster opens a popup
with its specimen summary; a cluster's popup zooms in (or fans out points
sharing one spot) on request. The popup and the panel name the clicked place in
the Site hierarchy ("Ashanti › Ejura Sekyeredumase › Ejura"): a point's whole
path, or for a cluster or the whole map only the places all of it shares, with
how many Sites it spans, so the path sharpens as zooming splits clusters. A
search box on the map finds places at any level of the Site hierarchy by name,
and Sessions, devices and Sites by number; picking one zooms to it and selects
it as a click would. It searches only what the map shows, so the map filters
still apply. A device uses its latest Session's Site. The panel beside the map
charts specimens per week (periods of up to three months) or per month, stacked
by species, sex or abdomen status, for the clicked point, cluster or device, or
for everything on the map when nothing is clicked; each value keeps its colour
whatever is clicked, and the Sessions or devices behind the chart are listed
under it. _Avoid_: layer filter

**Record**: For data-quality metrics, one Specimen together with its Session.
Every Specimen is a Record, with or without an Image; one with no Image has no
species and fails species identification. (VectorVerify's specimen CSV export
has one row per Image, so it leaves those out: 2 of Uganda's 2,046 Records in
September 2026, too few to change a shown percentage.) Its **Required Metadata
Fields** are species identification (the Specimen's), capture date (Session
`collectionDate`), **location** (the Session's Site sits under an Area and is
not the Test Site; failing that, the Session's GPS is inside the Program
Country) and operator ID (Session `collectorName`). Operator ID is free text
with no link to a user, so "present" means only that a name was entered.
**Metadata Completeness** = share of Records with all four fields present and
valid; **Field Completeness** = the same share per field. _Avoid_: submission,
entry

**DHIS2 Upload Rate**: Records whose Session is `SUBMITTED` (sent to DHIS2) ÷
all Records, over the period's Counted Sessions in any state, Needs Review
included. Counted per Record, not per Session or Review Unit. Only Uganda uses
DHIS2, and the API has no per-Program setting, so Programs in other countries
show it blank and stay out of the Total.

**Time between images**: Seconds between consecutive images (by `capturedAt`)
within one Session, every gap included: retakes of the same specimen and pauses
too. Gaps are pooled across Sessions, never averaged per Session; percentiles
and SD as Excel's PERCENTILE.INC and STDEV.S. The Session panel shows each
Session's median gap.

**Unique Users**: VectorVerify web-app users (VCOs and other reviewers, not
field collectors) of a Program who logged in at least once in the Reporting
Month, from `GET /users/auth-events` (admin token, `eventType=login`). A user
belongs to one Program, so Program counts add up to the Total. **Logins** is the
same population's total login count. Both use UTC months because the backend
groups logins by UTC day; every other metric uses the Program's timezone. Months
before the first recorded login in the selection are blank, not zero: the
backend only logs logins from when auth events shipped (test: June 2026). Same
source and population as VectorVerify's User Analytics (VCV-303), but across all
Programs via the Program Filter. The users section lists each user (name, email,
Program, logins, last login) with a by-day or by-month breakdown and an .xlsx
report. _Avoid_: Active Users (collides with `isActive`), Active Device
(different population)

**Coverage Unit**: A place a Program's surveillance covers, listed by the team
with one **Coverage Status**: **Active** (using VectorCam), **Targeted** (slated
for VectorCam, not yet active) or **Surveillance without VectorCam** (under the
program's active surveillance, not targeted; the workbook's value is
`Surveillance only`). Shown as "Using VectorCam", "Targeted for VectorCam" and
"Surveillance without VectorCam", in the coverage tooltips' words. Statuses are
exclusive and nested: an Active unit counts as targeted, and every listed unit
is under surveillance. Entered by hand, not derived from Sessions. **Geographic
Coverage** = Active ÷ (Active + Targeted); **Penetration** = Active ÷ all listed
units (Uganda example: 11 / 14, 11 / 22). Uganda's units are Districts. The four
coverage metrics are shown per Program, never pooled; Programs without figures
are left out. Their tooltips use the team's own definitions word for word. Drawn
on the map as the **Coverage layer** (a Map Filter layer, on by default): each
unit's boundary filled by status, under the specimen and device points. The
fills are planning status and ignore the Reporting Period, so a Targeted unit
can show points and an Active one none. _Avoid_: Area (top-level place derived
from Sites; may not match a Coverage Unit)

**Field User**: A person collecting with the VectorCam phone app. Field Users
have no login. **Active Field Users** are counted from VectorCam: distinct
collector names on the Sessions the Session filter keeps, ignoring case, spacing
and accents, a joint name ("A and B") counting both, a blank name no one.
**Expected Field Users** come from the workbook's Expected Users sheet, one
figure per Program per month (Uganda: Districts rolled out × 6 VHTs, so 48 for
May–Aug 2026 and 66 from September, each rollout adding 3 Districts); **Targeted
Field Users** are that month's **Projected Devices**. The user tiles compare the
period's last month ("currently"): **Instantaneous User Coverage** = Active ÷
Expected; **Program User Coverage** = Active ÷ Projected Devices. The Field
Users sheet is no longer read. Every user figure a Stakeholder sees is the
tiles' figure on the tiles' basis: the map panel's users line counts each
Program's people in the period's last month on every Session the Session filter
kept, whatever the map filters show, beside the expected figure map-wide, and
only the selected Areas when something is clicked. Sentinel sites (and houses)
in the panel are framed the same way; the location line in the panel and popups
then shows only the place, never its own counts. A name is not an identity: a
misspelling still counts twice. _Avoid_: Unique Users (web-app logins), operator
(free-text name on a Session)

**Projected Devices**: A per-program, per-month device target set by the program
team, read from the coverage workbook's Projected Devices sheet and used as the
user target (Program User Coverage). Uganda had one device per village (two VHTs
sharing) until August 2026 and one per VHT from September, so before September
it counts devices, not people. Program Potential, program stage, updates and
opportunities are planning data outside VectorAdmin. _Avoid_: expected devices

## Flagged ambiguities

- A Device is an app registration, not a physical phone. It is identified by
  `Device.id` and `ssaid` (Android ID); there is no IMEI. A factory-reset phone
  that re-registers becomes a new Device, so device counts can exceed phones.

- "Active device" means **Active Device** here, not VectorVerify's cycle-based
  Device Activity.

- What a Stakeholder's map must hide within their own Programs (exact GPS? Site
  and collector names?) is undecided. Until it is, they see what a Developer
  sees for those Programs.
