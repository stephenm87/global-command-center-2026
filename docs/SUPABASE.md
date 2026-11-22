# Supabase Configuration

## Authentication
- Users authenticate via OTP magic links (`supabase.auth.signInWithOtp` in `src/AuthModal.jsx`). Self-service account creation is closed in the client (`shouldCreateUser: false`); only existing/invited users can receive a magic link.
- To onboard a new student or teacher, create or invite their account from the Supabase Dashboard (**Authentication -> Users -> Invite user** or **Add user**), and ensure custom SMTP is configured for external recipients (`email_address_not_authorized` displays a dedicated refusal prompt).
- Configure Supabase **Authentication -> URL Configuration**:
  - **Site URL**: `https://globalcommandcenter2026.netlify.app`
  - **Redirect URLs**: `https://globalcommandcenter2026.netlify.app/**`, `https://deploy-preview-*--globalcommandcenter2026.netlify.app/**`, `http://localhost:5173/**`, `http://localhost:8888/**`
- `src/AuthModal.jsx` strips stale hash fragments from `emailRedirectTo` and detects `#error_code=otp_expired` on return so expired links display a clear recovery prompt.
- `src/supabase.js` validates `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (rejecting `.env.example` placeholder strings) and falls back to an offline stub when unconfigured.

## Database & Row Level Security (`public.user_data`)
- Stores per-user cloud preferences under `(user_id, key)` with `key = 'gcc-preferences'`.
- Hydration uses `.maybeSingle()` so first-time users with zero saved rows receive `{ data: null }` (`200 OK`) instead of PostgREST `406 Not Acceptable`.
- Writes to `localStorage` happen immediately while `supabase.from('user_data').upsert(..., { onConflict: 'user_id,key' })` is debounced by `400ms` so slider interactions do not flood PostgREST.
- Apply and verify the versioned RLS migration in [`supabase/migrations/20261116000000_user_data_rls.sql`](../supabase/migrations/20261116000000_user_data_rls.sql) via the Supabase SQL Editor or `supabase db push`:
  - Applies safely inside a single transaction to both fresh schemas and the live `(id)` primary-key schema with `UNIQUE (user_id, key)`.
  - Validates key length (`1..128` chars) and `1 MB` JSONB size ceiling (`octet_length(value::text) <= 1048576`, accommodating larger student saves on `public.user_data`, which is shared by Global Command Center, GloPo Companion (`glopo-practice-lab`, etc.), and AHSAS (`ahsas_research_studio`, etc.)), attaches `trg_user_data_updated_at`, enables and forces Row Level Security (`enable row level security` + `force row level security`), atomically replaces legacy `public`-role policies with `authenticated`-role `SELECT`, `INSERT`, `UPDATE`, and `DELETE` policies restricted to `(select auth.uid()) = user_id`, and revokes anonymous writes while preserving `anon` `SELECT` (returning `0` rows under RLS for the daily keep-alive). If re-applying on a non-production database that already ran the earlier 64 KB check, drop `user_data_value_size_check` before re-running.
- **Production status (`2026-11-21T04:15:00Z`):** `supabase/migrations/20261116000000_user_data_rls.sql` was applied to production on `2026-11-21` at `04:15 UTC` by Claude at the owner's request. Verified live state: RLS enabled and forced; four policies (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) all scoped to role `authenticated`; both new `CHECK` constraints (`user_data_key_length_check` and `user_data_value_size_check`) valid; `trg_user_data_updated_at` trigger present; `anon` holds `SELECT` only with `0` rows in `public.user_data`; the keep-alive `GET` request returns HTTP `200` with `[]`; and a signed-out `INSERT` returns HTTP `401`.
- Note: Only `public.user_data` is queried or written by this site; any other tables in the same Supabase project are unrelated and left untouched.

## Daily Keep-Alive (Preventing Free-Tier Inactivity Pauses)
- Free Supabase projects pause automatically after 7 days without database activity.
- The daily scheduled Netlify function `netlify/functions/refresh-source-health.mjs` (`17 3 * * *` UTC in `netlify.toml`) runs `pingSupabaseKeepAlive()` alongside the link-health check.
- It sends one lightweight, read-only `GET /rest/v1/user_data?select=key&limit=1` request authenticated only with `SUPABASE_PUBLISHABLE_KEY` (falling back to `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_ANON_KEY`).
- With Row Level Security enabled on `public.user_data`, the anonymous ping returns `200 OK` with an empty array (`[]`), exposes zero user rows, never logs credentials, and counts as daily database activity so the free project stays active.
- If Supabase is unconfigured or temporarily unreachable, the keep-alive times out after `5s` and logs a sanitized warning without affecting the source-health refresh.
