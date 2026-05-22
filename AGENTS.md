# Repository Guidelines

## Project Structure & Module Organization

This is a Next.js App Router project. Pages live in `app/`, with API handlers under `app/api/**/route.ts`. Reusable React components are in `app/components/`, domain helpers and Firebase utilities are in `app/lib/`, and scoped styles sit beside pages or components as `*.module.css`. Static assets are in `public/assets/`. Google Apps Script integrations live in `appscript/`, scripts in `scripts/`, and planning notes in `docs/` plus root note files.

## Build, Test, and Development Commands

- `npm run dev`: start the local Next.js development server.
- `npm run build`: create a production build and run Next.js compile checks.
- `npm run start`: serve the production build locally after `npm run build`.
- `npm run lint`: run ESLint across `.js`, `.jsx`, `.ts`, and `.tsx` files.

Run `npm install` after pulling dependency changes. Keep `package-lock.json` committed when dependencies change.

## Coding Style & Naming Conventions

Use TypeScript for new app code and keep `strict` compatibility. Components use PascalCase names, such as `DashboardShell.tsx`; hooks and helpers use camelCase, such as `formatRelativeTime.ts`. API route directories should describe the resource, for example `app/api/fosters/route.ts`. Prefer the `@/` path alias over long relative imports. Existing code uses two-space indentation, single quotes, and no semicolons; match that style. Use CSS modules for scoped styles and `app/globals.css` only for global rules.

## Testing Guidelines

There is currently no first-party test runner configured. Before opening a PR, run `npm run lint` and `npm run build`. If adding tests, colocate them near the feature or place them under a future `tests/` directory, with names like `fosterDirectory.test.ts` or `ApplicantSlideOver.test.tsx`. Cover Firebase/admin helpers and API routes when changing data access, auth, or external integrations.

## Commit & Pull Request Guidelines

Recent commits use short, lower-case summaries such as `fix profile ui` and `ui changes`. Keep messages concise and focused on one change. Pull requests should include a brief description, affected routes or APIs, verification steps, and screenshots for visible UI changes. Link related issues or task notes when available. Call out required environment variables, Firebase rule changes, Apps Script updates, or Vercel config changes.

## Security & Configuration Tips

Do not commit secrets, service account JSON, or local `.env*` files. Firebase client configuration belongs in the existing Firebase modules, while server-only credentials should remain behind API routes or admin helpers. Treat `scripts/` and `appscript/` changes as operational: document how they are run and what data they touch.
