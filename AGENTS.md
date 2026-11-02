# Project: Digital Shift Handover & Operation Logbook

PWA for shift handovers with an Indonesian UI. Operators submit handovers; supervisors approve, reject, or reopen them. The acknowledgement step and photo uploads were removed.

## Commands

- `npm run dev` — dev server at localhost:3000
- `npm run build` — production build
- `npm run start` — serve production build
- `npm run lint` — ESLint v9 flat config (`eslint.config.mjs`)
- `npx tsc --noEmit` — typecheck (no script exists)

No tests, CI, or pre-commit hooks. `npm run lint` currently fails on a pre-existing `react-hooks/set-state-in-effect` error at `src/app/(dashboard)/reports/print/page.tsx:52`; typecheck passes.

## Architecture

- Next.js 16 App Router + React 19, TypeScript strict, alias `@/*` → `src/*`.
- `src/app/(dashboard)/` route group adds the shared `Header` and realtime toasts; auth pages sit outside it.
- `src/middleware.ts` enforces auth and role access: operators are redirected away from `/dashboard`, `/powerbi`, and `/settings`, but may open `/reports` (RLS limits them to their own handovers). Authenticated visits to `/login` go to `/dashboard` (supervisor) or `/handover` (operator); the login form itself pushes `/dashboard`, where the server page redirects operators.
- Almost every page is a client component querying Supabase directly via `@/lib/supabase/client`. Only `dashboard/page.tsx` is a server component (`@/lib/supabase/server`). The only Route Handler is `/api/powerbi/download` for the supervisor-only `.pbix` download; do not introduce an API layer for existing flows.
- Auth uses `@supabase/ssr`; middleware refreshes cookies. `.env.local` needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (gitignored).
- Roles live in `profiles.role` (`operator` | `supervisor`); there is no `users` table in app code.
- UI primitives are hand-written shadcn-style components in `src/components/ui` (no `components.json` or Radix). Tailwind v4 uses CSS variables in `globals.css`; there is no `tailwind.config.*`. Use `cn` from `@/lib/utils`.
- `ResponsiveScale` + print CSS keep fixed-width forms readable on mobile and printable. The reports print page auto-triggers `window.print()`; the handover print page only does so with `?auto=true`.
- PWA uses `public/manifest.json`, `public/sw.js`, and `public/offline.html`. The service worker is registered in production only, caches static assets, and serves an offline fallback for navigation; API/auth/Supabase requests are never cached.
- Power BI reporting layer: schema `reporting` (9 fact + 12 dimension views) + read-only role `powerbi_reader`; see `docs/integrasi-power-bi.md`. Ready-to-open PBIP/TMDL project is in `powerbi/` (3 pages, 35 visuals, 41 measures). Supervisors download `ShiftHandover.pbix` from Supabase Storage private bucket `powerbi` via `/powerbi`; no binary is committed. Never grant `powerbi_reader` access to `public` tables.

## Data model

- `handovers`: unique `form_number` (`SH-YYYYMMDD-NNN`, random 3-digit suffix), `status` in `draft | submitted | approved | rejected | reopened`, plus `operational_data` JSONB.
- All operational payload (tank levels, QC, critical equipment, safety tools, transfer requests, teams) lives inside `handovers.operational_data`; types are in `src/lib/handover-types.ts`. The `handover_*` child tables in migrations are legacy and unused by the app.
- `tank_products` (migration 11) maps `no_tanki` → `produk`; create/edit forms load active rows and auto-fill product when a tank number is selected.
- `handover_activities` stores activity rows; sub-items are flattened into `deskripsi` joined by `". "` and re-split on edit/print. `waktu` is optional (migration 12).
- `approvals` gets a row on approve/reject. `outstanding_jobs` is only read by the dashboard. `audit_trail` is written by a DB trigger on `handovers` (migration 10), not app code.
- Approval writes set `status` and `approved_at` (also for rejected). Reopen sets `reopened` + `reopened_at`.

## Business rules and gotchas

- **Submit gate**: the create form blocks submit while any handover has status `submitted`, `rejected`, or `reopened` (latest by `created_at`, not filtered by operator). The edit form uses the same check but excludes the current row. Draft save is always allowed. This is UI-only; preserve the query semantics if refactoring.
- The detail page shows Edit for `draft` and `reopened` (owner or supervisor). Operators can update their own `draft`/`reopened` handovers; submitted/approved/rejected rows must be reopened by a supervisor first (migration 13).
- Approved handovers cannot be deleted. Operators may delete their own drafts; supervisors may delete any non-approved handover.
- Migrations are manual SQL files in `supabase/migrations/NN_*.sql` (no CLI config, no codegen). Apply in numeric order. Do not re-run `01`–`09` after `10`: early migrations create permissive RLS (`USING (true)`) and `10_security_rls_audit_indexes.sql` is the security fix.
- Migration 10 revokes anon SELECT on `handover_sync` and sets `security_invoker = true`, so the Google Sheets sync in `scripts/sheets-sync/` no longer works as documented. Treat that script as stale; current architecture is documented in `docs/arsitektur-dan-alur-sistem.md`.
- Form numbers can collide despite the unique index; duplicates surface as Supabase insert errors.
- User-facing copy is Indonesian; keep new labels and messages consistent with that.

## Conventions

- Mutations happen in client components; after success use `useToast`, and use `useConfirm` for destructive actions.
- Icons come from `lucide-react`; dates are usually formatted with native `toLocaleDateString("id-ID")` even though `date-fns` is installed.
