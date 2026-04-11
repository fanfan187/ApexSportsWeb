import type { Directive } from 'vue'
import { useUserStore } from '@/stores/user'

/**
 * v-permission 权限指令
 * 用法: v-permission="1" — 仅管理员可见
 * 非目标角色的元素会在 mounted 时从 DOM 中移除
 */
export const vPermission: Directive<HTMLElement, number> = {
  mounted(el, binding) {
    const userStore = useUserStore()
    const requiredRole = binding.value
    if (requiredRole !== undefined && userStore.userInfo?.role !== requiredRole) {
      el.parentNode?.removeChild(el)
    }
  },
}