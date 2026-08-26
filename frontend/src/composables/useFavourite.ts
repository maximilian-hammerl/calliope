import { ref } from 'vue'
import { failureMessage } from '@/lib/format/failure'
import { useClearFavourite, useSetFavourite } from '@/api/favourites/favourites'
import type { SetFavouriteTargetType } from '@/components/favourite/targetType'

/**
 * Marking anything a favourite, shared by all five kinds. It performs the change and reports what
 * happened; invalidation is the caller's, because what has to be refetched differs — a list wants
 * its own key, a detail page wants that thing, and the carousel wants neither.
 */
export function useFavourite() {
  const { mutateAsync: set } = useSetFavourite()
  const { mutateAsync: clear } = useClearFavourite()
  const savingFavourite = ref<boolean>(false)
  const favouriteError = ref<string | undefined>(undefined)

  async function changeFavourite(
    targetType: SetFavouriteTargetType,
    targetId: string,
    next: boolean,
  ): Promise<boolean> {
    favouriteError.value = undefined
    savingFavourite.value = true

    try {
      if (next) {
        await set({ targetType, targetId })
      } else {
        await clear({ targetType, targetId })
      }
    } catch (error) {
      favouriteError.value = failureMessage(error)
      return false
    } finally {
      savingFavourite.value = false
    }

    return true
  }

  return { savingFavourite, favouriteError, changeFavourite }
}
