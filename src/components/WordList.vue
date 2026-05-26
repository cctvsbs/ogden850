<script setup>
import { ref, onMounted } from 'vue'
import { favoritesService } from '@/services/storageService'

const props = defineProps({
  words: { type: Array, default: () => [] },
  viewMode: { type: String, default: 'grid' }
})

const emit = defineEmits(['select', 'favorite-changed'])

function getPosTag(category) {
  const map = { operations: '操作词', thingsGeneral: '名词', thingsPicturable: '名词', qualitiesGeneral: '形容词', qualitiesOpposite: '形容词' }
  return map[category] || ''
}

function getPosColor(category) {
  const map = { operations: '#409EFF', thingsGeneral: '#67c23a', thingsPicturable: '#67c23a', qualitiesGeneral: '#e6a23c', qualitiesOpposite: '#f56c6c' }
  return map[category] || '#909399'
}

function frequencyStars(level) {
  if (!level) return ''
  return '★'.repeat(level) + '☆'.repeat(5 - level)
}

const favoriteIds = ref(new Set())

onMounted(async () => {
  const ids = await favoritesService.getAllFavoriteIds()
  favoriteIds.value = new Set(ids)
})

async function refreshFavorites() {
  const ids = await favoritesService.getAllFavoriteIds()
  favoriteIds.value = new Set(ids)
}

function isFavorite(wordId) {
  return favoriteIds.value.has(wordId)
}

async function toggleFavorite(e, wordId) {
  e.stopPropagation()
  if (isFavorite(wordId)) {
    await favoritesService.removeFavorite(wordId)
    favoriteIds.value.delete(wordId)
  } else {
    await favoritesService.addFavorite(wordId)
    favoriteIds.value.add(wordId)
  }
  favoriteIds.value = new Set(favoriteIds.value)
  emit('favorite-changed')
}

defineExpose({ refreshFavorites })
</script>

<template>
  <!-- ==================== 卡片模式（唯一视图） ==================== -->
  <div class="card-scroll">
    <div v-if="words.length === 0" class="col-span-full text-center py-16 sm:py-20" :style="{ color: 'var(--text-muted)' }">
      <p class="text-lg sm:text-xl">没有找到匹配的单词</p>
      <p class="text-sm sm:text-base mt-2">试试其他搜索词或切换分类</p>
    </div>
    <div class="card-grid">
      <div v-for="word in words" :key="word.id"
        @click="$emit('select', word)"
        class="word-card relative"
        :style="{ backgroundColor: 'var(--bg)', boxShadow: 'var(--shadow-sm)', borderColor: 'var(--border)' }"
      >
        <button @click="(e) => toggleFavorite(e, word.id)"
          class="absolute top-2 right-2 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-sm cursor-pointer transition-all hover:scale-110 z-10"
          :style="{ backgroundColor: 'transparent', color: isFavorite(word.id) ? '#f59e0b' : 'var(--text-muted)' }"
          :title="isFavorite(word.id) ? '取消收藏' : '添加收藏'">{{ isFavorite(word.id) ? '⭐' : '☆' }}</button>
        <div class="wc-header">
          <span class="wc-word word-display" :style="{ color: 'var(--text)' }">{{ word.word }}</span>
          <span class="wc-pos" :style="{ backgroundColor: getPosColor(word.category) }">{{ getPosTag(word.category) }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-lg" v-if="word.icon">{{ word.icon }}</span>
          <span class="wc-phonetic" :style="{ color: 'var(--text-muted)' }">{{ word.phonetic }}</span>
        </div>
        <div class="wc-meaning" :style="{ color: 'var(--text-secondary)' }">{{ word.chinese }}</div>
        <div class="flex items-center justify-between">
          <span class="text-[10px]" :style="{ color: 'var(--clay)' }" v-if="word.frequency">{{ frequencyStars(word.frequency) }}</span>
        </div>
        <div class="wc-footer">
          <span class="wc-click-hint" :style="{ color: 'var(--text-muted)' }">👆 点击卡片</span>
          <span class="wc-arrow" :style="{ color: 'var(--text-muted)' }">→</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card-scroll { overflow-y: auto; scrollbar-width: none; -ms-overflow-style: none; height: 100%; }
.card-scroll::-webkit-scrollbar { display: none; }

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px; padding: 4px; align-content: start;
}
@media (min-width: 640px) {
  .card-grid { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
}

.word-card {
  border: 1px solid; border-radius: 12px; padding: 12px;
  cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; gap: 6px;
}
@media (min-width: 640px) {
  .word-card { padding: 14px; gap: 8px; }
}
.word-card:hover {
  border-color: #409EFF !important;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.15);
  transform: translateY(-2px);
}

.wc-header { display: flex; justify-content: space-between; align-items: center; padding-right: 24px; }
.wc-word { font-size: 1.25rem; font-weight: 700; }
@media (min-width: 640px) { .wc-word { font-size: 1.5rem; } }
.wc-pos { font-size: 10px; color: #fff; padding: 2px 6px; border-radius: 12px; font-weight: 600; white-space: nowrap; }
@media (min-width: 640px) { .wc-pos { padding: 2px 8px; } }
.wc-phonetic { font-size: 11px; }
@media (min-width: 640px) { .wc-phonetic { font-size: 12px; } }
.wc-meaning { font-size: 13px; line-height: 1.5; }
@media (min-width: 640px) { .wc-meaning { font-size: 14px; } }
.wc-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 6px; border-top: 1px solid; border-color: inherit; opacity: 0.5; }
@media (min-width: 640px) { .wc-footer { padding-top: 8px; } }
.wc-click-hint { font-size: 10px; }
@media (min-width: 640px) { .wc-click-hint { font-size: 11px; } }
.wc-arrow { font-size: 14px; font-weight: 700; }
</style>