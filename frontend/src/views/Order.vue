<template>
  <div class="order-page">
    <!-- 顶部店招 banner（渐变） -->
    <div class="shop-banner">
      <div class="banner-inner">
        <div class="shop-name">小暖咖啡馆</div>
        <div class="shop-slogan">每一杯，都是温暖的相遇</div>
      </div>
      <div class="banner-decoration"></div>
    </div>

    <!-- 菜单区域：左侧分类侧边栏 + 右侧菜品列表 -->
    <div class="menu-wrap">
      <!-- 加载状态 -->
      <div v-if="loading" class="state-wrap">
        <van-loading type="spinner" color="#C2623F">正在加载菜单...</van-loading>
      </div>

      <div v-else-if="loadError" class="state-wrap">
        <div class="state-icon">:(</div>
        <p>{{ loadError }}</p>
        <van-button size="small" plain type="primary" @click="loadMenu">
          重新加载
        </van-button>
      </div>

      <div v-else class="menu-content">
        <!-- 左侧分类侧边栏 -->
        <div class="sidebar">
          <div
            v-for="(cat, idx) in categories"
            :key="cat.id"
            class="sidebar-item"
            :class="{ active: activeIndex === idx }"
            @click="activeIndex = idx"
          >
            {{ cat.name }}
            <span v-if="categoryCount(cat.id) > 0" class="cat-badge">
              {{ categoryCount(cat.id) }}
            </span>
          </div>
        </div>

        <!-- 右侧菜品列表 -->
        <div class="dish-list" ref="dishListRef">
          <div class="cat-header">{{ currentCategory?.name || '' }}</div>

          <div
            v-for="dish in currentDishes"
            :key="dish.id"
            class="dish-card card"
          >
            <div class="dish-info">
              <div class="dish-name">{{ dish.name }}</div>
              <div v-if="dish.description" class="dish-desc">
                {{ dish.description }}
              </div>
              <div class="dish-bottom">
                <div class="dish-price">
                  <span class="price-symbol">¥</span>{{ formatPrice(dish.price) }}
                </div>
              </div>
            </div>

            <div class="dish-action">
              <template v-if="cart.getQty(dish.id) > 0">
                <div class="qty-control">
                  <button class="qty-btn minus" @click="cart.decreaseItem(dish)">
                    <van-icon name="minus" size="13" />
                  </button>
                  <span class="qty-num">{{ cart.getQty(dish.id) }}</span>
                </div>
              </template>
              <button class="qty-btn plus" @click="cart.addItem(dish)">
                <van-icon name="plus" size="13" />
              </button>
            </div>
          </div>

          <div v-if="currentDishes.length === 0" class="empty-cat">
            该分类暂无菜品
          </div>
        </div>
      </div>
    </div>

    <!-- 底部固定购物车栏 -->
    <div class="cart-bar" v-if="!loading && !loadError">
      <div class="cart-icon-wrap" @click="showCartSheet = true">
        <div class="cart-icon-badge" :class="{ has: cart.totalCount > 0 }">
          <van-icon name="shopping-cart-o" size="22" />
          <span v-if="cart.totalCount > 0" class="cart-count">
            {{ cart.totalCount }}
          </span>
        </div>
      </div>
      <div class="cart-amount" @click="showCartSheet = true">
        <template v-if="cart.totalCount > 0">
          <span class="amount-symbol">¥</span>{{ formatPrice(cart.totalPrice) }}
        </template>
        <template v-else>
          <span class="cart-empty-text">购物车是空的</span>
        </template>
      </div>
      <button
        class="checkout-btn"
        :disabled="cart.isEmpty"
        @click="showCartSheet = true"
      >
        去结算
      </button>
    </div>

    <!-- 购物车详情弹窗 -->
    <van-action-sheet
      v-model:show="showCartSheet"
      title="购物车"
      :close-on-click-action="false"
      class="cart-sheet"
    >
      <div class="cart-sheet-body">
        <div v-if="cart.isEmpty" class="cart-sheet-empty">
          <van-icon name="shopping-cart-o" size="48" color="#ddd" />
          <p>还没有选购任何商品</p>
        </div>

        <div v-else class="cart-items">
          <div
            v-for="item in cart.items"
            :key="item.id"
            class="cart-item"
          >
            <div class="ci-info">
              <div class="ci-name">{{ item.name }}</div>
              <div class="ci-desc" v-if="item.description">{{ item.description }}</div>
            </div>
            <div class="ci-price">¥{{ formatPrice(item.price) }}</div>
            <div class="ci-qty">
              <button class="qty-btn minus" @click="cart.decreaseItem(item)">
                <van-icon name="minus" size="13" />
              </button>
              <span class="qty-num">{{ item.qty }}</span>
              <button class="qty-btn plus" @click="cart.addItem(item)">
                <van-icon name="plus" size="13" />
              </button>
            </div>
          </div>
        </div>

        <div v-if="!cart.isEmpty" class="cart-sheet-footer">
          <div class="clear-btn" @click="handleClear">
            <van-icon name="delete-o" /> 清空
          </div>
          <div class="cs-total">
            合计 <span class="price"><span class="price-symbol">¥</span>{{ formatPrice(cart.totalPrice) }}</span>
          </div>
          <button class="submit-btn" :disabled="submitting" @click="handleSubmit">
            {{ submitting ? '提交中...' : '提交订单' }}
          </button>
        </div>
      </div>
    </van-action-sheet>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import { getMenu, createOrder } from '../api'
import { useCartStore } from '../stores/cart'

defineOptions({ name: 'OrderPage' })

const router = useRouter()
const cart = useCartStore()

const loading = ref(true)
const loadError = ref('')
const categories = ref([])
const activeIndex = ref(0)
const showCartSheet = ref(false)
const submitting = ref(false)

// ============ 顾客端菜单 SSE — 监听商家修改菜单后实时刷新 ============
let menuEventSource = null
let menuReconnectTimer = null

function connectMenuStream() {
  const apiBase = import.meta.env.VITE_API_BASE || '/api'
  menuEventSource = new EventSource(`${apiBase}/menu/stream`)

  menuEventSource.addEventListener('connected', () => {
    console.log('[菜单SSE] 已连接菜单实时更新服务')
  })

  menuEventSource.addEventListener('menu_update', () => {
    console.log('[菜单SSE] 收到菜单更新通知，自动刷新菜单')
    // 静默刷新菜单（不显示 loading）
    refreshMenu()
  })

  menuEventSource.onerror = () => {
    console.warn('[菜单SSE] 连接断开，10 秒后重连')
    if (menuEventSource) menuEventSource.close()
    clearTimeout(menuReconnectTimer)
    menuReconnectTimer = setTimeout(() => {
      connectMenuStream()
    }, 10000)
  }
}

function disconnectMenuStream() {
  clearTimeout(menuReconnectTimer)
  if (menuEventSource) {
    menuEventSource.close()
    menuEventSource = null
  }
}

// 当前分类
const currentCategory = computed(() => categories.value[activeIndex.value])

// 当前分类下的菜品（仅上架）
const currentDishes = computed(() => {
  const cat = currentCategory.value
  if (!cat) return []
  return (cat.dishes || []).filter((d) => d.status === 'on' || d.status === 1 || d.available !== false)
})

// 分类下菜品数量
function categoryCount(catId) {
  const cat = categories.value.find((c) => c.id === catId)
  if (!cat) return 0
  return (cat.dishes || []).filter(
    (d) => d.status === 'on' || d.status === 1 || d.available !== false
  ).length
}

// 格式化价格
function formatPrice(val) {
  return Number(val).toFixed(2)
}

// 加载菜单
async function loadMenu() {
  loading.value = true
  loadError.value = ''
  try {
    const data = await getMenu()
    // 兼容后端返回结构：{ categories: [...] } 或直接数组
    let cats = data.categories || data.data?.categories || data
    if (!Array.isArray(cats)) cats = []
    categories.value = cats.map((c) => ({
      id: c.id,
      name: c.name,
      dishes: c.dishes || []
    }))
    if (categories.value.length === 0) {
      loadError.value = '菜单暂无内容'
    }
  } catch (e) {
    loadError.value = e.response?.data?.message || '菜单加载失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

// 静默刷新菜单（SSE 收到更新通知后调用，不显示 loading）
async function refreshMenu() {
  try {
    const data = await getMenu()
    let cats = data.categories || data.data?.categories || data
    if (!Array.isArray(cats)) cats = []
    categories.value = cats.map((c) => ({
      id: c.id,
      name: c.name,
      dishes: c.dishes || []
    }))
    // 如果当前选中的分类超出范围，重置到第一个
    if (activeIndex.value >= categories.value.length) {
      activeIndex.value = 0
    }
  } catch (e) {
    console.warn('[菜单SSE] 静默刷新菜单失败:', e)
  }
}

// 清空购物车
function handleClear() {
  showConfirmDialog({
    title: '提示',
    message: '确定要清空购物车吗？'
  })
    .then(() => {
      cart.clear()
      showToast('已清空购物车')
    })
    .catch(() => {})
}

// 提交订单
async function handleSubmit() {
  if (cart.isEmpty) return
  submitting.value = true
  try {
    const payload = {
      items: cart.toOrderPayload()
    }
    const res = await createOrder(payload)
    const orderId = res.order_id || res.id || res.orderId
    // 下单成功后清空购物车并跳转订单详情
    cart.clear()
    showCartSheet.value = false
    showToast({ type: 'success', message: '下单成功' })
    router.push(`/order/${orderId}`)
  } catch (e) {
    showToast(e.response?.data?.message || '下单失败，请重试')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadMenu()
  // 连接菜单 SSE — 商家修改菜单后自动刷新
  connectMenuStream()
})

onUnmounted(() => {
  disconnectMenuStream()
})
</script>

<style scoped>
.order-page {
  min-height: 100vh;
  background-color: var(--color-bg);
  padding-bottom: 64px;
}

/* ===== 顶部店招 banner ===== */
.shop-banner {
  position: relative;
  background: linear-gradient(135deg, #C2623F 0%, #D9886A 60%, #E0A93B 100%);
  padding: 24px 20px 28px;
  overflow: hidden;
}

.banner-inner {
  position: relative;
  z-index: 1;
}

.shop-name {
  font-size: 24px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 2px;
}

.shop-slogan {
  margin-top: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  letter-spacing: 1px;
}

.banner-decoration {
  position: absolute;
  right: -30px;
  top: -30px;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
}

/* ===== 菜单区域 ===== */
.menu-wrap {
  position: relative;
}

.menu-content {
  display: flex;
  height: calc(100vh - 140px);
}

/* 左侧分类侧边栏 */
.sidebar {
  width: 92px;
  flex-shrink: 0;
  background-color: #F3EDE7;
  overflow-y: auto;
  padding-bottom: 40px;
}

.sidebar-item {
  position: relative;
  padding: 16px 10px;
  font-size: 13px;
  color: var(--color-text-secondary);
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  line-height: 1.4;
}

.sidebar-item.active {
  background-color: var(--color-bg);
  color: var(--color-primary);
  font-weight: 600;
}

.sidebar-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 18px;
  background-color: var(--color-primary);
  border-radius: 0 2px 2px 0;
}

.cat-badge {
  display: inline-block;
  font-size: 10px;
  color: var(--color-text-placeholder);
  margin-left: 2px;
}

/* 右侧菜品列表 */
.dish-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px 40px;
}

.cat-header {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  padding: 16px 4px 10px;
  position: sticky;
  top: 0;
  background-color: var(--color-bg);
  z-index: 2;
}

/* 菜品卡片：无图卡纸风格 */
.dish-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 14px;
  margin-bottom: 10px;
}

.dish-info {
  flex: 1;
  min-width: 0;
  padding-right: 10px;
}

.dish-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 4px;
}

.dish-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dish-bottom {
  display: flex;
  align-items: baseline;
}

.dish-price {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-primary);
}

.dish-action {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  align-self: flex-end;
}

.empty-cat {
  text-align: center;
  padding: 40px 0;
  color: var(--color-text-placeholder);
  font-size: 13px;
}

/* ===== 底部购物车栏 ===== */
.cart-bar {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 480px;
  height: 56px;
  background-color: #3D352F;
  display: flex;
  align-items: center;
  padding: 0 12px 0 16px;
  z-index: 100;
  box-shadow: var(--shadow-fixed);
}

.cart-icon-wrap {
  position: relative;
  width: 48px;
  height: 48px;
  margin-top: -20px;
  border-radius: 50%;
  background-color: #3D352F;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 3px solid var(--color-bg);
}

.cart-icon-badge {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background-color: #5a4f47;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
}

.cart-icon-badge.has {
  background-color: var(--color-primary);
  color: #fff;
}

.cart-count {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  line-height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background-color: #fff;
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 700;
  text-align: center;
}

.cart-amount {
  flex: 1;
  padding-left: 12px;
  color: #fff;
  font-size: 20px;
  font-weight: 700;
}

.amount-symbol {
  font-size: 13px;
  font-weight: 500;
  margin-right: 1px;
}

.cart-empty-text {
  font-size: 14px;
  font-weight: 400;
  color: #999;
}

.checkout-btn {
  height: 40px;
  padding: 0 24px;
  border: none;
  border-radius: 20px;
  background: linear-gradient(135deg, #C2623F, #D9886A);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.checkout-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ===== 购物车弹窗 ===== */
.cart-sheet-body {
  max-height: 60vh;
  display: flex;
  flex-direction: column;
}

.cart-sheet-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  color: var(--color-text-placeholder);
  gap: 12px;
}

.cart-items {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px;
}

.cart-item {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-divider);
  gap: 10px;
}

.ci-info {
  flex: 1;
  min-width: 0;
}

.ci-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.ci-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ci-price {
  font-size: 14px;
  color: var(--color-primary);
  font-weight: 600;
  flex-shrink: 0;
}

.ci-qty {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.cart-sheet-footer {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-top: 1px solid var(--color-border);
  gap: 12px;
}

.clear-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--color-text-secondary);
  cursor: pointer;
  flex-shrink: 0;
}

.cs-total {
  flex: 1;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.cs-total .price {
  font-size: 18px;
}

.submit-btn {
  height: 38px;
  padding: 0 22px;
  border: none;
  border-radius: 19px;
  background: linear-gradient(135deg, #C2623F, #D9886A);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
}

.submit-btn:disabled {
  opacity: 0.5;
}
</style>
