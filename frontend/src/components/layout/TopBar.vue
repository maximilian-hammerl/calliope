<script setup lang="ts">
import { APP_NAME } from '@/lib/branding'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LogOutIcon } from '@lucide/vue'
import { useLogoutUser } from '@/api/auth/auth'
import type { GetCurrentUser200 } from '@/api/models'
import { forgetCurrentUser } from '@/lib/auth/session'
import CalliopeLogo from '@/components/common/CalliopeLogo.vue'
import SearchField from '@/components/search/SearchField.vue'
import NotificationsDialog from '@/components/notification/NotificationsDialog.vue'
import MessagesDialog from '@/components/chat/MessagesDialog.vue'
import PlaceholderDialog from '@/components/common/PlaceholderDialog.vue'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
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

const initial = computed<string>(() => props.user.username.trim().charAt(0).toUpperCase())

const unread = computed<number>(() => props.user.unreadNotifications)

// Personal things open where you are. Reading a long post and wanting to answer something
// should not cost you your place on the page.
const showingNotifications = ref<boolean>(false)
const showingMessages = ref<boolean>(false)
/** Set when a chat invitation was followed out of the notifications dialog. */
const startChatAt = ref<string | undefined>(undefined)

/**
 * A chat has no URL, so following its notification means swapping one dialog for the other.
 * Both live here, which is the only place that can do it.
 */
function openChat(chatGroupId: string) {
  startChatAt.value = chatGroupId
  showingMessages.value = true
}
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
    <div class="flex h-[52px] items-center gap-5 px-[18px] md:h-[54px] md:gap-7 md:px-6">
      <RouterLink :to="{ name: 'home' }" :aria-label="`${APP_NAME}, zur Startseite`">
        <CalliopeLogo :size="22" wordmark />
      </RouterLink>

      <nav class="flex h-full gap-4 md:gap-5">
        <!-- Active on every page below /groups, since they all live under this destination.
           The active mark is the 2px underline at the foot of the bar, never a filled chip. -->
        <RouterLink
          :to="{ name: 'groups' }"
          class="flex h-full items-center border-b-2 text-[13.5px] leading-[1.2] whitespace-nowrap"
          :class="
            String(route.name).startsWith('group') || route.name === 'thread'
              ? 'border-oak font-semibold text-ink-1'
              : 'border-transparent text-ink-5'
          "
        >
          Meine Gruppen
        </RouterLink>
      </nav>

      <!-- From md up the field sits in the bar, as the system specifies. Below that it gets
           its own row: measured, the bar had 29px to spare before search existed, and the
           wordmark is what would have paid for it. -->
      <SearchField class="ml-auto hidden w-[260px] md:block" />

      <div class="ml-auto md:ml-0">
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
                <Avatar class="size-7">
                  <AvatarFallback class="bg-paper-4 text-[11.5px] font-semibold text-[#5c4a2d]">
                    {{ initial }}
                  </AvatarFallback>
                </Avatar>
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
              <DropdownMenuItem @select="showingNotifications = true">
                Mitteilungen
                <!-- A number always gets a noun: a bare badge was tested and misread. -->
                <span v-if="unread > 0" class="ml-auto text-[11.5px] text-oak-deep">
                  {{ unread }} neu
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem @select="showingMessages = true">Nachrichten</DropdownMenuItem>
              <DropdownMenuItem @select="showingSettings = true">Einstellungen</DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem :disabled="isPending" @select="signOut">
                <LogOutIcon />
                Abmelden
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>

    <!-- Only below md, where it cannot share the row above. -->
    <div class="border-t border-line-2 px-[18px] py-[9px] md:hidden">
      <SearchField />
    </div>
  </header>

  <NotificationsDialog v-model:open="showingNotifications" @open-chat="openChat" />
  <MessagesDialog v-model:open="showingMessages" :start-at="startChatAt" />
  <PlaceholderDialog
    v-model:open="showingSettings"
    title="Einstellungen"
    description="Dein Konto, und worüber du benachrichtigt wirst."
  />
</template>
