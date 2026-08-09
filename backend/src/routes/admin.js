/**
 * 老板端路由
 * 提供订单查询、菜品管理、分类管理和经营统计功能
 * 所有路由均需通过 x-owner-token 鉴权
 *
 * 菜品变更时会通过 SSE 推送菜单更新通知给在线顾客端
 */
const express = require('express');
const { db } = require('../database');
const { ownerAuth } = require('../middleware/auth');
const { addMerchantClient, broadcastMenuUpdate } = require('../services/notify');

const router = express.Router();

// SSE 端点也使用环境变量中的 OWNER_TOKEN 进行鉴权
const SSE_TOKEN = process.env.OWNER_TOKEN || 'baji-owner-2026';

// 所有老板端路由都需要鉴权
// 但 SSE 端点需要特殊处理（EventSource 不支持自定义 header），
// 改为在路由内通过 query 参数鉴权
router.use((req, res, next) => {
  // SSE 流端点单独通过 query 鉴权
  if (req.path === '/order-stream') {
    const token = req.query.token;
    if (token !== SSE_TOKEN) {
      return res.status(401).json({ code: 401, message: '未授权' });
    }
    return addMerchantClient(res);
  }
  next();
});

// 其余老板端路由走标准 header 鉴权
router.use(ownerAuth);

/**
 * GET /api/admin/order-stream?token=xxx
 * SSE 实时订单推送端点
 * 商家浏览器打开后保持长连接，有新订单时服务器主动推送
 */
// （实际处理在上面的 use 中间件内完成）

/**
 * GET /api/admin/orders
 * 查询订单列表，支持按状态和日期筛选
 * 查询参数：?status=pending|confirmed|cancelled  &date=YYYY-MM-DD
 * 返回：{ total, orders: [...] }
 */
router.get('/orders', (req, res) => {
  const { status, date } = req.query;

  // 动态构建查询条件和参数
  let sql = 'SELECT * FROM orders WHERE 1=1';
  const params = [];

  if (status) {
    if (['paid', 'unpaid', 'pending'].includes(status)) {
      sql += ' AND payment_status = ?';
      params.push(status);
    } else {
      sql += ' AND status = ?';
      params.push(status);
    }
  }

  if (date) {
    sql += ' AND date(created_at) = date(?)';
    params.push(date);
  }

  sql += ' ORDER BY created_at DESC';

  const orders = db.prepare(sql).all(...params);

  // 解析每个订单的 items_json 字段
  const formattedOrders = orders.map((order) => {
    let items = [];
    try {
      items = JSON.parse(order.items_json);
    } catch (e) {
      items = [];
    }
    return {
      id: order.id,
      order_no: order.order_no,
      status: order.status,
      total_amount: order.total_amount,
      items: items,
      customer_note: order.customer_note,
      dine_type: order.dine_type,
      table_number: order.table_number,
      payment_channel: order.payment_channel,
      payment_status: order.payment_status,
      created_at: order.created_at,
      paid_at: order.paid_at,
    };
  });

  res.json({ total: formattedOrders.length, orders: formattedOrders });
});

/**
 * GET /api/admin/dishes
 * 获取所有菜品（含下架），按分类分组
 */
router.get('/dishes', (req, res) => {
  const categories = db
    .prepare('SELECT id, name, sort_order, is_active FROM categories ORDER BY sort_order ASC, id ASC')
    .all();

  const dishes = db
    .prepare('SELECT id, category_id, name, description, price, image_url, is_available, sort_order FROM dishes ORDER BY sort_order ASC, id ASC')
    .all();

  const dishesByCategory = {};
  dishes.forEach((dish) => {
    if (!dishesByCategory[dish.category_id]) {
      dishesByCategory[dish.category_id] = [];
    }
    dishesByCategory[dish.category_id].push(dish);
  });

  const result = categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    sort_order: cat.sort_order,
    is_active: cat.is_active,
    dishes: dishesByCategory[cat.id] || [],
  }));

  res.json({ categories: result });
});

/**
 * POST /api/admin/dishes
 * 创建菜品 → 广播菜单更新给顾客端
 */
router.post('/dishes', (req, res) => {
  const { category_id, name, description, price, image_url, sort_order } = req.body;

  if (!category_id || !name || price === undefined) {
    return res.status(400).json({ code: 400, message: '缺少必要参数：category_id, name, price' });
  }

  const category = db.prepare('SELECT id FROM categories WHERE id = ?').get(category_id);
  if (!category) {
    return res.status(400).json({ code: 400, message: '分类不存在' });
  }

  const result = db.prepare(`
    INSERT INTO dishes (category_id, name, description, price, image_url, sort_order, is_available)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(category_id, name, description || null, price, image_url || '', sort_order || 0);

  // ★ 菜品新增 → 推送菜单更新通知给在线顾客端
  broadcastMenuUpdate('add');

  res.status(201).json({
    id: result.lastInsertRowid,
    message: '菜品创建成功',
  });
});

/**
 * PUT /api/admin/dishes/:id
 * 更新菜品（含上下架 is_available） → 广播菜单更新给顾客端
 */
router.put('/dishes/:id', (req, res) => {
  const { id } = req.params;
  const { name, description, price, image_url, is_available, sort_order, category_id } = req.body;

  const dish = db.prepare('SELECT * FROM dishes WHERE id = ?').get(id);
  if (!dish) {
    return res.status(404).json({ code: 404, message: '菜品不存在' });
  }

  db.prepare(`
    UPDATE dishes
    SET name = ?, description = ?, price = ?, image_url = ?, is_available = ?, sort_order = ?, category_id = ?
    WHERE id = ?
  `).run(
    name !== undefined ? name : dish.name,
    description !== undefined ? description : dish.description,
    price !== undefined ? price : dish.price,
    image_url !== undefined ? image_url : dish.image_url,
    is_available !== undefined ? is_available : dish.is_available,
    sort_order !== undefined ? sort_order : dish.sort_order,
    category_id !== undefined ? category_id : dish.category_id,
    id
  );

  // ★ 菜品更新/上下架 → 推送菜单更新通知给在线顾客端
  broadcastMenuUpdate('update');

  res.json({ message: '菜品更新成功' });
});

/**
 * DELETE /api/admin/dishes/:id
 * 删除菜品 → 广播菜单更新给顾客端
 */
router.delete('/dishes/:id', (req, res) => {
  const { id } = req.params;

  const dish = db.prepare('SELECT id FROM dishes WHERE id = ?').get(id);
  if (!dish) {
    return res.status(404).json({ code: 404, message: '菜品不存在' });
  }

  db.prepare('DELETE FROM dishes WHERE id = ?').run(id);

  // ★ 菜品删除 → 推送菜单更新通知给在线顾客端
  broadcastMenuUpdate('delete');

  res.json({ message: '菜品删除成功' });
});

/**
 * POST /api/admin/categories
 * 创建分类 → 广播菜单更新给顾客端
 */
router.post('/categories', (req, res) => {
  const { name, sort_order } = req.body;

  if (!name) {
    return res.status(400).json({ code: 400, message: '缺少必要参数：name' });
  }

  const result = db.prepare(`
    INSERT INTO categories (name, sort_order, is_active)
    VALUES (?, ?, 1)
  `).run(name, sort_order || 0);

  broadcastMenuUpdate('add');

  res.status(201).json({
    id: result.lastInsertRowid,
    message: '分类创建成功',
  });
});

/**
 * GET /api/admin/stats
 * 获取今日经营统计
 */
router.get('/stats', (req, res) => {
  const todayStats = db.prepare(`
    SELECT
      COUNT(*) as today_orders,
      COALESCE(SUM(total_amount), 0) as today_revenue
    FROM orders
    WHERE payment_status = 'paid' AND date(created_at) = date('now', 'localtime')
  `).get();

  const todayOrders = todayStats.today_orders || 0;
  const todayRevenue = todayStats.today_revenue || 0;
  const avgOrderValue = todayOrders > 0 ? Math.round((todayRevenue / todayOrders) * 100) / 100 : 0;

  const paidOrders = db.prepare(`
    SELECT items_json FROM orders
    WHERE payment_status = 'paid' AND date(created_at) = date('now', 'localtime')
  `).all();

  const dishStats = {};
  paidOrders.forEach((order) => {
    let items = [];
    try {
      items = JSON.parse(order.items_json);
    } catch (e) {
      return;
    }
    items.forEach((item) => {
      if (!dishStats[item.name]) {
        dishStats[item.name] = { count: 0, revenue: 0 };
      }
      dishStats[item.name].count += item.quantity;
      dishStats[item.name].revenue += item.price * item.quantity;
    });
  });

  const topDishes = Object.entries(dishStats)
    .map(([name, stats]) => ({
      name: name,
      count: stats.count,
      revenue: Math.round(stats.revenue * 100) / 100,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  res.json({
    today_revenue: todayRevenue,
    today_orders: todayOrders,
    avg_order_value: avgOrderValue,
    top_dishes: topDishes,
  });
});

module.exports = router;
