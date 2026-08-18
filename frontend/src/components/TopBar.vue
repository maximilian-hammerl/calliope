<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LogOutIcon } from '@lucide/vue'
import { useLogoutUser } from '@/api/auth/auth'
import type { GetCurrentUser200 } from '@/api/models'
import { forgetCurrentUser } from '@/lib/session'
import CalliopeLogo from '@/components/CalliopeLogo.vue'
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
  <header
    class="flex h-[52px] items-center gap-7 border-b border-line-3 bg-paper-0 px-6 md:h-[54px]"
  >
    <RouterLink :to="{ name: 'home' }" aria-label="Calliope, zur Startseite">
      <CalliopeLogo :size="22" wordmark />
    </RouterLink>

    <nav class="flex h-full gap-5">
      <!-- Active on every page below /groups, since they all live under this destination.
           The active mark is the 2px underline at the foot of the bar, never a filled chip. -->
      <RouterLink
        :to="{ name: 'groups' }"
        class="flex h-full items-center border-b-2 text-[13.5px] leading-[1.2]"
        :class="
          String(route.name).startsWith('group') || route.name === 'thread'
            ? 'border-oak font-semibold text-ink-1'
            : 'border-transparent text-ink-5'
        "
      >
        Meine Gruppen
      </RouterLink>
    </nav>

    <div class="ml-auto">
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="flex size-11 items-center justify-center rounded-full outline-offset-2 focus-visible:outline-2 focus-visible:outline-oak md:size-7"
            :aria-label="`Konto von ${props.user.username}`"
          >
            <Avatar class="size-7">
              <AvatarFallback class="bg-paper-4 text-[11.5px] font-semibold text-[#5c4a2d]">
                {{ initial }}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-56">
          <DropdownMenuLabel class="font-normal">
            <span class="block text-[13px] text-ink-2">{{ props.user.username }}</span>
            <span class="block text-[12px] text-ink-6">{{ props.user.emailAddress }}</span>
          </DropdownMenuLabel>
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
  </header>
</template>
