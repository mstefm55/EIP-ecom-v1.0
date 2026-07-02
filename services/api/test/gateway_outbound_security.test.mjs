import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import {
  assertOutboundUrlAllowed,
  buildOAuthClientCredentialsRequest,
  buildOutboundAuth,
  fetchWithTimeout,
  isForbiddenAddress
} from "../src/services/gateway/outbound.js";

test("PayPal OAuth client credentials use HTTP Basic authentication", () => {
  const request = buildOAuthClientCredentialsRequest({
    identity: { connection_kind: "paypal" },
    routing: { provider_code: "paypal" },
    outbound: {
      timeout_ms: 8000,
      auth: {
        client_id: "paypal-client-id",
        client_secret: "paypal-client-secret",
        token_url: "https://api-m.sandbox.paypal.com/v1/oauth2/token"
      }
    }
  });

  assert.equal(request.client_auth_method, "basic");
  assert.equal(
    request.options.headers.Authorization,
    `Basic ${Buffer.from("paypal-client-id:paypal-client-secret").toString("base64")}`
  );
  assert.equal(request.options.body, "grant_type=client_credentials");
  assert.doesNotMatch(request.options.body, /client_id|client_secret/);
});

test("PayPal OAuth rejects a sandbox account email used as the REST app Client ID", () => {
  assert.throws(
    () => buildOAuthClientCredentialsRequest({
      identity: { connection_kind: "paypal" },
      routing: { provider_code: "paypal" },
      outbound: {
        auth: {
          client_id: "sandbox-business@example.com",
          client_secret: "paypal-client-secret",
          token_url: "https://api-m.sandbox.paypal.com/v1/oauth2/token"
        }
      }
    }),
    /OAUTH_CLIENT_ID_INVALID/
  );
});

test("generic OAuth connections retain form-body client authentication", () => {
  const request = buildOAuthClientCredentialsRequest({
    identity: { connection_kind: "custom" },
    outbound: {
      auth: {
        client_id: "generic-client",
        client_secret: "generic-secret",
        token_url: "https://oauth.example/token"
      }
    }
  });

  assert.equal(request.client_auth_method, "body");
  assert.equal(request.options.headers.Authorization, undefined);
  assert.match(request.options.body, /client_id=generic-client/);
  assert.match(request.options.body, /client_secret=generic-secret/);
});

test("outbound timeout remains active while a successful response body is still streaming", async (t) => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/plain" });
    res.write("partial");
    setTimeout(() => res.end("-late"), 500);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();

  const response = await fetchWithTimeout(`http://127.0.0.1:${address.port}/slow-body`, {
    timeout_ms: 150
  });
  assert.equal(response.status, 200);
  await assert.rejects(response.text(), (error) => error?.name === "AbortError");
});

function profile({ environment = "production", outbound = {} } = {}) {
  return {
    identity: {
      connection_code: "outbound-test",
      direction: "outbound",
      environment,
      is_enabled: true
    },
    outbound: {
      base_url: "https://93.184.216.34",
      path_prefix: "/",
      auth_mode: "none",
      ...outbound
    }
  };
}

test("outbound egress guard rejects private, loopback, link-local, metadata, and internal targets", async () => {
  assert.equal(isForbiddenAddress("10.0.0.1"), true);
  assert.equal(isForbiddenAddress("127.0.0.1"), true);
  assert.equal(isForbiddenAddress("169.254.169.254"), true);
  assert.equal(isForbiddenAddress("172.16.0.10"), true);
  assert.equal(isForbiddenAddress("192.168.1.10"), true);
  assert.equal(isForbiddenAddress("::1"), true);
  assert.equal(isForbiddenAddress("fc00::1"), true);
  assert.equal(isForbiddenAddress("fe80::1"), true);
  assert.equal(isForbiddenAddress("93.184.216.34"), false);

  await assert.rejects(
    () => assertOutboundUrlAllowed("https://127.0.0.1/webhook", profile()),
    /OUTBOUND_TARGET_IP_FORBIDDEN/
  );
  await assert.rejects(
    () => assertOutboundUrlAllowed("https://169.254.169.254/latest/meta-data", profile()),
    /OUTBOUND_TARGET_IP_FORBIDDEN/
  );
  await assert.rejects(
    () => assertOutboundUrlAllowed("https://[::1]/webhook", profile()),
    /OUTBOUND_TARGET_IP_FORBIDDEN/
  );
  await assert.rejects(
    () => assertOutboundUrlAllowed("https://localhost/webhook", profile()),
    /OUTBOUND_TARGET_HOST_FORBIDDEN/
  );
});

test("production outbound profiles require HTTPS and block URL credentials", async () => {
  await assert.rejects(
    () => assertOutboundUrlAllowed("http://93.184.216.34/webhook", profile()),
    /OUTBOUND_HTTPS_REQUIRED/
  );
  await assert.rejects(
    () => assertOutboundUrlAllowed("https://user:pass@93.184.216.34/webhook", profile()),
    /OUTBOUND_URL_CREDENTIALS_FORBIDDEN/
  );
  await assert.doesNotReject(
    () => assertOutboundUrlAllowed("https://93.184.216.34/webhook", profile())
  );
});

test("sandbox profiles may explicitly allow plain HTTP to public addresses only", async () => {
  const sandbox = profile({
    environment: "sandbox",
    outbound: { allow_insecure_http: true }
  });

  await assert.doesNotReject(
    () => assertOutboundUrlAllowed("http://93.184.216.34/webhook", sandbox)
  );
  await assert.rejects(
    () => assertOutboundUrlAllowed("http://127.0.0.1/webhook", sandbox),
    /OUTBOUND_TARGET_IP_FORBIDDEN/
  );
});

test("oauth client credential token URLs use the same outbound denylist", async () => {
  const p = profile({
    outbound: {
      auth_mode: "oauth2_client_credentials",
      auth: {
        client_id: "client",
        client_secret: "secret",
        token_url: "https://127.0.0.1/oauth/token"
      }
    }
  });

  await assert.rejects(
    () => buildOutboundAuth(p),
    /OUTBOUND_TARGET_IP_FORBIDDEN/
  );
});
