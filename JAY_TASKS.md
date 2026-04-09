# Jay's Current Tasks

## 1. FTA Filtering Logic (Fosters Page)

Filter out dogs that should NOT appear on the fosters page:
- `*FTA` / `*uFTA` / `*adopting` — these dogs are in the adoption process
- `*STS` — Shelter to Soldier (uncommon, but hide from fosters page)
- `(w/name)` — dog is in training (e.g. "Moira (w/Klutch)"), hide everywhere

Keep/show on fosters page:
- Single letter prefix + hyphen (e.g. `n- Nibs`, `a- Rex`) — litter/family grouping only, display normally
- `*poss FF` — possible foster fail; they are still fostering, display normally

## 2. Foster Tracking Logic

Define status distinctions:
- **Needs review** — delinquent (task overdue, no submission yet)
- **Overdue** — 2x follow-up sent with no response

Track last update type per foster:
- Distinguish between **survey submission** vs **photo upload**

## 3. Notes System

- Store and retrieve notes per foster
- Add a button to send a manual check-in email to a foster
  - Template: `Hey {fostername} checking in on {dog}!`

## 4. Starred / Donor System

- Add a "Donor" starred flag column
- Show in `/Applicants` page
- Show in `/Directory` page
