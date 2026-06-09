<script setup>
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { getExampleStatus } from '@/utils/ogdenValidator'
import { favoritesService } from '@/services/storageService'
import phoneticData from '@/data/ogden850-phonetic.json'
import { playNavSound, playCardFlipSound } from '@/composables/useAudioFeedback'
import { SYLLABLE_COLORS, renderColoredSyllables as renderColoredSyllablesUtil, renderColoredIPA as renderColoredIPAUtil } from '@/composables/useSyllableRendering'
import { splitExampleTokens as splitExampleTokensUtil } from '@/composables/useExampleTokens'
import { frequencyStars } from '@/composables/useFrequencyStars'
import verbData from '@/data/ogden850-verbs.json'

function isVerb(wordStr) { return verbData[wordStr.toLowerCase()] !== undefined }
function getVerbInfo(wordStr) { return verbData[wordStr.toLowerCase()] || null }

const props = defineProps({
  word: { type: Object, default: null },
  visible: { type: Boolean, default: false },
  wordList: { type: Array, default: () => [] },
  currentIndex: { type: Number, default: 0 }
})

const emit = defineEmits(['close', 'favorite-changed', 'select-word'])
const isFlipped = ref(false)
const isFav = ref(false)
const slowMode = ref(false)
const speechRate = ref(1.0)

const audioCtx = ref(null)
function getAudioCtx() { if (!audioCtx.value) audioCtx.value = new (window.AudioContext || window.webkitAudioContext)(); return audioCtx.value }

// ===== 语音 =====
let activeUtterance = null
let cardResumeInterval = null

function clearCardSpeech() { if (cardResumeInterval) clearInterval(cardResumeInterval); window.speechSynthesis.cancel(); activeUtterance = null }
function playSingleText(text, onComplete = null) {
  clearCardSpeech()
  if (!text) { if (onComplete) onComplete(); return }
  activeUtterance = new SpeechSynthesisUtterance(text)
  activeUtterance.lang = 'en-US'; activeUtterance.rate = speechRate.value
  activeUtterance.onstart = () => { cardResumeInterval = setInterval(() => { if (window.speechSynthesis.speaking) window.speechSynthesis.resume() }, 500) }
  activeUtterance.onend = () => { clearCardSpeech(); if (onComplete) onComplete() }
  activeUtterance.onerror = () => { clearCardSpeech(); if (onComplete) onComplete() }
  window.speechSynthesis.speak(activeUtterance)
}
function speakWord() { if (!props.word) return; playSingleText(props.word.word) }
function speakExample(exampleText) { playSingleText(exampleText) }
function speakAllExamples() {
  if (!props.word) return
  const examples = props.word.examples || []
  const texts = [props.word.word, ...examples.map(e => e.en)]
  let currentIndex = 0
  function queueNext() { if (currentIndex < texts.length) { const textToPlay = texts[currentIndex]; currentIndex++; playSingleText(textToPlay, queueNext) } }
  queueNext()
}

const exampleValidations = computed(() => { if (!props.word?.examples) return []; return props.word.examples.map(ex => getExampleStatus(ex.en)) })
const phonInfo = computed(() => { if (!props.word?.word) return null; return phoneticData[props.word.word.toLowerCase()] || null })
const isSame = computed(() => { if (!phonInfo.value) return true; const w = phonInfo.value.written; const s = phonInfo.value.spoken; return w.ipa === s.ipa && w.syllables.join(',') === s.syllables.join(',') })

function goPrev() { if (!props.wordList || props.wordList.length === 0) return; const newIdx = props.currentIndex <= 0 ? props.wordList.length - 1 : props.currentIndex - 1; playNavSound(); emit('select-word', props.wordList[newIdx]) }
function goNext() { if (!props.wordList || props.wordList.length === 0) return; const newIdx = props.currentIndex >= props.wordList.length - 1 ? 0 : props.currentIndex + 1; playNavSound(); emit('select-word', props.wordList[newIdx]) }

function isOodWord(word) { const clean = word.toLowerCase().replace(/[.,!?;:'"]/g, ''); return exampleValidations.value.some(v => v.outOfRangeWords.includes(clean)) }
function splitExampleTokens(sentence) { return splitExampleTokensUtil(sentence) }

watch(() => props.word, async (w) => { clearCardSpeech(); if (w) { isFav.value = await favoritesService.isFavorite(w.id) } else { isFav.value = false } })
async function toggleFavorite() { if (!props.word) return; if (isFav.value) { await favoritesService.removeFavorite(props.word.id); isFav.value = false } else { await favoritesService.addFavorite(props.word.id); isFav.value = true }; emit('favorite-changed') }

function toggleSpeechRate() { slowMode.value = !slowMode.value; speechRate.value = slowMode.value ? 0.75 : 1.0 }

function toggleFlip() { isFlipped.value = !isFlipped.value; playCardFlipSound() }
function handleKeydown(e) {
  if (e.key === 'a' || e.key === 'A') { e.preventDefault(); goPrev(); return }
  if (e.key === 'd' || e.key === 'D') { e.preventDefault(); goNext(); return }
  if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFavorite(); return }
  if (e.key === 's' || e.key === 'S') { e.preventDefault(); speakWord(); return }
  if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); toggleFlip(); return }
  if (e.key === 'Escape') { isFlipped.value = false; emit('close') }
}
function close() { isFlipped.value = false; clearCardSpeech(); emit('close') }
watch(() => props.word, () => { isFlipped.value = false; clearCardSpeech() })
onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => { window.removeEventListener('keydown', handleKeydown); clearCardSpeech() })
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible && word" class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" @click.self="close">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
        <div class="relative w-full max-w-2xl perspective-1000">

          <button @click.stop="toggleFavorite" class="absolute -top-2 -left-2 sm:-top-3 sm:-left-3 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-xl sm:text-2xl cursor-pointer transition-all hover:scale-110 z-20" :style="{ backgroundColor: 'var(--bg)', color: isFav ? '#f59e0b' : 'var(--text-muted)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }" :title="isFav ? '取消收藏 (F)' : '添加收藏 (F)'">{{ isFav ? '⭐' : '☆' }}</button>
          <button @click="close" class="absolute -top-3 -right-3 sm:-top-4 sm:-right-4 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-base sm:text-lg cursor-pointer transition-transform hover:scale-110 z-20" :style="{ backgroundColor: 'var(--bg)', color: 'var(--text-muted)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }">✕</button>

          <div class="relative w-full cursor-pointer select-none" :class="{ 'is-flipped': isFlipped }" style="transform-style: preserve-3d; transition: transform 0.6s ease; min-height: 600px;" :style="isFlipped ? 'transform: rotateY(180deg);' : ''" @click="toggleFlip">

            <!-- ==================== 正面 ==================== -->
            <div class="rounded-2xl sm:rounded-3xl flex flex-col" style="backface-visibility: hidden; min-height: 600px; height: 100%;" :style="{ backgroundColor: 'var(--bg)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }">
              <div class="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
                <p class="text-4xl sm:text-6xl font-bold word-display" :style="{ color: 'var(--text)' }">{{ word.word }}</p>
                <span class="text-xl sm:text-2xl mt-1" v-if="word.icon">{{ word.icon }}</span>
              </div>

              <div class="flex-shrink-0 w-5/6 h-px mx-auto opacity-25" :style="{ backgroundColor: 'var(--text-muted)' }"></div>

              <div class="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
                <div v-if="phonInfo" class="w-full max-w-md mx-auto space-y-3 sm:space-y-4">
                  <template v-if="isSame">
                    <div class="text-center"><p class="text-xl sm:text-2xl font-semibold" v-html="renderColoredSyllablesUtil(phonInfo.written.syllables, phonInfo.stress)"></p></div>
                    <div class="text-center"><p class="text-base sm:text-lg" v-html="renderColoredIPAUtil(phonInfo.written.ipa, phonInfo.stress)"></p></div>
                  </template>
                  <template v-else>
                    <div class="grid grid-cols-2 gap-4">
                      <div class="text-center"><p class="text-xl sm:text-2xl font-semibold" v-html="renderColoredSyllablesUtil(phonInfo.written.syllables, phonInfo.stress)"></p></div>
                      <div class="text-center"><p class="text-xl sm:text-2xl font-semibold" v-html="renderColoredSyllablesUtil(phonInfo.spoken.syllables, phonInfo.stress)"></p></div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                      <div class="text-center"><p class="text-base sm:text-lg" v-html="renderColoredIPAUtil(phonInfo.written.ipa, phonInfo.stress)"></p></div>
                      <div class="text-center"><p class="text-base sm:text-lg" v-html="renderColoredIPAUtil(phonInfo.spoken.ipa, phonInfo.stress)"></p></div>
                    </div>
                  </template>
                </div>
                <p v-else class="text-sm sm:text-base phonetic-display" :style="{ color: 'var(--text-muted)' }">{{ word.phonetic }}</p>
              </div>

              <div class="flex-shrink-0 w-5/6 h-px mx-auto opacity-25" :style="{ backgroundColor: 'var(--text-muted)' }"></div>

              <div class="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 gap-3">
                <div class="flex items-center gap-4 sm:gap-6">
                  <button @click.stop="goPrev" class="px-4 py-2 rounded-full text-sm cursor-pointer transition-all hover:scale-105 border" :style="{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }" title="上一个 (A)">←</button>
                  <button @click.stop="speakWord" class="px-6 py-3 rounded-full text-xl cursor-pointer transition-all hover:scale-105" :style="{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text)' }" title="发音 (S)">🔊</button>
                  <button @click.stop="goNext" class="px-4 py-2 rounded-full text-sm cursor-pointer transition-all hover:scale-105 border" :style="{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }" title="下一个 (D)">→</button>
                </div>
                <div class="flex items-center gap-3">
                  <button @click.stop="toggleSpeechRate" class="px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer border transition-all hover:opacity-80" :style="slowMode ? { backgroundColor: 'var(--accent)', borderColor: 'var(--accent)', color: '#1A1A2E' } : { backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }">{{ slowMode ? '🐢 0.75x' : '🚶 1x' }}</button>
                  <button @click.stop="toggleFavorite" class="px-3 py-1.5 rounded-full text-sm cursor-pointer transition-all hover:scale-105" :style="{ backgroundColor: 'var(--bg-secondary)', color: isFav ? '#f59e0b' : 'var(--text-secondary)' }" :title="isFav ? '取消收藏' : '添加收藏'">{{ isFav ? '⭐' : '☆' }}</button>
                </div>
                <p class="text-xs" :style="{ color: 'var(--text-muted)' }">点击或空格翻面</p>
              </div>
            </div>

            <!-- ==================== 背面 ==================== -->
            <div class="absolute inset-0 rounded-2xl sm:rounded-3xl p-5 sm:p-7 overflow-y-auto" style="backface-visibility: hidden; transform: rotateY(180deg); min-height: 600px;" :style="{ backgroundColor: 'var(--bg)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }">
              <p class="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4" :style="{ color: 'var(--accent)' }">{{ word.chinese }}</p>
              
              <div class="flex items-center gap-2 mb-1 flex-wrap">
                <p class="text-sm sm:text-base" :style="{ color: 'var(--text-muted)' }">{{ word.word }} {{ word.phonetic }}</p>
                <span class="text-lg" v-if="word.icon">{{ word.icon }}</span>
                <span class="text-[10px] sm:text-xs" :style="{ color: 'var(--clay)' }" v-if="word.frequency">{{ frequencyStars(word.frequency) }}</span>
              </div>

              <div class="space-y-3 sm:space-y-4 mt-3">
                <div v-for="(example, i) in word.examples" :key="i" class="border-l-3 pl-3 sm:pl-4" :style="{ borderColor: example.type === 'basic' ? 'var(--accent)' : 'var(--success)' }">
                  <div class="flex items-center gap-2 mb-1 flex-wrap">
                    <span class="text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0" :style="example.type === 'basic' ? { backgroundColor: '#e8f4f8', color: '#1a7a9c' } : { backgroundColor: '#e3f3e0', color: '#2b7551' }">{{ example.type === 'basic' ? 'Basic 例句' : 'Standard 例句' }}</span>
                    <span class="text-[10px] sm:text-xs italic" :style="{ color: 'var(--text-muted)' }">{{ example.type === 'basic' ? (word.basic_explanation || '') : (word.standard_explanation || '') }}</span>
                  </div>
                  <div class="flex items-start justify-between gap-2">
                    <p class="text-sm sm:text-base mb-1 leading-relaxed" :style="{ color: 'var(--text)' }"><template v-for="(token, ti) in splitExampleTokens(example.en)" :key="ti"><span :class="isOodWord(token.word) ? 'border-b-2 border-dotted border-red-400 text-red-600 cursor-help' : ''" :title="isOodWord(token.word) ? '⚠️ 超纲词（不在 Ogden 850 词表内）' : ''">{{ token.word }}</span>{{ token.space }}</template></p>
                    <button @click.stop="speakExample(example.en)" class="text-lg cursor-pointer transition-all hover:scale-110 flex-shrink-0 mt-0.5" :style="{ color: 'var(--accent)' }" title="朗读此例句">🔊</button>
                  </div>
                  <p class="text-xs sm:text-sm leading-relaxed" :style="{ color: 'var(--text-secondary)' }">{{ example.zh }}</p>
                  <p v-if="!exampleValidations[i]?.isCompliant" class="text-[10px] sm:text-xs mt-1" :style="{ color: 'var(--text-muted)' }">⚠️ {{ exampleValidations[i].outOfRangeWords.length }} 个超纲词</p>
                  <p v-else class="text-[10px] sm:text-xs mt-1" :style="{ color: 'var(--success)' }">✅ Ogden 850 合规</p>
                </div>
              </div>

              <div v-if="isVerb(word.word)" class="mt-4 sm:mt-5 p-3 sm:p-4 rounded-2xl" :style="{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }">
                <p class="text-[10px] sm:text-xs font-semibold mb-1.5 sm:mb-2" :style="{ color: 'var(--accent)' }">📋 动词时态变化</p>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div><p class="text-[10px]" :style="{ color: 'var(--text-muted)' }">原形</p><p class="text-sm font-bold" :style="{ color: 'var(--text)' }">{{ getVerbInfo(word.word).base }}</p></div>
                  <div><p class="text-[10px]" :style="{ color: 'var(--text-muted)' }">过去式</p><p class="text-sm font-bold" :style="{ color: 'var(--danger)' }">{{ getVerbInfo(word.word).past }}</p></div>
                  <div><p class="text-[10px]" :style="{ color: 'var(--text-muted)' }">过去分词</p><p class="text-sm font-bold" :style="{ color: 'var(--clay)' }">{{ getVerbInfo(word.word).pastParticiple }}</p></div>
                  <div><p class="text-[10px]" :style="{ color: 'var(--text-muted)' }">现在分词</p><p class="text-sm font-bold" :style="{ color: 'var(--success)' }">{{ getVerbInfo(word.word).presentParticiple }}</p></div>
                </div>
                <p v-if="getVerbInfo(word.word).note" class="text-[10px] mt-1.5" :style="{ color: 'var(--text-muted)' }">{{ getVerbInfo(word.word).note }}</p>
              </div>

              <div v-if="word.ogden_principle" class="mt-4 sm:mt-5 p-3 sm:p-4 rounded-2xl" :style="{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }">
                <p class="text-[10px] sm:text-xs font-semibold mb-1 sm:mb-1.5" :style="{ color: 'var(--accent)' }">💡 Ogden 原则解析</p>
                <p class="text-xs sm:text-sm leading-relaxed" :style="{ color: 'var(--text-secondary)' }">{{ word.ogden_principle }}</p>
              </div>

              <div class="flex justify-end gap-2 mt-4">
                <button @click.stop="speakWord" class="px-2.5 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm cursor-pointer transition-all hover:scale-105" :style="{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text)' }" title="读单词">🔊 词</button>
                <button @click.stop="speakAllExamples" class="px-2.5 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm cursor-pointer transition-all hover:scale-105" :style="{ backgroundColor: 'var(--accent)', color: '#1A1A2E' }" title="读全部例句">📢 全部</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.perspective-1000 { perspective: 1000px; }
.modal-enter-active, .modal-leave-active { transition: opacity 0.3s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>