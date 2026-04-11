import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Antd from 'ant-design-vue'
import App from './App.vue'
import router from './router'
import { vPermission } from './directives/permission'

import 'ant-design-vue/dist/reset.css'
import '@/styles/global.less'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(Antd)
app.directive('permission', vPermission)

app.mount('#app')