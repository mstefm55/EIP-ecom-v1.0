<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Perfect Fit Bureau AI Studio reference app

This folder contains the Google AI Studio export used as the visual reference for the production Samara / Perfect Fit Bureau storefront.

It is intentionally not the production deployment root. The production EIP-connected storefront remains:

```text
apps/samara-web/my-vite-react-app
```

The reference app includes beautiful UI patterns, but it also contains local-storage demo commerce, Firebase/Google Drive helpers, and sandbox-style checkout UI. Do not allow those demo flows to replace the EIP-backed catalog, cart, checkout, payment, member, and content APIs in the production app.

View your app in AI Studio: https://ai.studio/apps/ba7467f3-677d-4170-a709-acb874113c19

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local` only if optional Firebase/Google Drive helpers are being tested.
3. Run the app:
   `npm run dev`

## Production integration notes

- Deployment root: use `apps/samara-web/my-vite-react-app`, not this reference folder.
- Product data: must come from EIP/Product Studio public commerce APIs.
- Checkout/payment: must remain EIP-backed and provider-driven.
- Firebase/Google Drive: disabled unless `VITE_FIREBASE_*` variables are explicitly provided.
- Secrets: never commit real Firebase, Gemini, OAuth, or provider credentials.
