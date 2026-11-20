import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export const APP_WORKSPACE_FILES = [
    'src/App.jsx',
    'src/navigationState.mjs',
    'src/hooks/useSupabasePreferences.js',
    'src/hooks/useGlobeLayerSync.js',
    'src/components/MineralsModal.jsx',
    'src/components/DetailModal.jsx',
    'src/components/IntelSidebar.jsx',
    'src/components/OperationalDashboard.jsx',
    'src/components/AppFooter.jsx',
];

export const NEXUS_WORKSPACE_FILES = [
    'src/NexusWorkspace.jsx',
    'src/NexusFocusView.jsx',
    'src/nexusFocusData.js',
    'src/nexusEdgeData.js',
    'src/nexus/actorIds.js',
];

export function readAppWorkspaceSource() {
    return APP_WORKSPACE_FILES
        .map(relPath => fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8'))
        .join('\n/* --- MODULE BOUNDARY --- */\n');
}

export function readNexusWorkspaceSource() {
    return NEXUS_WORKSPACE_FILES
        .map(relPath => fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8'))
        .join('\n/* --- MODULE BOUNDARY --- */\n');
}
