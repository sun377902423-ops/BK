# BKSYS 远程会诊系统 - 快速开始

## 项目结构

```
bksys2/
├── backend/           # 后端服务 (Fastify + Prisma)
│   ├── src/
│   │   ├── routes/   # API 路由
│   │   └── prisma/   # Prisma 数据模型
│   └── package.json
├── frontend/          # 前端应用 (React + Vite + Tailwind)
│   ├── src/
│   │   ├── pages/    # 页面组件
│   │   └── components/
│   └── package.json
├── deploy/           # 部署配置
│   ├── docker-compose.yml
│   └── scripts/
└── docs/
```

## 本地开发

### 前置要求

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL (可选，如果用 Docker 运行)

### 方式一：使用 Docker Compose (推荐)

```bash
# 1. 进入部署目录
cd deploy

# 2. 运行设置脚本
chmod +x scripts/setup.sh
./scripts/setup.sh

# 3. 启动所有服务
docker compose up -d

# 4. 查看服务状态
docker compose ps
```

### 方式二：手动本地开发

```bash
# 启动数据库 (使用 Docker)
docker run --name bksys-postgres -e POSTGRES_USER=bksys -e POSTGRES_PASSWORD=bksys123 -e POSTGRES_DB=bksys_med -p 5432:5432 -d postgres:16-alpine

docker run --name bksys-redis -p 6379:6379 -d redis:7-alpine

# 启动后端
cd backend
npm install
cp .env.example .env
# 编辑 .env 文件
npm run db:generate
npm run db:push
npm run db:seed
npm run dev

# 启动前端 (新终端)
cd frontend
npm install
npm run dev
```

## 默认账号

- 系统管理员: admin / admin123
- 本地医生: doctor_local / admin123
- 远程专家: doctor_remote / admin123
- 技师: technician / admin123

## 访问地址

- 前端应用: http://localhost:5173 或 http://localhost
- 后端 API: http://localhost:3001
- Orthanc PACS: http://localhost:8042 (orthanc/orthanc)
- 健康检查: http://localhost/health
