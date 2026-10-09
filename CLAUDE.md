# CLAUDE.md

## Who I am and how to work with me

I'm a product and marketing person, not a software engineer. I direct the work; you write the code.

- Explain what you're doing and why in plain English. Define jargon the first time you use it.
- Before any non-trivial change (more than ~3 files, or anything touching data structures, auth, security rules, or dependencies), give me a short plan and wait for my OK.
- If my request is ambiguous, or you think my idea is a bad one, say so and propose alternatives. Don't silently build the wrong thing.
- Tell me what you did NOT verify. "It should work" is not a result.

## How to build

1. Restate what I asked in 1-2 sentences, including what "done" looks like.
2. Read the existing code first. Follow the patterns already in the repo. Don't add new libraries, folder structures, or patterns without asking.
3. Make the smallest change that solves the problem. Don't refactor unrelated code in the same change; list it for me instead.
4. Work in small steps, each one checkable on its own.
5. Verify before you say it's done (see "Definition of done").

## Simplicity (the most important design rule)

Complexity that comes from the problem itself is fine. Complexity that comes from how we build it is a bug.

- One job per function, component, and file.
- Prefer plain data (objects, arrays, maps) over clever class hierarchies.
- Keep business rules in pure functions (same input, same output, no side effects), separate from UI and database code. Each rule lives in one place.
- Names say what the thing does. Be consistent.
- Don't add abstraction, options, or generality "for later." Build what's needed now. No dead or commented-out code.

Stop and tell me if you see any of these warning signs: the same logic copied in 2+ places; a function or component doing several jobs; hidden dependencies (change one thing, three others break); special cases piling up; inconsistent naming; the same state stored in several places that must be kept in sync.

## Edge cases: think through these for every feature

- Empty, missing, or null values; zero, negative, or huge numbers
- Very long text, special characters, emoji
- Malformed data. Never assume data from the database, an API, or a file is well-formed.
- Duplicates; double-clicks and repeated submits
- Dates and time zones
- Offline, slow, or failed network
- User not signed in, or session expired
- Another device edited the same record

In your summary, list which edge cases you considered and how each is handled (or flag the ones you chose not to handle).

## Testing

- New logic gets tests. A bug fix gets a test that fails first, then passes.
- Test behavior (what it does), not implementation (how it does it).
- Never delete, skip, or weaken a test to make it pass. If a test fails, find out why and tell me.
- If the repo has no test setup, propose one and ask before installing anything.
- Passing type checks and lint does not prove a feature works. For UI changes, run the app and check the real behavior. If you can't, say so.

## Security and data

- Never commit secrets (API keys, tokens, passwords, `.env.local`). Anything shipped in browser or mobile code is public. If a feature needs a real secret, tell me; it needs a backend.
- Treat all user input as untrusted: validate it and escape it. No `eval`, `dangerouslySetInnerHTML`, or string-built queries without my approval.
- Access control lives on the server side (for Firebase, in security rules), not just in the UI. Any change to data access comes with a rules change and a test.
- Ask before adding a dependency. Tell me what it is, why we need it, and whether it's actively maintained. After dependency changes, run `npm audit` and report high or critical findings.
- Never destroy user data silently. Prefer archive/retire over delete, confirm destructive actions in the UI, and make migrations reversible or backed up.

## Git safety

- Work on a branch, not directly on `main`.
- Commit in small steps with messages that explain why, not just what.
- Never force-push, rewrite history, or delete branches without asking.
- Don't merge or deploy without my OK.
- Before a risky change, make sure the last working version is committed.

## Definition of done

Don't say "done" until all of these are true:

1. `npm run build` passes
2. `npm run lint` passes
3. Tests pass (when they exist)
4. You ran or checked the feature itself
5. No unrelated changes slipped in
6. README updated if behavior changed

Then give me a short summary: **What changed** (plain English), **How I can check it myself**, **Edge cases covered**, **Not verified / risks**, and **Things I noticed but didn't touch**.

---

# Project-specific: Astro Project Tracker

(Delete this section when using this file in a different repo.)

**What it is:** An installable web app (PWA) for planning astrophotography projects, logging imaging sessions, and totaling integration time per target. React 19 + TypeScript + Vite, React Router (hash routing), Firebase Auth (Google sign-in) + Firestore with offline persistence, `vite-plugin-pwa`. No backend. Hosted on GitHub Pages, and **a push to `main` deploys to the live site**.

**Commands:** `npm run dev`, `npm run build` (type-checks, then builds), `npm run lint` (oxlint), `npm run preview`. Local sync testing: `firebase emulators:start` with `VITE_USE_FIREBASE_EMULATOR=true`.

**Read the README before changing data code.** Rules that must never break:

- **Hierarchy:** Project → Sessions → Frame batches. Deleting a project deletes its sessions and frames.
- **Status pipeline:** Planning → Capturing → Transferring → Processing → Complete. Changing a session's status moves its batches (forward lifts batches that are behind; backward pulls back batches that are further along). A session or project advances automatically only when ALL its children reach the next stage, and only ever forward. A project's status can't be set ahead of its least-advanced session.
- **Integration time counts Light frames only.** Darks, flats, and bias never count.
- **Gear: retire, don't delete.** Each session stores its own copy of the equipment used, so editing the gear catalog never changes past sessions. Filters lock once a session leaves Planning.
- **Offline-first:** every feature must work with no connection.
- **`firestore.rules` locks every document to its owner.** Never loosen it. Any new collection needs rules plus a rules test.
- The `VITE_FIREBASE_*` values are public by design (the rules protect the data). Still, never commit `.env.local`.

**Known gap:** there are no automated tests yet. When I approve it, set up Vitest and start with (1) status propagation, (2) integration-time totals, and (3) the Firestore rules, using `@firebase/rules-unit-testing` against the emulator.
