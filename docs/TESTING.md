# Testing

Run `npm test` for the Netlify function security-boundary tests, intelligence-feed fallback and filtering checks, Relations Nexus graph-readiness regressions, local-state checks, and curated-content integrity tests.

The feed tests ensure public source links survive provider unavailability, reference and provider-fallback records are not mislabelled as live, cached provider records retain precedence, loading does not announce a false failure, archive filters recover safely, and empty filters expose a recovery action. Snapshot tests verify that anonymous Serper queries are fixed and server-controlled; promotional and weak results are rejected; URLs and headlines are deduplicated; regional, issue, publisher, topic-cluster, and discovery-source limits are enforced; unavailable states remain accurate; and editorial source-health responses distinguish healthy, restricted, broken, and uncertain links. Content checks require 29 unique case studies, exactly three perspective-labelled core readings per case, broad regional and issue coverage, HTTPS source metadata, valid Nexus actors, evidence-aligned waypoints, case-specific 5W1H output, appropriately qualified theory prompts, and a current generated source-health manifest.

Run `npm run build` to verify the production bundle and route-level lazy chunks. Before release, manually check these browser journeys:

1. Open a briefing deep link with `tour` and `step`; confirm the requested step survives refresh.
2. Open a Nexus actor deep link, switch to 3D and back, and confirm the actor and URL persist.
3. Enter through Nexus and switch to Live Globe; confirm the globe initializes and all 29 editorial cases are present.
4. Open a verified case, inspect its evidence/source panel, and hand off to its Guided Briefing.
5. While signed out, confirm public source links render in reference mode. Confirm cached current updates show a clear fresh, stale, warming, unavailable, or unconfigured state, then use Show Public Sources to restore the linked feed.
6. Confirm editorial source health renders a safe pending state before its first scheduled run and availability labels plus declared alternate links after a snapshot is populated.
7. Confirm cached-current cards show region, issue, and source-role chips; the feed header reports coverage totals; and opening a current item explains why it was selected without describing its role as a reliability endorsement.
8. At 1440×900, 1024×768, and 390×844, confirm Globe, Guided Briefings, and both Nexus presentations have no horizontal page overflow and their primary controls remain at least 44px high.
9. On Globe, collapse and restore the Intel Feed and operational dashboard; confirm the canvas resizes, Intel cards do not overlap, and the preferences survive refresh.
10. On Guided Briefings, hide and restore the case library, expand the six-case result page, select a case on a narrow viewport, and move from step 3 to 4; confirm the selected heading receives focus and the active progress step remains visible.
11. In Focus Nexus, verify the coordinate map stacks above the inspector below 1100px and changes to the relationship list on phones. In 3D spatial view, verify Reset/Unlock are clickable and the telemetry and controls panels do not overlap.

Run `npm audit` during dependency reviews. The current Vite 5 development-only advisories are tracked in `docs/KNOWN_ISSUES.md`; do not expose the local development server beyond loopback.

## CI Workflow
The CI pipeline (`.github/workflows/ci.yml`) runs the automated tests and verifies that the application builds successfully.

## Future Improvements
- Expand unit-test coverage for remaining utility functions.
- Implement component tests for React components.
- Automate the current browser smoke journeys, including mobile breakpoints and keyboard navigation.
