<template>
  <div class="order-detail-page">
    <van-nav-bar title="订单详情" left-arrow @click-left="router.back()" fixed placeholder />

    <div v-if="loading" class="state-wrap">
      <van-loading type="spinner" color="#C2623F">加载中...</van-loading>
    </div>

    <div v-else-if="loadError" class="state-wrap">
      <div class="state-icon">:(</div>
      <p>{{ loadError }}</p>
      <van-button size="small" plain type="primary" @click="loadOrder">
        重新加载
      </van-button>
    </div>

    <template v-else-if="order">
      <!-- 状态卡片 -->
      <div class="status-card" :class="statusClass">
        <div class="status-icon-wrap">
          <van-icon
            :name="payStatus === 'paid' ? 'success' : 'clock-o'"
            size="32"
          />
        </div>
        <div class="status-text">{{ statusText }}</div>
        <div class="status-tip">{{ statusTip }}</div>
      </div>

      <!-- 取餐信息 -->
      <div class="pickup-card card" v-if="payStatus === 'paid' || orderStatus === 'confirmed' || orderStatus === 'delivering' || orderStatus === 'completed'">
        <div class="pickup-label">取餐码</div>
        <div class="pickup-code">{{ pickupCode || order.order_no || '—' }}</div>
        <div class="pickup-tip">请凭取餐码到柜台取餐</div>
      </div>

      <!-- 订单信息 -->
      <div class="info-card card">
        <div class="info-row">
          <span class="info-label">订单号</span>
          <span class="info-value">{{ order.order_no || order.id }}</span>
        </div>
        <div class="info-row" v-if="order.dine_type">
          <span class="info-label">就餐方式</span>
          <span class="info-value">{{ order.dine_type === 'takeout' ? '外带' : '堂食' }}</span>
        </div>
        <div class="info-row" v-if="order.table_number">
          <span class="info-label">桌号</span>
          <span class="info-value">{{ order.table_number }}</span>
        </div>
        <div class="info-row" v-if="order.customer_note">
          <span class="info-label">备注</span>
          <span class="info-value">{{ order.customer_note }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">下单时间</span>
          <span class="info-value">{{ formatTime(order.created_at) }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">订单状态</span>
          <span class="info-value">
            <van-tag :type="statusTagType" plain>{{ statusText }}</van-tag>
          </span>
        </div>
      </div>

      <!-- 菜品列表 -->
      <div class="dishes-card card">
        <div class="card-title">菜品明细</div>
        <div
          v-for="item in order.items"
          :key="item.dish_id || item.id"
          class="dish-row"
        >
          <div class="dr-info">
            <div class="dr-name">{{ item.name }}</div>
            <div class="dr-desc" v-if="item.description">{{ item.description }}</div>
          </div>
          <div class="dr-qty">x{{ item.quantity || item.qty }}</div>
          <div class="dr-price">¥{{ formatPrice(item.price) }}</div>
        </div>

        <div class="total-row">
          <span>合计</span>
          <span class="total-price">
            <span class="price-symbol">¥</span>{{ formatPrice(order.total_amount || order.total_price || order.total) }}
          </span>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="action-area">
        <van-button
          v-if="orderStatus === 'pending'"
          block
          round
          type="primary"
          size="large"
          @click="goPay"
        >
          去支付
        </van-button>
        <van-button
          v-else-if="orderStatus === 'cancelled'"
          block
          round
          plain
          type="danger"
          size="large"
          @click="router.push('/')"
        >
          订单已取消，重新点单
        </van-button>
        <van-button
          v-else
          block
          round
          plain
          type="primary"
          size="large"
          @click="router.push('/')"
        >
          返回继续点单
        </van-button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getOrder } from '../api'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const loadError = ref('')
const order = ref(null)
let pollTimer = null

// 支付状态（优先取 payment_status，兼容 status 字段）
const payStatus = computed(() => {
  if (!order.value) return ''
  return order.value.payment_status || order.value.status || ''
})

// 订单状态（综合 status 和 payment_status）
const orderStatus = computed(() => {
  if (!order.value) return ''
  if (order.value.status === 'cancelled') return 'cancelled'
  if (order.value.status === 'completed') return 'completed'
  if (order.value.status === 'delivering') return 'delivering'
  if (order.value.status === 'confirmed' && order.value.payment_status === 'paid') return 'confirmed'
  if (order.value.payment_status === 'paid') return 'paid'
  return 'pending'
})

// 状态文字
const statusText = computed(() => {
  const s = orderStatus.value
  const map = {
    pending: '待支付',
    paid: '已支付',
    confirmed: '商家已确认',
    delivering: '配送中',
    completed: '已完成',
    cancelled: '已取消'
  }
  return map[s] || s
})

// 状态提示
const statusTip = computed(() => {
  const s = orderStatus.value
  const map = {
    pending: '请尽快完成支付',
    paid: '商家正在为您准备，请留意取餐',
    confirmed: '您的订单已确认，正在准备中',
    delivering: '骑手正在配送，请耐心等待',
    completed: '订单已完成，感谢您的惠顾',
    cancelled: '订单已取消'
  }
  return map[s] || ''
})

// 状态卡片样式
const statusClass = computed(() => {
  const s = orderStatus.value
  if (s === 'completed') return 'status-success'
  if (s === 'cancelled') return 'status-cancel'
  if (s === 'delivering') return 'status-delivering'
  if (s === 'confirmed' || s === 'paid') return 'status-confirmed'
  return 'status-pending'
})

// 状态标签类型
const statusTagType = computed(() => {
  const s = orderStatus.value
  if (s === 'completed') return 'success'
  if (s === 'pending') return 'warning'
  if (s === 'cancelled') return 'danger'
  if (s === 'delivering') return 'primary'
  return 'primary'
})

// 取餐码
const pickupCode = computed(() => {
  if (!order.value) return ''
  return order.value.pickup_code || ''
})

// 是否需要轮询（未完成的订单）
const needPolling = computed(() => {
  const s = orderStatus.value
  return s === 'pending' || s === 'paid' || s === 'confirmed' || s === 'delivering'
})

function formatPrice(val) {
  return Number(val || 0).toFixed(2)
}

function formatTime(t) {
  if (!t) return '—'
  const d = new Date(t)
  if (isNaN(d.getTime())) return t
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function loadOrder() {
  loading.value = true
  loadError.value = ''
  try {
    const id = route.params.id
    const data = await getOrder(id)
    order.value = data.order || data.data || data
  } catch (e) {
    loadError.value = e.response?.data?.message || '订单加载失败'
  } finally {
    loading.value = false
  }
}

// 静默轮询订单状态（不显示 loading）
async function pollOrderStatus() {
  try {
    const id = route.params.id
    const data = await getOrder(id)
    const newOrder = data.order || data.data || data
    if (order.value && newOrder.status !== order.value.status) {
      order.value = newOrder
    } else {
      order.value = newOrder
    }
  } catch (e) {
    console.warn('轮询订单状态失败:', e)
  }
}

function startPolling() {
  stopPolling()
  if (needPolling.value) {
    pollTimer = setInterval(() => {
      pollOrderStatus()
    }, 5000)
  }
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function goPay() {
  router.push(`/payment/${route.params.id}`)
}

onMounted(() => {
  loadOrder().then(() => {
    startPolling()
  })
})

onUnmounted(() => {
  stopPolling()
})
</script>

<style scoped>
.order-detail-page {
  min-height: 100vh;
  background-color: var(--color-bg);
  padding: 0 12px 24px;
}

/* 状态卡片 */
.status-card {
  margin-top: 12px;
  padding: 28px 20px;
  border-radius: var(--radius-lg);
  text-align: center;
  color: #fff;
}

.status-card.status-pending {
  background: linear-gradient(135deg, #E0A93B, #E8B855);
}

.status-card.status-success {
  background: linear-gradient(135deg, #67B279, #5BA06C);
}

.status-card.status-confirmed {
  background: linear-gradient(135deg, #5B9BD5, #4A8AC4);
}

.status-card.status-delivering {
  background: linear-gradient(135deg, #1677FF, #4096FF);
}

.status-card.status-cancel {
  background: linear-gradient(135deg, #999, #888);
}

.status-icon-wrap {
  margin-bottom: 8px;
}

.status-text {
  font-size: 20px;
  font-weight: 700;
}

.status-tip {
  margin-top: 6px;
  font-size: 13px;
  opacity: 0.9;
}

/* 取餐码卡片 */
.pickup-card {
  margin-top: 12px;
  padding: 24px 20px;
  text-align: center;
}

.pickup-label {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.pickup-code {
  font-size: 36px;
  font-weight: 800;
  color: var(--color-primary);
  letter-spacing: 4px;
  margin: 8px 0;
}

.pickup-tip {
  font-size: 12px;
  color: var(--color-text-secondary);
}

/* 信息卡片 */
.info-card {
  margin-top: 12px;
  padding: 16px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  font-size: 14px;
}

.info-row + .info-row {
  border-top: 1px solid var(--color-divider);
}

.info-label {
  color: var(--color-text-secondary);
}

.info-value {
  color: var(--color-text);
  font-weight: 500;
  text-align: right;
  word-break: break-all;
}

/* 菜品卡片 */
.dishes-card {
  margin-top: 12px;
  padding: 16px;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-divider);
}

.dish-row {
  display: flex;
  align-items: center;
  padding: 12px 0;
  gap: 12px;
  border-bottom: 1px solid var(--color-divider);
}

.dr-info {
  flex: 1;
  min-width: 0;
}

.dr-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.dr-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.dr-qty {
  font-size: 14px;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.dr-price {
  font-size: 14px;
  color: var(--color-primary);
  font-weight: 600;
  flex-shrink: 0;
  min-width: 60px;
  text-align: right;
}

.total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 14px;
  font-size: 14px;
  color: var(--color-text);
}

.total-price {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-primary);
}

/* 操作按钮 */
.action-area {
  margin-top: 24px;
  padding: 0 4px;
}
</style>
