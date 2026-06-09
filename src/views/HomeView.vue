<script setup>
import { ref, computed, onMounted } from 'vue'
import { useWordsStore } from '@/stores/words'
import { useRouter } from 'vue-router'
import { progressService, mistakesService, favoritesService, settingsService } from '@/services/storageService'
import SearchBar from '@/components/SearchBar.vue'
import WordList from '@/components/WordList.vue'
import WordCard from '@/components/WordCard.vue'

const store = useWordsStore()
const router = useRouter()

const filterStatus = ref('all')
const showFavoritesOnly = ref(false)
const showMistakesOnly = ref(false)
const wordListRef = ref(null)

const todayLearned = ref(0)
const totalMastered = ref(0)
const streakDays = ref(0)
const mistakesCount = ref(0)
const favoritesCount = ref(0)
const favoriteIds = ref([])
const mistakeWordIds = ref([])

const displayWords = computed(() => {
  let result = store.filteredWords

  if (showMistakesOnly.value) {
    result = result.filter(w => mistakeWordIds.value.includes(w.id))
    return result
  }

  if (showFavoritesOnly.value) {
    result = result.filter(w => favoriteIds.value.includes(w.id))
    return result
  }

  if (filterStatus.value === 'mastered') {
    result = result.filter(w => (w.stage || 0) >= 5)
  } else if (filterStatus.value === 'unmastered') {
    result = result.filter(w => (w.stage || 0) < 5)
  }

  return result
})

function onWordClick(word) {
  store.selectWord(word)
}

function toggleMistakesMode() {
  showMistakesOnly.value = !showMistakesOnly.value
  if (showMistakesOnly.value) {
    showFavoritesOnly.value = false
    filterStatus.value = 'all'
  }
}

function toggleFavoritesMode() {
  showFavoritesOnly.value = !showFavoritesOnly.value
  if (showFavoritesOnly.value) {
    showMistakesOnly.value = false
    filterStatus.value = 'all'
  }
}

async function reloadMistakeWords() {
  const list = await mistakesService.getAllMistakes()
  mistakeWordIds.value = [...new Set(list.map(m => m.wordId))]
  mistakesCount.value = list.length
}

async function reloadFavorites() {
  const ids = await favoritesService.getAllFavoriteIds()
  favoriteIds.value = ids
  favoritesCount.value = ids.length
  if (wordListRef.value) {
    wordListRef.value.refreshFavorites()
  }
}

function goToPractice(mode) {
  router.push(`/practice?mode=${mode}`)
}

async function loadStats() {
  totalMastered.value = await progressService.getMasteredWords().then(arr => arr.length).catch(() => 0)
  todayLearned.value = await progressService.getTodayLearned().catch(() => 0)
  const saved = await settingsService.get('ogden850-streak-count')
  if (saved) streakDays.value = saved
}

onMounted(async () => {
  await store.loadProgress()
  loadStats()
  reloadMistakeWords()
  reloadFavorites()
  // 预热语音引擎
  const warmUp = new SpeechSynthesisUtterance('')
  warmUp.volume = 0
  window.speechSynthesis.speak(warmUp)
  // 预加载语音列表
  window.speechSynthesis.getVoices()
  const today = new Date().toISOString().slice(0, 10)
  const lastVisit = await settingsService.get('ogden850-streak')
  if (lastVisit !== today) {
    const lastDate = lastVisit ? new Date(lastVisit) : null
    const diff = lastDate ? Math.floor((new Date() - lastDate) / (1000 * 60 * 60 * 24)) : 999
    const count = diff === 1 ? (await settingsService.get('ogden850-streak-count') || 0) + 1 : 1
    await settingsService.set('ogden850-streak', today)
    await settingsService.set('ogden850-streak-count', count)
    streakDays.value = count
  }
})
</script>

<template>
  <div class="w-full max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-8 flex flex-col" style="height: calc(100vh - 100px);">
    <!-- 统计卡片 -->
    <div class="grid grid-cols-5 gap-1.5 sm:gap-2 mb-4 sm:mb-6 flex-shrink-0">
      <div class="rounded-xl sm:rounded-2xl p-2 sm:p-3 text-center" :style="{ backgroundColor: 'var(--bg)', boxShadow: 'var(--shadow-sm)' }">
        <p class="text-base sm:text-lg font-bold word-display" :style="{ color: 'var(--accent)' }">{{ todayLearned }}</p>
        <p class="text-[10px] sm:text-xs mt-0.5" :style="{ color: 'var(--text-muted)' }">📖 今日</p>
      </div>
      <div class="rounded-xl sm:rounded-2xl p-2 sm:p-3 text-center" :style="{ backgroundColor: 'var(--bg)', boxShadow: 'var(--shadow-sm)' }">
        <p class="text-base sm:text-lg font-bold word-display" :style="{ color: 'var(--success)' }">{{ totalMastered }}</p>
        <p class="text-[10px] sm:text-xs mt-0.5" :style="{ color: 'var(--text-muted)' }">🎯 掌握</p>
      </div>
      <div class="rounded-xl sm:rounded-2xl p-2 sm:p-3 text-center" :style="{ backgroundColor: 'var(--bg)', boxShadow: 'var(--shadow-sm)' }">
        <p class="text-base sm:text-lg font-bold word-display" :style="{ color: 'var(--clay)' }">{{ streakDays }}</p>
        <p class="text-[10px] sm:text-xs mt-0.5" :style="{ color: 'var(--text-muted)' }">🔥 连续</p>
      </div>
      <div class="rounded-xl sm:rounded-2xl p-2 sm:p-3 text-center cursor-pointer transition-all hover:scale-105" :style="{ backgroundColor: showMistakesOnly ? '#fdeaec' : 'var(--bg)', boxShadow: 'var(--shadow-sm)' }" @click="toggleMistakesMode" title="错题集">
        <p class="text-base sm:text-lg font-bold word-display" :style="{ color: '#b13e3e' }">{{ mistakesCount }}</p>
        <p class="text-[10px] sm:text-xs mt-0.5" :style="{ color: 'var(--text-muted)' }">❌ 错题</p>
      </div>
      <div class="rounded-xl sm:rounded-2xl p-2 sm:p-3 text-center cursor-pointer transition-all hover:scale-105" :style="{ backgroundColor: showFavoritesOnly ? '#fff0e0' : 'var(--bg)', boxShadow: 'var(--shadow-sm)' }" @click="toggleFavoritesMode" title="收藏夹">
        <p class="text-base sm:text-lg font-bold word-display" :style="{ color: '#c96f0e' }">{{ favoritesCount }}</p>
        <p class="text-[10px] sm:text-xs mt-0.5" :style="{ color: 'var(--text-muted)' }">⭐ 收藏</p>
      </div>
    </div>

    <!-- 四个训练按钮 -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6 flex-shrink-0">
      <button @click="goToPractice('flashcard')"
        class="px-3 sm:px-4 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base transition-all duration-300 hover:scale-105 cursor-pointer"
        :style="{ backgroundColor: 'var(--accent)', color: '#1A1A2E' }">
        🃏 闪卡背词
      </button>
      <button @click="goToPractice('choice')"
        class="px-3 sm:px-4 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base transition-all duration-300 hover:scale-105 cursor-pointer"
        :style="{ backgroundColor: 'var(--accent)', color: '#1A1A2E' }">
        📝 词意单选
      </button>
      <button @click="goToPractice('spelling')"
        class="px-3 sm:px-4 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base transition-all duration-300 hover:scale-105 cursor-pointer"
        :style="{ backgroundColor: 'var(--accent)', color: '#1A1A2E' }">
        ⌨️ 拼词训练
      </button>
      <button @click="goToPractice('expression')"
        class="px-3 sm:px-4 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base transition-all duration-300 hover:scale-105 cursor-pointer"
        :style="{ backgroundColor: 'var(--accent)', color: '#1A1A2E' }">
        💬 拼句训练
      </button>
    </div>

    <!-- 搜索 + 分类 -->
    <div class="flex-shrink-0 space-y-2 sm:space-y-3 mb-3 sm:mb-4">
      <div class="flex items-center gap-2">
        <div class="flex-1">
          <SearchBar :modelValue="store.searchQuery" @update:modelValue="store.searchQuery = $event" />
        </div>
      </div>

      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div class="flex flex-wrap gap-1 sm:gap-1.5">
          <button v-for="cat in store.categories" :key="cat.id" @click="store.activeCategory = cat.id; showMistakesOnly = false; showFavoritesOnly = false"
            class="px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs rounded-full transition-all border cursor-pointer whitespace-nowrap"
            :style="store.activeCategory === cat.id ? { backgroundColor: 'var(--accent)', borderColor: 'var(--accent)', color: '#1A1A2E', fontWeight: '600' } : { backgroundColor: 'transparent', borderColor: 'var(--border)', color: 'var(--text-secondary)' }">
            {{ cat.label }}<span class="ml-0.5 sm:ml-1 opacity-60">{{ cat.count }}</span>
          </button>
        </div>
        <div class="flex gap-1 sm:gap-1.5">
          <button @click="toggleMistakesMode"
            class="px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs rounded-full border cursor-pointer transition-all whitespace-nowrap"
            :style="showMistakesOnly ? { backgroundColor: '#b13e3e', borderColor: '#b13e3e', color: '#fff', fontWeight: '600' } : { backgroundColor: 'transparent', borderColor: 'var(--border)', color: 'var(--text-secondary)' }"
            title="错题集">❌ 错题集</button>
          <button @click="toggleFavoritesMode"
            class="px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs rounded-full border cursor-pointer transition-all whitespace-nowrap"
            :style="showFavoritesOnly ? { backgroundColor: '#c96f0e', borderColor: '#c96f0e', color: '#fff', fontWeight: '600' } : { backgroundColor: 'transparent', borderColor: 'var(--border)', color: 'var(--text-secondary)' }"
            title="收藏夹">⭐ 收藏夹</button>
        </div>
      </div>
    </div>

    <!-- 单词列表 -->
    <div class="flex-1 overflow-y-auto hide-scrollbar" style="min-height: 0;">
      <WordList
        ref="wordListRef"
        :words="displayWords"
        :viewMode="'grid'"
        @select="onWordClick"
        @favorite-changed="reloadFavorites"
      />
    </div>

    <WordCard :word="store.selectedWord"
      :visible="!!store.selectedWord"
      :wordList="displayWords"
      :currentIndex="displayWords.findIndex(w => w.id === store.selectedWord?.id)"
      @close="store.clearSelection"
      @favorite-changed="reloadFavorites"
      @select-word="onWordClick" />
  </div>
</template>

<style>
.hide-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
.hide-scrollbar::-webkit-scrollbar { display: none; }
</style>