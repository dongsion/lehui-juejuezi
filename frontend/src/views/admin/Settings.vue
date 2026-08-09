<template>
  <div class="settings-page">
    <van-nav-bar
      title="系统设置"
      left-arrow
      @click-left="router.back()"
      fixed
      placeholder
    />

    <div class="settings-body">
      <div v-if="loading" class="state-wrap">
        <van-loading type="spinner" color="#C2623F">加载中...</van-loading>
      </div>

      <template v-else>
        <!-- 说明 -->
        <div class="tips-banner">
          <van-icon name="info-o" size="16" />
          <span>上传收款码后，顾客支付页面将自动显示最新收款码图片</span>
        </div>

        <!-- 微信收款码 -->
        <div class="qr-section">
          <div class="section-title">微信收款码</div>
          <div class="qr-card card">
            <div class="qr-preview">
              <img
                v-if="wechatQr"
                :src="resolveQrUrl(wechatQr)"
                alt="微信收款码"
                class="qr-img"
              />
              <div v-else class="qr-empty">
                <van-icon name="qr" size="48" color="#ccc" />
                <span>暂未设置</span>
              </div>
            </div>
            <div class="qr-channel-tag wechat-tag">
              <van-icon name="chat-o" size="14" />
              <span>微信支付</span>
            </div>
            <div class="qr-actions">
              <input
                ref="wechatInputRef"
                type="file"
                accept="image/*"
                style="display: none"
                @change="onFileSelect($event, 'wechat')"
              />
              <van-button
                block
                round
                type="primary"
                :loading="wechatUploading"
                :loading-text="'上传中...'"
                @click="triggerUpload('wechat')"
              >
                {{ wechatQr ? '更换微信收款码' : '上传微信收款码' }}
              </van-button>
            </div>
          </div>
        </div>

        <!-- 支付宝收款码 -->
        <div class="qr-section">
          <div class="section-title">支付宝收款码</div>
          <div class="qr-card card">
            <div class="qr-preview">
              <img
                v-if="alipayQr"
                :src="resolveQrUrl(alipayQr)"
                alt="支付宝收款码"
                class="qr-img"
              />
              <div v-else class="qr-empty">
                <van-icon name="qr" size="48" color="#ccc" />
                <span>暂未设置</span>
              </div>
            </div>
            <div class="qr-channel-tag alipay-tag">
              <van-icon name="gold-coin-o" size="14" />
              <span>支付宝</span>
            </div>
            <div class="qr-actions">
              <input
                ref="alipayInputRef"
                type="file"
                accept="image/*"
                style="display: none"
                @change="onFileSelect($event, 'alipay')"
              />
              <van-button
                block
                round
                type="primary"
                :loading="alipayUploading"
                :loading-text="'上传中...'"
                @click="triggerUpload('alipay')"
              >
                {{ alipayQr ? '更换支付宝收款码' : '上传支付宝收款码' }}
              </van-button>
            </div>
          </div>
        </div>

        <!-- 密码修改 -->
        <div class="qr-section">
          <div class="section-title">密码修改</div>
          <div class="password-card card">
            <div class="password-tips">
              <van-icon name="warning-o" size="14" />
              <span>商家端和骑手端共用此密码，修改后需重新登录</span>
            </div>
            <van-cell-group :border="false" class="password-form">
              <van-field
                v-model="pwdForm.old_password"
                type="password"
                label="旧密码"
                placeholder="请输入当前密码"
                :border="false"
                clearable
              />
              <van-field
                v-model="pwdForm.new_password"
                type="password"
                label="新密码"
                placeholder="至少6位"
                :border="false"
                clearable
              />
              <van-field
                v-model="pwdForm.confirm_password"
                type="password"
                label="确认新密码"
                placeholder="请再次输入新密码"
                :border="false"
                clearable
              />
            </van-cell-group>
            <van-button
              block
              round
              type="primary"
              :loading="pwdSaving"
              loading-text="保存中..."
              class="password-btn"
              @click="handleChangePassword"
            >
              保存密码
            </van-button>
          </div>
        </div>

        <!-- 底部提示 -->
        <div class="bottom-tips">
          <p>建议上传清晰的收款码截图，系统会自动压缩图片</p>
          <p>支持 JPG / PNG 格式，最大宽度 800px</p>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import { getQrCodes, uploadQrCode, changePassword } from '../../api'

const router = useRouter()

const loading = ref(false)
const wechatQr = ref('')
const alipayQr = ref('')
const wechatUploading = ref(false)
const alipayUploading = ref(false)
const wechatInputRef = ref(null)
const alipayInputRef = ref(null)

// 密码修改表单
const pwdForm = reactive({
  old_password: '',
  new_password: '',
  confirm_password: '',
})
const pwdSaving = ref(false)

// 图片版本号，用于上传后刷新缓存
const imgVersion = ref(Date.now())

// 解析收款码图片 URL（加版本号防止缓存）
function resolveQrUrl(path) {
  if (!path) return ''
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}v=${imgVersion.value}`
}

// 加载收款码设置
async function loadQrCodes() {
  loading.value = true
  try {
    const data = await getQrCodes()
    wechatQr.value = data.wechat_qr || ''
    alipayQr.value = data.alipay_qr || ''
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

// 触发文件选择
function triggerUpload(channel) {
  const inputEl = channel === 'wechat' ? wechatInputRef.value : alipayInputRef.value
  if (inputEl) {
    inputEl.value = ''
    inputEl.click()
  }
}

// 文件选择回调
async function onFileSelect(event, channel) {
  const file = event.target.files[0]
  if (!file) return

  // 校验文件类型
  if (!file.type.startsWith('image/')) {
    showToast('请选择图片文件')
    return
  }

  // 校验文件大小（限制 10MB）
  if (file.size > 10 * 1024 * 1024) {
    showToast('图片不能超过 10MB')
    return
  }

  const uploadingRef = channel === 'wechat' ? wechatUploading : alipayUploading
  uploadingRef.value = true

  try {
    // 压缩图片
    const compressedImage = await compressImage(file, 800, 0.8)

    // 上传到服务器
    const res = await uploadQrCode({ channel, image: compressedImage })

    // 更新本地显示
    if (channel === 'wechat') {
      wechatQr.value = res.path
    } else {
      alipayQr.value = res.path
    }
    // 刷新图片版本号
    imgVersion.value = Date.now()

    showToast({ type: 'success', message: '收款码更新成功' })
  } catch (e) {
    showToast(e.response?.data?.message || '上传失败，请重试')
  } finally {
    uploadingRef.value = false
  }
}

/**
 * 压缩图片到指定宽度
 * @param {File} file 图片文件
 * @param {number} maxWidth 最大宽度
 * @param {number} quality JPEG 质量 (0-1)
 * @returns {Promise<string>} base64 格式的图片数据
 */
function compressImage(file, maxWidth = 800, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img

        // 按最大宽度等比缩放
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')

        // 填充白色背景（防止透明 PNG 转 JPEG 变黑）
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, width, height)

        ctx.drawImage(img, 0, 0, width, height)

        // 统一转为 JPEG 格式
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        resolve(dataUrl)
      }
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = e.target.result
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

// 修改密码
async function handleChangePassword() {
  if (!pwdForm.old_password || !pwdForm.new_password || !pwdForm.confirm_password) {
    showToast('请填写完整密码信息')
    return
  }
  if (pwdForm.new_password.length < 6) {
    showToast('新密码至少6位')
    return
  }
  if (pwdForm.new_password !== pwdForm.confirm_password) {
    showToast('两次输入的新密码不一致')
    return
  }

  pwdSaving.value = true
  try {
    await changePassword({
      old_password: pwdForm.old_password,
      new_password: pwdForm.new_password,
    })
    showConfirmDialog({
      title: '密码修改成功',
      message: '共享密码已更新，商家端和骑手端都需要重新登录。是否立即退出？',
      confirmButtonText: '退出登录',
      cancelButtonText: '留在此页',
    })
      .then(() => {
        localStorage.removeItem('owner_token')
        router.replace('/admin')
      })
      .catch(() => {})
    pwdForm.old_password = ''
    pwdForm.new_password = ''
    pwdForm.confirm_password = ''
  } catch (e) {
    showToast(e.response?.data?.message || '密码修改失败')
  } finally {
    pwdSaving.value = false
  }
}

onMounted(() => {
  loadQrCodes()
})
</script>

<style scoped>
.settings-page {
  min-height: 100vh;
  background-color: var(--color-bg);
}

.settings-body {
  padding: 12px 16px 24px;
}

/* 说明 banner */
.tips-banner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 14px;
  background: var(--color-primary-bg);
  border-radius: var(--radius-sm);
  margin-bottom: 20px;
  font-size: 12px;
  color: var(--color-primary-dark);
  line-height: 1.6;
}

.tips-banner .van-icon {
  flex-shrink: 0;
  margin-top: 1px;
}

/* 收款码区块 */
.qr-section {
  margin-bottom: 24px;
}

.qr-section .section-title {
  padding: 0 0 10px;
}

/* 收款码卡片 */
.qr-card {
  padding: 20px;
  text-align: center;
}

.qr-preview {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 12px;
}

.qr-img {
  width: 220px;
  height: 220px;
  object-fit: contain;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-divider);
  background: #fff;
}

.qr-empty {
  width: 220px;
  height: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-placeholder);
  font-size: 13px;
}

/* 渠道标签 */
.qr-channel-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 16px;
}

.wechat-tag {
  background-color: rgba(7, 193, 96, 0.1);
  color: #07C160;
}

.alipay-tag {
  background-color: rgba(22, 119, 255, 0.1);
  color: #1677FF;
}

/* 上传按钮区域 */
.qr-actions {
  margin-top: 4px;
}

/* 密码修改卡片 */
.password-card {
  padding: 16px 0 20px;
}

.password-tips {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 16px 12px;
  font-size: 12px;
  color: var(--color-primary-dark);
}

.password-form {
  margin-bottom: 16px;
}

.password-btn {
  margin: 0 16px;
  width: calc(100% - 32px);
  font-weight: 600;
}

/* 底部提示 */
.bottom-tips {
  text-align: center;
  padding: 20px 0;
}

.bottom-tips p {
  font-size: 12px;
  color: var(--color-text-placeholder);
  line-height: 1.8;
}

/* 加载状态 */
.state-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
}
</style>
