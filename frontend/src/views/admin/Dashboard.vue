<template>
  <div class="dashboard-page">
    <van-nav-bar title="经营看板" fixed placeholder>
      <template #right>
        <div class="sse-status" v-if="authed">
          <div class="sse-badge" :class="connected ? 'online' : 'offline'">
            <span class="sse-dot" :class="connected ? 'on' : 'off'"></span>
            <span class="sse-text">{{ connected ? '在线' : '离线' }}</span>
          </div>
          <van-icon name="logout-o" size="20" color="#fff" @click="handleLogout" style="margin-left: 10px" />
        </div>
      </template>
    </van-nav-bar>

    <!-- 密码验证 -->
    <div v-if="!authed" class="auth-wrap">
      <div class="auth-card card">
        <div class="auth-icon">
          <van-icon name="manager-o" size="48" color="#C2623F" />
        </div>
        <div class="auth-title">乐荟绝绝子 · 商家登录</div>
        <div class="auth-desc">请输入管理密码进入经营看板</div>
        <van-field
          v-model="password"
          type="password"
          label="密码"
          placeholder="请输入管理密码"
          :border="false"
          class="auth-input"
          @keyup.enter="handleLogin"
        />
        <van-button
          block
          round
          type="primary"
          class="auth-btn"
          @click="handleLogin"
        >
          进入看板
        </van-button>
      </div>
    </div>

    <!-- 看板内容 -->
    <template v-else>
      <div v-if="loading" class="state-wrap">
        <van-loading type="spinner" color="#C2623F">加载中...</van-loading>
      </div>

      <div v-else-if="loadError" class="state-wrap">
        <div class="state-icon">:(</div>
        <p>{{ loadError }}</p>
        <van-button size="small" plain type="primary" @click="loadStats">
          重新加载
        </van-button>
      </div>

      <template v-else>
        <!-- 今日概览 -->
        <div class="overview-banner">
          <div class="ob-title">今日经营概览</div>
          <div class="ob-date">{{ todayStr }}</div>
        </div>

        <!-- 统计卡片 -->
        <div class="stats-grid">
          <div class="stat-card card">
            <div class="stat-icon revenue-icon">
              <van-icon name="balance-o" size="22" />
            </div>
            <div class="stat-value">¥{{ formatPrice(stats.today_revenue) }}</div>
            <div class="stat-label">今日营收</div>
          </div>

          <div class="stat-card card">
            <div class="stat-icon order-icon">
              <van-icon name="orders-o" size="22" />
            </div>
            <div class="stat-value">{{ stats.today_orders || 0 }}</div>
            <div class="stat-label">今日订单</div>
          </div>

          <div class="stat-card card">
            <div class="stat-icon avg-icon">
              <van-icon name="chart-trending-o" size="22" />
            </div>
            <div class="stat-value">¥{{ formatPrice(stats.avg_order_value) }}</div>
            <div class="stat-label">客单价</div>
          </div>
        </div>

        <!-- 热销菜品排行 -->
        <div class="hot-section">
          <div class="section-title">热销菜品排行</div>
          <div v-if="hotDishes.length === 0" class="empty-hot">
            暂无销售数据
          </div>
          <div v-else class="hot-list card">
            <div
              v-for="(dish, idx) in hotDishes"
              :key="idx"
              class="hot-item"
            >
              <div class="hot-rank" :class="rankClass(idx)">{{ idx + 1 }}</div>
              <div class="hot-info">
                <div class="hot-name">{{ dish.name }}</div>
                <div class="hot-sales">售出 {{ dish.sales || dish.count || 0 }} 份</div>
              </div>
              <div class="hot-amount">¥{{ formatPrice(dish.revenue || 0) }}</div>
            </div>
          </div>
        </div>

        <!-- 快捷入口 -->
        <div class="quick-nav">
          <div class="section-title">快捷操作</div>
          <div class="nav-grid">
            <div class="nav-item card" @click="router.push('/admin/orders')">
              <van-icon name="orders-o" size="28" color="#C2623F" />
              <span>订单管理</span>
            </div>
            <div class="nav-item card" @click="router.push('/admin/dishes')">
              <van-icon name="apps-o" size="28" color="#C2623F" />
              <span>菜品管理</span>
            </div>
            <div class="nav-item card" @click="router.push('/admin/settings')">
              <van-icon name="setting-o" size="28" color="#C2623F" />
              <span>系统设置</span>
            </div>
            <div class="nav-item card" @click="router.push('/rider')">
              <van-icon name="logistics" size="28" color="#1677FF" />
              <span>骑手端</span>
            </div>
            <div class="nav-item card" @click="router.push('/')">
              <van-icon name="point-gift-o" size="28" color="#C2623F" />
              <span>顾客点单</span>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import { getAdminStats } from '../../api'
import { useOrderNotify } from '../../composables/useOrderNotify'

const router = useRouter()

// 老板端令牌存储 key
// 使用共享密码（与骑手端共用），存储在 localStorage 中作为 token
const TOKEN_KEY = 'owner_token'
const DEFAULT_OWNER_PASSWORD = 'baji-2026'

const authed = ref(false)
const password = ref('')
const loading = ref(false)
const loadError = ref('')
const stats = ref({})
const hotDishes = ref([])

// 实时订单通知（SSE）
const { connected, connect, disconnect } = useOrderNotify()

// 监听新订单 / 支付成功事件，自动刷新统计数据
function onOrderReceived() {
  loadStats()
}
function onOrderPaid() {
  loadStats()
}

onMounted(() => {
  window.addEventListener('order:received', onOrderReceived)
  window.addEventListener('order:paid', onOrderPaid)
  // 检查 localStorage 中是否已有 token，自动登录并验证
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    // 尝试用已有 token 加载数据，验证是否有效
    loadStats().then(() => {
      authed.value = true
      connect()
    }).catch(() => {
      // token 无效，清除
      localStorage.removeItem(TOKEN_KEY)
    })
  }
})
onUnmounted(() => {
  window.removeEventListener('order:received', onOrderReceived)
  window.removeEventListener('order:paid', onOrderPaid)
  disconnect()
})

const todayStr = computed(() => {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
})

function formatPrice(val) {
  return Number(val || 0).toFixed(2)
}

function rankClass(idx) {
  if (idx === 0) return 'rank-gold'
  if (idx === 1) return 'rank-silver'
  if (idx === 2) return 'rank-bronze'
  return ''
}

// 登录验证（通过后端 API 验证密码）
async function handleLogin() {
  if (!password.value) {
    showToast('请输入密码')
    return
  }
  loading.value = true
  try {
    // 先把密码存入 localStorage，API 请求拦截器会读取它作为 token
    localStorage.setItem(TOKEN_KEY, password.value)
    // 调用需要认证的接口验证密码是否正确
    const data = await getAdminStats()
    stats.value = data.stats || data.data || data || {}
    hotDishes.value =
      stats.value.hot_dishes || stats.value.top_dishes || data.hot_dishes || []
    authed.value = true
    password.value = ''
    showToast({ type: 'success', message: '登录成功' })
    // 登录后建立 SSE 实时推送连接
    connect()
  } catch (e) {
    // 密码错误，清除无效 token
    localStorage.removeItem(TOKEN_KEY)
    if (e.response?.status === 401 || e.response?.status === 403) {
      showToast('密码错误')
    } else {
      showToast('连接失败，请检查网络')
    }
  } finally {
    loading.value = false
  }
}

// 退出登录
function handleLogout() {
  showConfirmDialog({
    title: '提示',
    message: '确定要退出登录吗？'
  })
    .then(() => {
      localStorage.removeItem(TOKEN_KEY)
      authed.value = false
      stats.value = {}
      hotDishes.value = []
      showToast('已退出登录')
    })
    .catch(() => {})
}

// 加载统计数据
async function loadStats() {
  loading.value = true
  loadError.value = ''
  try {
    const data = await getAdminStats()
    stats.value = data.stats || data.data || data || {}
    hotDishes.value =
      stats.value.hot_dishes || stats.value.top_dishes || data.hot_dishes || []
  } catch (e) {
    if (e.response?.status === 401 || e.response?.status === 403) {
      // token 失效，回到登录
      localStorage.removeItem(TOKEN_KEY)
      authed.value = false
    } else {
      loadError.value = e.response?.data?.message || '数据加载失败'
    }
    throw e // 重新抛出错误，让调用方知道加载失败
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.dashboard-page {
  min-height: 100vh;
  background-color: var(--color-bg);
  padding-bottom: 24px;
}

/* SSE 实时连接状态指示器 */
.sse-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sse-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.sse-badge.online {
  background-color: rgba(103, 178, 121, 0.9);
  color: #fff;
}

.sse-badge.offline {
  background-color: rgba(217, 83, 79, 0.9);
  color: #fff;
}

.sse-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.sse-dot.on {
  background-color: #fff;
  animation: pulse 1.5s infinite;
}

.sse-dot.off {
  background-color: #fff;
  opacity: 0.6;
}

.sse-text {
  font-size: 12px;
  color: inherit;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.8); }
}

/* 密码验证 */
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

/* 概览 banner */
.overview-banner {
  margin: 12px 16px 0;
  padding: 20px;
  background: linear-gradient(135deg, #C2623F, #D9886A);
  border-radius: var(--radius-lg);
  color: #fff;
}

.ob-title {
  font-size: 18px;
  font-weight: 700;
}

.ob-date {
  font-size: 13px;
  opacity: 0.85;
  margin-top: 4px;
}

/* 统计卡片 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  padding: 16px;
}

.stat-card {
  padding: 16px 8px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  color: #fff;
}

.revenue-icon {
  background-color: var(--color-primary);
}

.order-icon {
  background-color: #E0A93B;
}

.avg-icon {
  background-color: #67B279;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text);
  word-break: break-all;
}

.stat-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 4px;
}

/* 热销排行 */
.hot-section {
  padding: 0 16px;
}

.empty-hot {
  text-align: center;
  padding: 30px 0;
  color: var(--color-text-placeholder);
  font-size: 13px;
}

.hot-list {
  padding: 8px 16px;
}

.hot-item {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-divider);
  gap: 12px;
}

.hot-item:last-child {
  border-bottom: none;
}

.hot-rank {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  background-color: #E5DDD5;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.rank-gold {
  background-color: #F0B400;
  color: #fff;
}

.rank-silver {
  background-color: #B0B0B0;
  color: #fff;
}

.rank-bronze {
  background-color: #CD7F32;
  color: #fff;
}

.hot-info {
  flex: 1;
  min-width: 0;
}

.hot-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.hot-sales {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.hot-amount {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-primary);
  flex-shrink: 0;
}

/* 快捷入口 */
.quick-nav {
  padding: 0 16px;
  margin-top: 8px;
}

.nav-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.nav-item {
  padding: 20px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: transform 0.1s;
}

.nav-item:active {
  transform: scale(0.96);
}

.nav-item span {
  font-size: 12px;
  color: var(--color-text);
}
</style>
