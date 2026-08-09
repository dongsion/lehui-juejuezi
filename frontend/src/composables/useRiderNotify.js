/**
 * 骑手端实时通知 Composable
 *
 * 原理：使用浏览器原生 EventSource API 连接骑手端 SSE 端点
 *       后端有新订单/支付成功时主动推送过来，骑手端收到后：
 *       1. 播放提示音
 *       2. 弹出浏览器桌面通知
 *       3. 显示页面内通知弹窗
 *       4. 触发自定义事件让订单列表自动刷新
 */
import { ref, onUnmounted } from 'vue'
import { showToast, showNotify } from 'vant'

export function useRiderNotify() {
  const connected = ref(false)
  let eventSource = null
  let reconnectTimer = null

  // 提示音
  function playBeep() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (!AudioContext) return

      const ctx = new AudioContext()
      const now = ctx.currentTime

      ;[0, 0.2].forEach((offset) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = 'sine'
        osc.frequency.setValueAtTime(988, now + offset) // 高音B，与商家端区分
        gain.gain.setValueAtTime(0, now + offset)
        gain.gain.linearRampToValueAtTime(0.3, now + offset + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.15)

        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + offset)
        osc.stop(now + offset + 0.15)
      })

      setTimeout(() => ctx.close(), 3000)
    } catch (e) {
      console.warn('[骑手通知] 无法播放提示音:', e)
    }
  }

  // 桌面通知
  function showDesktopNotification(title, body) {
    if (!('Notification' in window)) return

    if (Notification.permission === 'default') {
      Notification.requestPermission()
    }

    if (Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
          body: body,
          icon: '/favicon.svg',
          tag: 'rider-new-order',
          requireInteraction: true,
        })
        notification.onclick = () => {
          window.focus()
          notification.close()
        }
      } catch (e) {
        console.warn('[骑手通知] 桌面通知失败:', e)
      }
    }
  }

  // 格式化订单摘要
  function formatOrderSummary(order) {
    const items = order.items || []
    const names = items.map((i) => `${i.name}×${i.quantity}`).join('、')
    const type = order.dine_type === 'takeout' ? '外带' : '堂食'
    const table = order.table_number ? ` 桌号${order.table_number}` : ''
    return `${type}${table} | ${names} | ¥${order.total_amount}`
  }

  // 处理新订单
  function handleNewOrder(data) {
    const order = data.order || data
    console.log('[骑手通知] 收到新订单:', order.order_no)

    playBeep()

    showDesktopNotification(
      `🛵 新订单待配送 ¥${order.total_amount}`,
      formatOrderSummary(order)
    )

    showNotify({
      type: 'primary',
      message: `新订单 ¥${order.total_amount} — ${order.order_no}`,
      duration: 5000,
    })

    showToast({
      type: 'success',
      message: `收到新订单！¥${order.total_amount}`,
      duration: 3000,
    })

    window.dispatchEvent(new CustomEvent('rider:received', { detail: order }))
  }

  // 处理支付成功
  function handlePaymentSuccess(data) {
    console.log('[骑手通知] 订单已支付:', data.order_id)

    playBeep()

    showNotify({
      type: 'success',
      message: `订单已支付 — ${data.payment_channel === 'wechat' ? '微信' : '支付宝'}`,
      duration: 3000,
    })

    window.dispatchEvent(new CustomEvent('rider:paid', { detail: data }))
  }

  // 连接 SSE
  function connect() {
    if (eventSource) {
      eventSource.close()
    }

    const token = localStorage.getItem('rider_token') || 'baji-2026'

    const apiBase = import.meta.env.VITE_API_BASE || '/api'
    eventSource = new EventSource(`${apiBase}/rider/order-stream?token=${token}`)

    eventSource.addEventListener('connected', () => {
      console.log('[骑手SSE] 已连接订单推送服务')
      connected.value = true
    })

    eventSource.addEventListener('new_order', (e) => {
      try {
        const data = JSON.parse(e.data)
        handleNewOrder(data)
      } catch (err) {
        console.error('[骑手SSE] 解析新订单数据失败:', err)
      }
    })

    eventSource.addEventListener('payment_success', (e) => {
      try {
        const data = JSON.parse(e.data)
        handlePaymentSuccess(data)
      } catch (err) {
        console.error('[骑手SSE] 解析支付通知失败:', err)
      }
    })

    eventSource.onerror = () => {
      console.warn('[骑手SSE] 连接断开，5 秒后重连...')
      connected.value = false
      eventSource.close()

      clearTimeout(reconnectTimer)
      reconnectTimer = setTimeout(() => {
        connect()
      }, 5000)
    }
  }

  function disconnect() {
    clearTimeout(reconnectTimer)
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
    connected.value = false
  }

  // 注意：不在 onMounted 自动连接，由调用方在登录成功后手动 connect()

  onUnmounted(() => {
    disconnect()
  })

  return { connected, connect, disconnect }
}
