# 独立部署与安全迁移

衡序已于2026年10月27日独立部署到 `https://yiwei.icu/hengxu/`，服务器 `106.15.1.208`，目录 `/opt/hengxu`，服务 `hengxu.service`，内部端口5188。新增 `/hengxu/` 路径，现有网站根路径继续正常运行。原账号已迁移，未迁移个人账目、笔记及生活工具记录。每日备份已启用。维护见 `apps/hengxu/deployment/README.md`。

旧服务器的青账及混合版衡序保留，不与新站自动同步。以下是进一步拆分旧混合服务的参考步骤，不是新服务器的当前路由配置。

建议目标：青账 `/qingzhang/` → 独立青账服务；衡序 `/qingzhang/studio/` → 独立衡序服务。两个服务不同端口、目录、系统账号、SQLite 数据库及 AI 密钥配置。Nginx 的更具体 `/qingzhang/studio/` 与 `/qingzhang/studio` 路径须先于通用路径匹配；其他站点保持原配置。

## 切换顺序

1. 先完整备份旧数据库和Nginx配置，保留可回退的原服务。短暂停止写入后，再取得最终一致性快照。
2. 独立目录安装、构建、初始化空数据库。青账使用 `QINGZHANG_BASE_PATH=/qingzhang` 构建；衡序使用 `HENGXU_BASE_PATH=/qingzhang/studio` 构建。两边不要相互覆盖 dist。
3. 从快照复制 users 到两个库，保留用户ID、密码哈希和盐，不复制 sessions。复制个人记录到青账库；仅复制 studio_* 到衡序库。AI 请求不迁移。校验账号数、项目数、有效记录数及按账号的金额合计。
4. 配置独立 Cookie 和 AI。青账 Cookie 为 qingzhang_session，衡序为 hengxu_session；衡序读取 `/etc/hengxu/ai.env` 或 HENGXU_AI_ENV_FILE，青账仍使用自己的配置。不要把密钥写进代码或仓库。
5. 启动两个独立服务，先本机验证注册、旧账号登录、隔离、记录编辑和AI，再切换Nginx的两个路径。新服务账号必须能写入各自 dist 和 .wrangler/state。
6. 验证页面、静态文件、API、清单均落在对应路径；从此对两个数据库分别备份。旧数据库保留只读回退副本，不删除旧表。历史个人库中的 studio 表只作兼容存档，禁止通过后续迁移清除。

单独使用衡序时可直接在域名根路径构建，不设置 HENGXU_BASE_PATH。源码中的 API 路径与页面链接会跟随自己的基路径，不依赖原青账。
