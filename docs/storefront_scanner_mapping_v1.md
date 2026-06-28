# Storefront Scanner And Mapping V1

## Purpose

Content Studio can scan an enabled tenant storefront connection, infer DOM/content zones, review proposed mappings, approve slots, and publish content without tenant-specific route logic.

## Scan Modes

- `auto`: default. Try an isolated rendered DOM scan first, use static generic inference when rendered DOM is unavailable or low-confidence, then merge explicit tagged mappings when available.
- `rendered`: require Chromium and inspect the hydrated DOM. If Chromium is unavailable, return a clear diagnostic and do not save a static shell as a complete mapping.
- `generic`: inspect fetched HTML only. This is useful for static sites and deliberately does not launch Chromium.
- `tagged`: use explicit `data-eip-parent`, `data-eip-page`, structure manifests, and the existing frontend-module marker scan.

The scanner returns short redacted text samples only. It does not persist raw HTML. Account, login, checkout, and payment form candidates can be reported for operator awareness but cannot be approved for content push.

## Security Boundary

Every scan URL, redirect, and browser subresource origin passes through the existing outbound egress guard. Private, loopback, link-local, metadata, internal, credential-bearing, and insecure production targets remain blocked. The isolated browser does not receive EIP cookies, refuses non-`GET`/`HEAD` requests, blocks downloads and service workers, caps subresource requests, and discards scripts, styles, sensitive attributes, and form values before inference. Raw HTML is processed in memory only and is never persisted.

## Rendered DOM Adapter

The API uses `playwright-core` with a system Chromium executable. Static sites still scan without Chromium. Client-rendered React, Vue, Angular, Next, and similar sites gain generic zone inference when Chromium is available.

### Railway API Deployment

The API service uses `services/api/Dockerfile`, based on Debian 12 Bookworm. The image installs the Debian `chromium` package explicitly and sets the default scanner executable to `/usr/bin/chromium`. This replaces the earlier Nixpacks package-hint approach.

In Railway, confirm the API service **Root Directory** is:

```text
services/api
```

Railway automatically detects `services/api/Dockerfile` when that root directory is active. If the service has an explicit builder override, select the Dockerfile builder or set:

```text
RAILWAY_DOCKERFILE_PATH=Dockerfile
```

Recommended Railway API service variables:

```text
STOREFRONT_RENDERED_SCAN_ENABLED=true
STOREFRONT_RENDERED_SCAN_EXECUTABLE_PATH=/usr/bin/chromium
STOREFRONT_RENDERED_SCAN_ALLOW_NO_SANDBOX=false
STOREFRONT_STRUCTURE_SCAN_TIMEOUT_MS=30000
```

The prior `NIXPACKS_PKGS` and `NIXPACKS_APT_PKGS` attempts are no longer needed. If an operator deliberately changes the image and exposes Chromium elsewhere on `PATH`, leave `STOREFRONT_RENDERED_SCAN_EXECUTABLE_PATH` empty and the API will discover it.

Keep `STOREFRONT_RENDERED_SCAN_ALLOW_NO_SANDBOX=false`. The Docker image runs the API as the non-root `node` user and does not hardcode Chromium's `--no-sandbox` flag. Only change this variable after an explicit container-isolation review.

Keep `STOREFRONT_STRUCTURE_SCAN_TIMEOUT_MS=30000` unless a measured storefront requires a different budget. It bounds the complete scan, including successful HTTP responses whose body streams never finish.

At API startup, the log event `storefront_rendered_dom_scanner_diagnostic` reports:

- `rendered_scan_enabled`
- `configured_executable_path`
- `discovered_executable_path`
- `browser_found`
- `browser_version`

The diagnostic does not log secrets.

After deployment, verify in the Railway API shell:

```sh
which chromium
chromium --version
```

Then run a Content Studio **Rendered DOM scan**. A hydrated client-rendered storefront should report `rendered_dom_available=true`, an empty `rendered_dom_error`, and `rendered_dom_candidate_count > 0`.

The authenticated tenant diagnostic endpoint is:

```text
GET /api/eip/ecom/storefront/structure/scanner-diagnostic
```

It requires an EIP session and `ECOM_PRODUCT_READ`. It returns readiness metadata only, never secrets.

## Governed Persistence

No new table is required. The existing tenant-scoped `storefront_structure` service object stores `attrs.mapping_profile`:

- connection code and frontend URL
- scan id and timestamp
- mapping profile code and version
- detected candidate zones
- approved mappings
- ignored candidates
- slot-to-selector mapping
- renderer descriptor and confidence
- last scan summary

The same object keeps `attrs.mapping_profiles` as a connection-keyed registry so one tenant can manage more than one storefront connection without losing prior scan decisions. `attrs.mapping_profile` remains the active profile shown in Content Studio.

## Reusable ECOM Module Placement

Storefront Mapping is an ECOM module capability, not a storefront customization. The generic dashboard `ui_surface` descriptor mounts `EcomProductWorkspace` in `content-studio` mode. Ecommerce template clones copy that governed surface to new tenants. Migration `0098_storefront_mapping_ui_descriptor.sql` also adds the Mapping Studio descriptor to existing published dashboard surfaces that already mount the reusable widget.

The surface descriptor controls the operator-facing mapping configuration:

- labels and help text
- scan mode labels
- allowed renderer types
- product source mode labels
- slot presets
- required content fields by renderer
- action labels
- diagnostics labels

React remains the low-level interaction primitive for scan requests, candidate editing, preview, and content form controls. A tenant can replace the Mapping Studio descriptor in its `ui_surface` metadata without adding a tenant-specific React branch.

## Process Boundary

Candidate approval records an operator-reviewed DOM-to-slot configuration in the tenant and connection-scoped mapping profile. It does not publish storefront content. Content creation and publication remain governed by the ecommerce storefront content process:

```text
ECOM_STOREFRONT_CONTENT_FLOW
```

The process binding, review task, transition graph, and effects remain the authority for draft, review, approval, and publication. Commercial deployments that require dual-control approval for mapping configuration itself can add a mapping-review process binding later without changing scanner or rendering primitives.

## Operator Flow

1. Open tenant Content Studio.
2. Select an enabled storefront connection.
3. Run an `auto`, `rendered`, `generic`, or `tagged` scan.
4. Open **View map**.
5. Review selector, renderer, confidence, source, and redacted sample.
6. Approve, edit, or ignore each zone.
7. Create content only for an approved mapping.
8. Save and publish through the existing storefront content process.

## Public Slot Contract

Editorial slots return render-ready content:

```json
{
  "slot": "home.hero",
  "renderer": "hero_slider",
  "content": { "slides": [] }
}
```

## Integration Modes

The scanner only discovers zones and records approved mappings. A website renders published data through one of three explicit modes:

1. Native frontend integration for EIP-aware React or app code.
2. Loader script integration for sites that can add a script tag.
3. Public API integration for developer-managed rendering.

See:

- `docs/public_storefront_loader_v1.md`
- `docs/public_storefront_api_v1.md`
- `docs/admin_connections_storefront_v1.md`

Product-driven slots return Product Studio rows resolved from placement rules:

```json
{
  "slot": "home.worth_making",
  "renderer": "product_carousel",
  "source_mode": "hybrid_tag_overrides",
  "products": []
}
```

## Current Limitation

The rendered scanner evaluates the public page with bounded browser execution, but intentionally blocks write requests, downloads, service workers, and private/internal network targets. A website that requires authenticated browsing, mutation requests, or unusually long client-side hydration may still need an explicit structure manifest or operator-reviewed mapping.
