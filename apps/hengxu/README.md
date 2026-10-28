# 衡序 HENGXU · 商务经营工作台

线上地址：https://yiwei.icu/hengxu/ 。独立部署到106.15.1.208，维护说明见 [deployment/README.md](deployment/README.md)。

面向自由职业者、独立开发者与学生创业团队的独立经营应用：客户、项目、分期回款、实际收支、交付清单与 AI 经营助手。经营总览只展示核心指标及趋势。

## 独立运行

需要 Node.js 22.13 或以上。此目录可单独复制，不需要青账源码或依赖。

```sh
npm ci --include=dev
npm run build
npm run db:init
npm run dev
```

开发端口5174；生产预览 `npm start -- --port 5188`。首次初始化只执行一次；数据位于本目录 `.wrangler/state`。独立8张表，不包含个人账本、预算、生活工具等数据表。用户注册和登录使用衡序自己的数据库与 hengxu_session Cookie。

## AI 与部署

默认不启用AI。服务器创建 hengxu 系统账号后，可交互运行 `python3 scripts/configure-ai.py` 隐藏输入密钥；配置保存在 `/etc/hengxu/ai.env`，由本项目启动脚本读取，也可通过 HENGXU_AI_ENV_FILE 指定其他安全文件。不要把密钥发到前端或放进Git。

AI将文字或图片整理为草稿，逐条核对后入账；查询由系统按当前账号数据汇总。草稿24小时内可确认，最多30笔。模型不能自动改账、发消息或触发支付。

部署到域名根路径直接 `npm run build`。部署到已有路径时使用 `HENGXU_BASE_PATH=/hengxu npm run build`，再将该路径的所有页面、静态资源与API交给此独立服务。与其他应用使用不同端口、目录和数据库。不得直接覆盖仍在使用的旧混合服务，须先按仓库迁移说明备份与迁移数据。

## 验证

```sh
npm run typecheck
npm run build
node scripts/check-studio.mjs
python scripts/check-studio-api.py --base-url http://127.0.0.1:5188
```

API测试仅使用临时账号并清理自身数据，不调用付费模型。`--live-ai` 可在已配置AI的测试环境使用合成输入联调。示例数据不代表真实用户、真实收入或真实经营成果。

## 独立源码目录

完整项目可以放在任意单独文件夹运行，包含前后端、数据库迁移和部署文件，不引用青账代码。本次独立源码交付目录为 `D:\记账制作\衡序`。`源码清单.json` 记录交付文件的 SHA-256，便于核对版本。

交付目录不包含账号数据、AI密钥、依赖缓存或构建产物。按上面的独立运行步骤安装即可；接入现有线上账号数据时请遵循部署说明，不能使用空数据库覆盖线上数据。

本轮优化：总览按选定月份标注范围；项目、客户、收支筛选提供无结果提示和重置；收支导出与当前筛选一致；编辑回款时正确显示可登记金额；AI处理中阻止误关弹窗；手机筛选区重新布局。数据库自动备份会关闭连接后再发布快照，避免残留临时日志文件。

备份验证：`python scripts/check-backup.py`。
