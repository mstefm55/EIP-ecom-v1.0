# Samara Vite Frontend

Samara is deployed as an external storefront connected to EIP through the public gateway/connection contract. It is not an internal EIP dashboard surface and should not call `/api/eip/*`.

## Local commands

```bash
npm ci
npm run build
```

## Railway

```text
Root directory: apps/samara-web/my-vite-react-app
Install command: npm ci
Build command: npm run build
Output directory: dist
```

## EIP Connection

Use values created through EIP Admin > Connections:

- `VITE_EIP_GATEWAY_BASE_URL`
- `VITE_EIP_SUFFIX`
- `VITE_EIP_CONNECTION_CODE`
- `VITE_EIP_EVENT_ID_HEADER`
- optional `VITE_EIP_GATEWAY_API_KEY` for bootstrap/manifest
- optional `VITE_EIP_COMMERCE_VERIFICATION_KEY` only if the browser-facing connection profile requires it

Samara's deployed origin belongs in API `CORS_ORIGIN_PUBLIC` and in the connection profile `origin_allowlist`, not in internal dashboard `CORS_ORIGIN`.
