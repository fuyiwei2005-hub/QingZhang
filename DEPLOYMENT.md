# 部署与数据维护

当前架构为 Vinext Worker + Wrangler 本地 D1，通过 Nginx 提供 HTTPS。

## 构建与服务

服务器项目目录 `/opt/qingzhang`，系统服务 `qingzhang.service`，运行用户 `qingzhang`。更新源码后：

```sh
cd /opt/qingzhang
npm ci
QINGZHANG_BASE_PATH=/qingzhang npm run build
chown -R qingzhang:qingzhang dist
systemctl restart qingzhang
systemctl is-active qingzhang
```

服务启动命令为 `npm start -- --port 5176`，仅监听 `127.0.0.1`。Nginx 仅将专属 `/qingzhang/` 路径代理到该端口；保留同机其他站点和路由。

首次部署需按 README 顺序执行全部迁移；升级时只应用尚未执行的迁移。修改数据库前先备份。

**必须保留 `.wrangler/state/`**：其中的 SQLite 文件是实际账号和账目数据，不是可随意清理的缓存。不要将本地测试数据库覆盖到生产服务器。

查看运行日志：

```sh
journalctl -u qingzhang -n 100
```

## 自动备份

`deployment/` 提供 systemd 服务和定时器，每天北京时间 03:15 后五分钟内运行。备份工具生成一致性 SQLite 快照并保留最近 30 天文件。

备份目录 `/var/backups/qingzhang/` 权限 700，快照权限 600。备份和数据库不上传 Git；本机快照不等于异地备份。

```sh
systemctl list-timers qingzhang-backup.timer
journalctl -u qingzhang-backup.service -n 30
```

## 管理员恢复

恢复会覆盖全库，确认快照日期和影响后停止应用再执行：

```sh
systemctl stop qingzhang
python3 scripts/restore-database.py /var/backups/qingzhang/选定快照.sqlite --state /opt/qingzhang/.wrangler/state --backup-directory /var/backups/qingzhang --confirm
systemctl start qingzhang
```

恢复工具校验完整性及结构，覆盖前保存当前库快照。恢复后登录会话清除，用户需重新登录；仅支持与当前版本结构兼容的快照。

## AI 服务

AI 默认关闭。使用官方 DeepSeek 兼容 Chat Completions 接口，文字模型 `deepseek-v4-pro`，图片模型 `deepseek-flash`；官方目前将前者路由到新版 Flash，实际模型以服务商为准。

部署迁移 `0009_ai_requests.sql` 后，通过交互式隐藏输入配置密钥：

```sh
ssh -t root@47.117.66.214 "cd /opt/qingzhang && python3 scripts/configure-ai.py && systemctl restart qingzhang"
```

脚本将密钥存入 `/etc/qingzhang/ai.env`（服务用户可读，权限600）。启动脚本通过 Wrangler `--env-file` 读取，重新构建后仍保留。不要把密钥放在网页、Git 或终端参数中。可通过文件中的 `AI_ENABLED=false` 停用，修改后重启服务。

默认每用户每日20次、全站每日200次，每人同时1次，全站同时3次，单次输出最多6000 tokens、文本6000字、图片3MB、最多30笔。失败请求也占用尝试次数，防止无限重试产生费用。实际账单以 DeepSeek 为准，服务商控制台还应配置余额/预算限制。24小时后草稿不可确认，7天前的请求记录在下一次AI请求时清理；数据库备份仍按30天保留。

查询仅将问题、当前日期与分类/账户名称发送给模型，由网站按登录账号查询并计算。文字和图片在用户授权后发送给DeepSeek，原图不落盘；模型输出不能直接写库，必须逐条核对并确认。批次入账具有唯一来源标记，可撤销到回收站。当前查询支持一个日期范围与组合条件，比较和预测需拆成单个查询。

Nginx 的 `/qingzhang/` location 需允许至少5MB请求并设置75秒以上读取超时。其他站点保持原配置。

检查：`node scripts/check-ai.mjs`（模型请求使用模拟响应）；`python3 scripts/check-ai-api.py --base-url https://47.117.66.214/qingzhang`（仅临时账号，不发起模型调用）。真实识别需配置密钥后用测试账目验收。
