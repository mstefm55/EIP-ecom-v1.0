#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:4000}"
LOG_FILE="${LOG_FILE:-crm_happy_path.log}"
REDACT_LOG="${REDACT_LOG:-1}"

redact_stream() {
  sed -E \
    -e 's/("otp":")[^"]+/\1[REDACTED]/g' \
    -e 's/("password":")[^"]+/\1[REDACTED]/g'
}
export -f redact_stream

if [ -n "$LOG_FILE" ]; then
  if [ "$REDACT_LOG" = "1" ]; then
    exec > >(tee >(redact_stream >> "$LOG_FILE")) 2>&1
    echo "Logging to $LOG_FILE (redacted)."
  else
    exec > >(tee -a "$LOG_FILE") 2>&1
    echo "Logging to $LOG_FILE (UNREDACTED)."
  fi
fi

prompt() {
  local var="$1"
  local default="$2"
  local label="$3"
  local val="${!var:-}"
  if [ -z "$val" ]; then
    read -r -p "$label [$default]: " val
    val="${val:-$default}"
  fi
  printf -v "$var" "%s" "$val"
}

json_field() {
  node -e "const fs=require('fs');const data=JSON.parse(fs.readFileSync(0,'utf8'));const key=process.argv[1];const v=data&&data[key]; if(v!==undefined&&v!==null) console.log(v);" "$1"
}

json_id() {
  node -e "const fs=require('fs');const data=JSON.parse(fs.readFileSync(0,'utf8'));const v=data&&data.item&&data.item.id; if(v) console.log(v);"
}

require_ok() {
  node -e "const label=process.argv[2]; try{const j=JSON.parse(process.argv[1]); if(j.ok!==true){console.error(label + ' failed:', j); process.exit(1);} } catch(e){console.error(label + ' invalid JSON'); process.exit(1);} " "$1" "$2"
}

prompt EIP_TENANT_ID "" "EIP tenant UUID"
prompt ADMIN_EMAIL "admin@eip.local" "Admin email"
prompt ADMIN_PASSWORD "YourStrongPassw0rd!" "Admin password"

prompt CUSTOMER_NAME "Acme Customer Ltd" "Customer name"
prompt CUSTOMER_CODE "CUST-001" "Customer code"

echo "== Step 1: request OTP =="
OTP_RESP=$(curl -s -X POST "${API_URL}/api/eip/auth/request-otp" \
  -H "Content-Type: application/json" \
  -d "{\"tenantId\":\"${EIP_TENANT_ID}\",\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" \
  -c crm_cookies.txt)
echo "${OTP_RESP}"
require_ok "${OTP_RESP}" "OTP request"

read -r -p "Enter OTP from server logs: " ADMIN_OTP

echo "== Step 2: verify OTP =="
VERIFY_RESP=$(curl -s -X POST "${API_URL}/api/eip/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d "{\"tenantId\":\"${EIP_TENANT_ID}\",\"email\":\"${ADMIN_EMAIL}\",\"otp\":\"${ADMIN_OTP}\"}" \
  -b crm_cookies.txt -c crm_cookies.txt)
echo "${VERIFY_RESP}"
require_ok "${VERIFY_RESP}" "OTP verify"

CSRF=$(awk '$6=="csrf"{print $7}' crm_cookies.txt)

echo "== Step 3: create customer agent =="
AGENT_RESP=$(curl -s -X POST "${API_URL}/api/eip/crm/agents" \
  -H "Content-Type: application/json" \
  -H "x-csrf: ${CSRF}" \
  -d "{\"agent_type\":\"ORG\",\"code\":\"${CUSTOMER_CODE}\",\"name\":\"${CUSTOMER_NAME}\"}" \
  -b crm_cookies.txt -c crm_cookies.txt)
echo "${AGENT_RESP}"
require_ok "${AGENT_RESP}" "Create agent"
CUSTOMER_ID=$(printf '%s' "${AGENT_RESP}" | json_id)

if [ -z "${CUSTOMER_ID}" ]; then
  echo "No customer id returned"; exit 1
fi

echo "== Step 4: add contact =="
CONTACT_RESP=$(curl -s -X POST "${API_URL}/api/eip/crm/agents/${CUSTOMER_ID}/contacts" \
  -H "Content-Type: application/json" \
  -H "x-csrf: ${CSRF}" \
  -d '{"contact_type":"email","label":"work","value":"contact@acme.local","is_primary":true}' \
  -b crm_cookies.txt -c crm_cookies.txt)
echo "${CONTACT_RESP}"
require_ok "${CONTACT_RESP}" "Add contact"

echo "== Step 5: add address =="
ADDRESS_RESP=$(curl -s -X POST "${API_URL}/api/eip/crm/agents/${CUSTOMER_ID}/addresses" \
  -H "Content-Type: application/json" \
  -H "x-csrf: ${CSRF}" \
  -d '{"address_type":"billing","line1":"1 Main Street","city":"Port Louis","country_code":"MU","is_primary":true}' \
  -b crm_cookies.txt -c crm_cookies.txt)
echo "${ADDRESS_RESP}"
require_ok "${ADDRESS_RESP}" "Add address"

echo "== Step 6: create interaction =="
INTERACTION_RESP=$(curl -s -X POST "${API_URL}/api/eip/crm/interactions" \
  -H "Content-Type: application/json" \
  -H "x-csrf: ${CSRF}" \
  -d "{\"customer_agent_id\":\"${CUSTOMER_ID}\",\"channel\":\"EMAIL\",\"direction\":\"IN\",\"subject\":\"Welcome\",\"body_text\":\"Initial contact\"}" \
  -b crm_cookies.txt -c crm_cookies.txt)
echo "${INTERACTION_RESP}"
require_ok "${INTERACTION_RESP}" "Create interaction"

echo "== Step 7: create case =="
CASE_RESP=$(curl -s -X POST "${API_URL}/api/eip/crm/cases" \
  -H "Content-Type: application/json" \
  -H "x-csrf: ${CSRF}" \
  -d "{\"customer_agent_id\":\"${CUSTOMER_ID}\",\"case_type\":\"SUPPORT\",\"title\":\"Login issue\"}" \
  -b crm_cookies.txt -c crm_cookies.txt)
echo "${CASE_RESP}"
require_ok "${CASE_RESP}" "Create case"
CASE_ID=$(printf '%s' "${CASE_RESP}" | json_id)

if [ -z "${CASE_ID}" ]; then
  echo "No case id returned"; exit 1
fi

echo "== Step 8: create opportunity =="
OPP_RESP=$(curl -s -X POST "${API_URL}/api/eip/crm/opportunities" \
  -H "Content-Type: application/json" \
  -H "x-csrf: ${CSRF}" \
  -d "{\"customer_agent_id\":\"${CUSTOMER_ID}\",\"title\":\"Upgrade\",\"value\":{\"amount\":25000,\"currency\":\"USD\"},\"probability\":0.35,\"source\":\"REFERRAL\"}" \
  -b crm_cookies.txt -c crm_cookies.txt)
echo "${OPP_RESP}"
require_ok "${OPP_RESP}" "Create opportunity"
OPP_ID=$(printf '%s' "${OPP_RESP}" | json_id)

if [ -z "${OPP_ID}" ]; then
  echo "No opportunity id returned"; exit 1
fi

echo "== Step 9: create task linked to case =="
TASK_RESP=$(curl -s -X POST "${API_URL}/api/eip/crm/cases/${CASE_ID}/tasks" \
  -H "Content-Type: application/json" \
  -H "x-csrf: ${CSRF}" \
  -d '{"task_type":"follow_up","title":"Call customer","status":"open"}' \
  -b crm_cookies.txt -c crm_cookies.txt)
echo "${TASK_RESP}"
require_ok "${TASK_RESP}" "Create task"

echo "== Step 10: create lead =="
LEAD_RESP=$(curl -s -X POST "${API_URL}/api/eip/crm/leads" \
  -H "Content-Type: application/json" \
  -H "x-csrf: ${CSRF}" \
  -d "{\"customer_agent_id\":\"${CUSTOMER_ID}\",\"title\":\"New website enquiry\",\"source\":\"WEBFORM\",\"priority\":\"HIGH\"}" \
  -b crm_cookies.txt -c crm_cookies.txt)
echo "${LEAD_RESP}"
require_ok "${LEAD_RESP}" "Create lead"
LEAD_ID=$(printf '%s' "${LEAD_RESP}" | json_id)

if [ -z "${LEAD_ID}" ]; then
  echo "No lead id returned"; exit 1
fi

echo "== Step 11: contact and qualify lead =="
CONTACTED_RESP=$(curl -s -X POST "${API_URL}/api/eip/crm/leads/${LEAD_ID}/status" \
  -H "Content-Type: application/json" \
  -H "x-csrf: ${CSRF}" \
  -d '{"to_status":"contacted"}' \
  -b crm_cookies.txt -c crm_cookies.txt)
echo "${CONTACTED_RESP}"
require_ok "${CONTACTED_RESP}" "Contact lead"

QUALIFIED_RESP=$(curl -s -X POST "${API_URL}/api/eip/crm/leads/${LEAD_ID}/status" \
  -H "Content-Type: application/json" \
  -H "x-csrf: ${CSRF}" \
  -d '{"to_status":"qualified"}' \
  -b crm_cookies.txt -c crm_cookies.txt)
echo "${QUALIFIED_RESP}"
require_ok "${QUALIFIED_RESP}" "Qualify lead"

echo "== Step 12: convert lead =="
CONVERT_RESP=$(curl -s -X POST "${API_URL}/api/eip/crm/leads/${LEAD_ID}/convert" \
  -H "Content-Type: application/json" \
  -H "x-csrf: ${CSRF}" \
  -d "{\"customer_agent_id\":\"${CUSTOMER_ID}\",\"opportunity_title\":\"Website enquiry\",\"value\":5000,\"currency\":\"EUR\",\"probability\":0.5,\"note\":\"Qualified through happy path\"}" \
  -b crm_cookies.txt -c crm_cookies.txt)
echo "${CONVERT_RESP}"
require_ok "${CONVERT_RESP}" "Convert lead"

echo "== Step 13: add lead timeline note =="
NOTE_RESP=$(curl -s -X POST "${API_URL}/api/eip/crm/notes" \
  -H "Content-Type: application/json" \
  -H "x-csrf: ${CSRF}" \
  -d "{\"object_kind\":\"service_object\",\"object_id\":\"${LEAD_ID}\",\"title\":\"Happy path\",\"description\":\"Lead conversion verified\"}" \
  -b crm_cookies.txt -c crm_cookies.txt)
echo "${NOTE_RESP}"
require_ok "${NOTE_RESP}" "Create note"

echo "== Step 14: dashboard overview =="
DASH_RESP=$(curl -s "${API_URL}/api/eip/crm/dashboard/overview" \
  -H "x-csrf: ${CSRF}" \
  -b crm_cookies.txt)
echo "${DASH_RESP}"
require_ok "${DASH_RESP}" "Dashboard"

echo "== Step 15: lead timeline =="
TIMELINE_RESP=$(curl -s "${API_URL}/api/eip/crm/timeline?object_kind=service_object&object_id=${LEAD_ID}" \
  -H "x-csrf: ${CSRF}" \
  -b crm_cookies.txt)
echo "${TIMELINE_RESP}"
require_ok "${TIMELINE_RESP}" "Timeline"
