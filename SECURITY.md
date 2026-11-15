# Security Policy

## Supported Versions
- Main branch

## Reporting a Vulnerability
Please do not report security vulnerabilities through public GitHub issues. Instead, contact the repository owner or open a confidential security advisory.

- Provider-backed functions require an authenticated Supabase user (`5s` auth validation timeout, cached rejection of repeated invalid tokens, per-endpoint user rate-limit buckets, classroom-safe shared-IP ceilings, and `Cache-Control: private, no-store`).
- Outbound URL extraction (`deep-scan.js`) normalizes `http:` links to `https:` on standard ports, rejects embedded credentials, non-standard ports, private/loopback/link-local/CGNAT/NAT64 IP literals, and wildcard rebinding suffixes, and performs a best-effort DNS pre-check (`1.5s` timeout) before delegating retrieval to Firecrawl (note Firecrawl resolves DNS independently on its own infrastructure).
- Production `Content-Security-Policy` restricts `script-src` to `'self'` (without `'unsafe-inline'` or `'unsafe-eval'`) and scopes function CORS to approved and deploy-preview origins.
- No secrets should ever be committed to the repository, and Google API keys must be sent in headers (`x-goog-api-key`) rather than URL query parameters.
- Use `VITE_` prefix ONLY for safe-to-expose client keys.
