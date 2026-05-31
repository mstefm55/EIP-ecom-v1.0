# Storefront Scanner And Mapping V1

## Purpose

Content Studio can scan an enabled tenant storefront connection, infer DOM/content zones, review proposed mappings, approve slots, and publish content without tenant-specific route logic.

## Scan Modes

- `auto`: default. Run generic static DOM inference first, then merge explicit tagged markers when available.
- `generic`: inspect fetched static HTML and propose zones using semantic DOM, class/id, text, media, link, button, form, and repeated-layout signals.
- `tagged`: use explicit `data-eip-parent`, `data-eip-page`, structure manifests, and the existing frontend-module marker scan.

The scanner returns short redacted text samples only. It does not persist raw HTML. Account, login, checkout, and payment form candidates can be reported for operator awareness but cannot be approved for content push.

## Security Boundary

Every scan URL and redirect passes through the existing outbound egress guard. Private, loopback, link-local, metadata, internal, credential-bearing, and insecure production targets remain blocked.

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

V1 scans fetched static HTML plus the existing textual frontend-module markers. It does not execute client-side JavaScript in a headless browser. Heavily client-rendered websites should expose tagged markers or a structure manifest until a governed rendered-DOM scanner adapter is added.
