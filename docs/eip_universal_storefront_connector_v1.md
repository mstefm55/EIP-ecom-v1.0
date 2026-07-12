# EIP Universal Storefront Connector V1

EIP can scan a tenant website and build a page structure, but the website only becomes editable after it installs the EIP storefront connector patch.

## Connection-time patch

When a tenant connects a website, EIP exposes:

```txt
GET /api/public/commerce/:suffix/storefront/connector-patch
```

The response contains the script tag to install before `</body>` or in the app shell:

```html
<script
  async
  src="https://<eip-api>/api/public/commerce-loader/v1.js"
  data-connection="<connection-suffix>"
  data-api-base="https://<eip-api>"
  data-refresh-ms="30000">
</script>
```

Loader mode must be enabled on the Website Gateway Connection Profile. This is intentional: EIP should not inject or replace content unless the tenant explicitly opted in.

## Runtime flow

```txt
Tenant site loads
-> EIP connector fetches approved mapping manifest
-> Connector fetches published slot content
-> Connector replaces only approved mapped DOM targets
-> Connector polls the manifest content version
-> New EIP publish changes content_version
-> Connector pulls and reapplies changed content
```

This means the frontend does not need to know every EIP slot in advance. The website only needs the connector patch and approved mappings.

## Browser receiver contract

The connector supports:

- `window.EIPStorefrontConnector.refresh()`
- `document.dispatchEvent(new Event("eip:storefront:refresh"))`
- `window.postMessage({ type: "eip-storefront-refresh", connection })`
- `document` event: `eip:storefront:applied`

The applied event detail includes:

```json
{
  "connection": "samara",
  "version": "content-version-hash",
  "applied": 3,
  "slotCount": 3
}
```

## Security rules

- Only approved mappings are public.
- Only safe selectors are exposed.
- Only safe renderer types are applied.
- The loader never executes arbitrary HTML or JavaScript.
- Raw secrets/API keys are not required for public storefront rendering.
- Loader access remains governed by Gateway Connection Profile capabilities and scopes.

## Why this is different from scan-only

Scanning reads the website. Mapping tells EIP what each detected section means. The connector patch is what lets the live website accept published EIP changes.

Without the connector patch or a native adapter, EIP can preview and store content but cannot reliably update the live website.
