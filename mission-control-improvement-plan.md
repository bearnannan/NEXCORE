# Mission Control Dashboard Improvement Plan

> Date: 2026-05-27  
> Target audience: Operations Operators  
> Status: v1 implementation strategy for a new app in this repository

## Executive Summary

Mission Control is a new operational dashboard for monitoring station state and incident flow. The v1 goal is not a broad platform migration or a visual-only redesign. The first useful release should let an Operations Operator sign in, view stations on a map, see incident state overlaid on those stations, filter and inspect incidents, and update incident status.

This repository currently has no committed app code, no existing domain glossary, and no ADR history. The implementation should therefore start from a clean Next.js foundation while keeping the architecture intentionally small enough to ship and verify.

## Target Stack

| Layer | Decision | Notes |
| --- | --- | --- |
| Framework | Next.js 16 App Router | Use current App Router conventions and server-first data access. |
| UI Runtime | React 19 | Align with the current React baseline used by modern Next.js. |
| Language | TypeScript | Enable strict mode from the start. |
| Styling | Tailwind CSS v4 + shadcn/ui | Use CSS-first tokens and shadcn components for a corporate, formal dashboard. |
| Package Manager | Bun | Use Bun for dependency installation and local scripts only. Do not require Bun as the Vercel production runtime. |
| Data Fetching | TanStack Query | Use for client-side polling, caching, loading states, and mutations. |
| Map | Leaflet + react-leaflet | Keep the v1 map engine simple and mature. Load it SSR-safely. |
| Database | Supabase | Supabase is the source of truth for stations and incidents. |
| Authentication | Auth.js | Auth.js owns application sessions. Supabase access remains server-only in v1. |
| Deployment | Vercel | Use the standard Next.js deployment path. |

Official references:

- [Next.js upgrade guide](https://nextjs.org/docs/app/getting-started/upgrading)
- [React versions](https://react.dev/versions)
- [Tailwind CSS v4](https://tailwindcss.com/blog/tailwindcss-v4)
- [shadcn/ui Tailwind v4 docs](https://v3.shadcn.com/docs/tailwind-v4)
- [Auth.js](https://authjs.dev/)
- [React Leaflet introduction](https://react-leaflet.js.org/docs/start-introduction/)

## Product Scope

### In Scope for v1

- Authenticated `/mission-control` dashboard for Operations Operators.
- Station-centered map view.
- Incident overlays on station markers.
- Incident filtering by status, severity, station, and free-text search.
- Station inspector with station details and related incidents.
- Incident queue with status update actions.
- Polling-based refresh using TanStack Query.
- Responsive layout that works on desktop and mobile.
- Type-check, lint, build, and Playwright verification.

### Deferred

- Supabase Realtime subscriptions.
- Offline/PWA/service-worker behavior.
- Full offline mutation sync and conflict resolution.
- Map-provider abstraction.
- Docker+Bun production runtime.
- Heavy clustering or Web Worker processing unless real data volume requires it.

## Domain Model

The corresponding glossary lives in `CONTEXT.md`. Implementation types should use the same language:

- `Mission Control`: the operational dashboard for monitoring station state and incident flow.
- `Station`: the primary map entity.
- `Incident`: an operational work item tied to a station.
- `Operations Operator`: the primary user who monitors, filters, inspects, and updates incidents.

Core TypeScript shapes:

```ts
export type IncidentStatus =
  | "new"
  | "acknowledged"
  | "in_progress"
  | "resolved"
  | "closed";

export type Station = {
  id: string;
  code: string;
  name: string;
  province?: string;
  latitude: number | null;
  longitude: number | null;
  operationalStatus: "normal" | "degraded" | "offline";
};

export type Incident = {
  id: string;
  stationId: string;
  title: string;
  description?: string;
  status: IncidentStatus;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
  updatedAt: string;
};

export type IncidentFilters = {
  status?: IncidentStatus[];
  severity?: Incident["severity"][];
  stationId?: string;
  query?: string;
};
```

## Architecture

### Application Routes

- `/mission-control`: authenticated dashboard route.
- Auth.js route handlers under the standard App Router auth path.
- Server routes or server actions for stations and incidents.

### Data Access Rule

Client components must not import or instantiate Supabase clients directly. Because Auth.js owns application sessions in v1, all Supabase access must go through Next.js server routes/actions. Those server entry points are responsible for:

- reading the Auth.js session;
- checking whether the user is allowed to operate Mission Control;
- querying or mutating Supabase;
- returning typed response data to client components.

This keeps the Auth.js + Supabase split explicit and prevents accidental reliance on Supabase Row Level Security claims that are not available to the browser client.

### Live Updates

Use TanStack Query polling for v1:

- incidents list: poll on a fixed interval while the dashboard is visible;
- station summaries: poll on a fixed interval or refetch after incident mutations;
- status updates: use mutations with conservative optimistic UI only when rollback is straightforward.

Supabase Realtime can be introduced later after the authorization bridge is designed.

## UI and Interaction Design

The interface should feel like an operational tool, not a marketing page:

- compact top navigation with current user/session controls;
- left filter panel on desktop;
- full-height map as the primary workspace;
- right inspector panel for selected station or incident;
- bottom or side incident queue depending on viewport;
- mobile drawer/sheet controls for filters, queue, and inspector;
- restrained corporate palette with clear severity and status colors;
- icon buttons from `lucide-react` where appropriate;
- stable dimensions for map, queue rows, controls, and panels to avoid layout shift.

Use shadcn/ui for reusable primitives such as buttons, dialogs, sheets, select controls, skeletons, tables, and toast notifications. Use Tailwind v4 tokens in CSS rather than assuming a Tailwind v3-style config-heavy setup.

## Map Strategy

Leaflet/react-leaflet remains the v1 map engine.

Implementation priorities:

- load map components with `dynamic(..., { ssr: false })` or an equivalent client-only boundary;
- render stations as primary markers;
- overlay incident state on station markers through marker color, badge, or popup metadata;
- fit bounds to stations with valid coordinates;
- provide a clear fallback for stations without coordinates;
- add clustering only if station/incident volume makes individual markers hard to use;
- avoid a provider-neutral abstraction until there is a real provider migration requirement.

## Implementation Roadmap

### Phase 1: Foundation

- Create a Next.js 16 App Router application in this repo.
- Configure TypeScript strict mode.
- Configure Bun as the package manager for install/scripts.
- Install and configure Tailwind CSS v4 and shadcn/ui.
- Add base layout, auth shell, and dashboard route protection.

### Phase 2: Domain and Data Access

- Define `Station`, `Incident`, `IncidentStatus`, and `IncidentFilters` types.
- Add Supabase server client utilities.
- Add Auth.js session handling.
- Implement server-only station and incident read endpoints/actions.
- Implement incident status update endpoint/action with authorization checks.

### Phase 3: Mission Control Workflow

- Build `/mission-control` as the first screen of the app.
- Add station map, filters panel, incident queue, and inspector panel.
- Use TanStack Query for polling, caching, loading states, and mutation flows.
- Add empty, loading, error, and permission-denied states.

### Phase 4: Responsive and Performance Pass

- Verify desktop and mobile layouts with real viewport sizes.
- Lazy-load the map and non-critical panels.
- Add queue virtualization only after validating row count/performance needs.
- Tune polling intervals and refetch behavior.
- Ensure map loading does not break SSR or production build.

### Phase 5: Verification and Release Readiness

- Add unit tests for filters, status transitions, coordinate fallback, and service functions.
- Add component tests for queue rows, filters, inspector, and status controls.
- Add Playwright coverage for sign-in, dashboard load, marker visibility, filtering, inspection, and status update.
- Run type-check, lint, production build, and browser verification before release.

## Acceptance Criteria

The v1 implementation is acceptable when:

- an Operations Operator can authenticate and open `/mission-control`;
- stations with valid coordinates render on the map;
- station markers communicate active incident state;
- filters change the visible incident queue and map state;
- selecting a station or incident opens useful details in the inspector;
- incident status can be updated through a server-authorized mutation;
- client code does not access Supabase directly;
- desktop and mobile layouts do not overlap or hide essential controls;
- type-check, lint, build, and Playwright smoke flow pass.

## ADR Candidates

No ADR is required for this document alone. Consider creating an ADR once implementation starts for the Auth.js + Supabase server-only authorization split, because it is a meaningful and non-obvious tradeoff with long-term consequences for RLS, realtime, and client data access.
