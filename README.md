# 青账与衡序：两个独立项目

| 项目 | 目录 | 用途 |
| --- | --- | --- |
| 青账 QingZhang | `apps/qingzhang` | 个人收支、预算、账户、笔记与生活工具 |
| 衡序 HENGXU | `apps/hengxu` | 客户、项目经营、分期回款、交付清单与 AI 经营助手 |

两个目录分别包含 package.json、锁文件、源码、数据库结构、迁移、配置、说明与验证脚本。没有跨项目源码引用；可以单独复制任一目录安装和运行，无须另一个项目，也不使用共享 node_modules 或共享数据库。

## 安装与运行

在需要的项目目录执行：

```sh
npm ci
npm run build
npm run db:init
npm run dev
```

`db:init` 仅用于新数据库，不能重复对已有业务数据库运行；已有数据库只执行尚未应用的迁移。青账开发端口5173，衡序5174。生产预览可分别使用 `npm start -- --port 5189` 和 `npm start -- --port 5188`。

也可以在仓库根目录使用 `npm run build:qingzhang`、`npm run build:hengxu` 等快捷命令。根目录不安装业务依赖。

## 数据与部署

衡序已独立部署到 https://yiwei.icu/hengxu/ （106.15.1.208），原账号已迁移，个人账本数据未迁移。青账和旧混合站点仍保留原样。新旧衡序不自动同步，后续经营记录请使用新地址。部署和维护见 [部署说明](DEPLOYMENT.md)。

各自登录 Cookie、持久化目录和 AI 配置独立。独立部署后的新注册账号不自动共享。已有账号可在迁移时保留密码哈希，用户不需要重新设置密码，但需重新登录。

历史本地 `.wrangler/state` 仍保留在仓库根目录的忽略目录；新项目的数据库位于各自目录内，不会自动覆盖或读取历史数据。所有状态、密钥、备份和依赖均不纳入 Git。

## 验证

```sh
npm run check:boundaries
npm --prefix apps/qingzhang run typecheck
npm --prefix apps/qingzhang run build
npm --prefix apps/hengxu run typecheck
npm --prefix apps/hengxu run build
```

每个应用的说明和测试见其自身 README。

同时启动青账5189与衡序5188后，可运行 `python scripts/check-independent-apps.py` 验证两个应用的账号、Cookie和接口隔离。

衡序可独立交付到 `D:\记账制作\衡序`。运行 `python scripts/export-hengxu.py` 导出干净源码；目标必须为空，已有工作不会被覆盖。该目录与仓库中的 `apps/hengxu` 是独立副本，后续修改请明确选择一个工作目录，避免两边同时编辑。
