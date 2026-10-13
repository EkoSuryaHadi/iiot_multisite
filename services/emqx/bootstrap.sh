#!/bin/sh
# Bootstrap konfigurasi EMQX cluster: HTTP authn/authz source ke auth-webhook.
# Idempotent - aman dijalankan berulang (saat compose up ulang / restart).
set -eu

DASHBOARD_URL="http://haproxy:18083"
USERNAME="${EMQX_DASHBOARD_USER}"
PASSWORD="${EMQX_DASHBOARD_PASSWORD}"

echo "[bootstrap] menunggu EMQX dashboard (via LB) siap..."
until curl -sf "$DASHBOARD_URL/api/v5/status" >/dev/null 2>&1; do
  sleep 2
done
echo "[bootstrap] dashboard siap."

echo "[bootstrap] login ke dashboard..."
LOGIN_RESP=$(curl -sf -X POST "$DASHBOARD_URL/api/v5/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")
TOKEN=$(echo "$LOGIN_RESP" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

if [ -z "$TOKEN" ]; then
  echo "[bootstrap] GAGAL login ke EMQX dashboard" >&2
  exit 1
fi

AUTH_HEADER="Authorization: Bearer $TOKEN"

echo "[bootstrap] memasang HTTP authentication backend -> auth-webhook/authn ..."
AUTHN_BODY='{
  "mechanism": "password_based",
  "backend": "http",
  "method": "post",
  "url": "http://auth-webhook:8000/authn",
  "body": {
    "username": "${username}",
    "password": "${password}",
    "clientid": "${clientid}",
    "peerhost": "${peerhost}"
  },
  "headers": {"content-type": "application/json"},
  "connect_timeout": "5s",
  "request_timeout": "5s",
  "pool_size": 8
}'

set +e
curl -sf -X PUT "$DASHBOARD_URL/api/v5/authentication/password_based%3Ahttp" \
  -H "Content-Type: application/json" -H "$AUTH_HEADER" -d "$AUTHN_BODY" >/tmp/authn.json 2>&1
UPDATE_RC=$?
set -e
if [ $UPDATE_RC -ne 0 ]; then
  echo "[bootstrap] authn belum ada, membuat baru..."
  curl -sf -X POST "$DASHBOARD_URL/api/v5/authentication" \
    -H "Content-Type: application/json" -H "$AUTH_HEADER" -d "$AUTHN_BODY"
fi
echo
echo "[bootstrap] authn backend terpasang."

echo "[bootstrap] cek authorization source yang sudah ada..."
EXISTING_SOURCES=$(curl -sf "$DASHBOARD_URL/api/v5/authorization/sources" -H "$AUTH_HEADER")

AUTHZ_BODY='{
    "type": "http",
    "enable": true,
    "method": "post",
    "url": "http://auth-webhook:8000/authz",
    "body": {
      "username": "${username}",
      "clientid": "${clientid}",
      "topic": "${topic}",
      "action": "${action}",
      "peerhost": "${peerhost}"
    },
    "headers": {"content-type": "application/json"},
    "connect_timeout": "5s",
    "request_timeout": "5s",
    "pool_size": 8
  }'

case "$EXISTING_SOURCES" in
  *'"type":"http"'*)
    echo "[bootstrap] authz http source sudah ada, update..."
    curl -sf -X PUT "$DASHBOARD_URL/api/v5/authorization/sources/http" \
      -H "Content-Type: application/json" -H "$AUTH_HEADER" -d "$AUTHZ_BODY"
    ;;
  *)
    echo "[bootstrap] authz http source belum ada, membuat baru..."
    curl -sf -X POST "$DASHBOARD_URL/api/v5/authorization/sources" \
      -H "Content-Type: application/json" -H "$AUTH_HEADER" -d "$AUTHZ_BODY"
    ;;
esac
echo
echo "[bootstrap] authorization source terpasang."

echo "[bootstrap] menghapus authorization source default 'file' (kalau masih ada)..."
curl -s -X DELETE "$DASHBOARD_URL/api/v5/authorization/sources/file" -H "$AUTH_HEADER" >/dev/null 2>&1 || true

echo "[bootstrap] set authorization default: no_match=deny, deny_action=disconnect..."
curl -sf -X PUT "$DASHBOARD_URL/api/v5/authorization/settings" \
  -H "Content-Type: application/json" -H "$AUTH_HEADER" \
  -d '{"no_match":"deny","deny_action":"disconnect","cache":{"enable":true}}'
echo

echo "[bootstrap] selesai. EMQX cluster siap memakai auth-webhook untuk authn/authz."

echo "[bootstrap] memasang Rule Engine: connector HTTP ke analytics-api..."
CONNECTOR_BODY='{
  "type": "http",
  "name": "analytics_api",
  "url": "http://analytics-api:8000",
  "headers": {"content-type": "application/json"},
  "connect_timeout": "5s",
  "pool_size": 8,
  "enable_pipelining": 100
}'
set +e
curl -sf -X POST "$DASHBOARD_URL/api/v5/connectors" -H "Content-Type: application/json" -H "$AUTH_HEADER" -d "$CONNECTOR_BODY" >/tmp/connector.json 2>&1
CONNECTOR_RC=$?
set -e
if [ $CONNECTOR_RC -ne 0 ]; then
  echo "[bootstrap] connector analytics_api sudah ada, update..."
  curl -sf -X PUT "$DASHBOARD_URL/api/v5/connectors/http%3Aanalytics_api" \
    -H "Content-Type: application/json" -H "$AUTH_HEADER" -d '{
      "url": "http://analytics-api:8000",
      "headers": {"content-type": "application/json"},
      "connect_timeout": "5s",
      "pool_size": 8,
      "enable_pipelining": 100
    }' >/dev/null
fi
echo "[bootstrap] connector terpasang."

echo "[bootstrap] memasang action HTTP -> analytics-api/ingest..."
ACTION_BODY='{
  "type": "http",
  "name": "analytics_api_ingest",
  "connector": "analytics_api",
  "parameters": {
    "path": "/ingest",
    "method": "post",
    "headers": {"content-type": "application/json"},
    "body": "{\"topic\": \"${topic}\", \"payload\": ${payload}, \"clientid\": \"${clientid}\", \"publish_received_at\": ${timestamp}}"
  }
}'
set +e
curl -sf -X POST "$DASHBOARD_URL/api/v5/actions" -H "Content-Type: application/json" -H "$AUTH_HEADER" -d "$ACTION_BODY" >/tmp/action.json 2>&1
ACTION_RC=$?
set -e
if [ $ACTION_RC -ne 0 ]; then
  echo "[bootstrap] action analytics_api_ingest sudah ada, update..."
  curl -sf -X PUT "$DASHBOARD_URL/api/v5/actions/http%3Aanalytics_api_ingest" \
    -H "Content-Type: application/json" -H "$AUTH_HEADER" -d '{
      "connector": "analytics_api",
      "parameters": {
        "path": "/ingest",
        "method": "post",
        "headers": {"content-type": "application/json"},
        "body": "{\"topic\": \"${topic}\", \"payload\": ${payload}, \"clientid\": \"${clientid}\", \"publish_received_at\": ${timestamp}}"
      }
    }' >/dev/null
fi
echo "[bootstrap] action terpasang."

echo "[bootstrap] memasang rule ingest_telemetry (t/+/s/+/d/+/telemetry -> /ingest)..."
set +e
curl -sf -X POST "$DASHBOARD_URL/api/v5/rules" -H "Content-Type: application/json" -H "$AUTH_HEADER" -d '{
  "id": "ingest_telemetry",
  "sql": "SELECT topic, payload, clientid, timestamp FROM \"t/+/s/+/d/+/telemetry\"",
  "actions": ["http:analytics_api_ingest"],
  "description": "Kirim telemetry ke analytics-api /ingest"
}' >/tmp/rule_telemetry.json 2>&1
RULE_TELEMETRY_RC=$?
set -e
if [ $RULE_TELEMETRY_RC -ne 0 ]; then
  echo "[bootstrap] rule ingest_telemetry sudah ada, update..."
  curl -sf -X PUT "$DASHBOARD_URL/api/v5/rules/ingest_telemetry" \
    -H "Content-Type: application/json" -H "$AUTH_HEADER" -d '{
      "sql": "SELECT topic, payload, clientid, timestamp FROM \"t/+/s/+/d/+/telemetry\"",
      "actions": ["http:analytics_api_ingest"],
      "description": "Kirim telemetry ke analytics-api /ingest"
    }' >/dev/null
fi
echo "[bootstrap] rule ingest_telemetry terpasang."

echo "[bootstrap] memasang rule ingest_status (t/+/s/+/d/+/status -> /ingest)..."
set +e
curl -sf -X POST "$DASHBOARD_URL/api/v5/rules" -H "Content-Type: application/json" -H "$AUTH_HEADER" -d '{
  "id": "ingest_status",
  "sql": "SELECT topic, payload, clientid, timestamp FROM \"t/+/s/+/d/+/status\"",
  "actions": ["http:analytics_api_ingest"],
  "description": "Kirim status device ke analytics-api /ingest"
}' >/tmp/rule_status.json 2>&1
RULE_STATUS_RC=$?
set -e
if [ $RULE_STATUS_RC -ne 0 ]; then
  echo "[bootstrap] rule ingest_status sudah ada, update..."
  curl -sf -X PUT "$DASHBOARD_URL/api/v5/rules/ingest_status" \
    -H "Content-Type: application/json" -H "$AUTH_HEADER" -d '{
      "sql": "SELECT topic, payload, clientid, timestamp FROM \"t/+/s/+/d/+/status\"",
      "actions": ["http:analytics_api_ingest"],
      "description": "Kirim status device ke analytics-api /ingest"
    }' >/dev/null
fi
echo "[bootstrap] rule ingest_status terpasang."

echo "[bootstrap] selesai total. Rule Engine siap mengalirkan telemetry & status ke ClickHouse via analytics-api."
