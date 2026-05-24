import assert from "node:assert/strict";
import test from "node:test";
import {
  assertOutboundUrlAllowed,
  buildOutboundAuth,
  isForbiddenAddress
} from "../src/services/gateway/outbound.js";

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
