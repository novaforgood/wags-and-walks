# Role-Based Authorization — Design Spec

**Date:** 2026-05-08
**Status:** Approved

## Problem

The portal currently allows anyone with a Firebase account to sign up and access all data. Wags & Walks foster data is private; access must be restricted to users explicitly approved by an admin.

## Goal

- Only users added by an admin can log in and access the portal.
- Admins can add and remove users through a UI without a code deployment.
- Two roles: `admin` (can manage users) and `user` (read-only access to the portal).

## Data Model

Firestore collection: `allowedUsers`
Document ID: lowercased user email

```
allowedUsers/{email}
  ├── email: string
  ├── role: 'admin' | 'user'
  ├── addedAt: Timestamp
  └── addedBy: string   // email of the admin who added them
```

## Auth Flow

1. User submits email + password → Firebase Auth validates credentials (unchanged).
2. `AuthProvider.signIn()` reads `allowedUsers/{email}` from Firestore immediately after.
3. If no doc exists → sign user back out, surface error: `"You don't have access to this portal. Contact an admin."`
4. If doc exists → store `role` in context, redirect to `/overview`.

`AuthProvider` context gains: `role: 'admin' | 'user' | null` (`null` while loading or signed out).

## Components & Pages Changed

### Existing files

| File | Change |
|---|---|
| `firebase.js` | Add `getFirestore` export |
| `app/components/AuthProvider.tsx` | Post-login Firestore check; `role` in context |
| `app/components/ProtectedRoute.tsx` | Add `AdminRoute` variant — redirects non-admins to `/overview` |
| `app/login/page.tsx` | Remove "Sign Up here" link |
| `app/signup/page.tsx` | Check allowlist before `createUserWithEmailAndPassword`; block if email not found |

### New files

| File | Purpose |
|---|---|
| `app/admin/users/page.tsx` | User management UI (admin only, wrapped in `AdminRoute`) |
| `app/api/admin/seed/route.ts` | One-time bootstrap: creates first admin doc if none exist |

### Admin users page (`/admin/users`)

- Table: email · role · added by · date added
- "Add user" form: email input + role dropdown (`admin` / `user`) → writes to Firestore
- Remove button per row → deletes the Firestore doc (does not delete the Firebase Auth account)
- Nav link in sidebar visible only when `role === 'admin'`
- Uses `candidates/candidates.module.css` layout shell (same as all other pages)

## Bootstrap

Call `POST /api/admin/seed` with body `{ "email": "<admin-email>", "role": "admin" }` once to seed the first admin. The route is a no-op if any admin doc already exists — safe to leave deployed.

## Firestore Security Rules

Set in Firebase console:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /allowedUsers/{email} {
      allow read: if request.auth != null && request.auth.token.email == email;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/allowedUsers/$(request.auth.token.email)).data.role == 'admin';
    }
  }
}
```

## Out of Scope (this PR)

- Password invite / reset email flow for new users
- Deleting the Firebase Auth account when removing a user from the allowlist
- Remember Me functionality (existing TODO)
