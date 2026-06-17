import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'

NProgress.configure({ showSpinner: false })

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录', requiresAuth: false },
  },
  {
    path: '/',
    component: () => import('@/layouts/AdminLayout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '首页概览' },
      },
      {
        path: 'college',
        name: 'College',
        component: () => import('@/views/college/index.vue'),
        meta: { title: '学院管理' },
      },
      {
        path: 'athlete',
        name: 'Athlete',
        component: () => import('@/views/athlete/index.vue'),
        meta: { title: '运动员管理' },
      },
      {
        path: 'user',
        name: 'User',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '用户管理', requiredRole: 1 },
      },
      {
        path: 'event',
        name: 'Event',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '比赛项目管理' },
      },
      {
        path: 'referee',
        name: 'Referee',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '裁判管理' },
      },
      {
        path: 'venue',
        name: 'Venue',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '场地管理' },
      },
      {
        path: 'equipment',
        name: 'Equipment',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '器材管理' },
      },
      {
        path: 'registration/individual',
        name: 'RegIndividual',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '个人报名' },
      },
      {
        path: 'registration/team',
        name: 'RegTeam',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '团体报名' },
      },
      {
        path: 'schedule',
        name: 'Schedule',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '赛程安排' },
      },
      {
        path: 'schedule/booklet',
        name: 'ScheduleBooklet',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '秩序册' },
      },
      {
        path: 'score',
        name: 'Score',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '成绩录入' },
      },
      {
        path: 'ranking',
        name: 'Ranking',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '学院积分排名' },
      },
      {
        path: 'record',
        name: 'Record',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '历史记录' },
      },
    ],
  },
  {
    path: '/403',
    name: 'Forbidden',
    component: () => import('@/views/error/403.vue'),
    meta: { title: '无权限', requiresAuth: false },
  },
  {
    path: '/404',
    name: 'NotFound',
    component: () => import('@/views/error/404.vue'),
    meta: { title: '页面不存在', requiresAuth: false },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/404',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

const whiteList = ['/login', '/403', '/404']

router.beforeEach((to, _from, next) => {
  NProgress.start()

  const token = localStorage.getItem('token')

  if (whiteList.includes(to.path)) {
    if (token) {
      next('/dashboard')
    } else {
      next()
    }
  } else {
    if (token) {
      // 角色权限检查
      const requiredRole = to.meta?.requiredRole as number | undefined
      if (requiredRole !== undefined) {
        const userInfoStr = localStorage.getItem('userInfo')
        if (userInfoStr) {
          try {
            const userInfo = JSON.parse(userInfoStr)
            if (userInfo.role !== requiredRole) {
              next('/403')
              return
            }
          } catch {
            next('/403')
            return
          }
        } else {
          next('/403')
          return
        }
      }
      next()
    } else {
      next(`/login?redirect=${to.path}`)
    }
  }
})

router.afterEach(() => {
  NProgress.done()
})

export default router