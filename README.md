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

- **Projects** — a target (e.g. "M31 - Andromeda Galaxy"), location, goal
  hours, storage location, a single camera/telescope/mount, the filters
  planned for it, and a status: Planning → Imaging → Processing → Complete.
- **Sessions** — one entry per night/outing, under a project: date,
  location, a file path (where that night's raw files live), notes, and its
  own status: Planning → Captured → Transferred → Processing → Complete.
- **Frames** — under a session, one record per batch of subs of the same
  type/filter/settings: frame type (Light/Dark/Flat/Flat Dark/Bias), filter,
  count, exposure length, gain, offset, temperature, binning, a file path,
  and its own Planning → Captured → Transferred → Processing → Complete
  status (shared with sessions - a new batch under a still-planned session
  starts out planned too). Deleting a project deletes all of its sessions
  and frames with it.
- **Cameras / Telescopes / Mounts / Filters / Locations** — manage your own
  gear, filter list, and imaging locations under Settings, so project and
  session setup is just picking from them. A camera can also carry its
  manufacturer-published default/optimal gain, prefilled for known catalog
  models, which then prefills new frame batches under that project.
- Automatic **integration-time totals** (Light frames only — calibration
  frames don't count), overall and broken down by filter, per project, per
  session, and on the dashboard and project page - where each active
  project also shows days since its last capture and a progress bar toward
  its goal hours (again, Light frames only), so you can see what's stalled
  and what's close to done at a glance.

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

## ASIAIR Autorun log import

**Import log** - from a project page (drafts a new session) or from an
existing session's page (adds frame batches to it) - lets you paste or
upload the `Autorun_Log_*.txt` file ASIAIR writes during a session, and
drafts frame batches from it automatically: frame type, exposure length,
binning, an approximate temperature, and - critically - the *actual* number
of subs completed, recovered from the per-image log lines rather than
trusting the planned count. An exposure that was still running when the run
was stopped isn't counted, runs that finished no frames at all are dropped,
and a run that was stopped and restarted at the same target/exposure/
binning/filter is merged back into one batch (with a note saying so).
The filter is read from ASIAIR's "Filter change, S change to H" lines and
matched to your filter list. Frames that were exposing while guiding lost
its star are flagged (but still counted), and calibration sets shot twice
at different exposures are flagged as a probable redo. Runs entirely
client-side, so it stays free and works offline.

It can't recover gain/offset, or the filter of a batch with no filter-change
line to go on - ASIAIR doesn't write those to this log - so those stay
editable blanks for you to fill in during review, before anything is saved.
Pasting a single sample `.fit` filename from that batch's folder into the
"Sample filename" field fills those gaps automatically, since ASIAIR encodes
the filter, gain, and temperature into the filename itself (e.g.
`Light_NGC 7000_180.0s_Bin1_2600MM_H_gain100_20260821-232712_252deg_-0.6F_0001.fit`).

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
