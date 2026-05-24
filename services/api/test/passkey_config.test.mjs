import assert from "node:assert/strict";
import test from "node:test";
import { credentialFromRow, publicPasskey, resolvePasskeyRp, toBase64Url } from "../src/auth/passkeys.js";

test("passkey RP context defaults to the hosted dashboard origin", () => {
  const app = {
    config: {
      CORS_ORIGIN: "https://eip-dashboard.up.railway.app,http://localhost:5173",
      WEBAUTHN_RP_ID: "",
      WEBAUTHN_RP_NAME: "EIP"
    }
  };
  const rp = resolvePasskeyRp(app);
  assert.equal(rp.rpID, "eip-dashboard.up.railway.app");
  assert.equal(rp.rpName, "EIP");
  assert.deepEqual(rp.expectedOrigin, ["https://eip-dashboard.up.railway.app", "http://localhost:5173"]);
});

test("passkey public serialization never returns public key material", () => {
  const row = {
    id: "pk-1",
    credential_id: "credential",
    public_key: "secret-public-key-bytes",
    counter: 10,
    transports: ["internal"],
    device_type: "multiDevice",
    backed_up: true,
    label: "Laptop",
    created_at: "2026-05-24T12:00:00Z",
    last_used_at: null,
    is_revoked: false
  };

  const out = publicPasskey(row);
  assert.equal(out.public_key, undefined);
  assert.equal(out.credential_id, "credential");
  assert.equal(out.backed_up, true);
});

test("stored passkey rows convert back to SimpleWebAuthn credential shape", () => {
  const publicKey = new Uint8Array([1, 2, 3, 4]);
  const row = {
    credential_id: "cred-id",
    public_key: toBase64Url(publicKey),
    counter: 4,
    transports: ["usb"]
  };
  const credential = credentialFromRow(row);
  assert.equal(credential.id, "cred-id");
  assert.equal(Buffer.from(credential.publicKey).toString("hex"), "01020304");
  assert.equal(credential.counter, 4);
});
