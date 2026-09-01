# Project: Digital Shift Handover & Operation Logbook System

Progressive Web App for digitizing operational shift handovers. Operators log activities, conditions, outstanding jobs, and notes. The next shift acknowledges, then supervisor approves.

## Stack

- Next.js 16 (App Router) + React 19
- TypeScript strict mode · path alias `@/*` → `./src/*`
- Tailwind CSS v4 (via `@tailwindcss/postcss` — no `tailwind.config.*`)
- Shadcn UI for components
- Supabase (Auth, PostgreSQL, Storage, Realtime)
- ESLint v9 flat config (`eslint.config.mjs`)

## Commands

- `npm run dev` — dev server (localhost:3000)
- `npm run build` — production build
- `npm run start` — start production server
- `npm run lint` — lint with ESLint

No test framework is configured. Verify with `lint` before committing.

## Architecture

### User Roles

| Role | Access |
|------|--------|
| Operator | Create/edit/submit shift forms, upload photos |
| Supervisor | Dashboard, all reports, approvals, exports, reopen forms |

### Approval Flow

```
Operator → Submit → Supervisor → Approval
```

### Key Business Rules

- Forms editable by Operator only before Submit
- After Submit: locked unless Supervisor reopens
- Supervisor can Reject or Approve
- Approved forms cannot be deleted
- All changes tracked in Audit Trail
- **Gate rule**: Operator cannot submit a new handover while the latest handover is not yet approved — submit button disabled + amber banner (form `handover/page.tsx` & edit page check latest `handovers` row by `created_at`, status must be `approved`; draft save still allowed)

### Database Structure

**Master**: users, shifts
**Transaction**: handovers, handover_activities, outstanding_jobs, attachments, approvals

## Supabase

- Credentials in `.env.local` (do not commit)
- Project: `getdgbyxhohfranaceqd.supabase.co`
- Use `@supabase/ssr` for server-side auth/cookies
- Supabase Auth for JWT + Row Level Security

## Key conventions

- Entry point: `src/app/page.tsx`
- `clsx`, `class-variance-authority`, `tailwind-merge` for component styling
- `lucide-react` for icons
- `date-fns` for date utilities
- Next.js Route Handlers + Server Actions for backend logic
- PWA requirements: responsive across desktop, tablet, mobile
