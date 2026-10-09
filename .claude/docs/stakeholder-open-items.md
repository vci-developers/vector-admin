# Stakeholder dashboard: open items

_As of 2026-10-09. Definitions live in `.claude/CONTEXT.md`; data sources in
`.claude/docs/vectorcam-data.md`. Tick an item off by deleting it._

## To do (no decision needed)

### Finish the Gates Foundation accounts

- Aysu Uygur, Himanshu Nagpal and Prashanth Selvaraj (`@gatesfoundation.org`)
  signed up on prod 2026-10-09 (`POST /auth/signup`, Program 1, a random
  password each) and whitelisted with no privilege or Sites. VectorAdmin needs
  the whitelist: `/users/permissions` refuses un-whitelisted users.
- Left: set `STAKEHOLDER_EMAILS` in the Vercel environment and redeploy, Uganda
  only for now:
  `aysu.uygur@gatesfoundation.org:1,himanshu.nagpal@gatesfoundation.org:1,prashanth.selvaraj@gatesfoundation.org:1`.
  Then confirm each signs in to the Stakeholder view.

### Connect the Blob store for the coverage fallback

- The app reads the live workbook every minute or so and keeps each good read in
  a private Vercel Blob (`coverage/latest.xlsx`); when SharePoint is down or the
  workbook is invalid it shows that copy, dated. Until a store is connected it
  falls back to the committed copy (refreshed 2026-10-09: 22 Districts, Program
  Potential).
- Vercel project → Storage → create a Blob store (private) and connect it; that
  sets `BLOB_READ_WRITE_TOKEN`. Redeploy. The first good read fills it.
- Oyam is under Lango in the GF list but Acholi in the rollout list (the app
  doesn't use `region`).

## Decisions needed (metric definitions)

### Expected Users for Programs other than Uganda

- Only Uganda has rows (48 May–Aug, 66 from Sep: Districts rolled out × 6).
  Ghana, Kenya, Cameroon and Colombia show no Instantaneous user coverage until
  they have their own expected figures.
- The old "VectorCam Active Users" chart is not usable as expected: for Uganda
  May–Aug it counted villages (24), not people (about 45).

### Geographic coverage and Penetration for Programs other than Uganda

- Decided 2026-10-09: both count Districts (or each Program's first place
  level). Uganda: 14 targeted, 22 under surveillance, from the Geographic Units
  sheet.
- The "geo coverage" and "penetration" denominator lists were mislabelled: they
  are Feb-27 Projected Devices and Program Potential.
- Needed: Geographic Units rows for Ghana, Kenya, Cameroon and Colombia; until
  then they show no place figures. Mind the Gap is not a Program in VectorCam.

## Data quality (for the program teams)

- Projected Devices for Uganda reads 66 (Sep–Nov) and 84 (Dec on), but the
  team's rollout rule gives 42 and 60 (3 phones per original District, 6 per new
  one). 66 matches Expected Users instead (2 VHTs × 3 villages × 11). The map
  and panel use the rule (Sep: 35 of 42); ask the Uganda team to correct the
  sheet.
- Device ids overcount phones: Karenga had 17 ids for 5 people in September and
  Oyam 8 for 3 (re-registrations), so Uganda's Stakeholder counts use villages
  and VHTs instead (hard-coded; see CONTEXT.md). Oyam had one VHT per village in
  September: 3 of its 6 phones.
- When Kaliro, Kotido and Maracha turn Active, add them to the phone-per-VHT
  Districts in `count-village-devices.ts` if they get a phone each (84 − 66 = 18
  suggests so); planned users per District stay Expected Users ÷ Active
  Districts.

- Names are not identities: "Agoini Hellen" and "AGOINI HELENI" (same village,
  Adjumani) count as two people, so Uganda August reads 43, not 42. No merge
  list exists; the app ignores only case, spacing and accents.
- Karenga entered two people per Session in September ("Lokwang John Johnic and
  Natyang Gloria", "Okumu Angel Gabriel and Omare John Bosco"); the app splits
  these. Ask for one collector per Session; name suggestions in the app would
  prevent most variants.
- Session types outside Uganda are unreliable: Ghana's May field work (Human
  Landing Catch) is saved as Data Collection; Colombia's 6–7 Aug demo day at the
  Leticia insectary is saved as Surveillance. The default Surveillance filter
  therefore drops the first and counts the second.

## Tuning (no decision blocking)

- Area colour steps (1–99, 100–499, 500–999, 1,000+) were picked without
  checking real totals; longer periods push more Areas into the top step.
- The workbook is cached about an hour; only a Developer's Refresh clears it. It
  could drop to a few minutes (a SharePoint read takes about a second).
- Stakeholder popups' specimen summaries are per period after the map filters.
- The daily chart buckets by UTC day; a collection between midnight and 3 a.m.
  in Uganda lands on the day before. Could use the Program's time zone.
