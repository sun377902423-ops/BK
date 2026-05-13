# BKSYS-MED 跨国医疗远程会诊系统

布基纳法索 → 中国 远程医疗影像会诊系统，实现国际专家远程视频会诊、DICOM影像实时共享、协作标注与会诊报告生成。

## 技术栈

- **前端**：React 19 + TypeScript + Vite + Tailwind CSS
- **后端**：Node.js 22 + Fastify + Prisma ORM
- **数据库**：PostgreSQL 16 + Redis 7
- **PACS**：Orthanc 1.12.4
- **DICOM 查看**：OHIF Viewer
- **视频会诊**：Jitsi Meet
- **部署**：Docker Compose + Nginx

## 项目结构

```
bksys2/
├── backend/          # 后端服务
├── frontend/         # 前端应用
├── deploy/           # 部署配置
│   ├── scripts/      # 部署脚本
│   ├── nginx/        # Nginx 配置
│   ├── orthanc/      # Orthanc PACS 配置
│   └── jitsi/        # Jitsi 配置
├── docs/             # 文档
└── .github/workflows # CI/CD 配置
```

## 快速开始

### 开发环境

```bash
# 启动所有服务
cd deploy
docker compose up -d
```

### 访问地址

- 前端应用：https://localhost
- 后端 API：https://localhost/api
- Orthanc PACS：https://localhost/orthanc
- OHIF Viewer：https://localhost/ohif

## 功能特性

- ✅ 用户认证与角色权限（4种角色，21项权限）
- ✅ 患者管理（CRUD + 检查时间线）
- ✅ DICOM 影像查看（窗宽窗位、测量、标注）
- ✅ 视频会诊（Jitsi Meet 集成）
- ✅ 协作会诊（三分区布局 + 标注同步）
- ✅ 会诊报告（结构化 + PDF 导出 + 电子签名）
- ✅ 审计日志
- ✅ HTTPS 加密传输

## 部署

详细部署指南见 [docs/deployment.md](file:///Volumes/External/workspace/bksys2/docs/deployment.md)
