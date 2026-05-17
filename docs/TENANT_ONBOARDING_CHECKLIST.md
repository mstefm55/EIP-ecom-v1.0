# Tenant Onboarding Checklist (Production)

Use this checklist for every new tenant. Mark each item after completion.

## 1) Platform prerequisites
- [ ] All migrations applied through `0061` (includes portfolio + ecommerce attribute dropdowns).
- [ ] `ui_surface_admin.sql` and `ui_surface_dashboard.sql` seeded.
- [ ] Jurisdiction seed loaded (`jurisdiction_iso_seed.sql`).
- [ ] Process builder offline note accepted; process_def seeded by SQL until UI builder is ready.

## 2) Admin and access
- [ ] Executive admin identity created and assigned `ADMIN_EXEC` + `ADMIN_SUPER`.
- [ ] Admin portfolio created (exec can see all tenants).
- [ ] Associate admins assigned to portfolios if applicable.
- [ ] Sensitive access token flow verified (consume + clear).

## 3) Tenant creation
- [ ] Tenant request approved and tenant row created.
- [ ] Tenant admin identity created and can log in.
- [ ] Tenant agreements and environment settings set.

## 4) Process engine readiness (seeded by SQL)
- [ ] `process_def` seeded for SALES_ORDER lifecycle.
- [ ] `process_def` seeded for PAYMENT lifecycle.
- [ ] `process_def` seeded for DELIVERY (digital or physical).
- [ ] Task templates created and active for each process.
- [ ] Process bindings created and active for each service object type.
- [ ] Process effects use only governed dropdown values.

## 5) UI engine readiness
- [ ] UI surfaces exist for admin and tenant dashboard.
- [ ] Task forms are mapped to schema/ui metadata.
- [ ] Task click opens the correct form UI and submits to the process engine.
- [ ] All module screens are UI-engine driven (surface JSON is the source of truth; no hardcoded panels). Exception: Admin Console and Authentication/Authorization modules.

## 6) Commerce data (base)
- [ ] Products created in `eip_core.material` (digital or physical).
- [ ] Attributes populated using `PRODUCT_ATTRIBUTE` dropdown list.
- [ ] Commercial conditions seeded (PRICE, TAX, DISCOUNT, TERMS).
- [ ] Content artifacts uploaded for digital products (content repository).
- [ ] Access grant flow verified for digital delivery (if applicable).

## 7) Gateway and integration
- [ ] Connection profile created (inbound path suffix, method, content type).
- [ ] One verification mode configured (api_key OR hmac OR oauth2_jwt).
- [ ] Idempotency keys defined for order/payment intake.
- [ ] CORS allowlist includes tenant domain.

## 8) End-to-end tests
- [ ] Catalog fetch returns products.
- [ ] Quote returns pricing + tax.
- [ ] Order intake creates a service_object + process_instance.
- [ ] Payment intake creates a service_object + process_instance.
- [ ] Info_record audit trail exists for each step.

## 9) Go-live checks
- [ ] DNS + TLS ready for tenant domain.
- [ ] Monitoring and alerts active.
- [ ] Backup policy verified.
