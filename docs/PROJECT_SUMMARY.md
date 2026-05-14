# BKSYS-MED 远程会诊系统 - 项目总结（Beta 1）

## 项目概述

布基纳法索 → 中国 跨国远程医疗影像会诊系统，基于 Starlink 卫星网络，实现国际专家远程视频会诊、DICOM 影像实时共享、协作标注与会诊报告生成。

## Beta 1 已完成功能

### 后端服务 (backend/)

#### API 模块（11个）

| 模块 | 路由 | 功能 |
|------|------|------|
| 认证 | `/api/auth` | JWT 登录、获取当前用户、权限列表 |
| 患者 | `/api/patients` | CRUD、病例密码、访问申请 |
| 影像检查 | `/api/studies` | 列表、上传、关联患者 |
| 远程会诊 | `/api/consultations` | 生命周期管理、邀请、状态机、消息 |
| 影像设备 | `/api/devices` | CRUD、Orthanc 同步、DICOM Echo、网络信息 |
| 报告 | `/api/reports` | CRUD、提交/签署/审批流程 |
| 用户 | `/api/users` | CRUD、头像上传（Sharp 压缩）、个人资料 |
| 医院 | `/api/hospitals` | CRUD |
| 角色 | `/api/roles` | 角色权限管理 |
| 通知 | `/api/notifications` | 未读计数、标记已读 |
| 系统日志 | `/api/logs` | 服务器日志查看 |

#### 数据模型（20+ 表）

- User, Role, Hospital, Patient, Study, ImagingDevice
- Consultation, ConsultationParticipant, ConsultationMessage
- Report, Attachment, ReportTemplate
- MedicalRecord, MedicalOrder, Diagnosis
- AuditLog, OperationLog, Notification
- PatientAccessRequest, PatientAccess, SystemConfig, BackupRecord

#### 权限系统

- 4 种角色：ADMIN, DOCTOR_LOCAL, DOCTOR_REMOTE, TECHNICIAN
- 25+ 项细粒度权限
- 5 级权限控制：后端路由 → 前端路由 → 菜单 → 按钮 → 数据

### 前端应用 (frontend/)

#### 页面（14个）

| 页面 | 功能 |
|------|------|
| Login | 用户登录 |
| Dashboard | 仪表盘、统计数据 |
| Patients | 患者列表、搜索 |
| PatientDetail | 患者详情、关联检查/会诊 |
| Studies | 影像检查列表 |
| Consultations | 会诊列表、状态筛选 |
| ConsultationDetail | 会诊详情、视频通话、聊天 |
| ImagingDevices | 设备管理、DICOM Echo、网络配置 |
| Reports | 报告管理 |
| Users | 用户管理 |
| Hospitals | 医院管理 |
| Roles | 角色权限管理 |
| AccessRequests | 访问申请 |
| SystemLogs | 系统日志查看 |

#### UI 组件

- UserAvatar：头像组件（4 种尺寸、状态指示）
- PermissionGuard：权限控制组件
- Modal：弹窗组件
- PageHeader：页面头部
- EmptyState：空状态
- LoadingSpinner：加载动画
- ConfirmDialog：确认对话框
- StatusBadge：状态标签

### 部署配置 (deploy/)

- 8 个 Docker 服务编排
- Nginx 反向代理（HTTP + HTTPS）
- Orthanc PACS（DICOM 接收 + DICOMweb）
- LiveKit 视频服务
- OHIF Viewer 品牌定制

## 技术亮点

### Starlink 网络适配

- 影像设备管理支持局域网 IP + 路由映射端口
- CT 设备 5 步配置指南
- DICOM Echo 连通性测试
- Orthanc 模态自动同步

### 影像设备管理

- 支持 CT/MR/DR/US 等 12 种模态
- 设备创建/更新时自动同步到 Orthanc
- DICOM Echo 验证设备连通性
- 网络信息 API 返回完整配置参数

### 用户头像系统

- Sharp 压缩：200x200 WebP，质量 80%
- 全局显示：Header、会诊、聊天
- 4 种尺寸：xs(24px) / sm(32px) / md(40px) / lg(64px)

### 视频会诊

- LiveKit WebRTC 替代 Jitsi Meet
- HTTPS 加密传输
- 聊天功能已隐藏（CSS 方式）

### 国际化

- 中文/英语/法语三语
- 400+ 翻译条目
- OHIF Viewer 语言切换

## 默认测试账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 系统管理员 | admin | admin123 |
| 本地医生 | doctor_local | admin123 |
| 远程专家 | doctor_remote | admin123 |
| 技师 | technician | admin123 |

## 后续规划

### Beta 2

- [ ] DICOM 影像渐进式加载（卫星网络优化）
- [ ] PDF 报告导出
- [ ] 影像标注协作同步
- [ ] 移动端适配

### 正式版

- [ ] 正式 SSL 证书
- [ ] 数据备份与恢复
- [ ] 性能监控
- [ ] 安全审计增强
