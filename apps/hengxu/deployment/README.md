# 衡序线上部署

- 地址：https://yiwei.icu/hengxu/
- 服务器：106.15.1.208，目录 `/opt/hengxu`。
- 独立账号/服务：hengxu，内部监听 `127.0.0.1:5188`。
- 运行入口：`scripts/start-server.mjs`；AI配置 `/etc/hengxu/ai.env`，权限600，不进入仓库。
- 数据：`/opt/hengxu/.wrangler/state`。不要删除、重新初始化或被开发数据库覆盖。
- Nginx只在已有HTTPS站点中新增 `/hengxu/` 路径；IP访问此路径跳转到有效HTTPS域名。已有网站根路径和代理继续保留。配置修改前备份在 `/var/backups/hengxu-deploy`。

## 更新

上传此项目源码到独立目录后，先备份，再更新依赖与构建。保留数据库和AI配置。

```sh
cd /opt/hengxu
python3 scripts/backup-database.py --state .wrangler/state --output /var/backups/hengxu
npm ci --prefer-offline
HENGXU_BASE_PATH=/hengxu npm run build
chown -R hengxu:hengxu dist
systemctl restart hengxu
systemctl is-active hengxu
```

数据库升级只执行新增迁移，不能再次运行 `db:init`。首次安装或其他代码目录不要覆盖当前状态。

## 备份

`hengxu-backup.timer` 每天北京时间03:20之后五分钟内生成一致性快照，保留30天，文件权限600。目录 `/var/backups/hengxu` 仅root访问。本机备份不等于异地备份。

## 迁移与验证

`export-legacy-business.py` 只导出共享账号和 studio_* 经营记录，不导出 sessions、个人账目、笔记或生活工具。迁移时应先限制旧站写入，并核对账号数、记录数和金额合计；当前旧站保留，不会与新站自动同步。

本次部署验证：独立构建、账号及业务数据完整性、业务API隔离与事务校验、AI真实草稿及系统问账、HTTPS页面、旧站根路径仍返回200。测试使用临时账号，完成后清理。
