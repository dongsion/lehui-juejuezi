/**
 * 骑手端路由
 *
 * 功能：
 *   1. SSE 实时推送 — 骑手端保持长连接，新订单/支付成功时实时通知
 *   2. 订单列表 — 查看所有订单，按状态筛选
 *   3. 更新订单配送状态 — confirmed → delivering → completed
 *
 * 鉴权方式：
 *   - API 请求：通过 x-rider-token 请求头
 *   - SSE 端点：通过 query 参数 ?token=xxx（EventSource 不支持自定义 header）
 */
const express = require('express');
const { db } = require('../database');
const { riderAuth, getSharedPassword } = require('../middleware/auth');
const { addRiderClient, broadcastOrderStatusChange } = require('../services/notify');

const router = express.Router();

// SSE 端点通过 query 参数鉴权（使用数据库中的共享密码），其余走 header 鉴权
router.use((req, res, next) => {
  if (req.path === '/order-stream') {
    const token = req.query.token;
    const password = getSharedPassword();
    if (token !== password) {
      return res.status(401).json({ code: 401, message: '未授权' });
    }
    return addRiderClient(res);
  }
  next();
});

// 其余骑手端路由走 header 鉴权
router.use(riderAuth);

/**
 * GET /api/rider/order-stream?token=xxx
 * SSE 实时订单推送端点（骑手端）
 */
// （实际处理在上面的 use 中间件内完成）

/**
 * GET /api/rider/orders
 * 查询订单列表，支持按状态筛选
 * 查询参数：?status=pending|confirmed|delivering|completed
 * 返回：{ total, orders: [...] }
 */
router.get('/orders', (req, res) => {
  const { status } = req.query;

  let sql = 'SELECT * FROM orders WHERE 1=1';
  const params = [];

  if (status) {
    if (['paid', 'unpaid'].includes(status)) {
      sql += ' AND payment_status = ?';
      params.push(status);
    } else {
      sql += ' AND status = ?';
      params.push(status);
    }
  }

  sql += ' ORDER BY created_at DESC';

  const orders = db.prepare(sql).all(...params);

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
      pickup_code: order.pickup_code,
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
 * PUT /api/rider/orders/:id/status
 * 更新订单配送状态
 * 请求体：{ status: 'delivering' | 'completed' }
 *
 * 状态流转规则：
 *   confirmed → delivering（骑手取货出发）
 *   delivering → completed（骑手送达完成）
 *
 * 更新后通过 SSE 推送状态变更通知给商家端
 */
router.put('/orders/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  // 校验目标状态
  if (!['delivering', 'completed'].includes(status)) {
    return res.status(400).json({ code: 400, message: 'status 必须为 delivering 或 completed' });
  }

  // 查询订单
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) {
    return res.status(404).json({ code: 404, message: '订单不存在' });
  }

  // 校验状态流转合法性
  if (status === 'delivering' && order.status !== 'confirmed') {
    return res.status(400).json({ code: 400, message: '只有已确认（已支付）的订单才能开始配送' });
  }
  if (status === 'completed' && order.status !== 'delivering') {
    return res.status(400).json({ code: 400, message: '只有配送中的订单才能标记为已完成' });
  }

  // 更新订单状态
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);

  // ★ 推送订单状态变更通知给商家端
  broadcastOrderStatusChange({
    order_id: id,
    order_no: order.order_no,
    status: status,
  });

  res.json({
    order_id: id,
    order_no: order.order_no,
    status: status,
    message: status === 'delivering' ? '已标记为配送中' : '已标记为已完成',
  });
});

module.exports = router;
