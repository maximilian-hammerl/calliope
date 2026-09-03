<script setup lang="ts">
import { DESTINATIONS, isCurrent } from '@/lib/navigation/destinations'
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from '@/components/ui/navigation-menu'
import { APP_NAME } from '@/lib/branding'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LogOut, Search } from '@lucide/vue'
import { useLogoutUser } from '@/api/auth/auth'
import type { GetCurrentUser200 } from '@/api/models'
import { forgetCurrentUser } from '@/lib/auth/session'
import type { EnvironmentNotice } from '@/lib/environment'
import { ENVIRONMENT, environmentNotice } from '@/lib/environment'
import CalliopeBadge from '@/components/common/CalliopeBadge.vue'
import CalliopeLogo from '@/components/common/CalliopeLogo.vue'
import SearchField from '@/components/search/SearchField.vue'
import { requestedChatId } from '@/lib/chat/openChatDialog'
import NotificationsDialog from '@/components/notification/NotificationsDialog.vue'
import ChatsDialog from '@/components/chat/ChatsDialog.vue'
import SettingsDialog from '@/components/settings/SettingsDialog.vue'
import UserAvatar from '@/components/user/UserAvatar.vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const props = defineProps<{ user: GetCurrentUser200 }>()

const route = useRoute()
const router = useRouter()

/** The menu is the only way in, so this is what makes the moderation queue reachable at all. */
const isOperator = computed<boolean>(() => props.user.platformRole !== null)

const environment = computed<EnvironmentNotice | undefined>(() => environmentNotice(ENVIRONMENT))

const unread = computed<number>(() => props.user.unreadNotifications)

// Personal things open where you are. Reading a long post and wanting to answer something
// should not cost you your place on the page.
/** Below `md` the field is summoned rather than always present; see the button above. */
const searchOpen = ref<boolean>(false)
const searchRow = useTemplateRef<HTMLDivElement>('searchRow')

/** The keyboard has to follow the row, or opening the field takes a second tap. */
watch(searchOpen, async (isOpen) => {
  if (!isOpen) {
    return
  }
  await nextTick()
  searchRow.value?.querySelector('input')?.focus()
})

const showingNotifications = ref<boolean>(false)
const showingChats = ref<boolean>(false)
/** Set when a chat invitation was followed out of the notifications dialog. */
const startChatAt = ref<string | undefined>(undefined)

/**
 * A chat has no URL, so following its notification means swapping one dialog for the other.
 * Both live here, which is the only place that can do it.
 */
function openChat(chatGroupId: string) {
  startChatAt.value = chatGroupId
  showingChats.value = true
}

// Pages request a chat through this ref when they start a conversation; see openChatDialog.ts.
watch(requestedChatId, (chatGroupId) => {
  if (chatGroupId === undefined) {
    return
  }
  openChat(chatGroupId)
  requestedChatId.value = undefined
})
const showingSettings = ref<boolean>(false)

const { mutateAsync: logout, isPending } = useLogoutUser()

async function signOut() {
  // The cookie is cleared by the response, so the cached user has to go with it or the
  // guard would keep letting this browser through.
  await logout().catch(() => undefined)
  forgetCurrentUser()
  await router.push({ name: 'login' })
}
</script>

<template>
  <header class="flex flex-col border-b border-line-3 bg-paper-0">
    <div class="flex h-[52px] items-center gap-5 px-gutter md:h-[54px] md:gap-7 md:px-6">
      <RouterLink
        :to="{ name: 'home' }"
        class="flex min-h-11 items-center md:min-h-0"
        :aria-label="`${APP_NAME}, zur Startseite`"
      >
        <CalliopeLogo :size="22" wordmark />
      </RouterLink>

      <!-- Beside the wordmark rather than in a bar of its own: a phone already carries three,
           and this has to be visible on every page without costing a fourth. The full sentence
           is on the way in and on the home page; here it is the `title`. -->
      <CalliopeBadge v-if="environment" :title="environment.sentence" class="-ml-3 md:-ml-4">
        {{ environment.label }}
      </CalliopeBadge>

      <!-- Below `md` the destinations live in the bottom bar. The active mark stays the 2px
           underline at the foot of the bar, drawn here since the patched trigger carries none. -->
      <NavigationMenu class="hidden h-full md:flex" :delay-duration="100">
        <NavigationMenuList class="h-full gap-4 md:gap-5">
          <NavigationMenuItem
            v-for="destination in DESTINATIONS"
            :key="destination.label"
            class="flex h-full items-center border-b-2"
            :class="
              isCurrent(destination, route.name)
                ? 'border-oak [&_a,&_button]:font-semibold [&_a,&_button]:text-ink-1'
                : 'border-transparent'
            "
          >
            <!-- flex-row on the wrapper: its generated flex-col wins over the link's own
                 classes by stylesheet order, but loses in the wrapper's tailwind-merge. -->
            <NavigationMenuLink as-child class="flex-row">
              <RouterLink
                :to="{ name: destination.name }"
                class="flex h-full items-center gap-1.5 px-1 text-nav whitespace-nowrap text-ink-5 hover:text-ink-1"
              >
                <component :is="destination.icon" :size="16" :stroke-width="1.5" />
                {{ destination.label }}
              </RouterLink>
            </NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>

      <!-- From md up the field sits in the bar, as the system specifies. Below that a field
           does not fit but a button does, and the row it used to need cost 63px of a 667px
           phone. -->
      <SearchField class="ml-auto hidden w-[260px] md:block" />

      <button
        type="button"
        class="ml-auto flex size-11 items-center justify-center rounded-md text-ink-5 md:hidden"
        aria-label="Suche öffnen"
        @click="searchOpen = true"
      >
        <Search :size="18" :stroke-width="1.5" />
      </button>

      <div class="md:ml-0">
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <button
              type="button"
              class="flex size-11 items-center justify-center rounded-full outline-offset-2 focus-visible:outline-2 focus-visible:outline-oak md:size-7"
              :aria-label="
                unread > 0
                  ? `Konto von ${props.user.username}, ${unread} neue Mitteilungen`
                  : `Konto von ${props.user.username}`
              "
            >
              <span class="relative">
                <UserAvatar :username="props.user.username" :avatar-url="props.user.avatarUrl" />
                <!-- A mark, not a number. "7 neu" sitting in the bar tells you how far behind
                   you are, which is the pressure the research warned about; this only says
                   that something happened. The count is named on the menu item. -->
                <span
                  v-if="unread > 0"
                  class="absolute -top-px -right-px size-[7px] rounded-full bg-oak ring-2 ring-paper-0"
                />
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-56">
            <DropdownMenuLabel class="font-normal">
              <span class="block text-[13px] text-ink-2">{{ props.user.username }}</span>
              <span class="block text-[12px] text-ink-6">{{ props.user.emailAddress }}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem as-child>
                <RouterLink :to="{ name: 'member', params: { userId: props.user.id } }">
                  Mein Profil
                </RouterLink>
              </DropdownMenuItem>
              <DropdownMenuItem @select="showingNotifications = true">
                Mitteilungen
                <!-- A number always gets a noun: a bare badge was tested and misread. -->
                <span v-if="unread > 0" class="ml-auto text-[11.5px] text-oak-deep">
                  {{ unread }} neu
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem @select="showingChats = true">Chats</DropdownMenuItem>
              <DropdownMenuItem @select="showingSettings = true">Einstellungen</DropdownMenuItem>
            </DropdownMenuGroup>

            <!-- Only for operators, and in a group of its own: it belongs to this member the
                 way the items above do, but it is about the site rather than about them. -->
            <template v-if="isOperator">
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem as-child>
                  <RouterLink :to="{ name: 'moderation' }">Moderation</RouterLink>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </template>

            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem :disabled="isPending" @select="signOut">
                <LogOut />
                Abmelden
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <!-- Last, below signing out: about the site rather than this member, and the least
                 often wanted. Signed out they are in the footer, which has no room here. -->
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem as-child>
                <RouterLink :to="{ name: 'imprint' }">Impressum</RouterLink>
              </DropdownMenuItem>
              <DropdownMenuItem as-child>
                <RouterLink :to="{ name: 'privacyPolicy' }">Datenschutzerklärung</RouterLink>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>

    <div
      v-if="searchOpen"
      ref="searchRow"
      class="flex items-center gap-2 border-t border-line-2 px-gutter py-[9px] md:hidden"
    >
      <SearchField class="flex-1" />
      <button
        type="button"
        class="flex size-11 shrink-0 items-center justify-center rounded-md text-[12.5px] text-ink-5"
        @click="searchOpen = false"
      >
        Fertig
      </button>
    </div>
  </header>

  <NotificationsDialog v-model:open="showingNotifications" @open-chat="openChat" />
  <ChatsDialog v-model:open="showingChats" :start-at="startChatAt" />
  <SettingsDialog v-model:open="showingSettings" />
</template>
