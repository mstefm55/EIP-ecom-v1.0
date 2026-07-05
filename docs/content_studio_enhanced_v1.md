# Content Studio Enhanced V1

## Compatibility

The original **Content Studio** remains available at its existing dashboard surface and continues to use its existing routes, records, publishing actions, scanner, and mapping metadata. **Content Studio Enhanced** is a separate beta/preview surface and is opt-in.

Migration `0134_content_studio_enhanced_surface.sql` adds the opt-in menu and panel to existing governed dashboard surface metadata. Migration `0135_content_studio_template_builder_surface.sql` switches only that enhanced panel to the dedicated template-builder component. Neither migration changes Content Studio content tables or Product Studio records.

## V1 model

The enhanced surface reuses the existing one-to-one storefront slot mapping: one selected mapped component is edited as one governed content object. The connected website continues to own the component shell, CSS, and layout. EIP supplies content and binding metadata.

The exact builder layout has:

1. Left: page structure, parent/child section tree, section actions, and scanner/mapping results.
2. Center: selected component preview with selection outline, handles, toolbar, responsive viewport controls, child thumbnails, and the template quick-add library.
3. Right: section inspector with Content, Data Binding, Media, Display, and Advanced tabs.

The top builder bar provides the site selector, connection status, preview, save-draft, and governed publish actions.

## Section template library

The Add action opens a categorized library: All, Popular, E-commerce, Content, Engagement, Media, and Custom. V1 templates include Hero, Hero Slider, Banner, Text Block, Text + Image, Product Grid, Product Carousel, Product Detail, Image Gallery, Video, Testimonials, Benefits, FAQ, Newsletter, CTA, and Custom Section.

Templates create layout metadata shells. They do not copy website CSS or product records. A created parent owns child order; each child owns its content, media, display settings, and data-binding reference.

## Parent/child model and repeatable fields

Enhanced metadata is stored under `attrs.content_studio_enhanced` while the serializer also writes compatible flat `slides` and CTA fields for existing renderers. Legacy flat content is normalized into the parent/child model when opened.

Repeatable children support add, delete, and reorder. Child types include slides, cards, images, questions, testimonials, products/collections, and generic blocks. Unknown future component types render a safe placeholder.

Buttons are an unrestricted repeatable list. Each button stores label, URL, style, optional icon, and new-tab behavior. The first button is mirrored into legacy CTA fields for backward compatibility; additional buttons remain in enhanced metadata and the `buttons` array.

## Product Studio data source

Product Studio remains the source of truth for products. Content records store binding metadata only, including `source_mode`, `product_source`, filters, product codes/tags, sorting, and limits. Product records are not copied into Content Studio.

Supported references include current product, selected product, products collection, category, and reviews, with filter, sort, limit, and field mappings. The serializer whitelists reference metadata and deliberately discards embedded `products`, `items`, `records`, and snapshot payloads.

## Media upload fix

The dedicated enhanced builder uses the existing EIP Image Studio and the same authenticated `/api/eip/ecom/uploads` transport and Railway-backed asset root as Product Studio. It does not introduce another editor or storage architecture.

The fixed lifecycle is:

1. Select or edit an image.
2. Open Image Studio explicitly; crop, resize, rotate, flip, adjust, filter, choose background/output size, and apply.
3. On **Apply & Upload**, show the edited local preview immediately.
4. Upload the generated file through the existing multipart route.
5. Replace the preview with the returned canonical asset URL/id.
6. Clear loading state on success, validation failure, scanner response, network failure, or timeout. A failed replacement restores the previous image.

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

## Scanner and mapping flow

The enhanced left panel calls the existing structure connection, structure scan, and mapping contracts. Results show type and mapped/unmapped state. Selecting a result reuses an existing matching content slot or creates a draft component shell with the scanned selector and slot. Rescans do not delete Content Studio records or Product Studio bindings.

## Current limitations

- The center canvas is a metadata-driven component preview. The connected frontend remains the final source of truth for its exact production CSS and responsive behavior.
- Freeform drag coordinates and arbitrary pixel resizing are represented by selection handles/tooling but are not persisted until a connected renderer exposes a governed positioning contract.
- Custom/Future API is a metadata placeholder; runtime adapter execution is deferred.
- Section order is stored in enhanced metadata; storefront-wide cross-slot ordering requires renderer support.

## Future V2

V2 may add deeper nested repeaters, connected-shell DOM overlays, governed drag/resize coordinates, additional data-source adapters, collaborative editing, and reusable custom template publishing.
