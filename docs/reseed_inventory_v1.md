# EIP V1 Post-Migration Reseed Inventory

This inventory is for fresh Railway restores after `npm run migrate` has applied the SQL migration chain under `services/api/db/migrations`.

The controlled reseed path is intentionally narrow:

1. Run schema migrations first.
2. Seed the first owner admin from explicit env vars.
3. Seed global UI surfaces only when missing.
4. Verify process/effect taxonomy, including child service object creation support.
5. Seed the ecommerce template tenant and canonical clone-ready process metadata.

Samara tenant onboarding and connection setup are intentionally not part of this reseed runner. Use the Admin UI tenant onboarding, template clone, and Connections panels for that operational path.

Do not blindly execute every SQL file in this repo. Some files are generators, stale support seeds, demo samples, clone scripts with hardcoded tenant codes, or one-off backfills.

## Recommended Railway Run Order

From the Railway shell for `services/api`:

```bash
npm run migrate
OWNER_TENANT_CODE="eip" OWNER_TENANT_NAME="EIP Owner" OWNER_ADMIN_EMAIL="owner@example.com" OWNER_ADMIN_PASSWORD="replace-with-strong-password" OWNER_ADMIN_NAME="Owner Admin" npm run reseed:post-migration -- --stage owner-admin
npm run reseed:post-migration -- --stage ui-surfaces --stage process-engine --stage template-tenant
```

`owner-admin` is kept explicit because it creates or repairs the definitive live owner/admin tenant and requires a real tenant code, tenant name, email, and password. Do not use this runner to create or connect Samara.

## Runner Stages

| Stage | What it does | Default safety |
|---|---|---|
| `owner-admin` | Runs `services/api/scripts/seed_first_admin.mjs` with `OWNER_TENANT_CODE`, `OWNER_TENANT_NAME`, `OWNER_ADMIN_EMAIL`, `OWNER_ADMIN_PASSWORD`, and optional `OWNER_ADMIN_NAME` / `OWNER_ADMIN_RESET_PASSWORD=true`. It creates or resolves the live owner/admin tenant and grants `ADMIN_SUPER` there. | Safe auto-run when env vars are supplied. |
| `ui-surfaces` | Applies `ui_surface_admin.sql` and `ui_surface_dashboard.sql` only if a published global surface for that code is missing. | Safe auto-run with guards. |
| `process-engine` | Verifies process tables, governed effect taxonomy, child service object effect support, and static UI/process action alignment using API-local files. | Safe verification only. |
| `template-tenant` | Applies `tenant_template_ecom.sql`, `jurisdiction_iso_seed.sql`, `template_ecom_process.sql`, and `template_ecom_canonical_v1.sql`, then verifies canonical processes, bindings, task templates, and template-scoped effect governance. | Safe auto-run/idempotent. |

## Category Legend

| Category | Meaning |
|---|---|
| safe auto-run | Safe for the controlled runner or migration runner. |
| conditional/manual | Useful, but requires tenant, identity, or business confirmation. |
| generator-only / support-only | Generates or validates seed output, or supports manual debugging. Do not execute against DB as seed data. |
| backfill-only / one-off | Changes existing business data and should only run after manual review. |
| skip | Not compatible with the current schema or intentionally excluded from reseed automation. |

## Seed and Support Sources

| Path | Purpose | Category | Dependencies | Owner admin | Process/effect engine | Template tenant | Samara |
|---|---|---|---|---|---|---|---|
| `services/api/scripts/seed_first_admin.mjs` | Creates or repairs the definitive live owner/admin tenant, admin agent, auth identity, password credential, identity-agent link, user profile, and `ADMIN_SUPER` role/grant. The same email can be seeded in other tenants because identities remain tenant-scoped. | safe auto-run | Migrated auth/authz tables, `OWNER_TENANT_CODE`, `OWNER_TENANT_NAME`, `OWNER_ADMIN_EMAIL`, `OWNER_ADMIN_PASSWORD`; optional `OWNER_ADMIN_NAME`, `OWNER_ADMIN_RESET_PASSWORD=true`. | Yes | No | No | No |
| `services/api/db/seed/tenant_template_ecom.sql` | Creates or refreshes template tenant `eip_ecom` and marks it as the canonical V1 clone source. | safe auto-run | `eip_core.tenant`. | No | No | Yes | Indirect |
| `services/api/db/seed/jurisdiction_iso_seed.sql` | Seeds global ISO country jurisdictions generated from public country/timezone sources. | safe auto-run | `eip_core.jurisdiction`, migration `0052`. | No | No | Yes | Indirect |
| `services/api/db/seed/template_ecom_process.sql` | Seeds ecommerce template process actions, process definitions, task templates, and process bindings for `eip_ecom`. Includes product, order, return, refund, and payment flows. | safe auto-run | `eip_ecom` tenant, process/task/binding tables, governed dropdowns. | No | Yes | Yes | Indirect |
| `services/api/db/seed/template_ecom_canonical_v1.sql` | Rebuilds the definitive V1 `eip_ecom` template baseline after the base seed. It upserts canonical product, sales order, payment, return, refund, and storefront content processes; task templates; process bindings; and template-scoped effect governance, including child service object creation for order return/refund requests. | safe auto-run | `eip_ecom` tenant, process/task/binding tables, dropdown governance, migrated effect handlers. | No | Yes | Yes | Indirect |
| `services/api/db/seed/ui_surface_admin.sql` | Seeds published global Admin UI surface. File itself increments versions on each run, so the runner guards it. | safe auto-run with guard | `eip_core.ui_surface`, migration `0046`. | Yes | Yes | No | No |
| `services/api/db/seed/ui_surface_dashboard.sql` | Seeds published global Dashboard UI surface. File itself increments versions on each run, so the runner guards it. | safe auto-run with guard | `eip_core.ui_surface`, migration `0046`. | Yes | Yes | No | No |
| `services/api/db/seed/clone_template_to_tenant.sql` | Legacy manual clone SQL. It hardcodes `source_code='eip_ecom'` and `target_code='t_ed6019735b2f'`. Do not use it for Samara onboarding; use Admin > Templates instead. | skip for Samara | Manual SQL review only. | No | Yes | Yes | No |
| `services/api/db/seed/grant_ecom_admin.sql` | Grants `ECOM_ADMIN` to a hardcoded email in `eip_ecom`. | conditional/manual | Edit tenant code and login email; identity and role must already exist. | Maybe | No | Yes | No |
| `services/api/db/seed/plug_play_sample.sql` | Demo SDUI mapping, sample service object, and plug-and-play UI surface for tenant `eip`. | conditional/manual | Demo tenant `eip`; should stay separate from owner/admin and Samara production data. | No | No | No | No |
| `services/api/scripts/backfill_ecom_product_materials.sql` | Backfills materials from existing product service objects and links them. | backfill-only / one-off | Manual review of existing product/material data. | No | Supports product flow after review | No | Possible after review |
| `services/api/scripts/migrate.mjs` | Ordered SQL migration runner with psql meta-command stripping and `schema_migrations` ledger. | generator-only / support-only | DB env vars. | Supports | Supports | Supports | Supports |
| `services/api/scripts/smoke_clone_ecom_template.mjs` | Parameterized smoke clone/verification script for proving `eip_ecom` can clone into a disposable tenant. It copies only tenant smoke metadata, template-scoped process governance, canonical process defs, active task templates, and active process bindings. | conditional/manual | DB env vars, `SMOKE_CLONE_TARGET_TENANT_CODE`/`--target-code`, `SMOKE_CLONE_TARGET_TENANT_NAME`/`--target-name`; optional source code defaults to `eip_ecom`. | No | Yes | Yes | No |
| `services/api/scripts/enrich_jurisdiction_currency.mjs` | Fetches currency data from Rest Countries and enriches jurisdiction attrs. | conditional/manual | Network access, existing jurisdictions. | No | No | Optional | Optional |
| `services/api/scripts/migrate_gateway_inbound_security.mjs` | One-off migration for existing tenant connection profiles; can generate API keys and a local report. | backfill-only / one-off | Existing connection profiles and manual secret handling. | No | No | No | Possible after review |
| `services/api/scripts/bootstrap.mjs` | Local HTTP helper for authz bootstrap using supplied cookies and CSRF. | generator-only / support-only | Running API and valid local session cookies. | Maybe | No | No | No |
| `tools/build_ui_surface_admin_seed.mjs` | Generates `ui_surface_admin.sql` from dashboard surface source. | generator-only / support-only | Dashboard source files; do not run in Railway restore. | No | Supports UI surface seed | No | No |
| `tools/build_jurisdiction_seed.mjs` | Generates `jurisdiction_iso_seed.sql` from public country/timezone sources. | generator-only / support-only | Network access; do not run in Railway restore unless regenerating seed file intentionally. | No | No | Supports | No |
| `tools/validate_process_alignment.mjs` | Local development helper that checks dashboard commerce actions are covered by template process definitions. Railway reseed uses the API-local copy of this check inside `services/api/scripts/reseed_post_migration.mjs`. | generator-only / support-only | Full repo checkout with repo-level `tools/`. | No | Yes | Yes | No |

## Migration Chain Inventory

These files are owned by `npm run migrate`. They should not be rerun independently by the post-migration reseed runner unless a restore is being rebuilt from scratch through the migration ledger.

| Path | Purpose | Category | Dependencies | Owner admin | Process/effect engine | Template tenant | Samara |
|---|---|---|---|---|---|---|---|
| `services/api/db/migrations/0001_init.sql` | Initial schemas/extensions. | safe auto-run | Migration order. | Support | Support | Support | Support |
| `services/api/db/migrations/0002_core_kernel.sql` | Core tenant, agent, service object, and party tables. | safe auto-run | Prior migrations. | Yes | Support | Yes | Yes |
| `services/api/db/migrations/0003_seed_minimal.sql` | Minimal `eip_demo` seed data. | safe auto-run | Core kernel. | Yes | Support | No | No |
| `services/api/db/migrations/0004_process_and_tasks.sql` | Process definition and task runtime tables. | safe auto-run | Core kernel. | No | Yes | Yes | Yes |
| `services/api/db/migrations/0005_governance_registry_dropdown_bundle.sql` | Schema registry, bundles, and dropdown tables. | safe auto-run | Core kernel. | No | Yes | Yes | Yes |
| `services/api/db/migrations/0006_seed_governance_core_bundle.sql` | Core governance bundle seed. | safe auto-run | Governance tables. | No | Yes | Yes | Yes |
| `services/api/db/migrations/0007_entity_subtables.sql` | Entity subtype tables. | safe auto-run | Core kernel. | No | Support | Support | Support |
| `services/api/db/migrations/0008_execution_status_events.sql` | Execution status/event support. | safe auto-run | Core/process tables. | No | Yes | Support | Support |
| `services/api/db/migrations/0009_execution_status_dropdowns.sql` | Execution status dropdown values. | safe auto-run | Dropdown tables. | No | Yes | Support | Support |
| `services/api/db/migrations/0010_process_binding.sql` | Process binding table. | safe auto-run | Process definitions. | No | Yes | Yes | Yes |
| `services/api/db/migrations/0011_task_template.sql` | Task template table. | safe auto-run | Process definitions. | No | Yes | Yes | Yes |
| `services/api/db/migrations/0012_process_instance.sql` | Runtime process instance table. | safe auto-run | Process definitions. | No | Yes | Support | Support |
| `services/api/db/migrations/0013_core_bundle_v1.sql` | Core V1 bundle seed for `eip_demo` by tenant code. | safe auto-run | Tenant `eip_demo`, governance tables. | Support | Yes | No | No |
| `services/api/db/migrations/0014_asset_skeleton.sql` | Asset base tables. | safe auto-run | Core kernel. | No | No | Support | Support |
| `services/api/db/migrations/0015_asset_dropdowns.sql` | Asset dropdown values. | safe auto-run | Dropdown tables. | No | No | Support | Support |
| `services/api/db/migrations/0016_material_skeleton.sql` | Material base tables. | safe auto-run | Core kernel. | No | Support | Yes | Yes |
| `services/api/db/migrations/0017_material_dropdowns.sql` | Material dropdown values. | safe auto-run | Dropdown tables. | No | Support | Yes | Yes |
| `services/api/db/migrations/0018_info_record.sql` | Info/audit record table. | safe auto-run | Core kernel. | No | Support | Support | Yes |
| `services/api/db/migrations/0019_object_link.sql` | Generic object links. | safe auto-run | Core kernel. | No | Yes | Support | Support |
| `services/api/db/migrations/0020_link_dropdowns.sql` | Link semantic dropdown values. | safe auto-run | Dropdown tables. | No | Yes | Support | Support |
| `services/api/db/migrations/0021_core_bundle_v2.sql` | Core V2 bundle seed for `eip_demo` by tenant code. | safe auto-run | Tenant `eip_demo`, governance tables. | Support | Yes | No | No |
| `services/api/db/migrations/0022_auth_schema.sql` | Auth schemas. | safe auto-run | Initial schemas. | Yes | No | No | No |
| `services/api/db/migrations/0022b_agent_tenant_unique.sql` | Agent tenant uniqueness patch. | safe auto-run | Agent table. | Yes | No | No | No |
| `services/api/db/migrations/0023_auth_core_tables.sql` | Auth identities, credentials, sessions, and identity-agent links. | safe auto-run | Auth schema, core tenant/agent. | Yes | No | No | No |
| `services/api/db/migrations/0024_authz_scaffold.sql` | Authz roles, permissions, identity roles, and menus. | safe auto-run | Auth/core tables. | Yes | Support | Support | Support |
| `services/api/db/migrations/0025_authz_seed_and_bootstrap.sql` | Authz seed and bootstrap grants. | safe auto-run | Authz scaffold. | Yes | Support | Support | Support |
| `services/api/db/migrations/0026_authz_wiring.sql` | Authz wiring. | safe auto-run | Authz scaffold. | Yes | Support | Support | Support |
| `services/api/db/migrations/0027_authz_permissions.sql` | Permission catalog seed. | safe auto-run | Authz scaffold. | Yes | Support | Support | Support |
| `services/api/db/migrations/0028_core_content_repository.sql` | Content repository tables. | safe auto-run | Core kernel. | No | Support | Support | Yes |
| `services/api/db/migrations/0029_authz_ecom_seed.sql` | Ecommerce authz seed using tenant code and conditional identity grants. | safe auto-run | Authz tables, tenant `eip_demo`. | Support | No | Support | Support |
| `services/api/db/migrations/0030_service_object_status_scoped_values.sql` | Service object status dropdown values. | safe auto-run | Dropdown tables. | No | Yes | Support | Support |
| `services/api/db/migrations/0031_smart_socket_ss2.sql` | Smart socket commerce schema. | safe auto-run | Core schemas. | No | Support | Support | Yes |
| `services/api/db/migrations/0032_auth_session_attrs_realm.sql` | Auth session realm/attrs patch. | safe auto-run | Auth sessions. | Yes | No | No | No |
| `services/api/db/migrations/0033_auth_api_key_integration.sql` | Auth API key integration tables. | safe auto-run | Auth/core tables. | No | No | No | Yes |
| `services/api/db/migrations/0034_socket_channel_registry.sql` | Socket channel registry. | safe auto-run | Commerce schema. | No | No | Support | Yes |
| `services/api/db/migrations/0035_socket_channel_origin_allowlist.sql` | Socket origin allowlist. | safe auto-run | Socket channel registry. | No | No | Support | Yes |
| `services/api/db/migrations/0036_auth_password_permission.sql` | Password permission seed. | safe auto-run | Authz scaffold. | Yes | No | No | No |
| `services/api/db/migrations/0037_tenant_onboarding.sql` | Tenant request/onboarding tables. | safe auto-run | Core tenant. | Yes | No | Support | Yes |
| `services/api/db/migrations/0038_tenant_agreement.sql` | Tenant agreement table. | safe auto-run | Tenant onboarding. | Yes | No | Support | Yes |
| `services/api/db/migrations/0039_crm_process_v1.sql` | CRM process V1 seed. | safe auto-run | Process tables, dropdowns. | No | Yes | No | No |
| `services/api/db/migrations/0040_authz_crm_permissions.sql` | CRM permissions. | safe auto-run | Authz scaffold. | Support | No | No | No |
| `services/api/db/migrations/0041_core_process_permissions.sql` | Core process permissions. | safe auto-run | Authz scaffold. | Support | Yes | No | No |
| `services/api/db/migrations/0042_dropdown_values_patch.sql` | Dropdown value patch. | safe auto-run | Dropdown tables. | No | Support | Support | Support |
| `services/api/db/migrations/0043_authz_crm_role_bundles.sql` | CRM role bundles. | safe auto-run | Authz scaffold. | Support | No | No | No |
| `services/api/db/migrations/0044_gateway_idempotency.sql` | Gateway idempotency table. | safe auto-run | Core schema. | No | No | No | Yes |
| `services/api/db/migrations/0045_gdpr_privacy_tables.sql` | GDPR/privacy tables. | safe auto-run | Auth/core tables. | Support | No | No | Support |
| `services/api/db/migrations/0046_ui_surface_engine.sql` | UI surface table. | safe auto-run | Core tenant. | Yes | Yes | Support | Support |
| `services/api/db/migrations/0047_mapping_registry_and_tenant_origin.sql` | Mapping registry and tenant origin support. | safe auto-run | UI surface/core tenant. | No | Support | Support | Yes |
| `services/api/db/migrations/0048_handshake_log.sql` | Handshake log. | safe auto-run | Core schema. | No | No | No | Yes |
| `services/api/db/migrations/0049_tenant_connection_profile.sql` | No-op; documents that connection profiles live in tenant attrs. | safe auto-run | None. | No | No | No | Yes |
| `services/api/db/migrations/0050_connection_permissions.sql` | Connection management permissions. | safe auto-run | Authz scaffold. | Yes | No | No | Yes |
| `services/api/db/migrations/0051_commercial_conditions.sql` | Commercial condition table. | safe auto-run | Core tenant. | No | Support | Yes | Yes |
| `services/api/db/migrations/0052_jurisdiction.sql` | Jurisdiction table. | safe auto-run | Core tenant. | No | No | Yes | Yes |
| `services/api/db/migrations/0053_document_registry.sql` | Document registry table. | safe auto-run | Core tenant. | No | Support | Support | Support |
| `services/api/db/migrations/0054_commercial_condition_patch.sql` | Commercial condition patch. | safe auto-run | Commercial condition table. | No | Support | Yes | Yes |
| `services/api/db/migrations/0055_access_grant.sql` | Access grant table. | safe auto-run | Core tenant/service object. | No | Yes | Yes | Yes |
| `services/api/db/migrations/0055_process_taxonomy_dropdowns.sql` | Process node, edge, effect, and task action taxonomy. Includes `CHILD_SERVICE_OBJECT_CREATE`. | safe auto-run | Dropdown tables. | No | Yes | Yes | Yes |
| `services/api/db/migrations/0056_admin_db_explorer.sql` | Admin DB explorer support. | safe auto-run | Authz/core tables. | Yes | No | No | No |
| `services/api/db/migrations/0057_miscellaneous.sql` | Miscellaneous permissions/notes. | safe auto-run | Authz/core tables. | Support | Support | Support | Support |
| `services/api/db/migrations/0058_admin_sensitive_token.sql` | Sensitive admin access token fields. | safe auto-run | Auth/core tables. | Yes | No | No | No |
| `services/api/db/migrations/0059_admin_portfolio.sql` | Admin portfolio table. | safe auto-run | Auth/core tables. | Yes | No | No | No |
| `services/api/db/migrations/0060_admin_portfolio_permissions.sql` | Admin portfolio permissions. | safe auto-run | Authz scaffold. | Yes | No | No | No |
| `services/api/db/migrations/0061_ecom_attribute_dropdowns.sql` | Ecommerce attribute dropdowns. | safe auto-run | Dropdown tables. | No | Support | Yes | Yes |
| `services/api/db/migrations/0062_admin_template_clone_permissions.sql` | Template clone permissions. | safe auto-run | Authz scaffold. | Yes | No | Yes | Yes |
| `services/api/db/migrations/0063_process_effect_inventory.sql` | Inventory process effect taxonomy values. | safe auto-run | Process effect dropdown. | No | Yes | Yes | Yes |
| `services/api/db/migrations/0064_process_effect_access_grant_create.sql` | `ACCESS_GRANT_CREATE` process effect taxonomy value. | safe auto-run | Process effect dropdown. | No | Yes | Yes | Yes |
| `services/api/db/migrations/0065_authz_ecom_catalog_permissions.sql` | Ecommerce catalog permissions. | safe auto-run | Authz scaffold. | Yes | No | Yes | Yes |
| `services/api/db/migrations/0066_link_relation_types_commerce.sql` | Commerce link relation values. | safe auto-run | Link dropdowns. | No | Support | Yes | Yes |
| `services/api/db/migrations/0067_authz_ecom_order_permissions.sql` | Ecommerce order permissions. | safe auto-run | Authz scaffold. | Yes | No | Yes | Yes |
| `services/api/db/migrations/0068_commerce_settings.sql` | Commerce module settings. | safe auto-run | Core tenant. | No | Support | Yes | Yes |
| `services/api/db/migrations/0069_process_effect_http_request.sql` | HTTP/API process effect taxonomy values. | safe auto-run | Process effect dropdown. | No | Yes | Yes | Yes |
| `services/api/db/migrations/0070_auth_password_reset.sql` | Password reset table. | safe auto-run | Auth identities. | Yes | No | No | No |
| `services/api/db/migrations/0071_auth_recovery_token.sql` | Auth recovery token table. | safe auto-run | Auth identities. | Yes | No | No | No |
| `services/api/db/migrations/0072_auth_recovery_request.sql` | Auth recovery request table. | safe auto-run | Auth identities. | Yes | No | No | No |
| `services/api/db/migrations/0073_ui_surface_auth.sql` | Public auth UI surface seed. | safe auto-run | UI surface table. | Yes | No | No | Support |
| `services/api/db/migrations/0074_admin_access_permissions.sql` | Admin access permissions. | safe auto-run | Authz scaffold. | Yes | No | No | No |
| `services/api/db/migrations/0075_user_profile.sql` | User profile table and backfill. | safe auto-run | Auth identities. | Yes | No | No | No |
| `services/api/db/migrations/0076_identity_permission.sql` | Identity-level permission table. | safe auto-run | Authz/auth tables. | Yes | Support | Support | Support |
| `services/api/db/migrations/0077_module_catalog.sql` | Module catalog table. | safe auto-run | Core schema. | Yes | Support | Yes | Yes |
| `services/api/db/migrations/0078_admin_process_permissions.sql` | Admin process permissions. | safe auto-run | Authz scaffold. | Yes | Yes | No | No |
| `services/api/db/migrations/0079_ecom_review_permissions.sql` | Ecommerce review permissions and indexes. | safe auto-run | Authz/core tables. | Yes | Support | Yes | Yes |
| `services/api/db/migrations/0080_tenant_admin_access_role_backfill.sql` | Tenant admin access role backfill. | safe auto-run | Authz/admin access tables. | Yes | No | No | No |
| `services/api/db/migrations/0081_ecom_role_permission_backfill.sql` | Ecommerce role permission backfill. | safe auto-run | Authz/ecommerce permissions. | Yes | No | Yes | Yes |
| `services/api/db/migrations/0082_ecom_product_reject_transitions.sql` | Adds reject transitions to ecommerce product process definitions. | safe auto-run | Product process definitions. | No | Yes | Yes | Yes |
| `services/api/db/migrations/0083_ecom_storefront_review_process.sql` | Storefront content and product review process flows. | safe auto-run | Product process bindings. | No | Yes | Yes | Yes |
| `services/api/db/migrations/0084_blog_post_process_flow.sql` | Blog post process flow. | safe auto-run | Product process bindings. | No | Yes | Yes | Yes |
| `services/api/db/migrations/0085_translation_catalog_dropdowns.sql` | Translation catalog dropdowns. | safe auto-run | Dropdown tables. | No | Support | Support | Support |
| `services/api/db/migrations/0086_ui_surface_auth_copy_refresh.sql` | Auth UI surface refresh/copy. | safe auto-run | UI surface table. | Yes | No | No | Support |
| `services/api/db/migrations/0087_process_effect_variant_inventory_validate.sql` | `VARIANT_INVENTORY_VALIDATE` effect and product process patch. | safe auto-run | Process effect dropdown, product process definitions. | No | Yes | Yes | Yes |
| `services/api/db/migrations/0088_ecom_variant_header_dropdowns.sql` | Ecommerce variant header dropdowns. | safe auto-run | Dropdown tables. | No | Support | Yes | Yes |
| `services/api/db/migrations/0089_ecom_product_category_dropdowns.sql` | Ecommerce product category dropdowns. | safe auto-run | Dropdown tables. | No | Support | Yes | Yes |
| `services/api/db/migrations/0090_translation_provider_openai.sql` | OpenAI translation provider seed/config support. | safe auto-run | Translation/module settings tables. | No | No | Support | Support |

## Manual or Deferred Items

| Item | Why it remains manual |
|---|---|
| `clone_template_to_tenant.sql` | It embeds a legacy Samara target code. Use Admin > Templates for Samara instead of running this SQL. |
| `grant_ecom_admin.sql` | It embeds a specific email and grants `ECOM_ADMIN` in `eip_ecom`, while the owner admin baseline now grants `ADMIN_SUPER` in the explicit live owner/admin tenant. |
| `plug_play_sample.sql` | Demo-only seed for tenant `eip`; keep separate from owner/admin and Samara production baselines. |
| `backfill_ecom_product_materials.sql` | Safe-looking SQL, but it mutates existing product/material relationships. Run only after reviewing production data. |
| `migrate_gateway_inbound_security.mjs` | May generate new secrets and a local report. Use only during a dedicated connection security migration. |
| `enrich_jurisdiction_currency.mjs` | Optional network enrichment, not required to restore the baseline. |

## Notes

- The stale `connection_profile_samara.sql` seed was removed; Samara connection profiles belong in Admin > Connections.
- Samara tenant creation, ecommerce template cloning, and connection profile setup must be performed through the Admin UI path, not through DB seed/reseed helpers.
- Child service object creation is represented in the process effect taxonomy, the API process engine source, and the canonical order process through `ORDER_RETURN_REQUEST` / `ORDER_REFUND_REQUEST`.
- Effect transition coverage is restored by the migration chain and checked by the API-local `process-engine` stage before template tenant reseeding.
