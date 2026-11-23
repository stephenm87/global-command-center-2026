# Global Command Center 2026

Global Command Center 2026 is an educational web application tailored for IB Global Politics. It combines an interactive 3D globe, source-aware case studies, and guided briefings for exploring global politics without treating editorial interpretation as live intelligence.

## Features
- **3D Interactive Globe**: Visualizes global political forecasts using Globe.gl and Three.js.
- **Multi-Perspective Case Library**: 29 dated editorial cases—nine original cases plus 20 new cases—with exactly three core readings apiece: one local, one institutional, and one independent perspective.
- **Searchable Guided Briefings**: Four- or five-step learning paths with text search, region and issue filters, attributed evidence, uncertainty, review dates, source links, and discussion questions.
- **Editorial Cases Globe Layer**: A dedicated toggle maps the case library separately from provider intelligence. Regional and global cases can use multiple representative locations instead of a misleading single pin.
- **AI-Powered Intelligence**: Authenticated summaries and custom topic search via Gemini, Firecrawl, and Serper, guarded by durable rate limits, daily spend caps, and optional sign-in allow-lists.
- **Balanced Current-Intelligence Feed**: Anonymous cached updates are selected across seven regions and six issue lenses with publisher and repeated-event limits, transparent source roles, and visible selection provenance.
- **Deep Scan**: Advanced web scraping powered by Firecrawl.
- **Teacher Guide**: A standalone HTML reference guide for educators.
- **Supabase Authentication**: Passwordless access using OTP magic links.

## Tech Stack
- Vite 5, React 18, Node.js 22.x
- Three.js, Globe.gl
- Supabase (Auth + DB)
- Netlify Functions (Serverless backend)

## Local Development
1. Clone the repository.
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`
4. Run the automated checks: `npm test`
5. Build for production: `npm run build`

The primary routes are URL-addressable: `?view=globe` and `?view=briefings&tour=<case-id>&step=<number>` (legacy `?view=nexus` links open Guided Briefings).

Case records include coverage, sensitivity, map-location, review-cadence, and `reviewBy` metadata. These dates are manual editorial checkpoints, not proof of automatic source revalidation. See [Case Study Editorial Standard](docs/CASE_STUDY_EDITORIAL_STANDARD.md).

## Environment Variables
See `docs/ENVIRONMENT.md` for required environment variables.
