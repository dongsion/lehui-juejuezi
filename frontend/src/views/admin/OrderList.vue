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
      <van-tab title="待核实" name="verifying" />
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
              <div class="oc-no">
                订单号：{{ order.order_no || order.id }}
              </div>
              <div class="oc-time">{{ formatTime(order.created_at) }}</div>
            </div>
            <div class="oc-right">
              <span v-if="order.pickup_code" class="pickup-code-badge">
                取餐码 {{ order.pickup_code }}
              </span>
              <van-tag :type="statusTagType(order.payment_status || order.status, order.status)" plain size="medium">
                {{ statusText(order.payment_status || order.status, order.status) }}
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
            <div class="oc-dishes">
              <van-tag v-if="order.dine_type" plain size="mini" type="primary" style="margin-right: 6px">
                {{ order.dine_type === 'takeout' ? '外带' : '堂食' }}
              </van-tag>
              <van-tag v-if="order.table_number" plain size="mini" type="warning" style="margin-right: 6px">
                桌号{{ order.table_number }}
              </van-tag>
              {{ dishSummary(order) }}
            </div>
            <div class="oc-amount">
              <span class="oc-amount-label">合计</span>
              <span class="oc-amount-value">¥{{ formatPrice(order.total_amount || order.total_price || order.total) }}</span>
            </div>
          </div>

          <!-- 顾客信息 -->
          <div v-if="order.customer_nickname || order.customer_phone" class="oc-customer">
            <van-icon name="contact" size="12" />
            <span v-if="order.customer_nickname">{{ order.customer_nickname }}</span>
            <span v-if="order.customer_phone" class="oc-customer-phone">{{ maskPhone(order.customer_phone) }}</span>
          </div>

          <!-- 备注 -->
          <div v-if="order.customer_note" class="oc-note">
            <van-icon name="comment-o" size="12" /> 备注：{{ order.customer_note }}
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
                v-if="order.payment_status === 'verifying'"
                size="small"
                type="success"
                :loading="actionId === order.id"
                @click="handleConfirmPayment(order)"
              >
                确认到账
              </van-button>
              <van-button
                v-if="order.payment_status === 'verifying'"
                size="small"
                plain
                type="warning"
                :loading="actionId === order.id"
                @click="handleRejectPayment(order)"
              >
                未到账
              </van-button>
              <van-button
                size="small"
                plain
                type="primary"
                @click="goDetail(order.id)"
              >
                查看详情
              </van-button>
              <van-button
                v-if="(order.status === 'confirmed' || order.status === 'delivering') && order.payment_status === 'paid'"
                size="small"
                type="success"
                :loading="actionId === order.id"
                @click="handleComplete(order)"
              >
                完成订单
              </van-button>
              <van-button
                v-if="order.status !== 'completed' && order.status !== 'cancelled'"
                size="small"
                plain
                type="danger"
                :loading="actionId === order.id"
                @click="handleCancel(order)"
              >
                取消订单
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
import { showToast, showConfirmDialog } from 'vant'
import { getAdminOrders, updateAdminOrderStatus, verifyAdminPayment } from '../../api'

const router = useRouter()

const activeTab = ref('all')
const loading = ref(false)
const refreshing = ref(false)
const orders = ref([])
const expandedId = ref(null)
const actionId = ref(null)

// 状态文字映射（综合 payment_status 和 status）
function statusText(paymentStatus, status) {
  if (status === 'cancelled') return '已取消'
  if (status === 'completed') return '已完成'
  if (status === 'delivering') return '配送中'
  if (paymentStatus === 'verifying') return '待核实'
  if (status === 'confirmed' && paymentStatus === 'paid') return '待配送'
  if (paymentStatus === 'paid') return '已支付'
  if (paymentStatus === 'unpaid') return '待支付'
  const map = {
    pending: '待支付',
    unpaid: '待支付',
    verifying: '待核实',
    paid: '已支付',
    completed: '已完成',
    cancelled: '已取消'
  }
  return map[paymentStatus] || paymentStatus
}

// 状态标签类型
function statusTagType(paymentStatus, status) {
  if (status === 'cancelled') return 'danger'
  if (status === 'completed') return 'success'
  if (status === 'delivering') return 'primary'
  if (paymentStatus === 'verifying') return 'warning'
  if (status === 'confirmed') return 'primary'
  if (paymentStatus === 'paid') return 'primary'
  if (paymentStatus === 'pending' || paymentStatus === 'unpaid') return 'warning'
  return 'default'
}

function formatPrice(val) {
  return Number(val || 0).toFixed(2)
}

// 手机号脱敏：138****1234
function maskPhone(phone) {
  if (!phone || phone.length !== 11) return phone
  return phone.slice(0, 3) + '****' + phone.slice(7)
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

// 确认到账
function handleConfirmPayment(order) {
  showConfirmDialog({
    title: '确认到账',
    message: `请确认订单「${order.order_no || order.id}」已真实到账 ¥${formatPrice(order.total_amount)}。确认后订单会进入待配送。`,
    confirmButtonText: '确认到账',
  })
    .then(async () => {
      actionId.value = order.id
      try {
        await verifyAdminPayment(order.id, 'confirm')
        showToast({ type: 'success', message: '已确认到账' })
        loadOrders()
      } catch (e) {
        showToast(e.response?.data?.message || '操作失败')
      } finally {
        actionId.value = null
      }
    })
    .catch(() => {})
}

// 驳回付款确认
function handleRejectPayment(order) {
  showConfirmDialog({
    title: '确认未到账',
    message: `确定订单「${order.order_no || order.id}」未收到款吗？驳回后订单会恢复为待支付。`,
    confirmButtonText: '确认未到账',
    confirmButtonColor: '#D9534F'
  })
    .then(async () => {
      actionId.value = order.id
      try {
        await verifyAdminPayment(order.id, 'reject')
        showToast({ type: 'success', message: '已驳回，订单恢复待支付' })
        loadOrders()
      } catch (e) {
        showToast(e.response?.data?.message || '操作失败')
      } finally {
        actionId.value = null
      }
    })
    .catch(() => {})
}

// 完成订单
function handleComplete(order) {
  showConfirmDialog({
    title: '确认完成',
    message: `确定要将订单「${order.order_no || order.id}」标记为已完成吗？`
  })
    .then(async () => {
      actionId.value = order.id
      try {
        await updateAdminOrderStatus(order.id, 'completed')
        showToast({ type: 'success', message: '订单已完成' })
        loadOrders()
      } catch (e) {
        showToast(e.response?.data?.message || '操作失败')
      } finally {
        actionId.value = null
      }
    })
    .catch(() => {})
}

// 取消订单
function handleCancel(order) {
  showConfirmDialog({
    title: '确认取消',
    message: `确定要取消订单「${order.order_no || order.id}」吗？取消后不可恢复。`,
    confirmButtonText: '确认取消',
    confirmButtonColor: '#D9534F'
  })
    .then(async () => {
      actionId.value = order.id
      try {
        await updateAdminOrderStatus(order.id, 'cancelled')
        showToast({ type: 'success', message: '订单已取消' })
        loadOrders()
      } catch (e) {
        showToast(e.response?.data?.message || '操作失败')
      } finally {
        actionId.value = null
      }
    })
    .catch(() => {})
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

.oc-note {
  margin-top: 8px;
  padding: 6px 10px;
  background: var(--color-primary-bg);
  border-radius: 6px;
  font-size: 12px;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
}

.oc-customer {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.oc-customer-phone {
  color: var(--color-text-placeholder);
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

/* 取餐码醒目标签 */
.pickup-code-badge {
  display: inline-flex;
  align-items: center;
  background: linear-gradient(135deg, #C2623F, #D9886A);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 6px;
  letter-spacing: 1px;
  box-shadow: 0 2px 6px rgba(194, 98, 63, 0.3);
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
  gap: 8px;
  flex-wrap: wrap;
}

.list-end {
  text-align: center;
  padding: 16px 0 24px;
  font-size: 12px;
  color: var(--color-text-placeholder);
}
</style>
