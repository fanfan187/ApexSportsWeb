import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  loginApi,
  logoutApi,
  type LoginParams,
  type UserInfo,
} from '@/api/auth'
import router from '@/router'

export const useUserStore = defineStore('user', () => {
  // State
  const token = ref<string>(localStorage.getItem('token') || '')
  const userInfo = ref<UserInfo | null>(null)

  // Getters
  const isLoggedIn = computed(() => !!token.value)
  const isAdmin = computed(() => userInfo.value?.role === 1)

  // Actions
  async function login(params: LoginParams) {
    const result = await loginApi(params)
    token.value = result.token
    userInfo.value = result.userInfo
    localStorage.setItem('token', result.token)
    localStorage.setItem('userInfo', JSON.stringify(result.userInfo))
  }

  async function logout() {
    try {
      await logoutApi()
    } finally {
      token.value = ''
      userInfo.value = null
      localStorage.removeItem('token')
      localStorage.removeItem('userInfo')
      router.push('/login')
    }
  }

  function loadFromStorage() {
    const stored = localStorage.getItem('userInfo')
    if (stored) {
      try {
        userInfo.value = JSON.parse(stored)
      } catch {
        localStorage.removeItem('userInfo')
      }
    }
  }

  return {
    token,
    userInfo,
    isLoggedIn,
    isAdmin,
    login,
    logout,
    loadFromStorage,
  }
})