# Mobile route planner

Routes use DailyRoute.planning (nullable JSONB) for named schedules, free-address stops, stop duration, locks, fixed appointments, road geometry and driving estimates. Existing DailyRoute and RouteStop records remain compatible; saved-account stops are mirrored transactionally for Today and account records.

- Up to 20 offices per route, plus explicit start and optional end.
- TomTom Routing v1 supplies road geometry, traffic-aware driving times and best-order waypoint suggestions.
- Locked / appointment stops are anchors at their existing sequence indexes. Flexible blocks are optimized separately. Without an explicit ending location, the final office remains fixed. This is a heuristic, not a guarantee of the globally shortest route.
- Schedule simulation inserts waiting for appointments and lunch breaks. Infeasible optimization is rejected without changing the previous order. Manual schedules can be saved with visible warnings.
- Driving times are estimates from the requested departure, not a per-leg traffic forecast recalculated after every visit.
- Account-based stops are reauthorized and canonicalized server-side. Existing lunch / confirmed meeting commitments in the planning window become fixed stops. Unassigned or deleted offices cannot be saved.
- New address points use authenticated, rate-limited geocoding.
- Saved routes and order are persisted server-side with optimistic concurrency checks. Device drafts are scoped to the signed-in user ID and survive closing the app; clearing browser storage removes unsaved drafts.
- Calendar writes idempotent internal route visit events. Existing lunch, meeting and external calendar events are never overwritten. Route deletion removes only its own internal visit events.
- Go opens external navigation to the first office. It does not claim native turn-by-turn navigation or that all 20 stops fit in a third-party navigation URL.
- Suggest My Route ranks recorded follow-ups and engagement. Optimize applies road efficiency afterward. CRM activity and conversation suggestions only display existing verified/recorded data.
- Native iOS/Android use the same mobile web interface. Device gestures, drag handles, safe areas and external navigation still require physical-device acceptance.

Validation workflow: .github/workflows/route-validation.yml runs migrations and real PostgreSQL persistence tests in an isolated disposable database, provider-contract/scheduling tests, TypeScript and Next production build. Mocked road fixtures do not prove current live TomTom coverage or API-key authorization.
