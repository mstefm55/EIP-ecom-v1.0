#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:4000}"
LOG_FILE="${LOG_FILE:-onboarding_happy_path.log}"
REDACT_LOG="${REDACT_LOG:-1}"

redact_stream() {
  sed -E \
    -e 's/("bootstrapToken":")[^"]+/\1[REDACTED]/g' \
    -e 's/("secret":")[^"]+/\1[REDACTED]/g' \
    -e 's/("token":")[^"]+/\1[REDACTED]/g' \
    -e 's/(secret=)[A-Z0-9]+/\1[REDACTED]/g'
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

json_request_id() {
  node -e "const fs=require('fs');const data=JSON.parse(fs.readFileSync(0,'utf8'));const ref=process.argv[1];const items=data.items||[];const hit=items.find(i=>i.ref_code===ref)||items[0]; if(hit&&hit.id) console.log(hit.id);" "$1"
}

require_ok() {
  node -e "const label=process.argv[2]; try{const j=JSON.parse(process.argv[1]); if(j.ok!==true){console.error(label + ' failed:', j); process.exit(1);} } catch(e){console.error(label + ' invalid JSON'); process.exit(1);} " "$1" "$2"
}

prompt EIP_TENANT_ID "" "EIP admin tenant UUID"
prompt ADMIN_EMAIL "admin@eip.local" "EIP admin email"
prompt ADMIN_PASSWORD "YourStrongPassw0rd!" "EIP admin password"

prompt APPLICANT_TYPE "business" "Applicant type (business|sole_trader)"
prompt LEGAL_NAME "Acme Holdings Ltd" "Applicant legal name"
prompt BUSINESS_REG_NO "BRN-123456" "Business registration no (if business)"
prompt PERSONAL_ID_NO "" "Personal ID no (if sole_trader)"
prompt REQUEST_EMAIL "admin@acme.local" "New tenant admin email"
prompt PHONE "+2300000000" "Phone (optional)"
prompt COUNTRY "MU" "Country"
prompt TIMEZONE "Indian/Mauritius" "Timezone"
prompt TERMS_VERSION "v1" "Terms version"
prompt PRIVACY_VERSION "v1" "Privacy version"
prompt AGREEMENTS_LIST "${REQUIRED_TENANT_AGREEMENTS:-TOS:v1,DPA:v1}" "Required agreements (CODE:VERSION,...)"
prompt NEW_ADMIN_PASSWORD "YourStrongPassw0rd!" "New tenant admin password"

echo "== Step 1: submit tenant request =="
REQUEST_BODY=$(cat <<EOF
{
  "applicantType":"${APPLICANT_TYPE}",
  "legalName":"${LEGAL_NAME}",
  "businessRegNo":"${BUSINESS_REG_NO}",
  "personalIdNo":"${PERSONAL_ID_NO}",
  "email":"${REQUEST_EMAIL}",
  "phone":"${PHONE}",
  "country":"${COUNTRY}",
  "timezone":"${TIMEZONE}",
  "acceptTerms":true,
  "acceptPrivacy":true,
  "termsVersion":"${TERMS_VERSION}",
  "privacyVersion":"${PRIVACY_VERSION}"
}
EOF
)
REQ_RESP=$(curl -s -X POST "${API_URL}/api/public/tenant-requests" \
  -H "Content-Type: application/json" \
  -d "${REQUEST_BODY}")
echo "${REQ_RESP}"
require_ok "${REQ_RESP}" "Tenant request"
REF_CODE=$(printf '%s' "${REQ_RESP}" | json_field ref)
if [ -z "${REF_CODE}" ]; then
  echo "No ref returned; cannot continue."
  exit 1
fi

echo "== Step 2: admin request OTP =="
OTP_RESP=$(curl -s -X POST "${API_URL}/api/eip/auth/request-otp" \
  -H "Content-Type: application/json" \
  -d "{\"tenantId\":\"${EIP_TENANT_ID}\",\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" \
  -c admin_cookies.txt)
echo "${OTP_RESP}"
require_ok "${OTP_RESP}" "Admin OTP request"

read -r -p "Enter OTP from server logs: " ADMIN_OTP

echo "== Step 3: admin verify OTP =="
VERIFY_RESP=$(curl -s -X POST "${API_URL}/api/eip/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d "{\"tenantId\":\"${EIP_TENANT_ID}\",\"email\":\"${ADMIN_EMAIL}\",\"otp\":\"${ADMIN_OTP}\"}" \
  -b admin_cookies.txt -c admin_cookies.txt)
echo "${VERIFY_RESP}"
require_ok "${VERIFY_RESP}" "Admin OTP verify"

echo "== Step 4: list requests =="
LIST_RESP=$(curl -s "${API_URL}/api/eip/admin/tenant-requests?status=SUBMITTED" \
  -b admin_cookies.txt)
echo "${LIST_RESP}"
require_ok "${LIST_RESP}" "List requests"
REQUEST_ID=$(printf '%s' "${LIST_RESP}" | json_request_id "${REF_CODE}")
if [ -z "${REQUEST_ID}" ]; then
  echo "Request ID not found."
  exit 1
fi

CSRF=$(awk '$6=="csrf"{print $7}' admin_cookies.txt)

echo "== Step 5: approve request =="
APPROVE_RESP=$(curl -s -X POST "${API_URL}/api/eip/admin/tenant-requests/${REQUEST_ID}/approve" \
  -H "x-csrf: ${CSRF}" \
  -b admin_cookies.txt -c admin_cookies.txt)
echo "${APPROVE_RESP}"
require_ok "${APPROVE_RESP}" "Approve request"
BOOTSTRAP_TOKEN=$(printf '%s' "${APPROVE_RESP}" | json_field bootstrapToken)
if [ -z "${BOOTSTRAP_TOKEN}" ]; then
  read -r -p "Enter bootstrap token (emailed or from logs): " BOOTSTRAP_TOKEN
fi

echo "== Step 6: bootstrap consume =="
BOOTSTRAP_RESP=$(curl -s -X POST "${API_URL}/api/eip/bootstrap/consume" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"${BOOTSTRAP_TOKEN}\"}" \
  -c bootstrap_cookies.txt)
echo "${BOOTSTRAP_RESP}"
require_ok "${BOOTSTRAP_RESP}" "Bootstrap consume"

CSRF_BOOT=$(awk '$6=="csrf"{print $7}' bootstrap_cookies.txt)

echo "== Step 7: bootstrap set password =="
PASS_RESP=$(curl -s -X POST "${API_URL}/api/eip/bootstrap/password" \
  -H "Content-Type: application/json" \
  -H "x-csrf: ${CSRF_BOOT}" \
  -d "{\"password\":\"${NEW_ADMIN_PASSWORD}\"}" \
  -b bootstrap_cookies.txt -c bootstrap_cookies.txt)
echo "${PASS_RESP}"
require_ok "${PASS_RESP}" "Bootstrap password"

echo "== Step 8: bootstrap TOTP enroll =="
TOTP_RESP=$(curl -s -X POST "${API_URL}/api/eip/bootstrap/totp/enroll" \
  -H "x-csrf: ${CSRF_BOOT}" \
  -b bootstrap_cookies.txt -c bootstrap_cookies.txt)
echo "${TOTP_RESP}"
require_ok "${TOTP_RESP}" "Bootstrap TOTP enroll"
TOTP_SECRET=$(printf '%s' "${TOTP_RESP}" | json_field secret)
if [ -z "${TOTP_SECRET}" ]; then
  echo "No TOTP secret returned."
  exit 1
fi

echo "== Step 9: bootstrap TOTP confirm =="
TOTP_TOKEN=$(node --input-type=module -e "import { TOTP, NobleCryptoPlugin, ScureBase32Plugin } from 'otplib'; const totp=new TOTP({ crypto:new NobleCryptoPlugin(), base32:new ScureBase32Plugin(), period:30 }); const token=await totp.generate({ secret: '${TOTP_SECRET}' }); console.log(token);")
TOTP_CONFIRM_RESP=$(curl -s -X POST "${API_URL}/api/eip/bootstrap/totp/confirm" \
  -H "Content-Type: application/json" \
  -H "x-csrf: ${CSRF_BOOT}" \
  -d "{\"token\":\"${TOTP_TOKEN}\"}" \
  -b bootstrap_cookies.txt -c bootstrap_cookies.txt)
echo "${TOTP_CONFIRM_RESP}"
require_ok "${TOTP_CONFIRM_RESP}" "Bootstrap TOTP confirm"

echo "== Step 10: bootstrap device trust =="
TRUST_RESP=$(curl -s -X POST "${API_URL}/api/eip/bootstrap/device/trust" \
  -H "x-csrf: ${CSRF_BOOT}" \
  -b bootstrap_cookies.txt -c bootstrap_cookies.txt)
echo "${TRUST_RESP}"
require_ok "${TRUST_RESP}" "Bootstrap device trust"

echo "== Step 11: bootstrap accept agreements =="
AGREEMENTS_BODY=$(node -e "const raw=process.argv[1]||''; const items=raw.split(',').map(s=>s.trim()).filter(Boolean).map(pair=>{const parts=pair.split(':'); return {code: (parts[0]||'').trim(), version: (parts[1]||'').trim()};}); console.log(JSON.stringify({ agreements: items }));" "${AGREEMENTS_LIST}")
AGREE_RESP=$(curl -s -X POST "${API_URL}/api/eip/bootstrap/agreements/accept" \
  -H "Content-Type: application/json" \
  -H "x-csrf: ${CSRF_BOOT}" \
  -d "${AGREEMENTS_BODY}" \
  -b bootstrap_cookies.txt -c bootstrap_cookies.txt)
echo "${AGREE_RESP}"
require_ok "${AGREE_RESP}" "Bootstrap agreements accept"

echo "== Step 12: bootstrap complete =="
curl -i -X POST "${API_URL}/api/eip/bootstrap/complete" \
  -H "x-csrf: ${CSRF_BOOT}" \
  -b bootstrap_cookies.txt -c bootstrap_cookies.txt
echo

echo "== Step 13: whoami should be 401 =="
curl -i "${API_URL}/api/eip/auth/whoami" -b bootstrap_cookies.txt
