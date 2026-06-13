# 部署说明

## 架构

```
浏览器 → Nginx (:23333) → /          → 前端静态文件
                         → /api/*     → Flask (:5000)
```

Nginx 统一入口，浏览器只与 Nginx 通信，无需 CORS。

## 部署（2h2g 服务器）

### 1. 克隆项目

```bash
git clone <仓库地址> 
cd 进去
```

### 2. 构建前端

```bash
cd frontend
npm install
npm run build          # 产物在 frontend/dist/
cd ..
```

### 3. 配置 AI 助手（可选）

在项目根目录创建 `.env` 文件，按需覆盖以下变量：

```bash
# ENABLE_AI=true
# AI_API_BASE_URL=https://api.sbbbbbbbbb.xyz/v1
# AI_API_KEY=sk-xxx
# AI_MODEL=gpt-5.4
# AI_TEMPERATURE=0.7
```

不创建 `.env` 则使用内置默认值。`ENABLE_AI=false` 时前端不显示 AI 助手，后端 `/api/ai/*` 也会拒绝使用。

### 4. 启动服务

```bash
docker compose up -d
```

### 5. 验证

- 访问 `http://服务器IP:23333` → 前端页面
- 访问 `http://服务器IP:23333/api/xxx` → 后端 API 响应

### 常用命令

```bash
docker compose logs -f     # 查看日志
docker compose restart     # 重启
docker compose down        # 停止
docker compose up -d --build  # 重新构建并启动
```
