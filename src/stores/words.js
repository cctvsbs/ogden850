import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import rawWords from '@/data/ogden850.json'
import { progressService } from '@/services/storageService'

export const useWordsStore = defineStore('words', () => {
  const words = ref(rawWords)
  const searchQuery = ref('')
  const activeCategory = ref('all')
  const selectedWord = ref(null)

  // 学习进度映射表（wordId → progress）
  const progressMap = ref({})

  // 加载 IndexedDB 中的学习进度
  async function loadProgress() {
    const all = await progressService.getAllProgress()
    all.forEach(p => { progressMap.value[p.wordId] = p })
    // 同步 stage 到 words
    words.value.forEach(w => {
      if (progressMap.value[w.id]) {
        w.stage = progressMap.value[w.id].stage || 0
        w.srs = progressMap.value[w.id].srs || { interval: 0, ease: 2.5, nextReview: null, repetitions: 0 }
      }
    })
  }

  // 获取需要复习的单词（SRS 到期 + 未学过的）
  const dueWords = computed(() => {
    const now = new Date().toISOString()
    return words.value.filter(w => {
      const p = progressMap.value[w.id]
      if (!p) return true // 未学过
      if (!p.srs?.nextReview) return true // 需要复习
      return p.srs.nextReview <= now // 到期
    })
  })

  // 获取未掌握的单词
  const unmasteredWords = computed(() => {
    return words.value.filter(w => (w.stage || 0) < 5)
  })

  // 获取已掌握的单词
  const masteredWords = computed(() => {
    return words.value.filter(w => (w.stage || 0) >= 5)
  })

  const categories = [
    { id: 'all',             label: '全部',      count: 850 },
    { id: 'operations',      label: '操作词',    count: 100 },
    { id: 'thingsGeneral',   label: '一般事物',  count: 400 },
    { id: 'thingsPicturable',label: '可图示事物',count: 200 },
    { id: 'qualitiesGeneral',label: '一般性质',  count: 100 },
    { id: 'qualitiesOpposite',label: '反义性质', count: 50  },
  ]

  const filteredWords = computed(() => {
    let result = words.value
    if (activeCategory.value !== 'all') result = result.filter(w => w.category === activeCategory.value)
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim()
      result = result.filter(w => w.word.toLowerCase().includes(q) || w.chinese.includes(q) || (w.phonetic && w.phonetic.includes(q)))
    }
    return result
  })

  function selectWord(word) { selectedWord.value = word }
  function clearSelection() { selectedWord.value = null }

  // 更新单词进度
  async function updateWordProgress(wordId, data) {
    await progressService.saveProgress(wordId, data)
    progressMap.value[wordId] = { wordId, ...data }
    const w = words.value.find(w => w.id === wordId)
    if (w) {
      w.stage = data.stage || 0
      w.srs = data.srs || { interval: 0, ease: 2.5, nextReview: null, repetitions: 0 }
    }
  }

  // 训练模式
  const gameMode = ref('guided')
  const currentPhase = ref(null)
  const roundsCompleted = ref(0)
  const phasesUnlocked = ref(['flashcard'])

  return {
    words, searchQuery, activeCategory, selectedWord,
    filteredWords, categories, progressMap, dueWords, unmasteredWords, masteredWords,
    selectWord, clearSelection, loadProgress, updateWordProgress,
    gameMode, currentPhase, roundsCompleted, phasesUnlocked,
  }
})