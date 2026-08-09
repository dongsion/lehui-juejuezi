# 后端 Dockerfile
# 多阶段构建：先编译 better-sqlite3 原生模块，再打包到精简运行镜像
FROM node:18-alpine AS builder

WORKDIR /app

# 安装 better-sqlite3 编译所需的原生构建工具
RUN apk add --no-cache python3 make g++ 

# 先复制依赖清单（利用 Docker 层缓存）
COPY package.json package-lock.json* ./

# 安装依赖（含 better-sqlite3 编译）
RUN npm ci --omit=dev

# ---- 运行阶段 ----
FROM node:18-alpine

WORKDIR /app

# 复制 node_modules（含已编译的原生模块）
COPY --from=builder /app/node_modules ./node_modules

# 复制源码
COPY . .

# 创建数据目录（SQLite 文件存放位置）
RUN mkdir -p /app/data

# 暴露端口
EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

# 启动命令
CMD ["node", "src/app.js"]
