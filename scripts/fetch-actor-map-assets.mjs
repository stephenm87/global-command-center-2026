#!/usr/bin/env node
/**
 * Fetches public-domain NASA Blue Marble GIBS WMS textures (pre-graded to the
 * dark command-center palette) and Natural Earth 1:50m TopoJSON country borders
 * into public/assets/actor-map/ for self-hosted, CSP-compliant serving.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(REPO_ROOT, 'public/assets/actor-map');
const WMS_BASE = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';
const WORLD_ATLAS_50M_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json';

const TEXTURES = [
    {
        file: 'blue-marble-base.jpg',
        bbox: [-180, -90, 180, 90],
        width: 4096,
        height: 2048,
        quality: 80,
    },
    {
        file: 'myanmar-region.jpg',
        bbox: [84, -12, 132, 34],
        width: 2400,
        height: 2300,
        quality: 80,
    },
    {
        file: 'myanmar-local.jpg',
        bbox: [90, 9, 103, 29],
        width: 1950,
        height: 3000,
        quality: 78,
    },
    {
        file: 'somaliland-region.jpg',
        bbox: [20, -12, 62, 36],
        width: 2100,
        height: 2400,
        quality: 80,
    },
    {
        file: 'somaliland-local.jpg',
        bbox: [38, 0, 53, 15],
        width: 2400,
        height: 2400,
        quality: 78,
    },
];

// Matches the mockup's Canvas 2D compositing pass byte-for-byte:
// 1. drawImage(img)
// 2. globalCompositeOperation = 'overlay', globalAlpha = 0.6, drawImage(img)
// 3. globalCompositeOperation = 'multiply', fillStyle = '#a5c2cf', fillRect()
const PYTHON_GRADE_SCRIPT = `
import sys
from PIL import Image

raw_path, out_path, quality = sys.argv[1], sys.argv[2], int(sys.argv[3])
tint = (165 / 255.0, 194 / 255.0, 207 / 255.0)
luts = []
for ch in range(3):
    t_ch = tint[ch]
    lut = []
    for i in range(256):
        c = i / 255.0
        ov = 2.0 * c * c if c < 0.5 else 1.0 - 2.0 * (1.0 - c) * (1.0 - c)
        step1 = 0.4 * c + 0.6 * ov
        step2 = min(255, max(0, round(step1 * t_ch * 255.0)))
        lut.append(step2)
    luts.extend(lut)

with Image.open(raw_path) as im:
    rgb = im.convert('RGB')
    graded = rgb.point(luts)
    graded.save(out_path, format='JPEG', quality=quality, optimize=True, progressive=True)
    webp_out = out_path[:-4] + '.webp' if out_path.endswith('.jpg') else out_path + '.webp'
    graded.save(webp_out, format='WEBP', quality=max(70, quality - 6), method=6)
`;

async function downloadBuffer(url) {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} fetching ${url}`);
    }
    const contentType = res.headers.get('content-type') || '';
    const buf = Buffer.from(await res.arrayBuffer());
    return { buf, contentType };
}

function buildWmsUrl({ bbox, width, height }) {
    const params = new URLSearchParams({
        SERVICE: 'WMS',
        REQUEST: 'GetMap',
        LAYERS: 'BlueMarble_ShadedRelief_Bathymetry',
        VERSION: '1.1.1',
        STYLES: '',
        FORMAT: 'image/jpeg',
        SRS: 'EPSG:4326',
        BBOX: bbox.join(','),
        WIDTH: String(width),
        HEIGHT: String(height),
    });
    return `${WMS_BASE}?${params.toString()}`;
}

async function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    for (const spec of TEXTURES) {
        if (Math.max(spec.width, spec.height) > 4096) {
            throw new RangeError(`${spec.file} exceeds 4096px max dimension`);
        }
        const url = buildWmsUrl(spec);
        console.log(`Fetching ${spec.file} (${spec.width}x${spec.height})...`);
        const { buf, contentType } = await downloadBuffer(url);
        if (!contentType.includes('image/jpeg') || buf.length < 5000) {
            throw new Error(`Unexpected response for ${spec.file}: ${contentType}, ${buf.length} bytes`);
        }
        const tmpRaw = path.join(OUT_DIR, `.raw-${spec.file}`);
        const outPath = path.join(OUT_DIR, spec.file);
        fs.writeFileSync(tmpRaw, buf);
        try {
            execFileSync('python3', ['-c', PYTHON_GRADE_SCRIPT, tmpRaw, outPath, String(spec.quality)], { stdio: 'inherit' });
        } finally {
            if (fs.existsSync(tmpRaw)) fs.unlinkSync(tmpRaw);
        }
        const stat = fs.statSync(outPath);
        console.log(`  Saved ${spec.file}: ${Math.round(stat.size / 1024)} KB`);
    }

    console.log('Fetching countries-50m.json...');
    const { buf: topoBuf } = await downloadBuffer(WORLD_ATLAS_50M_URL);
    const topo = JSON.parse(topoBuf.toString('utf8'));
    if (!topo?.objects?.countries?.geometries?.length) {
        throw new Error('Invalid countries-50m.json structure');
    }
    const topoPath = path.join(OUT_DIR, 'countries-50m.json');
    fs.writeFileSync(topoPath, `${JSON.stringify(topo)}\n`);
    console.log(`  Saved countries-50m.json: ${topo.objects.countries.geometries.length} countries (${Math.round(fs.statSync(topoPath).size / 1024)} KB)`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
