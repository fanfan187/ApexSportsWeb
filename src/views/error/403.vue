<template>
  <div class="error-page">
    <a-result
      status="403"
      title="403"
      sub-title="抱歉，您没有权限访问此页面。"
    >
      <template #extra>
        <a-button type="primary" @click="$router.push('/dashboard')">返回首页</a-button>
      </template>
    </a-result>
  </div>
</template>

<style scoped>
.error-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
