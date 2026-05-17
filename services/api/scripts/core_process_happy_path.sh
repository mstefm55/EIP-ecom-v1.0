#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:4000}"
LOG_FILE="${LOG_FILE:-core_process_happy_path.log}"
REDACT_LOG="${REDACT_LOG:-1}"

redact_stream() {
  sed -E -e 's/("otp":")[^"]+/\1[REDACTED]/g' \
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

json_id() {
  node -e "const fs=require('fs');const data=JSON.parse(fs.readFileSync(0,'utf8'));const v=data&&data.item&&data.item.id; if(v) console.log(v);"
}

json_created_id() {
  node -e "const fs=require('fs');const data=JSON.parse(fs.readFileSync(0,'utf8'));const effects=data&&data.entry&&data.entry.effects_applied||[];const so=effects.find(e=>e.type==='so_create');const id=so&&so.created&&so.created[0]&&so.created[0].id; if(id) console.log(id);"
}

json_instance_id() {
  node -e "const fs=require('fs');const data=JSON.parse(fs.readFileSync(0,'utf8'));const effects=data&&data.entry&&data.entry.effects_applied||[];const inst=effects.find(e=>e.type==='instance_start');const id=inst&&inst.instances&&inst.instances[0]&&inst.instances[0].id; if(id) console.log(id);"
}

require_ok() {
  node -e "const label=process.argv[2]; try{const j=JSON.parse(process.argv[1]); if(j.ok!==true){console.error(label + ' failed:', j); process.exit(1);} } catch(e){console.error(label + ' invalid JSON'); process.exit(1);} " "$1" "$2"
}

prompt EIP_TENANT_ID "" "EIP tenant UUID"
prompt ADMIN_EMAIL "admin@eip.local" "Admin email"
prompt ADMIN_PASSWORD "YourStrongPassw0rd!" "Admin password"

prompt CUSTOMER_NAME "Core Process Customer" "Customer name"


echo "== Step 1: request OTP =="
OTP_RESP=$(curl -s -X POST "${API_URL}/api/eip/auth/request-otp" \
  -H "Content-Type: application/json" \
  -d "{\"tenantId\":\"${EIP_TENANT_ID}\",\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" \
  -c core_process_cookies.txt)
echo "${OTP_RESP}"
require_ok "${OTP_RESP}" "OTP request"

read -r -p "Enter OTP from server logs: " ADMIN_OTP

echo "== Step 2: verify OTP =="
VERIFY_RESP=$(curl -s -X POST "${API_URL}/api/eip/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d "{\"tenantId\":\"${EIP_TENANT_ID}\",\"email\":\"${ADMIN_EMAIL}\",\"otp\":\"${ADMIN_OTP}\"}" \
  -b core_process_cookies.txt -c core_process_cookies.txt)
echo "${VERIFY_RESP}"
require_ok "${VERIFY_RESP}" "OTP verify"

CSRF=$(awk '$6=="csrf"{print $7}' core_process_cookies.txt)

echo "== Step 3: create customer agent =="
AGENT_RESP=$(curl -s -X POST "${API_URL}/api/eip/crm/agents" \
  -H "Content-Type: application/json" \
  -H "x-csrf: ${CSRF}" \
  -d "{\"agent_type\":\"ORG\",\"name\":\"${CUSTOMER_NAME}\"}" \
  -b core_process_cookies.txt -c core_process_cookies.txt)
echo "${AGENT_RESP}"
require_ok "${AGENT_RESP}" "Create agent"
CUSTOMER_ID=$(printf '%s' "${AGENT_RESP}" | json_id)

if [ -z "${CUSTOMER_ID}" ]; then
  echo "No customer id returned"; exit 1
fi
echo "Customer agent id: ${CUSTOMER_ID}"

echo "== Step 4: create case service_object =="
CASE_RESP=$(curl -s -X POST "${API_URL}/api/eip/crm/cases" \
  -H "Content-Type: application/json" \
  -H "x-csrf: ${CSRF}" \
  -d "{\"customer_agent_id\":\"${CUSTOMER_ID}\",\"case_type\":\"REQUEST\",\"title\":\"Core Process Case\"}" \
  -b core_process_cookies.txt -c core_process_cookies.txt)
echo "${CASE_RESP}"
require_ok "${CASE_RESP}" "Create case"
CASE_ID=$(printf '%s' "${CASE_RESP}" | json_id)

if [ -z "${CASE_ID}" ]; then
  echo "No case id returned"; exit 1
fi
echo "Case service_object id: ${CASE_ID}"

echo "== Step 5: create core process_def =="
DEF_CODE="CORE_CASE_FLOW_$(date +%s)"
DEF_PAYLOAD=$(cat <<EOF
{"module":"core","code":"${DEF_CODE}","name":"Core Case Flow","graph":{"name":"Case Flow","object_type":"CRM_CASE","initial_node":"new","nodes":{"new":{"on_enter":{"task_templates":[{"task_type":"FOLLOWUP","title":"Call customer","assign":"owner","due_in_days":2}]}} ,"in_progress":{}},"transitions":[{"from":"new","action":"start","to":"in_progress","effects":[{"type":"so_status","to":"in_progress","list_code":"SERVICE_OBJECT_STATUS"}]}]}}
EOF
)

DEF_RESP=$(curl -s -X POST "${API_URL}/api/eip/core/process/defs" \
  -H "Content-Type: application/json" \
  -H "x-csrf: ${CSRF}" \
  -d "${DEF_PAYLOAD}" \
  -b core_process_cookies.txt -c core_process_cookies.txt)
echo "${DEF_RESP}"
require_ok "${DEF_RESP}" "Create process_def"
DEF_ID=$(printf '%s' "${DEF_RESP}" | json_id)

if [ -z "${DEF_ID}" ]; then
  echo "No process_def id returned"; exit 1
fi
echo "Process_def id: ${DEF_ID}"

echo "== Step 6: create process instance =="
INSTANCE_RESP=$(curl -s -X POST "${API_URL}/api/eip/core/process/instances" \
  -H "Content-Type: application/json" \
  -H "x-csrf: ${CSRF}" \
  -d "{\"service_object_id\":\"${CASE_ID}\",\"process_def_id\":\"${DEF_ID}\",\"idempotency_key\":\"${CASE_ID}-${DEF_ID}\"}" \
  -b core_process_cookies.txt -c core_process_cookies.txt)
echo "${INSTANCE_RESP}"
require_ok "${INSTANCE_RESP}" "Create process instance"
INSTANCE_ID=$(printf '%s' "${INSTANCE_RESP}" | json_id)

if [ -z "${INSTANCE_ID}" ]; then
  echo "No instance id returned"; exit 1
fi
echo "Process_instance id: ${INSTANCE_ID}"

echo "== Step 7: advance instance =="
ADV_RESP=$(curl -s -X POST "${API_URL}/api/eip/core/process/instances/${INSTANCE_ID}/advance" \
  -H "Content-Type: application/json" \
  -H "x-csrf: ${CSRF}" \
  -d "{\"action\":\"start\",\"idempotency_key\":\"advance-${INSTANCE_ID}-start\",\"payload\":{\"note\":\"ok\"}}" \
  -b core_process_cookies.txt -c core_process_cookies.txt)
echo "${ADV_RESP}"
require_ok "${ADV_RESP}" "Advance instance"

echo "== Step 8: verify case status =="
CASE_GET=$(curl -s "${API_URL}/api/eip/crm/cases/${CASE_ID}" \
  -H "x-csrf: ${CSRF}" \
  -b core_process_cookies.txt)
echo "${CASE_GET}"
require_ok "${CASE_GET}" "Case fetch"

echo "== Step 9: verify tasks created =="
TASKS_RESP=$(curl -s "${API_URL}/api/eip/crm/tasks?service_object_id=${CASE_ID}" \
  -H "x-csrf: ${CSRF}" \
  -b core_process_cookies.txt)
echo "${TASKS_RESP}"
require_ok "${TASKS_RESP}" "Tasks list"

echo "== Step 10: create child flow def =="
CHILD_CODE="CHILD_FLOW_$(date +%s)"
CHILD_DEF_PAYLOAD=$(cat <<EOF
{"module":"core","code":"${CHILD_CODE}","name":"Child Flow","graph":{"name":"Child Flow","object_type":"CRM_CASE","initial_node":"new","nodes":{"new":{}},"transitions":[]}}
EOF
)
CHILD_DEF_RESP=$(curl -s -X POST "${API_URL}/api/eip/core/process/defs" \
  -H "Content-Type: application/json" \
  -H "x-csrf: ${CSRF}" \
  -d "${CHILD_DEF_PAYLOAD}" \
  -b core_process_cookies.txt -c core_process_cookies.txt)
echo "${CHILD_DEF_RESP}"
require_ok "${CHILD_DEF_RESP}" "Create child process_def"

echo "== Step 11: create transform+start def =="
TRANSFORM_CODE="TRANSFORM_START_$(date +%s)"
TRANSFORM_DEF_PAYLOAD=$(cat <<EOF
{"module":"core","code":"${TRANSFORM_CODE}","name":"Transform + Start","graph":{"name":"Transform + Start","object_type":"CRM_CASE","initial_node":"new","nodes":{"new":{}},"transitions":[{"from":"new","action":"transform","to":"new","effects":[{"type":"so_create","items":[{"object_type":"CRM_CASE","status":"new","title":"Child Case (auto)","as":"child","links":[{"src_kind":"SERVICE_OBJECT","src_id":"$created.child","dst_kind":"SERVICE_OBJECT","dst_id":"$service_object_id","relation_type":"TRANSFORMED_FROM"}]}]},{"type":"instance_start","service_object_id":"$created.child","module":"core","code":"${CHILD_CODE}","idempotency_key_prefix":"auto-child"}]}]}}
EOF
)
TRANSFORM_DEF_RESP=$(curl -s -X POST "${API_URL}/api/eip/core/process/defs" \
  -H "Content-Type: application/json" \
  -H "x-csrf: ${CSRF}" \
  -d "${TRANSFORM_DEF_PAYLOAD}" \
  -b core_process_cookies.txt -c core_process_cookies.txt)
echo "${TRANSFORM_DEF_RESP}"
require_ok "${TRANSFORM_DEF_RESP}" "Create transform+start def"
TRANSFORM_DEF_ID=$(printf '%s' "${TRANSFORM_DEF_RESP}" | json_id)

if [ -z "${TRANSFORM_DEF_ID}" ]; then
  echo "No transform def id returned"; exit 1
fi
echo "Transform+start def id: ${TRANSFORM_DEF_ID}"

echo "== Step 12: create transform instance =="
TRANSFORM_INST_RESP=$(curl -s -X POST "${API_URL}/api/eip/core/process/instances" \
  -H "Content-Type: application/json" \
  -H "x-csrf: ${CSRF}" \
  -d "{\"service_object_id\":\"${CASE_ID}\",\"process_def_id\":\"${TRANSFORM_DEF_ID}\",\"idempotency_key\":\"${CASE_ID}-${TRANSFORM_DEF_ID}\"}" \
  -b core_process_cookies.txt -c core_process_cookies.txt)
echo "${TRANSFORM_INST_RESP}"
require_ok "${TRANSFORM_INST_RESP}" "Create transform instance"
TRANSFORM_INST_ID=$(printf '%s' "${TRANSFORM_INST_RESP}" | json_id)

if [ -z "${TRANSFORM_INST_ID}" ]; then
  echo "No transform instance id returned"; exit 1
fi
echo "Transform instance id: ${TRANSFORM_INST_ID}"

echo "== Step 13: advance transform instance =="
TRANSFORM_ADV_RESP=$(curl -s -X POST "${API_URL}/api/eip/core/process/instances/${TRANSFORM_INST_ID}/advance" \
  -H "Content-Type: application/json" \
  -H "x-csrf: ${CSRF}" \
  -d "{\"action\":\"transform\",\"idempotency_key\":\"advance-${TRANSFORM_INST_ID}-transform\",\"payload\":{\"note\":\"spawn child\"}}" \
  -b core_process_cookies.txt -c core_process_cookies.txt)
echo "${TRANSFORM_ADV_RESP}"
require_ok "${TRANSFORM_ADV_RESP}" "Advance transform instance"
CHILD_CASE_ID=$(printf '%s' "${TRANSFORM_ADV_RESP}" | json_created_id)
CHILD_INST_ID=$(printf '%s' "${TRANSFORM_ADV_RESP}" | json_instance_id)

if [ -z "${CHILD_CASE_ID}" ] || [ -z "${CHILD_INST_ID}" ]; then
  echo "Missing child ids from transform advance"; exit 1
fi
echo "Child case id: ${CHILD_CASE_ID}"
echo "Child instance id: ${CHILD_INST_ID}"

echo "== Step 14: verify child case created =="
CHILD_CASE_GET=$(curl -s "${API_URL}/api/eip/crm/cases/${CHILD_CASE_ID}" \
  -H "x-csrf: ${CSRF}" \
  -b core_process_cookies.txt)
echo "${CHILD_CASE_GET}"
require_ok "${CHILD_CASE_GET}" "Child case fetch"

echo "== Step 15: verify child process instance =="
CHILD_INST_GET=$(curl -s "${API_URL}/api/eip/core/process/instances/${CHILD_INST_ID}" \
  -H "x-csrf: ${CSRF}" \
  -b core_process_cookies.txt)
echo "${CHILD_INST_GET}"
require_ok "${CHILD_INST_GET}" "Child instance fetch"
