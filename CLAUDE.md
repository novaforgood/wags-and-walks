# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wags and Walks is an internal admin dashboard for a dog foster/rescue nonprofit. It manages foster applicants through a pipeline: new applicants are triaged, flagged for red flags, approved, and tracked as active fosters. The backend data source is Google Sheets, accessed via a Google Apps Script proxy.

## Commands

- `npm run dev` — Start Next.js dev server
- `npm run build` — Production build
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
- `/fosters` — Active fosters list (status = `current`)
- `/applicants/[email]` — Individual applicant detail

### Shared Components

- `PersonModal` — Detail modal for viewing full applicant info
- `FilterDropdown` — Multi-category filter dropdown (living situation, experience, children, dog types, pet history)

### Styling

CSS Modules throughout (`*.module.css`). Global styles in `app/globals.css`. Font: Inter (loaded via Google Fonts in layout).

### Path Aliases

`@/*` maps to project root (e.g., `@/app/lib/peopleTypes`).

### Environment Variables

Defined in `.env.local`:
- `APPS_SCRIPT_URL` — Google Apps Script deployment URL (the main data API)
- `APPS_SCRIPT_KEY` — Auth key for the Apps Script
