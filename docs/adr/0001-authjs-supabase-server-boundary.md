# ADR 0001: Auth.js Sessions With Server-Only Supabase Data Access

## Status

Accepted

## Context

Mission Control is an operational dashboard for Operations Operators. The v1 app uses Auth.js for application sign-in and session management, while Supabase is planned as the source of truth for Stations and Incidents.

Auth.js and Supabase Auth are separate identity systems. The current product decision is to use Auth.js intentionally, so browser clients do not receive Supabase user sessions or Supabase authorization claims. At the same time, Mission Control needs database access for station monitoring and incident triage.

Supabase service-role and secret keys are elevated backend credentials. Supabase documentation describes these keys as server-only credentials that can bypass Row Level Security. They must never be exposed through `NEXT_PUBLIC_` environment variables, browser bundles, logs, or client components.

## Decision

Mission Control separates identity from data access:

- Auth.js owns user identity, sign-in, sign-out, and application session cookies.
- Next.js server routes/actions read the Auth.js session and authorize Mission Control operations.
- Supabase access is server-only and hidden behind a Mission Control repository interface.
- Client components call app APIs/server actions only. They never import Supabase clients or use Supabase keys.
- Local development may use mock data when Supabase credentials are missing or invalid.
- Production data access uses a server Supabase client only when `SUPABASE_URL` and an elevated server key are present and valid.

## Rationale

This preserves the approved Auth.js user model while still allowing Supabase to become the source of truth for operational data. It gives the application one explicit authorization boundary: the Next.js server. That boundary can evaluate the Auth.js session before any elevated database credential is used.

The repository interface also keeps local onboarding simple. Developers can run the app without a Supabase project, while production can switch to Supabase by supplying valid server-only environment variables.

## Consequences

### Benefits

- Client bundles cannot accidentally expose Supabase service credentials.
- Operations authorization stays tied to Auth.js sessions.
- Local development works without external database setup.
- Supabase can replace mock data without changing dashboard components.
- Future AI agents have a clear rule: data access belongs behind the server repository boundary.

### Costs

- Supabase Row Level Security is not the primary user authorization mechanism for v1 Mission Control operations.
- Server route/action authorization must be tested carefully because service credentials are powerful.
- Realtime subscriptions require a later authorization design because the browser does not own Supabase user sessions.
- The mock adapter and Supabase adapter must stay behaviorally aligned.

## Scope

This ADR applies to Mission Control station and incident data access.

In scope:

- Auth.js session checks for `/mission-control` and Mission Control API routes.
- Server-only Supabase reads and writes for Stations and Incidents.
- Environment-gated fallback to mock data for local development.
- Repository methods for listing stations, listing incidents, and updating incident status.

Out of scope:

- Supabase Auth as a replacement for Auth.js.
- Browser-side Supabase clients.
- Supabase Realtime subscriptions.
- Full database schema and RLS policy design.
- Production provider setup for Auth.js.

## Implementation Rules

- Do not import `@supabase/supabase-js` from client components.
- Do not create `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_SECRET_KEY`, or equivalent public elevated credentials.
- Route handlers and server actions must call the repository after Auth.js authorization.
- If Supabase credentials are missing, blank, placeholder-like, or malformed, the repository must use mock data.
- If Supabase credentials are present but queries fail, surface the database error instead of silently falling back to mock data.

