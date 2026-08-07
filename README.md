# Global Command Center 2026

Global Command Center 2026 is an educational web application tailored for IB Global Politics. It combines an interactive globe, source-aware case studies, guided briefings, and a progressively disclosed Relations Nexus for exploring global politics without treating editorial interpretation as live intelligence.

## Features
- **3D Interactive Globe**: Visualizes global political forecasts using Globe.gl and Three.js.
- **Verified Case Studies**: Nine dated, official-source case records spanning Africa, Asia-Pacific, the Middle East, Latin America and the Caribbean, North America, the Pacific, the Arctic, and European AI governance.
- **Guided Briefings**: Four-step learning paths that keep evidence, uncertainty, sources, and discussion questions beside each case.
- **Focus Nexus**: A searchable 2D relationship view with issue lenses and source-linked current cases.
- **Advanced Nexus**: An optional, lazily loaded 3D force graph for users who want the full spatial network.
- **AI-Powered Intelligence**: Summaries and news aggregation leveraging Gemini, Serper, and GNews.
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

The primary routes are URL-addressable: `?view=globe`, `?view=briefings&tour=<case-id>&step=<number>`, and `?view=nexus&actor=<actor-id>`.

## Environment Variables
See `docs/ENVIRONMENT.md` for required environment variables.
