#!/bin/bash
# ============================================
# 乐荟绝绝子 - 一键部署脚本
# 在服务器上运行此脚本即可更新到最新版本
# 用法: bash deploy.sh
# ============================================

set -e

PROJECT_DIR="/home/dongsion/lehui-juejuezi"
REPO_URL="https://github.com/dongsion/lehui-juejuezi.git"

echo "=========================================="
echo "  乐荟绝绝子 - 开始部署"
echo "=========================================="

# 1. 进入项目目录（如果不存在则克隆）
if [ ! -d "$PROJECT_DIR" ]; then
    echo ">>> 项目目录不存在，正在克隆..."
    cd /home/dongsion
    git clone "$REPO_URL"
fi

cd "$PROJECT_DIR"
echo ">>> 当前目录: $(pwd)"

# 2. 拉取最新代码
echo ">>> 拉取最新代码..."
git pull origin main
echo ">>> 代码更新完成"

# 3. 停止旧容器
echo ">>> 停止旧容器..."
docker compose down

# 4. 重新构建并启动
echo ">>> 重新构建并启动（可能需要几分钟）..."
docker compose up -d --build

# 5. 等待服务启动
echo ">>> 等待服务启动..."
sleep 10

# 6. 检查容器状态
echo ">>> 容器状态："
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 7. 健康检查
echo ""
echo ">>> 健康检查..."
sleep 5
if curl -s http://localhost:8888/api/health | grep -q "ok\|healthy\|status"; then
    echo "✅ 后端服务正常"
else
    echo "⚠️  后端服务可能还在启动中，请稍等片刻再访问"
fi

echo ""
echo "=========================================="
echo "  ✅ 部署完成！"
echo "  顾客点单: http://43.139.32.212:8888/"
echo "  商家管理: http://43.139.32.212:8888/admin"
echo "  骑手端:   http://43.139.32.212:8888/rider"
echo "=========================================="
