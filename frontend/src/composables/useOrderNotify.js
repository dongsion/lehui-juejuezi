/**
 * 实时订单通知 Composable
 *
 * 原理：使用浏览器原生 EventSource API 连接后端 SSE 端点
 *       后端有新订单时主动推送过来，前端收到后：
 *       1. 播放提示音（Web Audio API 生成，无需音频文件）
 *       2. 弹出浏览器桌面通知（Notification API）
 *       3. 显示 Vant 通知弹窗
 *
 * 使用方式：
 *   在任意 Vue 组件中调用 const { connected } = useOrderNotify()
 *   会自动连接，组件卸载时自动断开
 */
import { ref, onUnmounted } from 'vue'
import { showToast, showNotify } from 'vant'

export function useOrderNotify() {
  const connected = ref(false)
  let eventSource = null
  let reconnectTimer = null

  // ============ 提示音（Web Audio API 生成，无需音频文件）============
  function playBeep() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (!AudioContext) return

      const ctx = new AudioContext()
      const now = ctx.currentTime

      // 生成两声短促的提示音（类似收银机"嘀嘀"声）
      ;[0, 0.2].forEach((offset) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = 'sine'
        osc.frequency.setValueAtTime(880, now + offset) // 880Hz = 高音A
        gain.gain.setValueAtTime(0, now + offset)
        gain.gain.linearRampToValueAtTime(0.3, now + offset + 0.01) // 快速上升
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.15) // 快速衰减

        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + offset)
        osc.stop(now + offset + 0.15)
      })

      // 3 秒后自动关闭 AudioContext 释放资源
      setTimeout(() => ctx.close(), 3000)
    } catch (e) {
      console.warn('[通知] 无法播放提示音:', e)
    }
  }

  // ============ 浏览器桌面通知 ============
  function showDesktopNotification(title, body) {
    if (!('Notification' in window)) return

    // 如果用户还没授权，先请求
    if (Notification.permission === 'default') {
      Notification.requestPermission()
    }

    if (Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
          body: body,
          icon: '/favicon.svg',
          tag: 'new-order',
          requireInteraction: true, // 不会自动消失，需手动关闭
        })

        // 点击通知聚焦到商家页面
        notification.onclick = () => {
          window.focus()
          notification.close()
        }
      } catch (e) {
        console.warn('[通知] 桌面通知失败:', e)
      }
    }
  }

  // ============ 格式化订单摘要 ============
  function formatOrderSummary(order) {
    const items = order.items || []
    const names = items.map((i) => `${i.name}×${i.quantity}`).join('、')
    const type = order.dine_type === 'takeout' ? '外带' : '堂食'
    const table = order.table_number ? ` 桌号${order.table_number}` : ''
    return `${type}${table} | ${names} | ¥${order.total_amount}`
  }

  // ============ 处理新订单 ============
  function handleNewOrder(data) {
    const order = data.order || data
    console.log('[通知] 收到新订单:', order.order_no)

    // 1. 播放提示音
    playBeep()

    // 2. 桌面通知
    showDesktopNotification(
      `🔔 新订单 ¥${order.total_amount}`,
      formatOrderSummary(order)
    )

    // 3. 页面内弹窗通知
    showNotify({
      type: 'primary',
      message: `新订单 ¥${order.total_amount} — ${order.order_no}`,
      duration: 5000,
    })

    // 4. 播放 Vant 提示
    showToast({
      type: 'success',
      message: `收到新订单！¥${order.total_amount}`,
      duration: 3000,
    })

    // 5. 触发自定义事件，让页面可以监听刷新数据
    window.dispatchEvent(
      new CustomEvent('order:received', { detail: order })
    )
  }

  // ============ 处理支付成功 ============
  function handlePaymentSuccess(data) {
    console.log('[通知] 订单已支付:', data.order_id)

    playBeep()

    showNotify({
      type: 'success',
      message: `订单已支付 — ${data.payment_channel === 'wechat' ? '微信' : '支付宝'}`,
      duration: 3000,
    })

    window.dispatchEvent(
      new CustomEvent('order:paid', { detail: data })
    )
  }

  // ============ 连接 SSE ============
  function connect() {
    // 关闭旧连接
    if (eventSource) {
      eventSource.close()
    }

    // 从 localStorage 读取 token
    const token = localStorage.getItem('owner_token') || 'baji-2026'

    // 创建 EventSource 连接
    // 注意：EventSource 不支持自定义 header，所以通过 query 传 token
    const apiBase = import.meta.env.VITE_API_BASE || '/api'
    eventSource = new EventSource(`${apiBase}/admin/order-stream?token=${token}`)

    // 连接成功
    eventSource.addEventListener('connected', (e) => {
      console.log('[SSE] 已连接订单推送服务')
      connected.value = true
    })

    // 收到新订单
    eventSource.addEventListener('new_order', (e) => {
      try {
        const data = JSON.parse(e.data)
        handleNewOrder(data)
      } catch (err) {
        console.error('[SSE] 解析新订单数据失败:', err)
      }
    })

    // 收到支付成功通知
    eventSource.addEventListener('payment_success', (e) => {
      try {
        const data = JSON.parse(e.data)
        handlePaymentSuccess(data)
      } catch (err) {
        console.error('[SSE] 解析支付通知失败:', err)
      }
    })

    // 连接出错（自动重连）
    eventSource.onerror = (e) => {
      console.warn('[SSE] 连接断开，5 秒后重连...')
      connected.value = false
      eventSource.close()

      // 5 秒后自动重连
      clearTimeout(reconnectTimer)
      reconnectTimer = setTimeout(() => {
        connect()
      }, 5000)
    }
  }

  // ============ 断开连接 ============
  function disconnect() {
    clearTimeout(reconnectTimer)
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
    connected.value = false
  }

  // 组件卸载时断开
  onUnmounted(() => {
    disconnect()
  })

  // 注意：不在 onMounted 自动连接，由调用方在登录成功后手动 connect()
  // 避免未登录时发起无效的 SSE 连接

  return { connected, connect, disconnect }
}
