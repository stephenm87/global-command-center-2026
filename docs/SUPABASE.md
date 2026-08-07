# Supabase Configuration

## Authentication
- Users authenticate via OTP magic links.
- Any valid email address may request a magic link, subject to the configured Supabase Auth policies.

## Database
- Stores user cloud preferences and saved states.
- Ensure Row Level Security (RLS) is applied to all tables to prevent cross-user data leakage.
