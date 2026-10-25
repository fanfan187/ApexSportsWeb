# ApexSportsWeb · 顶点体育（前端）

> **Apex 系列前端项目**：一个高校运动会场景下的综合管理平台（赛事、报名、赛程、成绩、积分排名），与配套后端项目（[ApexSports](https://github.com/fanfan187/ApexSports)）共同构成完整的 Apex 体系。
>
> 本项目的定位：**为验证一套后端架构规范而生的配套前端**。后端的分层设计（Controller → Service → Logic → DAO → Mapper + Cache）、统一响应结构、业务错误码与数据载体（VO / DTO / DO）契约，都在本前端中得到了一一对应的落地实现。
>
> 📖 配套博文：[《从分层混乱到职责分明：一套后端架构规范的完整走读》](https://blog.fanfan187.cn/posts/c9b03e21.html)

## ✨ 技术栈

| 类别 | 选型 | 说明 |
|------|------|------|
| 框架 | Vue 3.5+（Composition API + `<script setup>`） | 与 Spring Boot 形成现代搭配 |
| 构建工具 | Vite 6 | 极速 HMR，原生 ESM |
| 语言 | TypeScript 5.7 | 全量类型覆盖，`vue-tsc` 类型检查 |
| UI 组件库 | Ant Design Vue 4.x | 参考 Ant Design Pro 风格，中文本地化 |
| 状态管理 | Pinia 2 | Vue 3 官方推荐 |
| HTTP 客户端 | Axios | 拦截器统一处理 Token 注入与响应解包 |
| 路由 | Vue Router 4 | 导航守卫 + 角色权限控制 |
| 样式 | Less | 与 Ant Design Vue 的 Less 体系保持一致 |
| 测试 | Playwright | E2E 冒烟 + 全量回归 |

## 🧩 功能模块

| 模块 | 路由 | 说明 |
|------|------|------|
| 登录认证 | `/login` | JWT 登录，支持登录后回跳 `redirect` |
| 首页概览 | `/dashboard` | 数据看板 |
| 学院管理 | `/college` | 学院 CRUD |
| 运动员管理 | `/athlete` | 运动员 CRUD |
| 用户管理 | `/user` | 仅管理员（`requiredRole: 1`）可见 |
| 比赛项目管理 | `/event` | 赛事项目 CRUD |
| 裁判管理 | `/referee` | 裁判 CRUD |
| 场地管理 | `/venue` | 场地 CRUD |
| 器材管理 | `/equipment` | 器材 CRUD |
| 个人报名 | `/registration/individual` | 个人赛事报名 |
| 团体报名 | `/registration/team` | 团体赛事报名 |
| 赛程管理 | `/schedule`、`/schedule/booklet`、`/schedule/:id` | 赛程安排、秩序册、场次详情 |
| 成绩管理 | `/score`、`/score/batch`、`/score/detail/:competitionId` | 成绩录入 / 批量录入 / 详情 |
| 积分排名 | `/ranking`、`/ranking/:collegeId` | 学院积分排名与详情 |
| 历史记录 | `/record` | 历史记录查询 |

## 🏗️ 前端架构：与后端契约互为镜像

本前端的架构设计严格对齐后端的架构规范，核心链路如下：

```
视图（views/）
  → 组合式函数（composables/）→ API 层（api/，Axios 实例）
    → 请求拦截器（注入 JWT）
      → 后端 Controller → Service → Logic → DAO → Mapper + Cache
    ← 响应拦截器（解包 { code, message, data }）
  ← 视图渲染（VO 数据，无敏感字段）
```

### 关键设计

- **统一响应解包**（`src/utils/request.ts`）：响应拦截器自动解包后端 `Result<VO>` 结构（`{ code, message, data }`），业务代码只拿到 `data`。
- **业务错误码对齐**：与后端 `ErrorCode` 枚举一一对应 —— `40101`（登录过期）自动清除凭证并跳转登录页，`40301`（无权限）给出友好提示，其余错误统一 toast。
- **认证与路由守卫**（`src/router/index.ts`）：全局 `beforeEach` 校验 Token；白名单（登录 / 403 / 404）之外的页面未登录自动跳转 `/login?redirect=...`；支持基于角色的路由级权限（`meta.requiredRole`）。
- **元素级权限指令**（`src/directives/permission.ts`）：`v-permission="1"` 控制元素仅管理员可见，优先读取 Pinia store，降级回退 `localStorage`。
- **CRUD 抽象**（`src/composables/useCrud.ts`）：分页查询（`records` / `total`，对齐后端 `PageResult`）、增删改与确认弹窗统一收敛到一个组合式函数，各管理页面只需注入对应的 API 即可复用。
- **API 分层**（`src/api/`）：14 个模块的 API 定义与 TypeScript 类型集中管理，视图层不直接拼 URL。

### 目录结构

```
src/
├── api/              # 各模块 API 定义与类型（14 个模块）
├── assets/           # 静态资源
├── components/       # 通用组件
├── composables/      # 组合式函数（useCrud 分页 CRUD 抽象）
├── directives/       # 自定义指令（v-permission 权限指令）
├── layouts/          # 布局（AdminLayout 管理后台布局）
├── router/           # 路由与全局守卫（Token 校验 + 角色权限）
├── stores/           # Pinia 状态管理（user 登录态）
├── styles/           # Less 全局样式与设计令牌（variables.less）
├── utils/            # Axios 封装（拦截器：JWT 注入 + 响应解包）
├── views/            # 页面（15 个业务模块）
├── App.vue
└── main.ts
```

## 🚀 快速开始

### 环境要求

- Node.js ≥ 18（或 [Bun](https://bun.sh)）
- 配套后端服务运行于 `http://localhost:8080`（开发环境通过 Vite 代理 `/api` 转发）

### 安装与启动

```bash
# 使用 Bun（推荐）
bun install
bun run dev          # http://localhost:5173

# 或使用 npm
npm install
npm run dev
```

### 环境变量

| 文件 | 变量 | 说明 |
|------|------|------|
| `.env` | `VITE_APP_TITLE` | 应用标题 |
| `.env.development` | `VITE_API_BASE_URL=/api` | API 基础路径（经 Vite 代理转发至 `localhost:8080`） |

### 生产构建

```bash
npm run build        # vue-tsc 类型检查 + vite 打包，产物输出至 dist/
npm run preview      # 本地预览生产构建
npm run type-check   # 仅执行类型检查
```

## 📚 相关文档

- 配套后端仓库：[ApexSports](https://github.com/fanfan187/ApexSports)
- [后端架构规范博文（16k 字完整走读）](https://blog.fanfan187.cn/posts/c9b03e21.html)

## 👤 作者

**翻翻（fanfan187）** · [博客 - 杜松子酒](https://blog.fanfan187.cn)
