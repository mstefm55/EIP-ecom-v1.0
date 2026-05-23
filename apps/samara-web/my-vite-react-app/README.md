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

Use the plug-and-play values created through EIP Admin > Connections:

- `VITE_EIP_ENDPOINT`
- `VITE_EIP_API_KEY`

The endpoint is the full storefront endpoint copied from Admin > Connections. It already contains the tenant routing details, so Samara does not need a suffix, connection code, verification mode, or manifest settings.

Samara's deployed origin belongs in API `CORS_ORIGIN_PUBLIC` and in the connection profile `origin_allowlist`, not in internal dashboard `CORS_ORIGIN`.
