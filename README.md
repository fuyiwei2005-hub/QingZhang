# 青账 QingZhang

支持手机和电脑的个人记账应用，同一账号同步收支、预算、账户与笔记。

## 功能

- 注册登录、账号数据隔离。
- 收支记录、小数与四则运算、组合搜索筛选、按月和周查看明细。
- 历史收支统计、支出饼图、分类排行、月总预算与分类预算。
- 微信、支付宝、银行卡、现金账户及账户转账。
- 周期账单、笔记、标签、置顶和待办事项。
- 回收站、CSV 导出、数据库备份与管理员恢复。
- 手机适配；账目、分类预算及待办采用连续单列展示。

## 技术栈

React 19、TypeScript、Vinext / Vite、Tailwind CSS 4、Drizzle ORM、Cloudflare D1。本地和现有服务器通过 Wrangler 使用持久化 SQLite 数据。

## 本地运行

需要 Node.js 22.13 或以上、npm。

```sh
npm ci
npm run build
```

首次启动前，按顺序执行 drizzle 中的五个 SQL 文件，每个只执行一次。例如：

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_green_ledger.sql
```

对以下文件依次执行同一命令，替换末尾文件名：

1. `0001_app_accounts.sql`
2. `0002_uneven_puppet_master.sql`
3. `0003_handy_warlock.sql`
4. `0004_ambiguous_daimon_hellstrom.sql`

然后运行：

```sh
npm run dev -- --port 5175
```

打开终端显示的地址并注册自己的青账账号。预览工具模拟身份不代替应用登录。

## 检查与生产预览

```sh
npx tsc --noEmit
npm run build
npm start -- --port 5176
```

子路径部署在构建前设置 QINGZHANG_BASE_PATH，例如 Linux 下：

```sh
QINGZHANG_BASE_PATH=/qingzhang npm run build
```

PowerShell 下先设置 `$env:QINGZHANG_BASE_PATH='/qingzhang'`，再执行构建。

## 目录与数据

- `app/`：页面、交互组件和 API。
- `lib/`：账目规则、金额计算、筛选及公共工具。
- `db/`、`drizzle/`：数据结构和迁移。
- `public/`：图标、Manifest、Service Worker。
- `build/`、`.openai/`：构建支持和本地数据库绑定，运行所必需。
- `scripts/`：运行支持、检查、备份与恢复工具。
- `deployment/`：自动备份服务配置。

依赖、构建产物、临时部署包、真实数据库和环境密钥不进入仓库。`.wrangler/state/` 包含业务数据，更新代码时必须保留。

API 检查脚本会创建临时账号，运行前阅读脚本并使用测试数据库。部署和恢复方法见 [DEPLOYMENT.md](DEPLOYMENT.md)。
