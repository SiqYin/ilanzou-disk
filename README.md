# ilanzou-disk（蓝奏云优享盘）

蓝奏云·优享版（ilanzou.com）的第三方 Windows 桌面客户端。基于 Electron + React 构建。

> ⚠️ **本客户端对接的是蓝奏云「优享版」**（ilanzou.com，与手机 App 同账号体系）。
> 如果你用的是「普通版」（lanzou.com / woozooo.com），请使用 [lanzouyun-disk](https://github.com/SiqYin/lanzouyun-disk)。
> 两个产品的账号、文件、接口完全不互通。

## 功能（v0.1.0）

- **账号登录 / 注册**：原生界面，调用优享版官方接口（手机号 + 密码，注册支持短信验证码）
- **我的网盘**：内嵌优享版官方网页版，支持文件列表、上传、下载、分享管理（登录态自动注入）
- **分享链接解析**：粘贴 `https://www.ilanzou.com/s/xxx` 链接（支持提取码），列出文件并批量下载
- **下载引擎**：多任务队列、暂停/恢复、进度显示、完成列表
- **海外网络优化**：HTTP 代理支持（设置页配置），30 秒请求超时

## 技术说明

本项目通过逆向优享版网页端（Vue SPA）的公开接口实现，非官方客户端：

- API base：`apis.ilanzou.com`，RESTful JSON
- 请求签名：AES-128-ECB（密钥取自官方前端代码 `lanZouY-disk-app`），输出大写 hex
- 登录态：`appToken` 请求头
- 详见 `src/common/ilz/` 源码

**声明**：本项目仅供学习交流与个人使用，请勿用于商业用途。所有接口权利归蓝奏云官方所有。若官方提出异议，本项目会及时停止维护。使用本项目产生的任何问题与作者无关。

## 开发

```bash
yarn install
yarn start        # 开发模式
yarn build        # 构建渲染层 + 主进程
cd app && yarn build   # 打包 Windows 安装包
```

## 已知限制 / Roadmap

- [ ] 文件管理目前以内嵌网页方式提供，后续版本计划原生化（文件列表/上传/转存接口逆向中）
- [ ] 登录后的接口参数细节（分页/排序字段）需要更多真实账号实测反馈
- [ ] 优享版的「服务端转存」接口已定位（`/proved/file/transfer`），计划在原生文件管理中提供一键转存分享文件

## 反馈

登录或使用遇到问题时，请携带界面上的提示文字（含括号内的错误码）[提 Issue](https://github.com/SiqYin/ilanzou-disk/issues)。
