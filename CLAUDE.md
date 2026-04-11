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
4. `app/components/PeopleProvider.tsx` — Client-side React context (`usePeople()` hook) that:
   - Fetches from `/api/people` on mount, caches in `localStorage`
   - Provides optimistic status updates with a debounced flush queue (persisted to `localStorage` for resilience)
   - Fires a Google Apps Script webhook when a person is moved to `approved`

### Person Status Pipeline

Defined in `app/lib/peopleTypes.ts`. Statuses: `new` → `in-progress` → `approved` → `current`. Rejected variants: `rejected`, `rejected_new`, `rejected_in-progress`, `rejected_approved`.

The API auto-promotes `new` applicants with no flags to `in-progress` (see `app/api/people/route.ts`).

### Page Structure

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

### Styling

CSS Modules throughout (`*.module.css`). Global styles in `app/globals.css`. Font: Inter (loaded via Google Fonts in layout).

### Path Aliases

`@/*` maps to project root (e.g., `@/app/lib/peopleTypes`).

### Authentication

**Firebase Auth** — Email/password authentication for admin access.

- `firebase.js` — Firebase initialization and auth instance export
- `app/components/AuthProvider.tsx` — React context providing `useAuth()` hook with `signIn()`, `signOut()`, `signUp()` methods
- `app/components/ProtectedRoute.tsx` — Wrapper component that redirects to `/login` if user is not authenticated
- `app/login/page.tsx` — Split-screen login page with Wags & Walks branding

Protected pages (wrapped with `<ProtectedRoute>`):
- `/candidates`
- `/fosters`

### Dogs / ShelterManager

`app/api/dogs/route.ts` — Fetches dog records from ShelterManager (ASM) via the `json_shelter_animals` method at `ASM_BASE_URL`. Returns JSON consumed by `/fosters` (directory tab) and `/directory`. Only animals with a foster-type active movement are flagged `inFoster: true`; `daysInFoster` is computed from `ACTIVEMOVEMENTDATE`.

### Foster Sub-pages

Key lib files:
- `app/lib/fosterDirectory.ts` — Builds `FosterDirectoryItem[]` from ASM dog records; computes `FosterStatus` (Good: <14 days, Needs Review: 14–30 days, Overdue: >30 days). Dogs prefixed with `*fta`, `*ufta`, `*sts`, `*ff`, `*adopting`, or containing `(w/` are hidden via `shouldHideDog()`.
- `app/lib/fosterActions.ts` — Builds `FosterOverviewRow[]` from `current` people in Google Sheets; extracts dog names and derives action statuses (photos, vet records, weekly check-in, orientation) from the sheet's raw column values.

### localStorage Keys

- `people_v2` — Cached array of `Person` objects from last successful fetch
- `pending_status_updates_v1` — Queued status changes not yet flushed to Sheets (survives page refresh)
- `app_nav_sidebar_width_v1` — Persisted sidebar width (px) for the resizable nav

### Known TODOs in Code

- `UPDATED_BY = 'jay t'` in `PeopleProvider.tsx` — hardcoded admin identity; should be replaced with the logged-in Firebase user
- `firebase 2.js` at root — stale duplicate of `firebase.js`, safe to delete

### Apps Script Source

`appscript/` at the repo root contains the Google Apps Script source files (`WebApp.gs`, `Code.gs`, `CurrentFoster.gs`, etc.) that back the `APPS_SCRIPT_URL` endpoint. Changes here must be manually deployed to the Apps Script project.

### Environment Variables

Defined in `.env.local`:
- `APPS_SCRIPT_URL` — Google Apps Script deployment URL (the main data API)
- `APPS_SCRIPT_KEY` — Auth key for the Apps Script
- `NEXT_PUBLIC_FIREBASE_*` — Firebase configuration (API key, auth domain, project ID, etc.)
- `ASM_BASE_URL`, `ASM_ACCOUNT`, `ASM_USERNAME`, `ASM_PASSWORD` — ShelterManager API credentials (server-side only)
