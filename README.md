# Astro Project Tracker

A project tracker for astrophotography: plan projects, log imaging sessions
across multiple nights/locations/filters, and see integration-time totals per
target. Built as an installable web app (PWA) so it works on your phone or in
a browser, **online or off** — no backend, no account, no recurring cost.

## Why this shape

- **PWA, not native apps.** One React codebase, installable to your phone's
  home screen and usable in any desktop browser. No app store fees.
- **Local-first.** All data lives in the browser's IndexedDB via
  [Dexie](https://dexie.org/). It works standing at the telescope with zero
  signal, and there's no server to pay for or keep alive.
- **Free hosting.** Deploys to GitHub Pages via GitHub Actions — `$0/month`.

Cross-device sync (phone at the remote observatory ↔ home computer) is not
built yet. See **Roadmap** below for the plan to add it cheaply.

## What's tracked today

The data model mirrors an existing AppSheet app tracking the same projects,
so the two can be reconciled or synced later without another reshape:

- **Projects** — a target (e.g. "M31 - Andromeda Galaxy"), location, goal
  hours, storage location, a single camera/telescope/mount, the filters
  planned for it, and a status: Planning → Imaging → Processing → Complete.
- **Sessions** — one entry per night/outing, under a project: date,
  location, a file path (where that night's raw files live), notes, and its
  own pipeline status: Captured → Transferred → Processing → Complete.
- **Frames** — under a session, one record per batch of subs of the same
  type/filter/settings: frame type (Light/Dark/Flat/Flat Dark/Bias), filter,
  count, exposure length, gain, offset, temperature, binning, a file path,
  and its own Captured → Transferred → Processing → Complete status.
- **Cameras / Telescopes / Mounts / Filters** — manage your own gear and
  filter list under Settings, so project setup is just picking from them.
- Automatic **integration-time totals** (Light frames only — calibration
  frames don't count), overall and broken down by filter, per project, per
  session, and on the dashboard.

## Running it locally

```bash
npm install
npm run dev       # dev server at http://localhost:5173
npm run build     # production build to dist/
npm run preview   # serve the production build locally
```

## Deploying (GitHub Pages, free)

A workflow at `.github/workflows/deploy.yml` builds and deploys `main` to
GitHub Pages automatically. One-time setup in the repo on GitHub:
**Settings → Pages → Source → GitHub Actions**. After that, every push to
`main` publishes to `https://<your-username>.github.io/AstroProjectTracker/`.

Install it on your phone from that URL: open it in the browser and choose
"Add to Home Screen" (iOS Safari) or "Install app" (Android Chrome). It then
launches full-screen and works offline.

## ASIAIR Autorun log import

From a project page, **Import log** lets you paste or upload the
`Autorun_Log_*.txt` file ASIAIR writes during a session, and drafts that
session's frame batches from it automatically: frame type, exposure length,
binning, an approximate temperature, and - critically - the *actual* number
of subs completed, recovered by counting per-image log lines rather than
trusting the planned count (so an interrupted run shows 7 of 130, not 130).
Runs entirely client-side, so it stays free and works offline.

It can't recover which filter was mounted, or gain/offset - ASIAIR doesn't
write those to this log - so those stay editable blanks for you to fill in
during review, before anything is saved.

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

1. **Cross-device sync, free tier first** — most likely the Google Sheets
   API (reusing the Google account already in use for the existing AppSheet
   version) as a lightweight, free sync layer, since it means data entered
   on the phone at the observatory shows up at the home computer without
   standing up a paid backend.
2. **Planning tools** — target visibility windows, moon-phase-aware
   scheduling, and a backlog of "up next" targets.
3. **Publishing links** — richer tracking of where/when a finished image
   was published (AstroBin, etc.).

## Tech stack

React + TypeScript + Vite, React Router (hash-based routing, so it works
from any subpath without server config), Dexie (IndexedDB), and
`vite-plugin-pwa` for the service worker/manifest that make it installable
and offline-capable.
