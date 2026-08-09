/**
 * SSE（Server-Sent Events）实时推送服务
 *
 * 原理：商家浏览器打开老板端页面时，建立一个长连接到 /api/admin/order-stream
 *       顾客下单后，后端通过这个连接把新订单信息"推"给商家浏览器
 *       商家浏览器收到后播放提示音 + 弹出通知
 *
 * SSE 相比 WebSocket 的优势：
 *   - 单向推送足够（服务器→浏览器），不需要双向
 *   - 浏览器原生支持，无需额外库
 *   - 自动断线重连
 *   - 穿透代理/防火墙更友好
 */

// 存储所有已连接的商家客户端
// 每个 client 是一个 express Response 对象，保持着 SSE 长连接
const clients = [];

/**
 * 添加一个商家客户端连接
 * @param {Response} res - Express Response 对象
 * @returns {number} 客户端索引
 */
function addClient(res) {
  // 设置 SSE 必需的响应头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // 发送初始连接成功事件
  res.write('event: connected\n');
  res.write('data: {"message":"已连接订单推送服务"}\n\n');

  const client = { res, id: Date.now() };
  clients.push(client);
  console.log(`[SSE] 商家客户端已连接，当前在线数：${clients.length}`);

  // 客户端断开时清理
  res.on('close', () => {
    const idx = clients.indexOf(client);
    if (idx > -1) {
      clients.splice(idx, 1);
      console.log(`[SSE] 商家客户端断开，当前在线数：${clients.length}`);
    }
  });

  return client.id;
}

/**
 * 向所有在线的商家浏览器推送新订单通知
 * 在顾客下单成功后调用此函数
 *
 * @param {Object} order - 订单信息 { id, order_no, total_amount, items, created_at }
 */
function broadcastNewOrder(order) {
  // 组装推送数据
  const payload = {
    type: 'new_order',
    order: {
      id: order.id,
      order_no: order.order_no,
      total_amount: order.total_amount,
      items: order.items || [],
      customer_note: order.customer_note || '',
      dine_type: order.dine_type || '',
      table_number: order.table_number || '',
      created_at: order.created_at || new Date().toISOString(),
    },
    timestamp: Date.now(),
  };

  const dataStr = JSON.stringify(payload);
  let sent = 0;

  clients.forEach((client) => {
    try {
      // SSE 消息格式：event 行 + data 行 + 空行结束
      client.res.write('event: new_order\n');
      client.res.write(`data: ${dataStr}\n\n`);
      sent++;
    } catch (e) {
      console.error('[SSE] 推送失败：', e.message);
    }
  });

  console.log(`[SSE] 新订单已推送给 ${sent} 个在线商家客户端`);
}

/**
 * 推送支付完成通知
 * 在订单支付成功后调用
 *
 * @param {Object} data - { order_id, payment_channel }
 */
function broadcastPaymentSuccess(data) {
  const payload = {
    type: 'payment_success',
    order_id: data.order_id,
    payment_channel: data.payment_channel || '',
    timestamp: Date.now(),
  };

  const dataStr = JSON.stringify(payload);
  let sent = 0;

  clients.forEach((client) => {
    try {
      client.res.write('event: payment_success\n');
      client.res.write(`data: ${dataStr}\n\n`);
      sent++;
    } catch (e) {
      console.error('[SSE] 推送失败：', e.message);
    }
  });

  console.log(`[SSE] 支付成功通知已推送给 ${sent} 个在线商家客户端`);
}

module.exports = {
  addClient,
  broadcastNewOrder,
  broadcastPaymentSuccess,
};
