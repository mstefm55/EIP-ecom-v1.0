# Storefront Scanner And Mapping V1

## Purpose

Content Studio can scan an enabled tenant storefront connection, infer DOM/content zones, review proposed mappings, approve slots, and publish content without tenant-specific route logic.

## Scan Modes

- `auto`: default. Run generic DOM inference first, render client-side JavaScript when the fetched page is only a mount shell, then merge explicit tagged markers when available.
- `generic`: inspect fetched HTML and, when needed, an isolated browser-rendered DOM snapshot. Propose zones using semantic DOM, class/id, text, media, link, button, form, and repeated-layout signals.
- `tagged`: use explicit `data-eip-parent`, `data-eip-page`, structure manifests, and the existing frontend-module marker scan.

The scanner returns short redacted text samples only. It does not persist raw HTML. Account, login, checkout, and payment form candidates can be reported for operator awareness but cannot be approved for content push.

## Security Boundary

Every scan URL, redirect, and browser subresource origin passes through the existing outbound egress guard. Private, loopback, link-local, metadata, internal, credential-bearing, and insecure production targets remain blocked. The isolated browser does not receive EIP cookies, refuses non-`GET`/`HEAD` requests, blocks downloads and service workers, caps subresource requests, and discards scripts, styles, sensitive attributes, and form values before inference. Raw HTML is processed in memory only and is never persisted.

## Rendered DOM Adapter

The API uses `playwright-core` with a system Chromium executable. Static sites still scan without Chromium. Client-rendered React, Vue, Angular, Next, and similar sites gain generic zone inference when Chromium is available.

Recommended Railway API service settings:

```text
NIXPACKS_PKGS=chromium
STOREFRONT_RENDERED_SCAN_ENABLED=true
STOREFRONT_RENDERED_SCAN_EXECUTABLE_PATH=/usr/bin/chromium
```

If the executable is exposed elsewhere on `PATH`, leave `STOREFRONT_RENDERED_SCAN_EXECUTABLE_PATH` empty and the API will discover it. Keep `STOREFRONT_RENDERED_SCAN_ALLOW_NO_SANDBOX=false`; only change that after an explicit container-isolation review.

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

## Operator Flow

1. Open tenant Content Studio.
2. Select an enabled storefront connection.
3. Run an `auto`, `generic`, or `tagged` scan.
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

Product-driven slots return Product Studio rows resolved from placement rules:

```json
{
  "slot": "home.worth",
  "renderer": "product_carousel",
  "source_mode": "hybrid_tag_overrides",
  "products": []
}
```

## Current Limitation

The rendered scanner evaluates the public page with bounded browser execution, but intentionally blocks write requests, downloads, service workers, and private/internal network targets. A website that requires authenticated browsing, mutation requests, or unusually long client-side hydration may still need an explicit structure manifest or operator-reviewed mapping.
