# FulfillOps Frontend

React + TypeScript warehouse console. This is an independent repository from
`fulfillops-backend`; open both in VS Code with `../FulfillOps.code-workspace`.

## Run

```bash
npm install
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
are recorded in [`../docs/quality.md`](../docs/quality.md); the aggregate gate
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