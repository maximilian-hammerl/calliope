import type { RouteRecordRaw } from 'vue-router'

/**
 * Separate from the router itself so a test can read them without booting the navigation
 * guard, which would pull in the session query and the whole generated client.
 */
export const routes: Array<RouteRecordRaw> = [
  // Where signing in and registering land. What it will hold is still open.
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
    path: '/story-ideas',
    name: 'storyIdeas',
    component: () => import('../views/StoryIdeasView.vue'),
  },
  // Literal before the parameter, or `mine` would be read as an idea's id.
  {
    path: '/story-ideas/mine',
    name: 'storyIdeasMine',
    component: () => import('../views/StoryIdeasView.vue'),
    props: { mine: true },
  },
  // Also before the parameter, and the id is optional: opening the carousel without one starts
  // at the newest unread idea.
  {
    path: '/story-ideas/carousel/:ideaId?',
    name: 'storyIdeasCarousel',
    component: () => import('../views/StoryIdeaCarouselView.vue'),
  },
  {
    path: '/story-ideas/:ideaId',
    name: 'storyIdea',
    component: () => import('../views/StoryIdeaView.vue'),
  },
  {
    path: '/members',
    name: 'members',
    component: () => import('../views/MembersView.vue'),
  },
  {
    path: '/members/:userId',
    name: 'member',
    component: () => import('../views/MemberView.vue'),
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
    path: '/verify-email-address',
    name: 'verifyEmailAddress',
    component: () => import('../views/VerifyEmailAddressView.vue'),
    meta: { access: 'anyone' },
  },
  // Both reached from a mailed link, so neither may depend on a session: confirming is done
  // from the new address's mailbox, and cancelling by whoever still reads the old one — who,
  // in the case worth defending against, is not the person holding the session.
  {
    path: '/confirm-email-address-change',
    name: 'confirmEmailAddressChange',
    component: () => import('../views/ConfirmEmailAddressChangeView.vue'),
    meta: { access: 'anyone' },
  },
  {
    path: '/cancel-email-address-change',
    name: 'cancelEmailAddressChange',
    component: () => import('../views/CancelEmailAddressChangeView.vue'),
    meta: { access: 'anyone' },
  },
  // Also from a mailed link, and reached with the session already gone in the common case:
  // somebody deleting their account often does it from a phone they are not signed in on.
  {
    path: '/confirm-account-deletion',
    name: 'confirmAccountDeletion',
    component: () => import('../views/ConfirmAccountDeletionView.vue'),
    meta: { access: 'anyone' },
  },
  // Where a signed-in member with an unconfirmed address is held. An ordinary member route
  // — it needs a session — and the guard below keeps everyone else off it.
  {
    path: '/verify-email-address-required',
    name: 'verifyEmailAddressRequired',
    component: () => import('../views/VerifyEmailAddressRequiredView.vue'),
  },
]
