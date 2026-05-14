# BKSYS-MED 跨国远程医疗会诊系统

[![Beta 1](https://img.shields.io/badge/Release-Beta%201-blue)]()
[![Docker](https://img.shields.io/badge/Deploy-Docker%20Compose-2496ED)]()
[![License](https://img.shields.io/badge/License-MIT-green)]()

布基纳法索 → 中国 远程医疗影像会诊系统，基于 Starlink 卫星网络实现国际专家远程视频会诊、DICOM 影像实时共享、协作标注与会诊报告生成。

## Beta 1 功能清单

### 核心功能

| 模块 | 功能 | 状态 |
|------|------|------|
| 用户认证 | JWT 登录、角色权限（4角色 25+ 权限） | ✅ |
| 患者管理 | CRUD、病例密码保护、访问申请 | ✅ |
| 影像检查 | Orthanc DICOM 接收、OHIF Viewer 查看 | ✅ |
| 影像设备 | CT/MR 设备管理、DICOM Echo、Orthanc 同步 | ✅ |
| 远程会诊 | 生命周期管理、邀请机制、状态机 | ✅ |
| 视频通话 | LiveKit WebRTC（HTTPS 加密） | ✅ |
| 会诊聊天 | 实时文字消息 | ✅ |
| 报告管理 | 结构化报告、提交/签署/审批流程 | ✅ |
| 用户头像 | 上传、压缩（Sharp WebP）、全局显示 | ✅ |
| 通知系统 | 未读计数、15秒轮询 | ✅ |
| 角色权限 | RBAC、菜单/路由/按钮三级控制 | ✅ |
| 系统日志 | 服务器日志查看、错误过滤 | ✅ |
| HTTPS | 自签名 SSL 证书加密传输 | ✅ |
| i18n | 中文/英语/法语三语切换 | ✅ |

### Starlink 网络适配

- 影像设备管理支持局域网 IP + 路由映射端口配置
- CT 设备配置指南（5步操作）
- Orthanc DICOM 接收端口 4242 对外暴露
- 网络信息 API 返回服务器配置参数

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript + Vite + Tailwind CSS |
| 后端 | Node.js 22 + Fastify + Prisma ORM |
| 数据库 | PostgreSQL 16 + Redis 7 |
| PACS | Orthanc 1.12.4（DICOM + DICOMweb） |
| 影像查看 | OHIF Viewer v2 |
| 视频会诊 | LiveKit Server |
| 反向代理 | Nginx（HTTP + HTTPS） |
| 部署 | Docker Compose |

## 项目结构

```
bksys2/
├── backend/                    # 后端服务
│   ├── src/
│   │   ├── routes/            # API 路由（11个模块）
│   │   │   ├── auth.ts        # 认证
│   │   │   ├── patients.ts    # 患者管理
│   │   │   ├── studies.ts     # 影像检查
│   │   │   ├── consultations.ts # 远程会诊
│   │   │   ├── devices.ts     # 影像设备管理
│   │   │   ├── reports.ts     # 报告管理
│   │   │   ├── users.ts       # 用户管理+头像
│   │   │   ├── hospitals.ts   # 医院管理
│   │   │   ├── roles.ts       # 角色权限
│   │   │   ├── notifications.ts # 通知
│   │   │   └── logs.ts        # 系统日志
│   │   ├── lib/               # 工具库
│   │   │   ├── permissions.ts # 权限定义+角色映射
│   │   │   ├── authorize.ts   # 鉴权中间件
│   │   │   ├── prisma.ts      # 数据库客户端
│   │   │   └── roles.ts       # 角色常量
│   │   ├── prisma/
│   │   │   ├── schema.prisma  # 数据模型（20+表）
│   │   │   └── seed.ts        # 种子数据
│   │   └── index.ts           # 入口文件
│   ├── Dockerfile
│   └── package.json
├── frontend/                   # 前端应用
│   ├── src/
│   │   ├── pages/             # 页面组件（14个）
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Patients.tsx / PatientDetail.tsx
│   │   │   ├── Studies.tsx
│   │   │   ├── Consultations.tsx / ConsultationDetail.tsx
│   │   │   ├── ImagingDevices.tsx
│   │   │   ├── Reports.tsx
│   │   │   ├── Users.tsx
│   │   │   ├── Hospitals.tsx
│   │   │   ├── Roles.tsx
│   │   │   ├── AccessRequests.tsx
│   │   │   ├── SystemLogs.tsx
│   │   │   └── Login.tsx
│   │   ├── components/
│   │   │   ├── layout/        # 布局组件
│   │   │   └── ui/            # UI 组件
│   │   │       ├── UserAvatar.tsx
│   │   │       ├── PermissionGuard.tsx
│   │   │       ├── Modal.tsx
│   │   │       └── ...
│   │   ├── hooks/useAuth.ts   # 认证钩子
│   │   ├── i18n/              # 国际化（中/英/法）
│   │   ├── lib/               # 工具库
│   │   └── styles/index.css
│   ├── Dockerfile
│   └── package.json
├── deploy/                     # 部署配置
│   ├── docker-compose.yml     # Docker 编排
│   ├── orthanc-config.json    # Orthanc PACS 配置
│   ├── livekit.yaml           # LiveKit 视频服务配置
│   ├── nginx/
│   │   └── nginx.conf         # Nginx 反向代理配置
│   ├── ohif-app-config.js     # OHIF Viewer 配置
│   ├── ohif-custom.js         # OHIF 品牌定制脚本
│   └── scripts/setup.sh       # 初始化脚本
└── docs/                       # 文档
    ├── DEPLOYMENT.md           # 部署说明
    ├── CHANGELOG.md            # 操作调试记录
    ├── PROJECT_SUMMARY.md      # 项目总结
    └── QUICKSTART.md           # 快速开始
```

## 部署指南

### 前置要求

- 云服务器（推荐 4C8G+，阿里云/腾讯云）
- Docker 24+ & Docker Compose V2
- 开放端口：80, 443, 4242（DICOM）, 7880-7882（LiveKit）

### 快速部署

```bash
# 1. 克隆项目
git clone https://github.com/sun377902423-ops/BK.git
cd BK

# 2. 生成 SSL 证书（自签名，用于 HTTPS）
mkdir -p deploy/nginx/ssl
openssl req -x509 -nodes -days 3650 \
  -newkey rsa:2048 \
  -keyout deploy/nginx/ssl/server.key \
  -out deploy/nginx/ssl/server.crt \
  -subj "/CN=YOUR_SERVER_IP" \
  -addext "subjectAltName=IP:YOUR_SERVER_IP"

# 3. 修改配置
# - deploy/orthanc-config.json: 修改 PostgreSQL 密码
# - deploy/docker-compose.yml: 修改 JWT_SECRET、LiveKit 密钥
# - deploy/nginx/nginx.conf: 无需修改（通用配置）
# - deploy/livekit.yaml: 修改 node_ip 为你的服务器公网 IP

# 4. 启动所有服务
cd deploy
docker compose up -d

# 5. 初始化数据库
docker compose exec backend node dist/prisma/seed.js

# 6. 验证
curl http://localhost/health
```

### Docker 服务清单

| 服务 | 容器名 | 镜像 | 端口映射 | 说明 |
|------|--------|------|----------|------|
| postgres | bksys-postgres | postgres:16-alpine | 5432 | 数据库 |
| redis | bksys-redis | redis:7-alpine | 6379 | 缓存 |
| orthanc | bksys-orthanc | orthanc-plugins:1.12.4 | 8042, 4242 | PACS（DICOM接收） |
| backend | bksys-backend | 自建 | 3001 | API 服务 |
| frontend | bksys-frontend | 自建 | 5173→80 | Web 前端 |
| ohif-viewer | bksys-ohif | ohif/viewer:latest | 3000→80 | DICOM 查看器 |
| livekit | bksys-livekit | livekit-server:latest | 7880, 7881, 7882/udp | 视频服务 |
| nginx | bksys-nginx | nginx:1.27-alpine | 80, 8443→443 | 反向代理 |

### Nginx 路由

| 路径 | 目标 | 说明 |
|------|------|------|
| `/` | frontend:80 | 前端应用 |
| `/api/` | backend:3001 | 后端 API |
| `/ohif/` | ohif-viewer:80 | OHIF 影像查看器 |
| `/orthanc/` | orthanc:8042 | Orthanc PACS |
| `/uploads/` | backend:3001 | 用户上传文件 |
| `/health` | backend:3001 | 健康检查 |
| HTTPS 443 | nginx:443 | SSL 加密 |

### Starlink + CT 设备网络配置

本项目针对 Starlink 卫星网络（无固定公网 IP）进行了适配：

1. **服务器端**：阿里云 ECS 有固定公网 IP（115.29.203.40），Orthanc DICOM 端口 4242 对外开放
2. **CT 端**：通过路由器端口映射将 DICOM 数据发送到服务器
3. **配置步骤**：
   - CT 设备设置固定局域网 IP（如 192.168.1.100）
   - 路由器端口映射：外部端口 → 内部 CT IP:104
   - CT DICOM 目标配置：AET=BKSYSPACS, IP=115.29.203.40, Port=4242
   - 路由器静态路由绑定确保 CT 设备 IP 不变
   - 使用 DICOM Echo 验证连通性

### 安全组配置

在云服务器安全组中开放以下端口：

| 端口 | 协议 | 用途 |
|------|------|------|
| 80 | TCP | HTTP |
| 443/8443 | TCP | HTTPS |
| 4242 | TCP | DICOM 影像接收 |
| 7880 | TCP | LiveKit HTTP |
| 7881 | TCP | LiveKit RTC (TCP) |
| 7882 | UDP | LiveKit RTC (UDP) |

### 默认账号

| 角色 | 用户名 | 密码 | 权限范围 |
|------|--------|------|----------|
| 系统管理员 | admin | admin123 | 全部权限 |
| 本地医生 | doctor_local | admin123 | 患者、检查、会诊、报告 |
| 远程专家 | doctor_remote | admin123 | 患者、检查、会诊、报告 |
| 技师 | technician | admin123 | 患者、检查、设备管理 |

### 访问地址

| 服务 | URL |
|------|-----|
| 前端应用（HTTP） | http://YOUR_IP |
| 前端应用（HTTPS） | https://YOUR_IP:8443 |
| OHIF Viewer | http://YOUR_IP/ohif/viewer/{StudyInstanceUID} |
| Orthanc PACS | http://YOUR_IP/orthanc (orthanc/orthanc) |
| 后端 API | http://YOUR_IP/api |
| 健康检查 | http://YOUR_IP/health |

### 常用运维命令

```bash
# 查看服务状态
cd deploy && docker compose ps

# 重建并启动后端
docker compose build backend && docker compose up -d backend

# 重建并启动前端
docker compose build frontend && docker compose up -d frontend

# 重启 Orthanc（修改配置后）
docker compose up -d orthanc

# 重启 Nginx（修改配置后）
docker compose restart nginx

# 数据库迁移
docker compose exec backend npx prisma db push

# 重新初始化数据库（会清空数据）
docker compose exec backend npx prisma db push --force-reset
docker compose exec backend node dist/prisma/seed.js

# 查看后端日志
docker compose logs backend --tail=50 -f

# 查看 Orthanc 日志
docker compose logs orthanc --tail=50
```

## 权限系统

### 角色定义

| 角色 | 说明 | 权限模块 |
|------|------|----------|
| ADMIN | 系统管理员 | 全部（25+ 权限） |
| DOCTOR_LOCAL | 本地医生 | 患者、检查、会诊、报告、访问申请 |
| DOCTOR_REMOTE | 远程专家 | 患者（只读）、检查、会诊、报告 |
| TECHNICIAN | 技师 | 患者、检查（上传）、设备管理 |

### 权限控制层级

1. **后端路由守卫**：`authorize()` 中间件在 `preHandler` 阶段校验
2. **前端路由守卫**：`AuthorizedRoute` 组件控制页面访问
3. **菜单过滤**：`Sidebar` 根据权限隐藏无权限菜单
4. **按钮级控制**：`PermissionGuard` 组件控制操作按钮

## 开发流程

```
本地开发 → rsync 到服务器 → 服务器验证 → 同步到 GitHub
```

### 本地开发

```bash
# 后端
cd backend && npm install && npm run dev

# 前端
cd frontend && npm install && npm run dev
```

### 部署更新

```bash
# 同步代码到服务器
rsync -avz --exclude='node_modules' --exclude='.git' --exclude='dist' ./ root@YOUR_IP:/root/bksys2/

# SSH 到服务器构建部署
ssh root@YOUR_IP
cd /root/bksys2/deploy
docker compose build backend frontend
docker compose up -d backend frontend
```

## 文档

- [部署说明](docs/DEPLOYMENT.md) - 完整部署流程和服务器配置
- [操作调试记录](docs/CHANGELOG.md) - 服务器操作步骤和问题排查记录
- [快速开始](docs/QUICKSTART.md) - 本地开发环境搭建
- [项目总结](docs/PROJECT_SUMMARY.md) - 功能清单和技术架构

## License

MIT
