# Admin Connections And Storefront Mapping V1

## Responsibility Split

**Admin Console > Connections** owns the technical trust boundary:

```text
connection code and name
frontend URL
origin allowlist
direction and enabled state
verification secret status
API key one-time creation, rotation, and revoke
rate limits
storefront scanner enablement
allowed scan modes
loader enablement
public API enablement
public storefront read scopes
connection diagnostics
payment provider credentials and webhook secrets
```

**Tenant Dashboard > Content Studio > Storefront Mapping** owns business mapping:

```text
select connection
run scan
review candidate zones
approve, edit, ignore, or reset mappings
assign slot and renderer
create content
preview
publish through governed workflow
```

Do not move business content decisions into Admin Connections.

## API Key Safety

Raw API keys are displayed once after creation or rotation. After refresh, save, copy/hide, or navigation, the UI shows safe status metadata only. Stored key records expose a short hash fingerprint, never the raw key.

## Payment Provider Boundary

Checkout.com, PayPal, Google Pay merchant configuration, webhook secrets, and provider credentials belong in Admin Console > Connections. Tenant Commerce Settings may enable methods and select an existing payment connection, but it must not collect raw provider secrets.

Payment readiness is exposed as redacted status only:

```text
configured / provider_not_configured / sandbox_ready
connection code
environment
wallet yes/no
```

## Storefront Capability Metadata

Connection profiles store a governed `public_storefront` block:

```json
{
  "scan_allowed": true,
  "loader_enabled": false,
  "public_api_enabled": true,
  "allowed_scan_modes": ["auto", "rendered", "generic", "tagged"],
  "scopes": [
    "storefront.mapping.read",
    "storefront.content.read",
    "storefront.catalog.read"
  ]
}
```

Website and ecommerce connections receive scan/public API defaults. Loader injection remains opt-in. Non-storefront outbound integrations do not gain storefront capabilities automatically.

## Diagnostics

Admin Connections reports:

```text
CORS ready
verification key saved
rendered scanner ready
last connection verification timestamp
last scan usable-zone count
```

The tenant mapping view reports rendered availability/error, rendered/static/tagged candidate counts, usable candidates, and fallback recommendations.

## Operator Sequence

1. Create or enable the connection.
2. Set the real frontend URL and origin allowlist.
3. Keep production verification enabled.
4. Enable the required integration mode: native public API, loader, or both.
5. Open Mapping Studio.
6. Run scan and approve zones.
7. Create and publish content through the existing process flow.
8. Verify the public manifest and published slot endpoint.
