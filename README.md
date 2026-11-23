<h1 align="center">Xueness Marketplace</h1>

<p align="center"><b>官方可选插件：源码、界面与下载包。</b><br/>Official optional plugins for <a href="https://github.com/xuediner-source/xueness">Xueness</a>: source, interfaces and the packages the app downloads.</p>

---

Xueness 不预装这里的插件。用户在扩展市场里选择一个插件后，Xueness 才从本仓库的 `packages/` 下载它，校验整个包和每个文件的摘要，再安装到用户数据目录；之后在插件管理中启用。没有下载的插件不会出现在功能插件目录和模型列表里。

Xueness does not ship these plugins. When a user chooses one in the marketplace, Xueness downloads its package from `packages/` here, verifies the whole package and every file against the digests pinned in its own build, and installs it in the user's data folder; the user then enables it in plugin management.

## 插件 · Plugins

| 插件 | 作用 |
| :-- | :-- |
| [Magpie 模型网关](plugins/magpie) `magpie` | magpie 原版本机网关：API 密钥、订阅登录账号、路由组、额度与用量，模型进入会话 |
| [返回模型监测](plugins/model_monitor) `model_monitor` | 被动比较请求的型号与响应中报告的型号，不额外发送探测请求 |
| [酒馆](plugins/tavern) `tavern` | SillyTavern 兼容的角色卡、世界书、预设与人设；专用面板，对话以角色扮演模式运行 |

## 目录 · Layout

| 路径 | 内容 |
| :-- | :-- |
| `plugins/<id>/backend` | 后端：`manifest.json`、`package.json`、`src/`、`assets/`。在 Xueness 进程里运行，依赖 `@xueness/*` 核心包 |
| `plugins/<id>/frontend` | 界面：`entry.ts` 导出工作台挂载的组件 |
| `host/xueness-host.d.ts` | 工作台借给插件界面的接口（`@xueness/host` 第 1 版） |
| `packages/` | 按内容摘要命名的下载包 `<packageId>-<version>-<digest16>.json.gz` |
| `pins.json` | 最近一次构建的固定摘要，与 Xueness 的 `ts/packages/kernel/src/optional-packages.json` 相同 |
| `scripts/build.ts` | 构建界面、打包、写出固定摘要 |

插件界面构建成一个脚本 `optional-<id>.js`（和 `optional-<id>.css`）。它不自带 React：React、JSX 运行时和 `@xueness/host` 都由工作台在加载插件前提供。

The interface of each plugin is built into one classic script, `optional-<id>.js` (plus `.css`). It carries no React of its own: React, its JSX runtime and `@xueness/host` are provided by the workbench before it loads the plugin.

## 开发与发布 · Develop and release

构建和类型检查使用旁边的 Xueness 检出（`../xueness`）里的工具链和核心包，不需要单独安装依赖：

```sh
git clone https://github.com/xuediner-source/xueness.git
git clone https://github.com/xuediner-source/xueness-marketplace.git
cd xueness && npm --prefix ts ci && npm --prefix webapp ci && cd ..
cd xueness-marketplace
npm run check      # 后端与界面类型检查
npm run build      # 构建下载包和 pins.json
npm run release    # 同上，并把固定摘要写入 ../xueness
```

发布顺序：先提交并推送本仓库的 `packages/` 和 `pins.json`，再提交并推送 Xueness 里更新后的 `optional-packages.json`。反过来的话，新版 Xueness 会找不到它要下载的包。

旧的下载包不会被自动删除，因为已发布的 Xueness 版本固定的是它们各自的摘要；确认没有版本再使用后，可以用 `node scripts/build.ts --prune` 清理。

每个插件的 `backend/manifest.json` 和 `package.json` 必须与 Xueness 仓库里 `ts/plugins/<id>/` 下的描述完全一致，构建时会检查。

## 许可 · License

[Apache-2.0](LICENSE)。第三方组件见各插件目录（例如 `plugins/magpie/backend/assets/LICENSE-magpie.txt`）。
