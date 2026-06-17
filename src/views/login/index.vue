<template>
  <div class="login-container">
    <div class="login-card">
      <!-- Logo -->
      <img src="@/assets/logo.svg" alt="Logo" class="logo" />

      <!-- 标题 -->
      <h1 class="login-title">顶点体育</h1>

      <!-- 错误提示 -->
      <a-alert
        v-if="errorMsg"
        :message="errorMsg"
        type="error"
        show-icon
        closable
        class="login-alert"
        @close="errorMsg = ''"
      />

      <!-- 登录表单 -->
      <a-form
        :model="formState"
        :rules="rules"
        @finish="handleLogin"
        layout="vertical"
      >
        <a-form-item name="username">
          <a-input
            v-model:value="formState.username"
            size="large"
            placeholder="用户名"
          >
            <template #prefix>
              <UserOutlined class="input-icon" />
            </template>
          </a-input>
        </a-form-item>

        <a-form-item name="password">
          <a-input-password
            v-model:value="formState.password"
            size="large"
            placeholder="密码"
          >
            <template #prefix>
              <LockOutlined class="input-icon" />
            </template>
          </a-input-password>
        </a-form-item>

        <a-form-item>
          <a-checkbox v-model:checked="formState.remember">记住我</a-checkbox>
        </a-form-item>

        <a-form-item>
          <a-button
            type="primary"
            html-type="submit"
            size="large"
            :loading="loading"
            class="login-btn"
          >
            登录
          </a-button>
        </a-form-item>
      </a-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { UserOutlined, LockOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const loading = ref(false)
const errorMsg = ref('')

const formState = reactive({
  username: '',
  password: '',
  remember: true,
})

const rules = {
  username: [{ required: true, message: '请输入用户名' }],
  password: [{ required: true, message: '请输入密码' }],
}

// 记住我：恢复上次输入的用户名
onMounted(() => {
  const savedUsername = localStorage.getItem('remembered_username')
  if (savedUsername) {
    formState.username = savedUsername
  }
})

async function handleLogin() {
  errorMsg.value = ''
  loading.value = true

  try {
    await userStore.login({
      username: formState.username,
      password: formState.password,
    })

    // 记住我：存储或清除用户名
    if (formState.remember) {
      localStorage.setItem('remembered_username', formState.username)
    } else {
      localStorage.removeItem('remembered_username')
    }

    message.success('登录成功')
    const redirect = (route.query.redirect as string) || '/dashboard'
    router.push(redirect)
  } catch (err: unknown) {
    const error = err as Error
    errorMsg.value = error.message || '登录失败，请检查用户名和密码'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="less">
.login-container {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%);
}

.login-card {
  width: 400px;
  padding: 40px 24px 24px;
  background: @bg-card;
  border-radius: @border-radius-lg;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  text-align: center;

  .logo {
    width: 64px;
    height: 64px;
    margin-bottom: @space-md;
  }

  .login-title {
    font-size: @font-size-h1;
    font-weight: 600;
    margin-bottom: @space-xl;
    color: @text-color;
  }

  .login-alert {
    margin-bottom: @space-md;
    text-align: left;
  }

  .input-icon {
    color: @text-hint;
  }

  .login-btn {
    width: 100%;
    height: 40px;
    font-size: @font-size-base;
  }
}
</style>