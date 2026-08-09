import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'order',
    component: () => import('../views/Order.vue'),
    meta: { title: '点单' }
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
    meta: { title: '经营看板' }
  },
  {
    path: '/admin/orders',
    name: 'admin-orders',
    component: () => import('../views/admin/OrderList.vue'),
    meta: { title: '订单管理' }
  },
  {
    path: '/admin/dishes',
    name: 'admin-dishes',
    component: () => import('../views/admin/DishManage.vue'),
    meta: { title: '菜品管理' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

router.afterEach((to) => {
  if (to.meta?.title) {
    document.title = `${to.meta.title} · 小暖咖啡馆`
  }
})

export default router
