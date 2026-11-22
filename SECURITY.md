# Security Policy

## Supported Versions
- Main branch

## Reporting a Vulnerability
Please do not report security vulnerabilities through public GitHub issues. Instead, contact the repository owner or open a confidential security advisory.

- Provider-backed functions (`ai-summary.mjs`, `deep-scan.mjs`, `fetch-news.mjs`) require an authenticated Supabase user (`5s` auth validation timeout, optional server-side sign-in allow-list checked against Supabase `/auth/v1/user` email via `ALLOWED_SIGNIN_EMAILS` / `ALLOWED_SIGNIN_DOMAINS`, cached rejection of repeated invalid tokens, pre-parse request body size caps returning `413`, deploy-context-isolated Netlify Blobs per-user/IP rate limits and global UTC daily caps counted before provider calls and failing closed on `429`/`503`, and `Cache-Control: private, no-store`). User emails are never logged by server functions.
- Outbound URL extraction (`deep-scan.mjs`) allows only one URL per request, normalizes `http:` links to `https:` on standard ports, rejects embedded credentials, non-standard ports, private/loopback/link-local/CGNAT/NAT64 IP literals, and wildcard rebinding suffixes, and performs a best-effort DNS pre-check (`1.5s` timeout) before delegating retrieval to Firecrawl (note Firecrawl resolves DNS independently on its own infrastructure).
- Production `Content-Security-Policy` restricts `script-src` to `'self'` (without `'unsafe-inline'` or `'unsafe-eval'`) and scopes function CORS to approved and deploy-preview origins.
- Paid provider API keys (`GEMINI_API_KEY`, `FIRECRAWL_API_KEY`, `SERPER_API_KEY`, `GOOGLE_NL_API_KEY`) are restricted to Netlify Functions runtime only (excluded from builds), never committed to the repository, and Google API keys are sent in headers (`x-goog-api-key` / `X-Goog-Api-Key`) rather than URL query parameters. Error responses and server logs never echo raw upstream provider error bodies, keys, or request headers.
- Use `VITE_` prefix ONLY for safe-to-expose client keys.
