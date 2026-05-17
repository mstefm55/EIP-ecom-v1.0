# EIP Auth System Snapshot (Reusable Copy)

This folder keeps frontend + API + server auth references together for reuse.

It is a **copy repository** (snapshot), not the live runtime source.

## Layout

- `frontend/MemberAuthUI.copy.jsx`
- `frontend/MemberAuthUI.copy.css`
- `frontend/samara-services.api.copy.js`
- `server/routes/auth.copy.js`
- `server/routes/public_commerce.copy.js`
- `server/auth/crypto.copy.js`
- `server/auth/password.copy.js`
- `server/auth/perm.copy.js`
- `server/lib/email.copy.js`

## Source of truth (live files)

- Frontend auth UI:
  - `apps/ui-components/src/AuthUI/MemberAuthUI.jsx`
  - `apps/ui-components/src/AuthUI/MemberAuthUI.css`
- Frontend API client:
  - `apps/samara-web/my-vite-react-app/src/services/api.js`
- Backend auth routes/services:
  - `services/api/src/routes/auth.js`
  - `services/api/src/routes/public_commerce.js`
  - `services/api/src/auth/*.js`
  - `services/api/src/lib/email.js`

## Usage rule

- Reuse from this folder for scaffolding/snippets.
- Implement changes in live files first, then refresh this snapshot.
