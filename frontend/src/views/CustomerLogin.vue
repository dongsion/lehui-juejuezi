<template>
  <div class="login-page">
    <!-- 顶部品牌区域 -->
    <div class="brand-banner">
      <div class="brand-icon">
        <van-icon name="shop-o" size="40" color="#fff" />
      </div>
      <div class="brand-name">乐荟绝绝子</div>
      <div class="brand-slogan">手机登录，点单更便捷</div>
    </div>

    <!-- 登录表单 -->
    <div class="form-card card">
      <!-- 手机号 -->
      <div class="form-item">
        <div class="form-label">手机号</div>
        <div class="form-input-wrap">
          <van-field
            v-model="phone"
            type="tel"
            maxlength="11"
            placeholder="请输入手机号"
            :border="false"
            class="form-input"
            clearable
          >
            <template #left-icon>
              <van-icon name="phone-o" size="18" color="#C2623F" />
            </template>
          </van-field>
        </div>
      </div>

      <!-- 验证码 -->
      <div class="form-item">
        <div class="form-label">验证码</div>
        <div class="code-row">
          <van-field
            v-model="code"
            type="digit"
            maxlength="4"
            placeholder="请输入验证码"
            :border="false"
            class="form-input code-input"
            clearable
          >
            <template #left-icon>
              <van-icon name="shield-o" size="18" color="#C2623F" />
            </template>
          </van-field>
          <button
            class="send-code-btn"
            :disabled="counting > 0 || sendingCode || !isPhoneValid"
            @click="handleSendCode"
          >
            {{ counting > 0 ? `${counting}s` : (sendingCode ? '发送中...' : '获取验证码') }}
          </button>
        </div>
      </div>

      <!-- 登录按钮 -->
      <van-button
        block
        round
        type="primary"
        size="large"
        class="login-btn"
        :loading="logging"
        loading-text="登录中..."
        :disabled="!isPhoneValid || !code"
        @click="handleLogin"
      >
        登录 / 注册
      </van-button>

      <!-- 说明 -->
      <div class="login-tips">
        <van-icon name="info-o" size="12" />
        <span>未注册的手机号将自动创建账号，验证码请查看弹窗提示</span>
      </div>
    </div>

    <!-- 调试验证码弹窗（模拟短信） -->
    <van-dialog
      v-model:show="showCodeDialog"
      title="验证码"
      confirmButtonText="知道了"
      :show-cancel-button="false"
    >
      <div class="code-dialog-body">
        <div class="code-dialog-hint">您的验证码是：</div>
        <div class="code-dialog-value">{{ sentCode }}</div>
        <div class="code-dialog-tip">（模拟短信，正式环境将发送到手机）</div>
      </div>
    </van-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showToast } from 'vant'
import { sendCode, customerLogin } from '../api'

const router = useRouter()
const route = useRoute()

const phone = ref('')
const code = ref('')
const counting = ref(0)
const sendingCode = ref(false)
const logging = ref(false)
const sentCode = ref('')
const showCodeDialog = ref(false)

let countdownTimer = null

const isPhoneValid = computed(() => /^1[3-9]\d{9}$/.test(phone.value))

// 发送验证码
async function handleSendCode() {
  if (!isPhoneValid.value) {
    showToast('请输入正确的手机号')
    return
  }

  sendingCode.value = true
  try {
    const res = await sendCode(phone.value)
    // 模拟环境：后端直接返回验证码
    if (res.debug_code) {
      sentCode.value = res.debug_code
      showCodeDialog.value = true
    }
    showToast({ type: 'success', message: '验证码已发送' })
    startCountdown()
  } catch (e) {
    showToast(e.response?.data?.message || '发送失败，请重试')
  } finally {
    sendingCode.value = false
  }
}

// 开始倒计时
function startCountdown() {
  counting.value = 60
  countdownTimer = setInterval(() => {
    counting.value--
    if (counting.value <= 0) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  }, 1000)
}

// 登录
async function handleLogin() {
  if (!isPhoneValid.value) {
    showToast('请输入正确的手机号')
    return
  }
  if (!code.value) {
    showToast('请输入验证码')
    return
  }

  logging.value = true
  try {
    const res = await customerLogin(phone.value, code.value)
    // 存储顾客信息
    localStorage.setItem('customer_token', res.token)
    localStorage.setItem('customer_id', res.customer.id)
    localStorage.setItem('customer_phone', res.customer.phone)
    localStorage.setItem('customer_nickname', res.customer.nickname)

    showToast({ type: 'success', message: '登录成功' })

    // 跳转到来源页面或点单页
    const redirect = route.query.redirect || '/'
    router.replace(redirect)
  } catch (e) {
    showToast(e.response?.data?.message || '登录失败，请重试')
  } finally {
    logging.value = false
  }
}

onUnmounted(() => {
  if (countdownTimer) clearInterval(countdownTimer)
})
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background-color: var(--color-bg);
}

/* 品牌区域 */
.brand-banner {
  background: linear-gradient(135deg, #C2623F 0%, #D9886A 60%, #E0A93B 100%);
  padding: 48px 24px 40px;
  text-align: center;
  color: #fff;
  border-radius: 0 0 24px 24px;
}

.brand-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
}

.brand-name {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 2px;
}

.brand-slogan {
  font-size: 13px;
  opacity: 0.85;
  margin-top: 6px;
}

/* 表单卡片 */
.form-card {
  margin: -16px 16px 0;
  padding: 28px 20px;
  position: relative;
  z-index: 1;
}

.form-item {
  margin-bottom: 20px;
}

.form-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 8px;
}

.form-input-wrap {
  background: var(--color-bg);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.form-input {
  background: transparent;
  padding: 12px 14px;
}

/* 验证码行 */
.code-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.code-input {
  flex: 1;
  background: var(--color-bg);
  border-radius: var(--radius-sm);
}

.send-code-btn {
  flex-shrink: 0;
  height: 44px;
  padding: 0 16px;
  border: 1.5px solid var(--color-primary);
  border-radius: var(--radius-sm);
  background: var(--color-primary-bg);
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: opacity 0.2s;
}

.send-code-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  border-color: var(--color-border);
  color: var(--color-text-secondary);
  background: var(--color-bg);
}

/* 登录按钮 */
.login-btn {
  margin-top: 8px;
  font-weight: 600;
}

/* 说明 */
.login-tips {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 16px;
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.login-tips .van-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

/* 验证码弹窗 */
.code-dialog-body {
  text-align: center;
  padding: 20px;
}

.code-dialog-hint {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}

.code-dialog-value {
  font-size: 32px;
  font-weight: 700;
  color: var(--color-primary);
  letter-spacing: 8px;
  margin-bottom: 8px;
}

.code-dialog-tip {
  font-size: 12px;
  color: var(--color-text-placeholder);
}
</style>
