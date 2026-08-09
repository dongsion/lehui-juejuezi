/**
 * 应用主入口
 * 初始化 Express 应用、挂载中间件和路由、启动 HTTP 服务
 *
 * 部署模式：单应用模式
 *   后端同时提供 API 服务和前端静态文件托管
 *   前端构建产物位于 ../frontend/dist，由 Express 直接 serve
 *   这样只需部署一个服务，无需 Vercel + Railway 双平台
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./database');

// 路由模块
const menuRoutes = require('./routes/menu');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payment');
const adminRoutes = require('./routes/admin');
const riderRoutes = require('./routes/rider');

const app = express();
const PORT = process.env.PORT || 3001;

// 初始化数据库（建表 + 种子数据）
initDatabase();

// 中间件：跨域支持（单应用模式下同源，CORS 仅用于开发环境跨端口调试）
app.use(cors());

// 中间件：解析 JSON 请求体
app.use(express.json());

// 中间件：解析 URL 编码请求体
app.use(express.urlencoded({ extended: true }));

// 健康检查接口
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '乐荟绝绝子后端服务运行中' });
});

// 挂载 API 路由（所有 API 路径以 /api 开头）
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/rider', riderRoutes);

// ============ 静态文件托管（前端构建产物）============
// 托管上传的收款码图片
const uploadsDir = path.join(__dirname, 'data', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// 前端构建后产物在 ../frontend/dist 目录
// 生产环境下后端直接 serve 这些文件，实现单应用部署
const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');

if (fs.existsSync(frontendDist)) {
  // 托管静态资源文件（JS/CSS/图片等）
  app.use(express.static(frontendDist));

  // SPA 回退：所有非 /api 开头的 GET 请求都返回 index.html
  // 这样前端路由（如 /admin、/order/xxx）刷新不会 404
  app.get('*', (req, res, next) => {
    // API 请求不走 SPA 回退
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });

  console.log(`[静态文件] 前端构建产物目录：${frontendDist}`);
} else {
  console.warn(`[静态文件] 前端 dist 目录不存在：${frontendDist}`);
  console.warn('[静态文件] 仅提供 API 服务，请先构建前端：cd frontend && npm run build');
}

// 全局错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误：', err);
  res.status(500).json({ code: 500, message: '服务器内部错误' });
});

// 启动 HTTP 服务
app.listen(PORT, () => {
  console.log(`乐荟绝绝子服务已启动，监听端口 ${PORT}`);
  console.log(`菜单接口：http://localhost:${PORT}/api/menu`);
  console.log(`健康检查：http://localhost:${PORT}/api/health`);
  console.log(`前端页面：http://localhost:${PORT}/`);
});
