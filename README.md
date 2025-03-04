# japanese-memory-backend

日语记忆辅助应用的后端服务。

## 环境要求

- Node.js 18+
- npm 或 yarn

## 安装

```bash
npm install
# 或
yarn install
```

## 环境配置

1. 复制 `.env.example` 文件并重命名为 `.env`
2. 填写所有必要的环境变量

```bash
cp .env.example .env
```

## 运行模式

### 本地开发模式

在本地开发模式下，服务器将在 http://localhost:3000 上运行。

```bash
# 开发模式（带有热重载）
npm run dev

# 或者不带热重载的启动
npm run start
```

你可以通过设置 `.env` 文件中的 `PORT` 环境变量来更改端口：

```
PORT=8080
```

### 生产模式（Cloudflare Workers）

要部署到 Cloudflare Workers：

```bash
# 构建项目
npm run build

# 部署到 Cloudflare Workers
npm run deploy
```

## API 文档

- `/api/openai/extract-subtitles` - 从图片中提取日语字幕
- `/api/openai/stream` - 流式响应 OpenAI API
- `/api/openai/completion` - 完成 OpenAI API 请求
- `/auth/*` - 认证相关接口
- `/api/user/*` - 用户相关接口