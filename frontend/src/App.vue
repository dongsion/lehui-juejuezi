<template>
  <div id="app-root">
    <router-view v-slot="{ Component }">
      <keep-alive include="OrderPage">
        <component :is="Component" />
      </keep-alive>
    </router-view>
  </div>
</template>

<script setup>
// 根组件：仅承载路由出口
// keep-alive 缓存点单首页，保留菜单浏览与购物车滚动位置
</script>

<style>
/* App 根容器：移动端居中，最大宽度 480px，模拟手机界面 */
#app-root {
  width: 100%;
  max-width: 480px;
  min-height: 100vh;
  margin: 0 auto;
  background-color: var(--color-bg);
  position: relative;
  box-shadow: 0 0 24px rgba(0, 0, 0, 0.06);
  overflow-x: hidden;
}

/* 大屏设备下为左右留出暗色背景，突出手机感 */
@media (min-width: 481px) {
  body {
    background-color: #ece7e1;
  }
}
</style>
