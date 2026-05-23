# Admin/Dashboard Button And Trigger Audit V1

Date: 2026-05-23

Scope:
- `apps/dashboard/src/services/apiClient.js`
- Admin surface components under `apps/dashboard/src/components/admin`
- User/dashboard surface components under `apps/dashboard/src/components/user` and ecommerce panels under `apps/dashboard/src/components/ecom`
- API routes registered under `/api/eip`, `/api/eip/ecom`, `/api/eip/core`, and `/api/public`

Verification method:
- Static route and handler review against dashboard API calls.
- Dashboard production build with `npm run build`.
- API route syntax checks with `node --check`.
- No live Railway browser session was used in this repo audit.

## CSRF Foundation

Finding:
- The dashboard previously read `csrf` from `document.cookie` and sent `x-csrf` only when the cookie was readable.
- In the hosted deployment, dashboard and API are different origins. The API-origin `csrf` cookie is sent to the API by the browser, but dashboard JavaScript cannot read it from `document.cookie`.
- That caused authenticated state-changing requests to false-fail with `CSRF_MISSING`, including profile save and upload flows.

Fix:
- Added `GET /api/eip/auth/csrf`, which requires an EIP session, validates the API-origin `csrf` cookie against the session hash, and returns the token as JSON with `Cache-Control: no-store`.
- Updated dashboard `apiFetch` to fetch and cache the CSRF token from that endpoint before state-changing calls.
- Added one retry path for `CSRF_MISSING`, `CSRF_MISMATCH`, and `CSRF_INVALID` so stale cached tokens are refreshed.
- Updated `apiFetch` to support `FormData` without forcing `Content-Type: application/json`.
- Routed profile avatar, admin user avatar, and ecommerce asset uploads through `apiFetch`.

Actions that were likely false-failing only because of CSRF:
- Admin profile save: `PUT /api/eip/auth/profile`.
- Admin profile avatar upload: `POST /api/eip/auth/profile/avatar`.
- Sign out: `POST /api/eip/auth/logout`.
- Tenant request approve/reject.
- Recovery request approve/reject.
- Admin DB sensitive token consume/clear.
- Admin portfolio create/assign/remove.
- Template clone.
- Admin users create, role/permission assign/remove, profile save, avatar upload.
- Admin modules enable/disable/create and translation billing save.
- Gateway connection profile save, test, API key create/revoke/rotate.
- Process builder save/validate/publish, task template save/remove, binding save/remove.
- Tenant admin-access grant/rotate/revoke.
- Ecommerce product/category/content/order/payment/return/refund/settings write actions and uploads.

## Admin Surface Audit

| Component | Control or trigger | Handler/action | API or engine target | Dependencies | Backend status | Result |
| --- | --- | --- | --- | --- | --- | --- |
| `AdminShell` | Sidebar and header tabs | `setActiveTab` | Client state only | None | N/A | Works |
| `AdminShell` | Profile menu toggle | `setProfileMenuOpen` | Client state only | None | N/A | Works |
| `AdminShell` | Account management / Profile details | `openProfile`, `loadProfile` | `GET /api/eip/auth/profile` | EIP session | Implemented in `auth.js` | Works |
| `AdminShell` | Save profile | `handleSaveProfile` | `PUT /api/eip/auth/profile` | EIP session, CSRF | Implemented in `auth.js` | Fixed |
| `AdminShell` | Upload avatar | `handleAvatarUpload` | `POST /api/eip/auth/profile/avatar` | EIP session, CSRF, multipart | Implemented in `auth.js` | Fixed |
| `AdminShell` | Step-up access: send OTP | `handleRequestStepUp` | `POST /api/eip/auth/request-otp` | tenant id, email, password | Implemented in `auth.js` | Works |
| `AdminShell` | Step-up access: verify OTP | `handleVerifyStepUp` | `POST /api/eip/auth/verify-otp` | tenant id, email, OTP | Implemented in `auth.js` | Works |
| `AdminShell` | Sign out | `handleSignOut` | `POST /api/eip/auth/logout` | EIP session, CSRF | Implemented in `auth.js` | Fixed by CSRF foundation |
| `TenantRequestBoard` | Refresh/list/filter/page | `load`, pagination setters | `GET /api/eip/admin/tenant-requests` | `admin.tenant_request.read` | Implemented in `tenant_requests_admin.js` | Works |
| `TenantRequestBoard` | Approve request modal submit | `handleApprove` | `POST /api/eip/admin/tenant-requests/:id/approve` | CSRF, admin permission, required agreement inputs | Implemented in `tenant_requests_admin.js` | Fixed by CSRF foundation |
| `TenantRequestBoard` | Reject request modal submit | `handleReject` | `POST /api/eip/admin/tenant-requests/:id/reject` | CSRF, admin permission | Implemented in `tenant_requests_admin.js` | Fixed by CSRF foundation |
| `TenantRequestBoard` | Copy bootstrap token | `handleCopyToken` | `navigator.clipboard` | Browser clipboard permission | N/A | Works if browser allows clipboard |
| `AdminMonitoringDashboard` | Refresh via date range / chart/detail selectors | internal state and `apiFetch(endpointUrl)` | `GET /api/eip/admin/monitoring` | `admin.monitoring` route auth/permissions | Implemented in `admin_monitoring.js` | Works by route/build check |
| `AdminSecurityPanel` | Refresh devices and recovery requests | `load` | `GET /api/eip/auth/devices`, `GET /api/eip/auth/recovery/requests` | EIP session, permissions | Implemented in `auth.js` | Works |
| `AdminSecurityPanel` | Approve recovery | inline click handler | `POST /api/eip/auth/recovery/requests/:id/approve` | EIP session, CSRF, admin authority | Implemented in `auth.js` | Fixed by CSRF foundation |
| `AdminSecurityPanel` | Reject recovery | inline click handler | `POST /api/eip/auth/recovery/requests/:id/reject` | EIP session, CSRF, admin authority | Implemented in `auth.js` | Fixed by CSRF foundation |
| `AdminAuditPanel` | Live feed badge | no click handler | Sample data only | None | No live audit endpoint wired | Deferred |
| `AdminDbExplorer` | Export schema/download selected | `downloadSchema`, `downloadSelected` | `GET /api/eip/admin/db/export`, local download blob | EIP session, DB read permission | Implemented in `admin_db_explorer.js` | Works by route/build check |
| `AdminDbExplorer` | Refresh schema/table/tenant selection/pagination | `loadSchema`, `loadTable`, `loadTenants` | `GET /api/eip/admin/db/schema`, `/table`, `/tenants` | EIP session, DB read permission | Implemented in `admin_db_explorer.js` | Works |
| `AdminDbExplorer` | Consume sensitive token | `consumeSensitiveToken` | `POST /api/eip/admin/db/sensitive/consume` | EIP session, CSRF, step-up/sensitive token rules | Implemented in `admin_db_explorer.js` | Fixed by CSRF foundation |
| `AdminDbExplorer` | Clear sensitive token | `clearSensitiveToken` | `POST /api/eip/admin/db/sensitive/clear` | EIP session, CSRF | Implemented in `admin_db_explorer.js` | Fixed by CSRF foundation |
| `AdminConnectionsPanel` | Tenant/profile load and selection | `load`, `loadDetail` | `GET /api/eip/gateway/connections`, `GET /api/eip/gateway/connections/:tenantId` | EIP session, gateway read permission | Implemented in `gateway.js` | Works |
| `AdminConnectionsPanel` | Add/remove connection row | `handleAddConnection`, `handleRemoveConnection` | Client draft state | Selected tenant | N/A | Works |
| `AdminConnectionsPanel` | Save profile | `handleSaveProfile` | `POST /api/eip/gateway/connections/:tenantId/profile` | EIP session, CSRF, gateway write permission | Implemented in `gateway.js` | Fixed by CSRF foundation |
| `AdminConnectionsPanel` | Create API key | `handleCreateKey` | `POST /api/eip/gateway/connections/:tenantId/api-keys` | EIP session, CSRF, gateway write permission | Implemented in `gateway.js` | Fixed by CSRF foundation |
| `AdminConnectionsPanel` | Revoke/rotate API key | `handleRevokeKey`, `handleRotateKey` | `POST /api/eip/gateway/connections/:tenantId/api-keys/:keyId/revoke`, `/rotate` | EIP session, CSRF, gateway write permission | Implemented in `gateway.js` | Fixed by CSRF foundation |
| `AdminConnectionsPanel` | Test inbound/outbound | `handleTest` | `POST /api/eip/gateway/connections/:tenantId/test/inbound`, `/outbound` | EIP session, CSRF, gateway write permission | Implemented in `gateway.js` | Fixed by CSRF foundation |
| `AdminConnectionsPanel` | Copy generated URLs | `navigator.clipboard.writeText` | Browser clipboard | Browser clipboard permission | N/A | Works if browser allows clipboard |
| `AdminProcessBuilder` | Tenant pick/clear, view tabs, add/remove nodes/transitions/effects | local state handlers | Client graph editor state | Loaded taxonomy/defs | N/A | Works |
| `AdminProcessBuilder` | Load definitions/taxonomy/instances/details | `loadDefs`, `loadTaxonomy`, `loadInstances`, `loadDefDetails` | `GET /api/eip/process/defs`, `/taxonomy`, `/instances`, `/defs/:id`, `/task-templates`, `/bindings` | EIP session, process read permission | Implemented in `core_process.js` | Works |
| `AdminProcessBuilder` | Create/save definition | `handleCreateDef`, `handleSaveDef` | `POST /api/eip/process/defs`, `PATCH /api/eip/process/defs/:id` | EIP session, CSRF, process write permission | Implemented in `core_process.js` | Fixed by CSRF foundation |
| `AdminProcessBuilder` | Validate/publish definition | `handleValidate`, `handlePublish` | `POST /api/eip/process/defs/:id/validate`, `/publish` | EIP session, CSRF, process write permission | Implemented in `core_process.js` | Fixed by CSRF foundation |
| `AdminProcessBuilder` | Save/remove task template | `saveTemplate`, `removeTemplate` | `POST /api/eip/process/task-templates`, `PATCH /api/eip/process/task-templates/:id` | EIP session, CSRF, process write permission | Implemented in `core_process.js` | Fixed by CSRF foundation |
| `AdminProcessBuilder` | Save/remove binding | `saveBinding`, `removeBinding` | `POST /api/eip/process/bindings`, `PATCH /api/eip/process/bindings/:id` | EIP session, CSRF, process write permission | Implemented in `core_process.js` | Fixed by CSRF foundation |
| `AdminUsersPanel` | Tenant search/pick and user profile load | `loadTenants`, `loadTenantData`, `loadProfile` | `GET /api/eip/admin/tenants`, `/users`, `/roles`, `/permissions`, `/profile` | EIP session, admin user read permission | Implemented in `admin_access.js` | Works |
| `AdminUsersPanel` | Create user | `handleCreateUser` | `POST /api/eip/admin/tenants/:tenantId/users` | EIP session, CSRF, admin user write permission | Implemented in `admin_access.js` | Fixed by CSRF foundation |
| `AdminUsersPanel` | Assign/remove role | `handleAssign`, `handleRemoveRole` | `POST`/`DELETE /api/eip/admin/tenants/:tenantId/users/:identityId/roles` | EIP session, CSRF, admin user write permission | Implemented in `admin_access.js` | Fixed by CSRF foundation |
| `AdminUsersPanel` | Assign/remove direct permission | `handleAssign`, `handleRemovePermission` | `POST`/`DELETE /api/eip/admin/tenants/:tenantId/users/:identityId/permissions` | EIP session, CSRF, admin user write permission | Implemented in `admin_access.js` | Fixed by CSRF foundation |
| `AdminUsersPanel` | Save user profile | `handleSaveProfile` | `PUT /api/eip/admin/tenants/:tenantId/users/:identityId/profile` | EIP session, CSRF, admin user write permission | Implemented in `admin_access.js` | Fixed by CSRF foundation |
| `AdminUsersPanel` | Upload user avatar | `handleAvatarUpload` | `POST /api/eip/admin/tenants/:tenantId/users/:identityId/avatar` | EIP session, CSRF, multipart | Implemented in `admin_access.js` | Fixed |
| `AdminPortfolioPanel` | Refresh/list/admins/tenant search | `loadPortfolios`, `loadAdmins`, `loadTenants`, `loadAssignedTenants` | `GET /api/eip/admin/portfolios`, `/admins`, `/tenants`, `/:id/tenants` | EIP session, portfolio read permission | Implemented in `admin_portfolio.js` | Fixed stale tenant lookup |
| `AdminPortfolioPanel` | Create portfolio | `handleCreate` | `POST /api/eip/admin/portfolios` | EIP session, CSRF, portfolio write permission | Implemented in `admin_portfolio.js` | Fixed stale tenant lookup and CSRF |
| `AdminPortfolioPanel` | Assign/remove tenant | `handleAssignTenant`, `handleRemoveTenant` | `POST`/`DELETE /api/eip/admin/portfolios/:id/tenants` | EIP session, CSRF, portfolio assign permission | Implemented in `admin_portfolio.js` | Fixed stale tenant lookup and CSRF |
| `AdminTemplateClonePanel` | Template/target search | `loadTemplates`, `loadTargets` | `GET /api/eip/admin/template-tenants`, `/tenant-lookup` | EIP session, template clone read permission | Implemented in `admin_template_clone.js` | Works |
| `AdminTemplateClonePanel` | Clone template | `handleClone` | `POST /api/eip/admin/template-clone` | EIP session, CSRF, template clone permission | Implemented in `admin_template_clone.js` | Fixed by CSRF foundation |
| `AdminModulesPanel` | Tenant/catalog/module load | `loadTenants`, `loadCatalog`, `loadModules`, `loadTranslationBilling` | `GET /api/eip/admin/tenants`, `/admin/modules/catalog`, `/admin/tenants/:tenantId/modules`, `/ecom/translation/billing` | EIP session, module read permission | Implemented in `admin_access.js` | Works |
| `AdminModulesPanel` | Toggle/create module | `handleToggle`, `handleCreateModule` | `POST /api/eip/admin/tenants/:tenantId/modules`, `POST /api/eip/admin/modules/catalog` | EIP session, CSRF, module write permission | Implemented in `admin_access.js` | Fixed by CSRF foundation |
| `AdminModulesPanel` | Save translation billing | `handleSaveBilling` | `PUT /api/eip/admin/tenants/:tenantId/ecom/translation/billing` | EIP session, CSRF, module write permission | Implemented in `admin_access.js` | Fixed by CSRF foundation |
| Admin `tasks`, `integrations`, `reports` tabs | Placeholder panels | no action handlers | None | No backend call | Deferred by design |

## User/Dashboard Surface Audit

| Component | Control or trigger | Handler/action | API or engine target | Dependencies | Backend status | Result |
| --- | --- | --- | --- | --- | --- | --- |
| `UserShell` | Sidebar/top tabs | `setActiveTab` | Client state only | None | N/A | Works |
| `UserShell` | Profile menu toggle | `setProfileOpen` | Client state only | None | N/A | Partially wired: menu is visual only except sign out |
| `UserShell` | Sign out | `handleSignOut` | `POST /api/eip/auth/logout` | EIP session, CSRF | Implemented in `auth.js` | Fixed by CSRF foundation |
| `TenantAdminAccessPanel` | Refresh/load grants and admins | `loadData` | `GET /api/eip/tenant/admin-access`, `/admins` | EIP session, tenant admin access read permission, optional `OWNER_TENANT_CODE` | Implemented in `tenant_admin_access.js` | Fixed stale owner tenant lookup |
| `TenantAdminAccessPanel` | Grant/rotate/revoke admin access | `handleGrant`, `handleRotate`, `handleRevoke` | `POST /api/eip/tenant/admin-access/grant`, `/rotate`, `/revoke` | EIP session, CSRF, tenant admin access write permission, owner admin identity | Implemented in `tenant_admin_access.js` | Fixed stale owner tenant lookup and CSRF |
| `EcomCommerceSettingsPanel` | Initial load/refresh variant headers | `load`, `refreshVariantHeaders` | `GET /api/eip/commerce/settings`, `/commerce/translation/catalog`, `/api/eip/ecom/variant-headers`, `/commerce/fx/status` | EIP session, commerce/ecom permissions | Implemented in `commerce_orders.js` and `ecom.js` | Works |
| `EcomCommerceSettingsPanel` | Add/update variant header | `handleAddVariantHeader`, `handleUpdateVariantHeader` | `POST /api/eip/ecom/variant-headers`, `PUT /api/eip/ecom/variant-headers/:code` | EIP session, CSRF, ecom settings/write permission | Implemented in `ecom.js` | Fixed by CSRF foundation |
| `EcomCommerceSettingsPanel` | Save commerce settings | `handleSave` | `PUT /api/eip/commerce/settings` | EIP session, CSRF, commerce settings write permission | Implemented in `commerce_orders.js` | Fixed by CSRF foundation |
| `EcomCommerceSettingsPanel` | Save translation connection selection | `handleSaveConnectionSelection` | `PUT /api/eip/commerce/translation/settings` | EIP session, CSRF, commerce settings write permission | Implemented in `commerce_orders.js` | Fixed by CSRF foundation |
| `EcomCommerceSettingsPanel` | Sync FX | `handleSyncFx` | `POST /api/eip/commerce/fx/sync` | EIP session, CSRF, commerce settings write permission, FX provider config | Implemented in `commerce_orders.js` | Fixed by CSRF foundation |
| `EcomOrderManagementPanel` | Load/select orders, returns, refunds | `loadOrders`, `fetchOrderDetail`, `loadReturns`, `fetchReturnDetail`, `loadRefunds`, `fetchRefundDetail` | `GET /api/eip/commerce/orders`, `/returns`, `/refunds` and detail routes | EIP session, commerce read permissions | Implemented in `commerce_orders.js` | Works |
| `EcomOrderManagementPanel` | Order actions | `runOrderAction` | `POST /api/eip/commerce/orders/:id/actions` | EIP session, CSRF, order write permission, process action support | Implemented in `commerce_orders.js` | Fixed by CSRF foundation |
| `EcomOrderManagementPanel` | Request return/refund | `requestReturn`, `requestRefund` | `POST /api/eip/commerce/orders/:id/returns`, `/refunds` | EIP session, CSRF, return/refund write permission | Implemented in `commerce_orders.js` | Fixed by CSRF foundation |
| `EcomOrderManagementPanel` | Return/refund actions | `runReturnAction`, `runRefundAction` | `POST /api/eip/commerce/returns/:id/actions`, `/refunds/:id/actions` | EIP session, CSRF, process action support | Implemented in `commerce_orders.js` | Fixed by CSRF foundation |
| `EcomProductWorkspace` | Load catalog/detail/reviews | `refreshList`, `loadDetail`, `loadReviews` | `GET /api/eip/ecom/products`, `/products/:id`, `/reviews` | EIP session, ecom read permissions | Implemented in `ecom.js` | Works |
| `EcomProductWorkspace` | Create/save product | `createProduct`, `saveProduct` | `POST /api/eip/ecom/products`, `PUT /api/eip/ecom/products/:id` | EIP session, CSRF, ecom product write permission | Implemented in `ecom.js` | Fixed by CSRF foundation |
| `EcomProductWorkspace` | Product process actions and bulk actions | `runAction`, `publishNow`, `applyBulkAction` | `POST /api/eip/ecom/products/:id/actions` | EIP session, CSRF, governed process actions | Implemented in `ecom.js` | Fixed by CSRF foundation |
| `EcomProductWorkspace` | Product/category composer | `createProductCategory`, `editProductCategory`, `submitProductCategoryComposer` | `GET/POST/PUT /api/eip/ecom/product/categories` | EIP session, CSRF for writes | Implemented in `ecom.js` | Fixed by CSRF foundation |
| `EcomProductWorkspace` | Product media/document uploads | `fileToAsset`, upload handlers | `POST /api/eip/ecom/uploads` | EIP session, CSRF, multipart | Implemented in `ecom.js` | Fixed |
| `EcomProductWorkspace` | Import spreadsheet by URL | `runImport` | `fetch(sheetUrl)` plus product create/update calls | CORS-readable sheet URL, EIP session/CSRF for product writes | Product routes implemented | Partially external: depends on sheet URL CORS |
| `EcomProductWorkspace` | Storefront/content loads | `loadStorefrontContent`, `loadStorefrontList`, `loadStorefrontBlogPosts`, `loadPageContentList`, `loadStorefrontStructure`, `loadStorefrontConnections`, `loadStorefrontStudioTabs` | `GET /api/eip/ecom/storefront/...`, `/blog/posts` | EIP session, ecom content read permissions | Implemented in `ecom.js` | Works |
| `EcomProductWorkspace` | Storefront/content create/save/delete/actions | `createStorefrontContent`, `saveStorefrontContent`, `deleteStorefrontContent`, `runStorefrontAction`, `publishStorefrontNow`, page content equivalents | `POST/PUT/DELETE /api/eip/ecom/storefront/content...`, `/actions` | EIP session, CSRF, governed content process actions | Implemented in `ecom.js` | Fixed by CSRF foundation |
| `EcomProductWorkspace` | Storefront studio tab/category/structure scan controls | `saveStorefrontStudioTabs`, `createStorefrontCategory`, `scanStorefrontStructure` | `PUT /studio-tabs/:code`, `POST /categories`, `POST /structure/scan` | EIP session, CSRF, ecom content/settings permissions | Implemented in `ecom.js` | Fixed by CSRF foundation |
| `EcomProductWorkspace` | Image asset studio modal controls | local crop/style/apply handlers | Client image editor callback | Loaded image asset | N/A | Works by build check; no backend route |
| User `dashboard`, `tasks`, `reports` tabs | Static placeholder panels/cards | no API action handlers | None | No backend call | Deferred by design |

## Auth Surface Triggers

| Component/action | Handler/action | API target | Dependencies | Result |
| --- | --- | --- | --- | --- |
| Organisation lookup | `resolveOrganisations` | `POST /api/eip/auth/organisations` | email, optional password | Works |
| Password login | `passwordLogin` | `POST /api/eip/auth/login` | trusted device, non-admin low-assurance flow | Works |
| Request OTP | `requestOtp` | `POST /api/eip/auth/request-otp` | tenant, email, password, mail config | Works |
| Verify OTP | `verifyOtp` | `POST /api/eip/auth/verify-otp` | tenant, email, OTP | Works |
| TOTP login | `loginTotp` | `POST /api/eip/auth/totp/login` | tenant, email, password, TOTP | Works |
| TOTP enroll/confirm | `enrollTotp`, `confirmTotp` | `POST /api/eip/auth/totp/enroll`, `/confirm`, bootstrap variants | session or bootstrap credentials | Works |
| Request access | `requestAccess` | `POST /api/public/tenant-requests` | accepted terms/privacy | Works |
| Password reset | `requestPasswordReset`, `confirmPasswordReset` | `POST /api/eip/auth/password/forgot`, `/reset` | tenant/email or reset token | Works |
| Recovery request/consume | `requestRecovery`, `requestRecoveryLost`, `consumeRecovery` | `POST /api/eip/auth/recovery/...` | account credentials/recovery token | Works |

## Remaining Manual Or Deferred Items

- Live browser testing after Railway redeploy is still required to confirm cookie, CORS, and permission variables in the deployed environment.
- Admin audit feed is sample data only; no live audit endpoint is wired into `AdminAuditPanel`.
- Admin `tasks`, `integrations`, and `reports` tabs are explicit placeholders.
- User `dashboard`, `tasks`, and `reports` panels are placeholder/static surfaces.
- `UserShell` profile menu opens a visual panel but has no profile edit controls; admin profile editing is implemented in `AdminShell`.
- Spreadsheet import depends on the external sheet URL being fetchable by the browser.
- Tenant admin-access admin discovery now supports `OWNER_TENANT_CODE`; if that env var is not set, it falls back to the current tenant for local/dev compatibility.
