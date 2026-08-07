# Testing

Run `npm test` for the Netlify function security-boundary tests, Relations Nexus graph-readiness regressions, local-state checks, and curated-content integrity tests.

The current suite contains 19 tests. Content checks require nine unique case studies, broad regional and issue coverage, HTTPS source metadata, valid Nexus actors, evidence-aligned waypoints, case-specific 5W1H output, and appropriately qualified theory prompts.

Run `npm run build` to verify the production bundle and route-level lazy chunks. Before release, manually check these browser journeys:

1. Open a briefing deep link with `tour` and `step`; confirm the requested step survives refresh.
2. Open a Nexus actor deep link, switch to 3D and back, and confirm the actor and URL persist.
3. Enter through Nexus and switch to Live Globe; confirm the globe initializes and all nine verified cases are present.
4. Open a verified case, inspect its evidence/source panel, and hand off to its Guided Briefing.

Run `npm audit` during dependency reviews. The current Vite 5 development-only advisories are tracked in `docs/KNOWN_ISSUES.md`; do not expose the local development server beyond loopback.

## CI Workflow
The CI pipeline (`.github/workflows/ci.yml`) runs the automated tests and verifies that the application builds successfully.

## Future Improvements
- Expand unit-test coverage for remaining utility functions.
- Implement component tests for React components.
- Automate the current browser smoke journeys, including mobile breakpoints and keyboard navigation.
