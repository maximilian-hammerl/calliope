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
  // The bare resource goes where the bar goes, which is the same rule for both resources below.
  // Without it the path renders nothing: there is no catch-all.
  { path: '/groups', redirect: { name: 'myGroups' } },
  // Literals before the parameter only for reading order — vue-router ranks a static segment
  // above a parameter regardless of where it is declared.
  {
    path: '/groups/mine',
    name: 'myGroups',
    component: () => import('../views/GroupsView.vue'),
  },
  {
    path: '/groups/discover',
    name: 'discoverGroups',
    component: () => import('../views/DiscoverView.vue'),
  },
  // Nested so the group's own query, the reader's permissions and both rails are read once by
  // `GroupLayout` instead of by each child. The parent stays unnamed — navigating to it would
  // render a layout around nothing; `group` is the empty child.
  {
    path: '/groups/:groupId',
    component: () => import('../components/layout/GroupLayout.vue'),
    children: [
      {
        path: '',
        name: 'group',
        component: () => import('../views/GroupView.vue'),
        // This page already lists what the group holds, so the rail's tree would be the same
        // tree twice. Every other child of the group takes it.
        meta: { listsGroupContents: true },
      },
      {
        path: 'threads/:threadId',
        name: 'thread',
        component: () => import('../views/ThreadView.vue'),
      },
      {
        path: 'pages/:pageId',
        name: 'page',
        component: () => import('../views/PageView.vue'),
      },
    ],
  },
  // The forum's pages share one rail, so they hang off `ForumLayout` for the reason the group's
  // do. The parent stays unnamed; `forum` is the empty child.
  {
    path: '/forum',
    component: () => import('../components/layout/ForumLayout.vue'),
    children: [
      {
        path: '',
        name: 'forum',
        component: () => import('../views/ForumView.vue'),
        // This page is the forum's tree, so the rail would show it twice.
        meta: { listsForumContents: true },
      },
      {
        path: 'threads/:threadId',
        name: 'forumThread',
        component: () => import('../views/ForumThreadView.vue'),
      },
      {
        path: 'pages/:pageId',
        name: 'forumPage',
        component: () => import('../views/ForumPageView.vue'),
      },
    ],
  },
  // Readable signed out: a legal notice has to be reachable from the sign-in page too. English
  // path like every other route, even though the page is titled „Impressum" — the rule holds and
  // nothing legal turns on the URL.
  {
    path: '/imprint',
    name: 'imprint',
    component: () => import('../views/ImprintView.vue'),
    meta: { access: 'anyone' },
  },
  {
    path: '/privacy-policy',
    name: 'privacyPolicy',
    component: () => import('../views/PrivacyPolicyView.vue'),
    meta: { access: 'anyone' },
  },
  // As above: the bare path follows the bar, which for ideas is the carousel rather than a list.
  { path: '/story-ideas', redirect: { name: 'storyIdeasCarousel' } },
  {
    path: '/story-ideas/mine',
    name: 'myStoryIdeas',
    component: () => import('../views/StoryIdeasView.vue'),
    props: { mine: true },
  },
  {
    path: '/story-ideas/discover',
    name: 'discoverStoryIdeas',
    component: () => import('../views/StoryIdeasView.vue'),
  },
  // The id is optional: opening the carousel without one starts at the newest unread idea.
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
    path: '/moderation',
    name: 'moderation',
    component: () => import('../views/ModerationView.vue'),
    meta: { access: 'operator' },
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
