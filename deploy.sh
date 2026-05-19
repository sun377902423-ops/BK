#!/bin/bash
set -e

SERVER="root@115.29.203.40"
REMOTE_DIR="/root/bksys2"
LOCAL_DIR="/Volumes/External/workspace/bksys2"

echo "=== BK-PACS 部署脚本 ==="
echo ""

echo "[1/4] 同步代码到服务器..."
rsync -avz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='gradle-cache' \
  --exclude='dev-tools' \
  --exclude='android' \
  --exclude='*.zip' \
  --exclude='dist' \
  "${LOCAL_DIR}/" "${SERVER}:${REMOTE_DIR}/"

echo ""
echo "[2/4] 在服务器上重建后端..."
ssh "${SERVER}" "cd ${REMOTE_DIR}/deploy && docker compose build backend"

echo ""
echo "[3/4] 重建前端..."
ssh "${SERVER}" "cd ${REMOTE_DIR}/deploy && docker compose build frontend"

echo ""
echo "[4/4] 重启所有服务..."
ssh "${SERVER}" "cd ${REMOTE_DIR}/deploy && docker compose up -d"

echo ""
echo "=== 部署完成 ==="
echo ""
echo "等待服务启动 (15秒)..."
sleep 15

echo "检查服务状态..."
ssh "${SERVER}" "cd ${REMOTE_DIR}/deploy && docker compose ps"

echo ""
echo "=== 后端日志 (最后20行) ==="
ssh "${SERVER}" "cd ${REMOTE_DIR}/deploy && docker compose logs backend --tail=20"