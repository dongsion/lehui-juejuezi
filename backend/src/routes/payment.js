/**
 * 支付路由
 *
 * 【当前模式：个人收款码模式】
 * 不需要营业执照、不需要域名备案、不需要对接支付通道。
 * 顾客下单后显示商家预置的微信/支付宝收款码图片，顾客扫码付款后点"已支付"确认。
 *
 * 【原理】
 *   1. 顾客下单 → 后端返回收款码图片路径 + 订单信息
 *   2. 前端显示收款码 + 金额 + "我已支付"按钮
 *   3. 顾客扫码付款后点击"已支付" → 调用 /api/payment/confirm 接口
 *   4. 后端将订单标记为已支付 → SSE 推送通知给商家
 *
 * 【后续升级到真实支付时】
 * 只需将 /create 接口改为调用微信/支付宝官方 API 返回支付链接，
 * 将 /confirm 接口替换为官方回调接口即可，前端无需大改。
 * 参考下方各支付渠道的对接注释。
 */
const express = require('express');
const { nanoid } = require('nanoid');
const { db } = require('../database');
const { broadcastPaymentSuccess } = require('../services/notify');

const router = express.Router();

/**
 * POST /api/payment/create
 * 创建支付（个人收款码模式）
 * 请求体：{ order_id, channel: 'wechat' | 'alipay' }
 * 返回：{ qr_image, order_id, amount, order_no }
 *
 * 个人收款码模式说明：
 *   不调用任何第三方支付 API，直接返回商家预置的收款码图片路径。
 *   顾客扫码付款后，前端调用 /api/payment/confirm 确认支付。
 *
 * 【后续升级真实支付时替换此处逻辑即可】
 *   微信 H5 支付：调用 wechatpay-node-v3 的 transactions_h5，返回 h5_url
 *   支付宝手机网站支付：调用 alipay-sdk 的 alipay.trade.wap.pay，返回支付链接
 *   聚合支付（收钱吧/Ping++）：调用服务商下单接口，返回支付链接或二维码
 */
router.post('/create', (req, res) => {
  const { order_id, channel } = req.body;

  // 参数校验
  if (!order_id) {
    return res.status(400).json({ code: 400, message: '缺少 order_id' });
  }
  if (!channel || !['wechat', 'alipay'].includes(channel)) {
    return res.status(400).json({ code: 400, message: 'channel 必须为 wechat 或 alipay' });
  }

  // 查询订单是否存在
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id);
  if (!order) {
    return res.status(404).json({ code: 404, message: '订单不存在' });
  }

  // 校验订单是否已支付
  if (order.payment_status === 'paid') {
    return res.status(400).json({ code: 400, message: '该订单已支付' });
  }

  // 创建支付记录
  const paymentId = nanoid();
  const insertPayment = db.prepare(`
    INSERT INTO payment_records (id, order_id, channel, amount, status, raw_response)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `);
  insertPayment.run(paymentId, order_id, channel, order.total_amount, JSON.stringify({ mode: 'qr_code' }));

  // 更新订单的支付渠道
  db.prepare('UPDATE orders SET payment_channel = ? WHERE id = ?').run(channel, order_id);

  // 返回收款码图片路径 + 订单信息
  // 图片放在前端 public 目录，通过静态文件服务访问
  const qrImage = channel === 'wechat' ? '/wechat-qr.png' : '/alipay-qr.jpeg';

  res.json({
    qr_image: qrImage,
    order_id: order_id,
    order_no: order.order_no,
    amount: order.total_amount,
    channel: channel,
    channel_name: channel === 'wechat' ? '微信支付' : '支付宝',
  });
});

/**
 * POST /api/payment/confirm
 * 顾客确认支付（个人收款码模式专用）
 *
 * 顾客扫码付款后点击"我已支付"按钮，前端调用此接口。
 * 后端将订单标记为已支付，并推送通知给商家。
 *
 * 注意：此模式下商家需自行核对到账，系统无法自动验证收款。
 *
 * 【后续升级真实支付时】
 * 此接口可替换为微信/支付宝的官方回调接口，由支付平台自动调用。
 */
router.post('/confirm', (req, res) => {
  const { order_id } = req.body;

  if (!order_id) {
    return res.status(400).json({ code: 400, message: '缺少 order_id' });
  }

  const order = db.prepare('SELECT id, payment_channel, payment_status FROM orders WHERE id = ?').get(order_id);
  if (!order) {
    return res.status(404).json({ code: 404, message: '订单不存在' });
  }

  if (order.payment_status === 'paid') {
    return res.status(400).json({ code: 400, message: '该订单已支付' });
  }

  const channel = order.payment_channel || 'wechat';
  const transactionId = `qr_${channel}_${Date.now()}`;

  markOrderAsPaid(order_id, channel, transactionId);

  // ★ 支付成功 → 推送通知给在线商家浏览器
  broadcastPaymentSuccess({ order_id, payment_channel: channel });

  res.json({ code: 'SUCCESS', message: '支付确认成功，商家将尽快核实' });
});

/**
 * GET /api/payment/status/:order_id
 * 查询支付状态
 * 返回：{ order_id, payment_status, payment_channel }
 */
router.get('/status/:order_id', (req, res) => {
  const { order_id } = req.params;

  const order = db
    .prepare('SELECT id, payment_status, payment_channel FROM orders WHERE id = ?')
    .get(order_id);

  if (!order) {
    return res.status(404).json({ code: 404, message: '订单不存在' });
  }

  res.json({
    order_id: order.id,
    payment_status: order.payment_status,
    payment_channel: order.payment_channel,
  });
});

/**
 * 将订单标记为已支付（供回调接口复用）
 * 更新订单状态、支付状态、支付时间，并更新对应的支付记录
 */
function markOrderAsPaid(orderId, channel, transactionId) {
  // 更新订单：状态改为已确认，支付状态改为已支付，记录支付时间
  db.prepare(`
    UPDATE orders
    SET status = 'confirmed', payment_status = 'paid', paid_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(orderId);

  // 更新对应渠道的支付记录为成功
  db.prepare(`
    UPDATE payment_records
    SET status = 'success', transaction_id = ?, raw_response = ?
    WHERE order_id = ? AND channel = ? AND status = 'pending'
  `).run(
    transactionId,
    JSON.stringify({ mock: true, channel, transaction_id: transactionId, paid_at: new Date().toISOString() }),
    orderId,
    channel
  );
}

/**
 * POST /api/payment/callback/wechat
 * 模拟微信支付回调
 *
 * 【真实环境说明】
 * 微信支付回调为 POST 请求，Body 为 JSON 格式，需使用微信支付平台证书验签。
 * 验签通过后解析 resource.ciphertext 中的支付结果，更新订单状态。
 * 返回需为 { code: 'SUCCESS', message: '成功' }，否则微信会重试通知。
 *
 * 当前 mock 实现：接收 order_id 参数，直接将订单标记为已支付。
 */
router.post('/callback/wechat', (req, res) => {
  // Mock 模式从请求体获取订单 ID（真实环境从微信回调数据中解析）
  const { order_id } = req.body;

  if (!order_id) {
    // 真实环境：从微信回调数据中解析 out_trade_no，再查询对应订单
    return res.status(400).json({ code: 'FAIL', message: '缺少 order_id' });
  }

  const order = db.prepare('SELECT id FROM orders WHERE id = ?').get(order_id);
  if (!order) {
    return res.status(404).json({ code: 'FAIL', message: '订单不存在' });
  }

  // 生成模拟的微信支付交易号
  const transactionId = `mock_wx_${Date.now()}`;
  markOrderAsPaid(order_id, 'wechat', transactionId);

  // ★ 支付成功 → 推送通知给在线商家浏览器
  broadcastPaymentSuccess({ order_id, payment_channel: 'wechat' });

  // 微信要求返回 code 为 SUCCESS 才会停止重试
  res.json({ code: 'SUCCESS', message: '成功' });
});

/**
 * POST /api/payment/callback/alipay
 * 模拟支付宝支付回调
 *
 * 【真实环境说明】
 * 支付宝回调为 POST 请求，参数为 form-urlencoded 格式，需使用支付宝公钥验签。
 * 验签通过后从 trade_status 判断支付结果（TRADE_SUCCESS 或 TRADE_FINISHED），
 * 更新订单状态。返回需为纯文本 'success'（小写），否则支付宝会重试通知。
 *
 * 当前 mock 实现：接收 order_id 参数，直接将订单标记为已支付。
 */
router.post('/callback/alipay', (req, res) => {
  // Mock 模式从请求体获取订单 ID（真实环境从支付宝回调数据中解析 out_trade_no）
  const { order_id } = req.body;

  if (!order_id) {
    // 真实环境：从支付宝回调数据中解析 out_trade_no，再查询对应订单
    return res.status(400).json({ code: 'FAIL', message: '缺少 order_id' });
  }

  const order = db.prepare('SELECT id FROM orders WHERE id = ?').get(order_id);
  if (!order) {
    return res.status(404).json({ code: 'FAIL', message: '订单不存在' });
  }

  // 生成模拟的支付宝交易号
  const transactionId = `mock_alipay_${Date.now()}`;
  markOrderAsPaid(order_id, 'alipay', transactionId);

  // ★ 支付成功 → 推送通知给在线商家浏览器
  broadcastPaymentSuccess({ order_id, payment_channel: 'alipay' });

  // 支付宝要求返回 'success'（纯文本）才会停止重试
  res.send('success');
});

module.exports = router;
