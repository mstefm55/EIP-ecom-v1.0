#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:4000}"
LOG_FILE="${LOG_FILE:-onboarding_full_flow.log}"
REDACT_LOG="${REDACT_LOG:-1}"

redact_stream() {
  sed -E \
    -e 's/("otp":")[^"]+/\1[REDACTED]/g' \
    -e 's/("password":")[^"]+/\1[REDACTED]/g' \
    -e 's/("token":")[^"]+/\1[REDACTED]/g'
}
export -f redact_stream

if [ -n "${LOG_FILE}" ]; then
  if [ "${REDACT_LOG}" = "1" ]; then
    exec > >(tee >(redact_stream >> "${LOG_FILE}")) 2>&1
    echo "Logging to ${LOG_FILE} (redacted)."
  else
    exec > >(tee -a "${LOG_FILE}") 2>&1
    echo "Logging to ${LOG_FILE} (UNREDACTED)."
  fi
fi

prompt() {
  local var="$1"
  local default="$2"
  local label="$3"
  local val="${!var-}"
  if [ -z "${val}" ]; then
    read -r -p "${label} [${default}]: " val
    val="${val:-$default}"
  fi
  # Strip Windows carriage returns to keep JSON payloads valid.
  val="${val//$'\r'/}"
  printf -v "${var}" "%s" "${val}"
}

pause_step() {
  local label="$1"
  local answer
  read -r -p "${label} (type ok to continue): " answer
  answer="$(printf '%s' "${answer}" | tr '[:upper:]' '[:lower:]')"
  if [ "${answer}" != "ok" ] && [ "${answer}" != "y" ]; then
    echo "Stopped."
    exit 1
  fi
}

json_get() {
  node -e "const fs=require('fs');const data=JSON.parse(fs.readFileSync(0,'utf8'));const path=process.argv[1].split('.').filter(Boolean);let v=data;for(const p of path){if(v==null)break; if(/^[0-9]+$/.test(p)) v=v[Number(p)]; else v=v[p];} if(v!==undefined&&v!==null) console.log(v);" "$1"
}

require_ok() {
  node -e "const label=process.argv[2]; try{const j=JSON.parse(process.argv[1]); if(j.ok!==true){console.error(label + ' failed:', j); process.exit(1);} } catch(e){console.error(label + ' invalid JSON'); process.exit(1);} " "$1" "$2"
}

build_agreements_body() {
  node -e "try{const v=JSON.parse(process.argv[1]); if(!Array.isArray(v)) throw new Error('not array'); console.log(JSON.stringify({agreements:v}));}catch(e){process.exit(2)}" "$1"
}

step() {
  echo
  echo "== $1 =="
}

explain() {
  echo "About: $1"
}

step "0) Cookie/device behavior"
explain "EIP sets cookies (sid/csrf/did); curl only saves them. Reuse the same cookie file to keep the same device. New cookie file = new device."
pause_step "Confirm cookie/device mapping"

prompt PLATFORM_TENANT_ID "18e6209d-155a-4932-9b7b-e11ad09aaf49" "Platform tenant UUID (admin)"
prompt PLATFORM_ADMIN_EMAIL "admin@eip.local" "Platform admin email"
prompt PLATFORM_ADMIN_PASSWORD "YourStrongPassw0rd!" "Platform admin password"

prompt NEW_TENANT_LEGAL_NAME "NewCo Holdings Ltd" "New tenant legal name"
prompt NEW_TENANT_EMAIL "admin@newco.local" "New tenant admin email"
prompt NEW_TENANT_PASSWORD "YourStrongPassw0rd!" "New tenant admin password"
prompt NEW_TENANT_REG "BRN-2026001" "Business registration number"

AGREEMENTS_JSON_DEFAULT='[{"code":"TOS","version":"v1"},{"code":"DPA","version":"v1"}]'
AGREEMENTS_JSON="${AGREEMENTS_JSON:-${AGREEMENTS_JSON_DEFAULT}}"
if ! AGREEMENTS_BODY="$(build_agreements_body "${AGREEMENTS_JSON}" 2>/dev/null)"; then
  echo "AGREEMENTS_JSON invalid; falling back to default agreements."
  AGREEMENTS_JSON="${AGREEMENTS_JSON_DEFAULT}"
  AGREEMENTS_BODY="$(build_agreements_body "${AGREEMENTS_JSON}")"
fi
if [ -z "${AGREEMENTS_BODY}" ]; then
  echo "AGREEMENTS_JSON is invalid. Expected JSON array of {code,version}."
  exit 1
fi

explain "Create a pending tenant request in the public realm (no account yet)."
step "1) Public tenant request"
REQ_RESP=$(curl -s -X POST "${API_URL}/api/public/tenant-requests" \
  -H "Content-Type: application/json" \
  -d "{\"applicantType\":\"business\",\"legalName\":\"${NEW_TENANT_LEGAL_NAME}\",\"businessRegNo\":\"${NEW_TENANT_REG}\",\"email\":\"${NEW_TENANT_EMAIL}\",\"phone\":\"+2300000000\",\"country\":\"MU\",\"timezone\":\"Indian/Mauritius\",\"acceptTerms\":true,\"acceptPrivacy\":true,\"termsVersion\":\"v1\",\"privacyVersion\":\"v1\"}")
echo "${REQ_RESP}"
require_ok "${REQ_RESP}" "Tenant request"
pause_step "Review tenant request response"

explain "Platform (EIP) admin from the creator company (not the applicant tenant) logs in to review requests."
step "2) Platform admin OTP request"
ADMIN_COOKIE_ARGS=()
if [ -f admin_cookies.txt ]; then
  ADMIN_COOKIE_ARGS=(-b admin_cookies.txt -c admin_cookies.txt)
else
  ADMIN_COOKIE_ARGS=(-c admin_cookies.txt)
fi

OTP_RESP=$(curl -s -X POST "${API_URL}/api/eip/auth/request-otp" \
  -H "Content-Type: application/json" \
  -d "{\"tenantId\":\"${PLATFORM_TENANT_ID}\",\"email\":\"${PLATFORM_ADMIN_EMAIL}\",\"password\":\"${PLATFORM_ADMIN_PASSWORD}\"}" \
  "${ADMIN_COOKIE_ARGS[@]}")
echo "${OTP_RESP}"
require_ok "${OTP_RESP}" "Platform OTP request"
read -r -p "Enter OTP from server logs: " ADMIN_OTP
pause_step "Ready to verify OTP"

explain "Verify the admin OTP to open a trusted session for approvals."
step "3) Platform admin OTP verify"
VERIFY_RESP=$(curl -s -X POST "${API_URL}/api/eip/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d "{\"tenantId\":\"${PLATFORM_TENANT_ID}\",\"email\":\"${PLATFORM_ADMIN_EMAIL}\",\"otp\":\"${ADMIN_OTP}\"}" \
  -b admin_cookies.txt -c admin_cookies.txt)
echo "${VERIFY_RESP}"
if echo "${VERIFY_RESP}" | grep -q '"DEVICE_UNTRUSTED"'; then
  echo "NOTE: DEVICE_UNTRUSTED means this admin already has a trusted device, and this device is new."
  echo "Use the existing trusted device cookie (did) or revoke trusted devices for this admin to allow auto-trust."
  exit 1
fi
require_ok "${VERIFY_RESP}" "Platform OTP verify"
pause_step "Review platform auth response"

CSRF=$(awk '$6=="csrf"{print $7}' admin_cookies.txt)

explain "Find the pending request so we can approve it."
step "4) Lookup tenant request by email"
LIST_RESP=$(curl -s "${API_URL}/api/eip/admin/tenant-requests?status=SUBMITTED&q=${NEW_TENANT_EMAIL}" \
  -H "x-csrf: ${CSRF}" \
  -b admin_cookies.txt)
echo "${LIST_RESP}"
require_ok "${LIST_RESP}" "Tenant request list"
REQUEST_ID=$(printf '%s' "${LIST_RESP}" | json_get "items.0.id")
if [ -z "${REQUEST_ID}" ]; then
  echo "No request id found. Check the list response."; exit 1
fi
pause_step "Proceed to approve request ${REQUEST_ID}"

explain "Approve the request: creates tenant + admin identity, issues bootstrap token, and records admin countersignature."
step "5) Approve tenant request (bootstrap token)"
APPROVE_RESP=$(curl -s -X POST "${API_URL}/api/eip/admin/tenant-requests/${REQUEST_ID}/approve" \
  -H "x-csrf: ${CSRF}" \
  -b admin_cookies.txt -c admin_cookies.txt)
echo "${APPROVE_RESP}"
require_ok "${APPROVE_RESP}" "Tenant approve"
NEW_TENANT_ID=$(printf '%s' "${APPROVE_RESP}" | json_get "tenantId")
NEW_ADMIN_IDENTITY_ID=$(printf '%s' "${APPROVE_RESP}" | json_get "identityId")
BOOTSTRAP_TOKEN=$(printf '%s' "${APPROVE_RESP}" | json_get "bootstrapToken")
if [ -z "${BOOTSTRAP_TOKEN}" ]; then
  read -r -p "Bootstrap token not in response. Paste token from email: " BOOTSTRAP_TOKEN
fi
pause_step "Review approve response and token"

explain "Use the bootstrap token to open a restricted setup session."
step "6) Bootstrap consume"
CONSUME_RESP=$(curl -s -X POST "${API_URL}/api/eip/bootstrap/consume" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"${BOOTSTRAP_TOKEN}\"}" \
  -c bootstrap_cookies.txt)
echo "${CONSUME_RESP}"
require_ok "${CONSUME_RESP}" "Bootstrap consume"
pause_step "Review bootstrap session"

CSRF_BOOT=$(awk '$6=="csrf"{print $7}' bootstrap_cookies.txt)

explain "Set the first admin password for the new tenant."
step "7) Bootstrap set password"
PASS_RESP=$(curl -s -X POST "${API_URL}/api/eip/bootstrap/password" \
  -H "Content-Type: application/json" \
  -H "x-csrf: ${CSRF_BOOT}" \
  -d "{\"password\":\"${NEW_TENANT_PASSWORD}\"}" \
  -b bootstrap_cookies.txt -c bootstrap_cookies.txt)
echo "${PASS_RESP}"
require_ok "${PASS_RESP}" "Bootstrap password"
pause_step "Review password set"

explain "Generate a TOTP secret for 2FA enrollment."
step "8) Bootstrap TOTP enroll"
ENROLL_RESP=$(curl -s -X POST "${API_URL}/api/eip/bootstrap/totp/enroll" \
  -H "x-csrf: ${CSRF_BOOT}" \
  -b bootstrap_cookies.txt -c bootstrap_cookies.txt)
echo "${ENROLL_RESP}"
require_ok "${ENROLL_RESP}" "Bootstrap TOTP enroll"
TOTP_SECRET=$(printf '%s' "${ENROLL_RESP}" | json_get "secret")
if [ -z "${TOTP_SECRET}" ]; then
  echo "No TOTP secret returned."; exit 1
fi
pause_step "Review TOTP secret (you can copy it now)"

explain "Confirm TOTP by sending a valid code."
step "9) Bootstrap TOTP confirm"
TOTP_TOKEN=$(node --input-type=module -e "import { TOTP, NobleCryptoPlugin, ScureBase32Plugin } from 'otplib'; const totp=new TOTP({ crypto:new NobleCryptoPlugin(), base32:new ScureBase32Plugin(), period:30 }); console.log(await totp.generate({ secret: '${TOTP_SECRET}' }));")
CONFIRM_RESP=$(curl -s -X POST "${API_URL}/api/eip/bootstrap/totp/confirm" \
  -H "Content-Type: application/json" \
  -H "x-csrf: ${CSRF_BOOT}" \
  -d "{\"token\":\"${TOTP_TOKEN}\"}" \
  -b bootstrap_cookies.txt -c bootstrap_cookies.txt)
echo "${CONFIRM_RESP}"
require_ok "${CONFIRM_RESP}" "Bootstrap TOTP confirm"
pause_step "Review TOTP confirm"

explain "Mark the current device as trusted for future logins."
step "10) Bootstrap trust device"
TRUST_RESP=$(curl -s -X POST "${API_URL}/api/eip/bootstrap/device/trust" \
  -H "x-csrf: ${CSRF_BOOT}" \
  -b bootstrap_cookies.txt -c bootstrap_cookies.txt)
echo "${TRUST_RESP}"
require_ok "${TRUST_RESP}" "Bootstrap device trust"
pause_step "Review device trust"

explain "Record required legal agreements (TOS/DPA)."
step "11) Bootstrap accept agreements"
AGREE_RESP=$(curl -s -X POST "${API_URL}/api/eip/bootstrap/agreements/accept" \
  -H "Content-Type: application/json" \
  -H "x-csrf: ${CSRF_BOOT}" \
  -d "${AGREEMENTS_BODY}" \
  -b bootstrap_cookies.txt -c bootstrap_cookies.txt)
echo "${AGREE_RESP}"
require_ok "${AGREE_RESP}" "Agreements accept"
pause_step "Review agreements"

explain "Activate the tenant and end the bootstrap session."
step "12) Bootstrap complete"
COMPLETE_RESP=$(curl -i -s -X POST "${API_URL}/api/eip/bootstrap/complete" \
  -H "x-csrf: ${CSRF_BOOT}" \
  -b bootstrap_cookies.txt -c bootstrap_cookies.txt)
echo "${COMPLETE_RESP}"
pause_step "Review bootstrap complete (204 expected)"

explain "Log in as the new tenant admin using OTP."
step "13) Login as new tenant admin (OTP)"
if [ -f bootstrap_cookies.txt ]; then
  # Reuse the trusted device from bootstrap to avoid DEVICE_UNTRUSTED.
  cp bootstrap_cookies.txt tenant_admin_cookies.txt
fi
NEW_OTP_REQ=$(curl -s -X POST "${API_URL}/api/eip/auth/request-otp" \
  -H "Content-Type: application/json" \
  -d "{\"tenantId\":\"${NEW_TENANT_ID}\",\"email\":\"${NEW_TENANT_EMAIL}\",\"password\":\"${NEW_TENANT_PASSWORD}\"}" \
  -b tenant_admin_cookies.txt -c tenant_admin_cookies.txt)
echo "${NEW_OTP_REQ}"
require_ok "${NEW_OTP_REQ}" "New tenant OTP request"
read -r -p "Enter OTP from server logs: " NEW_ADMIN_OTP

NEW_VERIFY=$(curl -s -X POST "${API_URL}/api/eip/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d "{\"tenantId\":\"${NEW_TENANT_ID}\",\"email\":\"${NEW_TENANT_EMAIL}\",\"otp\":\"${NEW_ADMIN_OTP}\"}" \
  -b tenant_admin_cookies.txt -c tenant_admin_cookies.txt)
echo "${NEW_VERIFY}"
require_ok "${NEW_VERIFY}" "New tenant OTP verify"
pause_step "Review new tenant login"

CSRF_TENANT=$(awk '$6=="csrf"{print $7}' tenant_admin_cookies.txt)

explain "Grant CRM + process permissions for testing."
step "14) Grant CRM + process permissions to new tenant admin"
if [ -n "${PSQL_DSN-}" ]; then
  psql "${PSQL_DSN}" -v ON_ERROR_STOP=1 <<SQL
BEGIN;
INSERT INTO eip_authz.role(tenant_id, code, label, surface_code, is_system)
VALUES
  ('${NEW_TENANT_ID}','CRM_ADMIN','CRM Admin','ERP', true),
  ('${NEW_TENANT_ID}','CRM_USER','CRM User','ERP', true)
ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT r.id, p.code
FROM eip_authz.role r
JOIN eip_authz.permission p ON p.code IN (
  'CRM_AGENT_READ','CRM_AGENT_WRITE','CRM_INTERACTION_READ','CRM_INTERACTION_WRITE',
  'CRM_CASE_READ','CRM_CASE_WRITE','CRM_OPPORTUNITY_READ','CRM_OPPORTUNITY_WRITE',
  'CRM_TASK_READ','CRM_TASK_WRITE','CRM_DASHBOARD_READ',
  'PROCESS_DEF_READ','PROCESS_DEF_WRITE','PROCESS_INSTANCE_READ','PROCESS_INSTANCE_WRITE',
  'auth.device.read','auth.device.trust','auth.device.revoke'
)
WHERE r.tenant_id = '${NEW_TENANT_ID}' AND r.code = 'CRM_ADMIN'
ON CONFLICT DO NOTHING;

INSERT INTO eip_authz.identity_role (tenant_id, identity_id, role_id, granted_by_identity_id)
SELECT '${NEW_TENANT_ID}', '${NEW_ADMIN_IDENTITY_ID}', r.id, NULL
FROM eip_authz.role r
WHERE r.tenant_id = '${NEW_TENANT_ID}' AND r.code = 'CRM_ADMIN'
ON CONFLICT DO NOTHING;
COMMIT;
SQL
else
  echo "Run this SQL in psql, then type ok to continue:"
  cat <<SQL
BEGIN;
INSERT INTO eip_authz.role(tenant_id, code, label, surface_code, is_system)
VALUES
  ('${NEW_TENANT_ID}','CRM_ADMIN','CRM Admin','ERP', true),
  ('${NEW_TENANT_ID}','CRM_USER','CRM User','ERP', true)
ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT r.id, p.code
FROM eip_authz.role r
JOIN eip_authz.permission p ON p.code IN (
  'CRM_AGENT_READ','CRM_AGENT_WRITE','CRM_INTERACTION_READ','CRM_INTERACTION_WRITE',
  'CRM_CASE_READ','CRM_CASE_WRITE','CRM_OPPORTUNITY_READ','CRM_OPPORTUNITY_WRITE',
  'CRM_TASK_READ','CRM_TASK_WRITE','CRM_DASHBOARD_READ',
  'PROCESS_DEF_READ','PROCESS_DEF_WRITE','PROCESS_INSTANCE_READ','PROCESS_INSTANCE_WRITE'
)
WHERE r.tenant_id = '${NEW_TENANT_ID}' AND r.code = 'CRM_ADMIN'
ON CONFLICT DO NOTHING;

INSERT INTO eip_authz.identity_role (tenant_id, identity_id, role_id, granted_by_identity_id)
SELECT '${NEW_TENANT_ID}', '${NEW_ADMIN_IDENTITY_ID}', r.id, NULL
FROM eip_authz.role r
WHERE r.tenant_id = '${NEW_TENANT_ID}' AND r.code = 'CRM_ADMIN'
ON CONFLICT DO NOTHING;
COMMIT;
SQL
  pause_step "Confirm SQL applied"
fi

explain "Simulate a new device: it should be blocked until trusted, then succeed."
step "15) Untrusted device test (trusted device required)"
UNTRUSTED_OTP_REQ=$(curl -s -X POST "${API_URL}/api/eip/auth/request-otp" \
  -H "Content-Type: application/json" \
  -d "{\"tenantId\":\"${NEW_TENANT_ID}\",\"email\":\"${NEW_TENANT_EMAIL}\",\"password\":\"${NEW_TENANT_PASSWORD}\"}" \
  -c new_device_cookies.txt)
echo "${UNTRUSTED_OTP_REQ}"
require_ok "${UNTRUSTED_OTP_REQ}" "New device OTP request"
read -r -p "Enter OTP from server logs (new device): " NEW_DEVICE_OTP

UNTRUSTED_VERIFY=$(curl -s -X POST "${API_URL}/api/eip/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d "{\"tenantId\":\"${NEW_TENANT_ID}\",\"email\":\"${NEW_TENANT_EMAIL}\",\"otp\":\"${NEW_DEVICE_OTP}\"}" \
  -b new_device_cookies.txt -c new_device_cookies.txt)
echo "${UNTRUSTED_VERIFY}"
pause_step "Expect DEVICE_UNTRUSTED above (new device blocked)"

DEVICES_RESP=$(curl -s "${API_URL}/api/eip/auth/devices" \
  -H "x-csrf: ${CSRF_TENANT}" \
  -b tenant_admin_cookies.txt)
echo "${DEVICES_RESP}"
if echo "${DEVICES_RESP}" | grep -q '"FORBIDDEN"'; then
  echo "Auth device list is forbidden. Ensure the tenant admin has auth.device.read/trust permissions."
  echo "If PSQL_DSN is not set, grant permissions manually, then rerun from step 15."
  exit 1
fi
UNTRUSTED_DEVICE_ID=$(printf '%s' "${DEVICES_RESP}" | node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(0,'utf8'));const list=(d.devices||[]).filter(x=>x.trust_state!=='trusted'); if(list.length) console.log(list[0].id);")
if [ -z "${UNTRUSTED_DEVICE_ID}" ]; then
  echo "No untrusted device found; check auth.devices output."; exit 1
fi

TRUST_RESP=$(curl -s -X POST "${API_URL}/api/eip/auth/devices/${UNTRUSTED_DEVICE_ID}/trust" \
  -H "x-csrf: ${CSRF_TENANT}" \
  -b tenant_admin_cookies.txt)
echo "${TRUST_RESP}"
require_ok "${TRUST_RESP}" "Trust new device"
pause_step "New device trusted"

UNTRUSTED_OTP_REQ2=$(curl -s -X POST "${API_URL}/api/eip/auth/request-otp" \
  -H "Content-Type: application/json" \
  -d "{\"tenantId\":\"${NEW_TENANT_ID}\",\"email\":\"${NEW_TENANT_EMAIL}\",\"password\":\"${NEW_TENANT_PASSWORD}\"}" \
  -c new_device_cookies.txt)
echo "${UNTRUSTED_OTP_REQ2}"
require_ok "${UNTRUSTED_OTP_REQ2}" "New device OTP request (after trust)"
read -r -p "Enter OTP from server logs (new device, after trust): " NEW_DEVICE_OTP2

UNTRUSTED_VERIFY2=$(curl -s -X POST "${API_URL}/api/eip/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d "{\"tenantId\":\"${NEW_TENANT_ID}\",\"email\":\"${NEW_TENANT_EMAIL}\",\"otp\":\"${NEW_DEVICE_OTP2}\"}" \
  -b new_device_cookies.txt -c new_device_cookies.txt)
echo "${UNTRUSTED_VERIFY2}"
require_ok "${UNTRUSTED_VERIFY2}" "New device OTP verify (after trust)"
pause_step "New device login successful"

explain "Seed a small org chart with 3 layers and 10 people."
step "16) Create 3-layer org + 10 people"
ROOT_RESP=$(curl -s -X POST "${API_URL}/api/eip/crm/agents" \
  -H "Content-Type: application/json" -H "x-csrf: ${CSRF_TENANT}" \
  -d "{\"agent_type\":\"ORG\",\"code\":\"NEWCO\",\"name\":\"${NEW_TENANT_LEGAL_NAME}\"}" \
  -b tenant_admin_cookies.txt)
echo "${ROOT_RESP}"
require_ok "${ROOT_RESP}" "Create org root"
ROOT_ID=$(printf '%s' "${ROOT_RESP}" | json_get "item.id")
pause_step "Review org root"

DEPT_IDS=()
for DEPT in "Sales" "Ops" "Finance"; do
  RESP=$(curl -s -X POST "${API_URL}/api/eip/crm/agents" \
    -H "Content-Type: application/json" -H "x-csrf: ${CSRF_TENANT}" \
    -d "{\"agent_type\":\"ORG\",\"name\":\"${DEPT}\",\"parent_agent_id\":\"${ROOT_ID}\"}" \
    -b tenant_admin_cookies.txt)
  echo "${RESP}"
  require_ok "${RESP}" "Create dept ${DEPT}"
  DEPT_IDS+=("$(printf '%s' "${RESP}" | json_get "item.id")")
done
pause_step "Review departments"

for i in $(seq 1 10); do
  curl -s -X POST "${API_URL}/api/eip/crm/agents" \
    -H "Content-Type: application/json" -H "x-csrf: ${CSRF_TENANT}" \
    -d "{\"agent_type\":\"PERSON\",\"name\":\"Employee ${i}\",\"parent_agent_id\":\"${ROOT_ID}\"}" \
    -b tenant_admin_cookies.txt >/dev/null
done
echo "Created 10 people under org."
pause_step "Review org structure"

explain "Create a micro customer (person) and a market segment (group)."
step "17) Create micro customer + market segment"
MICRO_RESP=$(curl -s -X POST "${API_URL}/api/eip/crm/agents" \
  -H "Content-Type: application/json" -H "x-csrf: ${CSRF_TENANT}" \
  -d "{\"agent_type\":\"PERSON\",\"name\":\"Micro Customer\"}" \
  -b tenant_admin_cookies.txt)
echo "${MICRO_RESP}"
require_ok "${MICRO_RESP}" "Create micro customer"
MICRO_ID=$(printf '%s' "${MICRO_RESP}" | json_get "item.id")

SEG_RESP=$(curl -s -X POST "${API_URL}/api/eip/crm/agents" \
  -H "Content-Type: application/json" -H "x-csrf: ${CSRF_TENANT}" \
  -d "{\"agent_type\":\"SEGMENT\",\"name\":\"SMB Retail Segment\"}" \
  -b tenant_admin_cookies.txt)
echo "${SEG_RESP}"
require_ok "${SEG_RESP}" "Create segment"
SEG_ID=$(printf '%s' "${SEG_RESP}" | json_get "item.id")
pause_step "Review micro vs segment"

explain "Attach a segment note to show CRM insights storage."
step "18) Add segment note"
NOTE_RESP=$(curl -s -X POST "${API_URL}/api/eip/crm/segments/${SEG_ID}/notes" \
  -H "Content-Type: application/json" -H "x-csrf: ${CSRF_TENANT}" \
  -d "{\"title\":\"Segment snapshot\",\"note\":\"Avg ticket $120; top channel: WhatsApp\"}" \
  -b tenant_admin_cookies.txt)
echo "${NOTE_RESP}"
require_ok "${NOTE_RESP}" "Segment note"
pause_step "Review segment note"

explain "Create a basic interaction, case, and opportunity for CRM testing."
step "19) Create CRM interaction + case + opportunity"
INT_RESP=$(curl -s -X POST "${API_URL}/api/eip/crm/interactions" \
  -H "Content-Type: application/json" -H "x-csrf: ${CSRF_TENANT}" \
  -d "{\"customer_agent_id\":\"${MICRO_ID}\",\"channel\":\"EMAIL\",\"direction\":\"IN\",\"subject\":\"Hello\",\"body_text\":\"First contact\"}" \
  -b tenant_admin_cookies.txt)
echo "${INT_RESP}"
require_ok "${INT_RESP}" "Interaction"

CASE_RESP=$(curl -s -X POST "${API_URL}/api/eip/crm/cases" \
  -H "Content-Type: application/json" -H "x-csrf: ${CSRF_TENANT}" \
  -d "{\"customer_agent_id\":\"${MICRO_ID}\",\"case_type\":\"SUPPORT\",\"title\":\"Onboarding help\"}" \
  -b tenant_admin_cookies.txt)
echo "${CASE_RESP}"
require_ok "${CASE_RESP}" "Case"
CASE_ID=$(printf '%s' "${CASE_RESP}" | json_get "item.id")

OPP_RESP=$(curl -s -X POST "${API_URL}/api/eip/crm/opportunities" \
  -H "Content-Type: application/json" -H "x-csrf: ${CSRF_TENANT}" \
  -d "{\"customer_agent_id\":\"${MICRO_ID}\",\"title\":\"Starter plan\",\"value\":{\"amount\":5000,\"currency\":\"USD\"},\"probability\":0.35,\"source\":\"REFERRAL\"}" \
  -b tenant_admin_cookies.txt)
echo "${OPP_RESP}"
require_ok "${OPP_RESP}" "Opportunity"
OPP_ID=$(printf '%s' "${OPP_RESP}" | json_get "item.id")
pause_step "Review CRM objects"

explain "Create a core process definition and instance for the opportunity."
step "20) Create core process def + instance for opportunity"
DEF_CODE="OPP_FLOW_$(date +%s)"
DEF_PAYLOAD=$(cat <<EOF
{"module":"crm","code":"${DEF_CODE}","name":"CRM Opportunity Flow","graph":{"name":"Opportunity Flow","object_type":"CRM_OPPORTUNITY","initial_node":"new","nodes":{"new":{},"proposal":{}},"transitions":[{"from":"new","action":"proposal","to":"proposal","effects":[{"type":"so_status","to":"proposal","list_code":"SERVICE_OBJECT_STATUS"}]}]}}
EOF
)
DEF_RESP=$(curl -s -X POST "${API_URL}/api/eip/core/process/defs" \
  -H "Content-Type: application/json" -H "x-csrf: ${CSRF_TENANT}" \
  -d "${DEF_PAYLOAD}" \
  -b tenant_admin_cookies.txt)
echo "${DEF_RESP}"
require_ok "${DEF_RESP}" "Process def"
DEF_ID=$(printf '%s' "${DEF_RESP}" | json_get "item.id")

INSTANCE_RESP=$(curl -s -X POST "${API_URL}/api/eip/core/process/instances" \
  -H "Content-Type: application/json" -H "x-csrf: ${CSRF_TENANT}" \
  -d "{\"service_object_id\":\"${OPP_ID}\",\"process_def_id\":\"${DEF_ID}\",\"idempotency_key\":\"${OPP_ID}-${DEF_ID}\"}" \
  -b tenant_admin_cookies.txt)
echo "${INSTANCE_RESP}"
require_ok "${INSTANCE_RESP}" "Process instance"
pause_step "Review process instance"

explain "Advance the process via CRM wrapper; status should update."
step "21) Move opportunity status to proposal (CRM wrapper)"
STATUS_RESP=$(curl -s -X POST "${API_URL}/api/eip/crm/opportunities/${OPP_ID}/status" \
  -H "Content-Type: application/json" -H "x-csrf: ${CSRF_TENANT}" \
  -d '{"to_status":"proposal","note":"Proposal sent"}' \
  -b tenant_admin_cookies.txt)
echo "${STATUS_RESP}"
require_ok "${STATUS_RESP}" "Opportunity status"
pause_step "Review status transition"

explain "Fetch CRM dashboard summary to confirm counts."
step "22) Dashboard summary"
DASH_RESP=$(curl -s "${API_URL}/api/eip/crm/dashboard/summary" \
  -H "x-csrf: ${CSRF_TENANT}" \
  -b tenant_admin_cookies.txt)
echo "${DASH_RESP}"
require_ok "${DASH_RESP}" "Dashboard summary"
pause_step "Flow completed"
