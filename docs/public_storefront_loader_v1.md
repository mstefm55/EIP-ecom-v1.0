# Public Storefront Loader V1

## Purpose

The loader is for external websites that can add one script tag but cannot rebuild their frontend. It is not used by native EIP-aware storefronts.

## Enablement

Enable `loader_enabled` for the tenant connection in **Admin > Connections > Storefront**. Keep the origin allowlist limited to the real website origin and keep verification enabled.

Embed:

```html
<script
  src="https://eip-ecom-v1.up.railway.app/api/public/commerce-loader/v1.js"
  data-connection="tenant-site-code"
  data-api-base="https://eip-ecom-v1.up.railway.app"
  data-api-key="PUBLIC_STOREFRONT_KEY">
</script>
```

`data-api-key` is optional only when the governed connection verification mode permits it. Never place an admin API key in a website. Use a public storefront key limited to:

```text
storefront.mapping.read
storefront.content.read
storefront.catalog.read
```

## Runtime Behavior

The loader:

1. Fetches the approved public manifest.
2. Fetches published content for each approved mapped slot.
3. Finds each approved selector.
4. Replaces only that mapped zone using a known safe renderer.
5. Preserves the existing website fallback whenever mapping, content, selector, or API access is unavailable.

The loader uses DOM construction and `textContent`. It does not execute tenant-provided scripts or inject unsanitized HTML.

Initial renderers:

```text
hero_slider
rich_text_block
cta_block
product_carousel
product_grid
editorial_card_grid
newsletter_block
newsletter_form
```

## Debugging

Add `data-debug="true"` temporarily to print loader warnings. Leave it unset in normal deployments.
