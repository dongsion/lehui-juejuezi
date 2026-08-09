# 单阶段 Docker 构建 - 确保 better-sqlite3 原生模块正确编译
FROM node:18-slim

# 安装 better-sqlite3 编译所需的构建工具
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 复制根目录 package.json
COPY package.json ./

# 复制前端并构建
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# 安装后端依赖（含 better-sqlite3，会在容器内原生编译）
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev

# 复制后端源码
COPY backend/ ./backend/

# 创建数据目录并设置权限
RUN mkdir -p /app/backend/data

ENV NODE_ENV=production
# PORT 由 Railway 注入，不硬编码
ENV DATA_DIR=/app/backend/data

# Railway 会自动检测端口，不需要 EXPOSE

CMD ["node", "backend/src/app.js"]
