import { createRouter, createWebHistory } from 'vue-router'
import { routes } from './routes'
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
  routes,
})

router.beforeEach(async (to) => {
  let user: Awaited<ReturnType<typeof fetchCurrentUser>>

  try {
    user = await fetchCurrentUser()
  } catch {
    /**
     * The check itself failed, which is not the same as there being no session — during a
     * deploy the cookie is still perfectly good. Sending somebody to the sign-in page here
     * would throw them off their page over an outage that lasts seconds, so the navigation
     * is allowed and the connection notice covers the app until the API answers again.
     *
     * Nothing is exposed by letting it through: every request the page makes needs the
     * cookie, and if it turns out there is no session the first 401 hands over to
     * `setSessionLostHandler` below.
     */
    return true
  }

  // Bound rather than switched on inline, so TypeScript narrows it to `never` in the default
  // branch and a fourth kind of access cannot be added without handling it here.
  const access = to.meta.access ?? 'member'

  // Verification is orthogonal to access: `access` asks whether there is a session, this asks
  // what state that session's account is in. Only member routes are affected — a verification
  // link has to work signed out, and the wall itself would otherwise redirect to itself.
  if (user !== undefined && access === 'member') {
    const addressIsUnconfirmed = user.emailAddressVerifiedAt === null

    if (addressIsUnconfirmed && to.name !== 'verifyEmailAddressRequired') {
      return { name: 'verifyEmailAddressRequired' }
    }

    if (!addressIsUnconfirmed && to.name === 'verifyEmailAddressRequired') {
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
