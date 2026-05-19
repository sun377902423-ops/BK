#!/usr/bin/env bash
# BK-PACS 测试环境部署脚本
# 用法：
#   1. cp deploy/.env.example deploy/.env，编辑 deploy/.env 填入所有 CHANGE_ME 值
#   2. 本地运行：bash deploy/scripts/deploy.sh local         # 仅本地 docker compose
#      远程运行：bash deploy/scripts/deploy.sh remote        # rsync 到 DEPLOY_HOST 并启动
#      仅同步配置：bash deploy/scripts/deploy.sh sync-config

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"

if [[ ! -f "$DEPLOY_DIR/.env" ]]; then
  echo "[ERR] deploy/.env 不存在。请先：cp deploy/.env.example deploy/.env" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source "$DEPLOY_DIR/.env"
set +a

# ---- 校验关键 secrets ------------------------------------------------------
require_var() {
  local name="$1"
  local val="${!name:-}"
  if [[ -z "$val" || "$val" == CHANGE_ME* ]]; then
    echo "[ERR] $name 未设置或仍是默认占位符。请编辑 deploy/.env" >&2
    exit 1
  fi
}

require_var POSTGRES_PASSWORD
require_var JWT_SECRET
require_var ORTHANC_PASSWORD
require_var ORTHANC_WEBHOOK_TOKEN
require_var LIVEKIT_API_SECRET

if [[ ${#JWT_SECRET} -lt 32 ]]; then
  echo "[ERR] JWT_SECRET 长度必须 >= 32 字符" >&2
  exit 1
fi

# ---- 1. 同步 orthanc-config.json 中的密码 ----------------------------------
echo "[info] 生成 orthanc-config.json（应用 ORTHANC_USERNAME/PASSWORD）"
cat > "$DEPLOY_DIR/orthanc-config.json" <<EOF
{
  "Name": "BK-PACS Orthanc",
  "StorageDirectory": "/var/lib/orthanc/db",
  "IndexDirectory": "/var/lib/orthanc/db",
  "DicomAet": "${ORTHANC_AET:-BKSYSPACS}",
  "DicomPort": ${DICOM_PORT:-4242},
  "DicomCheckCalledAet": false,
  "DicomServerEnabled": true,
  "HttpPort": 8042,
  "HttpServerEnabled": true,
  "RemoteAccessAllowed": true,
  "AuthenticationEnabled": true,
  "RegisteredUsers": {
    "${ORTHANC_USERNAME:-orthanc}": "${ORTHANC_PASSWORD}"
  },
  "Plugins": [
    "/usr/local/share/orthanc/plugins"
  ],
  "DicomWeb": {
    "Enable": true,
    "EnableWado": true,
    "EnableStow": true,
    "EnableQido": true,
    "Root": "/dicom-web/",
    "WadoRoot": "/wado",
    "Host": "localhost",
    "Ssl": false,
    "StudiesMetadata": "Full",
    "SeriesMetadata": "Full"
  },
  "HttpCompressionEnabled": true,
  "HttpHeaders": {
    "X-Content-Type-Options": "nosniff"
  }
}
EOF

# ---- 2. 同步 livekit.yaml --------------------------------------------------
echo "[info] 生成 livekit.yaml"
cat > "$DEPLOY_DIR/livekit.yaml" <<EOF
port: 7880
rtc:
  port_range_start: 50000
  port_range_end: 50100
  tcp_port: 7881
  use_external_ip: true
keys:
  ${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}
EOF

# ---- 3. 同步 nginx.conf 中 Orthanc Basic Auth ------------------------------
ORTHANC_BASIC_AUTH_COMPUTED="$(printf '%s:%s' "${ORTHANC_USERNAME:-orthanc}" "$ORTHANC_PASSWORD" | base64 | tr -d '\n')"
echo "[info] 同步 nginx Orthanc Basic Auth 头"
NGINX_CONF="$DEPLOY_DIR/nginx/nginx.conf"
# 替换 nginx.conf 中的 Authorization "Basic XXX" 行（兼容 GNU/BSD sed）
if grep -q 'proxy_set_header Authorization "Basic ' "$NGINX_CONF"; then
  if sed --version >/dev/null 2>&1; then
    sed -i "s|proxy_set_header Authorization \"Basic [^\"]*\";|proxy_set_header Authorization \"Basic ${ORTHANC_BASIC_AUTH_COMPUTED}\";|g" "$NGINX_CONF"
  else
    sed -i '' "s|proxy_set_header Authorization \"Basic [^\"]*\";|proxy_set_header Authorization \"Basic ${ORTHANC_BASIC_AUTH_COMPUTED}\";|g" "$NGINX_CONF"
  fi
fi

# ---- 4. 校验 TLS 证书存在 ---------------------------------------------------
if [[ ! -f "$DEPLOY_DIR/nginx/ssl/server.crt" || ! -f "$DEPLOY_DIR/nginx/ssl/server.key" ]]; then
  echo "[warn] TLS 证书缺失，自动生成自签证书"
  mkdir -p "$DEPLOY_DIR/nginx/ssl"
  openssl req -x509 -newkey rsa:4096 -nodes -days 825 \
    -keyout "$DEPLOY_DIR/nginx/ssl/server.key" \
    -out    "$DEPLOY_DIR/nginx/ssl/server.crt" \
    -subj "/C=CN/ST=Beijing/L=Beijing/O=BK-PACS/OU=Test/CN=bksys.local" \
    -addext "subjectAltName=DNS:localhost,DNS:bksys.local,IP:127.0.0.1"
  chmod 600 "$DEPLOY_DIR/nginx/ssl/server.key"
fi

ACTION="${1:-local}"

case "$ACTION" in
  sync-config)
    echo "[ok] 配置已同步，未执行 docker compose"
    ;;

  local)
    echo "[info] 本地启动：docker compose build && up -d"
    cd "$DEPLOY_DIR"
    docker compose --env-file .env build
    docker compose --env-file .env up -d
    sleep 5
    docker compose --env-file .env ps
    echo ""
    echo "[ok] 部署完成。访问 https://localhost:8443/  (自签证书需信任)"
    ;;

  remote)
    if [[ -z "${DEPLOY_HOST:-}" ]]; then
      echo "[ERR] DEPLOY_HOST 未设置（请在 deploy/.env 中填入）" >&2
      exit 1
    fi
    echo "[info] 远程部署 → ${DEPLOY_USER:-root}@${DEPLOY_HOST}:${DEPLOY_PATH:-/root/bksys2}"
    REMOTE="${DEPLOY_USER:-root}@${DEPLOY_HOST}"
    REMOTE_PATH="${DEPLOY_PATH:-/root/bksys2}"

    ssh -o StrictHostKeyChecking=accept-new "$REMOTE" "mkdir -p '$REMOTE_PATH'"

    echo "[info] rsync 同步代码（跳过 node_modules / dist / .git）"
    rsync -avz --delete \
      --exclude='node_modules/' --exclude='dist/' \
      --exclude='.git/' --exclude='.DS_Store' \
      --exclude='backend/node_modules' --exclude='frontend/node_modules' \
      --exclude='backend/dist' --exclude='frontend/dist' \
      -e "ssh -o StrictHostKeyChecking=accept-new" \
      "$ROOT_DIR/" "$REMOTE:$REMOTE_PATH/"

    echo "[info] 在远程构建并启动容器"
    ssh "$REMOTE" "cd '$REMOTE_PATH/deploy' && docker compose --env-file .env build && docker compose --env-file .env up -d && docker compose --env-file .env ps"
    echo "[ok] 远程部署完成"
    ;;

  *)
    echo "用法：$0 [local|remote|sync-config]"
    exit 1
    ;;
esac
