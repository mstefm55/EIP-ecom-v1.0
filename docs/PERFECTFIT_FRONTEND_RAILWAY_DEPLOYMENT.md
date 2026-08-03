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

## SPA routing and deep links

The production storefront is a React Router single-page app. Railway must serve
`dist/index.html` for direct browser requests to storefront routes such as:

```text
/
/patterns
/patterns/<product-code>
/cart
/checkout
/checkout/success
/checkout/cancel
/about
/contact
/courses
/blog
/faq
```

`npm run preview -- --host 0.0.0.0 --port $PORT` provides the Vite preview
server and is suitable for this SPA fallback behavior. If Railway is later
changed to a static file server, configure a history fallback so every
non-asset path returns `index.html`; otherwise deep links and PayPal return URLs
will 404 before React can render them.

## Required environment variables

```text
VITE_EIP_ENDPOINT=https://eip-ecom-v1.up.railway.app/api/public/commerce/<storefront_endpoint>
VITE_EIP_API_KEY=<connection_api_key>
VITE_SITE_TITLE=Perfect Fit Bureau
VITE_SITE_URL=https://perfectfitbureau.com
VITE_PUBLIC_SITE_URL=https://perfectfitbureau.com
VITE_STORE_URL=https://perfectfitbureau.com
VITE_APP_URL=https://perfectfitbureau.com
VITE_ENABLE_CATALOG_VARIANT=false
VITE_ENABLE_CHECKOUT_VARIANT=false
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
- The production frontend now has real client routes. `/patterns` is the active
  Product Studio/EIP catalogue, `/patterns/:slug` is the product detail route,
  and `/checkout` uses the existing EIP payment-session checkout flow.
- The AI Studio catalogue and checkout concepts are preserved only as disabled
  design variants. They stay behind `VITE_ENABLE_CATALOG_VARIANT=false` and
  `VITE_ENABLE_CHECKOUT_VARIANT=false` and must not replace production commerce.
- The Perfect Fit visual system from the AI Studio export was assimilated into the production CSS: sand/clay/bark palette, Cormorant/Outfit/JetBrains typography, softer panels, pill navigation, premium card shadows, and sharper atelier-style buttons.
- Site/domain metadata is environment-driven through `VITE_SITE_TITLE`, `VITE_SITE_URL`, `VITE_PUBLIC_SITE_URL`, `VITE_STORE_URL`, and `VITE_APP_URL`.
- PayPal/customer return pages should use the configured public site URL, so
  `VITE_PUBLIC_SITE_URL` must match the Railway/custom-domain storefront origin.
- The AI Studio reference app was sanitized so Firebase helpers require explicit `VITE_FIREBASE_*` config instead of bundling the AI Studio project config.

## Verification checklist after deploy

1. Open `https://perfectfitbureau.com`.
2. Confirm the header, hero, product grid, cart, and checkout render.
3. Confirm product data loads from EIP/Product Studio.
4. Confirm payment methods load from EIP backend availability.
5. Confirm PayPal opens through the EIP checkout lifecycle.
6. Open `/patterns`, `/cart`, `/checkout`, `/checkout/success`, `/checkout/cancel`,
   `/about`, and `/contact` directly in a new browser tab to confirm Railway
   returns the SPA rather than a 404.
7. Confirm no browser console error references Firebase unless optional Firebase variables were intentionally configured.
8. Confirm `https://www.perfectfitbureau.com` redirects or serves the same app as intended.
