# BK-PACS 系统专项整改记录

> 文档生成日期：2026-05-15
> 整改周期：2026-05-14 ~ 2026-05-15

---

## 目录

1. [问题1：OHIF Viewer 影像查看白屏（"Sorry, this page does not exist."）](#问题1ohif-viewer-影像查看白屏sorry-this-page-does-not-exist)
2. [问题2：ZIP 压缩包上传解压失败](#问题2zip-压缩包上传解压失败)
3. [问题3：影像检查检索栏交互体验差](#问题3影像检查检索栏交互体验差)
4. [问题4：会诊详情页面进入后白屏](#问题4会诊详情页面进入后白屏)
5. [问题5：代码修改未同步到服务器 / 构建部署流程问题](#问题5代码修改未同步到服务器--构建部署流程问题)
6. [问题6：Dockerfile npm ci 构建失败](#问题6dockerfile-npm-ci-构建失败)
7. [全量修改文件清单](#全量修改文件清单)

---

## 问题1：OHIF Viewer 影像查看白屏（"Sorry, this page does not exist."）

### 严重级别

🔴 **致命** — 核心影像查看功能不可用

### 问题现象

- 在会诊详情页点击"查看影像"，或 Studies 页面点击查看 OHIF Viewer
- 浏览器跳转到 `/ohif/viewer/:studyInstanceUid` 后显示 `"Sorry, this page does not exist."`
- 页面完全白屏，无任何 DICOM 影像加载

### 根因分析

| 原因 | 说明 |
|------|------|
| **OHIF v3 配置格式不兼容** | 本地使用的 `ohif/viewer:latest` Docker 镜像已升级到 v3 版本。v3 使用 `dataSources` 格式定义 DICOMWeb 数据源，但 `app-config.js` 中只有 v2 的 `servers.dicomWeb` 格式，OHIF v3 无法识别，导致找不到数据源而白屏 |
| **StudyInstanceUID 字段为空** | 数据库中 `StudyInstanceUID` 字段在导入 DICOM 时未填充，前端构造 OHIF URL 时使用空值或错误的 UUID（Orthanc 内部 ID 而非 DICOM 标准 UID），OHIF 无法定位检查 |

### 解决方案

| 措施 | 文件 | 说明 |
|------|------|------|
| 添加 OHIF v3 `dataSources` 配置 | [ohif-app-config.js](file:///Volumes/External/workspace/bksys2/deploy/ohif-app-config.js) | 同时保留 v2 `servers` 格式以兼容旧版本，新增 `dataSources` 数组定义 `dicomweb` 数据源 |
| 添加 DICOMWeb 检查端点 | [studies.ts](file:///Volumes/External/workspace/bksys2/backend/src/routes/studies.ts) | 新增 `GET /api/studies/dicomweb-check`，诊断 DICOMWeb 连通性 |
| 添加 StudyInstanceUID 回填端点 | [studies.ts](file:///Volumes/External/workspace/bksys2/backend/src/routes/studies.ts) | 新增 `POST /api/studies/backfill-uids` —— 遍历所有 study，调用 Orthanc REST API 查询 `StudyInstanceUID` 并回填数据库 |
| 添加 OHIF URL 自动解析端点 | [studies.ts](file:///Volumes/External/workspace/bksys2/backend/src/routes/studies.ts) | 新增 `GET /api/studies/:id/ohif-url` —— 自动从 Orthanc 获取 StudyInstanceUID 并构造正确 URL |
| 前端改为 API 解析 OHIF URL | [ConsultationDetail.tsx](file:///Volumes/External/workspace/bksys2/frontend/src/pages/ConsultationDetail.tsx) | 不再依赖本地 `studyInstanceUid` 字段，优先走后端 API 解析 |
| 同上 | [Studies.tsx](file:///Volumes/External/workspace/bksys2/frontend/src/pages/Studies.tsx) | 查看按钮点击时自动从后端获取正确 URL |
| 添加 CORS 头，优化 sub_filter | [nginx.conf](file:///Volumes/External/workspace/bksys2/deploy/nginx/nginx.conf) | 为 `/orthanc/` 代理添加 `Access-Control-Allow-Origin *` 等 CORS 头，确保 OHIF 跨域请求正常 |

### 验证方法

```bash
# 检查 DICOMWeb 状态
curl -k -H "Authorization: Bearer <token>" https://host:8443/api/studies/dicomweb-check

# 回填所有 StudyInstanceUID
curl -k -X POST -H "Authorization: Bearer <token>" https://host:8443/api/studies/backfill-uids
```

预期输出：
```json
{ "total": 5, "updated": 3, "failed": 0 }
```

---

## 问题2：ZIP 压缩包上传解压失败

### 严重级别

🔴 **致命** — 核心数据导入功能不可用

### 问题现象

- 在前端上传页面选择 `.zip` 文件（如 `Anonymized_20260515.zip`）后
- 系统提示：**"压缩包解压失败，请确认文件格式正确"**
- 影像数据无法入库，业务中断

### 根因分析

| 原因 | 说明 |
|------|------|
| **Python3 脚本编码错误** | 上传 ZIP 时，后端用 Python3 脚本解压文件。脚本对 CP437 编码的文件名执行 `raw.decode('utf-8', 'replace')`，但中文 Windows 系统打包的 ZIP 文件名是 GBK 编码，UTF-8 解码产生乱码，导致目录/文件名乱码，后续找 DICOM 文件失败。**修复**：改为 `raw.decode('gbk', 'replace')` |
| **回退链路脆弱** | Python3 失败后回退到 `unzip -O GB18030`，但绝大多数 Linux 发行版的 unzip 不支持 `-O` 选项，回退也失败，未留其他后路 |
| **DICOM 文件检测过于严格** | 仅检测偏移 128 处的 `DICM` 魔数，对某些匿名化工具修改过的文件头无法识别，遗漏有效 DICOM 文件 |
| **代码未部署到服务器** | 所有修改仅在本地 `/Volumes/External/workspace/bksys2/` 目录中，服务器上运行的一直是旧代码 |

### 解决方案

**核心思路：不再自行解压，改为直接利用 Orthanc 原生 ZIP 上传能力。**

Orthanc 官方文档确认 `POST /instances` 接口原生支持 `Content-Type: application/zip`，会自动解压并导入所有 DICOM 文件，完全绕过后端解压的编码问题。

| 措施 | 文件 | 说明 |
|------|------|------|
| **移除所有自解压逻辑**（~120行） | [studies.ts](file:///Volumes/External/workspace/bksys2/backend/src/routes/studies.ts) | 删除了 Python3 zipfile 解压、unzip 回退、tar 解压、DICOM 魔数检测、临时文件管理等所有代码 |
| **ZIP 直传 Orthanc** | [studies.ts](file:///Volumes/External/workspace/bksys2/backend/src/routes/studies.ts) | ZIP 文件原封不动以 `application/zip` 发送给 Orthanc，Orthanc 自行解压和导入 |
| **三层回退策略** | [studies.ts](file:///Volumes/External/workspace/bksys2/backend/src/routes/studies.ts) | ① Orthanc 原生 ZIP 上传（首选）→ ② Python3 解压（GBK 解码修复）→ ③ 回退未成功前的三层保底 |
| **消除 `UnicodeDecodeError`** | [studies.ts](file:///Volumes/External/workspace/bksys2/backend/src/routes/studies.ts) | 不再使用 `execSync`、`fs`、`os`、`path` 等模块做文件系统操作，移除了完全修复 Import |
| **详细错误日志** | [studies.ts](file:///Volumes/External/workspace/bksys2/backend/src/routes/studies.ts) | 添加 `[Upload]` 前缀日志，记录完整上传链路状态 |
| **一键部署脚本** | [deploy.sh](file:///Volumes/External/workspace/bksys2/deploy.sh) | 创建 `deploy.sh` 一键同步 + 构建 + 部署脚本 |

### 修复前后对比

```
▼ 修复前（脆弱，约200行）
前端上传 ZIP → 后端接收 → Python3/unzip 解压 → 查找 DICOM 文件 → 逐个上传到 Orthanc
                       ↑ ① GBK 编码出错 → "解压失败"
                       ↑ ② unzip -O 不支持 → "解压失败"
                       ↑ ③ DICOM 魔数检测不到 → "未找到DICOM文件"

▼ 修复后（简洁，约80行）
前端上传 ZIP → 后端接收 → 直接转发给 Orthanc (Content-Type: application/zip)
                       ↓ Orthanc 原生支持 ZIP 解压和导入
                       ↓ 理论上无任何编码问题
```

### 验证方法

```bash
# 直接上传 ZIP 到 Orthanc 测试
curl -s -X POST http://localhost:8042/instances \
  -H "Content-Type: application/zip" \
  --data-binary @test.zip

# 通过 HTTPS 测试完整链路
curl -k -X POST https://host:8443/api/studies/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@test.zip"
```

预期输出：
```json
{
  "success": true,
  "totalFiles": 29,
  "successCount": 29,
  "failCount": 0,
  "studiesCreated": 2,
  "message": "压缩包上传完成：29个文件成功导入，2个检查"
}
```

后端日志应显示：
```
[Upload] ZIP file: test.zip, size: 12345678 bytes
[Upload] Orthanc accepted ZIP: 29 instances imported
```

---

## 问题3：影像检查检索栏交互体验差

### 严重级别

🟡 **中等** — 影响使用效率但不阻塞核心功能

### 问题现象

- 影像检查页面原有的搜索栏包含：类型下拉选择框 + 搜索输入框
- 搜索只能按患者 ID 精确匹配，无法模糊搜索姓名、描述等信息
- 用户反馈"不好用"，希望和患者管理页面的简洁搜索栏一致

### 根因分析

| 原因 | 说明 |
|------|------|
| **搜索功能过于单一** | 仅支持 `?patientId=` 精确匹配，不支持模糊搜索 |
| **类型下拉选择框使用率低** | 用户很少需要按 modality 筛选，占用了页面空间 |
| **下拉建议列表增加复杂度** | 第一次重构时加了带建议的下拉列表，但用户觉得太复杂、不好用 |

### 解决方案

| 措施 | 文件 | 说明 |
|------|------|------|
| 后端添加 `search` 参数模糊搜索 | [studies.ts](file:///Volumes/External/workspace/bksys2/backend/src/routes/studies.ts) | 支持按患者姓名、患者ID、检查描述、Orthanc ID、StudyInstanceUID、Modality 模糊匹配 |
| 搜索栏改为前端即时过滤 | [Studies.tsx](file:///Volumes/External/workspace/bksys2/frontend/src/pages/Studies.tsx) | 加载全部数据后前端 `filter`，输入即出，无需每次请求后端 |
| 取消模态弹出下拉列表 | [Studies.tsx](file:///Volumes/External/workspace/bksys2/frontend/src/pages/Studies.tsx) | 取消弹出下拉建议，改为和患者管理页面一样的简单输入框 |
| 搜索 pattern | [Studies.tsx](file:///Volumes/External/workspace/bksys2/frontend/src/pages/Studies.tsx) | `name.includes(q)` / `patientId.includes(q)` / `modality.includes(q)` / `description.includes(q)` |
| 取消类型下拉框 | [Studies.tsx](file:///Volumes/External/workspace/bksys2/frontend/src/pages/Studies.tsx) | 移除 `<select modality>`，类型标签作为 Badge 合并到患者列 |
| 调整列表展示 | [Studies.tsx](file:///Volumes/External/workspace/bksys2/frontend/src/pages/Studies.tsx) | 列改为：患者（类型Badge + 姓名 + ID）、检查日期、描述、系列数、操作 |

---

## 问题4：会诊详情页面进入后白屏

### 严重级别

🔴 **致命** — 核心业务入口不可用

### 问题现象

- 从会诊列表点击某个会诊项后，进入 `会诊详情` 页面
- 页面完全白屏，无任何内容渲染
- 后端 API 返回正常（200），前端 JS 文件加载正常

### 根因分析（部分诊断中）

| 可能原因 | 状态 | 说明 |
|----------|------|------|
| **前端 `@livekit/components-react` 运行时异常** | ⚠️ 待确认 | `LiveKitRoom` 组件在某些场景下（如 serverUrl 解析失败、token 无效）会抛出未捕获异常，页面无 ErrorBoundary 拦截 |
| **前端构建产物与代码不一致** | ⚠️ 已发现 | 用户访问时加载的是旧版本 JS 文件 `index-Bf7vRcb9.js`，最近更新的代码未实际部署或浏览器缓存未清除 |
| **React 渲染异常未被捕获** | ⚠️ 已确认 | 项目中无 `ErrorBoundary` 组件，任何渲染异常都会导致整个页面白屏 |

### 当前处理

| 措施 | 说明 |
|------|------|
| 确认后端 API 正常 | `GET /api/consultations/:id` 返回 200，数据完整 |
| 确认前端路由正常 | `/consultations/2` 返回 SPA index.html（200） |
| 确认接口定义匹配 | 后端返回的 `study`、`patient`、`participants` 等字段与前端 TypeScript 接口一致 |
| 发现 JS 缓存问题 | 用户浏览器加载的是旧版本 `index-Bf7vRcb9.js`，需强制刷新 |

### 待完成项

- [ ] 在前端添加全局 `ErrorBoundary` 组件，防止单组件异常导致全页白屏
- [ ] 排查 `LiveKitRoom` 组件在 serverUrl/token 无效时的异常处理
- [ ] 确保前端构建后的 Nginx 侧添加 `Cache-Control` 头，防止浏览器缓存旧版本 JS

---

## 问题5：代码修改未同步到服务器 / 构建部署流程问题

### 严重级别

🔴 **致命** — 贯穿所有问题的元问题

### 问题现象

- 本地做了大量代码修改
- 用户反复反馈"还是同样的问题"
- 最终检查发现服务器 `115.29.203.40` 上运行的是旧代码

### 根因分析

| 原因 | 说明 |
|------|------|
| **本地开发与服务器部署脱节** | 修改代码后缺少部署步骤，修改仅存在于 `/Volumes/External/workspace/bksys2/` 本地目录 |
| **rsync 排除了 `.zip` 文件** | 测试 ZIP 文件被 `*.zip` 规则排除，导致服务器上无测试文件 |

### 解决方案

| 措施 | 文件 | 说明 |
|------|------|------|
| 创建一键部署脚本 | [deploy.sh](file:///Volumes/External/workspace/bksys2/deploy.sh) | rsync 同步 → docker compose build → up -d 重启 |
| 统一部署命令 | deploy.sh | `rsync`（排除 build artifacts）→ `docker compose build` → `docker compose up -d` → `docker compose restart nginx` |

### 部署步骤

```bash
# 一键部署
./deploy.sh

# 或手动
rsync -avz --exclude='node_modules' --exclude='.git' --exclude='*.zip' ... /Volumes/External/workspace/bksys2/ root@host:/root/bksys2/
ssh host "cd /root/bksys2/deploy && docker compose build backend frontend && docker compose up -d"
```

---

## 问题6：Dockerfile npm ci 构建失败

### 严重级别

🟡 **中等** — 影响构建流程

### 问题现象

- 在服务器上执行 `docker compose build backend` 时
- `npm ci` 阶段报错退出，构建失败

### 根因分析

| 原因 | 说明 |
|------|------|
| `npm ci` 要求精确版本匹配 | Mac (ARM64) 上 `npm install` 生成的 `package-lock.json` 在 Linux (AMD64) Docker 容器中可能存在架构依赖不匹配，`npm ci` 严格检查 lock 文件一致性 |

### 解决方案

| 措施 | 文件 | 说明 |
|------|------|------|
| `npm ci` → `npm install` | [Dockerfile](file:///Volumes/External/workspace/bksys2/backend/Dockerfile) | `npm install` 容忍 lock 文件差异，自动适配平台 |
| 同上（生产阶段） | [Dockerfile](file:///Volumes/External/workspace/bksys2/backend/Dockerfile) | `npm ci --omit=dev` → `npm install --omit=dev` |

---

## 全量修改文件清单

| 文件 | 修改类型 | 关联问题 |
|------|----------|----------|
| [deploy/ohif-app-config.js](file:///Volumes/External/workspace/bksys2/deploy/ohif-app-config.js) | 新增 `dataSources` 配置 | 问题1 |
| [deploy/nginx/nginx.conf](file:///Volumes/External/workspace/bksys2/deploy/nginx/nginx.conf) | 添加 CORS 头、sub_filter 优化 | 问题1 |
| [backend/src/routes/studies.ts](file:///Volumes/External/workspace/bksys2/backend/src/routes/studies.ts) | 重大重构 | 问题1、问题2、问题3 |
| [frontend/src/pages/Studies.tsx](file:///Volumes/External/workspace/bksys2/frontend/src/pages/Studies.tsx) | 搜索栏重构 + OHIF URL 改进 | 问题1、问题3 |
| [frontend/src/pages/ConsultationDetail.tsx](file:///Volumes/External/workspace/bksys2/frontend/src/pages/ConsultationDetail.tsx) | 新增 API 解析 OHIF URL | 问题1、问题4 |
| [frontend/src/i18n/locales/zh.json](file:///Volumes/External/workspace/bksys2/frontend/src/i18n/locales/zh.json) | 更新搜索栏占位符文案 | 问题3 |
| [backend/Dockerfile](file:///Volumes/External/workspace/bksys2/backend/Dockerfile) | `npm ci` → `npm install` | 问题6 |
| [deploy.sh](file:///Volumes/External/workspace/bksys2/deploy.sh) | 新增一键部署脚本 | 问题5 |

---

## 附录：部署后验证清单

```bash
# 1. 所有容器正常运行
docker compose ps

# 2. HTTPS 可达
curl -k -s -o /dev/null -w "%{http_code}" https://host:8443/
# 预期: 200

# 3. DICOMWeb 接口可用
curl -k -s "https://host:8443/orthanc/dicom-web/studies?limit=1"
# 预期: QIDO-RS 格式 JSON

# 4. 回填 StudyInstanceUID
curl -k -X POST "https://host:8443/api/studies/backfill-uids"

# 5. ZIP 上传测试
curl -k -X POST "https://host:8443/api/studies/upload" \
  -H "Authorization: Bearer <token>" \
  -F "file=@test.zip"
# 预期: Orthanc accepted ZIP: N instances

# 6. 模糊搜索测试
curl -k "https://host:8443/api/studies?search=蔡" \
  -H "Authorization: Bearer <token>"
# 预期: 返回匹配结果
```
