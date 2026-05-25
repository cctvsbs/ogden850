<script setup>
import { ref, computed, onMounted } from 'vue'
import { useWordsStore } from '@/stores/words'
import { useRouter } from 'vue-router'
import { progressService, mistakesService, favoritesService } from '@/services/storageService'
import SearchBar from '@/components/SearchBar.vue'
import WordList from '@/components/WordList.vue'
import WordCard from '@/components/WordCard.vue'

const store = useWordsStore()
const router = useRouter()

const viewMode = ref('grid')
const filterStatus = ref('all')
const frequencyFilter = ref(0)
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
  
  if (frequencyFilter.value > 0) {
    result = result.filter(w => (w.frequency || 0) >= frequencyFilter.value)
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

function getPosTag(category) {
  const map = { operations: '操作词', thingsGeneral: '名词', thingsPicturable: '名词', qualitiesGeneral: '形容词', qualitiesOpposite: '形容词' }
  return map[category] || ''
}

function downloadExcel() {
  const headers = ['英文单词', '中文意思', '音标', '词性']
  const rows = store.words.map(w => [w.word, w.chinese, w.phonetic, getPosTag(w.category)])
  const BOM = '\uFEFF'
  const csvContent = BOM + [headers, ...rows].map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'Ogden850_' + new Date().toISOString().slice(0, 10) + '.csv'
  link.click()
  URL.revokeObjectURL(url)
}

function downloadPDF() {
  const rows = store.words.map(w => `<tr><td>${w.word}</td><td>${w.chinese}</td><td>${w.phonetic || ''}</td><td>${getPosTag(w.category)}</td></tr>`).join('')
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ogden 850 Word List</title><style>body{font-family:sans-serif;padding:20px}h1{font-size:18px;margin-bottom:5px}p{font-size:12px;color:#666;margin-bottom:15px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #ddd;padding:4px 8px;text-align:left}th{background:#f5f5f5}@media print{button{display:none}}</style></head><body><h1>Ogden 850 Basic English Word List</h1><p>Total: 850 words | Date: ${new Date().toISOString().slice(0,10)}</p><table><thead><tr><th>Word</th><th>Chinese</th><th>Phonetic</th><th>POS</th></tr></thead><tbody>${rows}</tbody></table><p style="text-align:center;margin-top:20px"><button onclick="window.print()" style="padding:10px 30px;font-size:14px">🖨️ 打印 / 导出 PDF</button></p></body></html>`
  const win = window.open('', '_blank', 'width=900,height=700')
  win.document.write(html)
  win.document.close()
}

async function loadStats() {
  totalMastered.value = await progressService.getMasteredWords().then(arr => arr.length).catch(() => 0)
  todayLearned.value = await progressService.getTodayLearned().catch(() => 0)
  const saved = localStorage.getItem('ogden850-streak-count')
  if (saved) streakDays.value = parseInt(saved)
}

onMounted(async () => {
  await store.loadProgress()
  loadStats()
  reloadMistakeWords()
  reloadFavorites()
  const warmUp = new SpeechSynthesisUtterance('')
  warmUp.volume = 0
  window.speechSynthesis.speak(warmUp)
  const today = new Date().toISOString().slice(0, 10)
  const lastVisit = localStorage.getItem('ogden850-streak')
  if (lastVisit !== today) {
    const lastDate = lastVisit ? new Date(lastVisit) : null
    const diff = lastDate ? Math.floor((new Date() - lastDate) / (1000 * 60 * 60 * 24)) : 999
    const count = diff === 1 ? parseInt(localStorage.getItem('ogden850-streak-count') || '0') + 1 : 1
    localStorage.setItem('ogden850-streak', today)
    localStorage.setItem('ogden850-streak-count', count)
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

    <!-- 开始训练按钮 -->
<div class="flex justify-center gap-4 sm:gap-6 mb-4 sm:mb-6 flex-shrink-0">
  <button @click="router.push('/practice')"
    class="group relative px-8 sm:px-10 py-3 sm:py-3.5 text-base sm:text-lg rounded-xl sm:rounded-2xl font-bold transition-all duration-300 hover:scale-105 overflow-hidden"
    :style="{ backgroundColor: 'var(--accent)', color: '#1A1A2E' }">
    <span class="relative z-10">⚡ 开始训练</span>
    <div class="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300"></div>
  </button>
  <button @click="router.push('/phonetic')"
    class="group relative px-8 sm:px-10 py-3 sm:py-3.5 text-base sm:text-lg rounded-xl sm:rounded-2xl font-bold transition-all duration-300 hover:scale-105 overflow-hidden"
    :style="{ backgroundColor: 'var(--accent)', color: '#1A1A2E' }">
    <span class="relative z-10">🔤 发音训练</span>
    <div class="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300"></div>
  </button>
</div>

    

    <!-- 搜索 + 下载按钮 -->
    <div class="flex-shrink-0 space-y-2 sm:space-y-3 mb-3 sm:mb-4" style="position: sticky; top: 0; z-index: 10; background: var(--bg-primary); padding-bottom: 6px;">
      <div class="flex items-center gap-2">
        <div class="flex-1">
          <SearchBar :modelValue="store.searchQuery" @update:modelValue="store.searchQuery = $event" />
        </div>
        <div class="flex gap-1 sm:gap-1.5 flex-shrink-0">
          <button @click="downloadExcel"
            class="px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-full text-[10px] sm:text-xs font-medium cursor-pointer transition-all hover:opacity-80 border"
            :style="{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }"
            title="下载 Excel 格式单词表">📥 Excel</button>
          <button @click="downloadPDF"
            class="px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-full text-[10px] sm:text-xs font-medium cursor-pointer transition-all hover:opacity-80 border"
            :style="{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }"
            title="下载 PDF 格式单词表">📄 PDF</button>
          <a href="https://dn710107.ca.archive.org/0/items/ogdens-basic-english-words-list-alphabetic/Ogden%27s%20Basic%20English%20Words%20List%20alphabetic.pdf"
            target="_blank"
            class="px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-full text-[10px] sm:text-xs font-medium cursor-pointer transition-all hover:opacity-80 border no-underline inline-flex items-center"
            :style="{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }"
            title="下载 OGDEN's BASIC ENGLISH 原版 PDF">📖 原档</a>
        </div>
      </div>
      
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div class="flex flex-wrap gap-1 sm:gap-1.5">
          <button v-for="cat in store.categories" :key="cat.id" @click="store.activeCategory = cat.id; showMistakesOnly = false; showFavoritesOnly = false"
            class="px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs rounded-full transition-all border cursor-pointer whitespace-nowrap"
            :style="store.activeCategory === cat.id ? { backgroundColor: 'var(--accent)', borderColor: 'var(--accent)', color: '#1A1A2E', fontWeight: '600' } : { backgroundColor: 'transparent', borderColor: 'var(--border)', color: 'var(--text-secondary)' }">
            {{ cat.label }}<span class="ml-0.5 sm:ml-1 opacity-60">{{ cat.count }}</span>
          </button>
          <button @click="viewMode = viewMode === 'list' ? 'grid' : 'list'"
            class="px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs rounded-full border cursor-pointer transition-all whitespace-nowrap"
            :style="{ backgroundColor: 'transparent', borderColor: 'var(--border)', color: 'var(--text-secondary)' }"
            :title="viewMode === 'list' ? '切换卡片视图' : '切换列表视图'">{{ viewMode === 'list' ? '▦ 卡片' : '☰ 列表' }}</button>
        </div>
        <div class="flex gap-1 sm:gap-1.5">
          <button @click="frequencyFilter = frequencyFilter === 5 ? 0 : 5"
            class="px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs rounded-full border cursor-pointer transition-all whitespace-nowrap"
            :style="frequencyFilter === 5 ? { backgroundColor: 'var(--clay)', borderColor: 'var(--clay)', color: '#fff', fontWeight: '600' } : { backgroundColor: 'transparent', borderColor: 'var(--border)', color: 'var(--text-secondary)' }"
            title="筛选使用频率 5 星单词">★★★★★</button>
          <button @click="frequencyFilter = frequencyFilter === 4 ? 0 : 4"
            class="px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs rounded-full border cursor-pointer transition-all whitespace-nowrap"
            :style="frequencyFilter === 4 ? { backgroundColor: 'var(--clay)', borderColor: 'var(--clay)', color: '#fff', fontWeight: '600' } : { backgroundColor: 'transparent', borderColor: 'var(--border)', color: 'var(--text-secondary)' }"
            title="筛选使用频率 4 星及以上单词">★★★★☆</button>
          <button @click="frequencyFilter = frequencyFilter === 3 ? 0 : 3"
            class="px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs rounded-full border cursor-pointer transition-all whitespace-nowrap"
            :style="frequencyFilter === 3 ? { backgroundColor: 'var(--clay)', borderColor: 'var(--clay)', color: '#fff', fontWeight: '600' } : { backgroundColor: 'transparent', borderColor: 'var(--border)', color: 'var(--text-secondary)' }"
            title="筛选使用频率 3 星及以上单词">★★★☆☆</button>
          <button @click="toggleMistakesMode"
            class="px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs rounded-full border cursor-pointer transition-all whitespace-nowrap"
            :style="showMistakesOnly ? { backgroundColor: '#b13e3e', borderColor: '#b13e3e', color: '#fff', fontWeight: '600' } : { backgroundColor: 'transparent', borderColor: 'var(--border)', color: 'var(--text-secondary)' }"
            title="错题集：查看所有拼写错误的单词">❌ 错题集</button>
          <button @click="toggleFavoritesMode"
            class="px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs rounded-full border cursor-pointer transition-all whitespace-nowrap"
            :style="showFavoritesOnly ? { backgroundColor: '#c96f0e', borderColor: '#c96f0e', color: '#fff', fontWeight: '600' } : { backgroundColor: 'transparent', borderColor: 'var(--border)', color: 'var(--text-secondary)' }"
            title="收藏夹：查看所有收藏的单词">⭐ 收藏夹</button>
        </div>
      </div>
    </div>

    <!-- 单词列表 -->
    <div class="flex-1 overflow-y-auto hide-scrollbar" style="min-height: 0;">
      <WordList
        ref="wordListRef"
        :words="displayWords"
        :viewMode="viewMode"
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