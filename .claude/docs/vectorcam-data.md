# What VectorCam data we can get

_Checked 2026-10-08 against the live API spec (98 paths), `vectorcam-api` at
`a666db8` (read only) and GET-only prod reads. Prod figures: Uganda (programId
1), Surveillance Sessions, Test Site left out._

VectorCam records what happened in the field (Sessions, specimens, images,
devices, collector names) and web logins. It holds no plans or targets: every
"expected" or "targeted" figure comes from the coverage workbook. When the API
gains an endpoint or field about people, places or plans, update the table.

## At a glance

| Figure                               | From VectorCam?                  | Where                                                       | Used in VectorAdmin              |
| ------------------------------------ | -------------------------------- | ----------------------------------------------------------- | -------------------------------- |
| Sessions, specimens, images          | Yes                              | `/sessions/`, `/specimens/` (`includeAllImages`)            | Every metric, map, Session panel |
| Registered devices                   | Yes                              | `/devices/`                                                 | Active Devices, Device Status    |
| Sites and their place names          | Yes, as text                     | `/sites/` (`district`… or `locationHierarchy`)              | Areas, map paths, unit matching  |
| Collectors (VHTs, VCOs, FOT)         | Yes, as text on each Session     | `collectorName`, `collectorTitle`, `collectorLastTrainedOn` | Session panel "Entered by" only  |
| Web-app logins                       | Yes                              | `/users/auth-events`                                        | Unique Users, Logins             |
| Web-app activity snapshots           | Yes                              | `/users/active-metrics` (A1 / A7 / A30)                     | Not used                         |
| Household survey (people, nets, IRS) | Yes                              | `/sessions/{id}/survey`, `/sessions/metrics`                | Not used                         |
| District / Region with an id         | No                               | —                                                           | Units matched by name            |
| Units targeted / under surveillance  | No                               | Coverage workbook                                           | Coverage cards and layer         |
| Field Users expected / targeted      | No                               | Coverage workbook                                           | User coverage cards              |
| Active Field Users                   | Yes, as distinct collector names | `collectorName` on Sessions                                 | User coverage cards, map panel   |

## Collectors (VHTs)

No collector or VHT record exists: people are three text fields on each
Session's metadata form (`vectorcam-api` `src/db/models/Session.ts:25`).

- `collectorName`: free text; on all 2,138 Surveillance Sessions.
- `collectorTitle`: VHT 2,077 · VCO 44 · FOT 14 · 3 VHT spelling variants.
- `collectorLastTrainedOn`: set on all 317 September Sessions.

| Month (2026) | Sessions | Distinct names | Distinct devices |
| ------------ | -------- | -------------- | ---------------- |
| September    | 317      | 50             | 49               |
| August       | 245      | 43             | 30               |
| July         | 228      | 42             | 27               |

September: 2–7 names per District; Karenga has 5 names on 17 devices. The
workbook's estimate of active Field Users is 51.

Raw source: `GET /sessions/export/csv` (`programId`, `startDate`, `endDate` as
epoch milliseconds; a `YYYY-MM-DD` date is a 400) gives one row per Session with
`CollectorName`, `CollectorTitle`, `Type`, `DeviceID`, `SiteDistrict`,
`SiteVillageName` and `ProgramID`. No endpoint counts collectors: `/users/`,
`/users/active-metrics` and `/sites/{siteId}/users` are web-app accounts.

Limits: a name is not an identity (a misspelling counts twice, a shared name
once; word-order duplicates: none found, misspellings not checked). A collector
with no Session in the period is invisible, so expected and targeted counts
can't come from here.

## Places and coverage units

The only key shared with the workbook is the place name; there is no District
record with an id.

- Legacy Sites (Uganda): `district`, `subCounty`, `healthCenter`, `parish`,
  `villageName`, `houseNumber`.
- Newer Sites: `locationHierarchy`, levels from `/programs/{id}/location-types`.
- Match rule: a Session belongs to a Coverage Unit when its Site's top-level
  place has the unit's name (case, spaces, hyphens ignored), same Program
  (`unitSessionIds`). A rename or typo breaks it silently.
- Uganda: the 11 Districts with Surveillance Sessions match the workbook's 11
  Active units exactly.
- Boundaries come from OpenStreetMap, not VectorCam; the workbook's `boundary`
  column names the shape when it differs (Arua-periurban → Arua).
- Country outlines (the map fades everything outside the selected Programs'
  countries), via `scripts/fetch-country-outlines.mjs`: landlocked countries
  (Uganda) from OSM, so they meet the District shapes exactly; coastal ones from
  Natural Earth 1:10m, since OSM's country boundaries reach out to sea. Natural
  Earth's border is kilometres off OSM's in places, so a coastal country that
  gets District shapes will need its outline from those shapes instead.

## Sessions, specimens and devices

Complete; they drive every live metric. Paged per Program, cached ~1 h.

- `/sessions/`: `type`, `state`, `collectionDate`, `submittedAt`, `createdAt`,
  `siteId`, `deviceId`, GPS (recorded at upload, often wrong), collector fields.
- `/specimens/` with `includeAllImages`: species, sex, abdomen status per image
  (app prediction, replaced on review), image `capturedAt`.
- `/devices/`: every registered device, including never used; `ssaid`, no IMEI.
  A Device is an app registration: a factory reset makes a new one.
- `/programs/{id}/collection-cycles`: cycles and the Program's timezone.

## Web users and logins

All about web-app accounts (VCOs, reviewers, developers), never VHTs.

- `/users/`: `privilege`, `programId`, `isActive`, `isWhitelisted`. Prod: 38
  accounts, 7 at privilege 1 in Programs 1 and 4.
- Anyone can `POST /auth/signup` and log in, but `/users/permissions` answers
  only whitelisted users (401 "User authentication required" otherwise;
  `/users/profile` does not check). VectorAdmin reads it on every request, so
  every Viewer must be whitelisted; privilege 0 with no Sites is enough.
- `/users/auth-events`: logins per user per UTC day, since auth events shipped.
- `/users/active-metrics`: A1 / A7 / A30 from `User.lastActiveAt`, daily per
  Program. Not used yet.
- `/sites/{id}/users`: accounts assigned to a Site.

## Household surveillance forms

Describe the house trapped in, not the collector. Not read by VectorAdmin.

- `/sessions/{id}/survey`: people slept in house, IRS and months since, LLINs
  available / type / brand, people under LLIN, children under 5, pregnant woman.
- `/sessions/metrics?district=&startDate=&endDate=`: backend District roll-up
  (houses, people, fed _Anopheles_, vector density, LLINs per person…).
- `/programs/{id}/forms`, `/sessions/{id}/forms/answers`: each Program's custom
  metadata form and answers.

Completeness of the survey fields in prod: not checked.

## Only in the coverage workbook

| Figure                          | Uganda (example)                                                |
| ------------------------------- | --------------------------------------------------------------- |
| Units under active surveillance | 22 GF Districts                                                 |
| Units targeted                  | 14 (Active + Targeted)                                          |
| Units active                    | 11 (matches live data today)                                    |
| Field Users expected            | 66                                                              |
| Field Users targeted            | 84                                                              |
| Field Users active              | Now counted live (Sep 2026: 52 people on Surveillance Sessions) |

Units active and Field Users active are the two figures live data could replace.

## Open questions

- Settled 2026-10-08: Active Field Users are distinct collector names in the
  period's last month, every title, on the Sessions the Session filter keeps;
  Expected comes from the workbook's Expected Users sheet (Districts × 6).
- A unit's Active status: derived from Sessions, flagged when it disagrees, or
  shown beside live figures?
- Could the backend give Districts an id?
- How complete are the household survey fields, and should they be shown?
- Arua-periurban: Arua District or Arua City? (Uganda team)
