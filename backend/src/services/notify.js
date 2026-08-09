/**
 * SSE（Server-Sent Events）实时推送服务
 *
 * 三角色分组推送：
 *   - merchantClients：商家端连接，接收新订单 + 支付通知 + 订单状态变更
 *   - riderClients：骑手端连接，接收新订单 + 支付通知
 *   - customerClients：顾客端连接，接收菜单实时更新
 *
 * 推送场景：
 *   1. 顾客下单 → 推送给商家端 + 骑手端
 *   2. 顾客确认支付 → 推送给商家端 + 骑手端
 *   3. 骑手更新订单状态 → 推送给商家端
 *   4. 商家修改菜单 → 推送给所有顾客端（菜单实时同步）
 */

// ============ 三角色客户端列表 ============
const merchantClients = [];  // 商家端 SSE 连接
const riderClients = [];      // 骑手端 SSE 连接
const customerClients = [];   // 顾客端 SSE 连接（监听菜单更新）

/**
 * 通用：添加一个 SSE 客户端连接
 * @param {Response} res - Express Response 对象
 * @param {Array} clientList - 目标客户端列表
 * @param {string} role - 角色标识，用于日志
 * @returns {number} 客户端 ID
 */
function addClientToList(res, clientList, role) {
  // 设置 SSE 必需的响应头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // 发送初始连接成功事件
  res.write('event: connected\n');
  res.write('data: {"message":"已连接实时推送服务"}\n\n');

  const client = { res, id: Date.now() };
  clientList.push(client);
  console.log(`[SSE] ${role}客户端已连接，当前在线数：${clientList.length}`);

  // 客户端断开时清理
  res.on('close', () => {
    const idx = clientList.indexOf(client);
    if (idx > -1) {
      clientList.splice(idx, 1);
      console.log(`[SSE] ${role}客户端断开，当前在线数：${clientList.length}`);
    }
  });

  return client.id;
}

// ============ 添加各角色客户端 ============

function addMerchantClient(res) {
  return addClientToList(res, merchantClients, '商家');
}

function addRiderClient(res) {
  return addClientToList(res, riderClients, '骑手');
}

function addCustomerClient(res) {
  return addClientToList(res, customerClients, '顾客');
}

// ============ 通用推送函数 ============

/**
 * 向指定客户端列表推送 SSE 消息
 * @param {Array} clientList - 目标客户端列表
 * @param {string} eventName - 事件名称
 * @param {Object} data - 要推送的数据
 * @param {string} roleLabel - 角色标签（日志用）
 */
function pushToClients(clientList, eventName, data, roleLabel) {
  if (clientList.length === 0) return 0;

  const dataStr = JSON.stringify(data);
  let sent = 0;

  clientList.forEach((client) => {
    try {
      client.res.write(`event: ${eventName}\n`);
      client.res.write(`data: ${dataStr}\n\n`);
      sent++;
    } catch (e) {
      console.error(`[SSE] 推送失败（${roleLabel}）：`, e.message);
    }
  });

  return sent;
}

// ============ 业务推送函数 ============

/**
 * 推送新订单通知 → 商家端 + 骑手端
 * 在顾客下单成功后调用
 */
function broadcastNewOrder(order) {
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

  const mSent = pushToClients(merchantClients, 'new_order', payload, '商家');
  const rSent = pushToClients(riderClients, 'new_order', payload, '骑手');
  console.log(`[SSE] 新订单已推送给 ${mSent} 个商家、${rSent} 个骑手`);
}

/**
 * 推送支付成功通知 → 商家端 + 骑手端
 */
function broadcastPaymentSuccess(data) {
  const payload = {
    type: 'payment_success',
    order_id: data.order_id,
    payment_channel: data.payment_channel || '',
    timestamp: Date.now(),
  };

  const mSent = pushToClients(merchantClients, 'payment_success', payload, '商家');
  const rSent = pushToClients(riderClients, 'payment_success', payload, '骑手');
  console.log(`[SSE] 支付成功通知已推送给 ${mSent} 个商家、${rSent} 个骑手`);
}

/**
 * 推送订单状态变更通知 → 商家端
 * 骑手更新订单配送状态时调用
 */
function broadcastOrderStatusChange(data) {
  const payload = {
    type: 'order_status_change',
    order_id: data.order_id,
    order_no: data.order_no || '',
    status: data.status,         // delivering | completed
    timestamp: Date.now(),
  };

  const sent = pushToClients(merchantClients, 'order_status_change', payload, '商家');
  console.log(`[SSE] 订单状态变更已推送给 ${sent} 个商家`);
}

/**
 * 推送菜单更新通知 → 顾客端
 * 商家增删改菜品时调用，顾客端收到后自动刷新菜单
 */
function broadcastMenuUpdate(action) {
  const payload = {
    type: 'menu_update',
    action: action,  // 'add' | 'update' | 'delete' | 'toggle'
    message: '菜单已更新',
    timestamp: Date.now(),
  };

  const sent = pushToClients(customerClients, 'menu_update', payload, '顾客');
  console.log(`[SSE] 菜单更新通知已推送给 ${sent} 个在线顾客`);
}

module.exports = {
  addMerchantClient,
  addRiderClient,
  addCustomerClient,
  broadcastNewOrder,
  broadcastPaymentSuccess,
  broadcastOrderStatusChange,
  broadcastMenuUpdate,
};
