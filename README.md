# Astro Project Tracker

A project tracker for astrophotography: plan projects, log imaging sessions
across multiple nights/locations/filters, and see integration-time totals per
target. Built as an installable web app (PWA) so it works on your phone or in
a browser, **online or off**, and syncs across every device you sign into.

## Why this shape

- **PWA, not native apps.** One React codebase, installable to your phone's
  home screen and usable in any desktop browser. No app store fees.
- **Offline-first, with real sync.** Data lives in Firestore's local
  persistent cache (backed by IndexedDB) and syncs automatically once you're
  back online. It works standing at the telescope with zero signal, and the
  same data shows up on your other devices without you doing anything.
- **One sign-in, one free Firebase project.** Sync needs to know whose data
  it's syncing, so there's a one-time "Sign in with Google" step per device.
  Firebase's free tier (1 GiB storage, 50K reads/20K writes per day) is far
  more than one person's astrophotography log will ever use - see
  **Setting up your own Firebase project** below.
- **Free hosting.** Deploys to GitHub Pages via GitHub Actions — `$0/month`.

## What's tracked today

The data model mirrors an existing AppSheet app tracking the same projects,
so the two can be reconciled or synced later without another reshape:

- **Projects** — a target (e.g. "M31 - Andromeda Galaxy"), goal
  hours, and a status (see **Status** below). A project has no equipment of its own - that belongs to each
  session.
- **Sessions** — one entry per night/outing, under a project: date,
  location, the equipment used (mount, telescope, camera and filters), a file path (where that night's raw files live), notes, and its
  own status.
- **Frames** — under a session, one record per batch of subs of the same
  type/filter/settings: frame type (Light/Dark/Flat/Flat Dark/Bias), filter,
  count, exposure length, gain, offset, temperature, binning, a file path,
  and its own status (a new batch starts at its session's status). Deleting a project deletes all of its sessions
  and frames with it.
- **Cameras / Telescopes / Mounts / Filters / Locations** — manage your own
  gear, filter list, and imaging locations under Settings, so session
  setup is just picking from them. See **Gear and history** below for
  what happens when you sell or replace something. A camera can also carry its
  manufacturer-published default/optimal gain, prefilled for known catalog
  models, which then prefills new frame batches under that project.
- Automatic **integration-time totals** (Light frames only — calibration
  frames don't count), overall and broken down by filter, per project, per
  session, and on the dashboard and project page - where each active
  project also shows days since its last capture and a progress bar toward
  its goal hours (again, Light frames only), so you can see what's stalled
  and what's close to done at a glance.

## Status

Projects, sessions and frame batches share one status, in pipeline order:
**Planning → Capturing → Transferring → Processing → Complete**.

- **Down:** changing a session's status updates its frame batches. Moving
  forward brings batches that are behind up to the new status (ones already
  ahead are left alone); moving backward pulls back any batch that's further
  along.
- **Up:** a session advances by itself once *every* one of its batches has
  reached the next stage, and a project once *every* session has. This only
  ever moves forward, so a session you leave as Planning (say, clouded out)
  holds its project where it is. A project's status can't be set ahead of its
  least-advanced session; it gets there on its own.

## Gear and history

Selling or replacing gear must never rewrite your past work, so:

- **Retire, don't delete.** In Settings, the archive button on a camera,
  telescope, mount or filter *retires* it: it disappears from every picker
  (and from auto-matching on log import) but stays on record. Retired gear
  sits behind a "Show retired" toggle and can be restored. The delete button
  only appears for gear that nothing uses.
- **Every session owns its equipment.** A session stores the mount,
  telescope, camera and filters used that night, copied in when the session
  is saved, so a project can use a different rig from one night to the next.
  New sessions start from the project's most recent session; Copy session
  starts from the source session. Frame batches draw on their session:
  the filter picker offers that session's filters and a new batch's gain
  defaults from the session's camera. Each frame batch also stores its
  filter's name. Renaming or editing a catalog entry later doesn't change
  what an old session says it used, and gear a session already uses stays
  selectable (marked "retired") when you edit it.
- **Filters lock once a session leaves Planning.** While a session is Planning you can change
  its filters; batches on a filter you remove move to a replacement you pick
  (swapping S for H in a copied session pairs them automatically). Once the
  session moves past Planning its filters are fixed - set it back to Planning
  to change them.

## Tonight, at a glance

The dashboard opens with a **Tonight** card: if a session is already dated
for today, it links straight to it (or lists all of them, if more than one
project is imaging tonight); if nothing's planned yet, it offers a quick
project picker to start one. Below that, an **Upcoming sessions** list
shows every session dated today or later across all projects, soonest
first - so a night you already planned next week doesn't get lost in a
single project's session list.

## Running it locally

Needs a `.env.local` with Firebase config first - see **Setting up your own
Firebase project** below, or **Testing sync locally** to run against the
local emulator instead of a real project.

```bash
npm install
npm run dev       # dev server at http://localhost:5173
npm run build     # production build to dist/
npm run preview   # serve the production build locally
```

## Setting up your own Firebase project

This app needs a Firebase project to sync through - a one-time setup, done
in your own Google account:

1. Go to the [Firebase console](https://console.firebase.google.com/) →
   **Add project** → give it any name (e.g. "astro-project-tracker") →
   you can decline Google Analytics, it's not needed.
2. **Build → Firestore Database → Create database** → start in
   **production mode** (the rules in `firestore.rules`, already in this
   repo, lock every document to its owner - see below for how to publish
   them) → pick any region close to you.
3. **Build → Authentication → Get started → Sign-in method → Google** →
   enable it.
4. **Project settings** (gear icon) → scroll to **Your apps** → click the
   web icon (`</>`) → register an app (any nickname, no hosting needed) →
   copy the `firebaseConfig` values shown.
5. Set those values as **GitHub Actions repository secrets**
   (repo → Settings → Secrets and variables → Actions → New repository
   secret), one per line in `.env.example`: `VITE_FIREBASE_API_KEY`,
   `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
   `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`,
   `VITE_FIREBASE_APP_ID`. The deploy workflow reads these at build time.
6. Publish the security rules so only you can read/write your data: install
   the Firebase CLI (`npm install -g firebase-tools`), run `firebase login`,
   then from this repo run `firebase deploy --only firestore:rules --project
   <your-project-id>`.
7. For local development, copy `.env.example` to `.env.local` and fill in
   the same values (leave `VITE_USE_FIREBASE_EMULATOR=false` unless you're
   running `firebase emulators:start` for testing).

None of these config values are secret - Firestore access is controlled by
`firestore.rules`, not by hiding them - but they're still cleaner to manage
as secrets/env vars than hardcoded in source.

## Deploying (GitHub Pages, free)

A workflow at `.github/workflows/deploy.yml` builds and deploys `main` to
GitHub Pages automatically. One-time setup in the repo on GitHub:
**Settings → Pages → Source → GitHub Actions**. After that, every push to
`main` publishes to `https://<your-username>.github.io/AstroProjectTracker/`.

Install it on your phone from that URL: open it in the browser and choose
"Add to Home Screen" (iOS Safari) or "Install app" (Android Chrome). It then
launches full-screen and works offline.

## Session log files

A session's page has a **Log files** card where you can upload the
`Autorun_Log_*.txt` file ASIAIR writes during a session - typically after the
session is over. The file is stored exactly as uploaded (gzipped, then kept
in Firestore alongside your other data, so it syncs and works offline) and can
be downloaded or removed from the same card. A session can hold several logs.

Uploading a log does **not** read it or change anything: frame batches,
counts and temperatures are entered by hand (or from a sample FITS file or
filename, below). Logs are kept so they can be put to use later. Each log must
compress to under about 900 KB, which is far more than a night's log needs;
a larger file is rejected with a message. Deleting a session or project
deletes its logs. Copying a session does not copy them.

The old log parser (`src/lib/asiairLogParser.ts`) is no longer wired into the
app but is left in place for that later use.

## Loading a frame batch from a FITS file

When adding or editing a frame batch, **"Load from a sample FITS file"**
reads frame type, exposure, binning, gain, filter, and temperature straight
out of an actual captured `.fit` file's own header - not just its filename.
Runs entirely client-side (a FITS header is plain ASCII, parsed by hand, no
imaging library needed) and is more reliable than filename parsing for
temperature specifically: FITS's `CCD-TEMP` keyword is unambiguously
Celsius by convention, where ASIAIR's own filename convention labels its
temperature field "F" even though it's actually Celsius. Only the batch's
count still needs entering by hand, since a header describes one frame, not
a batch.

## Duplicating sessions and frame batches

Most nights on the same target reuse the same location, file path, and frame
settings - only the light frame counts (and sometimes which filter) tend to
change. Two shortcuts avoid re-entering everything by hand:

- **Duplicate session** (on a session's page) clones that session - location,
  file path, notes, and every frame batch - into a brand new session dated
  today, so you only need to adjust the date and any counts that changed.
- **Also create identical batches for...** (when adding or editing a frame
  batch) copies everything about that batch - exposure, binning, gain,
  temperature - into a new batch per filter you check, for mono imaging
  through a filter set like S/Ha/OIII where only the filter (and maybe the
  count) differs between batches.
- **Also create a matching flat frame batch** (when adding or editing a
  Light frame batch) creates a Flat batch through the same filter and at
  the same temperature, with its own count and exposure - flats are always
  shot at a different (usually much shorter, often auto-exposure)
  exposure than the lights they calibrate.

## Sorting and filtering frames

A session's frame batch list can get long fast (a light batch per filter,
plus darks/flats/bias). The Type and Filter dropdowns above it narrow the
list down, and Sort by reorders it by frame type, by filter (in the same
S/Ha/OIII/L/R/G/B convention used everywhere else), or by most recently
added.

## Target autocomplete

The project "target" field suggests matches as you type, from a small
offline catalog (the full Messier catalog plus ~50 popular NGC/IC/Sharpless
astrophotography targets) bundled with the app - not a live API call. That's
deliberate: a public astronomy name-lookup API (like the one a similar
open-source project uses) generally requires an API key, and a client-only
app like this one has no backend to hide that key behind - embedding it in
the browser bundle would expose it to anyone who opens dev tools. The
catalog is just a starting point, not a constraint - the field stays plain
free text for anything not listed.

The camera description field in Settings works the same way: type or pick a
known model (e.g. "ASI2600MM") and its sensor size, pixel size, and
resolution fill in automatically from a small bundled catalog of common
astrophotography cameras. Same reasoning - offline, free, and every field
stays editable since the catalog won't have every camera.

## Night mode

The moon icon in the header switches to a monochrome red palette (black
background, red-only text and status colors) for preserving night vision at
the eyepiece, and remembers your choice on that device.

## Roadmap

Rough order, biased toward what's cheapest to run:

1. **Planning tools** — target visibility windows, moon-phase-aware
   scheduling, and a backlog of "up next" targets.
2. **Publishing links** — richer tracking of where/when a finished image
   was published (AstroBin, etc.).

## Tech stack

React + TypeScript + Vite, React Router (hash-based routing, so it works
from any subpath without server config), Firebase Auth (Google sign-in) +
Firestore (with persistent local cache for offline support and realtime
sync across devices), and `vite-plugin-pwa` for the service worker/manifest
that make it installable.

## Testing sync locally

`firebase emulators:start` runs Firestore + Auth locally (no real Firebase
project needed - `.env.local` points the app at `demo-astro-tracker`, a
purely local project ID). The emulator's Google sign-in popup can't
complete without real network access to Google, so a small "Emulator test
sign-in" form appears on the sign-in screen when
`VITE_USE_FIREBASE_EMULATOR=true` - it's compiled out of any real
deployment, where that env var is unset.

## Automated tests

- `npm test` - fast checks that need no network or Firebase: the status
  rules (how a change moves through project -> session -> frame batches,
  and when a parent advances) and integration-time totals (Light frames
  only; darks, flats, and bias never count; batches still in Planning
  aren't captured time yet).
- `npm run test:rules` - checks `firestore.rules` against the local
  Firestore emulator: you can read/write only your own `users/<uid>/...`
  data, and signed-out visitors and other accounts get nothing. Needs the
  Firebase CLI (`npm install -g firebase-tools`) and Java; the first run
  downloads the emulator.

Any new Firestore collection needs a rules change and a matching test here.
