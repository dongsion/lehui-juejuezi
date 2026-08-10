import axios from 'axios'

// axios 实例
// - 开发环境: /api（vite proxy 转发到后端 3001）
// - 生产环境: 通过 Vercel rewrite 代理到 Railway 后端（仍用 /api）
// - 也支持 VITE_API_BASE 环境变量直接指定后端地址
const baseURL = import.meta.env.VITE_API_BASE || '/api'

const request = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器：admin 接口自动注入老板令牌，rider 接口注入骑手令牌
request.interceptors.request.use(
  (config) => {
    // /admin/* 接口需要 owner token
    if (config.url && config.url.startsWith('/admin')) {
      const token = localStorage.getItem('owner_token')
      if (token) {
        config.headers['x-owner-token'] = token
      }
    }
    // /rider/* 接口需要 rider token
    if (config.url && config.url.startsWith('/rider')) {
      const token = localStorage.getItem('rider_token')
      if (token) {
        config.headers['x-rider-token'] = token
      }
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 响应拦截器：统一处理业务码与错误提示
request.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      '网络异常，请稍后重试'
    // 这里不直接弹 Toast，交由调用方决定；仅做日志
    console.error('[API Error]', error.config?.url, message)
    return Promise.reject(error)
  }
)

export default request

/* ========== 顾客端 API ========== */

// 获取菜单
export const getMenu = () => request.get('/menu')

// 创建订单
export const createOrder = (data) => request.post('/orders', data)

// 获取订单详情
export const getOrder = (orderId) => request.get(`/orders/${orderId}`)

// 创建支付
export const createPayment = (data) => request.post('/payment/create', data)

// 确认支付（个人收款码模式）
export const confirmPayment = (data) => request.post('/payment/confirm', data)

// 查询支付状态
export const getPaymentStatus = (orderId) =>
  request.get(`/payment/status/${orderId}`)

/* ========== 老板端 API ========== */

// 经营统计
export const getAdminStats = () => request.get('/admin/stats')

// 订单列表
export const getAdminOrders = (status) =>
  request.get('/admin/orders', { params: status ? { status } : {} })

// 菜品列表（管理）
export const getAdminDishes = () => request.get('/admin/dishes')

// 新增菜品
export const addDish = (data) => request.post('/admin/dishes', data)

// 更新菜品
export const updateDish = (id, data) => request.put(`/admin/dishes/${id}`, data)

// 删除菜品
export const deleteDish = (id) => request.delete(`/admin/dishes/${id}`)

// 商家更新订单状态（completed | cancelled）
export const updateAdminOrderStatus = (id, status) =>
  request.put(`/admin/orders/${id}/status`, { status })

// 商家核实收款（confirm | reject）
export const verifyAdminPayment = (id, action) =>
  request.put(`/admin/orders/${id}/payment`, { action })

// 新增分类
export const addCategory = (data) => request.post('/admin/categories', data)

// 更新分类
export const updateCategory = (id, data) => request.put(`/admin/categories/${id}`, data)

// 删除分类
export const deleteCategory = (id) => request.delete(`/admin/categories/${id}`)

// 获取收款码设置
export function getQrCodes() {
  return request.get('/admin/qr-codes')
}

// 上传收款码
export function uploadQrCode(data) {
  return request.post('/admin/qr-codes', data)
}

// 修改共享密码
export function changePassword(data) {
  return request.post('/admin/change-password', data)
}

/* ========== 骑手端 API ========== */

// 骑手端订单列表（支持按状态筛选）
export const getRiderOrders = (status) =>
  request.get('/rider/orders', { params: status ? { status } : {} })

// 骑手更新订单配送状态（delivering | completed）
export const updateOrderStatus = (orderId, status) =>
  request.put(`/rider/orders/${orderId}/status`, { status })

/* ========== 顾客认证 API ========== */

const customerRequest = axios.create({
  baseURL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
})

// 顾客认证响应拦截器
customerRequest.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      '网络异常，请稍后重试'
    console.error('[Customer API Error]', error.config?.url, message)
    return Promise.reject(error)
  }
)

// 发送验证码
export function sendCode(phone) {
  return customerRequest.post('/customer/send-code', { phone })
}

// 顾客登录
export function customerLogin(phone, code) {
  return customerRequest.post('/customer/login', { phone, code })
}
