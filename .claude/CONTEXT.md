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
Defaults to all Programs except a configured **Hidden-by-Default** list
(currently prod program 5, Johns Hopkins University, whose nature is
unconfirmed); a hidden Program can still be selected. New Programs appear
selected automatically. _Avoid_: all programs (means the default selection, not
literally every Program)

**Reporting Month**: The calendar month every metric is bucketed by, evaluated
in the Program's timezone. Used for all programs alike so programs are
comparable side by side. A Session with no `collectionDate` is bucketed by its
`submittedAt` instead, so its Records still appear (failing capture date).
_Avoid_: period, cycle (when meaning a month)

**Counted Session**: A `SURVEILLANCE` or `DATA_COLLECTION` Session. `PRACTICE`
and `CALIBRATION` Sessions are ignored by every metric and by Device Status (a
Device with only those is Never Used). Every "Session" in the metric definitions
below means a Counted Session.

**Program Country**: The Program's `country` from `GET /programs`, the key for
the static bounding box behind every GPS check. Boxes exist for Uganda, Kenya,
Ghana, Cameroon, Colombia and the United States of America (contiguous states
only). A Program whose country has no box fails every geolocation check.

**Reporting Range**: The span of Reporting Months shown. Chosen from presets
(Last 3 / 6 / 12 months, Year to date, All time) or a custom from/to month pair.
Defaults to Last 12 months; presets are relative, so a bookmarked preset always
tracks the current month. _Avoid_: date range (months are the smallest unit)

**Cycle Label**: The Collection Cycle(s) overlapping a Reporting Month, shown as
context on that month (e.g. "Cycle 5") so a quiet month can be read against
where the program is in its cycle. Annotation only; never a bucket. Programs
with no Collection Schedule show none. _Avoid_: cycle view

**Monthly Active Device**: A Device with ≥1 Session whose `collectionDate` falls
in the Reporting Month. Distinct from VectorVerify's **Device Activity**
(cycle-based, as-of-today). _Avoid_: active device (bare)

**Scan**: One image of a Specimen (`SpecimenImage`). A Specimen imaged three
times is three Scans. Counted in the Reporting Month of its Session's
`collectionDate`, not its upload time. _Avoid_: image count, capture

**Unique Specimen**: One Specimen, however many Scans it has. Counted in the
Reporting Month of its Session's `collectionDate`. _Avoid_: specimen count
(ambiguous with Scans)

**Scans per Active Device**: Scans ÷ Monthly Active Devices for the same Program
and Reporting Month. Undefined (not zero) when there are no Monthly Active
Devices.

**Device Status**: For a selected Reporting Month, every registered Device
(`GET /devices/?programId`) is **Active** (≥1 Session that month), **Inactive**
(has Sessions, none that month) or **Never Used** (no Sessions ever). Uses the
registry, unlike VectorVerify, because VectorAdmin scopes by Program, not
location, and must surface devices handed out but never used. The map shows
status for the last Reporting Month of the Reporting Range (provisional; to be
revisited once visible).

**Device Location**: A Device is placed at the GPS `latitude`/`longitude` of its
latest Session. A point that is null or outside its Program's country is
**unplaced**: listed beside the map and counted, never drawn. Session GPS is
recorded at upload, not collection, so it can be wrong (VectorVerify geocodes
Sites for this reason); VectorAdmin uses it and reports how often it fails.
_Avoid_: site location (VectorVerify's geocoded position)

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

**Time to Confirmation**: Elapsed time from a Session's `createdAt` (started on
the device) to `certifiedAt` (a VCO confirmed it in Review). Uncertified
Sessions have no value. Shown per Session only; no monthly summary is decided.
_Avoid_: identification time, turnaround

**Projected Devices**: A per-program, per-month device target set by the program
team. Planning data kept in the team's sheet, not in VectorAdmin; the sheet
compares it against Monthly Active Devices. Program Potential, program stage,
updates and opportunities are likewise planning data outside VectorAdmin.
_Avoid_: expected devices

## Flagged ambiguities

- A Device is an app registration, not a physical phone. It is identified by
  `Device.id` and `ssaid` (Android ID); there is no IMEI. A factory-reset phone
  that re-registers becomes a new Device, so device counts can exceed phones.

- "Active device" means **Monthly Active Device** here, not VectorVerify's
  cycle-based Device Activity.
