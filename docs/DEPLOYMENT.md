# BKSYS-MED 部署说明

## 服务器信息

| 项目 | 值 |
|------|-----|
| 服务器 IP | 115.29.203.40 |
| SSH 用户 | root |
| 项目路径 | /root/bksys2/ |
| 部署路径 | /root/bksys2/deploy/deploy/ |

## 目录结构说明

服务器上存在两套代码目录：

```
/root/bksys2/
├── backend/              # 后端源码（最新版本）
├── frontend/             # 前端源码（最新版本）
└── deploy/
    └── deploy/           # Docker Compose 部署目录
        ├── docker-compose.yml
        ├── nginx/
        │   └── nginx.conf
        ├── ohif-app-config.js
        ├── ohif-custom.js
        ├── backend/      # 后端部署副本（Docker 构建上下文）
        └── frontend/     # 前端部署副本（Docker 构建上下文）
```

**关键点**：`docker-compose.yml` 中的 `context: ../backend` 和 `context: ../frontend` 指向的是 `deploy/backend/` 和 `deploy/frontend/`（部署副本），而非 `/root/bksys2/backend/`（源码目录）。因此部署前必须先将源码同步到部署副本。

## Docker 服务清单

| 服务 | 容器名 | 镜像 | 端口 |
|------|--------|------|------|
| postgres | bksys-postgres | postgres:16-alpine | 5432 |
| redis | bksys-redis | redis:7-alpine | 6379 |
| orthanc | bksys-orthanc | jodogne/orthanc-plugins:1.12.4 | 8042, 4242 |
| backend | bksys-backend | 自建 | 3001 |
| frontend | bksys-frontend | 自建 | 5173→80 |
| ohif-viewer | bksys-ohif | ohif/viewer:latest | 3000→80 |
| nginx | bksys-nginx | nginx:1.27-alpine | 80→80 |

## 完整部署流程

### 1. 从本地同步代码到服务器

```bash
# 同步 deploy 配置
scp deploy/docker-compose.yml root@115.29.203.40:/root/bksys2/deploy/deploy/
scp deploy/nginx/nginx.conf root@115.29.203.40:/root/bksys2/deploy/deploy/nginx/
scp deploy/ohif-app-config.js root@115.29.203.40:/root/bksys2/deploy/deploy/
scp deploy/ohif-custom.js root@115.29.203.40:/root/bksys2/deploy/deploy/

# 同步后端源码到服务器源码目录
rsync -avz --delete -e ssh backend/src/ root@115.29.203.40:/root/bksys2/backend/src/
rsync -avz -e ssh backend/package.json backend/Dockerfile backend/tsconfig.json root@115.29.203.40:/root/bksys2/backend/

# 同步前端源码到服务器源码目录
rsync -avz --delete -e ssh frontend/src/ root@115.29.203.40:/root/bksys2/frontend/src/
rsync -avz -e ssh frontend/package.json frontend/Dockerfile frontend/tsconfig.json frontend/vite.config.ts frontend/tailwind.config.js frontend/postcss.config.js frontend/index.html frontend/nginx.conf root@115.29.203.40:/root/bksys2/frontend/
```

### 2. 在服务器上同步源码到部署副本

```bash
ssh root@115.29.203.40

# 同步后端源码到部署副本
rsync -avz --delete /root/bksys2/backend/ /root/bksys2/deploy/backend/ --exclude node_modules --exclude .env

# 同步前端源码到部署副本
rsync -avz --delete /root/bksys2/frontend/ /root/bksys2/deploy/frontend/ --exclude node_modules --exclude .env
```

### 3. 构建和启动服务

```bash
cd /root/bksys2/deploy/deploy

# 构建并启动所有服务（首次部署或代码变更后）
docker compose up -d --build

# 仅重新构建后端（后端代码变更后）
docker compose build --no-cache backend
docker compose up -d backend

# 仅重新构建前端（前端代码变更后）
docker compose build --no-cache frontend
docker compose up -d frontend

# 仅重启 nginx（配置变更后）
docker compose restart nginx

# 仅重启 OHIF（配置变更后）
docker compose restart ohif-viewer
```

### 4. 数据库初始化

```bash
# 运行 Prisma 迁移（首次部署或 schema 变更后）
docker exec bksys-backend npx prisma migrate deploy

# 运行种子数据
docker exec bksys-backend npx prisma db seed

# 如果 prisma db seed 不可用，可手动执行 SQL
docker exec -i bksys-postgres psql -U bksys -d bksys_med < /path/to/seed.sql
```

### 5. 验证部署

```bash
# 检查所有容器状态
docker compose ps

# 检查健康状态
curl http://localhost/health

# 检查后端 API
curl http://localhost/api/auth/me

# 检查 OHIF Viewer
curl -s http://localhost/ohif/ | head -5

# 检查 Orthanc
curl -u orthanc:orthanc http://localhost/orthanc/system
```

## 从服务器同步代码到 GitHub

开发流程为：本地开发 → 服务器验证 → GitHub 存档

```bash
# 从服务器同步源码到本地
rsync -avz --delete -e ssh root@115.29.203.40:/root/bksys2/backend/src/ ./backend/src/
rsync -avz --delete -e ssh root@115.29.203.40:/root/bksys2/frontend/src/ ./frontend/src/
rsync -avz --delete -e ssh root@115.29.203.40:/root/bksys2/deploy/deploy/ ./deploy/ --exclude ssl --exclude scripts --exclude jitsi --exclude orthanc

# 清理 macOS 资源分叉文件
find . -name '._*' -type f -delete

# 提交到 GitHub
git add -A
git commit -m "sync: 从服务器同步已验证代码"
git push origin main
```

## OHIF Viewer 定制说明

OHIF Viewer 是预编译的 Docker 镜像（ohif/viewer:latest），无法直接修改源码。定制通过以下方式实现：

### 配置文件：ohif-app-config.js

挂载到容器内 `/usr/share/nginx/html/app-config.js`，用于配置：
- DICOMweb 服务器连接（Orthanc）
- 路由基础路径（/ohif）
- i18n 语言配置（中文/英语/法语）
- 品牌信息（BK-PACS）

### 自定义脚本：ohif-custom.js

通过 nginx `sub_filter` 注入到 OHIF 页面 `<head>` 中，实现：
- 替换 OHIF Logo 为 BK-PACS 图标和标题
- 隐藏 "INVESTIGATIONAL USE ONLY" 文本
- 隐藏 "Options" 下拉菜单
- 添加语言切换按钮（中/EN/FR），通过 React Fiber 树查找 i18next 实例调用 `changeLanguage()`
- 语言选择保存在 localStorage，刷新后保持

### Nginx 代理配置

```nginx
# OHIF 部署在 /ohif/ 子路径下，需要特殊处理
location /ohif/ {
    proxy_pass http://ohif-viewer:80/;
    # sub_filter 重写 HTML 中的资源路径
    sub_filter 'src="/' 'src="/ohif/';
    sub_filter 'href="/' 'href="/ohif/';
    # 注入自定义脚本
    sub_filter '</head>' '<script src="/ohif-custom.js"></script></head>';
}

# 代理 OHIF 动态加载的 JS 模块（文件名含 ~ 字符）
location ~ ^/[^/]+\.(bundle[._~\w]*\.js|css|json|mjs|png|ico|svg|woff2?)$ {
    proxy_pass http://ohif-viewer:80;
}
```

## 权限管理系统

### 角色定义

| 角色 | 说明 | 权限范围 |
|------|------|----------|
| ADMIN | 系统管理员 | 全部权限 |
| DOCTOR_LOCAL | 本地医生 | 患者、检查、会诊、报告 |
| DOCTOR_REMOTE | 远程专家 | 患者、检查、会诊、报告 |
| TECHNICIAN | 技师 | 患者、检查（上传/查看） |

### 权限实现层级

1. **后端路由守卫**：`authorize()` 中间件在 `preHandler` 阶段检查权限
2. **前端路由守卫**：`AuthorizedRoute` 组件控制页面访问
3. **前端菜单过滤**：`Sidebar` 根据权限隐藏无权限菜单
4. **按钮级控制**：`PermissionGuard` 组件控制操作按钮显示
5. **数据级隔离**：非 ADMIN 用户只能查看所属医院的数据

### 权限相关文件

- 后端：`backend/src/lib/permissions.ts`（权限定义）、`backend/src/lib/authorize.ts`（鉴权中间件）
- 前端：`frontend/src/lib/permissions.ts`（权限定义）、`frontend/src/hooks/useAuth.ts`（权限钩子）
- 组件：`frontend/src/components/ui/PermissionGuard.tsx`

## 默认账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 系统管理员 | admin | admin123 |
| 本地医生 | doctor_local | admin123 |
| 远程专家 | doctor_remote | admin123 |
| 技师 | technician | admin123 |

## 访问地址

| 服务 | URL |
|------|-----|
| 前端应用 | http://115.29.203.40 |
| OHIF Viewer | http://115.29.203.40/ohif/viewer?StudyInstanceUIDs={ID} |
| Orthanc PACS | http://115.29.203.40/orthanc (orthanc/orthanc) |
| 后端 API | http://115.29.203.40/api |
| 健康检查 | http://115.29.203.40/health |

## 常见问题

### Q: 修改代码后页面没有变化？
A: 需要同步源码到部署副本并重新构建：
```bash
rsync -avz --delete /root/bksys2/backend/ /root/bksys2/deploy/backend/ --exclude node_modules
rsync -avz --delete /root/bksys2/frontend/ /root/bksys2/deploy/frontend/ --exclude node_modules
docker compose build --no-cache backend frontend
docker compose up -d backend frontend
```

### Q: OHIF Viewer 白屏？
A: 检查 nginx 配置中的 `sub_filter` 规则和 `ohif-app-config.js` 中的 DICOMweb 配置。

### Q: OHIF Viewer 黑屏？
A: 检查 nginx 的 regex location 是否正确代理动态加载的 JS 模块。

### Q: OHIF 报 "No URL was specified"？
A: OHIF v2 的路由：`/viewer/:studyInstanceUIDs`（ViewerRouting）vs `/viewer`（StandaloneRouting）。必须使用路径参数格式 `/ohif/viewer/{StudyInstanceUID}`，而非查询参数 `/ohif/viewer?StudyInstanceUIDs={ID}`。

### Q: Docker 构建使用了缓存导致代码未更新？
A: 使用 `--no-cache` 参数：`docker compose build --no-cache backend`
