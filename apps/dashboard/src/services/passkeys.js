import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import { apiFetch } from "./apiClient";

function normalizeText(value) {
  return String(value || "").trim();
}

function browserSupportsPasskeys() {
  return browserSupportsWebAuthn();
}

async function platformPasskeyAvailable() {
  try {
    return await platformAuthenticatorIsAvailable();
  } catch {
    return false;
  }
}

async function listPasskeys() {
  return apiFetch("/api/eip/auth/passkeys");
}

async function registerPasskey(label) {
  const optionsResult = await apiFetch("/api/eip/auth/passkeys/register/options", {
    method: "POST",
    body: { label: normalizeText(label) || "Passkey" },
  });
  const credential = await startRegistration({ optionsJSON: optionsResult.options });
  return apiFetch("/api/eip/auth/passkeys/register/verify", {
    method: "POST",
    body: {
      challenge_id: optionsResult.challenge_id,
      credential,
    },
  });
}

async function stepUpWithPasskey() {
  const optionsResult = await apiFetch("/api/eip/auth/passkeys/step-up/options", {
    method: "POST",
    body: {},
  });
  const credential = await startAuthentication({ optionsJSON: optionsResult.options });
  return apiFetch("/api/eip/auth/passkeys/step-up/verify", {
    method: "POST",
    body: {
      challenge_id: optionsResult.challenge_id,
      credential,
    },
  });
}

async function loginWithPasskey(payload) {
  const optionsResult = await apiFetch("/api/eip/auth/passkeys/login/options", {
    method: "POST",
    body: payload,
  });
  const credential = await startAuthentication({ optionsJSON: optionsResult.options });
  return apiFetch("/api/eip/auth/passkeys/login/verify", {
    method: "POST",
    body: {
      challenge_id: optionsResult.challenge_id,
      credential,
    },
  });
}

async function revokePasskey(passkeyId) {
  return apiFetch(`/api/eip/auth/passkeys/${passkeyId}/revoke`, {
    method: "POST",
    body: {},
  });
}

export {
  browserSupportsPasskeys,
  listPasskeys,
  loginWithPasskey,
  platformPasskeyAvailable,
  registerPasskey,
  revokePasskey,
  stepUpWithPasskey,
};
