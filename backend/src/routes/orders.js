/**
 * 顾客端订单路由
 * 提供创建订单和查询订单详情功能
 */
const express = require('express');
const { nanoid } = require('nanoid');
const { db } = require('../database');
const { broadcastNewOrder } = require('../services/notify');

const router = express.Router();

/**
 * 生成订单编号：格式 LH + 年月日时分秒 + 4位随机数
 * 便于人工识别和排序
 */
function generateOrderNo() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr =
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds());
  const random = Math.floor(1000 + Math.random() * 9000);
  return `LH${dateStr}${random}`;
}

/**
 * 生成短取餐码：3位数字（001-999），循环使用
 * 顾客凭此码到柜台取餐，方便口头叫号
 */
function generatePickupCode() {
  const code = Math.floor(1 + Math.random() * 999);
  return String(code).padStart(3, '0');
}

/**
 * POST /api/orders
 * 创建订单
 * 请求体：{ items: [{ dish_id, quantity }], customer_note, dine_type, table_number, customer_phone, customer_nickname }
 * 返回：{ id, order_no, total_amount, status }
 */
router.post('/', (req, res) => {
  const { items, customer_note, dine_type, table_number, customer_phone, customer_nickname } = req.body;

  // 参数校验：items 不能为空
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ code: 400, message: '订单菜品不能为空' });
  }

  // 校验 dine_type 取值
  if (dine_type && !['dine_in', 'takeout'].includes(dine_type)) {
    return res.status(400).json({ code: 400, message: 'dine_type 必须为 dine_in 或 takeout' });
  }

  // 根据传入的 dish_id 批量查询菜品信息，校验菜品是否存在且可用
  const dishIds = items.map((item) => item.dish_id);
  const placeholders = dishIds.map(() => '?').join(',');
  const dishes = db
    .prepare(`SELECT id, name, price, is_available FROM dishes WHERE id IN (${placeholders})`)
    .all(...dishIds);

  // 校验所有菜品都存在
  if (dishes.length !== dishIds.length) {
    return res.status(400).json({ code: 400, message: '部分菜品不存在' });
  }

  // 校验所有菜品都在售
  const unavailableDish = dishes.find((d) => !d.is_available);
  if (unavailableDish) {
    return res.status(400).json({ code: 400, message: `菜品「${unavailableDish.name}」已下架` });
  }

  // 组装订单明细并计算总金额
  const dishMap = {};
  dishes.forEach((d) => {
    dishMap[d.id] = d;
  });

  const orderItems = [];
  let totalAmount = 0;

  items.forEach((item) => {
    const dish = dishMap[item.dish_id];
    const quantity = parseInt(item.quantity, 10);
    if (quantity <= 0) {
      return;
    }
    const subtotal = dish.price * quantity;
    totalAmount += subtotal;
    orderItems.push({
      dish_id: dish.id,
      name: dish.name,
      price: dish.price,
      quantity: quantity,
    });
  });

  if (orderItems.length === 0) {
    return res.status(400).json({ code: 400, message: '订单菜品数量无效' });
  }

  // 金额四舍五入保留两位小数
  totalAmount = Math.round(totalAmount * 100) / 100;

  // 生成订单 ID 和订单编号
  const orderId = nanoid();
  const orderNo = generateOrderNo();
  const pickupCode = generatePickupCode();
  const itemsJson = JSON.stringify(orderItems);

  // 写入数据库
  const insertOrder = db.prepare(`
    INSERT INTO orders (id, order_no, pickup_code, status, total_amount, items_json, customer_note, dine_type, table_number, payment_status, customer_phone, customer_nickname)
    VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, 'unpaid', ?, ?)
  `);

  insertOrder.run(orderId, orderNo, pickupCode, totalAmount, itemsJson, customer_note || null, dine_type || null, table_number || null, customer_phone || null, customer_nickname || null);

  // ★ 顾客下单成功 → 实时推送给在线商家浏览器
  broadcastNewOrder({
    id: orderId,
    order_no: orderNo,
    pickup_code: pickupCode,
    total_amount: totalAmount,
    items: orderItems,
    customer_note: customer_note || null,
    dine_type: dine_type || null,
    table_number: table_number || null,
    customer_phone: customer_phone || null,
    customer_nickname: customer_nickname || null,
    created_at: new Date().toISOString(),
  });

  res.status(201).json({
    id: orderId,
    order_no: orderNo,
    pickup_code: pickupCode,
    total_amount: totalAmount,
    status: 'pending',
  });
});

/**
 * GET /api/orders/:id
 * 查询订单详情（含支付状态）
 * 返回订单完整信息
 */
router.get('/:id', (req, res) => {
  const { id } = req.params;

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);

  if (!order) {
    return res.status(404).json({ code: 404, message: '订单不存在' });
  }

  // 解析订单明细 JSON
  let items = [];
  try {
    items = JSON.parse(order.items_json);
  } catch (e) {
    items = [];
  }

  res.json({
    id: order.id,
    order_no: order.order_no,
    pickup_code: order.pickup_code,
    status: order.status,
    total_amount: order.total_amount,
    items: items,
    customer_note: order.customer_note,
    dine_type: order.dine_type,
    table_number: order.table_number,
    customer_phone: order.customer_phone,
    customer_nickname: order.customer_nickname,
    payment_channel: order.payment_channel,
    payment_status: order.payment_status,
    created_at: order.created_at,
    paid_at: order.paid_at,
  });
});

module.exports = router;
