# Multi-Tenant Storefront Migration Matrix

## Scope
Migrate diverse tenant websites to EIP schema-driven storefront contracts without hardcoded section/page keys.

Target model:
- EIP stores `storefront_schema` (pages, zones, components, field rules).
- EIP stores content by `zone_key`.
- Tenant runtime renders via stack adapter (React/Next/Vue/CMS/legacy).
- Publish flow is versioned (draft -> review -> published -> rollback).

---

## 1) Stack Migration Matrix

| Stack archetype | Typical tenant state | Main barriers | Adapter strategy | Mandatory deliverables | Migration risk |
|---|---|---|---|---|---|
| React/Vite SPA | Client-side routing, fetch-based data | Hardcoded slot maps, global CSS collisions | EIP React SDK or schema hook + generic renderer map | Dynamic nav/page builder, zone renderer registry, event bridge | Medium |
| Next.js (SSR/SSG) | Mixed server/client rendering | SSR hydration mismatch, route params, cache revalidation | Next adapter with server fetch for schema/content + client hydration boundaries | SSR-safe schema fetch, ISR cache invalidation, SEO metadata mapper | High |
| Vue/Nuxt | Composition API, plugin-heavy | Plugin lifecycle order, SSR in Nuxt | Vue/Nuxt adapter + composables for schema/content | Route guard integration, renderer components, publish cache policy | Medium-High |
| WordPress/PHP CMS | Template-based pages + plugin scripts | Uncontrolled plugins, shortcodes, mixed content ownership | Headless mode + embeddable Web Components from EIP | Template block injector, shortcode migration map, script isolation policy | High |
| Static/JQuery legacy | No framework, manual DOM scripts | DOM fragility, no state model, no typed contracts | Web Components only + thin boot script | Zone mount map, event bus shim, asset path normalizer | High |
| Custom backend-rendered (Java/.NET/etc.) | Server templates + API mashups | Auth/session coupling, partial server rendering | Server-side schema fetch + server template renderer + client islands | Session/CORS contract map, CSRF rules, component renderer parity | High |

---

## 2) Data and Contract Mapping Matrix

| Domain | Source diversity problem | Required target contract | Validation gate |
|---|---|---|---|
| Site structure | Different page names/routes per tenant | `storefront_schema.pages[]` with stable `page_id`, `route` | Schema lint: unique page ids/routes |
| Sections/zones | Hardcoded keys in code | `zones[]` with stable `zone_key`, `renderer_type`, `fields` | Zone lint: allowed renderer + required fields |
| Content | Mixed field names (`heroTitle`, `headline`, etc.) | Canonical field schema per renderer type | Content lint: unknown fields blocked |
| Media | Different CDNs/paths/transforms | EIP signed asset URL + tenant ownership checks | Asset lint: tenant-bound URLs only |
| Auth/member | Cookie/session differences | Explicit member auth contract + CSRF contract | Security tests: session isolation, CSRF, origin checks |
| Commerce events | Different order/checkout payloads | Canonical event contracts (`order.create`, `payment.start`, etc.) | Event contract tests + replay idempotency |
| i18n | Inconsistent locale fallback | Locale key contract (`locale`, `fallback_locale`) | i18n tests per locale |
| SEO | Different SSR metadata paths | Canonical metadata fields per page/zone | SEO snapshot diff checks |

---

## 3) Tenant Readiness Checklist (Go/No-Go)

Use this checklist per tenant before cutover.

### A. Discovery (must pass all)
- [ ] Stack type classified (React/Next/Vue/WordPress/legacy/custom).
- [ ] Route inventory completed (all public routes mapped).
- [ ] Existing sections inventoried with owners (marketing/ecom/blog/etc.).
- [ ] Custom scripts/plugins inventory complete.
- [ ] Auth/session model documented (cookies, CSRF, CORS origins).

### B. Contract Freeze (must pass all)
- [ ] `storefront_schema` created for tenant (draft version).
- [ ] Every page has unique `page_id` and route.
- [ ] Every zone has `zone_key`, `renderer_type`, field schema.
- [ ] No hardcoded section keys remain in tenant runtime.
- [ ] Blog strategy decided: in-app authoring + EIP persistence (or alternate explicit path).

### C. Adapter Readiness (must pass all)
- [ ] Stack adapter implemented and versioned.
- [ ] Renderer registry supports all used `renderer_type`.
- [ ] Unsupported components explicitly blocked (not silently ignored).
- [ ] Dynamic nav and page loading from schema works.
- [ ] Preview mode and published mode both validated.

### D. Data Migration (must pass all)
- [ ] Automated extractor/importer run completed.
- [ ] Unmapped sections count = 0 (or explicitly waived with owner sign-off).
- [ ] Media URLs re-signed and tenant-scoped.
- [ ] i18n content migrated for required locales.
- [ ] Blog posts/history migrated or intentionally excluded with sign-off.

### E. Quality Gates (must pass all)
- [ ] Functional tests: navigation, content rendering, auth, checkout.
- [ ] Contract tests: schema/content/event APIs.
- [ ] Security tests: origin, CSRF, session isolation, tenant boundary checks.
- [ ] Performance tests: LCP/CLS/FID budget per tenant homepage and key routes.
- [ ] Visual regression baseline approved.

### F. Cutover Readiness (must pass all)
- [ ] Blue/green or reversible switch in place.
- [ ] Rollback command tested within 5 minutes.
- [ ] Monitoring dashboards live (errors, latency, auth failures, checkout success).
- [ ] On-call owner assigned for cutover window.
- [ ] Business owner sign-off recorded.

If any item fails -> **No-Go**.

---

## 4) Cutover and Rollback Runbook (Per Tenant)

### Cutover steps
1. Publish schema version `N`.
2. Publish content version `N`.
3. Enable adapter route switch (blue -> green).
4. Run smoke suite (home, key pages, auth, checkout, blog post create).
5. Monitor 15-30 minutes with elevated alerts.

### Rollback criteria
- Checkout failure rate above threshold.
- Auth/member failures above threshold.
- Tenant boundary/security anomaly.
- Critical rendering/SEO break.

### Rollback steps
1. Switch traffic back to prior runtime.
2. Re-pin to previous schema/content published versions.
3. Invalidate caches.
4. Open incident ticket + root cause log.

---

## 5) Minimum Automation Required

- Schema linter (uniqueness, renderer/field validation).
- Content linter (required fields, unknown field rejection).
- Contract tests for public/admin APIs.
- Visual regression snapshots.
- Synthetic probes for each tenant route set.
- Migration importer with unmapped-section report.

---

## 6) Risk Register (Top Issues)

1. **Hidden custom scripts** in legacy/CMS pages break after migration.
   - Mitigation: script inventory + explicit denylist/allowlist.
2. **SSR hydration mismatch** in Next/Nuxt.
   - Mitigation: strict server/client boundary and snapshot tests.
3. **Cross-tenant leakage** via cached content or mis-scoped assets.
   - Mitigation: tenant-scoped cache keys, signed URLs, boundary tests.
4. **Auth drift** across origins/subdomains.
   - Mitigation: explicit cookie/CORS/CSRF matrix per tenant domain.
5. **Silent fallback behavior** masking missing schema/zone content.
   - Mitigation: fail-closed behavior (`SCHEMA_NOT_CONFIGURED`, `ZONE_NOT_CONFIGURED`).

---

## 7) Operating Rule

In multi-tenant production:
- No hardcoded section names.
- No implicit fallback rendering.
- No unversioned schema/content changes.

All structure changes must be done through Structure Studio and published as versioned contracts.
