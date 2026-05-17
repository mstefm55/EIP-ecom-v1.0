BEGIN;

INSERT INTO eip_core.ui_surface
  (tenant_id, code, title, version, is_active, is_published, is_public, tree, attrs)
VALUES
  (
    NULL,
    'auth',
    'EIP Access',
    (
      SELECT COALESCE(MAX(version), 0) + 1
      FROM eip_core.ui_surface
      WHERE tenant_id IS NULL
        AND code = 'auth'
    ),
    true,
    true,
    true,
    $${
  "id": "auth-shell",
  "type": "AuthShell",
  "props": {
    "brand": "EIP Core",
    "nav": ["Platform", "Security", "Docs", "Status"],
    "cta": "Request Access",
    "ctaAction": "open-modal:request-access-modal",
    "quickLoginLabel": "Quick Login",
    "quickAction": "open-modal:otp-modal",
    "helper": "Secure access with OTP and TOTP verification."
  },
  "children": [
    {
      "id": "auth-hero",
      "type": "AuthHero",
      "props": {
        "eyebrow": "Identity Gateway",
        "title": "Secure access to every workspace.",
        "titleClass": "mt-4 text-3xl font-semibold leading-tight text-ink-900 md:text-4xl",
        "subtitle": "Secure access to your workspace. Enter your email, select your organisation, and authenticate with OTP or TOTP."
      }
    },
    {
      "id": "auth-panels",
      "type": "AuthPanelStack",
      "props": { "title": "Authenticate" },
      "children": [
        {
          "id": "login-card",
          "type": "AuthLoginCard",
          "props": {
            "title": "Welcome back",
            "subtitle": "Sign in to your organisation account.",
            "fields": [
              { "label": "Email", "key": "email", "type": "email", "placeholder": "ops@organisation.com" },
              { "label": "Organisation", "key": "organisation", "placeholder": "Enter org name or code" },
              { "label": "Password", "key": "password", "type": "password", "placeholder": "********" },
              { "label": "TOTP Code", "key": "totp", "placeholder": "123 456" }
            ],
            "primaryAction": "Request OTP",
            "primaryEvent": ["request-otp"],
            "primarySuccessModal": "otp-modal",
            "secondaryAction": "Use password-only (trusted device)",
            "secondaryEvent": "password-login",
            "totpLoginAction": "Verify TOTP",
            "totpLoginEvent": "verify-totp",
            "totpAction": "Set up TOTP",
            "totpEvent": "open-modal:totp-modal",
            "showTotp": true,
            "forgotLabel": "Forgot password?",
            "forgotEvent": "open-modal:reset-request-modal",
            "recoveryLabel": "Recovery access",
            "recoveryEvent": "open-modal:recovery-request-modal",
            "footnote": "For your security, additional verification may be required."
          }
        },
        {
          "id": "feature-grid",
          "type": "AuthFeatureGrid",
          "props": {
            "items": [
              { "title": "Session assurance", "desc": "Verified sign-ins maintain a secure and consistent session." },
              { "title": "Cross-site verification", "desc": "Verification checks are enforced across connected access points." },
              { "title": "Device trust", "desc": "Recognized devices improve sign-in continuity while preserving control." }
            ]
          }
        },
        {
          "id": "security-note",
          "type": "AuthSecurityNote",
          "props": {
            "title": "Security standards",
            "points": [
              "Sophisticated security controls are applied to every sign-in.",
              "Your session is protected using secure cookies.",
              "Sensitive actions require an additional verification step."
            ]
          }
        }
      ]
    },
    {
      "id": "otp-modal",
      "type": "AuthModal",
      "props": {
        "title": "Verify access",
        "subtitle": "Enter the OTP sent to your email. Use organisation code if you belong to multiple workspaces.",
        "action": "Verify OTP",
        "actionEvent": "verify-otp",
        "scope": "auth",
        "fields": [
          { "key": "email", "label": "Email", "type": "email", "placeholder": "ops@organisation.com" },
          { "key": "organisation", "label": "Organisation", "placeholder": "EIP or org code" },
          { "key": "otp", "label": "OTP Code", "placeholder": "123 456", "scope": "otp" }
        ]
      }
    },
    {
      "id": "reset-request-modal",
      "type": "AuthModal",
      "props": {
        "title": "Reset password",
        "subtitle": "Send a reset link to your registered email address.",
        "action": "Send reset link",
        "actionEvent": "request-password-reset",
        "scope": "auth",
        "fields": [
          { "key": "email", "label": "Email", "type": "email", "placeholder": "ops@organisation.com" },
          { "key": "organisation", "label": "Organisation", "placeholder": "EIP or org code" }
        ]
      }
    },
    {
      "id": "reset-password-modal",
      "type": "AuthModal",
      "props": {
        "title": "Choose a new password",
        "subtitle": "Enter a new password for your account.",
        "action": "Update password",
        "actionEvent": "confirm-password-reset",
        "scope": "reset",
        "fields": [
          { "key": "password", "label": "New password", "type": "password", "placeholder": "********" },
          { "key": "confirmPassword", "label": "Confirm password", "type": "password", "placeholder": "********" }
        ]
      }
    },
    {
      "id": "recovery-request-modal",
      "type": "AuthModal",
      "props": {
        "title": "Recovery access",
        "subtitle": "Request a secure recovery link for your account.",
        "action": "Send recovery link",
        "actionEvent": "request-recovery",
        "scope": "auth",
        "fields": [
          { "key": "email", "label": "Email", "type": "email", "placeholder": "ops@organisation.com" },
          { "key": "organisation", "label": "Organisation", "placeholder": "EIP or org code" },
          { "key": "password", "label": "Password", "type": "password", "placeholder": "********" },
          { "key": "totp", "label": "TOTP Code", "placeholder": "123 456" },
          { "key": "totpLost", "label": "I lost my authenticator (request admin approval)", "type": "checkbox" }
        ]
      }
    },
    {
      "id": "recovery-consume-modal",
      "type": "AuthModal",
      "props": {
        "title": "Recovery access",
        "subtitle": "Enter the recovery token to continue.",
        "action": "Continue",
        "actionEvent": "consume-recovery",
        "scope": "recovery",
        "fields": [
          { "key": "token", "label": "Recovery token", "placeholder": "Paste token" }
        ]
      }
    },
    {
      "id": "totp-modal",
      "type": "AuthModal",
      "props": {
        "title": "Enable TOTP",
        "subtitle": "Register a trusted authenticator for step-up access.",
        "variant": "content"
      },
      "children": [
        {
          "id": "totp-card",
          "type": "AuthTotpCard",
          "props": {
            "title": "Authenticator setup",
            "subtitle": "Scan the QR code or enter the secret manually, then confirm with a 6-digit code.",
            "issuer": "EIP Core",
            "account": "ops@organisation.com",
            "secret": "A6XM-K8F2-8DQN-1P9V",
            "qrValue": "otpauth://totp/EIP%20Core:ops@organisation.com?secret=A6XMK8F28DQN1P9V&issuer=EIP%20Core",
            "verifyAction": "Activate TOTP",
            "backupAction": "Fetch QR / secret",
            "embedded": true
          }
        }
      ]
    },
    {
      "id": "request-access-modal",
      "type": "AuthModal",
      "props": {
        "title": "Request access",
        "subtitle": "Tell us about your organisation. We'll review and send a secure onboarding link.",
        "action": "Submit request",
        "actionEvent": "request-access",
        "scope": "request",
        "fields": [
          {
            "key": "applicantType",
            "label": "Applicant type",
            "type": "select",
            "options": [
              { "label": "Business", "value": "business" },
              { "label": "Sole trader", "value": "sole_trader" }
            ]
          },
          { "key": "legalName", "label": "Legal name", "placeholder": "Organisation legal name" },
          { "key": "businessRegNo", "label": "Business reg number", "placeholder": "Registration number" },
          { "key": "personalIdNo", "label": "Personal ID number", "placeholder": "ID number (sole trader)" },
          { "key": "email", "label": "Email", "type": "email", "placeholder": "contact@organisation.com" },
          { "key": "phone", "label": "Phone", "placeholder": "+1 555 123 4567" },
          { "key": "country", "label": "Country", "placeholder": "United States" },
          { "key": "timezone", "label": "Timezone", "placeholder": "America/New_York" },
          {
            "key": "termsExcerpt",
            "type": "terms",
            "content": "By submitting this request, you confirm the information is accurate, agree to comply with EIP security policies, and acknowledge that access is subject to approval and contractual agreement. Full terms will be provided for signature during onboarding."
          },
          { "key": "acceptTerms", "label": "I have read and understand the terms above", "type": "checkbox" },
          { "key": "acceptPrivacy", "label": "I agree to the terms and privacy policy", "type": "checkbox" }
        ]
      }
    }
  ]
}$$::jsonb,
    $${
  "source": "migration",
  "note": "auth surface copy refresh",
  "generated_at": "2026-03-17T00:00:00.000Z"
}$$::jsonb
  );

WITH latest_global AS (
  SELECT tree, attrs
  FROM eip_core.ui_surface
  WHERE tenant_id IS NULL
    AND code = 'auth'
  ORDER BY version DESC
  LIMIT 1
),
tenant_targets AS (
  SELECT DISTINCT tenant_id
  FROM eip_core.ui_surface
  WHERE code = 'auth'
    AND tenant_id IS NOT NULL
    AND is_active = true
    AND is_published = true
)
INSERT INTO eip_core.ui_surface
  (tenant_id, code, title, version, is_active, is_published, is_public, tree, attrs)
SELECT
  t.tenant_id,
  'auth',
  'EIP Access',
  (
    SELECT COALESCE(MAX(version), 0) + 1
    FROM eip_core.ui_surface s
    WHERE s.tenant_id = t.tenant_id
      AND s.code = 'auth'
  ),
  true,
  true,
  true,
  g.tree,
  g.attrs
FROM tenant_targets t
CROSS JOIN latest_global g;

COMMIT;
