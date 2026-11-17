# Supabase Configuration

## Authentication
- Users authenticate via OTP magic links (`supabase.auth.signInWithOtp` in `src/AuthModal.jsx`).
- Any valid email address may request a magic link, subject to the configured Supabase Auth policies.
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
  - Enforces primary key `(user_id, key)` and a `64 KB` JSONB size ceiling (`octet_length(value::text) <= 65536`).
  - Enables and forces Row Level Security (`enable row level security` + `force row level security`) with `SELECT`, `INSERT`, `UPDATE`, and `DELETE` policies restricted to `(select auth.uid()) = user_id`.
