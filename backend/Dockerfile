# 后端 Dockerfile
# 纯 JS 实现（JSON 文件存储），无需编译原生模块
FROM node:22-alpine

WORKDIR /app

# 先复制依赖清单（利用 Docker 层缓存）
COPY package.json package-lock.json* ./

# 安装依赖（纯 JS 包，无需编译工具）
RUN npm ci --omit=dev

# 复制源码
COPY . .

# 创建数据目录（JSON 数据文件存放位置）
RUN mkdir -p /app/data

# 暴露端口
EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

# 启动命令
CMD ["node", "src/app.js"]
