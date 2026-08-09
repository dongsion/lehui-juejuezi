<template>
  <div class="order-list-page">
    <van-nav-bar
      title="订单管理"
      left-arrow
      @click-left="router.back()"
      fixed
      placeholder
    />

    <!-- 状态筛选 Tab -->
    <van-tabs
      v-model:active="activeTab"
      sticky
      offset-top="46"
      @change="onTabChange"
    >
      <van-tab title="全部" name="all" />
      <van-tab title="待支付" name="pending" />
      <van-tab title="已支付" name="paid" />
      <van-tab title="已完成" name="completed" />
    </van-tabs>

    <!-- 订单列表 -->
    <div class="list-body">
      <div v-if="loading" class="state-wrap">
        <van-loading type="spinner" color="#C2623F">加载中...</van-loading>
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
          <div class="oc-header" @click="toggleExpand(order.id)">
            <div class="oc-left">
              <div class="oc-no">订单号：{{ order.order_no || order.id }}</div>
              <div class="oc-time">{{ formatTime(order.created_at) }}</div>
            </div>
            <div class="oc-right">
              <van-tag :type="statusTagType(order.payment_status || order.status)" plain size="medium">
                {{ statusText(order.payment_status || order.status) }}
              </van-tag>
              <van-icon
                :name="expandedId === order.id ? 'arrow-up' : 'arrow-down'"
                size="14"
                color="#999"
                class="oc-arrow"
              />
            </div>
          </div>

          <!-- 摘要（始终显示） -->
          <div class="oc-summary" @click="toggleExpand(order.id)">
            <div class="oc-dishes">{{ dishSummary(order) }}</div>
            <div class="oc-amount">
              <span class="oc-amount-label">合计</span>
              <span class="oc-amount-value">¥{{ formatPrice(order.total_amount || order.total_price || order.total) }}</span>
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
            <div class="oc-detail-actions">
              <van-button
                size="small"
                plain
                type="primary"
                @click="goDetail(order.id)"
              >
                查看详情
              </van-button>
            </div>
          </div>
        </div>

        <div v-if="orders.length > 0" class="list-end">
          — 没有更多了 —
        </div>
      </van-pull-refresh>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { getAdminOrders } from '../../api'

const router = useRouter()

const activeTab = ref('all')
const loading = ref(false)
const refreshing = ref(false)
const orders = ref([])
const expandedId = ref(null)

// 状态文字映射
function statusText(status) {
  const map = {
    pending: '待支付',
    unpaid: '待支付',
    paid: '已支付',
    completed: '已完成',
    cancelled: '已取消'
  }
  return map[status] || status
}

// 状态标签类型
function statusTagType(status) {
  const map = {
    pending: 'warning',
    unpaid: 'warning',
    paid: 'primary',
    completed: 'success',
    cancelled: 'danger'
  }
  return map[status] || 'default'
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

// 菜品摘要
function dishSummary(order) {
  if (!order.items || order.items.length === 0) return '无菜品'
  const names = order.items.map((i) => i.name).slice(0, 3).join('、')
  const extra = order.items.length > 3 ? ` 等${order.items.length}件` : ''
  return names + extra
}

// 展开/收起
function toggleExpand(id) {
  expandedId.value = expandedId.value === id ? null : id
}

// 跳转详情
function goDetail(id) {
  router.push(`/order/${id}`)
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
    const data = await getAdminOrders(status)
    orders.value = data.orders || data.data || data || []
  } catch (e) {
    if (e.response?.status === 401 || e.response?.status === 403) {
      showToast('请先登录')
      router.replace('/admin')
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
  showToast('刷新成功')
}

onMounted(() => {
  loadOrders()
})
</script>

<style scoped>
.order-list-page {
  min-height: 100vh;
  background-color: var(--color-bg);
}

.list-body {
  padding: 12px;
}

/* 订单卡片 */
.order-card {
  margin-bottom: 12px;
  padding: 14px 16px;
}

.oc-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  cursor: pointer;
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

.oc-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.oc-arrow {
  transition: transform 0.2s;
}

.oc-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--color-divider);
  cursor: pointer;
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

.oc-detail-actions {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}

.list-end {
  text-align: center;
  padding: 16px 0 24px;
  font-size: 12px;
  color: var(--color-text-placeholder);
}
</style>
