# 前端 Dockerfile
# 多阶段构建：先用 Node 编译 Vue3 静态文件，再用 Nginx 托管
FROM node:22-alpine AS builder

WORKDIR /app

# 复制依赖清单
COPY package.json package-lock.json* ./

# 安装依赖
RUN npm ci

# 复制源码并构建
COPY . .
RUN npm run build

# ---- 运行阶段：Nginx 托管静态文件 ----
FROM nginx:alpine

# 复制构建产物到 Nginx 默认目录
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
