# Current State

> Snapshot of where the build stands right now. Updated at the end of every phase.

- **Last completed phase:** Phase 1 — Branding, navigation & route skeletons (complete)
- **Branch:** `feat/bh-clearinghouse-mvp`
- **Baseline commit:** `37def9c20b01a3514cf69b5b3383bef3e5ffbcb9`
- **App state:** Rebranded to "BH Clearinghouse Simulator" (`apps/web/.env` public strings). Nine protected customer route skeletons under `app/home/(customer)/*` (dashboard, claims, claim-batches, remittances, payers, documents, support, users, audit), plus protected `/support` and `/admin` portal skeletons, all rendering a shared `PlaceholderNotice`. Nav config (`config/navigation.config.tsx`) lists all nine customer routes under a "Clearinghouse" group. `middleware.ts` guards `/support` and `/admin` with the same `requireAuthHandler` as `/home` (temporary — Phase 2 replaces this with org-membership + role checks). No database schema changes; still the single `accounts` table from baseline. No organizations, RBAC, claims, payers, or EDI domain logic exists yet.
- **Next phase:** Phase 2 — Organizations, memberships, roles & RLS (not started; do not start until this phase's evidence is reviewed)
