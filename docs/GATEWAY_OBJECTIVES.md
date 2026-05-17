# Gateway Objectives (Working Notes)

## Scope
- Gateway is the single immigration office for all external traffic (landing pages, ecommerce, portals, social, webhooks, partner APIs).
- No new root namespaces. Use:
  - Public: `/api/public/*`
  - ERP: `/api/eip/*`
  - Integration: `/api/edi/*`

## Data & Storage
- Prefer existing kernel tables before adding new ones.
- Connection profile + allowlist live in `eip_core.tenant.attrs` under `connection_profile` and `allowed_origins`.
- Mapping dictionary lives in `eip_core.ui_surface.attrs.mapping` (per template).
- Handshake events are logged in `eip_core.info_record` with `record_type = 'gateway_handshake'`.

## Controls
- Public intake uses tenant code, rate limits, and writes to audit/info records only.
- Plug-and-play requires API key + origin allowlist (unless server-to-server with no Origin header).
- Gateway never writes to CRM/module tables directly.

## UI Engine Alignment
- External embeds consume `public/gateway/bootstrap` + `public/gateway/manifest`.
- Renderer must bind data via mapping dictionary before rendering.
- All new module UIs must be surface-driven (no hardcoded panels); surface JSON remains the source of truth. Exception: Admin Console and Authentication/Authorization modules.

## Pending
- No DB migrations beyond 0046 executed until approval.
- Re-evaluate any new schema needs only after existing-table approach is validated.
