import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'

import App from './App.vue'
import router from './router'
import { queryClient } from './lib/queryClient'

const app = createApp(App)

app.use(createPinia())
// Installed before the router so the guard's first session check shares this cache.
app.use(VueQueryPlugin, { queryClient })
app.use(router)

app.mount('#app')
