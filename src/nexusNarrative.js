/**
 * nexusNarrative.js — Generates narrative summaries for nodes and connections
 * Uses structured data to create human-readable analysis paragraphs.
 * No LLM needed — template-based with dynamic data insertion.
 */

import { getEdgeInfo, EDGE_DESCRIPTIONS } from './nexusEdgeData';

/**
 * Generate a narrative summary for a selected node based on its connections
 * @param {object} node - the selected node
 * @param {Array} connections - array of connection summaries (from connectionSummary)
 * @param {Array} links - all graph links
 * @param {string} selectedTheory - current IR theory lens
 * @returns {string} narrative text
 */
export function generateNodeNarrative(node, connections, links, selectedTheory) {
    if (!node) return '';

    const parts = [];
    const nodeLinks = links.filter(l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        return s === node.id || t === node.id;
    });

    // Count by dimension
    const dimCounts = {};
    nodeLinks.forEach(l => {
        if (l.type && l.type !== 'satellite') {
            dimCounts[l.type] = (dimCounts[l.type] || 0) + 1;
        }
    });

    // Opening
    const totalConns = Object.values(dimCounts).reduce((a, b) => a + b, 0);
    parts.push(`${node.name} sits at the intersection of ${totalConns} structural connections across ${Object.keys(dimCounts).length} dimensions.`);

    // Dimension breakdown
    const dimNames = { trade: 'economic/trade', conflict: 'security/conflict', diplomacy: 'diplomatic', tech: 'technology' };
    const dimEntries = Object.entries(dimCounts).sort((a, b) => b[1] - a[1]);
    if (dimEntries.length > 0) {
        const dominant = dimEntries[0];
        parts.push(`Its dominant connection type is ${dimNames[dominant[0]] || dominant[0]} (${dominant[1]} links), ${dominant[1] > 3 ? 'making it a critical hub in this dimension.' : 'indicating focused engagement.'}`);
    }

    // Find most intense connections
    const richLinks = [];
    nodeLinks.forEach(l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        const partnerId = s === node.id ? t : s;
        const info = getEdgeInfo(node.id, partnerId, l.type);
        if (info) {
            richLinks.push({ partnerId, info, type: l.type, width: l.width || 1 });
        }
    });

    // Most contested/intense
    const contested = richLinks.filter(r => r.info.tension > 0.7).sort((a, b) => b.info.tension - a.info.tension);
    if (contested.length > 0) {
        const top = contested[0];
        parts.push(`Most contested relationship: ${top.info.label} — ${top.info.summary}`);
    }

    // Most stable/cooperative
    const stable = richLinks.filter(r => r.info.tension < 0.4).sort((a, b) => a.info.tension - b.info.tension);
    if (stable.length > 0) {
        const top = stable[0];
        parts.push(`Most stable partnership: ${top.info.label} — ${top.info.summary}`);
    }

    // Theory lens interpretation
    const theoryNarrative = getTheoryNarrative(node, selectedTheory, dimCounts);
    if (theoryNarrative) {
        parts.push(theoryNarrative);
    }

    return parts.join('\n\n');
}

function getTheoryNarrative(node, theory, dimCounts) {
    const name = node.name;
    switch (theory) {
        case 'Realism':
            if (dimCounts.conflict > dimCounts.trade)
                return `Through a Realist lens, ${name} is primarily a security actor — its conflict connections outnumber trade links, suggesting power-maximizing behavior consistent with offensive realism.`;
            return `Realist analysis: ${name} balances economic engagement with security positioning. Its trade connections may serve as instruments of relative power accumulation.`;

        case 'Liberalism':
            if (dimCounts.trade > dimCounts.conflict)
                return `Liberal institutionalists would note ${name}'s trade-dominant profile — economic interdependence may constrain conflict escalation through opportunity costs.`;
            return `Liberal analysis: ${name}'s institutional engagement suggests commitment to rules-based order, though security ties may indicate hedging against institutional failure.`;

        case 'Marxism':
            return `Marxist analysis: ${name}'s connection pattern reveals its position in the global division of labor. ${dimCounts.trade > 2 ? 'Heavy trade links indicate integration into capitalist world-system dynamics.' : 'Limited trade connections may signal peripheral status.'}`;

        case 'Constructivism':
            return `Constructivist reading: ${name}'s identity shapes its connection patterns. ${dimCounts.diplomacy > 1 ? 'Active diplomatic engagement suggests norm entrepreneurship and identity-based alliance formation.' : 'Its connections reflect material rather than ideational logics.'}`;

        case 'Feminism':
            return `Feminist IR perspective: Examine how ${name}'s connections impact human security. ${dimCounts.conflict > 2 ? 'High conflict connectivity disproportionately affects civilian populations, particularly women and children in conflict zones.' : 'Its engagement patterns should be evaluated through gendered impact analysis.'}`;

        case 'Postcolonialism':
            const isGlobalSouth = ['Africa', 'LatinAmerica', 'MiddleEast', 'AsiaPacific'].includes(node.id);
            if (isGlobalSouth)
                return `Postcolonial lens: ${name} exists within neo-colonial power structures. Its trade connections may reproduce dependency patterns established during formal colonialism.`;
            return `Postcolonial analysis: ${name}'s connection pattern reveals its role in maintaining or challenging the post-colonial international order.`;

        default:
            return null;
    }
}

/**
 * Generate a narrative for an edge/connection
 */
export function generateEdgeNarrative(link, graphNodes) {
    const sId = typeof link.source === 'object' ? link.source.id : link.source;
    const tId = typeof link.target === 'object' ? link.target.id : link.target;
    const info = getEdgeInfo(sId, tId, link.type);

    const sName = graphNodes.find(n => n.id === sId)?.name || sId;
    const tName = graphNodes.find(n => n.id === tId)?.name || tId;

    if (info) {
        return `${sName} ↔ ${tName} [${(link.type || '').toUpperCase()}]\n\n${info.summary}\n\nKey data: ${info.dataPoints.join(' · ')}`;
    }

    return `${sName} ↔ ${tName}: ${(link.type || 'connected').toUpperCase()} dimension link with strength ${((link.width || 1) * 20).toFixed(0)}%.`;
}
