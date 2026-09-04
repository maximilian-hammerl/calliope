import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import { useGetCurrentUser } from '@/api/auth/auth'

/**
 * Whether the member reading is an operator (#21). Four of the forum's surfaces ask — both rails,
 * its own page and the two views — and `platformRole !== null` written out at each of them is four
 * chances to write `!== undefined` instead, which would make every member an operator.
 */
export function useIsOperator(): ComputedRef<boolean> {
  const { data } = useGetCurrentUser()

  return computed<boolean>(
    () => data.value?.status === 200 && data.value.data.platformRole !== null,
  )
}
