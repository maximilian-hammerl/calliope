import './assets/main.css'

import { createApp } from 'vue'
import { VueQueryPlugin } from '@tanstack/vue-query'

import App from './App.vue'
import router from './router'
import { queryClient } from './lib/api/queryClient'

const app = createApp(App)

// Installed before the router so the guard's first session check shares this cache.
app.use(VueQueryPlugin, { queryClient })
app.use(router)

app.mount('#app')
