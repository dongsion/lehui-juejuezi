<template>
  <div class="payment-page">
    <van-nav-bar title="收银台" left-arrow @click-left="router.back()" fixed placeholder />

    <div v-if="loading" class="state-wrap">
      <van-loading type="spinner" color="#C2623F">加载订单信息...</van-loading>
    </div>

    <template v-else-if="order">
      <!-- 支付金额展示 -->
      <div class="amount-card">
        <div class="amount-label">应付金额</div>
        <div class="amount-value">
          <span class="price-symbol">¥</span>{{ formatPrice(currentAmount) }}
        </div>
        <div class="order-no">订单号：{{ order.order_no || order.id }}</div>
      </div>

      <!-- 第一步：选择支付方式 -->
      <div class="pay-methods" v-if="step === 'select'">
        <div class="methods-title">选择支付方式</div>

        <!-- 微信支付 -->
        <div
          class="pay-option"
          :class="{ active: selected === 'wechat' }"
          @click="selected = 'wechat'"
        >
          <div class="pay-icon wechat-icon">
            <van-icon name="chat-o" size="26" />
          </div>
          <div class="pay-info">
            <div class="pay-name">微信支付</div>
            <div class="pay-desc">推荐使用微信支付</div>
          </div>
          <div class="pay-radio">
            <van-icon v-if="selected === 'wechat'" name="checked" size="22" color="#C2623F" />
            <van-icon v-else name="circle" size="22" color="#ccc" />
          </div>
        </div>

        <!-- 支付宝 -->
        <div
          class="pay-option"
          :class="{ active: selected === 'alipay' }"
          @click="selected = 'alipay'"
        >
          <div class="pay-icon alipay-icon">
            <van-icon name="gold-coin-o" size="26" />
          </div>
          <div class="pay-info">
            <div class="pay-name">支付宝</div>
            <div class="pay-desc">支付宝安全支付</div>
          </div>
          <div class="pay-radio">
            <van-icon v-if="selected === 'alipay'" name="checked" size="22" color="#C2623F" />
            <van-icon v-else name="circle" size="22" color="#ccc" />
          </div>
        </div>
      </div>

      <!-- 第二步：显示收款码 -->
      <div class="qr-area" v-if="step === 'qrcode'">
        <div class="qr-card card">
          <!-- 渠道标识 -->
          <div class="qr-channel">
            <div class="qr-channel-icon" :class="selected === 'wechat' ? 'wechat-bg' : 'alipay-bg'">
              <van-icon :name="selected === 'wechat' ? 'chat-o' : 'gold-coin-o'" size="24" />
            </div>
            <div class="qr-channel-name">{{ payMethodName }}收款码</div>
          </div>

          <!-- 收款码图片 -->
          <div class="qr-image-wrap">
            <img :src="qrImage" :alt="payMethodName + '收款码'" class="qr-image" />
          </div>

          <!-- 金额提示 -->
          <div class="qr-amount">
            请扫码支付 <span class="price">¥{{ formatPrice(currentAmount) }}</span>
          </div>

          <!-- 提示文字 -->
          <div class="qr-tips">
            <p>1. 长按或截图保存二维码</p>
            <p>2. 打开{{ payMethodName }}扫一扫</p>
            <p>3. 输入金额 <strong>¥{{ formatPrice(currentAmount) }}</strong> 完成付款</p>
            <p>4. 付款完成后点击下方"我已支付"</p>
          </div>

          <!-- 我已支付按钮 -->
          <van-button
            block
            round
            type="primary"
            size="large"
            :loading="confirming"
            loading-text="确认中..."
            @click="handleConfirmPay"
            class="confirm-pay-btn"
          >
            我已支付 ¥{{ formatPrice(currentAmount) }}
          </van-button>

          <!-- 换一种支付方式 -->
          <div class="change-pay" @click="step = 'select'">
            换一种支付方式
          </div>
        </div>
      </div>

      <!-- 成功页面 -->
      <div class="success-area" v-if="step === 'success'">
        <div class="success-icon">
          <van-icon name="checked" size="64" color="#67B279" />
        </div>
        <div class="success-title">支付确认成功</div>
        <div class="success-desc">商家将尽快核实到账并确认订单</div>
        <van-button
          round
          type="primary"
          class="success-btn"
          @click="router.replace(`/order/${route.params.orderId}`)"
        >
          查看订单
        </van-button>
      </div>

      <!-- 确认支付按钮（选择阶段） -->
      <div class="confirm-bar" v-if="step === 'select'">
        <van-button
          block
          round
          type="primary"
          size="large"
          :disabled="!selected"
          @click="handleSelectPay"
        >
          确认支付 ¥{{ formatPrice(currentAmount) }}
        </van-button>
      </div>
    </template>

    <div v-else class="state-wrap">
      <div class="state-icon">:(</div>
      <p>订单信息加载失败</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { getOrder, createPayment, confirmPayment } from '../api'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const order = ref(null)
const selected = ref('') // wechat | alipay
const step = ref('select') // select | qrcode | success
const confirming = ref(false)
const qrImage = ref('')
const currentAmount = ref(0)

const payMethodName = computed(() =>
  selected.value === 'wechat' ? '微信' : '支付宝'
)

function formatPrice(val) {
  return Number(val || 0).toFixed(2)
}

// 加载订单信息
async function loadOrder() {
  loading.value = true
  try {
    const id = route.params.orderId
    const data = await getOrder(id)
    order.value = data.order || data.data || data
    currentAmount.value = order.value.total_amount || order.value.total_price || order.value.total || 0
  } catch (e) {
    showToast(e.response?.data?.message || '订单加载失败')
  } finally {
    loading.value = false
  }
}

// 选择支付方式后确认
async function handleSelectPay() {
  if (!selected.value) return
  step.value = 'qrcode'

  try {
    // 调用后端创建支付，获取收款码图片路径
    const res = await createPayment({
      order_id: route.params.orderId,
      channel: selected.value,
    })

    // 后端返回 qr_image 路径
    qrImage.value = res.qr_image || res.data?.qr_image || ''
    currentAmount.value = res.amount || res.data?.amount || currentAmount.value
  } catch (e) {
    showToast(e.response?.data?.message || '支付创建失败，请重试')
    step.value = 'select'
  }
}

// 顾客点击"我已支付"
async function handleConfirmPay() {
  confirming.value = true
  try {
    // 调用后端确认支付接口
    await confirmPayment({
      order_id: route.params.orderId,
    })

    step.value = 'success'
    showToast({ type: 'success', message: '支付确认成功' })
  } catch (e) {
    showToast(e.response?.data?.message || '确认失败，请重试')
  } finally {
    confirming.value = false
  }
}

onMounted(() => {
  loadOrder()
})
</script>

<style scoped>
.payment-page {
  min-height: 100vh;
  background-color: var(--color-bg);
  padding: 0 16px 100px;
}

/* 金额展示卡片 */
.amount-card {
  margin-top: 16px;
  padding: 36px 20px;
  background: linear-gradient(135deg, #C2623F, #D9886A);
  border-radius: var(--radius-lg);
  text-align: center;
  color: #fff;
}

.amount-label {
  font-size: 14px;
  opacity: 0.9;
}

.amount-value {
  font-size: 40px;
  font-weight: 700;
  margin: 8px 0;
}

.amount-value .price-symbol {
  font-size: 20px;
  font-weight: 500;
  vertical-align: top;
  line-height: 1.6;
}

.order-no {
  font-size: 12px;
  opacity: 0.8;
}

/* 支付方式 */
.pay-methods {
  margin-top: 20px;
}

.methods-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 12px;
  padding: 0 4px;
}

.pay-option {
  display: flex;
  align-items: center;
  padding: 16px;
  background: var(--color-card);
  border-radius: var(--radius-md);
  margin-bottom: 10px;
  gap: 14px;
  border: 2px solid transparent;
  transition: border-color 0.2s;
  cursor: pointer;
}

.pay-option.active {
  border-color: var(--color-primary);
}

.pay-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}

.wechat-icon {
  background-color: var(--color-wechat, #07C160);
}

.alipay-icon {
  background-color: var(--color-alipay, #1677FF);
}

.pay-info {
  flex: 1;
}

.pay-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
}

.pay-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.pay-radio {
  flex-shrink: 0;
}

/* 收款码区域 */
.qr-area {
  margin-top: 20px;
}

.qr-card {
  padding: 28px 20px;
  text-align: center;
}

.qr-channel {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 20px;
}

.qr-channel-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.wechat-bg {
  background-color: #07C160;
}

.alipay-bg {
  background-color: #1677FF;
}

.qr-channel-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
}

.qr-image-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}

.qr-image {
  width: 240px;
  height: 240px;
  object-fit: contain;
  border-radius: 12px;
  border: 1px solid var(--color-divider, #eee);
}

.qr-amount {
  font-size: 15px;
  color: var(--color-text);
  margin-bottom: 16px;
}

.qr-amount .price {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-primary, #C2623F);
}

.qr-tips {
  text-align: left;
  background: var(--color-bg, #f5f5f5);
  border-radius: 8px;
  padding: 14px 16px;
  margin-bottom: 24px;
}

.qr-tips p {
  font-size: 13px;
  color: var(--color-text-secondary, #999);
  line-height: 2;
  margin: 0;
}

.qr-tips strong {
  color: var(--color-primary, #C2623F);
}

.confirm-pay-btn {
  font-weight: 600;
}

.change-pay {
  margin-top: 16px;
  font-size: 13px;
  color: var(--color-text-secondary, #999);
  text-decoration: underline;
  cursor: pointer;
}

/* 成功页面 */
.success-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.success-icon {
  margin-bottom: 16px;
}

.success-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 8px;
}

.success-desc {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin-bottom: 24px;
}

.success-btn {
  min-width: 160px;
}

/* 确认支付按钮 */
.confirm-bar {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 480px;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  background: var(--color-card);
  box-shadow: var(--shadow-fixed, 0 -2px 8px rgba(0,0,0,0.06));
}

.state-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
}

.state-icon {
  font-size: 48px;
  color: #ccc;
  margin-bottom: 12px;
}
</style>
