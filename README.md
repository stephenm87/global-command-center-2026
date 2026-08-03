# Global Command Center 2026

Global Command Center 2026 is an educational web application tailored for IB Global Politics. It provides an interactive 3D globe and a 2D intelligence map to visualize global relations, political forecasts, and AI-powered news intelligence.

## Features
- **3D Interactive Globe**: Visualizes global political forecasts using Globe.gl and Three.js.
- **2D Intelligence Map**: An interactive workspace for analyzing global events.
- **Global Relations Nexus**: A force-directed graph illustrating connections between countries, concepts, and events.
- **AI-Powered Intelligence**: Summaries and news aggregation leveraging Gemini, Serper, and GNews.
- **Deep Scan**: Advanced web scraping powered by Firecrawl.
- **Teacher Guide**: A standalone HTML reference guide for educators.
- **Supabase Authentication**: Secure access restricted to `@saschina.org` using OTP magic links.

## Tech Stack
- Vite 5, React 18, Node.js 22.x
- Three.js, Globe.gl
- Supabase (Auth + DB)
- Netlify Functions (Serverless backend)

## Local Development
1. Clone the repository.
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`
4. Build for production: `npm run build`

## Environment Variables
See `docs/ENVIRONMENT.md` for required environment variables.
