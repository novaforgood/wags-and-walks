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
5. `app/api/foster-history/route.ts` — GET proxy to ASM `json_report` method; returns full foster history for all fosterers or a single one (`?email=`). Uses `ASM_API_KEY` (not username/password)
6. `app/api/fosters/route.ts` — Returns `{ count }` of active foster dogs from ASM (used by overview stats). Uses the same `json_shelter_animals` method as `/api/dogs` but returns only the count.
7. `app/api/tasks/route.ts` — GET proxy to `TASK_SCRIPT_URL`; fetches the task log from Sheet 2 (`action=taskLog`). Returns `{ rows: TaskRow[], taskStatusByAnimalId }` where `taskStatusByAnimalId` maps animal IDs to their worst active `FosterStatus` (used by the fosters directory and overview to show task health badges).
8. `app/api/photo-status/route.ts` — GET proxy to `TASK_SCRIPT_URL` (`action=photoStatus`); returns `{ dogs: PhotoDog[], unassigned: PhotoUnassignedFolder[] }` — per-dog Google Drive folder info and unassigned upload folders. Falls back to empty arrays if `TASK_SCRIPT_URL` is unset.
9. `app/components/PeopleProvider.tsx` — Client-side React context (`usePeople()` hook) that:
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
- `/fosters/overview` — Foster overview dashboard; loads from `/api/dogs` (ASM data), shows task-health stats and a priority follow-up queue ranked by `FosterStatus`. **Not** driven by Google Sheets people data.
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
- `NotesCard` — Foster-tracking notes textarea only. Fetches/saves to `/api/foster-notes` on blur (Sheet 2)
- `EmailComposeTrigger` — Standalone compose control (draggable dialog) that POSTs to `/api/send-email` with `action: 'send_single_email'`. Used beside notes in `PersonModal` and on foster Communication tab
- `FosterHistoryPanel` — Fetches from `/api/foster-history?email=` and renders current/past foster dog tables. Accepts optional `sectionClassName`/`sectionTitleClassName` for styling from the parent context.

> **Sidebar duplication:** There is no shared sidebar component. Each page (`/candidates`, `/fosters/*`, `/overview`) renders its own sidebar JSX inline and imports `candidates/candidates.module.css` for the shared shell classes (`pageWrapper`, `sidebar`, `sidebarNav`, `navItem`, `navItemActive`, `mainContent`, `topBar`). The main nav width is fixed at 208px (`--app-sidebar-width`). When changing sidebar nav items, update all pages.

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

`app/lib/asmDogs.ts` — Shared server-side module used by both `/api/dogs` and `/api/fosters`. Fetches from ASM via `json_shelter_animals`, sanitizes the JSON response (ASM sometimes returns control characters and trailing commas), and filters to foster-movement animals only. Has a **60-second module-level in-memory cache** and in-flight deduplication so concurrent requests on the same server instance share one ASM call. `DogRecord` type is defined here — do not redefine it locally in pages or routes.

`app/api/dogs/route.ts` — Calls `getAsmFosterDogs()` from `asmDogs.ts` and returns the full list as `{ success, dogs }`. Consumed by `/fosters` (directory tab), `/fosters/overview`, and `/directory`.

`app/api/dogs/photo/route.ts` — Server-side proxy for dog images from ASM. Accepts `?animalId=<id>&variant=thumbnail|full`. Uses `animal_thumbnail` or `animal_image` (seq 1) ASM methods. Proxies the binary response directly — avoids exposing ASM credentials to the client.

### Foster Sub-pages

Key lib files:
- `app/lib/fosterDirectory.ts` — Builds `FosterDirectoryItem[]` from ASM dog records; computes `FosterStatus` (Good: <14 days, Needs Review: 14–30 days, Overdue: >30 days). Dogs prefixed with `*fta`, `*ufta`, `*sts`, `*ff`, `*adopting`, or containing `(w/` are hidden via `shouldHideDog()`.
- `app/lib/fosterActions.ts` — Builds `FosterOverviewRow[]` from `current` people in Google Sheets; extracts dog names and derives action statuses (photos, vet records, weekly check-in, orientation) from the sheet's raw column values.
- `app/lib/asmFosterHistory.ts` — Types (`AsmFosterRow`, `FostererHistory`, `FosterDog`), `fetchAsmFosterHistory()` (calls ASM `json_report` method), and `groupFosterHistory()` (groups rows by fosterer ID into current/past lists).

### localStorage Keys

- `people_v2` — Cached array of `Person` objects from last successful fetch
- `pending_status_updates_v1` — Queued status changes not yet flushed to Sheets (survives page refresh)

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
- Current deployment ID: stored in `.env.local` as `APPS_SCRIPT_DEPLOYMENT_ID`
- Called by: `/api/people` (GET rows) and `/api/send-email` (POST mutations)

**Sheet 2 — Foster Tracking** (`appscript/CurrentFoster.gs`, `TaskCheck.gs`, `Code.gs`, `ResetStatuses.gs`)
- Partially called by the Next.js app via `/api/tasks` (task log); other functions run on a schedule inside Apps Script
- Deployment ID: stored in `.env.local` as `FOSTER_SCRIPT_DEPLOYMENT_ID`
- `CurrentFoster.gs` — `syncCurrentFosterDogs()`: pulls current fosters from ASM → writes to "Current Fosters" sheet
- `TaskCheck.gs` — `checkFosterTasks()` (daily trigger at 8am): checks photo/survey task deadlines, queues email reminders, updates "Task Log" sheet. Reads form completions from "Form Responses" sheet. Currently logs only — email sending is disabled during testing. Also exposes `action=taskLog` which `/api/tasks` calls.
- `Code.gs` — `autoOrganizeFormFiles()`: form submit trigger that moves uploaded foster photos into per-dog Google Drive folders
- `ResetStatuses.gs` — `resetAllStatusesToNew()`: bulk-resets all applicant statuses to `new` directly in the sheet (Apps Script side equivalent of `scripts/reset_status.js`)

**Optional — Google Group directory** (`appscript/GoogleGroupMembersWebApp.gs`)
- Reference web app for `GOOGLE_GROUPS_SCRIPT_URL`: lists Workspace group members with `CacheService`, `LockService`, and `Utilities.sleep(1000)` between paginated Admin Directory reads (mitigates “premium groups read” rate limits). Set script property `GROUP_DIRECTORY_EMAIL` to the group address. Merge `handleGroupMembers_` into your deployed project if you already have a `doGet` entrypoint.

Defined in `.env.local`:
- `APPS_SCRIPT_URL` — Sheet 1 web app URL (applicant data API)
- `APPS_SCRIPT_KEY` — Auth key for the Apps Script
- `FOSTER_SCRIPT_URL` — Separate Apps Script URL for foster notes read/write (`/api/foster-notes`)
- `NEXT_PUBLIC_FIREBASE_*` — Firebase configuration (API key, auth domain, project ID, etc.)
- `ASM_BASE_URL`, `ASM_ACCOUNT`, `ASM_USERNAME`, `ASM_PASSWORD` — ShelterManager API credentials used by `/api/dogs` (server-side only)
- `ASM_API_KEY`, `ASM_REPORT_TITLE` — Used by `/api/foster-history` to call the ASM `json_report` method (different auth scheme from dogs route; `ASM_REPORT_TITLE` defaults to `'Foster History API'`)
- `TASK_SCRIPT_URL` — Sheet 2 Apps Script URL used by `/api/tasks` and `/api/photo-status`. If unset, both routes return empty results rather than erroring.
- `GOOGLE_GROUPS_SCRIPT_URL` / optional `GOOGLE_GROUPS_SCRIPT_KEY` — Web app that returns foster Google Group members (`?action=group_members`); proxied by `/api/google-group-members` for the Directory page.
- `GOOGLE_GROUP_MEMBERS_CACHE_TTL_SEC` (optional, default `300`) — Server-side cache for successful group member fetches to avoid hitting Google’s “premium groups read” quota on every page load.
- `GOOGLE_GROUP_MEMBERS_ERROR_CACHE_SEC` (optional, default `45`) — Short cache after upstream errors so a failing script is not hammered.
