# FulfillOps Frontend

[Architecture guide](docs/architecture.md) — source map, workflows, contracts, data, security, and checks.

## Repository layout and Windows workflow

This is the FulfillOps React/Vite frontend repository. It keeps its own Git history, origin, package manifest, and lockfile; the API is the independent [fulfillops-backend](https://github.com/gopichand-retail-apps/fulfillops-backend) repository. Place the pair under one FulfillOps folder to use the supplied single-folder VS Code workspace.

Use Node **24.15.0** and npm with the committed lockfile. From this repository in PowerShell:

```powershell
npm.cmd ci
npm.cmd run dev
```

The client is at http://127.0.0.1:5201; start the API separately. For both services in the complete Retail Apps workspace, use `./scripts/Start-Apps.ps1 -App FulfillOps` from the workspace root. Use `-EnvironmentName IT` only for the independent IT copies.

See the [app overview](docs/architecture.md#1-scope-users-and-repository-boundary) and [canonical architecture](docs/architecture.md). The architecture guide is included in this repository. No cross-app backend integration is added by this organization change.

React + TypeScript warehouse console. This is an independent repository from
`fulfillops-backend`; open both in VS Code with `../FulfillOps.code-workspace`.

## Run

```bash
npm ci
npm run dev
```

The Vite server binds to `127.0.0.1:5201` and uses strict port binding. Start the
API separately in `../fulfillops-backend` on `127.0.0.1:5202`.

The source default is `VITE_IS_MOCK=true`. Mock and live-selection modes select
different build-time API URLs: `VITE_MOCK_API_BASE_URL` and
`VITE_REAL_API_BASE_URL`. In local development, mock mode defaults to the
loopback API. Live-selection mode requires an explicit endpoint; it does not
silently fall back. `VITE_API_BASE_URL` remains a development-only mock alias.
These public build-time values are not credentials. The local backend is still
synthetic and in-memory in either mode; `VITE_IS_MOCK=false` is not proof of a
production API, database, or identity provider. See `.env.example`.

## Verify

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:cov -- --coverage.reportsDirectory=/tmp/fulfillops-frontend-coverage
VITE_IS_MOCK=true npm run test:e2e -- --output=/tmp/fulfillops-e2e-mock
VITE_IS_MOCK=false npm run test:e2e -- --output=/tmp/fulfillops-e2e-live
npm audit
npm run build
```

The current frontend suite has 55 tests and passes its 90% aggregate
statements/branches/functions/lines thresholds. Current per-file coverage gaps
are recorded in [validation status](docs/architecture.md#13-dated-verification-and-limitations); the aggregate gate
does not imply that each UI module meets 90%.

The Playwright workflow starts a fresh in-memory API on an isolated port. Run it
with `VITE_IS_MOCK=true` and `VITE_IS_MOCK=false`; in each run, the selected API
must respond while the unselected endpoint is unavailable.

Install the browser once with `npx playwright install chromium`. The browser test
starts both repositories on isolated ports and verifies the API-backed profile
session and allocate -> pick -> pack -> simulated ship -> return workflow in
both `VITE_IS_MOCK=true` and `VITE_IS_MOCK=false` endpoint-selection modes,
including the mobile order-detail view. The nonselected endpoint is unreachable
in each run.

## Demo limits

The role selector is a local simulation, not authentication. All order data is
synthetic and held in backend memory; it resets when the API restarts. The UI
loads synthetic profile options from the selected API. Selecting a profile
creates an HttpOnly server-managed session; profile selection is local-only,
not proof of a real user identity. Shipment tracking is generated locally, not
from a carrier integration. Mode E2E uses an isolated API and proves endpoint
routing, not a production database or identity-provider integration.

## Vercel frontend configuration

Import this frontend's GitHub repository as its own Vercel project. Set **Root Directory** to the repository root (`./`), **Node.js Version** to **24.x**, and keep the checked-in [vercel.json](vercel.json). It selects Vite, dist output, and browser-route fallback with `npm ci` and `npm run build`. The SPA fallback excludes /api and /socket.io so missing backend routes do not return HTML.

Set `VITE_IS_MOCK=true` and `VITE_MOCK_API_BASE_URL` to an approved isolated HTTPS API **base including /api/v1**. For the other selector, set `VITE_IS_MOCK=false` and `VITE_REAL_API_BASE_URL`. The [environment template](.env.vercel.example) lists exact names; it is documentation, not an automatically loaded production configuration. Replace its reserved .invalid host. Changing mode or endpoints requires a new build/deployment. Both selectors still call an API; neither creates a browser-only backend or real provider integration.

Production Vite assets do not contain the development proxy; requests use the configured absolute API URL. A hosted API needs independently verified identity, persistence, exact origin/CORS and session/CSRF settings. Existing APIs remain local-only; localhost in a deployed bundle would point at the visitor or build machine.

The configuration adds noindex, frame/content-type/referrer/permission protections and no-store for the active UI model. Headers and noindex do not provide access control. Keep preview deployment protection enabled and use synthetic data. Hosted routing, cookies, headers, and user workflows have **not** been verified; no deployment is performed.

Known release gaps: All server state resets on API restart. The archived production entry and browser command are incorrect for this Windows setup; use dist/src/main.js and the workspace E2E adapter. Real warehouse authorization and durable state remain absent.
