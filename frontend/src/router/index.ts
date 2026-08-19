import { createRouter, createWebHistory } from 'vue-router'
import { fetchCurrentUser, forgetCurrentUser } from '@/lib/auth/session'
import { setSessionLostHandler } from '@/lib/api/queryClient'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // Where signing in and registering land.
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/groups',
      name: 'groups',
      component: () => import('../views/GroupsView.vue'),
    },
    // Before the dynamic route only for reading order — vue-router ranks a static segment
    // above a parameter regardless of where it is declared.
    {
      path: '/groups/discover',
      name: 'discover',
      component: () => import('../views/DiscoverView.vue'),
    },
    {
      path: '/groups/:groupId',
      name: 'group',
      component: () => import('../views/GroupView.vue'),
    },
    {
      path: '/groups/:groupId/threads/:threadId',
      name: 'thread',
      component: () => import('../views/ThreadView.vue'),
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

// A session that ends mid-visit returns the reader to the sign-in page, carrying where they
// were so it resumes afterwards. Which requests may legitimately answer 401 is decided in
// the query client, not here.
setSessionLostHandler(() => {
  forgetCurrentUser()
  const from = router.currentRoute.value.fullPath
  void router.replace({ name: 'login', query: from === '/' ? {} : { redirect: from } })
})

export default router
