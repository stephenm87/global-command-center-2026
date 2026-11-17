import * as THREE from 'three';
import { getEdgeInfo } from '../nexusEdgeData';
import { escHtml } from '../navigationState.mjs';
import { DIM_COLORS } from './nexusData';

export function disposeThreeHierarchy(root) {
    if (!root || typeof root.traverse !== 'function') return { geometries: 0, materials: 0, textures: 0 };
    let geometries = 0;
    let materials = 0;
    let textures = 0;
    root.traverse(obj => {
        if (obj.geometry && typeof obj.geometry.dispose === 'function') {
            obj.geometry.dispose();
            geometries += 1;
        }
        const matList = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
        matList.forEach(mat => {
            if (mat.map && typeof mat.map.dispose === 'function') {
                mat.map.dispose();
                textures += 1;
            }
            if (typeof mat.dispose === 'function') {
                mat.dispose();
                materials += 1;
            }
        });
    });
    return { geometries, materials, textures };
}

export function createTextSprite(text, color) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const fontSize = 48;
    ctx.font = `bold ${fontSize}px Roboto Mono, monospace`;
    const w = ctx.measureText(text).width + 20;
    canvas.width = w;
    canvas.height = fontSize + 16;
    ctx.font = `bold ${fontSize}px Roboto Mono, monospace`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, (fontSize + 16) / 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(w / 8, (fontSize + 16) / 8, 1);
    return sprite;
}

export function createNexusNodeObject(node, { highlightSet = null, makeSprite = createTextSprite } = {}) {
    const group = new THREE.Group();
    const focused = !highlightSet || highlightSet.has(node.id);

    if (!node.isAnchor) {
        const g = new THREE.SphereGeometry(node.val / 2.2, 16, 16);
        const m = new THREE.MeshBasicMaterial({ color: node.color, transparent: true, opacity: focused ? 0.9 : 0.35 });
        group.add(new THREE.Mesh(g, m));
        return group;
    }

    group.userData = { anchorType: node.type };
    const op = focused ? 0.95 : 0.30;
    if (node.type === 'igo') {
        const g1 = new THREE.DodecahedronGeometry(node.val / 2.4);
        group.add(new THREE.Mesh(g1, new THREE.MeshPhongMaterial({ color: node.color, emissive: node.color, emissiveIntensity: 0.2, transparent: true, opacity: op, wireframe: true })));
        const g2 = new THREE.SphereGeometry(node.val / 4, 16, 16);
        group.add(new THREE.Mesh(g2, new THREE.MeshBasicMaterial({ color: node.color, transparent: true, opacity: op * 0.7 })));
    } else if (node.type === 'mnc') {
        const g1 = new THREE.BoxGeometry(node.val / 2, node.val / 2, node.val / 2);
        const m1 = new THREE.Mesh(g1, new THREE.MeshBasicMaterial({ color: node.color, transparent: true, opacity: op, wireframe: true }));
        m1.rotation.set(Math.PI / 6, Math.PI / 6, 0);
        group.add(m1);
        const g2 = new THREE.BoxGeometry(node.val / 3.5, node.val / 3.5, node.val / 3.5);
        const m2 = new THREE.Mesh(g2, new THREE.MeshBasicMaterial({ color: node.color, transparent: true, opacity: op * 0.8 }));
        m2.rotation.set(Math.PI / 6, Math.PI / 6, 0);
        group.add(m2);
    } else if (node.type === 'nonstate') {
        const g1 = new THREE.ConeGeometry(node.val / 1.8, node.val / 1.2, 3);
        const m1 = new THREE.Mesh(g1, new THREE.MeshBasicMaterial({ color: node.color, transparent: true, opacity: op, wireframe: true }));
        m1.rotation.x = Math.PI / 3;
        group.add(m1);
        const g2 = new THREE.ConeGeometry(node.val / 3, node.val / 2, 3);
        const m2 = new THREE.Mesh(g2, new THREE.MeshBasicMaterial({ color: node.color, transparent: true, opacity: op * 0.8 }));
        m2.rotation.x = Math.PI / 3;
        group.add(m2);
    } else {
        const g1 = new THREE.SphereGeometry(node.val / 2.5, 32, 32);
        group.add(new THREE.Mesh(g1, new THREE.MeshBasicMaterial({ color: node.color, transparent: true, opacity: op })));
        const g2 = new THREE.RingGeometry(node.val / 1.5, node.val / 1.4, 64);
        const m2 = new THREE.Mesh(g2, new THREE.MeshBasicMaterial({ color: node.color, side: THREE.DoubleSide, transparent: true, opacity: focused ? 0.35 : 0.12 }));
        m2.rotation.x = Math.PI / 2;
        group.add(m2);
    }

    const shortName = node.name.length > 16 ? `${node.name.slice(0, 14)}..` : node.name;
    const label = makeSprite(shortName, node.color);
    label.position.set(0, node.val / 1.5 + 3, 0);
    group.add(label);

    return group;
}

export function formatNexusNodeTooltip(node, links = []) {
    if (!node) return '';
    const conns = links.filter(l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        return s === node.id || t === node.id;
    }).length;
    const safeColor = escHtml(node.color || '#fff');
    const safeName = escHtml(node.name || '');
    const safeSub = escHtml(node.isAnchor ? (node.type || '').toUpperCase() : (node.category || ''));
    return `<div style="background:rgba(0,2,8,0.92);color:#fff;padding:10px 14px;border-radius:5px;font-family:monospace;font-size:14px;line-height:1.5;border-left:3px solid ${safeColor};max-width:320px;backdrop-filter:blur(10px)">`
        + `<strong style="color:${safeColor}">${safeName}</strong><br/>`
        + `<span style="color:#a5b4bc;font-size:12px">${safeSub}</span><br/>`
        + `<span style="color:#aaa">${conns} connections</span>`
        + (node.isAnchor ? '<br/><span style="color:#a5b4bc;font-size:12px">Click to inspect · Double-click to lock</span>' : '')
        + '</div>';
}

export function formatNexusLinkTooltip(lnk) {
    if (!lnk) return '';
    const sId = typeof lnk.source === 'object' ? lnk.source.id : lnk.source;
    const tId = typeof lnk.target === 'object' ? lnk.target.id : lnk.target;
    const sName = escHtml((typeof lnk.source === 'object' ? lnk.source.name : sId) || '');
    const tName = escHtml((typeof lnk.target === 'object' ? lnk.target.name : tId) || '');
    const dimColor = escHtml(DIM_COLORS[lnk.type] || '#fff');
    const dimLabel = escHtml((lnk.type || 'connection').toUpperCase());
    const info = getEdgeInfo(sId, tId, lnk.type);
    if (info) {
        const chips = (info.dataPoints || [])
            .slice(0, 3)
            .map(dp => `<span style="font-size:12px;color:#c2cbd0;background:rgba(0,255,255,0.06);padding:3px 7px;border-radius:2px;border:1px solid rgba(0,255,255,0.1)">${escHtml(dp)}</span>`)
            .join('');
        const tensionColor = info.tension > 0.7 ? '#ff668f' : info.tension > 0.4 ? '#ffb84d' : '#5eead4';
        return `<div style="background:rgba(0,2,8,0.94);color:#fff;padding:12px 16px;border-radius:5px;font-family:'Roboto Mono',monospace;font-size:14px;line-height:1.5;max-width:400px;border-left:4px solid ${dimColor};backdrop-filter:blur(12px);box-shadow:0 8px 32px rgba(0,0,0,0.8)">
            <div style="color:${dimColor};font-size:12px;letter-spacing:1.5px;margin-bottom:6px">${dimLabel}</div>
            <strong style="font-size:16px">${escHtml(info.label)}</strong><br/>
            <span style="color:#d0d7da;font-size:14px;line-height:1.55">${escHtml(info.summary)}</span>
            <div style="margin-top:8px;display:flex;gap:5px;flex-wrap:wrap">${chips}</div>
            <div style="margin-top:8px;font-size:12px;color:#a5b4bc">Tension: <span style="color:${tensionColor}">${(info.tension * 100).toFixed(0)}%</span> · Click for full details</div>
        </div>`;
    }
    return `<div style="background:rgba(0,2,8,0.92);color:#ddd;padding:10px 14px;border-radius:4px;font-family:'Roboto Mono',monospace;font-size:14px;line-height:1.5;border-left:3px solid ${dimColor};backdrop-filter:blur(10px)">
        <span style="color:${dimColor};font-size:12px;letter-spacing:1.5px">${dimLabel}</span><br/>
        <strong>${sName.split('(')[0].trim()}</strong> ⟷ <strong>${tName.split('(')[0].trim()}</strong><br/>
        <span style="font-size:12px;color:#a5b4bc">Click for details</span>
    </div>`;
}
