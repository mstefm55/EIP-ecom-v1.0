# EIP Core Copilot Instructions

## Architecture Overview

**EIP Core** is a monorepo ERP engine designed for multi-tenant cloud + desktop deployment.

**Structure:**
- `apps/` — Business applications (Samara web UI under `apps/samara-web/my-vite-react-app`)
- `services/api/` — Fastify REST API with PostgreSQL backend
- `packages/` — Shared libraries (future use)
- `docs/decisions/` — Architecture decision records (ADRs)
- `docs/dev/naming.md` — Strict naming conventions (**mandatory**)
- `scripts/` — Tooling & automation

**Data Flow:** React (Vite) → Fastify API (port 4000) → PostgreSQL (schemas: `eip_core`, `eip_auth`, `material_master`, etc.) → Process Engine (kernel-level, shared across modules)

---

## Critical Naming Conventions

**This is non-negotiable.** See `docs/dev/naming.md` for full rules.

| Layer | Convention | Example |
|-------|-----------|---------|
| **Database** | snake_case, lowercase | `created_at`, `process_type`, `tenant_id` |
| **JavaScript** | camelCase | `createdAt`, `processType`, `tenantId` |
| **React Components** | PascalCase | `ProcessBuilder.jsx`, `TaskTable.jsx` |
| **Folders** | kebab-case | `socket-manager/`, `auth-routes/` |
| **Files** | camelCase.js, PascalCase.jsx | `authCrypto.js`, `Button.jsx` |

**Critical:** Never expose DB rows directly. Map snake_case → camelCase in API responses.

---

## Process Engine Patterns

**Kernel Engine:** Shared across CRM, inventory, etc. Operates on `service_object` with optional `object_type` validation.

**Effects in Process Graphs:**
- `so_status`: Updates `service_object.status`, inserts `service_object_status_event`
- `task_create`: Inserts `task` row with assigned_agent_id, due_at
- `task_status`: Updates `task.status`, inserts `task_status_event`
- `link`: Inserts `object_link`
- `attrs_merge`: Merges JSON into `service_object.attrs` or `process_instance.cursor_json`

**Transactions:** All state transitions in single DB transaction with `FOR UPDATE` locks.

**Idempotency:** POST `/process/instances/:id/advance` accepts `idempotency_key` to avoid duplicates.

Reference: [services/api/docs/CORE_PROCESS_V1.md](services/api/docs/CORE_PROCESS_V1.md), [services/api/docs/CRM_PROCESS_V1.md](services/api/docs/CRM_PROCESS_V1.md)

---

## Code Patterns

**Route Auth Guards:** Always start routes with `const session = await requirePerm(app, req, reply, 'PERM_CODE'); if (!session) return;`

**Input Normalization:** Use `normalizeText(value)`, `normalizeOptionalText(value)`, `normalizeStatus(value).toLowerCase()`

**Fastify Schemas:** Validate params/body, e.g., `{ type: "object", required: ["id"], properties: { id: { type: "string", minLength: 36, maxLength: 36 } } }`

**Idempotency Keys:** `buildIdempotencyKey(prefix, payload)` using `sha256Hex(JSON.stringify(payload))`

Reference: [services/api/src/routes/crm.js](services/api/src/routes/crm.js)

---

## Developer Workflows

| Task | Command/Notes |
|------|---------------|
| **API Dev** | `cd services/api && npm run dev` (file watch) |
| **React Dev** | `cd apps/samara-web/my-vite-react-app && npm run dev` (hot reload, port 5173) |
| **Test Process Engine** | Run `services/api/scripts/core_process_happy_path.sh` (prompts for tenant, automates API calls) |
| **Full Onboarding Test** | `services/api/scripts/onboarding_full_flow.sh` (complete setup flow with redaction) |
| **Bootstrap Authz** | `node services/api/scripts/bootstrap.mjs "sid=...; csrf=...; did=..." "csrfValue"` (verify permissions) |
| **Database Migrations** | Run `.sql` files in `services/api/db/migrations/` sequentially |

**Validation:** Use happy path scripts to ensure end-to-end functionality before commits.

---

## Authentication & Multi-Tenancy Patterns

The API uses **three authentication realms** (see `services/api/src/server.js` lines 57-63):

1. **EIP Realm** — Licensed internal users with session + device trust
   - Request decorator: `requireLicensedUser()` → validates trusted device
   - Session cookies: `sid` (session ID), `csrf` (CSRF token)

2. **GATEWAY Realm** — Browser/electron clients with basic session
   - Request decorator: `requireSession({ realm: REALMS.GATEWAY })`
   - Uses cookies + CSRF header (`x-csrf`) for state changes

3. **INTEGRATION Realm** — API key authentication for external services
   - Header: `Authorization: Bearer <rawKey>`
   - Request decorator: `requireIntegration()`
   - Key stored as sha256 hash with pepper in `eip_auth.auth_api_key`

**Tenant Resolution:** All requests populate `req.auth = { tenant_id, realm, principal_type, principal_id }`

---

## API Server Architecture

**Fastify Server** (`services/api/src/server.js`):
1. Register environment plugin (validates `.env` via `services/api/src/config.js`)
2. Register DB plugin → exposes `app.db` (pg Pool)
3. Register cookies plugin (required for session auth)
4. Register helmet + rate-limit + CORS
5. Decorate request handlers (`loadSession`, `requireSession`, `requireCsrf`, etc.)
6. Register route modules with `/api` prefix

**Environment Variables** (required in `.env`):
```
NODE_ENV, PORT, HOST, CORS_ORIGIN, COOKIE_SECRET, CSRF_PEPPER, 
DB_HOST, DB_USER, DB_PASSWORD, DB_DATABASE, PG_POOL_MAX,
OTP_PEPPER, REQUIRE_TRUSTED_DEVICE, ELECTRON_CHALLENGE_TTL_SEC
```

**Database Plugin** (`services/api/src/plugins/db.js`):
- Creates `pg.Pool` with connection pool
- Exposes as `app.db`
- Tests connection on startup (fail-fast)
- Closes gracefully on app shutdown

---

## Request Decoration & Middleware Pattern

Fastify decorators are the primary pattern for auth guards. Routes call them explicitly:

```javascript
// In route handlers
const result = await app.requireSession(req, { realm: REALMS.EIP });
if (!result.ok) return reply.status(result.status).send({ error: result.error });

const csrfResult = await app.requireCsrf(req);
if (!csrfResult.ok) return reply.status(csrfResult.status).send({ error: csrfResult.error });
```

**Key Decorators** (in `services/api/src/server.js`):
- `loadSession(req)` — Load session from `sid` cookie, returns null if invalid
- `requireSession(req, opts)` — Validate session + optional realm check, set `req.session` & `req.auth`
- `requireCsrf(req)` — Validate CSRF token for POST/PUT/PATCH/DELETE
- `requireIntegration(req)` — Validate API key, set `req.integration` & `req.auth`
- `requireLicensedUser(req)` — Combine session + device trust validation

---

## Database Migrations

**Location:** `services/api/db/migrations/` (numbered 0001 → 0035+)

**Pattern:** Each migration is a standalone `.sql` file executed sequentially.
- Schema organization: `eip_core` (main), `eip_auth` (auth), `material_master`, etc.
- Triggers: `eip_core.tg_set_updated_at()` auto-updates timestamps
- Extensions: pgcrypto, citext (defined in 0001)

**To add a migration:**
1. Create `000X_description.sql` with next number
2. Include full DDL (no assumptions about prior state)
3. Test locally: `psql -f migration.sql`

---

## React App (Samara Web)

**Location:** `apps/samara-web/my-vite-react-app/`

**Startup:** `npm run dev` (Vite hot reload, port 5173)

**Structure:**
- `src/components/` — React components (PascalCase.jsx)
- `src/services/api.js` — Singleton API client (baseUrl: `http://localhost:4000`)
- `src/config/navigation.jsx` — App navigation + branding config
- `src/main.jsx` — Entry point (renders `<App />`)

**API Client Pattern** (`apps/samara-web/my-vite-react-app/src/services/api.js`):
- Single fetch-based client with configurable baseUrl
- Attach cookies automatically (credentials: include)
- Transform response fields: snake_case → camelCase
- Handle errors: return `{ error: message }`

**CORS:** Configured for `localhost:5173` (Vite dev server)

---

## Common Gotchas & Anti-Patterns

⚠️ **Don't:**
- Expose database rows directly in API responses (always map casing)
- Mix camelCase in DB or snake_case in JS
- Call route handlers directly; use decorators for auth
- Store secrets in code (use `.env`)
- Assume migrations are idempotent (they're sequential)

✅ **Do:**
- Use `req.auth` for tenant resolution in all routes
- Map DB results via object literal: `{ createdAt: row.created_at }`
- Call `requireSession()` first, then `requireCsrf()`
- Reference `docs/decisions/` for architectural rationale
- Test migrations locally before commit
- Consult `docs/dev/naming.md` for casing rules on every new component

---

## Integration Points

**Frontend → API:**
- `fetch(baseUrl + endpoint)` with `credentials: 'include'` + `x-csrf` header
- Cookie-based sessions (sid) or API key auth
- Response format: `{ ok: true, data: {...} }` or `{ ok: false, error: "CODE" }`

**API → Database:**
- Parameterized queries only (`$1`, `$2`, etc.) to prevent SQL injection
- All queries use `app.db.query()` from plugin
- Transactions via explicit `BEGIN`/`COMMIT`

**Deployment:**
- Monorepo allows simultaneous API + frontend updates
- Migrations must be backward-compatible for zero-downtime
- Environment-based config (dev/staging/prod)

---

## Key Files to Study

- `services/api/src/server.js` — Auth realm setup + decorators
- `docs/decisions/0001-repo-structure.md` — Why this structure
- `docs/dev/naming.md` — Strict naming rules
- `services/api/src/config.js` — Environment schema
- `apps/samara-web/my-vite-react-app/src/services/api.js` — API client pattern
- `services/api/src/routes/crm.js` — Route patterns, normalization
- `services/api/docs/CORE_PROCESS_V1.md` — Process engine details

---

## Authentication Flows

### **1. Browser Session (GATEWAY Realm)**

**Flow: OTP-based email login**

```
1. POST /api/auth/request-otp { tenantId, email }
   → Generate 6-digit OTP + challenge ID
   → Hash: sha256(otp:OTP_PEPPER:challengeId)
   → Store in eip_auth.auth_otp_challenge with 10min expiry
   → Log OTP in dev (non-production only)

2. User receives OTP via email (assumed external)

3. POST /api/auth/verify-otp { tenantId, email, otp }
   → Hash received OTP
   → Match against DB challenge
   → Upsert auth_identity (email-based login type)
   → Create session: auth_session (sid, csrf_secret_hash, tenant_id, identity_id, device_id)
   → Set cookies: sid, csrf (same value sent as cookie + required in x-csrf header)
   → Upsert device: auth_device (browser, device_token, user_agent_hash)
   → Return: { ok: true, sid, csrf, ... }

4. Client stores cookies; all subsequent requests:
   → Automatically send: Cookie: sid, csrf
   → For state changes: Include x-csrf header (value must match csrf cookie)
   → API validates via app.requireSession() + app.requireCsrf()
```

**Key Tables:**
- `eip_auth.auth_identity` — Email + active/locked status
- `eip_auth.auth_otp_challenge` — Temporary 10min OTP (deleted after verify)
- `eip_auth.auth_session` — Persistent session (sid UUID, csrf_secret_hash, attrs)
- `eip_auth.auth_device` — Device trust state (browser, user_agent_hash)

**Error Codes:**
- `UNAUTHENTICATED` — No session or expired
- `CSRF_MISSING` / `CSRF_MISMATCH` — Missing or mismatched CSRF
- `DEVICE_NOT_TRUSTED` — Device not yet trusted (may require admin approval)

---

### **2. Desktop/Electron (EIP Realm)**

**Flow: Ed25519 public-key challenge-response**

```
1. POST /api/auth/electron/challenge { tenantId, email }
   → Normalize email (lowercase)
   → Generate challengeId
   → Store challenge in-memory: Map<challengeId, { tenantId, login, identityId, publicKeyPem, expiresAt }>
   → Challenge expires in ELECTRON_CHALLENGE_TTL_SEC (default 120s)
   → Return: { ok: true, challengeId }

2. Client signs challenge with Ed25519 private key
   → Message = base64url-encoded challenge ID
   → Signature = base64-encoded Ed25519 signature

3. POST /api/auth/electron/verify-challenge
   { tenantId, email, challengeId, publicKeyPem, messageB64url, signatureB64url }
   → Retrieve challenge from in-memory map
   → Verify Ed25519 signature
   → Upsert auth_identity (email)
   → Create session (same as browser, but device_kind='electron')
   → Upsert device: auth_device (electron, public_key_pem, label)
   → Check trust_state: 'untrusted' requires ELECTRON_DEVICE_REQUIRE_TRUSTED
   → Return: { ok: true, sid, csrf, trustState, ... }

4. Trusted Desktop Session (requireLicensedUser)
   → Requires realm EIP + device trust_state = 'trusted'
   → Used for licensed internal workflows
```

**Key Differences from Browser:**
- Public-key cryptography (Ed25519) instead of OTP
- Persistent device identity (public key stored)
- Trust state governs access to licensed features
- In-memory challenge map (stateful, single-instance only)

**Error Codes:**
- `CHALLENGE_EXPIRED` — Challenge exceeded TTL
- `SIGNATURE_INVALID` — Ed25519 verification failed
- `DEVICE_REVOKED` — Device explicitly revoked
- `DEVICE_NOT_TRUSTED` — Requires `ELECTRON_DEVICE_REQUIRE_TRUSTED=false` or admin approval

---

### **3. API Key Integration (INTEGRATION Realm)**

**Flow: Bearer token authentication**

```
1. Admin generates API key: Generate random key, hash with pepper
   → Store: eip_auth.auth_api_key { key_hash, tenant_id, is_active, expires_at, scopes, attrs }

2. External service sends request:
   → Header: Authorization: Bearer <rawKey>

3. API validates via app.requireIntegration():
   → Extract key from header
   → Hash key: sha256(rawKey:API_KEY_PEPPER)
   → Lookup in auth_api_key by key_hash
   → Check: is_active, expires_at not past
   → Set req.auth = { tenant_id, realm: INTEGRATION, principal_type: api_key, principal_id: key.id }
   → Set req.integration = { api_key_id, scopes, attrs }

4. Route checks scopes + attrs for fine-grained authz
```

**Key Tables:**
- `eip_auth.auth_api_key` — API key hash, tenant, active status, expiry, scopes

**Error Codes:**
- `NO_API_KEY` — Missing Authorization header
- `INVALID_API_KEY` — Key not found or hash mismatch
- `API_KEY_DISABLED` — is_active = false
- `API_KEY_EXPIRED` — Checked against expires_at

---

### **4. Authorization Bootstrap (Authz Context)**

**Flow: Load permissions for current user**

```
1. GET /api/authz/bootstrap (must have valid session)
   → Validate session (requireSession)
   → Call: SELECT eip_authz.bootstrap($tenantId, $identityId)
   → Returns JSON payload with roles, permissions, scopes
   → Client caches for authorization decisions

2. Scope: Per-tenant, per-identity
   → Used for UI rendering (show/hide features)
   → Backend always re-validates in route handlers
```

**Pattern:** Frontend should not trust bootstrap data for security. Always validate server-side.

---

## Real-Time Communication (Socket Manifest)

**Location:** `services/api/src/routes/socket/manifest.js`

**Purpose:** Socket channel registry and origin allowlist

```
GET /api/socket/manifest
   → Returns: { channels: [...], origins: [...] }
   → Clients use to discover available WebSocket channels
   → Channels scoped by realm + tenant
   → Origins allowlist prevents unauthorized connections
```

**Typical Pattern:**
- Client connects to WebSocket after receiving manifest
- Sends tenant_id + session sid in handshake
- API validates against allowlist
- Subscribe to tenant-scoped channels (e.g., `task-updates:{tenantId}`)

---

---

## Function-Level Reference

### **Crypto & Security Helpers** (`services/api/src/auth/crypto.js`)

| Function | Purpose | Example |
|----------|---------|---------|
| `randomToken(bytes=32)` | URL-safe random bytes | CSRF tokens, device IDs, nonces |
| `randomDigits(length=6)` | Random digit string (OTP) | Returns "483920" for length=6 |
| `sha256Hex(input)` | SHA-256 hash to hex | OTP hash: `sha256Hex("123456:PEPPER:challengeId")` |
| `timingSafeEqual(a, b)` | Timing-safe comparison | Prevents timing attacks on hash/token checks |

**Usage Pattern:**
```javascript
// Generate OTP
const otp = randomDigits(6);
const otpHash = sha256Hex(`${otp}:${app.config.OTP_PEPPER}:${challengeId}`);

// Verify OTP
const calc = sha256Hex(`${userInput}:${app.config.OTP_PEPPER}:${challengeId}`);
if (!timingSafeEqual(calc, storedHash)) return { error: "INVALID_OTP" };
```

---

### **Permission Checking** (`services/api/src/auth/perm.js`)

| Function | Purpose | Returns |
|----------|---------|---------|
| `hasPermission(app, tenantId, identityId, permissionCode)` | Check if identity has permission via role | Boolean |

**Query Chain:** `identity_role → role_permission`

**Usage:**
```javascript
const canTrust = await hasPermission(app, tenantId, identityId, "auth.device.trust");
if (!canTrust) return reply.code(403).send({ ok: false, error: "FORBIDDEN" });
```

**Key Permissions:**
- `auth.device.read` — List devices
- `auth.device.trust` — Mark device as trusted
- `auth.device.revoke` — Revoke device
- Custom permissions defined in `eip_authz.permission` table

---

### **Browser Session Flow** (`services/api/src/routes/auth.js`)

#### **POST /api/auth/request-otp**
**Input:** `{ tenantId, email }`
**Steps:**
1. `randomDigits(6)` → Generate 6-digit OTP
2. `randomToken()` → Challenge ID
3. `sha256Hex(otp:PEPPER:challengeId)` → Hash for storage
4. Transaction:
   - `INSERT INTO eip_auth.auth_identity` with `ON CONFLICT ... DO UPDATE` (upsert)
   - Check `identity.is_active && !identity.is_locked`
   - `INSERT INTO eip_auth.auth_otp_challenge` with 10min `expires_at`
5. Log OTP in dev env: `console.log("[DEV OTP]", otp)`

**Error Codes:** `BAD_REQUEST`, `IDENTITY_DISABLED`

#### **POST /api/auth/verify-otp**
**Input:** `{ tenantId, email, otp }`
**Steps:**
1. Lookup `eip_auth.auth_identity` by tenant + email
2. Query `eip_auth.auth_otp_challenge` (latest, not consumed, not expired)
3. `sha256Hex(userOtp:PEPPER:challengeId)` → Compare with `timingSafeEqual()`
4. Mark challenge `is_consumed=true`
5. **Device Registration:**
   - `upsertBrowserDevice()` — Inserts/updates auth_device with device_token + user_agent_hash
   - Checks device `trust_state`: if revoked, reject
   - If `REQUIRE_TRUSTED_DEVICE=true` and trust_state != 'trusted', reject
6. **Session Creation:**
   - `sessionId = randomUUID()`
   - `csrf = randomToken(24)`
   - `csrfHash = sha256Hex(csrf:CSRF_PEPPER)`
   - `INSERT INTO eip_auth.auth_session` with 12hr expiry, realm='EIP'
7. Set cookies:
   - `sid` (session ID, httpOnly)
   - `csrf` (token value, accessible to JS)
   - `did` (device ID, httpOnly)

**Error Codes:** `OTP_EXPIRED`, `INVALID_OTP`, `DEVICE_REVOKED`, `DEVICE_UNTRUSTED`

#### **Helper: `upsertBrowserDevice()`**
**Location:** auth.js line ~16
**Input:** `{ tenantId, identityId, deviceToken, req }`
**Logic:**
- Compute `uaHash = sha256Hex(user_agent_header)`
- `INSERT ... ON CONFLICT (tenant_id, identity_id, device_kind, device_id)` — Upsert by device_token
- Returns: `{ id, trust_state }`

---

### **Electron/Desktop Flow** (`services/api/src/routes/auth_electron.js`)

#### **POST /api/auth/electron/challenge**
**Input:** `{ tenantId, email, publicKeyPem, label? }`
**Steps:**
1. `upsertIdentity()` — Create/update auth_identity (same as browser)
2. `challengeId = randomUUID()`
3. `rawChallenge = randomBytes(32)` → `bufToB64url()` for transmission
4. **In-memory storage** (stateful, single-instance):
   - `challenges.set(challengeId, { tenantId, login, identityId, publicKeyPem, challenge, expiresAtMs })`
   - Expiry: `ELECTRON_CHALLENGE_TTL_SEC` (default 120s)
5. **Response:** `{ challengeId, challenge (base64url), expiresAt }`

**Note:** In-memory storage means:
- Challenges lost on server restart
- Not distributed across load-balanced instances
- Consider moving to Redis for production

#### **POST /api/auth/electron/attest**
**Input:** `{ tenantId, email, challengeId, signatureBase64 }`
**Steps:**
1. Retrieve challenge from in-memory map
2. Verify tenant/email matches challenge
3. Check expiry: `if (now > expiresAtMs)` → Error
4. **Signature Verification:**
   - `verifyEd25519Signature()` with stored `publicKeyPem`
   - Message = challenge (base64url)
   - Signature = signatureBase64 (base64)
   - Node.js crypto.verify() with Ed25519 PEM key
5. `upsertElectronDevice()` → Register device with public_key_pem
6. Check device `trust_state`:
   - If revoked → Reject
   - If `ELECTRON_DEVICE_REQUIRE_TRUSTED=true` and not trusted → Return `{ requiresApproval: true }`
7. **Session Creation** (same as browser)
8. Set cookies: sid, csrf, did
9. **Response:** `{ device: { id, trust_state }, session: { sid, expiresAt } }`

**Helper: `verifyEd25519Signature()`**
**Location:** auth_electron.js line ~33
**Input:** `{ publicKeyPem, messageB64url, signatureB64url }`
**Logic:**
- Decode base64url message/signature
- `crypto.createPublicKey(publicKeyPem)`
- `crypto.verify(null, msgBuf, publicKey, sigBuf)` (null = Ed25519)
- Returns: Boolean

#### **Helper: `upsertElectronDevice()`**
**Location:** auth_electron.js line ~56
**Input:** `{ tenantId, identityId, publicKeyPem, label, req }`
**Logic:**
- Compute `uaHash = sha256Hex(user_agent)`
- `INSERT ... ON CONFLICT (tenant_id, identity_id, device_kind, public_key_pem)` — Upsert by public key
- Merges attrs: `COALESCE(...) || EXCLUDED.attrs` (JSON merge)
- Returns: `{ id, trust_state }`

---

### **Session Queries** (`services/api/src/routes/auth.js`)

#### **GET /api/auth/whoami**
**Logic:**
- Query `eip_auth.auth_session` by sid
- Join `eip_auth.auth_identity` to get email/login
- Check: not revoked, not expired
- **Response:** Session + identity fields

#### **GET /api/auth/devices**
**Logic:**
1. Load session from sid
2. Check permission: `auth.device.read`
3. Query `eip_auth.auth_device` for tenant + identity
4. Order by `last_seen_at DESC, created_at DESC`
5. **Response:** `{ devices: [...] }`

#### **POST /api/auth/devices/:deviceId/trust**
**Logic:**
1. `requireCsrf()` validation
2. Load session
3. Check permission: `auth.device.trust`
4. `UPDATE eip_auth.auth_device SET trust_state='trusted'` for deviceId
5. Cascade: Sessions linked to device now pass `requireLicensedUser()` check

#### **POST /api/auth/devices/:deviceId/revoke**
**Logic:**
1. `requireCsrf()` validation
2. Load session
3. Check permission: `auth.device.revoke`
4. `UPDATE eip_auth.auth_device SET trust_state='revoked'`
5. **Cascade:** `UPDATE eip_auth.auth_session SET is_revoked=true` for all sessions linked to device
   - This logs out all active sessions on that device

#### **POST /api/auth/logout**
**Logic:**
1. `requireCsrf()` validation
2. `UPDATE eip_auth.auth_session SET is_revoked=true` by sid
3. Clear cookies: sid, csrf

---

### **Request Decorators** (`services/api/src/server.js`)

#### **`app.loadSession(req)`**
**Purpose:** Load session from cookie without validation
**Returns:** Session object or null
**Logic:**
```javascript
const sid = req.cookies?.sid;
SELECT id, tenant_id, identity_id, device_id, is_revoked, expires_at, attrs, csrf_secret_hash
  FROM eip_auth.auth_session WHERE id=$1
Check: !is_revoked && expires_at > now()
Return: { ...session, realm }
```

#### **`app.requireSession(req, opts)`**
**Purpose:** Validate + load session, set req.session + req.auth
**Options:** `{ realm: "EIP"|"GATEWAY"|"INTEGRATION" }` (optional)
**Returns:** `{ ok: bool, status: int, error: string, session: object }`
**Logic:**
```javascript
const s = await app.loadSession(req);
if (!s) return { ok: false, status: 401, error: "UNAUTHENTICATED" };
if (opts.realm && s.realm !== opts.realm) return { ok: false, status: 403, error: "WRONG_REALM" };
req.session = s;
req.auth = { tenant_id: s.tenant_id, realm: s.realm, principal_type: "session", principal_id: s.id, identity_id: s.identity_id };
return { ok: true, session: s };
```
**Usage:** `const result = await app.requireSession(req, { realm: REALMS.EIP }); if (!result.ok) return reply.code(result.status)...`

#### **`app.requireCsrf(req)`**
**Purpose:** Validate CSRF token on state-changing requests
**Returns:** `{ ok: bool, status: int, error: string }`
**Logic:**
```javascript
// Only required for POST/PUT/PATCH/DELETE
Extract: req.cookies.csrf (cookie value), req.headers["x-csrf"] (header value)
Verify: Cookie value === Header value (double-submit)
Verify: sha256Hex(csrfCookie:CSRF_PEPPER) === session.csrf_secret_hash
Prevent timing attacks: timingSafeEqual() for hash comparison
Attach: req.session = hydrated session (from loadSession)
```
**Usage:**
```javascript
const csrfResult = await app.requireCsrf(req);
if (!csrfResult.ok) return reply.code(csrfResult.status).send({ error: csrfResult.error });
```

#### **`app.requireIntegration(req)`**
**Purpose:** Validate API key, set req.integration + req.auth
**Returns:** `{ ok: bool, status: int, error: string }`
**Logic:**
```javascript
Extract: Authorization header "Bearer <rawKey>"
Hash: sha256Hex(rawKey:API_KEY_PEPPER)
Lookup: SELECT * FROM eip_auth.auth_api_key WHERE key_hash=$1
Verify: is_active && (expires_at IS NULL || expires_at > now())
Set: req.auth = { tenant_id, realm: INTEGRATION, principal_type: api_key, principal_id: key.id }
Set: req.integration = { api_key_id, scopes, attrs }
```

#### **`app.requireLicensedUser(req)`**
**Purpose:** Validate EIP realm session + trusted device
**Returns:** `{ ok: bool, status: int, error: string }`
**Logic:**
```javascript
const s = await app.requireSession(req, { realm: REALMS.EIP });
if (!s.ok) return s;
const deviceId = s.session.device_id;
if (!deviceId) return { ok: false, status: 401, error: "DEVICE_REQUIRED" };
SELECT trust_state FROM eip_auth.auth_device WHERE id=$1
Verify: trust_state === "trusted"
Return: { ok: true }
```

---

## Assessment of Tenant Creation, Authentication, and Authorization Flow

**Status**: No bugs found in code. Flow is robust with proper security (OTP hashing, rate limits, CSRF, transactions).

**Tenant Creation (Bootstrap)**:
- Routes: `/api/eip/bootstrap/tenant-request`, `/verify-otp`, `/complete`.
- Process: Request → OTP verify → DB setup (tenant schema, roles, permissions).
- Security: Argon2 for secrets, atomic transactions.

**Authentication**:
- Routes: `/api/eip/auth/request-otp`, `/verify-otp`.
- Process: OTP request → verify → session + device creation.
- Realms: EIP (desktop), GATEWAY (browser), INTEGRATION (API key).
- Security: Timing-safe OTP check, device trust, session TTL 12h.

**Authorization**:
- Route: `GET /api/authz/bootstrap`.
- Process: Requires EIP session + CSRF, returns roles/permissions via DB function.

**Potential Runtime Issues** (not code bugs):
- Server not running: Start with `npm run dev` in `services/api/`.
- Env vars missing: Ensure `.env` has `DB_*`, `OTP_PEPPER`, etc.
- DB not ready: Run migrations.
- Email optional: OTP logged in dev mode.

**Testing**: Use `scripts/onboarding_full_flow.sh` for end-to-end simulation.

---

## Questions to Ask Before Coding

1. **What realm?** (EIP, GATEWAY, or INTEGRATION) — Determines auth decorator
2. **Tenant-scoped?** — Add `WHERE tenant_id = $1` + use `req.auth.tenant_id`
3. **State change?** — Require CSRF token validation
4. **New table?** — Create migration, define schema in `eip_*` namespace
5. **Snake/camel mismatch?** — Consult `docs/dev/naming.md` and map explicitly
6. **Auth flow?** — OTP (browser), Ed25519 (desktop), or API key (integration)?
7. **Device trust?** — Does this require trusted device or is untrusted OK?
8. **Permission check?** — Which role + permission code needed? Use `hasPermission(app, tenantId, identityId, "code")`
9. **CSRF needed?** — Always for POST/PUT/PATCH/DELETE; never for GET
10. **Transaction needed?** — Use `client.query("BEGIN")` for multi-step ops that must atomically succeed/fail