import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, readAppWorkspaceSource } from './_helpers/readAppSources.mjs';

function hexToLuminance(hex) {
    const clean = hex.replace('#', '');
    const r = Number.parseInt(clean.slice(0, 2), 16) / 255;
    const g = Number.parseInt(clean.slice(2, 4), 16) / 255;
    const b = Number.parseInt(clean.slice(4, 6), 16) / 255;
    const toLinear = c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(fgHex, bgHex) {
    const l1 = hexToLuminance(fgHex);
    const l2 = hexToLuminance(bgHex);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

test('intel-card uses valid phrasing content inside <button>, calls openBriefing on BRIEFING ->, and avoids raw footer asterisks', () => {
    const appSource = readAppWorkspaceSource();
    const appRootJsx = fs.readFileSync(path.join(REPO_ROOT, 'src/App.jsx'), 'utf8');
    const teacherGuide = fs.readFileSync(path.join(REPO_ROOT, 'teacher-guide.html'), 'utf8');

    assert.ok(!appSource.includes('aria-label={`Open intelligence detail:'), 'intel-card must not override visible text with mismatched aria-label');
    assert.match(appSource, /<article[\s\S]{0,200}?className=\{`intel-card\b/, 'intel-card must render as <article>');

    const triggerBlockMatch = appSource.match(/className="intel-card-trigger"[\s\S]*?<\/button>/);
    assert.ok(triggerBlockMatch, 'Expected <button className="intel-card-trigger"> block');
    assert.ok(!/<div\b/.test(triggerBlockMatch[0]), 'HTML <button className="intel-card-trigger"> must contain phrasing <span> elements, never <div>');

    // Blocker #2 regression guard: card BRIEFING -> must invoke onOpenBriefing/openBriefing(forecast.caseStudyId) and App.jsx wires onOpenBriefing={openBriefing}
    assert.match(
        appSource,
        /className="card-briefing-btn"[\s\S]{0,160}?onClick=\{\(\)\s*=>\s*(?:onOpenBriefing|openBriefing)\(forecast\.caseStudyId\)\}/,
        'card-briefing-btn must call openBriefing/onOpenBriefing(forecast.caseStudyId) rather than navigateView directly'
    );
    assert.match(appRootJsx, /onOpenBriefing=\{openBriefing\}/, 'App.jsx must pass openBriefing to IntelSidebar');

    assert.ok(!appSource.includes('**Stephen Martinez'), 'Footer attribution must use <strong> rather than raw Markdown asterisks');
    assert.match(appSource, /<strong>Stephen Martinez/);

    assert.ok(!teacherGuide.includes('fonts.googleapis.com'), 'teacher-guide.html must use self-hosted /assets/fonts/fonts.css');
    assert.match(teacherGuide, /href="\/assets\/fonts\/fonts\.css"/);
});

test('GuidedBriefings displays Showing X of Y cases with Show all button and UI accent text colors pass >=4.5:1 WCAG AA contrast', () => {
    const briefingsSource = fs.readFileSync(path.join(REPO_ROOT, 'src/GuidedBriefings.jsx'), 'utf8');
    const nexusCss = fs.readFileSync(path.join(REPO_ROOT, 'src/GlobalRelationsNexus.css'), 'utf8');

    assert.match(briefingsSource, /Showing\s+\{displayedTours\.length\}\s+of\s+\{visibleTours\.length\}/, 'GuidedBriefings must report Showing X of Y cases');
    assert.match(briefingsSource, /Show all \{visibleTours\.length\}/, 'GuidedBriefings must offer Show all button');

    // Verify computed WCAG 2.1 AA (>= 4.5:1) contrast on accessible text accents & HUD labels
    assert.ok(contrastRatio('#ff5c99', '#0a0e1a') >= 4.5, '#ff5c99 conflict category label must achieve >=4.5:1 on #0a0e1a');
    assert.ok(contrastRatio('#ff6b6b', '#101624') >= 4.5, '#ff6b6b Marxism theory label must achieve >=4.5:1 on #101624');
    assert.ok(contrastRatio('#9fb2bc', '#05090d') >= 4.5, '#9fb2bc 3D Nexus HUD label must achieve >=4.5:1 on #05090d');
    assert.ok(contrastRatio('#ffffff', '#7a0099') >= 4.5, 'Code of Conduct #ffffff on #7a0099 must achieve >=4.5:1');

    assert.ok(!/\.hud-tab\s*\{[^}]*color:\s*#555\b/.test(nexusCss), '.hud-tab must not use low-contrast #555');
    assert.ok(!/\.section-label\s*\{[^}]*color:\s*#555\b/.test(nexusCss), '.section-label must not use low-contrast #555');
});
