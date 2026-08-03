# Supabase Configuration

## Authentication
- Users authenticate via OTP magic links.
- Access is strictly limited to email addresses ending in `@saschina.org`.

## Database
- Stores user cloud preferences and saved states.
- Ensure Row Level Security (RLS) is applied to all tables to prevent cross-user data leakage.
