<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useWordsStore } from '@/stores/words'
import phoneticData from '@/data/ogden850-phonetic.json'
import { favoritesService, mistakesService } from '@/services/storageService'

const store = useWordsStore()

const viewMode = ref('list')
const searchQuery = ref('')
const activeCategory = ref('all')
const selectedWord = ref(null)
const favoriteIds = ref(new Set())
const mistakeWordIds = ref([])
const isMuted = ref(false)

const syllableColors = ['#4A90D9', '#52B788', '#E8864A', '#D94A8F', '#8B5CF6']

const categories = [
  { id: 'all', label: '全部' },
  { id: 'operations', label: '操作词' },
  { id: 'thingsGeneral', label: '一般事物' },
  { id: 'thingsPicturable', label: '可图示' },
  { id: 'qualitiesGeneral', label: '一般性质' },
  { id: 'qualitiesOpposite', label: '反义性质' },
  { id: 'favorites', label: '收藏' },
  { id: 'mistakes', label: '错题集' },
]

const audioCtx = ref(null)
function getAudioCtx() {
  if (!audioCtx.value) audioCtx.value = new (window.AudioContext || window.webkitAudioContext)()
  return audioCtx.value
}
function playNavSound() {
  if (isMuted.value) return
  try {
    const ctx = getAudioCtx()
    const osc = ctx.createOscillator(); const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(800, ctx.currentTime)
    osc.frequency.setValueAtTime(600, ctx.currentTime + 0.05)
    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.1)
  } catch { /* */ }
}

let isSpeaking = false; let lastSpokenText = ''
function speakWord(word) {
  if (!word) return
  if (isSpeaking && word === lastSpokenText) return
  window.speechSynthesis.cancel()
  isSpeaking = true; lastSpokenText = word
  const utterance = new SpeechSynthesisUtterance(word)
  utterance.lang = 'en-US'; utterance.rate = 0.85
  utterance.onend = () => { isSpeaking = false }
  utterance.onerror = () => { isSpeaking = false }
  window.speechSynthesis.speak(utterance)
}

const filteredWords = computed(() => {
  let result = store.words
  if (activeCategory.value === 'favorites') return result.filter(w => favoriteIds.value.has(w.id))
  if (activeCategory.value === 'mistakes') return result.filter(w => mistakeWordIds.value.includes(w.id))
  if (activeCategory.value !== 'all') result = result.filter(w => w.category === activeCategory.value)
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(w => w.word.toLowerCase().includes(q) || w.chinese.includes(q))
  }
  return result
})

function getPhonInfo(word) {
  return phoneticData[word.toLowerCase()] || null
}

function isDifferent(phon) {
  if (!phon) return false
  if (phon.type === 'exception') return true
  return phon.written.syllables.join(',') !== phon.spoken.syllables.join(',')
}

function renderSyls(syls, stress) {
  return syls.map((s, i) => {
    const c = syllableColors[i % syllableColors.length]
    const b = i === stress ? 'font-weight:800;text-decoration:underline;text-underline-offset:4px;' : ''
    return `<span style="color:${c};background:${c}18;${b}">${s}</span>`
  }).join(' ')
}

function renderPhon(ipa, stress) {
  // 1. 去掉前后多余的斜杠、空格
  let p = ipa.replace(/^\/|\/$/g, '').trim();
  
  // 2. 拥抱数据标准：统一使用“点”或者“空格”来物理切开多音节
  let parts = p.includes('.') ? p.split('.') : p.split(' ');
  
  // 过滤掉因为手误产生的空音节
  parts = parts.map(s => s.trim()).filter(Boolean);

  // 3. 遍历每个独立的音节，精细控制 HTML 结构
  const colored = parts.map((part, i) => {
    // 捕获可能藏在音节最前面的重音标记 ˈ 或 ˌ
    const stressMatch = part.match(/^[ˈˌ]/);
    const stressSymbol = stressMatch ? stressMatch[0] : '';
    
    // 纯音标字母本身（剔除符号干扰）
    const pureCleanPart = part.replace(/^[ˈˌ]/, ''); 

    // 获取对应的层级颜色
    const c = syllableColors[i % syllableColors.length];
    const isStressed = i === stress;
    
    const baseStyle = `color:${c};`;
    // 精准加粗、下划线，外加 3px 的完美视觉偏移量
    const underlineStyle = isStressed ? 'font-weight:700;text-decoration:underline;text-underline-offset:3px;' : '';

    // 【核心修正】：符号跟字母物理分离包裹，下划线永远只落在纯音标上！
    let partHtml = '';
    if (stressSymbol) {
      partHtml += `<span style="${baseStyle}">${stressSymbol}</span>`;
    }
    partHtml += `<span style="${baseStyle}${underlineStyle}">${pureCleanPart}</span>`;

    return partHtml;
  }).join(' '); // 4. 完美：2音节、3音节之间用一个标准空格隔开

  // 5. 组装输出
  return `<span style="color:#999">/</span>${colored}<span style="color:#999">/</span>`;
}

function isFavorite(id) { return favoriteIds.value.has(id) }
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
}

const currentPhonInfo = computed(() => {
  if (!selectedWord.value) return null
  return getPhonInfo(selectedWord.value.word)
})

function selectWord(word) { selectedWord.value = word }

function navigateWord(dir) {
  const list = filteredWords.value
  if (!list.length || !selectedWord.value) return
  const idx = list.findIndex(w => w.id === selectedWord.value.id)
  const newIdx = dir === -1 ? (idx <= 0 ? list.length - 1 : idx - 1) : (idx >= list.length - 1 ? 0 : idx + 1)
  playNavSound()
  selectedWord.value = list[newIdx]
}

function handleKeydown(e) {
  if (document.activeElement?.tagName === 'INPUT') return
  if (e.key === 'a' || e.key === 'A') { e.preventDefault(); navigateWord(-1); return }
  if (e.key === 'd' || e.key === 'D') { e.preventDefault(); navigateWord(1); return }
  if (e.key === 's' || e.key === 'S') { e.preventDefault(); if (selectedWord.value) speakWord(selectedWord.value.word); return }
  if (e.key === 'f' || e.key === 'F') { e.preventDefault(); if (selectedWord.value) toggleFavorite(new Event('click'), selectedWord.value.id); return }
  if (e.key === 'Escape') { e.preventDefault(); selectedWord.value = null; return }
}

onMounted(async () => {
  await store.loadProgress()
  const ids = await favoritesService.getAllFavoriteIds()
  favoriteIds.value = new Set(ids)
  const mList = await mistakesService.getAllMistakes()
  mistakeWordIds.value = [...new Set(mList.map(m => m.wordId))]
  window.addEventListener('keydown', handleKeydown)
})
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <div class="w-full max-w-2xl mx-auto px-3 sm:px-6 py-4 sm:py-8 flex flex-col" style="height: calc(100vh - 100px);">
    
    <div class="text-center flex-shrink-0 mb-3">
      <h1 class="text-lg sm:text-xl font-bold word-display" :style="{ color: 'var(--text)' }">🔤 英语发音可视化训练</h1>
      <p class="text-[10px] sm:text-xs opacity-50 mt-0.5" :style="{ color: 'var(--text-muted)' }">
        📖 拼写完整 &nbsp;|&nbsp; 🗣️ 弱读压缩 &nbsp;|&nbsp; 不是字母消失，是 /ə/ 弱化到几乎听不到
      </p>
    </div>

    <div class="flex-shrink-0 space-y-2 mb-3">
      <div class="flex items-center gap-2">
        <input v-model="searchQuery" type="text" placeholder="输入单词，如：chocolate"
          class="flex-1 px-4 py-2.5 sm:py-3 text-base rounded-xl border outline-none transition-all text-center tracking-wider"
          :style="{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }">
        <button @click="isMuted = !isMuted"
          class="px-3 py-2 rounded-full text-xs font-medium cursor-pointer transition-all border flex-shrink-0"
          :style="isMuted ? { backgroundColor: 'var(--clay)', borderColor: 'var(--clay)', color: '#fff' } : { backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }"
          :title="isMuted ? '取消静音' : '静音'">{{ isMuted ? '🔇' : '🔊' }}</button>
      </div>
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div class="flex flex-wrap gap-1 sm:gap-1.5">
          <button v-for="cat in categories" :key="cat.id" @click="activeCategory = cat.id"
            class="px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs rounded-full transition-all border cursor-pointer whitespace-nowrap"
            :style="activeCategory === cat.id ? { backgroundColor: 'var(--accent)', borderColor: 'var(--accent)', color: '#1A1A2E', fontWeight: '600' } : { backgroundColor: 'transparent', borderColor: 'var(--border)', color: 'var(--text-secondary)' }">
            {{ cat.label }}
          </button>
        </div>
        <button @click="viewMode = viewMode === 'list' ? 'grid' : 'list'"
          class="px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs rounded-full border cursor-pointer transition-all whitespace-nowrap"
          :style="{ backgroundColor: 'transparent', borderColor: 'var(--border)', color: 'var(--text-secondary)' }"
          :title="viewMode === 'list' ? '切换卡片视图' : '切换列表视图'">{{ viewMode === 'list' ? '▦ 卡片' : '☰ 列表' }}</button>
      </div>
    </div>

    <!-- ========== 音节划分结果面板 ========== -->
    <div class="flex-shrink-0 rounded-2xl p-6 sm:p-8 text-center mb-3"
      :style="{ backgroundColor: 'var(--bg)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }">
      
      <div v-if="!selectedWord" class="py-12">
        <p class="text-base sm:text-lg" :style="{ color: 'var(--text-muted)' }">👆 输入单词搜索，或从下方列表中选择</p>
      </div>

      <template v-if="selectedWord && currentPhonInfo">
        
        <!-- 书面口语相同 -->
        <template v-if="!isDifferent(currentPhonInfo)">
          <div class="mb-5">
            <p class="text-sm sm:text-base font-medium mb-3" style="color:#999">📖 书面 · 🗣️ 口语（相同）</p>
            <p class="text-3xl sm:text-4xl font-semibold leading-relaxed" v-html="renderSyls(currentPhonInfo.written.syllables, currentPhonInfo.stress)"></p>
          </div>
          <div class="mb-5">
            <p class="text-xl sm:text-2xl leading-relaxed" v-html="renderPhon(currentPhonInfo.written.ipa, currentPhonInfo.stress)"></p>
          </div>
        </template>

        <!-- 书面口语不同 -->
        <template v-else>
          <div class="grid grid-cols-2 gap-6 mb-5">
            <div class="text-center">
              <p class="text-sm sm:text-base font-medium mb-3" style="color:#999">📖 书面</p>
              <p class="text-3xl sm:text-4xl font-semibold leading-relaxed" v-html="renderSyls(currentPhonInfo.written.syllables, currentPhonInfo.stress)"></p>
            </div>
            <div class="text-center">
              <p class="text-sm sm:text-base font-medium mb-3" style="color:#999">🗣️ 口语</p>
              <p class="text-3xl sm:text-4xl font-semibold leading-relaxed" v-html="renderSyls(currentPhonInfo.spoken.syllables, currentPhonInfo.stress)"></p>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-6 mb-5">
            <div class="text-center">
              <p class="text-xl sm:text-2xl leading-relaxed" v-html="renderPhon(currentPhonInfo.written.ipa, currentPhonInfo.stress)"></p>
            </div>
            <div class="text-center">
              <p class="text-xl sm:text-2xl leading-relaxed" v-html="renderPhon(currentPhonInfo.spoken.ipa, currentPhonInfo.stress)"></p>
            </div>
          </div>
        </template>

        <p class="text-base sm:text-lg font-medium mt-4 mb-2" style="color:#E8864A">💡 {{ currentPhonInfo.note }}</p>
        <p class="text-sm sm:text-base mt-2 mb-1 opacity-50 leading-relaxed" :style="{ color: 'var(--text-muted)' }">
          📖 拼写 {{ currentPhonInfo.written.syllables.length }} 音节 · 🗣️ 口语 ≈{{ currentPhonInfo.spoken.syllables.length }} 音节（弱读压缩）
        </p>
        <p class="text-xs sm:text-sm mt-1 mb-4 opacity-50" :style="{ color: 'var(--text-muted)' }">下划线 = 重音音节</p>

        <div class="flex items-center justify-center gap-3 mt-5">
          <button @click="navigateWord(-1)" class="px-3 py-1.5 rounded-full text-xs cursor-pointer border"
            :style="{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }" title="上一个 (A)">← A 上一个</button>
          <button @click="speakWord(selectedWord.word)"
            class="px-5 py-2 rounded-full text-sm cursor-pointer transition-all hover:scale-105"
            :style="{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text)' }">🔊 发音 (S)</button>
          <button @click="(e) => toggleFavorite(e, selectedWord.id)"
            class="px-3 py-2 rounded-full text-lg cursor-pointer transition-all hover:scale-105"
            :style="{ backgroundColor: 'var(--bg-secondary)', color: isFavorite(selectedWord.id) ? '#f59e0b' : 'var(--text-muted)' }"
            :title="isFavorite(selectedWord.id) ? '取消收藏 (F)' : '添加收藏 (F)'">{{ isFavorite(selectedWord.id) ? '⭐' : '☆' }}</button>
          <button @click="navigateWord(1)" class="px-3 py-1.5 rounded-full text-xs cursor-pointer border"
            :style="{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }" title="下一个 (D)">D 下一个 →</button>
        </div>

        <p class="text-center text-[10px] mt-4 opacity-50" :style="{ color: 'var(--text-muted)' }">
          按 <kbd>S</kbd> 发音 · <kbd>A</kbd> 上一个 · <kbd>D</kbd> 下一个 · <kbd>F</kbd> 收藏 · <kbd>Esc</kbd> 清除
        </p>
      </template>
    </div>

    <!-- ========== 单词列表 ========== -->
    <div class="flex-1 overflow-y-auto hide-scrollbar rounded-2xl p-4"
      :style="{ backgroundColor: 'var(--bg)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }">
      
      <div v-if="viewMode === 'list'" class="space-y-1">
        <div v-for="word in filteredWords" :key="word.id"
          @click="selectWord(word)"
          class="flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200"
          :style="selectedWord?.id === word.id ? { backgroundColor: 'var(--bg-secondary)' } : {}">
          <div class="flex items-center gap-3">
            <span class="text-base sm:text-lg font-semibold" :style="{ color: 'var(--text)' }">{{ word.word }}</span>
            <span class="text-[10px] sm:text-xs" :style="{ color: 'var(--text-muted)' }">{{ word.phonetic }}</span>
          </div>
          <div class="flex items-center gap-2">
            <button @click="(e) => toggleFavorite(e, word.id)" class="text-sm cursor-pointer"
              :style="{ color: isFavorite(word.id) ? '#f59e0b' : 'var(--text-muted)' }">{{ isFavorite(word.id) ? '⭐' : '☆' }}</button>
            <span class="text-xs" :style="{ color: 'var(--text-secondary)' }">{{ word.chinese }}</span>
          </div>
        </div>
        <div v-if="filteredWords.length === 0" class="text-center py-10 text-sm" :style="{ color: 'var(--text-muted)' }">没有匹配的单词</div>
      </div>

      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        <div v-for="word in filteredWords" :key="word.id"
          @click="selectWord(word)"
          class="p-3 rounded-xl cursor-pointer transition-all duration-200 border relative"
          :style="selectedWord?.id === word.id ? { backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--accent)' } : { backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }">
          <button @click="(e) => toggleFavorite(e, word.id)" class="absolute top-1 right-1 text-xs cursor-pointer"
            :style="{ color: isFavorite(word.id) ? '#f59e0b' : 'var(--text-muted)' }">{{ isFavorite(word.id) ? '⭐' : '☆' }}</button>
          <p class="text-base font-bold" :style="{ color: 'var(--text)' }">{{ word.word }}</p>
          <p class="text-[10px]" :style="{ color: 'var(--text-muted)' }">{{ word.phonetic }}</p>
          <p class="text-xs mt-1" :style="{ color: 'var(--text-secondary)' }">{{ word.chinese }}</p>
        </div>
        <div v-if="filteredWords.length === 0" class="col-span-full text-center py-10 text-sm" :style="{ color: 'var(--text-muted)' }">没有匹配的单词</div>
      </div>
    </div>

    <p class="text-center text-[10px] mt-3 flex-shrink-0 opacity-40" :style="{ color: 'var(--text-muted)' }">
      颜色：<span style="color:#4A90D9">蓝</span> <span style="color:#52B788">绿</span> <span style="color:#E8864A">橙</span> <span style="color:#D94A8F">粉</span> &nbsp; 划线=重音
    </p>
  </div>
</template>

<style scoped>
.hide-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
.hide-scrollbar::-webkit-scrollbar { display: none; }
kbd { background: #1e1e1c; padding: 2px 6px; border-radius: 20px; margin: 0 2px; font-size: 0.6rem; color: #e3dccc; }
</style>