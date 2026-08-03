# Perfect Fit Bureau / Samara frontend Railway deployment

## Deployment root

Use the existing EIP-connected Samara frontend root:

```text
apps/samara-web/my-vite-react-app
```

Do not deploy the Google AI Studio reference folder directly:

```text
apps/samara-web/sartorial-sewing-pattern-atelier
```

That folder is preserved as an inspected visual/reference export. It contains local-storage demo commerce, Firebase/Google Drive helpers, and sandbox-style checkout UI. The production storefront must keep the EIP-backed catalog, cart, checkout, payment, member, and content-slot APIs from `my-vite-react-app`.

## Railway commands

```text
Install command: npm install
Build command: npm run build
Start command: npm run preview -- --host 0.0.0.0 --port $PORT
Output directory: dist
```

Railway should run these commands from `apps/samara-web/my-vite-react-app`.

## Required environment variables

```text
VITE_EIP_ENDPOINT=https://eip-ecom-v1.up.railway.app/api/public/commerce/<storefront_endpoint>
VITE_EIP_API_KEY=<connection_api_key>
VITE_SITE_TITLE=Perfect Fit Bureau
VITE_SITE_URL=https://perfectfitbureau.com
VITE_PUBLIC_SITE_URL=https://perfectfitbureau.com
VITE_STORE_URL=https://perfectfitbureau.com
VITE_APP_URL=https://perfectfitbureau.com
```

`VITE_EIP_ENDPOINT` is the canonical public storefront endpoint copied from EIP Admin connection setup. It already includes tenant routing. The existing legacy fallback variables still work for local development:

```text
VITE_EIP_API_BASE_URL=http://localhost:4000
VITE_EIP_SUFFIX=samara
```

## Custom domain readiness

Configure both domains in Railway:

```text
https://perfectfitbureau.com
https://www.perfectfitbureau.com
```

The API must allow the deployed origin in the public commerce connection/CORS configuration. If the API remains on Railway, keep `VITE_EIP_ENDPOINT` pointed at the Railway API until an API subdomain is available.

## What was assimilated

- The production frontend keeps the EIP API integration from `my-vite-react-app`.
- The Perfect Fit visual system from the AI Studio export was assimilated into the production CSS: sand/clay/bark palette, Cormorant/Outfit/JetBrains typography, softer panels, pill navigation, premium card shadows, and sharper atelier-style buttons.
- Site/domain metadata is environment-driven through `VITE_SITE_TITLE`, `VITE_SITE_URL`, `VITE_PUBLIC_SITE_URL`, `VITE_STORE_URL`, and `VITE_APP_URL`.
- The AI Studio reference app was sanitized so Firebase helpers require explicit `VITE_FIREBASE_*` config instead of bundling the AI Studio project config.

## Verification checklist after deploy

1. Open `https://perfectfitbureau.com`.
2. Confirm the header, hero, product grid, cart, and checkout render.
3. Confirm product data loads from EIP/Product Studio.
4. Confirm payment methods load from EIP backend availability.
5. Confirm PayPal opens through the EIP checkout lifecycle.
6. Confirm no browser console error references Firebase unless optional Firebase variables were intentionally configured.
7. Confirm `https://www.perfectfitbureau.com` redirects or serves the same app as intended.
