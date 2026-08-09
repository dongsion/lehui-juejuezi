import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// 购物车状态管理
// - items: [{ id, name, price, description, qty }]
// - 提供加减、清空、汇总
export const useCartStore = defineStore('cart', () => {
  const items = ref([])

  // 选中总数量
  const totalCount = computed(() =>
    items.value.reduce((sum, i) => sum + i.qty, 0)
  )

  // 选中总金额（分 -> 元 由调用方处理，这里以元为单位）
  const totalPrice = computed(() =>
    items.value.reduce((sum, i) => sum + i.price * i.qty, 0)
  )

  // 是否为空
  const isEmpty = computed(() => items.value.length === 0)

  // 根据 id 查找
  function findItem(id) {
    return items.value.find((i) => i.id === id)
  }

  // 增加数量（菜品不存在则添加）
  function addItem(dish) {
    const existing = findItem(dish.id)
    if (existing) {
      existing.qty += 1
    } else {
      items.value.push({
        id: dish.id,
        name: dish.name,
        price: Number(dish.price),
        description: dish.description || '',
        qty: 1
      })
    }
  }

  // 减少数量（为 0 时移除）
  // 兼容传入菜品对象或纯 id
  function decreaseItem(target) {
    const id = typeof target === 'object' ? target.id : target
    const existing = findItem(id)
    if (!existing) return
    existing.qty -= 1
    if (existing.qty <= 0) {
      removeItem(id)
    }
  }

  // 设置指定菜品的数量
  function setQty(id, qty) {
    const existing = findItem(id)
    if (!existing) return
    if (qty <= 0) {
      removeItem(id)
    } else {
      existing.qty = qty
    }
  }

  // 获取某菜品数量
  function getQty(id) {
    return findItem(id)?.qty || 0
  }

  // 移除菜品
  function removeItem(id) {
    const idx = items.value.findIndex((i) => i.id === id)
    if (idx > -1) items.value.splice(idx, 1)
  }

  // 清空
  function clear() {
    items.value = []
  }

  // 导出下单所需格式（与后端 POST /api/orders 对齐）
  function toOrderPayload() {
    return items.value.map((i) => ({
      dish_id: i.id,
      quantity: i.qty
    }))
  }

  return {
    items,
    totalCount,
    totalPrice,
    isEmpty,
    addItem,
    decreaseItem,
    setQty,
    getQty,
    removeItem,
    clear,
    toOrderPayload
  }
})
