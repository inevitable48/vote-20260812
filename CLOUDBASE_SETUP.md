# CloudBase 投票结果存储设置

环境 ID：`changhai-d3g5wjyhka349046a`

投票网页：`https://vote2-changhai-d3g5wjyhka349046a.webapps.tcloudbase.com`

## 1. 开启匿名登录

CloudBase 控制台 → 身份认证 / 登录方式 → 开启「匿名登录」。

## 2. 添加 Web 安全来源

CloudBase 控制台 → 环境配置 / 安全配置 / 安全来源，添加：

`vote2-changhai-d3g5wjyhka349046a.webapps.tcloudbase.com`

保存后等待配置生效。

## 3. 创建数据库集合

CloudBase 控制台 → 文档型数据库 → 新建集合：

`votes`

权限建议设为「仅管理员可读写」；网页客户端不直接读写该集合，所有写入都通过云函数完成。

## 4. 部署云函数 submitVote

仓库目录：

`cloudfunctions/submitVote/`

其中包含：
- `index.js`
- `package.json`

在 CloudBase 控制台创建普通云函数，函数名必须为：

`submitVote`

运行环境：Node.js 18

将上述目录中的文件上传/复制到函数代码中，并安装依赖后部署。

## 5. 重新部署 Web 应用

Web 应用 Git 仓库已经更新，重新触发一次 `main` 分支部署即可。

静态项目配置：
- 目标目录：`./`
- 安装命令：留空
- 构建命令：留空
- 构建产物目录：`.`
- 部署路径：`/`

## 6. 测试

用手机微信打开投票链接，先提交 1 份测试票。

随后在 CloudBase → 文档型数据库 → `votes` 集合中确认出现 1 条记录。

确认无误后再发群。

## 当前安全逻辑

- 前端截止：2026-08-15 23:59:59（北京时间）
- 服务端云函数也再次校验截止时间
- 候选人名单和候选人数由服务端固定校验
- 每位候选人必须选择“同意”或“不同意”
- 替代人选姓名与单位必须成对填写
- 匿名用户 UID 用于阻止同一匿名身份重复提交
- 浏览器 localStorage 再做一层重复提交提示
- `votes` 集合不向网页开放直接读写
