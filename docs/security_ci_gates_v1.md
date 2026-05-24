# EIP V1 CI/CD And Supply-Chain Security Gates

Date: 2026-05-24

## Purpose

Prompt 7 adds high-signal CI gates for V1 hosted deployment work. The goal is to catch security-critical regressions before merge/deploy without turning known legacy lint debt into noisy failures.

## Root Gap Summary

- Existing CI only ran process alignment.
- API security tests existed, but CI did not explicitly run the security-critical subset.
- Dependency audits were manual and currently include known high/critical production advisories.
- Secret scanning and focused static security checks were not automated.
- Dashboard compile health was not checked before hosted deployment.

## Blocking Gates

Workflow: `.github/workflows/security-gates.yml`

| Job | Blocking | What It Checks |
| --- | --- | --- |
| `lockfile-integrity` | Yes | `npm ci --ignore-scripts` for the root workspace and Samara app lockfile |
| `dependency-audit` | Yes | Fails on new high/critical production npm advisories outside `tools/security/npm_audit_baseline.json` |
| `security-regression` | Yes | Secret scan, static security checks, and API security regression tests |
| `dashboard-build` | Yes | Dashboard production build smoke test |

## Commands

Run locally before pushing security-sensitive changes:

```text
npm ci --ignore-scripts
npm ci --ignore-scripts --prefix apps/samara-web/my-vite-react-app
npm run security:secrets
npm run security:static
npm run security:audit
npm --workspace @eip/core-api run test:security
npm --workspace dashboard run build
```

## API Security Regression Suite

`npm --workspace @eip/core-api run test:security` covers:

- auth cookie policy for hosted cross-origin and local dev
- session step-up policy
- passkey RP/origin serialization safety
- owner/admin versus tenant surface partitioning
- public gateway verification modes and negative paths
- raw body HMAC validation
- timestamp, origin, replay/idempotency, suffix/profile rejection
- tenant and connection isolation/BOLA checks
- signed asset tenant boundaries
- secret storage rotation/revocation behavior
- security audit event redaction and persistence
- connection API key create/rotate/revoke leakage checks
- Admin > Audit pagination/filter regressions

## Dependency Audit Baseline

The audit gate is intentionally staged:

- It is blocking for new high/critical production advisories.
- Current high/critical advisories are explicit in `tools/security/npm_audit_baseline.json`.
- If a baseline advisory is fixed, CI fails until the stale baseline entry is removed. This prevents fixed issues from silently becoming allowed again later.
- Moderate/low advisories are reported by npm but are not blocking in this wave.

Do not add to the baseline casually. A new baseline entry should have a linked remediation issue or an explicit short-term exception rationale.

## Secret Scan

`tools/security/scan_secrets.mjs` blocks high-confidence committed secrets such as:

- private key blocks
- AWS access key ids
- GitHub tokens
- Google API keys
- Stripe live secret keys
- Brevo API keys
- Slack tokens

The scanner prints only file, line, and rule id. It does not print matched secret values.

## Static Checks

`tools/security/static_security_checks.mjs` blocks high-confidence unsafe patterns:

- dynamic `eval`
- `new Function`
- disabled Node TLS verification
- `rejectUnauthorized: false`
- `SameSite=None` cookies with `secure: false`
- removal of required security test files

This is intentionally narrower than full repo linting. Full dashboard lint still has unrelated legacy debt and is not used as a Prompt 7 security gate.

## Failure Handling

- Lockfile failure: run the matching `npm install` in the affected app/root, review lockfile changes, and commit them.
- Dependency audit failure: upgrade the vulnerable package when possible. If a short-term exception is unavoidable, add it to `tools/security/npm_audit_baseline.json` with review.
- Secret scan failure: remove the secret from Git, rotate it if it was real, and use Railway/GitHub variables.
- Static check failure: remove the unsafe pattern or add a very narrow `security-static-ignore` only with a clear code comment.
- API security test failure: fix the regression before deploy.
- Dashboard build failure: fix compile/package issues before Railway redeploy.

## Deferred

- CodeQL/Semgrep-style broad SAST after current legacy lint debt is reduced.
- SBOM generation and artifact signing.
- Automated issue creation for dependency baseline debt.
- External alerting for CI security failures.
