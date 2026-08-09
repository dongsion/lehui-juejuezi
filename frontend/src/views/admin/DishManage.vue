<template>
  <div class="dish-manage-page">
    <van-nav-bar
      title="菜品管理"
      left-arrow
      @click-left="router.back()"
      fixed
      placeholder
    >
      <template #right>
        <van-icon name="plus" size="20" color="#fff" @click="openAdd" />
      </template>
    </van-nav-bar>

    <div class="list-body">
      <div v-if="loading" class="state-wrap">
        <van-loading type="spinner" color="#C2623F">加载中...</van-loading>
      </div>

      <div v-else-if="categories.length === 0" class="state-wrap">
        <van-empty description="暂无菜品分类" />
      </div>

      <van-pull-refresh v-else v-model="refreshing" @refresh="loadDishes">
        <!-- 分类列表 -->
        <div
          v-for="cat in categories"
          :key="cat.id"
          class="cat-section"
        >
          <div class="cat-title">
            <span class="cat-name">{{ cat.name }}</span>
            <span class="cat-count">{{ cat.dishes?.length || 0 }} 个菜品</span>
          </div>

          <div v-if="!cat.dishes || cat.dishes.length === 0" class="cat-empty">
            该分类暂无菜品
          </div>

          <div
            v-for="dish in cat.dishes"
            :key="dish.id"
            class="dish-row card"
            :class="{ off: !isOn(dish) }"
          >
            <div class="dr-main">
              <div class="dr-top">
                <span class="dr-name">{{ dish.name }}</span>
                <van-tag
                  :type="isOn(dish) ? 'success' : 'default'"
                  size="mini"
                  plain
                >
                  {{ isOn(dish) ? '上架' : '下架' }}
                </van-tag>
              </div>
              <div class="dr-desc" v-if="dish.description">{{ dish.description }}</div>
              <div class="dr-price">¥{{ formatPrice(dish.price) }}</div>
            </div>

            <div class="dr-actions">
              <van-button
                size="mini"
                plain
                :type="isOn(dish) ? 'default' : 'primary'"
                @click="toggleShelf(dish)"
              >
                {{ isOn(dish) ? '下架' : '上架' }}
              </van-button>
              <van-button size="mini" plain type="primary" @click="openEdit(dish)">
                编辑
              </van-button>
              <van-button size="mini" plain type="danger" @click="handleDelete(dish)">
                删除
              </van-button>
            </div>
          </div>
        </div>

        <div class="list-end">— 菜品列表到底了 —</div>
      </van-pull-refresh>
    </div>

    <!-- 新增/编辑弹窗 -->
    <van-popup
      v-model:show="showForm"
      round
      position="bottom"
      :style="{ maxHeight: '80%' }"
      closeable
      close-icon-position="top-left"
    >
      <div class="form-wrap">
        <div class="form-title">{{ editing ? '编辑菜品' : '新增菜品' }}</div>

        <van-form @submit="handleSubmit" class="dish-form">
          <van-cell-group inset>
            <van-field
              v-model="form.name"
              label="菜品名称"
              placeholder="请输入菜品名称"
              :rules="[{ required: true, message: '请输入菜品名称' }]"
            />
            <van-field
              v-model="form.category"
              is-link
              readonly
              label="所属分类"
              placeholder="请选择分类"
              :rules="[{ required: true, message: '请选择分类' }]"
              @click="showCategoryPicker = true"
            />
            <van-field
              v-model="form.price"
              type="number"
              label="价格"
              placeholder="请输入价格（元）"
              :rules="[{ required: true, message: '请输入价格' }]"
            >
              <template #button>元</template>
            </van-field>
            <van-field
              v-model="form.description"
              type="textarea"
              label="描述"
              placeholder="请输入菜品描述（选填）"
              rows="2"
              autosize
              maxlength="100"
              show-word-limit
            />
          </van-cell-group>

          <div class="form-actions">
            <van-button block round plain @click="showForm = false">
              取消
            </van-button>
            <van-button block round type="primary" native-type="submit">
              {{ editing ? '保存' : '添加' }}
            </van-button>
          </div>
        </van-form>
      </div>
    </van-popup>

    <!-- 分类选择器 -->
    <van-popup v-model:show="showCategoryPicker" round position="bottom">
      <van-picker
        :columns="categoryColumns"
        @confirm="onCategoryConfirm"
        @cancel="showCategoryPicker = false"
        title="选择分类"
      />
    </van-popup>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import {
  getAdminDishes,
  addDish,
  updateDish,
  deleteDish
} from '../../api'

const router = useRouter()

const loading = ref(false)
const refreshing = ref(false)
const categories = ref([])
const showForm = ref(false)
const showCategoryPicker = ref(false)
const editing = ref(false)
const editingId = ref(null)

const form = ref({
  name: '',
  category: '',
  category_id: null,
  price: '',
  description: ''
})

// 分类选择列
const categoryColumns = computed(() =>
  categories.value.map((c) => ({
    text: c.name,
    value: c.id
  }))
)

// 判断菜品是否上架（后端返回 is_available: 1/0）
function isOn(dish) {
  return dish.is_available === 1 || dish.is_available === true
}

function formatPrice(val) {
  return Number(val || 0).toFixed(2)
}

// 加载菜品
async function loadDishes() {
  loading.value = true
  try {
    const data = await getAdminDishes()
    categories.value = data.categories || data.data?.categories || data || []
  } catch (e) {
    if (e.response?.status === 401 || e.response?.status === 403) {
      showToast('请先登录')
      router.replace('/admin')
    } else {
      showToast(e.response?.data?.message || '加载失败')
    }
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

// 打开新增
function openAdd() {
  editing.value = false
  editingId.value = null
  form.value = {
    name: '',
    category: '',
    category_id: null,
    price: '',
    description: ''
  }
  showForm.value = true
}

// 打开编辑
function openEdit(dish) {
  editing.value = true
  editingId.value = dish.id
  const cat = categories.value.find((c) =>
    c.dishes?.some((d) => d.id === dish.id)
  )
  form.value = {
    name: dish.name,
    category: cat?.name || '',
    category_id: cat?.id || null,
    price: String(dish.price),
    description: dish.description || ''
  }
  showForm.value = true
}

// 分类选择确认
function onCategoryConfirm({ selectedOptions }) {
  const selected = selectedOptions[0]
  if (selected) {
    form.value.category = selected.text
    form.value.category_id = selected.value
  }
  showCategoryPicker.value = false
}

// 提交表单
async function handleSubmit() {
  if (!form.value.name || !form.value.price) {
    showToast('请填写完整信息')
    return
  }
  const payload = {
    name: form.value.name,
    price: Number(form.value.price),
    description: form.value.description,
    category_id: form.value.category_id
  }

  try {
    if (editing.value) {
      await updateDish(editingId.value, payload)
      showToast({ type: 'success', message: '保存成功' })
    } else {
      await addDish(payload)
      showToast({ type: 'success', message: '添加成功' })
    }
    showForm.value = false
    loadDishes()
  } catch (e) {
    showToast(e.response?.data?.message || '操作失败')
  }
}

// 上下架切换
async function toggleShelf(dish) {
  const newAvailable = isOn(dish) ? 0 : 1
  try {
    await updateDish(dish.id, { is_available: newAvailable })
    showToast(isOn(dish) ? '已下架' : '已上架')
    loadDishes()
  } catch (e) {
    showToast(e.response?.data?.message || '操作失败')
  }
}

// 删除
function handleDelete(dish) {
  showConfirmDialog({
    title: '确认删除',
    message: `确定要删除「${dish.name}」吗？删除后不可恢复。`
  })
    .then(async () => {
      try {
        await deleteDish(dish.id)
        showToast({ type: 'success', message: '删除成功' })
        loadDishes()
      } catch (e) {
        showToast(e.response?.data?.message || '删除失败')
      }
    })
    .catch(() => {})
}

onMounted(() => {
  loadDishes()
})
</script>

<style scoped>
.dish-manage-page {
  min-height: 100vh;
  background-color: var(--color-bg);
}

.list-body {
  padding: 12px;
}

/* 分类区块 */
.cat-section {
  margin-bottom: 16px;
}

.cat-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 4px 10px;
}

.cat-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text);
}

.cat-count {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.cat-empty {
  text-align: center;
  padding: 20px 0;
  color: var(--color-text-placeholder);
  font-size: 13px;
  background: var(--color-card);
  border-radius: var(--radius-md);
}

/* 菜品行 */
.dish-row {
  display: flex;
  align-items: center;
  padding: 12px 14px;
  margin-bottom: 8px;
  gap: 10px;
}

.dish-row.off {
  opacity: 0.55;
}

.dr-main {
  flex: 1;
  min-width: 0;
}

.dr-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 3px;
}

.dr-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.dr-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dr-price {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-primary);
}

.dr-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.dr-actions .van-button {
  width: 56px;
}

/* 表单弹窗 */
.form-wrap {
  padding: 20px 0;
}

.form-title {
  font-size: 18px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 16px;
  color: var(--color-text);
}

.dish-form {
  padding-bottom: 12px;
}

.form-actions {
  display: flex;
  gap: 12px;
  padding: 16px;
}

.list-end {
  text-align: center;
  padding: 12px 0 24px;
  font-size: 12px;
  color: var(--color-text-placeholder);
}
</style>
