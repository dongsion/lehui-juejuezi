import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'customer-login',
    component: () => import('../views/CustomerLogin.vue'),
    meta: { title: '登录', public: true }
  },
  {
    path: '/',
    name: 'order',
    component: () => import('../views/Order.vue'),
    meta: { title: '点单', requireCustomer: true }
  },
  {
    path: '/order/:id',
    name: 'order-detail',
    component: () => import('../views/OrderDetail.vue'),
    meta: { title: '订单详情' }
  },
  {
    path: '/payment/:orderId',
    name: 'payment',
    component: () => import('../views/Payment.vue'),
    meta: { title: '支付' }
  },
  {
    path: '/admin',
    name: 'admin-dashboard',
    component: () => import('../views/admin/Dashboard.vue'),
    meta: { title: '经营看板', public: true }
  },
  {
    path: '/admin/orders',
    name: 'admin-orders',
    component: () => import('../views/admin/OrderList.vue'),
    meta: { title: '订单管理', public: true }
  },
  {
    path: '/admin/dishes',
    name: 'admin-dishes',
    component: () => import('../views/admin/DishManage.vue'),
    meta: { title: '菜品管理', public: true }
  },
  {
    path: '/admin/settings',
    name: 'AdminSettings',
    component: () => import('../views/admin/Settings.vue'),
    meta: { title: '设置', public: true }
  },
  {
    path: '/rider',
    name: 'rider-dashboard',
    component: () => import('../views/admin/RiderDashboard.vue'),
    meta: { title: '骑手端', public: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

// 路由守卫：需要顾客登录的页面检查登录状态
router.beforeEach((to, from, next) => {
  if (to.meta.requireCustomer) {
    const token = localStorage.getItem('customer_token')
    if (!token) {
      // 未登录，跳转到登录页，并记录来源
      next({
        path: '/login',
        query: { redirect: to.fullPath }
      })
      return
    }
  }
  next()
})

router.afterEach((to) => {
  if (to.meta?.title) {
    document.title = `${to.meta.title} · 乐荟绝绝子`
  }
})

export default router
