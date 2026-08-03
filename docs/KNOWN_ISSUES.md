# Known Issues

1. **Deep Scan UI**: The Deep Scan backend (Firecrawl) is functional but has no user-interface path to trigger it.
2. **Anonymous State**: Anonymous graph state has no local persistence (refreshing loses data).
3. **AI Validation**: AI Summary accepts title-only input without validation, leading to poor results.
4. **GDELT Reliability**: Upstream GDELT integration has reliability concerns.
5. **Rate Limiting**: Public Netlify functions are missing rate limiting and abuse protection.
6. **Email Verification**: Magic-link email delivery needs verification.
7. **Supabase RLS**: Row Level Security (RLS) policies in Supabase need verification and tightening.
