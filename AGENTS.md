# APP-06 FulfillOps - Agent Instructions

This repository owns the FulfillOps frontend. Before changes, read `~/Downloads/PORTFOLIO_COMPLETE_AGENT_PLAYBOOK.md` and `~/Downloads/APP-06_FULFILLOPS.md`; those are the full architecture, UX, security, and delivery requirements.

## Mandatory Frontend Content Model
All frontend-visible copy and synthetic display content must come from `public/fulfillops-model.json` (`version`, `appId`, `locale`, `messages`, `data`), validated strictly with Zod and fetched with `cache: "no-store"` through the shared provider. Do not retain hardcoded UI copy or English fallbacks. Include accessibility labels, alt text, placeholders, empty/loading/error/success states, and seeded labels. Map API errors by code, never raw messages. Keep workflow states, permissions, and quantities authoritative in the backend. Test model replacement and fail on missing keys.

## Mandatory code quality
- TypeScript strict mode. Avoid `any`, unsafe assertions, unchecked promises, silent error swallowing, and broad lint disables.
- Keep TS/JS/Java lines at or below 120 characters, except documented URLs, schemas, and generated code. Enforce with ESLint `max-len`, Prettier `printWidth`, or Java Checkstyle as applicable.
- Cognitive complexity is at most 15 per function. Control-flow nesting is at most 3 where feasible.
- Target at most 50 logical lines per function, 400 lines per source file except justified compositions/generated code, and 4 positional parameters. Prefer named parameter objects.
- No unused or duplicate code, unreachable branches, hard-coded credentials, production `console.log`, magic business constants, or circular dependencies.
- New-code gate: zero new blocker/critical issues, at most 3% duplication, all security hotspots reviewed, and no high-confidence leaked secrets. Verify actual Sonar rule/edition support; do not assume defaults match.

## Testing and CI
- Enforce at least 90% overall line, statement, function, and branch coverage where practical; at least 95% for critical workflow logic and 90% changed-code coverage. Exclusions must be transparent.
- Test loading/empty/error/success states, keyboard/accessibility, authorization, workflow conflicts, idempotency, concurrency, dependency failure, and recovery as applicable.
- CI must block on formatting, lint, typecheck, unit/integration/E2E, coverage, security/secret/dependency scans, migration validation, build, and configured quality-gate failures. Report skipped checks distinctly.

## Security, logging, and documentation
- Enforce server-side role and warehouse/order ownership on every applicable action; validate untrusted inputs; use transactions for fulfillment state changes and prevent duplicate workflow actions.
- Simulated shipping/payments only. Never log credentials, tokens, raw payloads, or identifying financial data. Use structured success/failure logs with request and trace IDs; verify redaction.
- Maintain canonical `docs/architecture.md` with C4, trust-boundary data flow, ERD/data ownership, API/events, deployment boundaries, and primary workflows including failures and recovery. README covers purpose, roles, local setup, limits, and versioned integrations.
- Never claim security or compliance based only on checklists or automated scans.
