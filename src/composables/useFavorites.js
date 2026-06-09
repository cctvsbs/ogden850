import { ref, onMounted } from 'vue'
import { favoritesService } from '@/services/storageService'

export function useFavorites() {
  const favoriteIds = ref(new Set())

  async function loadFavorites() {
    const ids = await favoritesService.getAllFavoriteIds()
    favoriteIds.value = new Set(ids)
  }

  function isFavorite(wordId) { return favoriteIds.value.has(wordId) }

  async function toggleFavorite(wordId) {
    if (isFavorite(wordId)) {
      await favoritesService.removeFavorite(wordId)
      favoriteIds.value.delete(wordId)
    } else {
      await favoritesService.addFavorite(wordId)
      favoriteIds.value.add(wordId)
    }
    favoriteIds.value = new Set(favoriteIds.value)
  }

  return { favoriteIds, isFavorite, toggleFavorite, loadFavorites, refresh: loadFavorites }
}
