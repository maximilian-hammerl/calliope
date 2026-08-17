import { createRouter, createWebHistory } from 'vue-router'
import { fetchCurrentUser } from '@/lib/session'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { public: true },
    },
  ],
})

router.beforeEach(async (to) => {
  // A failed check cannot be told apart from a signed-out visitor here, so an outage or a
  // rate limit also lands on the login view rather than blocking navigation outright.
  const user = await fetchCurrentUser().catch(() => undefined)

  if (user === undefined && to.meta.public !== true) {
    // `redirect` carries where they were headed, so signing in resumes it.
    return { name: 'login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } }
  }

  if (user !== undefined && to.name === 'login') {
    return { name: 'home' }
  }

  return true
})

export default router
