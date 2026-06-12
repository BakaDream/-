import { createApp } from 'vue'
import { createPinia } from 'pinia'
import axios from 'axios'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import './assets/main.css'
import App from './App.vue'
import router from './router'

axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(ElementPlus)
app.mount('#app')
