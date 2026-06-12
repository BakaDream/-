# Stage 1: 构建前端
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: 运行时
FROM python:3.12-slim
WORKDIR /app

# 安装 nginx + supervisor
RUN apt-get update && apt-get install -y --no-install-recommends nginx \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt supervisor

# 复制后端代码
COPY backend/ ./backend/

# 复制前端构建产物
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html

# 复制配置文件
COPY nginx-docker.conf /etc/nginx/nginx.conf
COPY supervisord.conf /etc/supervisord.conf

EXPOSE 80

CMD ["supervisord", "-c", "/etc/supervisord.conf"]
