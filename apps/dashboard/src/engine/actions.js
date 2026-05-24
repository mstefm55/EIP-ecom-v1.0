const ACTION_MAP = {
  "open-modal": (ctx) => ctx?.onOpenModal?.(),
  "close-modal": (ctx) => ctx?.onCloseModal?.(),
  "request-otp": (ctx) => ctx?.auth?.requestOtp?.(),
  "verify-otp": (ctx) => ctx?.otp?.verify?.(),
  "verify-totp": (ctx) => ctx?.auth?.verifyTotp?.(),
  "passkey-login": (ctx) => ctx?.auth?.passkeyLogin?.(),
  "password-login": (ctx) => ctx?.auth?.passwordLogin?.(),
  "enroll-totp": (ctx) => ctx?.totp?.enroll?.(),
  "confirm-totp": (ctx) => ctx?.totp?.confirm?.(),
  "request-access": (ctx) => ctx?.requestAccess?.submit?.(),
  "resolve-organisations": (ctx) => ctx?.auth?.resolveOrganisations?.(),
  "request-password-reset": (ctx) => ctx?.auth?.requestPasswordReset?.(),
  "confirm-password-reset": (ctx) => ctx?.reset?.submit?.(),
  "request-recovery": (ctx) => ctx?.auth?.requestRecovery?.(),
  "consume-recovery": (ctx) => ctx?.recovery?.submit?.(),
};

function runStringAction(action, ctx) {
  if (!action) return undefined;
  if (action.startsWith("open-modal:")) {
    const id = action.slice("open-modal:".length);
    return ctx?.modal?.open?.(id);
  }
  if (action === "close-modal") {
    return ctx?.modal?.close?.();
  }
  if (action.startsWith("navigate:")) {
    window.location.href = action.slice("navigate:".length);
    return undefined;
  }
  const handler = ACTION_MAP[action];
  return handler ? handler(ctx) : undefined;
}

export async function runAction(action, ctx) {
  if (!action) return;
  try {
    if (Array.isArray(action)) {
      let lastResult;
      for (const item of action) {
        lastResult = await runAction(item, ctx);
      }
      return lastResult;
    }
    if (typeof action === "string") {
      return await runStringAction(action, ctx);
    }
  } catch (error) {
    // Errors are surfaced via ctx status handlers; avoid unhandled promise noise.
    return;
  }
}
