import { createRouter, createWebHistory } from 'vue-router'
import { fetchCurrentUser, forgetCurrentUser } from '@/lib/auth/session'
import { setSessionLostHandler } from '@/lib/api/queryClient'
import { assertUnreachable } from '@/lib/assertUnreachable'

declare module 'vue-router' {
  interface RouteMeta {
    /**
     * Who may open the route. One value rather than a flag per case: separate booleans let a
     * route claim to be both guests-only and open to everyone, which means nothing and which
     * nothing would catch. Omitting it means `member`, so forgetting to mark a route locks
     * it rather than exposing it.
     */
    access?: 'member' | 'guest' | 'anyone'
  }
}

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
      meta: { access: 'guest' },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/RegisterView.vue'),
      meta: { access: 'guest' },
    },
    {
      path: '/forgot-password',
      name: 'forgotPassword',
      component: () => import('../views/ForgotPasswordView.vue'),
      meta: { access: 'guest' },
    },
    {
      path: '/reset-password',
      name: 'resetPassword',
      component: () => import('../views/ResetPasswordView.vue'),
      meta: { access: 'anyone' },
    },
    // Same reasoning as the reset link: a verification link is often opened in a different
    // browser from the one that registered.
    {
      path: '/verify-email',
      name: 'verifyEmail',
      component: () => import('../views/VerifyEmailView.vue'),
      meta: { access: 'anyone' },
    },
    // Both reached from a mailed link, so neither may depend on a session: confirming is done
    // from the new address's mailbox, and cancelling by whoever still reads the old one — who,
    // in the case worth defending against, is not the person holding the session.
    {
      path: '/confirm-email-change',
      name: 'confirmEmailChange',
      component: () => import('../views/ConfirmEmailChangeView.vue'),
      meta: { access: 'anyone' },
    },
    {
      path: '/cancel-email-change',
      name: 'cancelEmailChange',
      component: () => import('../views/CancelEmailChangeView.vue'),
      meta: { access: 'anyone' },
    },
    // Where a signed-in member with an unconfirmed address is held. An ordinary member route
    // — it needs a session — and the guard below keeps everyone else off it.
    {
      path: '/verify-email-required',
      name: 'verifyEmailRequired',
      component: () => import('../views/VerifyEmailRequiredView.vue'),
    },
  ],
})

router.beforeEach(async (to) => {
  // A failed check cannot be told apart from a signed-out visitor here, so an outage or a
  // rate limit also lands on the login view rather than blocking navigation outright.
  const user = await fetchCurrentUser().catch(() => undefined)

  // Bound rather than switched on inline, so TypeScript narrows it to `never` in the default
  // branch and a fourth kind of access cannot be added without handling it here.
  const access = to.meta.access ?? 'member'

  // Verification is orthogonal to access: `access` asks whether there is a session, this asks
  // what state that session's account is in. Only member routes are affected — a verification
  // link has to work signed out, and the wall itself would otherwise redirect to itself.
  if (user !== undefined && access === 'member') {
    const addressIsUnconfirmed = user.emailVerifiedAt === null

    if (addressIsUnconfirmed && to.name !== 'verifyEmailRequired') {
      return { name: 'verifyEmailRequired' }
    }

    if (!addressIsUnconfirmed && to.name === 'verifyEmailRequired') {
      return { name: 'home' }
    }
  }

  switch (access) {
    case 'member':
      // `redirect` carries where they were headed, so signing in resumes it.
      return user === undefined
        ? { name: 'login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } }
        : true

    case 'guest':
      return user === undefined ? true : { name: 'home' }

    case 'anyone':
      return true

    default:
      return assertUnreachable(access)
  }
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
