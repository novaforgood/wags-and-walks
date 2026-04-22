# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wags and Walks is an internal admin dashboard for a dog foster/rescue nonprofit. It manages foster applicants through a pipeline: new applicants are triaged, flagged for red flags, approved, and tracked as active fosters. The backend data source is Google Sheets, accessed via a Google Apps Script proxy.

## Commands

- `npm run dev` — Start Next.js dev server
- `npm run build` — Production build
- `npm run start` — Start production server
- `npm run lint` — ESLint (next lint)

No test framework is configured.

## Architecture

**Next.js 14 App Router** (TypeScript, React 18) — all UI lives under `app/`.

### Data Flow

1. **Google Sheets → Apps Script → Next.js API routes → React context → pages**
2. `app/api/people/route.ts` — Fetches all applicants from Google Sheets via `APPS_SCRIPT_URL` (env var), normalizes raw sheet rows into `Person` objects
3. `app/api/send-email/route.ts` — Proxies POST/GET requests to the same Apps Script (used for status updates, emails)
4. `app/api/foster-notes/route.ts` — GET/POST proxy to `FOSTER_SCRIPT_URL` for reading and writing per-foster notes (GET by `?email=`, POST with `{ email, content }`)
5. `app/components/PeopleProvider.tsx` — Client-side React context (`usePeople()` hook) that:
   - Fetches from `/api/people` on mount, caches in `localStorage`
   - Provides optimistic status updates with a debounced flush queue (persisted to `localStorage` for resilience)
   - Fires a Google Apps Script webhook when a person is moved to `approved`
   - `setNotes(email, content)` — writes applicant notes via `/api/send-email` with `action: 'set_notes'` (Sheet 1). **Different** from `NotesCard` which calls `/api/foster-notes` (Sheet 2)

### Person Status Pipeline

Defined in `app/lib/peopleTypes.ts`. Statuses: `new` → `in-progress` → `approved` → `current`. Rejected variants: `rejected`, `rejected_new`, `rejected_in-progress`, `rejected_approved`.

The API auto-promotes `new` applicants with no flags to `in-progress` (see `app/api/people/route.ts`).

### Page Structure

Root `/` redirects to `/overview`.

Two layout patterns coexist:
- **`/candidates` and `/fosters`** — New sidebar layout (these pages render their own sidebar; `Navigation` component hides itself)
- `/candidates` — Applicants in pipeline (new, in-progress, approved)
- `/fosters` — Default route; renders the **ShelterManager directory** (dog records), NOT the people list
- `/fosters/overview` — Foster overview dashboard (people with `status = 'current'`)
- `/fosters/actions` — Foster action tracking (also driven by `current` people)
- `/fosters/[fosterId]` — Individual foster detail (slug from `fosterSlug()` in `fosterDirectory.ts`)
- `/overview` — Top-level overview dashboard
- `/directory` — Dog directory page (also uses `/api/dogs`)
- `/current` — Current fosters page
- `/signup` — Signup page (auth, not fully wired)
- `/applicants/[email]` — Individual applicant detail
- `/applicants/[email]/updates` — Updates timeline (placeholder)

### Shared Components

- `PersonModal` — Detail modal for viewing full applicant info
- `FilterDropdown` — Multi-category filter dropdown (living situation, experience, children, dog types, pet history)
- `NotificationPanel` — Bell icon notification dropdown with unread/read filtering (currently uses mock data)
- `FostersSubTabs` — Tab bar (Directory / Overview / Actions) rendered inside the `/fosters` layout
- `NotesCard` — Shared notes textarea + email compose popup (draggable). Fetches/saves directly to `/api/foster-notes` on blur. Email popup (`Send Email` button) calls `/api/send-email` with `action: 'send_single_email'`

> **Layout coupling:** `/fosters`, `/fosters/overview`, `/fosters/actions`, and `/fosters/[fosterId]` all import from `candidates/candidates.module.css` for the shared sidebar shell. This is intentional — there is no separate fosters layout file.

### Styling

CSS Modules throughout (`*.module.css`). Global styles in `app/globals.css`. Font: Inter (loaded via Google Fonts in layout).

### Path Aliases

`@/*` maps to project root (e.g., `@/app/lib/peopleTypes`).

### Authentication

**Firebase Auth** — Email/password authentication for admin access. Root layout wraps everything as `<AuthProvider><PeopleProvider>` — auth context is always available inside people context.

- `firebase.js` — Firebase initialization and auth instance export
- `app/components/AuthProvider.tsx` — React context providing `useAuth()` hook with `signIn()`, `signOut()`, `signUp()` methods
- `app/components/ProtectedRoute.tsx` — Wrapper component that redirects to `/login` if user is not authenticated
- `app/login/page.tsx` — Split-screen login page with Wags & Walks branding

Protected pages (wrapped with `<ProtectedRoute>`):
- `/candidates`
- `/fosters`

### Dogs / ShelterManager

`app/api/dogs/route.ts` — Fetches dog records from ShelterManager (ASM) via the `json_shelter_animals` method at `ASM_BASE_URL`. Returns JSON consumed by `/fosters` (directory tab) and `/directory`. Only animals with a foster-type active movement are flagged `inFoster: true`; `daysInFoster` is computed from `ACTIVEMOVEMENTDATE`.

`app/api/dogs/photo/route.ts` — Server-side proxy for dog images from ASM. Accepts `?animalId=<id>&variant=thumbnail|full`. Uses `animal_thumbnail` or `animal_image` (seq 1) ASM methods. Proxies the binary response directly — avoids exposing ASM credentials to the client.

### Foster Sub-pages

Key lib files:
- `app/lib/fosterDirectory.ts` — Builds `FosterDirectoryItem[]` from ASM dog records; computes `FosterStatus` (Good: <14 days, Needs Review: 14–30 days, Overdue: >30 days). Dogs prefixed with `*fta`, `*ufta`, `*sts`, `*ff`, `*adopting`, or containing `(w/` are hidden via `shouldHideDog()`.
- `app/lib/fosterActions.ts` — Builds `FosterOverviewRow[]` from `current` people in Google Sheets; extracts dog names and derives action statuses (photos, vet records, weekly check-in, orientation) from the sheet's raw column values.

### localStorage Keys

- `people_v2` — Cached array of `Person` objects from last successful fetch
- `pending_status_updates_v1` — Queued status changes not yet flushed to Sheets (survives page refresh)
- `app_nav_sidebar_width_v1` — Persisted sidebar width (px) for the resizable nav

### Dev Utilities

`scripts/reset_status.js` — Bulk-resets all applicants to `new` status by hitting the local API. Requires dev server running on port 3001. Run with `node scripts/reset_status.js`.

### Known TODOs in Code

- `UPDATED_BY = 'jay t'` in `PeopleProvider.tsx` — hardcoded admin identity; should be replaced with the logged-in Firebase user
- `firebase 2.js` at root — stale duplicate of `firebase.js`, safe to delete

### Apps Script Source — Two Separate Sheets

There are **two independent Google Sheets / Apps Script projects**. Changes to either must be manually redeployed in the Apps Script editor.

**Sheet 1 — Applicants** (`appscript/WebApp.gs`)
- Backs the `APPS_SCRIPT_URL` endpoint — the main data API used by the Next.js app
- Sheet: "Form Responses 1" (applicant pipeline data: status, starred, notes, flags)
- Current deployment ID: `AKfycbyCk2eN4T6TTtaNF04U7nyM9TDKQOb_2Yw2UDTFbOFv6bmWxqk49sh-ndm7xzVxxskT`
- Called by: `/api/people` (GET rows) and `/api/send-email` (POST mutations)

**Sheet 2 — Foster Tracking** (`appscript/CurrentFoster.gs`, `TaskCheck.gs`, `Code.gs`, `ResetStatuses.gs`)
- Standalone — **not called by the Next.js app**; runs on a schedule inside the Apps Script project
- Deployment ID: `AKfycbxbypLoDIBYX5OaKM--nmulOHA_RtoOSN_Di_W6jBkornRP3I1tHEwMnVERmxS1X-Lh`
- `CurrentFoster.gs` — `syncCurrentFosterDogs()`: pulls current fosters from ASM → writes to "Current Fosters" sheet
- `TaskCheck.gs` — `checkFosterTasks()` (daily trigger at 8am): checks photo/survey task deadlines, queues email reminders, updates "Task Log" sheet. Reads form completions from "Form Responses" sheet. Currently logs only — email sending is disabled during testing.
- `Code.gs` — `autoOrganizeFormFiles()`: form submit trigger that moves uploaded foster photos into per-dog Google Drive folders
- `ResetStatuses.gs` — `resetAllStatusesToNew()`: bulk-resets all applicant statuses to `new` directly in the sheet (Apps Script side equivalent of `scripts/reset_status.js`)

### Environment Variables

Defined in `.env.local`:
- `APPS_SCRIPT_URL` — Sheet 1 web app URL (applicant data API)
- `APPS_SCRIPT_KEY` — Auth key for the Apps Script
- `FOSTER_SCRIPT_URL` — Separate Apps Script URL for foster notes read/write (`/api/foster-notes`)
- `NEXT_PUBLIC_FIREBASE_*` — Firebase configuration (API key, auth domain, project ID, etc.)
- `ASM_BASE_URL`, `ASM_ACCOUNT`, `ASM_USERNAME`, `ASM_PASSWORD` — ShelterManager API credentials (server-side only)
