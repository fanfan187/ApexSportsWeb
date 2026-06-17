<template>
  <a-layout class="admin-layout">
    <!-- 侧边栏 -->
    <a-layout-sider
      v-model:collapsed="collapsed"
      collapsible
      :width="208"
      :collapsed-width="64"
      breakpoint="lg"
      theme="dark"
      class="admin-sider"
    >
      <!-- Logo 区域 -->
      <div class="sider-logo" :class="{ 'sider-logo-collapsed': collapsed }">
        <img src="@/assets/logo.svg" alt="Logo" class="logo-img" />
        <span v-if="!collapsed" class="logo-title">ApexSports</span>
      </div>

      <!-- 导航菜单 -->
      <a-menu
        v-model:selectedKeys="selectedKeys"
        v-model:openKeys="openKeys"
        theme="dark"
        mode="inline"
        @click="handleMenuClick"
      >
        <a-menu-item key="/dashboard">
          <template #icon><HomeOutlined /></template>
          <span>首页概览</span>
        </a-menu-item>

        <a-sub-menu key="basic">
          <template #icon><TeamOutlined /></template>
          <template #title>基础管理</template>
          <a-menu-item key="/college">学院管理</a-menu-item>
          <a-menu-item key="/athlete">运动员管理</a-menu-item>
          <a-menu-item key="/user">用户管理</a-menu-item>
        </a-sub-menu>

        <a-sub-menu key="event-mgmt">
          <template #icon><TrophyOutlined /></template>
          <template #title>赛事管理</template>
          <a-menu-item key="/event">比赛项目管理</a-menu-item>
          <a-menu-item key="/referee">裁判管理</a-menu-item>
          <a-menu-item key="/venue">场地管理</a-menu-item>
          <a-menu-item key="/equipment">器材管理</a-menu-item>
        </a-sub-menu>

        <a-sub-menu key="registration">
          <template #icon><SolutionOutlined /></template>
          <template #title>报名管理</template>
          <a-menu-item key="/registration/individual">个人报名</a-menu-item>
          <a-menu-item key="/registration/team">团体报名</a-menu-item>
        </a-sub-menu>

        <a-sub-menu key="schedule-mgmt">
          <template #icon><CalendarOutlined /></template>
          <template #title>赛程管理</template>
          <a-menu-item key="/schedule">赛程安排</a-menu-item>
          <a-menu-item key="/schedule/booklet">秩序册</a-menu-item>
        </a-sub-menu>

        <a-sub-menu key="score-mgmt">
          <template #icon><FileProtectOutlined /></template>
          <template #title>成绩管理</template>
          <a-menu-item key="/score">成绩录入</a-menu-item>
          <a-menu-item key="/ranking">学院积分排名</a-menu-item>
        </a-sub-menu>

        <a-sub-menu key="record-mgmt">
          <template #icon><FileSearchOutlined /></template>
          <template #title>记录管理</template>
          <a-menu-item key="/record">历史记录</a-menu-item>
        </a-sub-menu>
      </a-menu>
    </a-layout-sider>

    <!-- 右侧内容区 -->
    <a-layout :style="{ marginLeft: collapsed ? '64px' : '208px', transition: 'margin-left 0.2s' }">
      <!-- 顶部 Header -->
      <a-layout-header class="admin-header" :style="{ left: collapsed ? '64px' : '208px' }">
        <div class="header-left">
          <span class="trigger" @click="collapsed = !collapsed">
            <MenuFoldOutlined v-if="!collapsed" />
            <MenuUnfoldOutlined v-else />
          </span>
          <img src="@/assets/logo.svg" alt="Logo" class="header-logo" />
          <span class="header-title">顶点体育</span>
        </div>

        <div class="header-right">
          <a-dropdown>
            <span class="user-info">
              <a-avatar :size="32" class="user-avatar">
                {{ userStore.userInfo?.realName?.charAt(0) || 'U' }}
              </a-avatar>
              <span class="user-name">{{ userStore.userInfo?.realName || '用户' }}</span>
              <DownOutlined />
            </span>
            <template #overlay>
              <a-menu @click="handleUserMenuClick">
                <a-menu-item key="password">
                  <KeyOutlined />
                  <span style="margin-left: 8px">修改密码</span>
                </a-menu-item>
                <a-menu-divider />
                <a-menu-item key="logout">
                  <LogoutOutlined />
                  <span style="margin-left: 8px">退出登录</span>
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </a-layout-header>

      <!-- 内容区 -->
      <a-layout-content class="admin-content">
        <!-- 面包屑 -->
        <a-breadcrumb class="content-breadcrumb">
          <a-breadcrumb-item>
            <router-link to="/dashboard">首页</router-link>
          </a-breadcrumb-item>
          <a-breadcrumb-item v-for="item in breadcrumbItems" :key="item.path">
            <router-link v-if="item.to" :to="item.to">{{ item.title }}</router-link>
            <span v-else class="breadcrumb-current">{{ item.title }}</span>
          </a-breadcrumb-item>
        </a-breadcrumb>

        <!-- 页面标题 -->
        <div class="content-header">
          <h2 class="page-title">{{ pageTitle }}</h2>
        </div>

        <!-- 路由视图 -->
        <div class="content-body">
          <router-view />
        </div>
      </a-layout-content>
    </a-layout>

    <!-- 修改密码 Modal -->
    <a-modal
      v-model:open="passwordModalVisible"
      title="修改密码"
      :confirm-loading="passwordLoading"
      @ok="handlePasswordSubmit"
      @cancel="resetPasswordForm"
    >
      <a-form
        ref="passwordFormRef"
        :model="passwordForm"
        :rules="passwordRules"
        :label-col="{ span: 6 }"
        :wrapper-col="{ span: 16 }"
        style="margin-top: 16px"
      >
        <a-form-item label="旧密码" name="oldPassword">
          <a-input-password
            v-model:value="passwordForm.oldPassword"
            placeholder="请输入旧密码"
          />
        </a-form-item>
        <a-form-item label="新密码" name="newPassword">
          <a-input-password
            v-model:value="passwordForm.newPassword"
            placeholder="请输入新密码（6~32字符）"
          />
        </a-form-item>
        <a-form-item label="确认密码" name="confirmPassword">
          <a-input-password
            v-model:value="passwordForm.confirmPassword"
            placeholder="请再次输入新密码"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </a-layout>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message, type FormInstance } from 'ant-design-vue'
import {
  HomeOutlined,
  TeamOutlined,
  TrophyOutlined,
  SolutionOutlined,
  CalendarOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DownOutlined,
  KeyOutlined,
  LogoutOutlined,
} from '@ant-design/icons-vue'
import { useUserStore } from '@/stores/user'
import { changePasswordApi } from '@/api/auth'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

// 侧边栏折叠状态
const collapsed = ref(false)

// 菜单选中与展开
const selectedKeys = ref<string[]>([route.path])
const openKeys = ref<string[]>([])

// 根据当前路由计算应展开的父菜单
const menuParentMap: Record<string, string> = {
  '/college': 'basic',
  '/athlete': 'basic',
  '/user': 'basic',
  '/event': 'event-mgmt',
  '/referee': 'event-mgmt',
  '/venue': 'event-mgmt',
  '/equipment': 'event-mgmt',
  '/registration/individual': 'registration',
  '/registration/team': 'registration',
  '/schedule': 'schedule-mgmt',
  '/schedule/booklet': 'schedule-mgmt',
  '/score': 'score-mgmt',
  '/ranking': 'score-mgmt',
  '/record': 'record-mgmt',
}

// 监听路由变化，更新菜单状态
watch(
  () => route.path,
  (path) => {
    selectedKeys.value = [path]
    const parentKey = menuParentMap[path]
    if (parentKey && !openKeys.value.includes(parentKey)) {
      openKeys.value = [parentKey]
    }
  },
  { immediate: true },
)

// 面包屑项
const breadcrumbItems = computed(() => {
  const matched = route.matched.filter((item) => item.meta?.title)
  // 跳过第一个（根路由 "/"）
  return matched.slice(1).map((item, index, arr) => ({
    path: item.path,
    title: item.meta.title as string,
    to: index < arr.length - 1 ? item.path : undefined,
  }))
})

// 页面标题
const pageTitle = computed(() => (route.meta?.title as string) || '')

// 菜单点击导航
function handleMenuClick({ key }: { key: string }) {
  router.push(key)
}

// 用户下拉菜单
function handleUserMenuClick({ key }: { key: string }) {
  if (key === 'logout') {
    userStore.logout()
  } else if (key === 'password') {
    passwordModalVisible.value = true
  }
}

// ===== 修改密码 =====
const passwordModalVisible = ref(false)
const passwordLoading = ref(false)
const passwordFormRef = ref<FormInstance>()

const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const passwordRules = {
  oldPassword: [{ required: true, message: '请输入旧密码' }],
  newPassword: [
    { required: true, message: '请输入新密码' },
    { min: 6, max: 32, message: '密码长度为6~32字符' },
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码' },
    {
      validator: (_rule: unknown, value: string) => {
        if (value && value !== passwordForm.newPassword) {
          return Promise.reject('两次输入的密码不一致')
        }
        return Promise.resolve()
      },
    },
  ],
}

async function handlePasswordSubmit() {
  try {
    await passwordFormRef.value?.validateFields()
  } catch {
    return
  }

  if (passwordForm.newPassword === passwordForm.oldPassword) {
    message.warning('新密码不能与旧密码相同')
    return
  }

  passwordLoading.value = true
  try {
    const userId = userStore.userInfo?.id
    if (!userId) return
    await changePasswordApi(userId, {
      oldPassword: passwordForm.oldPassword,
      newPassword: passwordForm.newPassword,
    })
    message.success('密码修改成功，请重新登录')
    passwordModalVisible.value = false
    resetPasswordForm()
    // 修改密码后要求重新登录
    userStore.logout()
  } catch {
    // 错误已由 request.ts 拦截器处理
  } finally {
    passwordLoading.value = false
  }
}

function resetPasswordForm() {
  passwordForm.oldPassword = ''
  passwordForm.newPassword = ''
  passwordForm.confirmPassword = ''
  passwordFormRef.value?.resetFields()
}

// 初始化：从 localStorage 恢复用户信息
onMounted(() => {
  userStore.loadFromStorage()
})
</script>

<style scoped lang="less">
.admin-layout {
  min-height: 100vh;
}

// 侧边栏
.admin-sider {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 10;
  overflow-y: auto;

  .sider-logo {
    height: @header-height;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 @space-md;
    gap: @space-sm;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    overflow: hidden;
    transition: all 0.2s;

    .logo-img {
      width: 36px;
      height: 36px;
      flex-shrink: 0;
    }

    .logo-title {
      font-size: 16px;
      font-weight: 600;
      color: #ffffff;
      white-space: nowrap;
      transition: opacity 0.2s;
    }
  }

  .sider-logo-collapsed {
    padding: 0;
    justify-content: center;

    .logo-title {
      opacity: 0;
      width: 0;
    }
  }
}

// Header
.admin-header {
  background: @bg-card;
  padding: 0 @space-lg;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid @border-color;
  position: fixed;
  top: 0;
  right: 0;
  transition: left 0.2s;
  z-index: 9;
  height: @header-height;
  line-height: @header-height;

  .header-left {
    display: flex;
    align-items: center;
    gap: @space-md;

    .trigger {
      font-size: 18px;
      cursor: pointer;
      padding: 0 @space-sm;
      transition: color 0.3s;
      line-height: @header-height;

      &:hover {
        color: @primary-color;
      }
    }

    .header-logo {
      width: 28px;
      height: 28px;
      flex-shrink: 0;
    }

    .header-title {
      font-size: 18px;
      font-weight: 600;
      color: @text-color;
    }
  }

  .header-right {
    .user-info {
      display: flex;
      align-items: center;
      gap: @space-sm;
      cursor: pointer;
      padding: 0 @space-sm;
      transition: background 0.3s;
      border-radius: @border-radius-base;
      height: 40px;

      &:hover {
        background: rgba(0, 0, 0, 0.025);
      }

      .user-avatar {
        background-color: @primary-color;
        font-size: 14px;
      }

      .user-name {
        font-size: @font-size-base;
        color: @text-color;
      }
    }
  }
}

// 内容区
.admin-content {
  margin-top: @header-height;
  min-height: calc(100vh - @header-height);

  .content-breadcrumb {
    padding: @space-md @content-padding 0;

    .breadcrumb-current {
      font-weight: 600;
      color: @text-color;
    }
  }

  .content-header {
    padding: @space-md @content-padding;
    display: flex;
    align-items: center;
    justify-content: space-between;

    .page-title {
      font-size: @font-size-h2;
      font-weight: 600;
      margin: 0;
      color: @text-color;
    }
  }

  .content-body {
    padding: 0 @content-padding @content-padding;
  }
}
</style>