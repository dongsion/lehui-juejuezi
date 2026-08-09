<template>
  <div class="rider-page">
    <van-nav-bar title="骑手端" fixed placeholder>
      <template #right>
        <div class="sse-status" v-if="authed">
          <span class="sse-dot" :class="connected ? 'on' : 'off'"></span>
          <span class="sse-text">{{ connected ? '实时' : '断开' }}</span>
          <van-icon name="logout-o" size="20" @click="handleLogout" style="margin-left: 12px" />
        </div>
      </template>
    </van-nav-bar>

    <!-- 登录验证 -->
    <div v-if="!authed" class="auth-wrap">
      <div class="auth-card card">
        <div class="auth-icon">
          <van-icon name="logistics" size="48" color="#1677FF" />
        </div>
        <div class="auth-title">骑手登录</div>
        <div class="auth-desc">请输入骑手密码进入配送看板</div>
        <van-field
          v-model="password"
          type="password"
          label="密码"
          placeholder="请输入骑手密码"
          :border="false"
          class="auth-input"
          @keyup.enter="handleLogin"
        />
        <van-button
          block
          round
          type="primary"
          color="#1677FF"
          class="auth-btn"
          @click="handleLogin"
        >
          进入骑手端
        </van-button>
      </div>
    </div>

    <!-- 骑手看板内容 -->
    <template v-else>
      <!-- 今日配送概览 -->
      <div class="rider-banner">
        <div class="rb-title">今日配送概览</div>
        <div class="rb-stats">
          <div class="rb-stat">
            <div class="rb-num">{{ riderStats.delivering }}</div>
            <div class="rb-label">配送中</div>
          </div>
          <div class="rb-stat">
            <div class="rb-num">{{ riderStats.completed }}</div>
            <div class="rb-label">已送达</div>
          </div>
          <div class="rb-stat">
            <div class="rb-num">{{ riderStats.pending }}</div>
            <div class="rb-label">待配送</div>
          </div>
        </div>
      </div>

      <!-- 状态筛选 -->
      <van-tabs
        v-model:active="activeTab"
        sticky
        offset-top="46"
        @change="onTabChange"
      >
        <van-tab title="待配送" name="confirmed" />
        <van-tab title="配送中" name="delivering" />
        <van-tab title="已完成" name="completed" />
        <van-tab title="全部" name="all" />
      </van-tabs>

      <!-- 订单列表 -->
      <div class="list-body">
        <div v-if="loading" class="state-wrap">
          <van-loading type="spinner" color="#1677FF">加载中...</van-loading>
        </div>

        <div v-else-if="orders.length === 0" class="state-wrap">
          <van-empty description="暂无订单" />
        </div>

        <van-pull-refresh v-else v-model="refreshing" @refresh="onRefresh">
          <div
            v-for="order in orders"
            :key="order.id"
            class="order-card card"
          >
            <!-- 卡片头部 -->
            <div class="oc-header">
              <div class="oc-left">
                <div class="oc-no">{{ order.order_no || order.id }}</div>
                <div class="oc-time">{{ formatTime(order.created_at) }}</div>
              </div>
              <van-tag :type="statusTagType(order)" plain size="medium">
                {{ statusText(order) }}
              </van-tag>
            </div>

            <!-- 订单摘要 -->
            <div class="oc-summary">
              <div class="oc-dishes">{{ dishSummary(order) }}</div>
              <div class="oc-amount">
                <span class="oc-amount-label">合计</span>
                <span class="oc-amount-value">¥{{ formatPrice(order.total_amount) }}</span>
              </div>
            </div>

            <!-- 配送信息 -->
            <div class="oc-delivery" v-if="order.dine_type || order.table_number || order.customer_note">
              <div class="od-item" v-if="order.dine_type">
                <van-icon name="bag-o" size="14" />
                <span>{{ order.dine_type === 'takeout' ? '外带' : '堂食' }}</span>
              </div>
              <div class="od-item" v-if="order.table_number">
                <van-icon name="desktop-o" size="14" />
                <span>桌号：{{ order.table_number }}</span>
              </div>
              <div class="od-item" v-if="order.customer_note">
                <van-icon name="comment-o" size="14" />
                <span>{{ order.customer_note }}</span>
              </div>
            </div>

            <!-- 展开详情 -->
            <div v-if="expandedId === order.id" class="oc-detail">
              <div class="oc-detail-title">菜品明细</div>
              <div
                v-for="item in order.items"
                :key="item.dish_id || item.id"
                class="oc-detail-item"
              >
                <span class="odi-name">{{ item.name }}</span>
                <span class="odi-qty">x{{ item.quantity || item.qty }}</span>
                <span class="odi-price">¥{{ formatPrice(item.price) }}</span>
              </div>
            </div>

            <!-- 操作按钮 -->
            <div class="oc-actions">
              <van-button
                size="small"
                plain
                @click="toggleExpand(order.id)"
              >
                {{ expandedId === order.id ? '收起' : '展开' }}
              </van-button>

              <!-- 状态流转按钮 -->
              <van-button
                v-if="order.status === 'confirmed' && order.payment_status === 'paid'"
                size="small"
                type="primary"
                color="#1677FF"
                :loading="updatingId === order.id"
                @click="handleUpdateStatus(order, 'delivering')"
              >
                开始配送
              </van-button>

              <van-button
                v-if="order.status === 'delivering'"
                size="small"
                type="success"
                :loading="updatingId === order.id"
                @click="handleUpdateStatus(order, 'completed')"
              >
                确认送达
              </van-button>

              <van-button
                v-if="order.payment_status === 'unpaid'"
                size="small"
                plain
                disabled
              >
                待支付
              </van-button>
            </div>
          </div>

          <div v-if="orders.length > 0" class="list-end">
            — 没有更多了 —
          </div>
        </van-pull-refresh>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { showToast } from 'vant'
import { getRiderOrders, updateOrderStatus } from '../../api'
import { useRiderNotify } from '../../composables/useRiderNotify'

defineOptions({ name: 'RiderDashboard' })

// 骑手端令牌
const RIDER_PASSWORD = import.meta.env.VITE_RIDER_TOKEN || 'baji-rider-2026'
const TOKEN_KEY = 'rider_token'

const authed = ref(false)
const password = ref('')
const loading = ref(false)
const refreshing = ref(false)
const orders = ref([])
const expandedId = ref(null)
const updatingId = ref(null)
const activeTab = ref('confirmed')

// 实时通知（SSE）
const { connected, connect, disconnect } = useRiderNotify()

// 配送统计
const riderStats = computed(() => {
  const stats = { pending: 0, delivering: 0, completed: 0 }
  orders.value.forEach((o) => {
    if (o.status === 'confirmed' && o.payment_status === 'paid') stats.pending++
    if (o.status === 'delivering') stats.delivering++
    if (o.status === 'completed') stats.completed++
  })
  return stats
})

// 状态文字
function statusText(order) {
  if (order.payment_status === 'unpaid') return '待支付'
  const map = {
    pending: '待支付',
    confirmed: '待配送',
    delivering: '配送中',
    completed: '已送达',
    cancelled: '已取消',
  }
  return map[order.status] || order.status
}

// 状态标签
function statusTagType(order) {
  if (order.payment_status === 'unpaid') return 'warning'
  const map = {
    pending: 'warning',
    confirmed: 'primary',
    delivering: 'primary',
    completed: 'success',
    cancelled: 'danger',
  }
  return map[order.status] || 'default'
}

function formatPrice(val) {
  return Number(val || 0).toFixed(2)
}

function formatTime(t) {
  if (!t) return ''
  const d = new Date(t)
  if (isNaN(d.getTime())) return t
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function dishSummary(order) {
  if (!order.items || order.items.length === 0) return '无菜品'
  const names = order.items.map((i) => `${i.name}×${i.quantity || i.qty}`).slice(0, 3).join('、')
  const extra = order.items.length > 3 ? ` 等${order.items.length}件` : ''
  return names + extra
}

function toggleExpand(id) {
  expandedId.value = expandedId.value === id ? null : id
}

// 登录
function handleLogin() {
  if (!password.value) {
    showToast('请输入密码')
    return
  }
  if (password.value === RIDER_PASSWORD) {
    localStorage.setItem(TOKEN_KEY, RIDER_PASSWORD)
    authed.value = true
    password.value = ''
    showToast({ type: 'success', message: '登录成功' })
    loadOrders()
    connect()
  } else {
    showToast('密码错误')
  }
}

// 退出
function handleLogout() {
  localStorage.removeItem(TOKEN_KEY)
  authed.value = false
  orders.value = []
  showToast('已退出登录')
}

// Tab 切换
function onTabChange() {
  loadOrders()
}

// 加载订单
async function loadOrders() {
  loading.value = true
  try {
    const status = activeTab.value === 'all' ? '' : activeTab.value
    const data = await getRiderOrders(status)
    orders.value = data.orders || data.data || data || []
  } catch (e) {
    if (e.response?.status === 401 || e.response?.status === 403) {
      showToast('请先登录')
      authed.value = false
      localStorage.removeItem(TOKEN_KEY)
    } else {
      showToast(e.response?.data?.message || '加载失败')
    }
  } finally {
    loading.value = false
  }
}

// 下拉刷新
async function onRefresh() {
  await loadOrders()
  refreshing.value = false
}

// 更新订单配送状态
async function handleUpdateStatus(order, newStatus) {
  updatingId.value = order.id
  try {
    await updateOrderStatus(order.id, newStatus)
    showToast({
      type: 'success',
      message: newStatus === 'delivering' ? '已开始配送' : '已确认送达',
    })
    // 更新本地订单状态
    order.status = newStatus
    // 如果当前 Tab 不是"全部"，从列表中移除（因为状态已变）
    if (activeTab.value !== 'all') {
      orders.value = orders.value.filter((o) => o.id !== order.id)
    }
  } catch (e) {
    showToast(e.response?.data?.message || '操作失败')
  } finally {
    updatingId.value = null
  }
}

// SSE 事件监听 — 有新订单时自动刷新列表
function onOrderReceived() {
  loadOrders()
}
function onOrderPaid() {
  loadOrders()
}

onMounted(() => {
  window.addEventListener('rider:received', onOrderReceived)
  window.addEventListener('rider:paid', onOrderPaid)

  // 检查是否已登录
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    authed.value = true
    loadOrders()
  }
})

onUnmounted(() => {
  window.removeEventListener('rider:received', onOrderReceived)
  window.removeEventListener('rider:paid', onOrderPaid)
})
</script>

<style scoped>
.rider-page {
  min-height: 100vh;
  background-color: var(--color-bg);
  padding-bottom: 24px;
}

/* SSE 状态指示器 */
.sse-status {
  display: flex;
  align-items: center;
  gap: 4px;
}

.sse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.sse-dot.on {
  background-color: #67B279;
  box-shadow: 0 0 6px rgba(103, 178, 121, 0.6);
  animation: pulse 2s infinite;
}

.sse-dot.off {
  background-color: #ccc;
}

.sse-text {
  font-size: 12px;
  color: var(--color-text-secondary, #999);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* 登录 */
.auth-wrap {
  min-height: calc(100vh - 46px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.auth-card {
  width: 100%;
  padding: 36px 24px;
  text-align: center;
}

.auth-icon {
  margin-bottom: 16px;
}

.auth-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text);
}

.auth-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 8px 0 24px;
}

.auth-input {
  background-color: var(--color-bg);
  border-radius: var(--radius-sm);
  margin-bottom: 20px;
}

.auth-btn {
  font-weight: 600;
}

/* 配送概览 banner */
.rider-banner {
  margin: 12px 16px 0;
  padding: 20px;
  background: linear-gradient(135deg, #1677FF, #4096FF);
  border-radius: var(--radius-lg);
  color: #fff;
}

.rb-title {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 12px;
}

.rb-stats {
  display: flex;
  justify-content: space-around;
}

.rb-stat {
  text-align: center;
}

.rb-num {
  font-size: 24px;
  font-weight: 700;
}

.rb-label {
  font-size: 12px;
  opacity: 0.85;
  margin-top: 2px;
}

/* 订单列表 */
.list-body {
  padding: 12px;
}

.order-card {
  margin-bottom: 12px;
  padding: 14px 16px;
}

.oc-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.oc-left {
  flex: 1;
  min-width: 0;
}

.oc-no {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}

.oc-time {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 3px;
}

.oc-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--color-divider);
}

.oc-dishes {
  flex: 1;
  font-size: 13px;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding-right: 10px;
}

.oc-amount {
  display: flex;
  align-items: baseline;
  gap: 4px;
  flex-shrink: 0;
}

.oc-amount-label {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.oc-amount-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-primary);
}

/* 配送信息 */
.oc-delivery {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.od-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

/* 展开详情 */
.oc-detail {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--color-divider);
}

.oc-detail-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 8px;
}

.oc-detail-item {
  display: flex;
  align-items: center;
  padding: 6px 0;
  font-size: 13px;
  gap: 12px;
}

.odi-name {
  flex: 1;
  color: var(--color-text);
}

.odi-qty {
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.odi-price {
  color: var(--color-primary);
  font-weight: 600;
  flex-shrink: 0;
  min-width: 50px;
  text-align: right;
}

/* 操作按钮 */
.oc-actions {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--color-divider);
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.list-end {
  text-align: center;
  padding: 16px 0 24px;
  font-size: 12px;
  color: var(--color-text-placeholder);
}
</style>
