# FulfillOps Frontend Architecture

Maintained in this independent Git repository at **docs/architecture.md**. Updated **2026-11-09**. The guide covers the implemented stack, interfaces, data model, operational limits, and release requirements.

## Contents

1. [Scope, users, and repository boundary](#1-scope-users-and-repository-boundary)
2. [Context, containers, and trust boundaries](#2-context-containers-and-trust-boundaries)
3. [Source ownership and module map](#3-source-ownership-and-module-map)
4. [Screens, navigation, and lifecycle](#4-screens-navigation-and-lifecycle)
5. [Primary workflows and recovery](#5-primary-workflows-and-recovery)
6. [Domain, persistence, and data ownership](#6-domain-persistence-and-data-ownership)
7. [API and internal contracts](#7-api-and-internal-contracts)
8. [Security, privacy, and egress](#8-security-privacy-and-egress)
9. [Design, accessibility, and platform adapters](#9-design-accessibility-and-platform-adapters)
10. [Build, checks, and deployment](#10-build-checks-and-deployment)
11. [Architecture decisions and tradeoffs](#11-architecture-decisions-and-tradeoffs)
12. [Requirements traceability](#12-requirements-traceability)
13. [Dated verification and limitations](#13-dated-verification-and-limitations)
14. [Extension rules and companion repository](#14-extension-rules-and-companion-repository)

## 1. Scope, users, and repository boundary

Warehouse workflow simulation for pickers, packers, and warehouse managers.

Order queues, picking, packing, simulated shipping, returns, and workflow recovery.

This repository owns the React/Vite web interface, public content, interaction state, and API adapter. The API owns authoritative domain records and permission decisions.

There are two independent Git roots for this application, each with its own README and architecture guide. A parent app/workspace folder is a checkout convenience. Use synthetic records; current local services remain on loopback.

### Scope and users

FulfillOps is a local warehouse-workflow simulator for seeded synthetic orders. The frontend is a React + TypeScript console on loopback port 5201; the NestJS API listens on loopback port 5202. There is no database or live carrier integration.

the relevant configuration or validation section in this guide
for current verification results and deployment blockers.

## 2. Context, containers, and trust boundaries

```mermaid
flowchart LR
  U["FulfillOps user"] --> F["React and Vite frontend - port 5201"]
  F -->|"API requests across an untrusted browser boundary"| A["NestJS / TypeScript API - port 5202"]
  A --> D["Process memory - resets on restart"]
  M["Validated public content model"] --> F
```

The browser must not grant roles or confirm prices, balances, payments, stock, or workflow completion based only on local state.

### Context and containers

```mermaid
flowchart LR
    Operator[Warehouse operator]
    UI[React workspace<br/>127.0.0.1:5201]
    Model[Public content model<br/>fulfillops-model.json]
    API[NestJS API<br/>127.0.0.1:5202]
    Session[DemoSessionService<br/>hashed in-memory tokens]
    Service[FulfillmentService]
    Repo[InMemoryOrderRepository]
    Logs[Structured JSON stdout]

    Operator --> UI
    UI -->|Versioned REST + request ID| API
    UI --> Model
    UI -->|HttpOnly session cookie; version + idempotency key| API
    API --> Session
    API --> Service
    Service --> Repo
    Repo -->|Seeded order state| Service
    API --> Logs
```

The browser is untrusted. The API validates request DTOs, derives the active role from an opaque server-issued session cookie, and validates order state transitions and idempotency keys. The UI's profile selector creates a local synthetic session; it is not proof of a real person or production authentication. Mutating requests do not send a client-supplied role header. The API stores only a hash of the random session token in its in-memory session map. Sessions expire after eight hours and are revoked when the profile changes or the user signs out.

There is no user-owned or tenant-owned order data: all synthetic orders belong to the single local warehouse workspace and are visible to every available synthetic profile. Profiles may read order queues; only roles authorized for a particular action may change order state. There is no durable data store or external service boundary. The service must not be exposed outside loopback.

## 3. Source ownership and module map

| Owner/path                                                                                                                                                                                                      | Responsibility                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [src/main.tsx](../src/main.tsx)                                                                                                                                                                                 | Web entry and composition                                          |
| [src/api.ts](../src/api.ts)                                                                                                                                                                                     | API transport and response boundary                                |
| [src/config.ts](../src/config.ts)                                                                                                                                                                               | Build-time API mode selection                                      |
| [src/content-model.ts](../src/content-model.ts)<br>[src/content.tsx](../src/content.tsx)                                                                                                                        | Content loading/provider contract                                  |
| [src/App.tsx](../src/App.tsx)                                                                                                                                                                                   | Screens, composition, and interaction owners; see screen inventory |
| [src/domain/order-views.ts](../src/domain/order-views.ts)<br>[src/hooks/use-demo-session.ts](../src/hooks/use-demo-session.ts)<br>[src/hooks/use-fulfillment-action.ts](../src/hooks/use-fulfillment-action.ts) | Client hooks, presentation state, and domain adapters              |
| [src/App.css](../src/App.css)<br>[src/index.css](../src/index.css)                                                                                                                                              | Authored styling and adaptation rules                              |
| [public/fulfillops-model.json](../public/fulfillops-model.json)                                                                                                                                                 | Active public content/locale contract; no private credentials      |
| [tests](../tests)                                                                                                                                                                                               | Existing test/support directory; configured does not mean rerun    |
| [.github/workflows](../.github/workflows)                                                                                                                                                                       | Configured CI; hosted outcomes require separate verification       |
| [src/api.test.ts](../src/api.test.ts)<br>[src/content.test.tsx](../src/content.test.tsx)                                                                                                                        | Examples of existing colocated tests                               |

The source map follows the existing framework directories and test placement.

## 4. Screens, navigation, and lifecycle

UI entry and interaction owners:

- [src/App.tsx](../src/App.tsx)
- [src/components/QueuePanel.tsx](../src/components/QueuePanel.tsx)
- [src/components/WorkspaceChrome.tsx](../src/components/WorkspaceChrome.tsx)

The active model is [public/fulfillops-model.json](../public/fulfillops-model.json). Preserve existing loading, empty, validation, permission, success, and failure states; model text does not provide server identity. This is a web SPA; the current source owns view/tab selection and component lifecycle. The Vercel rewrite is hosting configuration, not an additional UI router. Follow the authored source for request cancellation, retry, focus cleanup, and local preference behavior; do not infer an offline queue where none exists.

## 5. Primary workflows and recovery

### Current product use cases

1. **Open workspace and session:** load the validated content model, fetch API
   roles, and create the default synthetic `picker` session. Profile changes
   rotate the prior cookie-backed session. Missing API/profile/session data is
   surfaced with model copy and a retry path.
2. **Review summary and queue:** load open-order, pick-ready, packed, and at-risk
   metrics; list orders with bounded status, search, and limit filters.
3. **Inspect an order:** fetch an order detail, inspect items, locations,
   promised time, current status, version, and event history.
4. **Allocate:** a warehouse manager allocates only an `accepted` order; the API
   records an allocation reference and increments the order version.
5. **Pick:** a picker records item quantities for allocated/picking orders;
   unknown SKUs, missing quantities, and over-picking fail without changing the
   order. Partial picks remain `picking`; completing every line advances to
   `picked`.
6. **Pack:** a packer may pack only a fully picked order. The API creates a
   synthetic package ID and records the timestamp.
7. **Ship:** a packer or warehouse manager may ship only a packed order. The API
   creates a `ParcelPilot`-shaped simulation and `SIM-*` tracking number; no
   carrier request is made.
8. **Return:** a warehouse manager may return only a shipped order and must
   provide a supported reason.
9. **Recover:** API/network failures preserve existing page state where
   possible and show safe model messages; refresh/retry reloads server data.
   Stale versions, denied roles, invalid transitions, and duplicate-key
   conflicts are surfaced without presenting a failed action as complete.
10. **Switch data source:** each build selects mock or live API endpoints
    explicitly. Both test modes use a dedicated ephemeral API; they do not
    bypass the backend with browser-generated order state.

Order intake, wave planning, label printing, cancellation, durable persistence,
warehouse/tenant isolation, real identity, live carrier integration, and
PortfolioOps export are not implemented. The current seed repository creates
the initial orders; there is no order-intake API.

### Primary workflow

Precondition: the local UI/API are available, a synthetic profile session is
active, and the seeded order is in a state compatible with the selected action.
A manager allocates; a picker records item picks; a packer packs and simulates
shipment; a manager records a return. Each command validates the session role,
order version/state, payload, and idempotency key before saving a cloned order.
Success updates the UI and records a safe workflow event. Invalid/expired
sessions, roles, transitions, or payloads return a safe error and can be retried
after selecting a valid profile or refreshing; the order remains unchanged on
failure.

```mermaid
sequenceDiagram
    actor Operator
    participant UI as FulfillOps UI
    participant API as NestJS API
    participant Service as FulfillmentService
    participant Repo as In-memory repository
    Operator->>UI: Select role and workflow action
    UI->>API: POST /api/v1/orders/{id}/actions + request/idempotency IDs
    API->>Service: Validate DTO and execute transition
    Service->>Service: Validate role, current state, and replay key
    Service->>Repo: Save next order state
    Repo-->>Service: Saved synthetic order
    Service-->>API: Result or safe failure
    API-->>UI: { data, requestId }
    UI-->>Operator: Updated status or recoverable error
```

## 6. Domain, persistence, and data ownership

The frontend consumes server-owned domain records; its model supplies presentation and synthetic display content. Local UI state cannot replace backend transaction or authorization decisions.

### Domain and data ownership

The backend owns the in-memory order map. A `FulfillmentOrder` contains status,
priority, channel, zone, promised time, items, allocation, package, shipment,
return information, version, and workflow events. `OrderItem` records ordered
and picked quantities. Synthetic profiles contain only a stable role ID and role
code; no password or customer record exists. Session tokens are random and
stored as SHA-256 hashes with expirations. Order state, session state, and
idempotency results reset when the API process restarts; there is no database.

```mermaid
erDiagram
    FULFILLMENT_ORDER ||--|{ ORDER_ITEM : contains
    FULFILLMENT_ORDER ||--o{ ORDER_EVENT : records
    FULFILLMENT_ORDER ||--o| ALLOCATION : may_have
    FULFILLMENT_ORDER ||--o| PACKAGE : may_have
    FULFILLMENT_ORDER ||--o| SHIPMENT : may_have
    FULFILLMENT_ORDER ||--o| RETURN_INFO : may_have
```

## 7. API and internal contracts

The companion API contract is in [fulfillops-backend](https://github.com/gopichand-retail-apps/fulfillops-backend). It remains the authority for request/response shapes; the local typed/validated adapter is in the source map. Keep public paths, status/error envelopes, headers, payload validation, and compatibility tied to that source.

### API-backed mock/live selection

The frontend reads the build-time `VITE_IS_MOCK` flag. The default is `true`.
Mock mode selects `VITE_MOCK_API_BASE_URL`; live-selection mode selects
`VITE_REAL_API_BASE_URL`. Production builds require the selected endpoint to be
explicitly configured; mode selection never falls back to the other endpoint.
The mock and live-selection E2E runs point at separate, isolated test API
instances while making the unselected endpoint unavailable. This proves URL
selection and API-backed workflow routing, not real identity, durable storage,
or a carrier integration. `VITE_API_BASE_URL` is a development-only mock alias.

### API and authorization

Routes are versioned under `/api/v1` and specified by
[`fulfillops-backend/openapi.json`](https://github.com/gopichand-retail-apps/fulfillops-backend/blob/main/openapi.json).
Responses use `{ data, requestId }`; failures use the centralized safe error
envelope. The architecture and API design stay in documentation; the frontend
does not render architecture diagrams or API schemas as product UI.

| Route                                                            | Authorization / behavior                                                                                             |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `GET /health`                                                    | Health and readiness for the local process.                                                                          |
| `GET /auth/profiles`                                             | Development/test only; returns synthetic profile IDs and role codes, never credentials.                              |
| `POST /auth/session`                                             | Development/test only; validates profile ID, rotates an existing session, and sets an HttpOnly cookie.               |
| `POST /auth/logout`                                              | Revokes the current in-memory session and expires the cookie.                                                        |
| `GET /summary`, `GET /orders`, `GET /orders/:id`, `GET /returns` | Read-only synthetic workspace data; order lists are bounded to 50.                                                   |
| `POST /orders/:id/actions`                                       | Requires a valid session cookie, action-specific role, idempotency key, current order version, and DTO-valid action. |

Role policy is enforced on the server: `warehouse_manager` allocates and records
returns; `picker` picks; `packer` packs and ships; managers may ship. Unknown
profile IDs are rejected; no client-supplied role header grants privileges.
Invalid transitions and unauthorized actions are rejected without changing the
order. A replay with the same idempotency key and fingerprint returns the
previous result; reusing a key for another action is a conflict.

#### State transitions and role matrix

```mermaid
stateDiagram-v2
    [*] --> accepted: seeded intake
    accepted --> allocated: warehouse_manager
    allocated --> picking: picker
    picking --> picking: picker / partial quantity
    picking --> picked: picker / all quantities complete
    picked --> packed: packer
    packed --> shipped: packer or warehouse_manager / simulated carrier
    shipped --> returned: warehouse_manager
```

The API rejects all other transitions. Picks must reference an order SKU and
cannot exceed remaining quantity. Every mutation checks the client-observed
`version` against the server order version and advances it once on success.

#### Synthetic profile/session sequence

```mermaid
sequenceDiagram
    actor Operator
    participant UI as React UI
    participant API as NestJS API
    participant Sessions as DemoSessionService
    Operator->>UI: Open warehouse workspace
    UI->>API: GET /api/v1/auth/profiles
    API-->>UI: Synthetic profile IDs and roles
    UI->>API: POST /api/v1/auth/session {profileId}
    API->>Sessions: Validate profile and revoke previous token
    Sessions-->>API: Random token, store SHA-256 hash and expiry
    API-->>UI: Profile plus HttpOnly Set-Cookie
    UI->>API: POST /orders/{id}/actions plus cookie/version/key
    API->>Sessions: Resolve cookie to server-owned role
    Sessions-->>API: Role code or 401
```

## 8. Security, privacy, and egress

Current release limitation: **All server state resets on API restart. The archived production entry and browser command are incorrect for this Windows setup; use dist/src/main.js and the workspace E2E adapter. Real warehouse authorization and durable state remain absent.**

Only the local simulator controls in the current source are implemented. CORS, a role label, and mode selection do not provide a new production identity boundary.

Keep private credentials out of public models, browser bundles, logs, URLs, and source archives. No additional runtime network destination or external service is configured. Keep logs limited to the source-defined request/trace and safe aggregate fields. Backups, retention, deletion, and real-user ownership need explicit product/operations decisions before external exposure.

## 9. Design, accessibility, and platform adapters

The existing product styling is authored in [src/App.css](../src/App.css), [src/index.css](../src/index.css). Preserve its tokens, layout density, fonts/assets, breakpoints, and component states. User-facing strings/locale rules follow the active validated model. WCAG 2.2 AA is a target, not a verified conformance claim: keyboard/focus/dialog behavior, zoom/reflow, contrast, reduced motion, and screen readers require their applicable checks. No redesign or new visual measurements were performed here. Native/mobile packaging and device adapters are **not implemented by this web repository**.

## 10. Build, checks, and deployment

Configured npm scripts, from this repository with Node **24.15.0**; use `npm.cmd` in PowerShell:

| Command                    | Actual manifest definition                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| `npm.cmd run dev`          | `vite --host 127.0.0.1 --port 5201 --strictPort`                                               |
| `npm.cmd run build`        | `tsc -b && vite build`                                                                         |
| `npm.cmd run lint`         | `oxlint`                                                                                       |
| `npm.cmd run format:check` | `prettier --check 'src/**/*.{ts,tsx,css}' 'tests/**/*.ts' 'public/**/*.json' '*.{ts,js,json}'` |
| `npm.cmd run typecheck`    | `tsc --noEmit -p tsconfig.app.json`                                                            |
| `npm.cmd run test`         | `vitest run`                                                                                   |
| `npm.cmd run test:cov`     | `vitest run --coverage`                                                                        |
| `npm.cmd run preview`      | `vite preview --host 127.0.0.1 --port 5201 --strictPort`                                       |
| `npm.cmd run test:e2e`     | `playwright test`                                                                              |

Install with `npm.cmd ci` and retain [package-lock.json](../package-lock.json). Registry access is required for a clean dependency installation. These commands describe the configured checks; execution results are listed in section 13.

Frontend address: http://127.0.0.1:5201. API health: http://127.0.0.1:5202/api/v1/health. Vercel uses [vercel.json](../vercel.json) and the documented keys in [.env.vercel.example](../.env.vercel.example). The static output is dist; SPA fallback excludes API/socket paths. The environment example is not automatically loaded under that filename. Public endpoints and mode selectors are build inputs; rebuild/redeploy after changes. A hosted frontend still requires an independently verified API.

CI configuration is listed in section 3. Run the configured checks before merging or releasing. Deployment requires separate verification of the selected hosting environment.

## 11. Architecture decisions and tradeoffs

### Design patterns and decisions

- **Modular monolith:** `FulfillmentModule` contains the order API, service,
  repository interface, in-memory repository, DTOs, and session boundary. There
  are no microservices or cross-app database writes.
- **Repository pattern:** `OrderRepository` abstracts reads and writes;
  `InMemoryOrderRepository` seeds synthetic orders and returns clones so failed
  commands cannot mutate saved state.
- **State machine:** `FulfillmentService` owns legal transitions; React state
  never advances an order by itself.
- **Optimistic concurrency:** each order has a `version`. The API compares the
  submitted version before applying an action and returns `409 STALE_ORDER`
  when the order has changed.
- **Idempotency:** a bounded process-local map fingerprints order, role, action,
  and version. Exact retries return the stored result; key reuse for a different
  action conflicts. The map is not durable and resets on restart.
- **Synthetic session:** the API validates a known profile ID, issues a random
  token in an HttpOnly/SameSite cookie, stores only its hash, and expires it
  after eight hours. Profile switching revokes the prior cookie token. This
  simulates role-bound sessions; it does not verify a real person's identity.
- **Stack decision:** the APP-06 blueprint recommends PostgreSQL persistence,
  but the inspected application is intentionally in-memory. Persistence,
  migrations, outbox, and carrier adapters remain future work; do not infer
  those features from the blueprint.

The two Git repositories remain separate. Each owns one maintained README and this repository-local architecture guide. Shared application behavior may be described here for contract context, but implementation changes belong to the owning source module.

## 12. Requirements traceability

| Capability                      | Acceptance                                                        | Owner/path                         | Current status                                                | Evidence                               | Risk                                                                                                                                                                                                                                              |
| ------------------------------- | ----------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository-local architecture   | Guide available in this checkout and linked from README           | docs/architecture.md; README.md    | Documented and validated                                      | File, link, and diagram checks         | Keep documentation consistent with source changes                                                                                                                                                                                                 |
| UI composition and API boundary | Preserve existing workflows and failure states                    | src/api-errors.ts and source map   | Implemented; application verification limits are listed below | Current source and existing app design | All server state resets on API restart. The archived production entry and browser command are incorrect for this Windows setup; use dist/src/main.js and the workspace E2E adapter. Real warehouse authorization and durable state remain absent. |
| Public deployment               | Verified identity, data durability, recovery, and hosted behavior | Existing deployment/API boundaries | Needs separate hardening/verification                         | No new hosted evidence                 | Local checks do not establish production readiness                                                                                                                                                                                                |

## 13. Dated verification and limitations

Last documentation review: **2026-11-09**. The checks below distinguish documentation validation from application and deployment testing.

- Repository-local guide, README link, source-path references, section/contents anchors, and Mermaid syntax: passed documentation validation.
- New application tests/builds, coverage, dependency audits, browser/device accessibility/performance, hosted CI, and Vercel deployment: **not rerun for the documentation updates**.
- Frontend production builds passed on 2026-11-09 with Node 24.15.0. Build success does not establish that all application quality gates pass.
- Outstanding baseline limit: All server state resets on API restart. The archived production entry and browser command are incorrect for this Windows setup; use dist/src/main.js and the workspace E2E adapter. Real warehouse authorization and durable state remain absent.

The baseline results below record earlier validation. Re-run the listed commands against the current revision before release.

Previously recorded application verification:

No additional per-app verification block existed in the source guide; refer to the original validation ledger.

## 14. Extension rules and companion repository

Start with [README.md](../README.md) and this guide. The companion repository is [fulfillops-backend](https://github.com/gopichand-retail-apps/fulfillops-backend); clone the pair as siblings when using the existing local integration/model contract. This guide is inside the current repository and does not depend on a parent-folder architecture file to exist.

Update this guide when owned source, routes, persistence, identity, UI states, egress, or deployment behavior changes. Coordinate public contract changes with the companion repository and tests. Preserve existing data, run isolated checks with synthetic records, record failures, and review release and infrastructure changes before publication.
