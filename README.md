# wags and walks

## Local setup

1. Copy `.env.example` to `.env.local` and fill in the app's Firebase/upstream values.
2. Add Firebase Admin credentials for protected API routes:

   - Recommended local option: download a Firebase service account JSON file, save it as `firebase-admin.local.json`, and set `FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-admin.local.json`.
   - Alternative local option: run `node scripts/sync-firebase-env-local.mjs path/to/service-account.json` to write `FIREBASE_SERVICE_ACCOUNT_JSON` into `.env.local`.
   - Production/Vercel option: set `FIREBASE_SERVICE_ACCOUNT_JSON` to the full service account JSON value in the deployment environment.

3. Restart `npm run dev` after changing `.env.local`.

The protected APIs intentionally return `503` with “Firebase Admin is not configured” when these Admin credentials are missing. That keeps deployed API routes from silently becoming public.

## Deployment

Before deploying, confirm Vercel has these required environment variables:

- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `NEXT_PUBLIC_FIREBASE_*`
- `APPS_SCRIPT_URL`
- `TASK_SCRIPT_URL`
- `GOOGLE_GROUPS_SCRIPT_URL`
- `ASM_*`
- `CRON_SECRET`

Run `npm run lint` and `npm run build` before shipping.

## initial repo setup
