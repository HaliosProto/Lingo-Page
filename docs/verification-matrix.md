# Verification matrix

Legend: `U` unit, `I` integration, `E` browser E2E, `M` manual browser, `S` security/secret scan, `D` documentation evidence.

| Area | Evidence required | Milestone |
| --- | --- | --- |
| Repository setup | Files, scripts, lockfile, clean install/build | 0/1 |
| Product scope | Product spec and open decisions | 0 |
| Architecture | Package graph, data flow, ADRs | 0/1 |
| Message safety | Schema rejection, sender/tab/frame checks, stale request tests | 1/2 |
| DOM eligibility | Fixtures for safe/unsafe/excluded nodes | 2 |
| DOM preservation | Text-node-only mutation; DOM structure snapshot unchanged | 2 |
| Restore | Full, partial, stale-node, and navigation restore tests | 2/4 |
| Cancellation | Abort during discovery, request, apply, and observer work | 2/4 |
| Provider isolation | Mock adapter works; core has no provider imports | 1/2 |
| API validation | Bad body, IDs, limits, language, auth, error shape | 1/3 |
| Secret boundary | Bundle/source-map/config/history scan; provider key absent client-side | 3/8 |
| Rate/cost controls | Per-user/IP limits, quotas, emergency disable, usage counters | 3/7 |
| Dynamic content | Mutation, SPA route, infinite scroll, loop prevention | 4 |
| Service-worker lifecycle | Restart, tab close, reload, navigation recovery | 4 |
| UI states | Loading, empty, success, warning, disabled, error, retry, restore | 1/5 |
| Accessibility | Keyboard, focus, screen reader labels, zoom, contrast, RTL, reduced motion | 5/8 |
| Privacy | Explicit action, notice, exclusions, sensitive warning, clear data, redacted diagnostics | 3/5/8 |
| Performance | Small/medium/large fixture timing, long-task and memory checks | 2/4/8 |
| Unsupported pages | Chrome internal, Web Store, settings, restricted frames/viewers | 2/8 |
| Backend observability | Request IDs and privacy-safe logs; no page text in default logs | 3 |
| Browser verification | Unpacked extension loaded in real Chrome; page/popup/worker console inspected | 1 onward |
| Documentation | Changelog, tasks, limitations, milestone report updated | Every milestone |

## Required final evidence format

Each milestone report must list commands/checks run, pass/fail status, browser scenarios actually run, console/network observations, defects fixed, limitations, and exact next milestone scope. Unavailable browser checks must be marked unverified with manual instructions.
