# Chat Cards（Ant Design X 版）

一个基于 Next.js 15 + React 19 + Ant Design X 的“聊天 UI 演示”项目，仅作为前端 UI 功能：

- 提供聊天主页面（/）
- 提供 OpenAPI 配置页面（/config），用户可粘贴 OpenAPI 规范、填写 Base URL 与 API Key（仅存本地）
- 聊天页支持“分享浮窗”，生成链接给他人一键进入（默认不包含 API Key）

## 快速开始

- 安装依赖（建议 pnpm）：
  - pnpm install
- 启动开发：
  - pnpm dev
- 构建与启动：
  - pnpm build && pnpm start

打开 http://localhost:3000 查看聊天页面；http://localhost:3000/config 进入配置页面。

## 功能说明

### 1) OpenAPI 配置（仅前端存储）

- 路由：/config
- 字段：
  - Base URL：接口根地址，如 https://api.example.com
  - API Key：可选，保存在浏览器 localStorage，不会上传服务器
  - OpenAPI JSON：粘贴 OpenAPI 3.x/Swagger 2.0 规范（JSON）
- 行为：
  - 保存到本地（localStorage）
  - 保存并进入聊天（返回 /）
  - 复制分享链接（默认不包含 API Key，可选勾选包含）

### 2) 聊天页面（/）

- 使用 @ant-design/x 的示例聊天流程，当前仅 Mock 回复
- 页面会：
  - 优先读取本地配置（localStorage）
  - 若 URL 有 ?cfg=... 则解码并合并到本地配置
  - 顶部显示“已加载/未配置”的状态提示，并提供“去配置”按钮
- 右下角“分享浮窗”支持：
  - 复制分享链接
  - 系统分享（Web Share API）
  - 选项：是否在链接中包含 API Key（不安全）、是否省略 OpenAPI 规范（链接更短）

> 说明：仅前端演示，不会真实调用后端。若要改造成可调用后端的模板，可将 useXAgent 的 request 函数替换为：
>
> - 读取当前配置（baseUrl/apiKey/spec），从 spec 推导出接口路径
> - 用 fetch 调用真实接口，处理错误与超时

## 参数与返回值（主要模块）

- src/lib/config.ts
  - OpenApiConfig
    - baseUrl: string
    - apiKey?: string
    - spec: Record<string, any>
    - updatedAt: number
  - loadConfigFromLocal(): OpenApiConfig | null
  - saveConfigToLocal(cfg: OpenApiConfig): void
  - encodeConfigForURL(cfg, { includeApiKey?: boolean, omitSpec?: boolean }): string
  - decodeConfigFromURL(encoded: string): Partial<OpenApiConfig> | null
  - buildShareUrl(encodedCfg: string): string

## 代码结构

- src/app/layout.tsx：全局布局，含 AntdRegistry
- src/app/page.tsx：聊天页（含分享浮窗、配置状态提示）
- src/app/config/page.tsx：OpenAPI 配置页
- src/lib/config.ts：配置类型、localStorage、链接编解码工具

## 开发规范与工具

- TypeScript + Oxlint
- 脚本：
  - pnpm lint：运行 Oxlint
  - pnpm lint:fix：自动修复
  - pnpm format：同 lint:fix
- VS Code 建议安装 Oxlint 插件

## 未来可扩展方向

- 将 useXAgent.request 替换为真实调用：按照 OpenAPI 规范生成请求
- 接入鉴权与敏感信息安全策略（API Key 加密/服务端代理）
- 消息持久化、对话命名、附件上传与预览等
