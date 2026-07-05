# Content Studio Enhanced V1

## Compatibility

The original **Content Studio** remains available at its existing dashboard surface and continues to use its existing routes, records, publishing actions, scanner, and mapping metadata. **Content Studio Enhanced** is a separate beta/preview surface and is opt-in.

Migration `0134_content_studio_enhanced_surface.sql` adds the opt-in menu and panel to existing governed dashboard surface metadata. It does not change Content Studio content records or schemas.

## V1 model

The enhanced surface reuses the existing one-to-one storefront slot mapping: one selected mapped component is edited as one governed content object. The connected website continues to own the component shell, CSS, and layout. EIP supplies content and binding metadata.

The three working areas are:

1. Content library and the existing scanner/mapping controls.
2. Immediate component/media preview.
3. Component inspector for content, data binding, media, and publishing.

## Product Studio data source

Product Studio remains the source of truth for products. Content records store binding metadata only, including `source_mode`, `product_source`, filters, product codes/tags, sorting, and limits. Product records are not copied into Content Studio.

Supported V1 component bindings continue to include product carousels and grids, manual product codes, product tags, collections/drops, and hybrid tag overrides. The same metadata contract is site-agnostic and is resolved by the storefront renderer.

## Media upload fix

Content Studio now uses the same authenticated `/api/eip/ecom/uploads` transport and Railway-backed asset root as Product Studio, but it does not block the HTTP upload on the optional Image Studio modal. Content components already expose fit, focal-point, and overlay controls.

The fixed lifecycle is:

1. Select an image.
2. Create an immediate local preview.
3. Start the multipart upload immediately.
4. Replace the preview with the returned canonical asset URL.
5. Clear loading state on success, validation failure, network failure, or timeout.

Structured API error codes remain visible through the existing dashboard error formatter. The API continues to validate file signatures and MIME types, apply the configured upload scanner policy, and store accepted assets under the existing `/data/eip-assets` foundation.

## Site connection and rendering contract

The enhanced surface reuses Gateway Connection Profiles, including frontend URL, connection code, allowed scan modes, page/slot metadata, selectors, renderer type, and approved mapping state. It is not tied to Samara.

The runtime contract remains metadata-driven:

```json
{
  "componentId": "mapped slot or candidate id",
  "componentType": "renderer type",
  "content": "storefront content object",
  "dataSource": "static or Product Studio binding",
  "bindings": "source_mode and product_source metadata",
  "media": "canonical asset URLs",
  "publishStatus": "workflow stage"
}
```

The storefront renderer resolves static content, Product Studio data, media URLs, links, and labels while retaining the website-owned component shell.

## Future V2

V2 may add a richer component schema, nested repeaters, additional governed data sources, and closer shell-aware preview rendering. Those changes are intentionally outside V1.
