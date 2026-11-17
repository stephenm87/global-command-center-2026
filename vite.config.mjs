import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function localNetlifyFunctionStubs() {
    return {
        name: 'gcc-local-netlify-function-stubs',
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                const urlPath = (req.url || '').split('?')[0];
                if (urlPath === '/.netlify/functions/public-intel') {
                    const { buildMineralBaseline } = require('./netlify/functions/_shared/intel-snapshot.js');
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({
                        items: [],
                        minerals: buildMineralBaseline(),
                        meta: {
                            generatedAt: new Date().toISOString(),
                            sourceMode: 'public-cache',
                            status: 'not-configured',
                            provider: 'Serper',
                            queryPolicy: 'fixed-editorial',
                            liveItemCount: 0,
                        },
                    }));
                    return;
                }
                if (urlPath === '/.netlify/functions/source-health') {
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ status: 'pending', results: [], summary: null }));
                    return;
                }
                if (urlPath === '/.netlify/functions/gdelt-pulse') {
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ articles: [], status: 'local-dev' }));
                    return;
                }
                next();
            });
        },
    };
}

export default defineConfig({
    plugins: [react(), localNetlifyFunctionStubs()],
    build: {
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'index.html'),
                teacherGuide: path.resolve(__dirname, 'teacher-guide.html'),
            },
            output: {
                manualChunks(id) {
                    if (id.includes('/src/caseStudies') || id.includes('/src/cases/')) {
                        return 'case-studies';
                    }
                    if (process.env.VITE_SUPABASE_URL && id.includes('node_modules/@supabase/')) {
                        return 'supabase';
                    }
                    return undefined;
                },
            },
        },
    },
    server: {
        host: '127.0.0.1',
        cors: {
            origin: /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
        },
    },
    preview: {
        host: '127.0.0.1',
    },
});
