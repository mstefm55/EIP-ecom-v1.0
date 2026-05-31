# Public Storefront API V1

## Purpose

Developer-managed storefronts can fetch published, render-ready EIP payloads directly. The browser does not resolve internal content ownership rules.

## Endpoints

```text
GET /api/public/commerce/:suffix/storefront/manifest
GET /api/public/commerce/:suffix/storefront/mapping
GET /api/public/commerce/:suffix/content?slot=home.hero
GET /api/public/commerce/:suffix/content/list
GET /api/public/commerce/:suffix/catalog
```

Manifest responses expose approved public mappings only:

```json
{
  "ok": true,
  "connection_code": "tenant-site",
  "mapping_version": 4,
  "frontend_url": "https://example.com",
  "slots": [
    {
      "slot_code": "home.hero",
      "renderer": "hero_slider",
      "selector": "section.hero",
      "source": "approved_mapping",
      "content_endpoint": "/api/public/commerce/tenant-site/content?slot=home.hero"
    }
  ]
}
```

## Browser Example

```js
const response = await fetch(
  "https://eip-ecom-v1.up.railway.app/api/public/commerce/tenant-site/content?slot=home.hero",
  {
    headers: {
      "X-API-Key": "PUBLIC_STOREFRONT_KEY"
    }
  }
);
const payload = await response.json();
```

## Slot Ownership

Content-driven slots return published slides or blocks. Product-driven slots return resolved Product Studio rows:

```json
{
  "slot": "home.worth_making",
  "renderer": "product_carousel",
  "source_mode": "hybrid_tag_overrides",
  "products": []
}
```

Content Studio stores placement and product source rules. It does not duplicate product title, price, images, stock, or taxonomy.

## Native Frontend Integration

Native frontends fetch the same published slot endpoint and hand the render-ready payload to their own components. The validating storefront keeps its existing visual widgets:

```text
home.hero -> HeroViewportSlider
home.worth_making -> WorthMaking section with product_carousel renderer
```

Fallback visuals remain visible when EIP returns `item: null`. The legacy `home.worth` read remains a compatibility fallback while published content moves to `home.worth_making`.

Use renderer metadata or `VITE_EIP_WORTH_RENDERER=product_carousel`. The historical `VITE_EIP_WORTH_CARD_CAROUSEL_TEST=true` flag is accepted only as a temporary compatibility alias.

## Security

- Public routes are read-only except existing governed commerce intake routes.
- Query-string API keys remain forbidden.
- Use `X-API-Key` or the configured verification header.
- Connection CORS origin allowlists remain enforced.
- Public manifests never expose unapproved candidates, raw DOM, secrets, or private diagnostics.
