# ========== 构建阶段 ==========
FROM node:18-slim AS builder

WORKDIR /app

# 复制所有 package 文件和 lock 文件
COPY package.json ./
COPY frontend/package.json frontend/package-lock.json ./frontend/
COPY backend/package.json backend/package-lock.json ./backend/

# 安装前端依赖并构建
RUN cd frontend && npm ci
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# 安装后端生产依赖
RUN cd backend && npm ci --omit=dev

# ========== 运行阶段 ==========
FROM node:18-slim AS runner

WORKDIR /app

# 复制后端源码和依赖
COPY --from=builder /app/backend ./backend

# 复制前端构建产物
COPY --from=builder /app/frontend/dist ./frontend/dist

# 创建数据目录
RUN mkdir -p /app/backend/data

ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_DIR=/app/backend/data

EXPOSE 3001

CMD ["node", "backend/src/app.js"]
