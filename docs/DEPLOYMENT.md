# BKSYS-MED 部署说明

## 服务器信息

| 项目 | 值 |
|------|-----|
| 云服务商 | 阿里云 ECS |
| 服务器 IP | 115.29.203.40 |
| 项目路径 | /root/bksys2/ |
| 部署路径 | /root/bksys2/deploy/ |

## Docker 服务清单

| 服务 | 容器名 | 镜像 | 端口映射 | 说明 |
|------|--------|------|----------|------|
| postgres | bksys-postgres | postgres:16-alpine | 5432 | PostgreSQL 数据库 |
| redis | bksys-redis | redis:7-alpine | 6379 | Redis 缓存 |
| orthanc | bksys-orthanc | jodogne/orthanc-plugins:1.12.4 | 8042, 4242 | PACS（DICOM AET: BKSYSPACS） |
| backend | bksys-backend | 自建 | 3001 | Fastify API 服务 |
| frontend | bksys-frontend | 自建 | 5173→80 | React 前端 |
| ohif-viewer | bksys-ohif | ohif/viewer:latest | 3000→80 | DICOM 查看器 |
| livekit | bksys-livekit | livekit-server:latest | 7880, 7881, 7882/udp | WebRTC 视频服务 |
| nginx | bksys-nginx | nginx:1.27-alpine | 80, 8443→443 | 反向代理（HTTP+HTTPS） |

## 完整部署流程

### 1. 从本地同步代码到服务器

```bash
rsync -avz --exclude='node_modules' --exclude='.git' --exclude='dist' ./ root@115.29.203.40:/root/bksys2/
```

### 2. 在服务器上重新生成 lock 文件（如有依赖变更）

```bash
ssh root@115.29.203.40
docker run --rm -v /root/bksys2/backend:/app -w /app node:22-alpine sh -c 'npm install --package-lock-only'
docker run --rm -v /root/bksys2/frontend:/app -w /app node:22-alpine sh -c 'npm install --package-lock-only'
```

### 3. 构建和启动服务

```bash
cd /root/bksys2/deploy

# 构建所有服务
docker compose build

# 启动所有服务
docker compose up -d

# 仅重建后端
docker compose build backend && docker compose up -d backend

# 仅重建前端
docker compose build frontend && docker compose up -d frontend
```

### 4. 数据库初始化

```bash
# 同步 Schema（首次部署或 schema 变更后）
docker compose exec backend npx prisma db push

# 运行种子数据
docker compose exec backend node dist/prisma/seed.js

# 强制重置数据库（会清空所有数据）
docker compose exec backend npx prisma db push --force-reset
docker compose exec backend node dist/prisma/seed.js
```

### 5. 验证部署

```bash
# 检查所有容器状态
docker compose ps

# 检查健康状态
curl http://localhost/health

# 检查后端 API
curl http://localhost:3001/health

# 检查 Orthanc
curl -u orthanc:orthanc http://localhost:8042/system

# 检查 HTTPS
curl -sk https://localhost:8443/health
```

## SSL 证书

自签名证书用于 HTTPS 加密，存放在 `deploy/nginx/ssl/`：

```bash
# 生成自签名证书
openssl req -x509 -nodes -days 3650 \
  -newkey rsa:2048 \
  -keyout deploy/nginx/ssl/server.key \
  -out deploy/nginx/ssl/server.crt \
  -subj "/CN=115.29.203.40" \
  -addext "subjectAltName=IP:115.29.203.40"
```

> 注意：浏览器访问 HTTPS 时会提示证书不受信任，需要手动接受。

## Orthanc PACS 配置

Orthanc 使用自定义配置文件 `deploy/orthanc-config.json`：

- **AET**: BKSYSPACS
- **DICOM Port**: 4242
- **认证**: orthanc/orthanc
- **数据库**: PostgreSQL（bksys_med）
- **DICOMweb**: 已启用
- **WADO**: 已启用

设备管理 API 会自动将注册的影像设备同步到 Orthanc 的 DICOM Modalities 中。

## LiveKit 视频服务配置

LiveKit 配置文件 `deploy/livekit.yaml`：

- **HTTP 端口**: 7880
- **RTC TCP 端口**: 7881
- **RTC UDP 端口**: 7882
- **Node IP**: 115.29.203.40（需修改为实际服务器 IP）

## 安全组端口

| 端口 | 协议 | 用途 |
|------|------|------|
| 80 | TCP | HTTP |
| 8443 | TCP | HTTPS（映射到容器 443） |
| 4242 | TCP | DICOM 影像接收 |
| 7880 | TCP | LiveKit HTTP |
| 7881 | TCP | LiveKit RTC (TCP) |
| 7882 | UDP | LiveKit RTC (UDP) |

## 默认账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 系统管理员 | admin | admin123 |
| 本地医生 | doctor_local | admin123 |
| 远程专家 | doctor_remote | admin123 |
| 技师 | technician | admin123 |

## 常见问题

### Q: 修改代码后页面没有变化？
A: 需要重新构建 Docker 镜像：
```bash
cd /root/bksys2/deploy
docker compose build backend frontend
docker compose up -d backend frontend
```

### Q: npm ci 失败（lock file out of sync）？
A: 重新生成 lock 文件：
```bash
docker run --rm -v /root/bksys2/backend:/app -w /app node:22-alpine sh -c 'npm install --package-lock-only'
docker run --rm -v /root/bksys2/frontend:/app -w /app node:22-alpine sh -c 'npm install --package-lock-only'
```

### Q: HTTPS 访问提示不安全？
A: 使用的是自签名证书，浏览器会提示不受信任，点击"继续访问"即可。

### Q: DICOM Echo 测试失败？
A: 检查 CT 设备的网络配置和路由器端口映射，确保 CT 设备可以访问服务器的 4242 端口。

### Q: LiveKit 视频/麦克风不工作？
A: 需要通过 HTTPS 访问才能使用 getUserMedia，HTTP 下会被浏览器阻止。
