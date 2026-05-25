#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

const HOSTED_RAILWAY_HOSTS = new Set([
  "eip-ecom-v1.up.railway.app",
  "eip-dashboard.up.railway.app"
]);

const DEFAULT_SCENARIOS = [
  "public-gateway-invalid",
  "public-commerce-invalid",
  "replay-invalid",
  "tenant-request-burst",
  "auth-login-attempt",
  "upload-reject",
  "api-key-lifecycle"
];

function normalizeText(value) {
  return String(value || "").trim();
}

function parseArgs(argv = process.argv.slice(2), env = process.env) {
  const options = {
    mode: normalizeText(env.SYNTHETIC_MODE) || "plan",
    baseUrl: normalizeText(env.SYNTHETIC_API_URL) || "http://localhost:4000",
    dashboardOrigin: normalizeText(env.SYNTHETIC_DASHBOARD_ORIGIN) || "http://localhost:5173",
    publicOrigin: normalizeText(env.SYNTHETIC_PUBLIC_ORIGIN) || "https://synthetic.invalid",
    label: normalizeText(env.SYNTHETIC_LABEL) || "eip-v1-synthetic",
    runId: normalizeText(env.SYNTHETIC_RUN_ID) || `synthetic-${randomUUID()}`,
    tenantCode: normalizeText(env.SYNTHETIC_TEST_TENANT_CODE),
    tenantId: normalizeText(env.SYNTHETIC_TEST_TENANT_ID),
    suffix: normalizeText(env.SYNTHETIC_CONNECTION_SUFFIX),
    apiKey: normalizeText(env.SYNTHETIC_API_KEY),
    sessionCookie: normalizeText(env.SYNTHETIC_SESSION_COOKIE),
    csrfToken: normalizeText(env.SYNTHETIC_CSRF_TOKEN),
    authEmail: normalizeText(env.SYNTHETIC_AUTH_EMAIL),
    authPassword: normalizeText(env.SYNTHETIC_AUTH_PASSWORD),
    burst: Number(env.SYNTHETIC_BURST || 3),
    ratePerSec: Number(env.SYNTHETIC_RATE_PER_SEC || 1),
    allowHosted: env.SYNTHETIC_ALLOW_HOSTED === "true",
    allowWrites: env.SYNTHETIC_ALLOW_PUBLIC_WRITES === "true",
    allowAuth: env.SYNTHETIC_ALLOW_AUTH === "true",
    allowControlPlane: env.SYNTHETIC_ALLOW_CONTROL_PLANE === "true",
    allowValidGateway: env.SYNTHETIC_ALLOW_VALID_GATEWAY === "true",
    scenarios: normalizeText(env.SYNTHETIC_SCENARIOS)
      ? normalizeText(env.SYNTHETIC_SCENARIOS).split(",").map((item) => item.trim()).filter(Boolean)
      : [...DEFAULT_SCENARIOS]
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const [rawKey, inlineValue] = arg.slice(2).split("=");
    const key = rawKey.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
    const nextValue = argv[i + 1];
    const hasSeparateValue = inlineValue === undefined && nextValue && !String(nextValue).startsWith("--");
    const value = inlineValue ?? (hasSeparateValue ? nextValue : undefined);
    if (hasSeparateValue) i += 1;
    if (["allowHosted", "allowWrites", "allowAuth", "allowControlPlane", "allowValidGateway"].includes(key)) {
      options[key] = value === undefined || value === "true";
    } else if (key === "scenarios") {
      options.scenarios = String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
    } else if (key === "burst" || key === "ratePerSec") {
      options[key] = Number(value);
    } else if (key in options) {
      options[key] = normalizeText(value);
    }
  }

  options.mode = options.mode === "run" ? "run" : "plan";
  options.burst = Number.isFinite(options.burst) && options.burst > 0 ? Math.min(25, Math.floor(options.burst)) : 3;
  options.ratePerSec = Number.isFinite(options.ratePerSec) && options.ratePerSec > 0 ? Math.min(10, options.ratePerSec) : 1;
  return options;
}

function targetInfo(baseUrl) {
  const parsed = new URL(baseUrl);
  return {
    origin: parsed.origin,
    host: parsed.host.toLowerCase(),
    hostedRailway: HOSTED_RAILWAY_HOSTS.has(parsed.host.toLowerCase())
  };
}

function assertSafeTarget(options) {
  const info = targetInfo(options.baseUrl);
  if (!info.host) throw new Error("SYNTHETIC_TARGET_INVALID");
  if (info.host.includes("localhost") || info.host.startsWith("127.0.0.1")) return true;
  if (info.host.endsWith(".invalid") || info.host.endsWith(".test")) return true;
  if (info.hostedRailway) {
    const scoped = Boolean(options.tenantCode || options.tenantId || options.suffix);
    if (options.allowHosted && scoped) return true;
    throw new Error("HOSTED_TARGET_REQUIRES_SYNTHETIC_ALLOW_HOSTED_AND_TEST_SCOPE");
  }
  if (options.allowHosted && (options.tenantCode || options.tenantId || options.suffix)) return true;
  throw new Error("NON_LOCAL_TARGET_REQUIRES_EXPLICIT_ALLOW_AND_TEST_SCOPE");
}

function redactHeaders(headers = {}) {
  const out = {};
  for (const [key, value] of Object.entries(headers)) {
    const normalized = key.toLowerCase();
    out[key] = /(authorization|cookie|token|key|secret|signature|csrf)/i.test(normalized)
      ? "[REDACTED]"
      : value;
  }
  return out;
}

function buildPlan(options) {
  return options.scenarios.map((scenario) => {
    switch (scenario) {
      case "public-gateway-invalid":
        return {
          scenario,
          method: "POST",
          path: `/api/public/gateway/intake/${encodeURIComponent(options.suffix || "missing-suffix")}`,
          safeDefault: true,
          requires: ["SYNTHETIC_CONNECTION_SUFFIX for live route resolution"],
          expected: "origin/key/signature rejection and security event"
        };
      case "public-commerce-invalid":
        return {
          scenario,
          method: "GET",
          path: `/api/public/commerce/${encodeURIComponent(options.suffix || "missing-suffix")}/catalog?api_key=synthetic`,
          safeDefault: true,
          requires: ["SYNTHETIC_CONNECTION_SUFFIX for live route resolution"],
          expected: "query-string API key rejection"
        };
      case "replay-invalid":
        return {
          scenario,
          method: "POST",
          path: `/api/public/gateway/intake/${encodeURIComponent(options.suffix || "missing-suffix")}`,
          safeDefault: true,
          requires: ["SYNTHETIC_CONNECTION_SUFFIX"],
          expected: "same synthetic event id observed twice without raw secret leakage"
        };
      case "tenant-request-burst":
        return {
          scenario,
          method: "POST",
          path: "/api/public/tenant-requests",
          safeDefault: false,
          requires: ["--allow-writes", "dedicated synthetic request data"],
          expected: "quota/rate behavior and onboarding security events"
        };
      case "auth-login-attempt":
        return {
          scenario,
          method: "POST",
          path: "/api/eip/auth/login",
          safeDefault: false,
          requires: ["--allow-auth", "SYNTHETIC_AUTH_EMAIL", "SYNTHETIC_TEST_TENANT_CODE or TENANT_ID"],
          expected: "failed-login lockout/audit behavior without real customer identities"
        };
      case "upload-reject":
        return {
          scenario,
          method: "POST",
          path: "/api/eip/auth/profile/avatar",
          safeDefault: false,
          requires: ["SYNTHETIC_SESSION_COOKIE", "SYNTHETIC_CSRF_TOKEN"],
          expected: "EICAR/active-content upload rejection event"
        };
      case "api-key-lifecycle":
        return {
          scenario,
          method: "POST",
          path: `/api/eip/gateway/connections/${encodeURIComponent(options.tenantId || "tenant-id")}/api-keys`,
          safeDefault: false,
          requires: ["--allow-control-plane", "SYNTHETIC_SESSION_COOKIE", "SYNTHETIC_CSRF_TOKEN", "SYNTHETIC_TEST_TENANT_ID"],
          expected: "create/rotate/revoke control-plane audit events"
        };
      default:
        return { scenario, safeDefault: false, skip: true, reason: "UNKNOWN_SCENARIO" };
    }
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function send(options, request) {
  const url = new URL(request.path, options.baseUrl);
  const headers = {
    accept: "application/json",
    "user-agent": "EIP-SyntheticValidationBot/1.0",
    "x-eip-synthetic-run": options.runId,
    "x-eip-synthetic-label": options.label,
    ...request.headers
  };
  const started = Date.now();
  const response = await fetch(url, {
    method: request.method,
    headers,
    body: request.body
  });
  const text = await response.text();
  return {
    scenario: request.scenario,
    method: request.method,
    url: `${url.origin}${url.pathname}`,
    status: response.status,
    duration_ms: Date.now() - started,
    headers: redactHeaders(headers),
    body_excerpt: text.slice(0, 240)
  };
}

function jsonHeaders(origin, extra = {}) {
  return {
    "content-type": "application/json",
    origin,
    ...extra
  };
}

function authCookieHeaders(options) {
  return {
    origin: options.dashboardOrigin,
    cookie: options.sessionCookie,
    "x-csrf": options.csrfToken
  };
}

function buildRequestsForScenario(options, scenario) {
  const suffix = encodeURIComponent(options.suffix || "missing-suffix");
  const eventId = `synthetic-${options.runId}`;
  if (scenario === "public-gateway-invalid") {
    return [{
      scenario,
      method: "POST",
      path: `/api/public/gateway/intake/${suffix}`,
      headers: jsonHeaders(options.publicOrigin, {
        "x-api-key": "synthetic-invalid",
        "x-eip-event-id": `${eventId}-gateway-invalid`
      }),
      body: JSON.stringify({ synthetic: true, run_id: options.runId, valid: false })
    }];
  }
  if (scenario === "public-commerce-invalid") {
    return [{
      scenario,
      method: "GET",
      path: `/api/public/commerce/${suffix}/catalog?api_key=synthetic-invalid`,
      headers: { origin: options.publicOrigin }
    }];
  }
  if (scenario === "replay-invalid") {
    const request = {
      scenario,
      method: "POST",
      path: `/api/public/gateway/intake/${suffix}`,
      headers: jsonHeaders(options.publicOrigin, {
        "x-api-key": options.allowValidGateway ? options.apiKey : "synthetic-invalid",
        "x-eip-event-id": `${eventId}-replay`
      }),
      body: JSON.stringify({ synthetic: true, run_id: options.runId, replay_probe: true })
    };
    return [request, { ...request }];
  }
  if (scenario === "tenant-request-burst") {
    if (!options.allowWrites) return [{ scenario, skip: true, reason: "ALLOW_WRITES_REQUIRED" }];
    return Array.from({ length: options.burst }, (_, idx) => ({
      scenario,
      method: "POST",
      path: "/api/public/tenant-requests",
      headers: jsonHeaders(options.publicOrigin),
      body: JSON.stringify({
        organisation_name: `Synthetic Validation ${options.runId} ${idx + 1}`,
        organisation_code: `synthetic_${idx + 1}_${Date.now()}`,
        contact_name: "Synthetic Bot",
        email: `synthetic+${idx + 1}@example.invalid`,
        website: "https://synthetic.invalid",
        business_type: "validation",
        accept_terms: true,
        accept_privacy: true,
        synthetic: true,
        synthetic_run_id: options.runId
      })
    }));
  }
  if (scenario === "auth-login-attempt") {
    if (!options.allowAuth || !options.authEmail || (!options.tenantCode && !options.tenantId)) {
      return [{ scenario, skip: true, reason: "ALLOW_AUTH_AND_TEST_IDENTITY_REQUIRED" }];
    }
    return [{
      scenario,
      method: "POST",
      path: "/api/eip/auth/login",
      headers: jsonHeaders(options.dashboardOrigin),
      body: JSON.stringify({
        tenantCode: options.tenantCode || undefined,
        tenantId: options.tenantId || undefined,
        email: options.authEmail,
        password: options.authPassword || "synthetic-invalid-password"
      })
    }];
  }
  if (scenario === "upload-reject") {
    if (!options.sessionCookie || !options.csrfToken) {
      return [{ scenario, skip: true, reason: "SESSION_AND_CSRF_REQUIRED" }];
    }
    const boundary = `----eip-synthetic-${randomUUID()}`;
    const eicar = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
    return [{
      scenario,
      method: "POST",
      path: "/api/eip/auth/profile/avatar",
      headers: {
        ...authCookieHeaders(options),
        "content-type": `multipart/form-data; boundary=${boundary}`
      },
      body: [
        `--${boundary}`,
        'Content-Disposition: form-data; name="file"; filename="synthetic.png"',
        "Content-Type: image/png",
        "",
        eicar,
        `--${boundary}--`,
        ""
      ].join("\r\n")
    }];
  }
  if (scenario === "api-key-lifecycle") {
    if (!options.allowControlPlane || !options.sessionCookie || !options.csrfToken || !options.tenantId) {
      return [{ scenario, skip: true, reason: "CONTROL_PLANE_SCOPE_REQUIRED" }];
    }
    return [{
      scenario,
      method: "POST",
      path: `/api/eip/gateway/connections/${encodeURIComponent(options.tenantId)}/api-keys`,
      headers: jsonHeaders(options.dashboardOrigin, authCookieHeaders(options)),
      body: JSON.stringify({ label: `Synthetic ${options.runId}`, expires_at: null })
    }];
  }
  return [{ scenario, skip: true, reason: "UNKNOWN_SCENARIO" }];
}

async function runBot(options) {
  assertSafeTarget(options);
  const plan = buildPlan(options);
  if (options.mode !== "run") {
    return { ok: true, mode: "plan", target: targetInfo(options.baseUrl), plan };
  }

  const results = [];
  const delayMs = Math.ceil(1000 / options.ratePerSec);
  for (const scenario of options.scenarios) {
    const requests = buildRequestsForScenario(options, scenario);
    for (const request of requests) {
      if (request.skip) {
        results.push({ scenario, skipped: true, reason: request.reason });
        continue;
      }
      results.push(await send(options, request));
      await delay(delayMs);
    }
  }
  return { ok: true, mode: "run", target: targetInfo(options.baseUrl), run_id: options.runId, results };
}

async function main() {
  const options = parseArgs();
  const result = await runBot(options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ ok: false, error: error.message }, null, 2)}\n`);
    process.exitCode = 1;
  });
}

export {
  assertSafeTarget,
  buildPlan,
  parseArgs,
  redactHeaders,
  runBot,
  targetInfo
};
