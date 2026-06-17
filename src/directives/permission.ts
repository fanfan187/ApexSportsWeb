import type { Directive } from 'vue'
import { useUserStore } from '@/stores/user'

/**
 * v-permission 权限指令
 * 用法: v-permission="1" — 仅管理员可见
 * 优先从 Pinia store 获取角色；若 store 未初始化则回退读取 localStorage
 */
export const vPermission: Directive<HTMLElement, number> = {
  mounted(el, binding) {
    const userStore = useUserStore()
    const requiredRole = binding.value

    // 优先从 store 获取角色，若 store 未初始化则回退读取 localStorage
    let userRole = userStore.userInfo?.role
    if (userRole === undefined || userRole === null) {
      try {
        const stored = localStorage.getItem('userInfo')
        if (stored) {
          userRole = JSON.parse(stored).role
        }
      } catch {
        // 解析失败不处理，保持 userRole 为 undefined
      }
    }

    if (requiredRole !== undefined && userRole !== requiredRole) {
      el.parentNode?.removeChild(el)
    }
  },
}