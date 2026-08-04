# Architecture

The application is a Single Page Application (SPA) built with React and bundled via Vite. It communicates with a serverless backend hosted on Netlify Functions and uses Supabase for authentication and user preferences.

## Frontend
- **Framework**: React 18
- **Visualization**: `Globe.gl` and `Three.js` for the 3D globe, D3/Canvas for the 2D Intelligence Map.
- **Entry Points**: `src/main.jsx` and `src/App.jsx`.

## Backend (Netlify Functions)
Located in `netlify/functions`:
- `ai-summary.js`: Uses Gemini API for text summarization.
- `deep-scan.js`: Uses Firecrawl for deep web scraping.
- `fetch-intel.js`: Aggregates intel from Serper, GNews, and Gemini.
- `fetch-news.js`: Retrieves general news.
- `gemini-retry.js`: Utility for handling Gemini API retries.

## Data Layer
- **Supabase**: Handles OTP authentication (restricted to `@saschina.org`) and stores user cloud preferences.
