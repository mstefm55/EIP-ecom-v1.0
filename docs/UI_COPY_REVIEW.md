# EIP UI Copy Cleanup Review

Purpose: production-ready wording cleanup (no dev/debug language in end-user flows).

Status: **approved decisions captured (2026-03-17)**  
Rule applied: if unsure, do **not** change code; mark for decision.

---

## 1) Scope audited (first pass)

- `apps/dashboard/src/engine/surfaces/auth.js` (authentication surface copy)
- `apps/dashboard/src/hooks/useAuthApi.js` (user-facing status/error messages)
- `apps/dashboard/src/components/ecom/EcomCommerceSettingsPanel.jsx` (tenant settings copy)
- `apps/dashboard/src/components/admin/AdminModulesPanel.jsx` (admin translation pricing copy)
- `apps/dashboard/src/engine/surfaces/admin.js` (admin-only labels, checked for accidental end-user wording)

---

## 2) High-confidence changes to apply (safe)

These are copy-only and low-risk:

a) in the Component "identity gateway, wording should be Secure access to your workspace. enter your email, select your organisation and autenticate with OTP or TOTP, remove system admins use organisation eip. remove organisation isolation, trusted device Policy, step up require.
b) remove the 3 metrics, replace it with the 3 tiles below the authentication tile. Session Assurance, replace organisation isolation text with cross site verification (rephrase it profesionally). then device trust in the 3rd. rephrase it profesionally like marketing the security features.  

1. **Auth metrics in hero**
   - Current: `Avg. OTP latency`, `38ms`
   - Proposed: `2 step Authentication`  
   - Reason: remove low-level runtime metric from user login.
   replaced also Active organisations 0

2. **Security posture bullets**
   - Current includes: `CSRF hashes`, `Debug endpoints`, `auth/password/set`
   - Proposed:
     - `Sophisticated security controls are applied to every sign-in.`
     - `Your session is protected using secure cookies.`
     - `Sensitive actions require an additional verification step.`
   - Reason: keep security confidence, remove internal implementation details.

3. **Recovery modal subtitle**
   - Current: `Request a recovery link for EIP admin access.`
   - Proposed: `Request a secure recovery link for your account.`
   - Reason: avoid exposing internal role wording in a generic auth flow.

---

## 3) Items flagged for your decision (do not auto-change)

### A) Auth flow wording style

- File: `apps/dashboard/src/engine/surfaces/auth.js`
- Question:
  - Keep explicit terms `OTP`, `TOTP`, `trusted device` in UI? keep this porposal its ok everyone are acquanted with these terms
  - Or simplify to generic language (`verification code`, `secure sign-in`)?
- Tradeoff:
  - Explicit terms help advanced users/support.
  - Generic terms feel cleaner and less technical.

### B) Error message detail level

- File: `apps/dashboard/src/hooks/useAuthApi.js`
- Question:
  - Keep specific errors (e.g., `DEVICE_UNTRUSTED`, `TOTP_NOT_FOUND`) mapped to detailed text? mapped to detaile text so that user can report but not too technical and detailed strick minimum
  - Or collapse to user-safe generic messages?
- Suggested production model:
  - User sees concise message.
  - Full technical code stays only in server logs/audit.

### C) Admin surface technical terminology

- File: `apps/dashboard/src/engine/surfaces/admin.js`
- Notes:
  - Terms like `diagnostics`, `schema metadata`, `process bindings`, `idempotency` are technical by nature.
  - Since this is admin-only UI, these may be acceptable.
- Decision needed:
  - Keep as-is for power-admin audience,keep as is this is for it professionals
  - or simplify to business language.

---

## 4) Proposed wording set for authentication (candidate)

Use this if you approve moving to less technical copy: Below ok for me

- Hero subtitle:
  - `Choose your organisation and sign in securely.`
- Login subtitle:
  - `Sign in to your organisation account.`
- Footer note:
  - `For your security, additional verification may be required.`
- OTP modal subtitle:
  - `Enter the verification code sent to your email.`
- Security card title:
  - `Security standards`

---

## 5) Notes already aligned

- Translation pricing labels were neutralized:
  - `Translation pricing` (no dev/admin qualifier in end-user panel)

---

## 6) Your comments section

Add decisions here and I will implement exactly:

- Auth terms policy (explicit OTP/TOTP vs generic):
- Error detail policy:
- Admin UI terminology policy:
- Any mandatory phrases to include (example: “bank-grade security”):

---

## 7) Final decisions captured

- Remove auth hero metrics block entirely.
- Keep OTP/TOTP wording in general UX, except where section 4 replacement copy was explicitly approved.
- Keep admin console technical terminology (IT/admin audience).
- Keep error messages specific but concise (enough for user reporting, no deep technical internals).
- Do not use "bank-grade" claim wording in product UI copy.

---

## 8) Follow-up cleanup pass applied (2026-03-17)

Applied additional production-safe copy cleanup in admin + ecom surfaces:

- Removed migration/script instructions from UI error messages.
- Replaced setup failures with admin-actionable but non-technical wording.
- Reworded one connection helper line to remove test/internal phrasing.
- Reworded audit fallback message from "Preview events" to "Example events".
- Reworded admin header/data-explorer subtitles to remove "internal operations" and "diagnostics" phrasing.
