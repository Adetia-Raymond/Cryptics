User Analysis Integration Plan

Objective
- Integrate backend insights (technical, sentiment, opportunities) into the web dashboard as a cohesive "User Analysis" feature that surfaces trading signals and sentiment-driven opportunities for a selected symbol.

Scope / Deliverables
- New frontend API client wrapper for insights endpoints.
- React hook `useInsights` to fetch and cache insights per-symbol with sensible staleness/timing.
- UI components: `InsightsCard`, `InsightsDetailModal`, and small helper components (e.g., `MetricRow`, `TagList`).
- Dashboard wiring: place `InsightsCard` into the dashboard (Market Pulse area or per-symbol modal) and optional Quick Actions.
- Lightweight tests (unit for hook, basic rendering for components) and runtime QA steps.

Assumptions
- Backend endpoints already exist and return these shapes: `technical`, `sentiment`, `opportunities` for a given `symbol` (see earlier API examples).
- `packages/api` already contains a pattern for API helpers; follow the same conventions (axios wrapper, typed responses).
- Use existing UI primitives and Tailwind/CSS tokens used across the app.

API Client
- Create `packages/api/src/insights.ts` exporting typed functions:
  - `getInsights(symbol: string): Promise<InsightsResponse>` — wraps GET `/insights/{symbol}` or equivalent endpoint.
  - `getTechnical(symbol: string)`, `getSentiment(symbol)`, `getOpportunities(symbol)` — if backend exposes smaller endpoints.
- Types:
  - `InsightsResponse` { technical: TechnicalInsight[], sentiment: SentimentSummary, opportunities: Opportunity[] }
  - Keep types co-located with the client file or in `packages/api/src/types/insights.ts`.
- Follow existing error handling and retry semantics used by `packages/api`.

Frontend Hook
- Add `apps/web/hooks/useInsights.ts`
  - Accepts `symbol: string | null`, options `{ staleMs?: number, enabled?: boolean }`.
  - Returns `{ data, error, isLoading, refresh }`.
  - Caches per-symbol using an in-memory Map and optionally `localforage` or `sessionStorage` for cross-tab caches (start simple: in-memory + refetch on visibility).
  - Use `fetchSnapshot`/`observe` semantics if you want live updates; otherwise poll every X seconds when the card is visible.
  - Provide `refresh()` for manual refresh (user clicking "Refresh" in UI).

UI Components
- `apps/web/components/InsightsCard.tsx`
  - Props: `{ symbol: string; onOpenDetail?: (symbol)=>void }`.
  - Layout: small card with three main sections:
    - Technical summary (e.g., list of indicators + score)
    - Sentiment summary (score, bullish/bearish split, source links)
    - Top Opportunities (list with short description + confidence)
  - A top-right overflow menu for "Refresh" and "Open Details".
  - Compact design for grid usage: target height ~h-56/h-64 depending on density.
- `apps/web/components/InsightsDetailModal.tsx`
  - Full details for a symbol: charts, full technical indicator breakdown, historical sentiment timeline, and per-opportunity expanded text + CTA (e.g., "Open Trade" placeholder).
  - Use existing `CandlestickChart` for price context; show `technical` indicators as overlay or separate rows.
- Helper components: `MetricRow`, `IndicatorList`, `OpportunityItem` for reuse.

Dashboard Integration
- Layout convention: Two-section dashboard rule.
  - Top section: the existing price cards grid (all `MarketCard` instances and Market Pulse). This remains the primary, compact area for symbol summaries and charts.
  - Bottom section: a dedicated Insights area that always appears below the price cards. This area holds the `InsightsCard` (or a compact row of insights) and is allowed more horizontal/vertical space so insights can show richer summaries without crowding the price grid.
  - Mobile: preserve the two-section rule but condense the Insights area. On small screens the Insights section stacks below the price cards and shows a compact/scrollable presentation (e.g., a single condensed `InsightsCard` or a horizontal scroller of compact cards).

- Quick wins (Option A):
  - Place a single `InsightsCard` (focused on the selected or pinned symbol) in a full-width row below the existing `selectedSymbols` grid in `apps/web/app/dashboard/page.tsx`.
  - Clicking the card opens `InsightsDetailModal` for full details.

- Longer-term (Option B):
  - Offer an optional, dedicated "User Analysis" tab or expandable panel with multi-symbol comparison, pinned insights, and advanced controls.

UX Considerations
- Show skeleton/loading states (re-use `Skeleton` component) while fetching.
- Minimize noisy polling — tie updates to `useVisibleSummaries` visibility API so inactive cards do not poll.
- Rate-limit calls: if multiple symbols are visible, batch snapshot fetches where possible (reuse `fetchSnapshot` idea), or stagger requests.
- Error handling: surface actionable messages and a retry button.

Testing & QA
- Hook unit tests: mock API responses and assert state transitions (loading → data → stale → refresh).
- Component tests: render `InsightsCard` with mock data and assert key visuals exist (technical score, sentiment label, first opportunity).
- Manual QA checklist:
  - Verify card loads for a symbol and modal opens.
  - Validate refresh button triggers network calls and updates UI.
  - Test with multiple visible cards to ensure rate-limiting/staggering works.
  - Observe behavior in multiple tabs to ensure no excessive duplicate requests.

Files To Create / Edit (suggested)
- packages/api/src/insights.ts
- packages/api/src/types/insights.ts (optional)
- apps/web/hooks/useInsights.ts
- apps/web/components/InsightsCard.tsx
- apps/web/components/InsightsDetailModal.tsx
- apps/web/app/dashboard/page.tsx (wire card in) — optional: create a dedicated dashboard area
- tests/hooks/useInsights.test.ts
- tests/components/InsightsCard.test.tsx

Milestones
1. API client + types (fast) — 1-2 hours
2. Hook `useInsights` + caching (medium) — 2-3 hours
3. `InsightsCard` UI + skeletons (medium) — 2-3 hours
4. Modal + detailed view (medium) — 3-4 hours
5. Tests + QA (small) — 1-2 hours

Next Immediate Steps (what I can do now)
- Create `packages/api/src/insights.ts` with typed client stubs and example responses.
- Implement `apps/web/hooks/useInsights.ts` as a basic hook that uses the client and visibility to poll when visible.
- Scaffold `apps/web/components/InsightsCard.tsx` with layout and skeleton states, and wire one instance into `apps/web/app/dashboard/page.tsx` near the existing Market Pulse card.

Notes
- I will follow existing patterns in `packages/api` and `apps/web` so the new files are consistent with surrounding code.
- If you prefer, I can start with Option A (quick win) to get an MVP onto the dashboard, then iterate towards the full feature.
