import axios from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { message } from 'ant-design-vue'

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10000,
})

// 请求拦截器：注入 JWT Token
request.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// 响应拦截器：解包 { code, message, data } 结构
request.interceptors.response.use(
  (response: AxiosResponse) => {
    const { code, message: msg, data } = response.data
    if (code === 200) {
      return data
    }
    // 业务错误
    message.error(msg || '操作失败')
    return Promise.reject(new Error(msg || '操作失败'))
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('userInfo')
      // 延迟跳转，避免当前请求还在进行中
      window.location.href = '/login'
      message.error('登录已过期，请重新登录')
    } else {
      const msg = error.response?.data?.message || '网络错误，请稍后重试'
      message.error(msg)
    }
    return Promise.reject(error)
  },
)

export default request