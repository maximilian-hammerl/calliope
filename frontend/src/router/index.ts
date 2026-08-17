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
      meta: { guestOnly: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/RegisterView.vue'),
      meta: { guestOnly: true },
    },
  ],
})

router.beforeEach(async (to) => {
  // A failed check cannot be told apart from a signed-out visitor here, so an outage or a
  // rate limit also lands on the login view rather than blocking navigation outright.
  const user = await fetchCurrentUser().catch(() => undefined)

  // Every route needs a session unless it is marked as being for signed-out visitors. A page
  // that should be readable by both would need a flag of its own.
  const guestOnly = to.meta.guestOnly === true

  if (user === undefined && !guestOnly) {
    // `redirect` carries where they were headed, so signing in resumes it.
    return { name: 'login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } }
  }

  if (user !== undefined && guestOnly) {
    return { name: 'home' }
  }

  return true
})

export default router
