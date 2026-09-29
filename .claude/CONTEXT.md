# VectorAdmin

VectorAdmin is the internal and stakeholder-facing monitoring dashboard for
VectorCam deployments across all programs. It reports program-level adoption and
data-quality metrics month by month. Domain terms shared with VectorVerify
(Program, Site, Session, Specimen, Device, Collection Cycle, Submission, Sync
Task) keep VectorVerify's definitions.

## Language

**Viewer**: A VectorCam user allowed into VectorAdmin. v1: only users with
`isDeveloper`, who see every Program. How external stakeholders get access, and
which Programs they see, is undecided and out of v1. _Avoid_: admin (collides
with the admin token)

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

**Counted Session**: A `SURVEILLANCE` or `DATA_COLLECTION` Session. `PRACTICE`
and `CALIBRATION` Sessions are ignored by every metric and by Device Status (a
Device with only those is Never Used). Every "Session" in the metric definitions
below means a Counted Session.

**Program Country**: The Program's `country` from `GET /programs`, the key for
the static bounding box behind every GPS check. Boxes exist for Uganda, Kenya,
Ghana, Cameroon, Colombia and the United States of America (contiguous states
only). A Program whose country has no box fails every geolocation check.

**Reporting Period**: The one time filter for the whole page: a span of whole
Reporting Months chosen from presets (Last month, Last 3 / 6 / 12 months, Year
to date, All time) or a custom from/to month pair (the same month twice is a
single month). Defaults to Last month, the unit the team sheet uses. Presets are
relative, so a bookmarked preset tracks the calendar. The map, KPI tiles,
summary table, Device Status and Session panel all show this period; there is no
second month or range control. Counts are summed over the period, Active Devices
and Unique Users are counted once each, and ratios are recomputed over the
period, never averaged. KPI tiles compare with the same-length period just
before (none for All time). _Avoid_: range, summary month, date range

**Cycle Label**: The Collection Cycle(s) overlapping the Reporting Period, shown
beside each Program in the summary so a quiet period can be read against where
the program is in its cycle. Up to three are listed; more show as a span and
count ("Cycles 350–672 · 45"). Annotation only; never a bucket. Programs with no
Collection Schedule show none. _Avoid_: cycle view

**Active Device**: A Device with ≥1 Session in the Reporting Period, counted
once however many months it was active. Distinct from VectorVerify's **Device
Activity** (cycle-based, as-of-today). _Avoid_: Monthly Active Device (the
period is not always a month)

**Scan**: One image of a Specimen (`SpecimenImage`). A Specimen imaged three
times is three Scans. Counted in the Reporting Month of its Session's
`collectionDate`, not its upload time. _Avoid_: image count, capture

**Unique Specimen**: One Specimen, however many Scans it has. Counted in the
Reporting Month of its Session's `collectionDate`. _Avoid_: specimen count
(ambiguous with Scans)

**Scans per Active Device**: Scans ÷ Active Devices for the same Program and
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

**Record**: For data-quality metrics, one Specimen together with its Session.
Its **Required Metadata Fields** are species identification (the Specimen's),
capture date (Session `collectionDate`), geolocation (Session GPS inside the
Program's country, as for Device Location) and operator ID (Session
`collectorName`). Operator ID is free text with no link to a user, so "present"
means only that a name was entered. **Metadata Completeness** = share of Records
with all four fields present and valid; **Field Completeness** = the same share
per field. _Avoid_: submission, entry

**DHIS2 Upload Rate**: `SUBMITTED` ÷ (`CERTIFIED` + `SUBMITTED`) Sessions for a
Program and Reporting Month. Estimates "attempted records successfully
uploaded": a failed upload and a never-attempted one both stay `CERTIFIED`, so
it reads as "share of send-ready data that reached DHIS2". Counted in Sessions
because Submission is per Session. Blank for Programs that don't use DHIS2.

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

**Time to Confirmation**: Elapsed time from a Session's `createdAt` (started on
the device) to `certifiedAt` (a VCO confirmed it in Review). Uncertified
Sessions have no value. Shown per Session only; no monthly summary is decided.
_Avoid_: identification time, turnaround

**Projected Devices**: A per-program, per-month device target set by the program
team. Planning data kept in the team's sheet, not in VectorAdmin; the sheet
compares it against Active Devices. Program Potential, program stage, updates
and opportunities are likewise planning data outside VectorAdmin. _Avoid_:
expected devices

## Flagged ambiguities

- A Device is an app registration, not a physical phone. It is identified by
  `Device.id` and `ssaid` (Android ID); there is no IMEI. A factory-reset phone
  that re-registers becomes a new Device, so device counts can exceed phones.

- "Active device" means **Active Device** here, not VectorVerify's cycle-based
  Device Activity.
