# Jay's Current Tasks

## 1. FTA Filtering Logic (Fosters Page)

Filter out dogs that should NOT appear on the fosters page:
- `*FTA` / `*uFTA` / `*adopting` — these dogs are in the adoption process
- `*STS` — Shelter to Shelter (uncommon, but hide from fosters page)
- `(w/name)` — dog is in training (e.g. "Moira (w/Klutch)"), hide everywhere

Keep/show on fosters page:
- Single letter prefix + hyphen (e.g. `n- Nibs`, `a- Rex`) — litter/family grouping only, display normally
- `*poss FF` — possible foster fail; they are still fostering, display normally

### Done
- [x] `*poss FF` dogs no longer hidden — `shouldHideDog()` in `fosterDirectory.ts` now checks for `*poss ff` before the generic `*ff` prefix

### To Do
- [x] Single letter + hyphen prefix dogs (e.g. `n- Nibs`) — confirmed, no filter touches them, display normally

## 2. Foster Tracking Logic

- [ ] Redefine status semantics:
  - **Needs Review** — task overdue, no submission yet
  - **Overdue** — 2x follow-up sent with no response (currently both collapse to the same threshold in `toStatus()`)
- [ ] Track last update type per foster: distinguish **survey submission** vs **photo upload**

## 3. Notes System

### Done
- [x] Notes stored as two columns (`Notes`, `Notes Updated At`) on the existing "Form Responses 1" sheet
- [x] `set_notes` action added to Apps Script (`appscript/WebApp.gs`) — redeployed
- [x] `notes` and `notesUpdatedAt` fields added to `Person` type (`app/lib/peopleTypes.ts`)
- [x] `app/api/people/route.ts` reads both columns from sheet rows
- [x] `PeopleProvider.tsx` — `setNotes(email, content)` added to context, optimistic local update
- [x] Foster detail page (`app/fosters/[fosterId]/page.tsx`) — notes card with textarea, auto-save on blur, "Saving..."/"Saved" indicator, "Last saved" timestamp

### To Do
- [ ] Add a button to send a manual check-in email to a foster
  - Template: `Hey {fostername} checking in on {dog}!`

## 4. Starred / Donor System

### Done
- [x] `starred` field added to `Person` type
- [x] Starring UI wired up on `/candidates` and `/directory` pages (star button, starred-only filter)
- [x] `Starred` column added to Google Sheet
- [x] Apps Script updated with `set_starred` action (`appscript/WebApp.gs`)
- [x] `app/api/people/route.ts` reads `Starred` column from sheet → sets `starred: true/false` on each Person
- [x] `app/components/PeopleProvider.tsx` — `toggleStar` calls `/api/send-email` with `set_starred`, optimistic update with revert on failure; localStorage star storage removed

### To Do
- [ ] Add a separate **Donor** flag column (distinct from the existing `Starred` column)
- [ ] Show donor badge/indicator on `/candidates` page
- [ ] Show donor badge/indicator on `/directory` page

## 5. Auth Gaps

- [ ] `/applicants/[email]` is not wrapped with `ProtectedRoute` — unauthenticated users can access it directly
- [ ] "Remember Me" checkbox on `/login` is UI-only — connect it to Firebase `setPersistence(auth, browserLocalPersistence)`
- [ ] `/signup` page is linked from the login footer but doesn't exist — either build it or remove the link
