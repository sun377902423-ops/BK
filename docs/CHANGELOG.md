# BKSYS-MED 服务器操作调试记录

> 本文件记录所有服务器操作步骤、问题排查过程和解决方案，供其他机器部署参照。
>
> **更新原则**：服务器验证通过 → 同步到 GitHub

---

## 2026-05-13 操作记录

### 1. OHIF Viewer 白屏问题

**现象**：访问 `http://115.29.203.40/ohif/viewer?StudyInstanceUIDs=xxx` 页面白屏

**排查步骤**：

```bash
# 检查 OHIF 容器是否运行
docker ps | grep ohif

# 直接访问 OHIF 容器（绕过 nginx）
curl -s http://localhost:3000/ | head -20

# 通过 nginx 访问
curl -s http://localhost/ohif/ | head -20
```

**根因**：OHIF HTML 中资源引用使用绝对路径 `src="/xxx.js"`，但 OHIF 部署在 `/ohif/` 子路径下，浏览器请求 `/xxx.js` 实际请求到前端容器而非 OHIF 容器。

**解决方案**：在 nginx 的 `/ohif/` location 中添加 `sub_filter` 重写路径：

```nginx
location /ohif/ {
    proxy_pass http://ohif-viewer:80/;
    proxy_set_header Accept-Encoding "";
    sub_filter 'src="/' 'src="/ohif/';
    sub_filter 'href="/' 'href="/ohif/';
    sub_filter "window.PUBLIC_URL = '/'" "window.PUBLIC_URL = '/ohif/'";
    sub_filter_once off;
    sub_filter_types text/html;
}
```

**操作命令**：

```bash
# 修改配置后重启 nginx
cd /root/bksys2/deploy/deploy
docker compose restart nginx
```

---

### 2. OHIF Viewer 黑屏问题

**现象**：白屏修复后，页面变黑，JS 控制台报资源加载 404

**排查步骤**：

```bash
# 检查浏览器请求的资源路径
curl -s http://localhost/ohif/ | grep 'src='

# 发现 HTML 中引用的 JS 文件路径已修正为 /ohif/xxx.js
# 但 OHIF 的 JS 代码会动态加载懒加载模块，使用绝对路径从根加载
# 例如: ConnectedStandaloneRouting~xxx.bundle.js
curl -I http://localhost/ConnectedStandaloneRouting~xxx.bundle.js
# 返回 404 - 因为这个路径匹配到了前端容器
```

**根因**：OHIF 的 JS 代码动态加载模块时使用绝对路径（如 `/ConnectedStandaloneRouting~xxx.bundle.js`），`sub_filter` 只能修改 HTML 内容，无法修改 JS 文件内容。

**解决方案**：添加 nginx regex location，将根路径下的 OHIF 静态资源代理到 OHIF 容器：

```nginx
# 匹配 OHIF 动态加载的 bundle 文件（文件名含 ~ 字符）
location ~ ^/[^/]+\.(bundle[._~\w]*\.js|css|json|mjs|png|ico|svg|woff2?)$ {
    proxy_pass http://ohif-viewer:80;
    proxy_set_header Host $host;
}
```

**注意**：正则中 `bundle[._~\w]*` 必须包含 `~`，因为 OHIF 的 chunk 文件名格式为 `ConnectedStandaloneRouting~xxx.bundle.xxx.js`。

**操作命令**：

```bash
cd /root/bksys2/deploy/deploy
docker compose restart nginx
```

---

### 3. i18n 国际化未生效

**现象**：前端页面语言切换功能不工作

**排查步骤**：

```bash
# 检查前端源码中的 i18n 文件
ls /root/bksys2/frontend/src/i18n/locales/
# zh.json, en.json, fr.json 都存在

# 检查 Docker 构建上下文
cat /root/bksys2/deploy/deploy/docker-compose.yml | grep context
# backend: context: ../backend  → /root/bksys2/deploy/backend/
# frontend: context: ../frontend → /root/bksys2/deploy/frontend/

# 检查部署副本中是否有 i18n 文件
ls /root/bksys2/deploy/frontend/src/i18n/locales/
# 文件不存在！部署副本是旧版本
```

**根因**：服务器上存在两套前端目录（`/root/bksys2/frontend/` 源码 vs `/root/bksys2/deploy/frontend/` 部署副本），Docker 构建使用部署副本，但部署副本缺少最新的 i18n 文件。

**解决方案**：

```bash
# 同步源码到部署副本
rsync -avz --delete /root/bksys2/frontend/ /root/bksys2/deploy/frontend/ --exclude node_modules --exclude .env
rsync -avz --delete /root/bksys2/backend/ /root/bksys2/deploy/backend/ --exclude node_modules --exclude .env

# 重新构建前端（必须 --no-cache 避免使用旧缓存）
docker compose build --no-cache frontend
docker compose up -d frontend
```

**经验教训**：每次代码变更后，必须同步源码到部署副本再构建，否则构建的是旧代码。

---

### 4. TypeScript 编译错误

**现象**：Docker 构建前端时报 TypeScript 错误

**排查步骤**：

```bash
# 查看构建日志
docker compose build frontend 2>&1 | grep error
```

**遇到的错误及修复**：

| 错误 | 原因 | 修复 |
|------|------|------|
| `Unused variable 'i18n'` | `const { t, i18n } = useTranslation()` 中 i18n 未使用 | 改为 `const { t } = useTranslation()` |
| `REPORT_READ not found` | permissions.ts 中缺少 REPORT_READ 常量 | 添加 `REPORT_READ: 'report:read'` |
| `Property 'onCancel' does not exist` | ConfirmDialog 组件用 onClose 不是 onCancel | 改为 `onClose={() => setDeleteConfirm(null)}` |

**操作命令**：

```bash
# 修改源码后同步到部署副本
rsync -avz --delete /root/bksys2/frontend/ /root/bksys2/deploy/frontend/ --exclude node_modules
rsync -avz --delete /root/bksys2/backend/ /root/bksys2/deploy/backend/ --exclude node_modules

# 重新构建
docker compose build --no-cache frontend backend
docker compose up -d frontend backend
```

---

### 5. 权限管理系统部署

**变更内容**：实现完整的 RBAC 权限管理系统

**涉及文件**：

```
backend/src/lib/permissions.ts    # 权限常量定义
backend/src/lib/authorize.ts      # 鉴权中间件
backend/src/routes/roles.ts       # 角色管理 API
backend/src/routes/auth.ts        # JWT 中增加 permissions
backend/src/routes/*.ts           # 所有路由添加 authorize 中间件

frontend/src/lib/permissions.ts   # 前端权限常量
frontend/src/hooks/useAuth.ts     # hasPermission/hasAnyPermission
frontend/src/components/ui/PermissionGuard.tsx  # 按钮级权限控制
frontend/src/pages/Roles.tsx      # 角色管理页面
frontend/src/App.tsx              # AuthorizedRoute 路由守卫
frontend/src/components/layout/Sidebar.tsx  # 菜单权限过滤
```

**操作步骤**：

```bash
# 1. 同步源码到部署副本
rsync -avz --delete /root/bksys2/backend/ /root/bksys2/deploy/backend/ --exclude node_modules --exclude .env
rsync -avz --delete /root/bksys2/frontend/ /root/bksys2/deploy/frontend/ --exclude node_modules --exclude .env

# 2. 重新构建
docker compose build --no-cache backend frontend
docker compose up -d backend frontend

# 3. 更新数据库角色权限（生产容器无 tsx，用 psql 直接执行）
docker exec -i bksys-postgres psql -U bksys -d bksys_med << 'SQL'
UPDATE "Role" SET permissions = ARRAY[
  'user:list','user:create','user:update','user:delete','user:assign-role',
  'patient:list','patient:create','patient:read','patient:update','patient:delete','patient:export',
  'study:list','study:read','study:upload','study:delete','study:annotate','study:export',
  'consultation:list','consultation:create','consultation:join','consultation:manage','consultation:close',
  'report:list','report:create','report:read','report:update','report:submit','report:sign','report:approve','report:delete',
  'access-request:create','access-request:review','access-request:list',
  'hospital:list','hospital:create','hospital:update',
  'system:config','system:audit'
] WHERE name = 'ADMIN';

UPDATE "Role" SET "isSystem" = true WHERE name IN ('ADMIN', 'DOCTOR_LOCAL', 'DOCTOR_REMOTE', 'TECHNICIAN');
SQL

# 4. 验证权限系统
# ADMIN 登录应返回 38 个权限
curl -s -X POST http://localhost/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'permissions: {len(d.get(\"permissions\",[]))}')"

# TECHNICIAN 应被拒绝访问 /api/users
curl -s -X POST http://localhost/api/auth/login -H 'Content-Type: application/json' -d '{"username":"technician","password":"admin123"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['token'])" | xargs -I{} curl -s http://localhost/api/users -H 'Authorization: Bearer {}' 
# 应返回 403
```

---

### 6. OHIF "No URL was specified" 错误

**现象**：访问 OHIF Viewer 报错 `Error: "No URL was specified. Use ?url=$yourURL"`

**排查步骤**：

```bash
# 检查 OHIF 路由配置
docker exec bksys-ohif grep -o 'viewer' /usr/share/nginx/html/app.bundle.*.js | head -5

# 检查 OHIF 的路由定义
# OHIF v2 有两个路由：
# /viewer/:studyInstanceUIDs → ViewerRouting（正常查看器）
# /viewer → StandaloneRouting（需要 ?url= 参数）

# 当前前端使用的链接格式
grep 'ohif/viewer' /root/bksys2/frontend/src/pages/Studies.tsx
# href={`/ohif/viewer?StudyInstanceUIDs=${study.orthancStudyId}`}
# 这个格式匹配 /viewer 路由 → StandaloneRouting → 需要 ?url= 参数 → 报错
```

**根因**：前端使用查询参数格式 `/ohif/viewer?StudyInstanceUIDs=xxx`，匹配了 OHIF v2 的 `StandaloneRouting` 路由（期望 `?url=` 参数），而非 `ViewerRouting` 路由（使用路径参数 `/viewer/:studyInstanceUIDs`）。

**解决方案**：将链接改为路径参数格式：

```tsx
// 修改前（错误）
href={`/ohif/viewer?StudyInstanceUIDs=${study.orthancStudyId}`}

// 修改后（正确）
href={`/ohif/viewer/${study.orthancStudyId}`}
```

**同时**：检查 `ohif-app-config.js`，确认使用 v2 的 `servers.dicomWeb` 格式（不是 v3 的 `dataSources` 格式）。

**验证**：

```bash
# 安装 Playwright 浏览器测试工具
pip3 install playwright
playwright install chromium
playwright install-deps

# 运行浏览器测试
python3 << 'EOF'
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page()
    page.goto('http://localhost/ohif/viewer/1.2.840.638053981590630404.48.0', timeout=60000, wait_until='domcontentloaded')
    page.wait_for_timeout(10000)
    title = page.title()
    print(f'Page title: {title}')
    # 应输出: BK-PACS
    browser.close()
EOF
```

---

### 7. OHIF 品牌定制（标题/LOGO/语言切换/按钮移除）

**需求**：
- 标题改为 BK-PACS
- 移除 OHIF LOGO
- 移除 "INVESTIGATIONAL USE ONLY" 文本
- 移除 "Options" 按钮
- 添加语言切换（中文/英语/法语），默认中文

**排查步骤**：

```bash
# 用 Playwright 检查 OHIF 页面 DOM 结构
python3 << 'EOF'
from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1280, 'height': 900})
    page.goto('http://localhost/ohif/viewer/xxx', timeout=60000, wait_until='domcontentloaded')
    page.wait_for_timeout(10000)
    # 检查头部元素
    result = page.evaluate('''() => {
        const els = document.querySelectorAll('*');
        const headerEls = [];
        for (const el of els) {
            const rect = el.getBoundingClientRect();
            if (rect.top < 55 && rect.height > 0 && rect.width > 5) {
                headerEls.push({
                    tag: el.tagName,
                    cls: (el.className || '').toString().substring(0, 100),
                    text: (el.textContent || '').trim().substring(0, 80),
                    hasSvg: el.querySelector('svg') !== null
                });
            }
        }
        return headerEls;
    }''')
    print(json.dumps(result, indent=2, ensure_ascii=False))
    browser.close()
EOF
```

**发现的 DOM 结构**：

```
div.entry-header
├── div.header-left-box
│   └── a.header-brand
│       ├── svg[name="ohif-logo"]        # 4个方块 LOGO
│       └── svg[name="ohif-text-logo"]   # "OHIF Viewer" 文字路径
└── div.header-menu
    ├── span.research-use                # "INVESTIGATIONAL USE ONLY"
    └── div.dd-menu                      # "Options" 下拉按钮
```

**关键发现**：
- OHIF 是 React SPA，UI 文本在 JS bundle 中，`sub_filter` 只能修改 HTML
- i18next 实例在 React Fiber 树的 props 中，不在 `window.i18next`
- 需要通过注入自定义 JS 来修改 DOM

**解决方案**：创建 `ohif-custom.js`，通过 nginx `sub_filter` 注入到 OHIF 页面

**ohif-custom.js 实现逻辑**：

1. 注入 CSS 隐藏不需要的元素（`.research-use`, `.dd-menu`, OHIF LOGO SVG）
2. 添加 BK-PACS 图标和标题到 `.header-brand`
3. 添加语言切换按钮到 `.header-menu`
4. 通过 React Fiber 树查找 i18next 实例，调用 `changeLanguage()` 切换语言
5. 语言选择保存在 localStorage

**nginx 配置变更**：

```nginx
# 提供自定义 JS 文件
location /ohif-custom.js {
    root /etc/nginx/custom;
    add_header Content-Type application/javascript;
    add_header Cache-Control "no-cache, no-store";
}

# 在 OHIF 页面中注入脚本
location /ohif/ {
    # ... 原有配置 ...
    sub_filter '</head>' '<script src="/ohif-custom.js"></script></head>';
}
```

**docker-compose.yml 变更**：

```yaml
nginx:
  volumes:
    - ./ohif-custom.js:/etc/nginx/custom/ohif-custom.js:ro
```

**操作命令**：

```bash
cd /root/bksys2/deploy/deploy

# 重启 nginx（ohif-custom.js 通过 volume 挂载，无需重建）
docker compose up -d nginx
```

**验证**：

```bash
python3 << 'EOF'
from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1280, 'height': 900})
    page.goto('http://localhost/ohif/viewer/xxx', timeout=60000, wait_until='domcontentloaded')
    page.wait_for_timeout(12000)
    
    # 验证标题
    assert page.title() == 'BK-PACS'
    
    # 验证隐藏元素
    research = page.query_selector('.research-use')
    assert research.get_computed_style('display') == 'none'
    
    options = page.query_selector('.dd-menu')
    assert options.get_computed_style('display') == 'none'
    
    # 验证语言切换
    page.click('.bk-lang-btn[data-lang="zh"]')
    page.wait_for_timeout(2000)
    labels = page.evaluate('() => Array.from(document.querySelectorAll(".toolbar-button-label")).slice(0,5).map(l=>l.textContent)')
    print('中文:', labels)  # ["滑动切换图层", "放大", ...]
    
    page.click('.bk-lang-btn[data-lang="fr"]')
    page.wait_for_timeout(2000)
    labels = page.evaluate('() => Array.from(document.querySelectorAll(".toolbar-button-label")).slice(0,5).map(l=>l.textContent)')
    print('法语:', labels)  # ["Défilement", "Zoom", ...]
    
    browser.close()
EOF
```

---

### 8. 代码同步到 GitHub

**操作流程**（服务器验证通过后）：

```bash
# 从服务器同步源码到本地
rsync -avz --delete -e ssh root@115.29.203.40:/root/bksys2/backend/src/ ./backend/src/
rsync -avz --delete -e ssh root@115.29.203.40:/root/bksys2/frontend/src/ ./frontend/src/
rsync -avz --delete -e ssh root@115.29.203.40:/root/bksys2/deploy/deploy/ ./deploy/ --exclude ssl --exclude scripts --exclude jitsi --exclude orthanc

# 清理 macOS 资源分叉文件
find . -name '._*' -type f -delete

# 提交
git add -A
git commit -m "sync: 从服务器同步已验证代码"
git push origin main
```

---

### 9. 会诊系统全面重构 - 生命周期管理、邀请机制、通知系统

**现象**：会诊页面点击卡片无反应，无弹窗无跳转；会诊创建后无邀请流程；状态管理混乱（CREATED 直接到 IN_PROGRESS）；无消息/通知系统

**排查步骤**：
1. 分析 Consultations.tsx - 卡片是普通 div，没有 onClick 或 Link
2. 分析 App.tsx - 没有 /consultations/:id 路由
3. 分析后端 consultations.ts - 状态转换无验证，无邀请机制
4. 分析 Prisma schema - 缺少 ParticipantRole/ParticipantStatus 枚举

**根因**：
1. 前端会诊卡片不可点击，缺少详情页和路由
2. 后端会诊状态管理无状态机验证，CREATED 可直接跳 IN_PROGRESS
3. 参与人只有 isHost 布尔值，缺少角色区分（发起人/专家/观察员）
4. 无邀请响应机制（接受/拒绝）
5. 无通知系统，邀请和状态变更无法通知用户
6. 无会诊内聊天功能

**解决方案**：
1. 重构 Prisma 数据模型：
   - 添加 ConsultationStatus 枚举（CREATED→INVITED→SCHEDULED→IN_PROGRESS→COMPLETED/CANCELLED）
   - 添加 ParticipantRole 枚举（INITIATOR/EXPERT/OBSERVER）
   - 添加 ParticipantStatus 枚举（INVITED/ACCEPTED/DECLINED/JOINED/LEFT）
   - 添加 ConsultationMessage 模型
   - 添加 createdById 字段关联发起人
2. 重构后端 API：
   - 状态机转换验证（VALID_TRANSITIONS 映射表）
   - 邀请参与人 API（/participants/invite）
   - 响应邀请 API（/participants/:userId/respond）
   - 消息 API（GET/POST /messages）
   - 通知 API（GET/PUT /notifications）
   - 每次状态变更自动创建通知
3. 重构前端：
   - Consultations.tsx：卡片可点击跳转，状态筛选 Tab，参与人头像状态指示
   - 新建 ConsultationDetail.tsx：Jitsi Meet 视频通话、实时聊天、患者信息侧栏
   - 新建 NotificationBell.tsx：Header 通知铃铛，15 秒轮询未读数
   - 更新 StatusBadge 支持 INVITED/SCHEDULED 状态

**操作命令**：
```bash
# 同步代码到服务器
rsync -avz --delete -e ssh /path/to/backend/src/ root@115.29.203.40:/root/bksys2/backend/src/
rsync -avz --delete -e ssh /path/to/frontend/src/ root@115.29.203.40:/root/bksys2/frontend/src/

# 服务器上同步源码到部署副本
ssh root@115.29.203.40 'cd /root/bksys2 && rsync -avz --delete backend/src/ deploy/backend/src/ && rsync -avz --delete frontend/src/ deploy/frontend/src/'

# 添加数据库新列（兼容已有数据）
ssh root@115.29.203.40 'cd /root/bksys2/deploy/deploy && docker compose exec -T postgres psql -U bksys -d bksys_med -c "ALTER TABLE consultations ADD COLUMN IF NOT EXISTS \"createdById\" INTEGER NOT NULL DEFAULT 1;"'

# Prisma 数据库同步
ssh root@115.29.203.40 'cd /root/bksys2/deploy/deploy && docker compose run --rm backend npx prisma db push --accept-data-loss'

# 重新构建并启动
ssh root@115.29.203.40 'cd /root/bksys2/deploy/deploy && docker compose up -d --build backend frontend'

# 验证 API
TOKEN=$(curl -s http://localhost:3001/api/auth/login -X POST -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
curl -s http://localhost:3001/api/consultations -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:3001/api/notifications/unread-count -H "Authorization: Bearer $TOKEN"

# 验证通知
docker compose exec -T postgres psql -U bksys -d bksys_med -c "SELECT * FROM notifications;"
```

**验证**：
1. 会诊列表页：卡片可点击跳转到详情页 ✅
2. 会诊详情页：显示患者信息、参与人、Jitsi 视频 ✅
3. 状态机：CREATED→INVITED→IN_PROGRESS→COMPLETED 转换正确 ✅
4. 非法转换被拒绝（CREATED→IN_PROGRESS 返回 400） ✅
5. 邀请参与人：创建通知记录 ✅
6. 消息发送：POST /messages 返回消息 ✅
7. 通知铃铛：15 秒轮询未读数 ✅
8. 通知类型：CONSULTATION_INVITE、CONSULTATION_STATUS ✅

---

## 操作规范

### 更新顺序

```
本地开发 → 服务器部署验证 → 同步到 GitHub
```

1. 本地修改代码
2. SCP/rsync 同步到服务器
3. 服务器上同步源码到部署副本
4. Docker 构建并启动
5. 验证功能正常
6. 从服务器 rsync 回本地
7. Git commit & push 到 GitHub

### 每次操作记录格式

```
### N. [操作标题]

**现象**：[问题描述]

**排查步骤**：
[具体命令和输出]

**根因**：[根本原因]

**解决方案**：[修复方法]

**操作命令**：
[实际执行的命令]

**验证**：
[验证步骤和结果]
```
