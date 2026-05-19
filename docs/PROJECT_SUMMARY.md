# BKSYS-MED 远程会诊系统 - 项目总结（Beta 1）

## 项目概述

布基纳法索 → 中国 跨国远程医疗影像会诊系统，基于 Starlink 卫星网络，实现国际专家远程视频会诊、DICOM 影像实时共享、协作标注与会诊报告生成。

## 系统架构总览

```
┌─────────────────────────────────────────────────────────┐
│                    用户浏览器 (HTTPS)                      │
├─────────────────────────────────────────────────────────┤
│                   Nginx 反向代理 (80/443)                  │
├──────┬──────────┬──────────┬──────────┬─────────────────┤
│      │          │          │          │                 │
│ 前端 │ 后端 API │ Orthanc  │ OHIF     │ LiveKit        │
│ :5173│ :3001    │ :8042    │ :3000    │ :7880-7882     │
│ React│ Fastify  │ PACS     │ Viewer   │ WebRTC         │
│  │   │    │     │    │     │    │     │    │            │
│  └───┴────┴─────────┴─────────┴──────────┤            │
│                    │                      │            │
│               PostgreSQL                Redis         │
│               :5432                     :6379         │
└─────────────────────────────────────────────────────────┘
```

## 项目结构（更新于 2026-05）

```
bksys2/
├── backend/                          # 后端服务
│   ├── src/
│   │   ├── routes/                   # API 路由（11个模块）
│   │   │   ├── auth.ts               # JWT 认证 + 登录/权限
│   │   │   ├── patients.ts           # 患者管理 CRUD + 访问申请
│   │   │   ├── studies.ts            # 影像检查 + Orthanc 同步
│   │   │   ├── consultations.ts      # 远程会诊 + 生命周期 + 消息
│   │   │   ├── devices.ts            # 影像设备管理 + DICOM Echo
│   │   │   ├── reports.ts            # 报告管理 + 签署/审批
│   │   │   ├── users.ts              # 用户管理 + 头像上传
│   │   │   ├── hospitals.ts          # 医院管理
│   │   │   ├── roles.ts              # 角色权限管理
│   │   │   ├── notifications.ts      # 通知系统
│   │   │   ├── backups.ts            # 数据备份管理
│   │   │   └── logs.ts               # 系统日志
│   │   ├── lib/                      # 共享工具
│   │   │   ├── permissions.ts        # 权限定义（38项）+ 角色映射
│   │   │   ├── authorize.ts          # 路由鉴权中间件
│   │   │   ├── resource-acl.ts       # 资源级 ACL
│   │   │   ├── prisma.ts             # Prisma 客户端
│   │   │   └── roles.ts              # 角色常量
│   │   ├── prisma/
│   │   │   ├── schema.prisma         # 数据模型（20+ 表）
│   │   │   └── seed.ts               # 种子数据（4角色+管理员账号）
│   │   ├── types/
│   │   │   └── fastify-jwt.d.ts      # JWT 类型扩展
│   │   └── index.ts                  # Fastify 入口
│   ├── Dockerfile                    # 多阶段构建
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                         # React 前端
│   ├── src/
│   │   ├── pages/                    # 15个页面
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Patients.tsx
│   │   │   ├── PatientDetail.tsx
│   │   │   ├── Studies.tsx
│   │   │   ├── Consultations.tsx
│   │   │   ├── ConsultationDetail.tsx  # 视频+聊天+影像
│   │   │   ├── Reports.tsx
│   │   │   ├── Users.tsx
│   │   │   ├── Hospitals.tsx
│   │   │   ├── Roles.tsx
│   │   │   ├── ImagingDevices.tsx
│   │   │   ├── AccessRequests.tsx
│   │   │   ├── SystemLogs.tsx
│   │   │   └── BackupManagement.tsx
│   │   ├── components/
│   │   │   ├── layout/               # 布局（Sidebar/Header/Bell）
│   │   │   │   ├── Layout.tsx        # 整体布局（侧栏可收缩）
│   │   │   │   ├── Sidebar.tsx       # 侧栏（收缩/展开）
│   │   │   │   ├── Header.tsx        # 顶部栏（头像/语言/通知）
│   │   │   │   └── NotificationBell.tsx  # 通知铃铛（15s轮询）
│   │   │   └── ui/                   # 通用 UI 组件
│   │   │       ├── UserAvatar.tsx    # 头像（4种尺寸+状态指示）
│   │   │       ├── PermissionGuard.tsx  # 按钮级权限控制
│   │   │       ├── Modal.tsx         # 弹窗
│   │   │       ├── PageHeader.tsx    # 页面头部
│   │   │       ├── EmptyState.tsx    # 空状态
│   │   │       ├── LoadingSpinner.tsx  # 加载动画
│   │   │       ├── ConfirmDialog.tsx # 确认对话框
│   │   │       ├── StatusBadge.tsx   # 状态标签
│   │   │       └── ErrorBoundary.tsx # 错误边界（防止白屏）
│   │   ├── contexts/
│   │   │   └── SidebarContext.tsx     # 侧栏状态共享
│   │   ├── hooks/
│   │   │   └── useAuth.ts            # 认证钩子（hasPermission）
│   │   ├── i18n/
│   │   │   ├── index.ts
│   │   │   └── locales/
│   │   │       ├── zh.json           # 中文（400+ 字段）
│   │   │       ├── en.json           # 英文
│   │   │       └── fr.json           # 法语
│   │   ├── lib/
│   │   │   ├── api.ts                # Axios 实例（interceptors）
│   │   │   ├── permissions.ts        # 前端权限常量
│   │   │   └── notificationSound.ts  # 通知音效引擎（Web Audio API）
│   │   ├── styles/
│   │   │   └── index.css             # Tailwind + 全局样式
│   │   ├── App.tsx                   # 路由配置 + ErrorBoundary
│   │   └── main.tsx                  # 入口
│   ├── android/                      # Capacitor Android 打包
│   ├── Dockerfile                    # Nginx 静态服务
│   ├── nginx.conf                    # SPA fallback
│   ├── capacitor.config.ts           # Android 打包配置
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
│
├── deploy/                           # 部署配置
│   ├── docker-compose.yml            # 8个 Docker 服务编排
│   ├── orthanc-config.json           # PACS 配置（PostgreSQL 后端）
│   ├── livekit.yaml                  # WebRTC 视频服务配置
│   ├── nginx/
│   │   └── nginx.conf                # 反向代理（HTTPS/sub_filter）
│   ├── ohif-app-config.js            # OHIF Viewer 配置（v2兼容）
│   ├── ohif-custom.js                # OHIF 品牌定制脚本
│   ├── scripts/
│   │   ├── deploy.sh                 # 部署脚本
│   │   └── setup.sh                  # 初始化脚本
│   └── .env.example                  # 环境变量模板
│
├── docs/                             # 文档
│   ├── PROJECT_SUMMARY.md            # 本文件
│   ├── DEPLOYMENT.md                 # 部署说明
│   ├── QUICKSTART.md                 # 本地开发
│   └── CHANGELOG.md                  # 操作调试记录
│
├── deploy.sh                         # 一键部署脚本
├── README.md                         # 项目总览
└── build-android.sh                  # Android APK 构建
```

## 部署架构

### Docker 服务清单

| 服务 | 镜像 | 端口 | 用途 | 状态 |
|------|------|------|------|------|
| **postgres** | postgres:16-alpine | 5432 | 主数据库 | 健康 |
| **redis** | redis:7-alpine | 6379 | 缓存 | 健康 |
| **orthanc** | orthanc-plugins:1.12.4 | 8042, 4242 | DICOM PACS | 健康 |
| **backend** | 自建 | 3001 | Fastify API | 健康 |
| **frontend** | 自建 | 5173→80 | React SPA | 健康 |
| **ohif-viewer** | ohif/viewer:latest | 3000→80 | DICOM 查看器 | 健康 |
| **livekit** | livekit-server:latest | 7880-7882 | WebRTC 视频 | 健康 |
| **nginx** | nginx:1.27-alpine | 80, 8443→443 | 反向代理 | 健康 |

### Nginx 路由表

| 路径 | 上游 | 说明 |
|------|------|------|
| `/` | frontend:80 | SPA 前端应用 |
| `/api/` | backend:3001 | REST API |
| `/ohif/` | ohif-viewer:80 | OHIF 影像查看器（sub_filter 重写路径） |
| `/orthanc/` | orthanc:8042 | Orthanc PACS 管理界面 |
| `/uploads/` | backend:3001 | 用户上传文件 |
| `/health` | nginx | 健康检查 |
| `/livekit/` | livekit:7880 | WebRTC 信令 |

## 功能清单

### 已实现功能（Beta 1）

| 模块 | 功能 | 状态 |
|------|------|------|
| **认证系统** | JWT 登录/登出、4角色 RBAC、38项权限 | ✅ |
| **患者管理** | CRUD、病例密码保护、访问申请 | ✅ |
| **影像检查** | Orthanc 接收、模糊搜索、ZIP 上传、StudyInstanceUID 回填 | ✅ |
| **影像设备** | CT/MR 管理、DICOM Echo、Orthanc 同步 | ✅ |
| **远程会诊** | 生命周期（6状态）、邀请/响应、状态机验证 | ✅ |
| **视频通话** | LiveKit WebRTC、HTTPS 加密 | ✅ |
| **会诊聊天** | 实时消息、未读提醒 | ✅ |
| **OHIF Viewer** | 子路径部署、品牌定制（标题/LOGO/语言切换）、v2/v3 兼容配置 | ✅ |
| **报告管理** | 结构化报告、提交/签署/审批流程 | ✅ |
| **通知系统** | 15秒轮询、未读计数、消息音效 | ✅ |
| **用户头像** | Sharp WebP 压缩、4种尺寸、全局显示 | ✅ |
| **角色权限** | 前端路由/菜单/按钮三级控制 | ✅ |
| **侧栏收缩** | 可收起/展开，收起时仅图标显示 | ✅ |
| **国际化** | 中文/英语/法语三语、400+ 条目 | ✅ |
| **HTTPS** | 自签名 SSL、Nginx 终止 | ✅ |
| **错误边界** | ErrorBoundary 组件防止白屏 | ✅ |
| **系统日志** | 服务器日志查看、错误过滤 | ✅ |
| **数据备份** | 数据库备份管理 | ✅ |
| **Android 打包** | Capacitor 打包为 APK | ✅ |
| **一键部署** | deploy.sh 脚本 | ✅ |

## 后端 API 接口概览

### 认证模块
- `POST /api/auth/login` — 登录（返回 JWT + 权限列表）
- `GET /api/auth/me` — 当前用户信息

### 核心业务模块
- `GET/POST /api/patients` — 患者列表/创建
- `GET/PUT/DELETE /api/patients/:id` — 患者详情/修改/删除
- `GET /api/studies` — 影像检查列表（支持模糊搜索）
- `POST /api/studies/upload` — 上传 ZIP/DCM 文件
- `POST /api/studies/sync-orthanc` — 同步 Orthanc 数据
- `GET /api/studies/orthanc-stats` — Orthanc 统计
- `POST /api/studies/backfill-uids` — 回填 StudyInstanceUID
- `GET /api/consultations` — 会诊列表
- `POST /api/consultations` — 创建会诊
- `GET /api/consultations/:id` — 会诊详情
- `PUT /api/consultations/:id/status` — 状态变更
- `POST /api/consultations/:id/participants/invite` — 邀请参与人
- `GET/POST /api/consultations/:id/messages` — 聊天消息

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端框架** | React 18 + TypeScript |
| **构建工具** | Vite 5 |
| **样式** | Tailwind CSS 3 + Heroicons |
| **路由** | React Router 6 |
| **数据请求** | TanStack React Query 5 + Axios |
| **国际化** | i18next + react-i18next |
| **视频** | LiveKit + @livekit/components-react |
| **后端框架** | Fastify 4 (Node.js) |
| **ORM** | Prisma 5 |
| **数据库** | PostgreSQL 16 + Redis 7 |
| **PACS** | Orthanc 1.12.4（DICOM + DICOMweb） |
| **影像查看** | OHIF Viewer（v2/v3 兼容） |
| **视频服务** | LiveKit Server |
| **代理** | Nginx 1.27（HTTP + HTTPS） |
| **部署** | Docker Compose |
| **移动端** | Capacitor 8（Android） |

## 安全体系

| 层级 | 措施 |
|------|------|
| **传输层** | HTTPS 自签名 SSL 证书 |
| **认证层** | JWT 令牌（12h 过期） |
| **鉴权层** | RBAC 权限模型（4角色/38权限） |
| **路由层** | 后端 authorize() 中间件 + 前端 AuthorizedRoute |
| **组件层** | PermissionGuard 按钮级控制 |
| **数据层** | 资源级 ACL（resource-acl.ts） |
| **防护层** | Helmet + Rate Limit + CORS |
| **容错层** | ErrorBoundary 防白屏 |

## 开发流程

```
本地修改 → deploy.sh 一键部署到服务器 → 验证 → 同步 GitHub
```

## 默认测试账号

| 角色 | 用户名 | 密码 | 权限范围 |
|------|--------|------|----------|
| 系统管理员 | admin | admin123 | 全部 |
| 本地医生 | doctor_local | admin123 | 患者、检查、会诊、报告 |
| 远程专家 | doctor_remote | admin123 | 患者（只读）、检查、会诊、报告 |
| 技师 | technician | admin123 | 患者、检查（上传）、设备管理 |

## 后续规划

### Beta 2
- [ ] DICOM 影像渐进式加载（卫星网络优化）
- [ ] PDF 报告导出
- [ ] 影像标注协作同步
- [ ] 移动端 iOS 适配

### 正式版
- [ ] 正式 SSL 证书（Let's Encrypt）
- [ ] 数据备份自动恢复
- [ ] 性能监控（Grafana/Prometheus）
- [ ] 安全审计增强
