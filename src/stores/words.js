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

  // 计算属性：带上 progress 信息的单词列表（不修改原始对象）
  const wordsWithProgress = computed(() =>
    words.value.map(w => ({
      ...w,
      stage: progressMap.value[w.id]?.stage ?? 0,
      srs: progressMap.value[w.id]?.srs ?? { interval: 0, ease: 2.5, nextReview: null, repetitions: 0 },
    }))
  )

  // 加载 IndexedDB 中的学习进度
  async function loadProgress() {
    const all = await progressService.getAllProgress()
    all.forEach(p => { progressMap.value[p.wordId] = p })
  }

  // 获取需要复习的单词（SRS 到期 + 未学过的）
  const dueWords = computed(() => {
    const now = new Date().toISOString()
    return wordsWithProgress.value.filter(w => {
      const p = progressMap.value[w.id]
      if (!p) return true
      if (!p.srs?.nextReview) return true
      return p.srs.nextReview <= now
    })
  })

  // 获取未掌握的单词
  const unmasteredWords = computed(() => {
    return wordsWithProgress.value.filter(w => w.stage < 5)
  })

  // 获取已掌握的单词
  const masteredWords = computed(() => {
    return wordsWithProgress.value.filter(w => w.stage >= 5)
  })

  const categoryDefs = [
    { id: 'all',             label: '全部' },
    { id: 'operations',      label: '操作词' },
    { id: 'thingsGeneral',   label: '一般事物' },
    { id: 'thingsPicturable',label: '可图示事物' },
    { id: 'qualitiesGeneral',label: '一般性质' },
    { id: 'qualitiesOpposite',label: '反义性质' },
  ]

  const categories = computed(() =>
    categoryDefs.map(cat => ({
      ...cat,
      count: cat.id === 'all' ? words.value.length : words.value.filter(w => w.category === cat.id).length,
    }))
  )

  const filteredWords = computed(() => {
    let result = wordsWithProgress.value
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
  }

  // 训练模式
  const gameMode = ref('guided')
  const currentPhase = ref(null)
  const roundsCompleted = ref(0)
  const phasesUnlocked = ref(['flashcard'])

  return {
    words, wordsWithProgress, searchQuery, activeCategory, selectedWord,
    filteredWords, categories, progressMap, dueWords, unmasteredWords, masteredWords,
    selectWord, clearSelection, loadProgress, updateWordProgress,
    gameMode, currentPhase, roundsCompleted, phasesUnlocked,
  }
})