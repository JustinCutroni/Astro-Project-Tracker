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

- **Projects** — a target (e.g. "M31 - Andromeda Galaxy"), a goal, and a
  status: Planning → Collecting → Transferring → Processing → Published (or
  On hold).
- **Sessions** — one entry per night/outing: date, location, equipment used,
  and per-filter sub-exposure tallies (sub length × count), plus seeing,
  weather, and moon illumination notes.
- **Equipment / Filters / Locations** — manage your own gear list, filter
  set, and imaging sites (including whether a site is remote) under
  Settings, so session logging is just picking from your own lists.
- Automatic **integration-time totals**, overall and broken down by filter,
  per project and on the dashboard.

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

## Roadmap

Rough order, biased toward what's cheapest to run:

1. **Data pipeline tracking** — follow a night's files from
   on-camera → at-observatory → transferred home → backed up → processed →
   archived, including size/location, so nothing gets lost across the
   collect/transfer/process/backup chain.
2. **Cross-device sync, free tier first** — most likely the Google Sheets
   API (reusing the Google account already in use for the existing AppSheet
   version) as a lightweight, free sync layer, since it means data entered
   on the phone at the observatory shows up at the home computer without
   standing up a paid backend.
3. **Telescope/session log scraping** — import equipment log files
   (e.g. NINA/PHD2/ASIAIR logs) to auto-fill session data instead of typing
   it by hand.
4. **Planning tools** — target visibility windows, moon-phase-aware
   scheduling, and a backlog of "up next" targets.
5. **Publishing links** — richer tracking of where/when a finished image
   was published (AstroBin, etc.).

## Tech stack

React + TypeScript + Vite, React Router (hash-based routing, so it works
from any subpath without server config), Dexie (IndexedDB), and
`vite-plugin-pwa` for the service worker/manifest that make it installable
and offline-capable.
