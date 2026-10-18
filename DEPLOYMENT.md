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
