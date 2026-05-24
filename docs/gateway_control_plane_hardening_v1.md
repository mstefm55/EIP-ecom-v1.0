# Gateway Control-Plane Hardening V1

Date: 2026-05-24

## Closed Gaps

This wave closes the highest-risk gateway/control-plane residuals after Prompt 8:

- connection API key lifecycle regression coverage
- gateway audit default redaction
- outbound gateway SSRF and egress controls

## API Key Lifecycle

Admin > Connections API key create, rotate, and revoke paths use `sha256Hex` from `services/api/src/auth/crypto.js` to hash raw keys with `API_KEY_PEPPER`. Raw keys are returned only once on create/rotate, are not persisted, and are not included in security events or logs.

Regression coverage:

```text
services/api/test/gateway_api_keys.test.mjs
```

## Audit Redaction Defaults

Public gateway intake audit payloads now redact by default:

- `authorization`, `cookie`, API key headers, signatures, CSRF/session/device values
- all query parameter values
- nested body fields whose keys look like tokens, secrets, credentials, passwords, signatures, or keys
- raw request body bytes

Raw body capture requires both:

```text
audit.include_raw_body=true
audit.raw_body_safe=true
```

Profile-specific redaction policy remains additive and can only redact more fields.

## Outbound Egress Controls

Gateway outbound calls and Admin > Connections outbound tests now validate the final target URL before fetch.

Denied targets:

- loopback addresses
- private RFC1918 addresses
- link-local addresses
- cloud metadata address ranges
- unique-local IPv6 addresses
- internal hostnames such as `localhost`, `.local`, `.internal`, and `metadata.google.internal`
- URL-embedded username/password credentials

Production outbound profiles must use HTTPS. Sandbox profiles may use plain HTTP only when:

```text
outbound.allow_insecure_http=true
```

Even then, private/internal targets remain denied.

OAuth client-credentials `token_url` values use the same egress guard before token fetch.

Regression coverage:

```text
services/api/test/gateway_outbound_security.test.mjs
services/api/test/public_gateway_runtime.test.mjs
```
