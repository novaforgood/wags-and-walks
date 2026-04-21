# Foster Notes — Implementation Plan

A single editable scratchpad per foster. Stored as a column on the existing applicant sheet. No separate tab, no note history — just one text blob and a last-saved timestamp.

---

## Data model

Two new columns added to the "Form Responses 1" sheet (auto-created by `ensureOutputColumns_`):

| Column | Value |
|---|---|
| `Notes` | Plain text, newlines preserved, up to ~50k chars (Google Sheets cell limit) |
| `Notes Updated At` | ISO timestamp written by Apps Script on every save |

Keyed by `Email` — same as every other write action in the system.

---

## Step 1 — Apps Script (`appscript/WebApp.gs`)

Add `set_notes` to the `OUTPUT_HEADERS` config block:

```js
NOTES: "Notes",
NOTES_UPDATED_AT: "Notes Updated At",
```

Add a new action handler inside `doPost`, following the `set_starred` pattern:

```js
if (action === "set_notes") {
  const result = setNotes_(payload.email, payload.content);
  return json_(Object.assign({}, result, { build: CONFIG.BUILD_ID }));
}
```

Add the `setNotes_` helper function:

```js
function setNotes_(email, content) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) return { success: false, error: "Sheet not found" };

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  ensureOutputColumns_(sheet, headers, [
    CONFIG.OUTPUT_HEADERS.NOTES,
    CONFIG.OUTPUT_HEADERS.NOTES_UPDATED_AT,
  ]);

  const freshHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const emailCol = freshHeaders.findIndex(function(h) { return String(h).trim().toLowerCase() === "email"; });
  const notesCol = freshHeaders.findIndex(function(h) { return String(h).trim() === CONFIG.OUTPUT_HEADERS.NOTES; });
  const updatedAtCol = freshHeaders.findIndex(function(h) { return String(h).trim() === CONFIG.OUTPUT_HEADERS.NOTES_UPDATED_AT; });

  if (emailCol === -1 || notesCol === -1 || updatedAtCol === -1)
    return { success: false, error: "Required column not found" };

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { success: false, error: "No data rows" };

  const emailData = sheet.getRange(2, emailCol + 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < emailData.length; i++) {
    if (String(emailData[i][0]).trim().toLowerCase() === String(email).trim().toLowerCase()) {
      sheet.getRange(i + 2, notesCol + 1).setValue(content);
      sheet.getRange(i + 2, updatedAtCol + 1).setValue(new Date());
      return { success: true };
    }
  }
  return { success: false, error: "Email not found" };
}
```

**Deploy note:** After editing `WebApp.gs`, you must redeploy the Apps Script as a new version for changes to take effect.

---

## Step 2 — `app/lib/peopleTypes.ts`

Add two optional fields to the `Person` type:

```ts
notes?: string
notesUpdatedAt?: string
```

---

## Step 3 — `app/api/people/route.ts`

In the row mapping inside `GET`, read the new columns from `raw`:

```ts
notes: String(row['Notes'] || '').trim() || undefined,
notesUpdatedAt: parseTimestampToIso(row['Notes Updated At']),
```

`parseTimestampToIso` is already defined in this file and handles both the Google Sheets date format and ISO strings.

---

## Step 4 — `app/components/PeopleProvider.tsx`

**Add `setNotes` to the context type:**

```ts
setNotes: (email: string, content: string) => Promise<void>
```

**Add the implementation** (no optimistic update needed — the textarea already holds the in-progress value locally):

```ts
const setNotes = useCallback(async (email: string, content: string) => {
  const key = normalizeEmailKey(email)
  if (!key) return

  // Optimistically update local state so the UI reflects the save
  setPeople(prev =>
    prev.map(p => normalizeEmailKey(p.email) === key ? { ...p, notes: content } : p)
  )

  await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'set_notes', email, content })
  })
    .then(res => res.json())
    .then(data => {
      if (!data?.success) console.error('set_notes failed:', data)
    })
    .catch(err => console.error('Failed to save notes:', err))
}, [])
```

Expose `setNotes` in the context value and the `usePeople()` return.

---

## Step 5 — Foster detail page (`app/fosters/[fosterId]/page.tsx`)

**Import `usePeople`:**

```ts
import { usePeople } from '@/app/components/PeopleProvider'
```

**Add local UI state for the save indicator:**

```ts
const { people, setNotes } = usePeople()
const [notesDraft, setNotesDraft] = useState<string | null>(null)
const [notesSaving, setNotesSaving] = useState(false)
const [notesSaved, setNotesSaved] = useState(false)
```

**Cross-reference the foster's email against the people list:**

```ts
const person = useMemo(
  () => people.find(p => p.email?.toLowerCase() === foster?.fosterEmail?.toLowerCase()),
  [people, foster]
)
```

`notesDraft` starts as `null` and is initialized from `person.notes` on first render (so the textarea shows the saved value). On blur, it saves.

**Notes card — add below the dogs table card:**

```tsx
<section className={styles.card}>
  <div className={styles.notesHeader}>
    <h3 className={styles.sectionTitle}>Notes</h3>
    {person?.notesUpdatedAt && (
      <span className={styles.notesLastSaved}>
        Last saved: {formatDateShort(person.notesUpdatedAt)}
      </span>
    )}
    {notesSaving && <span className={styles.notesLastSaved}>Saving...</span>}
    {!notesSaving && notesSaved && <span className={styles.notesLastSaved}>Saved</span>}
  </div>
  <textarea
    className={styles.notesTextarea}
    placeholder="No notes yet..."
    value={notesDraft ?? (person?.notes ?? '')}
    onChange={e => {
      setNotesDraft(e.target.value)
      setNotesSaved(false)
    }}
    onBlur={async () => {
      if (!foster?.fosterEmail || notesDraft === null) return
      setNotesSaving(true)
      await setNotes(foster.fosterEmail, notesDraft)
      setNotesSaving(false)
      setNotesSaved(true)
    }}
  />
</section>
```

---

## Step 6 — CSS (`app/fosters/[fosterId]/page.module.css`)

```css
.notesHeader {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.notesHeader .sectionTitle {
  margin: 0;
}

.notesLastSaved {
  margin-left: auto;
  font-size: 12px;
  color: #9ca3af;
}

.notesTextarea {
  width: 100%;
  min-height: 120px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  box-sizing: border-box;
  color: #1a202c;
  outline: none;
}

.notesTextarea:focus {
  border-color: #05aaaf;
}
```

---

## Build order

1. `WebApp.gs` → redeploy Apps Script
2. `peopleTypes.ts`
3. `app/api/people/route.ts`
4. `PeopleProvider.tsx`
5. `app/fosters/[fosterId]/page.tsx` + `page.module.css`

Each step depends on the one before it. Don't skip the redeploy in step 1 — the Next.js changes won't work until Apps Script accepts the `set_notes` action.

---

## Testing checklist

- [ ] Open a foster's detail page — existing notes (if any) appear in the textarea
- [ ] Type in the textarea, click away — "Saving..." appears then "Saved"
- [ ] Reload the page — notes persist (confirm the value came back from the sheet, not just local state)
- [ ] Open Google Sheet — `Notes` column has the text, `Notes Updated At` has a timestamp
- [ ] Clear the textarea, blur — sheet cell should be empty, not crash
- [ ] Foster with no notes — textarea is empty with placeholder text
