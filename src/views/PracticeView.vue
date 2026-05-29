<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useWordsStore } from '@/stores/words'
import { useRouter, useRoute } from 'vue-router'
import { progressService, statsService, mistakesService, favoritesService } from '@/services/storageService'
import { getExampleStatus } from '@/utils/ogdenValidator'

const store = useWordsStore()
const router = useRouter()
const route = useRoute()

const mode = ref('flashcard')

function getModeFromQuery() {
  const params = new URLSearchParams(window.location.search)
  const m = params.get('mode')
  if (m && ['flashcard', 'choice', 'spelling', 'expression'].includes(m)) return m
  return null
}
const queryMode = getModeFromQuery()
if (queryMode) { mode.value = queryMode; window.history.replaceState({}, '', window.location.pathname) }

watch(() => route.query.mode, (newMode) => {
  if (newMode && ['flashcard', 'choice', 'spelling', 'expression'].includes(newMode)) switchMode(newMode)
})

const audioCtx = ref(null)
function getAudioCtx() { if (!audioCtx.value) audioCtx.value = new (window.AudioContext || window.webkitAudioContext)(); return audioCtx.value }
function playChoiceSound(correct) { try { const ctx = getAudioCtx(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.connect(gain); gain.connect(ctx.destination); gain.gain.setValueAtTime(0.22, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35); if (correct) { osc.frequency.setValueAtTime(523, ctx.currentTime); osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1); osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2) } else { osc.frequency.setValueAtTime(200, ctx.currentTime); osc.frequency.setValueAtTime(160, ctx.currentTime + 0.15) } osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.35) } catch { /* */ } }
function playFinishSound() { try { const ctx = getAudioCtx(); [523, 659, 784, 1047].forEach((freq, i) => { const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.connect(gain); gain.connect(ctx.destination); osc.type = 'sine'; osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12); gain.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.12); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.25); osc.start(ctx.currentTime + i * 0.12); osc.stop(ctx.currentTime + i * 0.12 + 0.25) }) } catch { /* */ } }
function playFlipSound() { try { const ctx = getAudioCtx(); const bufferSize = ctx.sampleRate * 0.12; const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate); const data = buffer.getChannelData(0); for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.03)); const noise = ctx.createBufferSource(); noise.buffer = buffer; const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.setValueAtTime(3000, ctx.currentTime); filter.Q.setValueAtTime(0.8, ctx.currentTime); const gain = ctx.createGain(); gain.gain.setValueAtTime(0.06, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12); noise.connect(filter); filter.connect(gain); gain.connect(ctx.destination); noise.start(ctx.currentTime); noise.stop(ctx.currentTime + 0.12) } catch { /* */ } }
function playNavSound() { try { const ctx = getAudioCtx(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.connect(gain); gain.connect(ctx.destination); osc.type = 'sine'; osc.frequency.setValueAtTime(800, ctx.currentTime); osc.frequency.setValueAtTime(600, ctx.currentTime + 0.05); gain.gain.setValueAtTime(0.08, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.1) } catch { /* */ } }

// ===== 语音引擎 =====
let currentVoice = null; let availableVoices = []
const selectedGender = ref('female'); const selectedAccent = ref('us')
const selectedRate = ref(1.0)
const flashcardSlowMode = ref(false); const choiceSlowMode = ref(false); const spellingSlowMode = ref(false)
let isSpeaking = false; let lastSpokenText = ''; let speechTimeout = null
let resumeInterval = null; let activeUtterance = null

async function initVoices() {
  availableVoices = await new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices()
    if (voices.length > 0) resolve(voices)
    else { window.speechSynthesis.onvoiceschanged = () => resolve(window.speechSynthesis.getVoices()); setTimeout(() => resolve(window.speechSynthesis.getVoices() || []), 200) }
  })
  updateVoice(); triggerWarmUp()
}
function triggerWarmUp() { try { window.speechSynthesis.cancel(); const warmUp = new SpeechSynthesisUtterance(''); warmUp.volume = 0; window.speechSynthesis.speak(warmUp) } catch { /* */ } }
function selectBestVoice(gender, accent, voices) {
  const langPrefix = accent === 'uk' ? 'en-GB' : 'en-US'
  const targetList = gender === 'female' ? (accent === 'uk' ? ['Microsoft Susan', 'Google UK English Female', 'Fiona', 'Moira', 'British Female'] : ['Microsoft Jenny', 'Google US English Female', 'Samantha', 'Microsoft Zira', 'Karen']) : (accent === 'uk' ? ['Microsoft George', 'Google UK English Male', 'Oliver', 'British Male', 'Daniel'] : ['Microsoft Guy', 'Google US English Male', 'Tom', 'Microsoft David', 'Alex'])
  for (const target of targetList) { const found = voices.find(v => v.name.includes(target) && v.lang.startsWith(langPrefix.slice(0, 2))); if (found) return found }
  const fallback = voices.find(v => v.lang.startsWith(langPrefix.slice(0, 2))); if (fallback) return fallback
  return voices.find(v => v.lang.startsWith('en'))
}
function updateVoice() { const newVoice = selectBestVoice(selectedGender.value, selectedAccent.value, availableVoices); if (newVoice) currentVoice = newVoice }
function toggleAccent() { selectedAccent.value = selectedAccent.value === 'us' ? 'uk' : 'us'; updateVoice() }
function toggleGender() { selectedGender.value = selectedGender.value === 'female' ? 'male' : 'female'; updateVoice() }
function clearAllTimers() { if (speechTimeout) clearTimeout(speechTimeout); if (resumeInterval) clearInterval(resumeInterval) }
function speak() {
  let text = ''
  if (mode.value === 'expression' && currentExpression.value) text = currentExpression.value.answer
  else if (mode.value === 'spelling' && currentSpelling.value) text = currentSpelling.value.word
  else if (mode.value === 'choice' && currentChoice.value) text = currentChoice.value.word
  else if (mode.value === 'flashcard' && currentCard.value) text = isFlipped.value ? `${currentCard.value.word}. ${currentCard.value.examples[0]?.en || ''}` : currentCard.value.word
  if (!text) return
  if (isSpeaking && text === lastSpokenText) return
  clearAllTimers()
  if (window.speechSynthesis.speaking) window.speechSynthesis.cancel()
  isSpeaking = true; lastSpokenText = text
  activeUtterance = new SpeechSynthesisUtterance(text)
  activeUtterance.lang = selectedAccent.value === 'uk' ? 'en-GB' : 'en-US'
  activeUtterance.rate = selectedRate.value; activeUtterance.pitch = 1.0
  if (currentVoice) activeUtterance.voice = currentVoice
  activeUtterance.onstart = () => { resumeInterval = setInterval(() => { if (window.speechSynthesis.speaking) window.speechSynthesis.resume() }, 500) }
  activeUtterance.onend = () => { isSpeaking = false; activeUtterance = null; clearAllTimers() }
  activeUtterance.onerror = (event) => { isSpeaking = false; activeUtterance = null; clearAllTimers(); if (event.error === 'network' || event.error === 'interrupted') triggerWarmUp() }
  speechTimeout = setTimeout(() => { if (isSpeaking) { isSpeaking = false; clearAllTimers(); window.speechSynthesis.cancel() } }, 5000)
  window.speechSynthesis.speak(activeUtterance)
}

// ===== 闪卡 =====
const queue = ref([]); const currentIndex = ref(0); const isFlipped = ref(false); const stats = ref({ again: 0, hard: 0, good: 0, easy: 0 })
const PEXELS_API_KEY = 'w9QWceT1L1oYUifqA4dVeVJx7hML4lxQrKj2vPlUC4Zvd4KElIAFeJlb'
const imageCache = new Map(); const currentImageUrl = ref(null); const imageLoading = ref(false); let currentImageRequestId = 0
const abstractWords = new Set(['a','an','the','of','or','and','but','if','as','at','by','for','in','on','to','with','from','than','that','this','it','its','be','is','am','are','was','were','been','being','have','has','had','having','do','does','did','doing','will','would','can','could','may','might','shall','should','not','no','nor','so','yet','just','only','also','even','still','very','too','quite','such','all','some','any','every','each','both','few','more','most','much','many','enough','he','she','they','we','you','i','me','him','her','us','them','my','your','his','our','their','who','whom','here','there','where','when','why','how','what','which','then','now','ago','before','after','while','though','although','because','since','until','till','once','ever','never','always','often','sometimes','maybe','perhaps','really','almost','hardly','off','up','down','over','under','out','back','away','yes','no','please','well','together','between','among','other','another','same','different','own','one','two','three'])
const isOffline = ref(false)
function initQueue() { const pool = store.dueWords.length > 0 ? [...store.dueWords] : [...store.unmasteredWords]; const shuffled = pool.sort(() => Math.random() - 0.5); queue.value = shuffled.slice(0, 20); currentIndex.value = 0; isFlipped.value = false; stats.value = { again: 0, hard: 0, good: 0, easy: 0 }; saveAllProgress() }
const currentCard = computed(() => queue.value.length === 0 ? null : queue.value[currentIndex.value])
const flashcardProgressPercent = computed(() => queue.value.length === 0 ? 100 : ((currentIndex.value + 1) / queue.value.length) * 100)
const flashcardFinished = computed(() => queue.value.length === 0)
function toggleFlip() { if (!currentCard.value) return; isFlipped.value = !isFlipped.value; playFlipSound() }
function applyGrade(grade) { if (!currentCard.value || queue.value.length === 0) return; stats.value[grade]++; const card = queue.value[currentIndex.value]; queue.value.splice(currentIndex.value, 1); if (grade === 'again') { const insertPos = Math.min(currentIndex.value + 1, queue.value.length); queue.value.splice(insertPos, 0, card) } else if (grade === 'hard') { const offset = Math.floor(Math.random() * 5) + 1; const insertPos = Math.min(currentIndex.value + offset, queue.value.length); queue.value.splice(insertPos, 0, card) } else if (grade === 'good') { const backOffset = Math.floor(Math.random() * 6) + 3; const insertPos = Math.max(queue.value.length - backOffset, 0); queue.value.splice(insertPos, 0, card) }; const now = new Date(); let nextReview = null; if (grade === 'again') nextReview = new Date(now.getTime() + 5 * 60 * 1000).toISOString(); else if (grade === 'hard') nextReview = new Date(now.getTime() + 60 * 60 * 1000).toISOString(); else if (grade === 'good') nextReview = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(); else if (grade === 'easy') nextReview = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(); store.updateWordProgress(card.id, { stage: grade === 'easy' ? 5 : (grade === 'good' ? 3 : 1), srs: { interval: 0, ease: 2.5, nextReview, repetitions: 0 } }); saveAllProgress(); if (queue.value.length === 0) { isFlipped.value = false; playFinishSound(); return }; if (currentIndex.value >= queue.value.length) currentIndex.value = queue.value.length - 1; if (currentIndex.value < 0) currentIndex.value = 0; isFlipped.value = false; currentImageUrl.value = null; if (!isOffline.value) loadImageForCurrent() }
function nextCard() { if (queue.value.length && currentIndex.value + 1 < queue.value.length) { currentIndex.value++; isFlipped.value = false; currentImageUrl.value = null; saveAllProgress(); if (!isOffline.value) loadImageForCurrent() } }
function prevCard() { if (queue.value.length && currentIndex.value - 1 >= 0) { currentIndex.value--; isFlipped.value = false; currentImageUrl.value = null; saveAllProgress(); if (!isOffline.value) loadImageForCurrent() } }
function restartFlashcard() { initQueue(); currentImageUrl.value = null; if (!isOffline.value) loadImageForCurrent() }
async function searchPexels(query) { if (isOffline.value) return null; try { const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=square&size=medium`, { headers: { Authorization: PEXELS_API_KEY } }); if (!response.ok) return null; const data = await response.json(); if (data.photos?.length > 0) { const imgUrl = data.photos[0].src.medium; return new Promise((resolve) => { const img = new Image(); const timeoutId = setTimeout(() => resolve(null), 5000); img.onload = () => { clearTimeout(timeoutId); resolve(img) }; img.onerror = () => { clearTimeout(timeoutId); resolve(null) }; img.src = imgUrl }) } return null } catch { return null } }
async function fetchImage(word, chinese) { if (abstractWords.has(word.toLowerCase())) return null; if (chinese) { const firstMeaning = chinese.split('；')[0].split('；')[0].split(';')[0].split('，')[0].trim(); const zhResult = await searchPexels(firstMeaning); if (zhResult) return zhResult } return await searchPexels(word) }
async function loadImageForCard(card) { if (!card) return null; const key = card.word.toLowerCase(); if (imageCache.has(key)) return imageCache.get(key); if (abstractWords.has(key)) { imageCache.set(key, null); return null } const img = await fetchImage(card.word, card.chinese); imageCache.set(key, img || null); return img }
async function loadImageForCurrent() { if (!currentCard.value || isOffline.value) return; const requestId = ++currentImageRequestId; imageLoading.value = true; currentImageUrl.value = null; const img = await loadImageForCard(currentCard.value); if (requestId === currentImageRequestId) { currentImageUrl.value = img?.src || null; imageLoading.value = false } }
watch(currentCard, (newCard) => { if (newCard && !isOffline.value) loadImageForCurrent() }, { immediate: true })
const currentExampleCheck = ref(null)
watch(currentCard, (card) => { if (card?.examples?.[0]) { currentExampleCheck.value = getExampleStatus(card.examples[0].en) } else { currentExampleCheck.value = null } })
function isOodWord(word) { const clean = word.toLowerCase().replace(/[.,!?;:'"]/g, ''); return currentExampleCheck.value?.outOfRangeWords?.includes(clean) || false }
function splitExampleTokens(sentence) { const tokens = []; const regex = /(\S+)(\s*)/g; let match; while ((match = regex.exec(sentence)) !== null) { tokens.push({ word: match[1], space: match[2] }) } return tokens }
function speakFlashcardWord() { if (currentCard.value) { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(currentCard.value.word); u.lang = selectedAccent.value === 'uk' ? 'en-GB' : 'en-US'; u.rate = selectedRate.value; if (currentVoice) u.voice = currentVoice; window.speechSynthesis.speak(u) } }
function speakFlashcardExample() { if (currentCard.value?.examples?.[0]) { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(currentCard.value.examples[0].en); u.lang = selectedAccent.value === 'uk' ? 'en-GB' : 'en-US'; u.rate = selectedRate.value; if (currentVoice) u.voice = currentVoice; window.speechSynthesis.speak(u) } }

// ===== 安全洗牌算法 =====
function shuffleArray(array) {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// ===== 选择题 =====
const choiceQueue = ref([]); const choiceIndex = ref(0); const choiceOptions = ref([])
const highlightedOption = ref(null); const confirmedOption = ref(null); const isAnswered = ref(false)
const choiceStats = ref({ correct: 0, wrong: 0 }); const roundSize = 10

function generateOptions(correctWord) {
  if (!correctWord) return []
  const others = store.words.filter(w => w.id !== correctWord.id)
  const shuffledOthers = shuffleArray(others)
  const distractors = shuffledOthers.slice(0, 3).map(w => w.chinese)
  const rawOptions = [
    { text: correctWord.chinese, correct: true },
    ...distractors.map(t => ({ text: t, correct: false }))
  ]
  return shuffleArray(rawOptions)
}

function initChoiceMode() {
  const pool = store.dueWords && store.dueWords.length > 0
    ? [...store.dueWords]
    : [...(store.unmasteredWords || [])]
  if (pool.length === 0) return
  const shuffledPool = shuffleArray(pool)
  choiceQueue.value = shuffledPool.slice(0, roundSize)
  choiceIndex.value = 0
  if (choiceQueue.value[0]) {
    choiceOptions.value = generateOptions(choiceQueue.value[0])
  }
  highlightedOption.value = null
  confirmedOption.value = null
  isAnswered.value = false
  choiceStats.value = { correct: 0, wrong: 0 }
  choiceSlowMode.value = false
  selectedRate.value = 1.0
}

const currentChoice = computed(() => choiceQueue.value.length === 0 ? null : choiceQueue.value[choiceIndex.value])
const choiceFinished = computed(() => choiceQueue.value.length > 0 && choiceIndex.value >= choiceQueue.value.length)
const choiceProgressPercent = computed(() => choiceQueue.value.length === 0 ? 0 : (choiceIndex.value / choiceQueue.value.length) * 100)
function selectChoice(index) { if (isAnswered.value) return; isAnswered.value = true; confirmedOption.value = index; highlightedOption.value = index; const correct = choiceOptions.value[index].correct; playChoiceSound(correct); if (correct) choiceStats.value.correct++; else choiceStats.value.wrong++; saveAllProgress(); setTimeout(() => { if (choiceIndex.value + 1 >= choiceQueue.value.length) { choiceIndex.value++; saveAllProgress(); setTimeout(() => playFinishSound(), 100) } else { choiceIndex.value++; if (choiceQueue.value[choiceIndex.value]) choiceOptions.value = generateOptions(choiceQueue.value[choiceIndex.value]); highlightedOption.value = null; confirmedOption.value = null; isAnswered.value = false } }, 800) }
function highlightChoice(index) { if (isAnswered.value) return; highlightedOption.value = index }
function confirmChoice() { if (highlightedOption.value === null || isAnswered.value) return; selectChoice(highlightedOption.value) }
function cancelChoice() { if (isAnswered.value) return; highlightedOption.value = null }
function restartChoice() { initChoiceMode() }

// ===== 拼写（隐藏 input 移动端优化版） =====
const spellingQueue = ref([]); const spellingIndex = ref(0)
const isSpellingSubmitted = ref(false); const isSpellingCorrect = ref(false)
const hidePhonetic = ref(true)
const spellingStats = ref({ correct: 0, wrong: 0, hints: 0 }); const spellingRoundSize = 10
const spellingHintLetters = ref([])
const spellingCursor = ref(0)
const spellingUserInput = ref({})
const hiddenSpellingInput = ref(null)

function initSpellingMode() { const pool = store.dueWords.length > 0 ? [...store.dueWords] : [...store.unmasteredWords]; const shuffled = pool.sort(() => Math.random() - 0.5); spellingQueue.value = shuffled.slice(0, spellingRoundSize); spellingIndex.value = 0; isSpellingSubmitted.value = false; isSpellingCorrect.value = false; spellingStats.value = { correct: 0, wrong: 0, hints: 0 }; spellingHintLetters.value = []; hidePhonetic.value = true; spellingSlowMode.value = false; selectedRate.value = 1.0; spellingCursor.value = 0; spellingUserInput.value = {}; nextTick(() => focusSpellingSlots()) }
const currentSpelling = computed(() => spellingQueue.value.length === 0 ? null : spellingQueue.value[spellingIndex.value])
const spellingFinished = computed(() => spellingQueue.value.length > 0 && spellingIndex.value >= spellingQueue.value.length)
const spellingProgressPercent = computed(() => spellingQueue.value.length === 0 ? 0 : (spellingIndex.value / spellingQueue.value.length) * 100)

const spellingLetterSlots = computed(() => {
  if (!currentSpelling.value) return []
  const target = currentSpelling.value.word
  const hintedSet = new Set(spellingHintLetters.value)
  return target.split('').map((char, i) => {
    const userChar = spellingUserInput.value[i]
    if (userChar !== undefined) return { char, display: userChar, status: userChar.toLowerCase() === char.toLowerCase() ? 'filled' : 'wrong' }
    if (hintedSet.has(i)) return { char, display: char, status: 'hinted' }
    return { char, display: '_', status: 'pending' }
  })
})

const spellingAllCorrect = computed(() => {
  if (!currentSpelling.value || isSpellingSubmitted.value) return false
  return spellingLetterSlots.value.every(s => s.status === 'filled')
})
watch(spellingAllCorrect, (val) => { if (val) setTimeout(() => submitSpelling(), 300) })

function focusSpellingSlots() { const input = hiddenSpellingInput.value; if (input) { input.value = ' '; input.focus() } }
function setSpellingCursor(idx) { spellingCursor.value = idx; focusSpellingSlots() }

function handleHiddenSpellingInput(e) {
  const input = e.target; const val = input.value
  if (val.length > 1) { const char = val.charAt(val.length - 1); if (/^[a-zA-Z]$/.test(char)) { spellingUserInput.value[spellingCursor.value] = char.toLowerCase(); if (spellingCursor.value < spellingLetterSlots.value.length - 1) spellingCursor.value++ } }
  else if (val.length === 0) { const slot = spellingLetterSlots.value[spellingCursor.value]; if (slot && slot.status !== 'pending') { delete spellingUserInput.value[spellingCursor.value] } else if (spellingCursor.value > 0) { spellingCursor.value--; delete spellingUserInput.value[spellingCursor.value] } }
  input.value = ' '
}

function handleSpellingKeydown(e) { if (isSpellingSubmitted.value) return; if (e.key === 'ArrowLeft') { e.preventDefault(); if (spellingCursor.value > 0) spellingCursor.value-- } else if (e.key === 'ArrowRight') { e.preventDefault(); if (spellingCursor.value < spellingLetterSlots.value.length - 1) spellingCursor.value++ } }

function showSpellingHint() { if (isSpellingSubmitted.value || !currentSpelling.value) return; spellingStats.value.hints++; const word = currentSpelling.value.word; const hintedSet = new Set(spellingHintLetters.value); const unhinted = word.split('').map((_, i) => i).filter(i => !hintedSet.has(i)); if (unhinted.length === 0) { spellingHintLetters.value = []; return }; const randomIdx = unhinted[Math.floor(Math.random() * unhinted.length)]; spellingHintLetters.value = [...spellingHintLetters.value, randomIdx]; saveAllProgress() }
function clearSpellingHints() { spellingHintLetters.value = []; saveAllProgress() }

function submitSpelling() { if (isSpellingSubmitted.value || !currentSpelling.value) return; const answer = spellingLetterSlots.value.map(s => s.display).join(''); const correct = answer.toLowerCase() === currentSpelling.value.word.toLowerCase(); isSpellingSubmitted.value = true; isSpellingCorrect.value = correct; if (correct) { spellingStats.value.correct++; store.updateWordProgress(currentSpelling.value.id, { stage: (currentSpelling.value.stage || 0) + 1, srs: { ...currentSpelling.value.srs, nextReview: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() } }); mistakesService.removeMistakeByWordId(currentSpelling.value.id) } else { spellingStats.value.wrong++; mistakesService.addMistake(currentSpelling.value.id, 'spelling', answer, currentSpelling.value.word, currentSpelling.value.word, currentSpelling.value.chinese) }; playChoiceSound(correct); saveAllProgress(); setTimeout(() => { if (spellingIndex.value + 1 >= spellingQueue.value.length) { spellingIndex.value++; saveAllProgress(); setTimeout(() => playFinishSound(), 100) } else { spellingIndex.value++; isSpellingSubmitted.value = false; isSpellingCorrect.value = false; spellingHintLetters.value = []; hidePhonetic.value = true; spellingSlowMode.value = false; selectedRate.value = 1.0; spellingCursor.value = 0; spellingUserInput.value = {}; nextTick(() => focusSpellingSlots()) } }, 1200) }
function restartSpelling() { initSpellingMode() }

// ===== 收藏 =====
const isFavFlashcard = ref(false); const isFavChoice = ref(false); const isFavSpelling = ref(false)
watch(currentCard, async (card) => { if (card) isFavFlashcard.value = await favoritesService.isFavorite(card.id); else isFavFlashcard.value = false })
watch(currentChoice, async (choice) => { if (choice) isFavChoice.value = await favoritesService.isFavorite(choice.id); else isFavChoice.value = false })
watch(currentSpelling, async (spelling) => { if (spelling) isFavSpelling.value = await favoritesService.isFavorite(spelling.id); else isFavSpelling.value = false })
async function toggleFavFlashcard() { if (!currentCard.value) return; if (isFavFlashcard.value) { await favoritesService.removeFavorite(currentCard.value.id); isFavFlashcard.value = false } else { await favoritesService.addFavorite(currentCard.value.id); isFavFlashcard.value = true } }
async function toggleFavChoice() { if (!currentChoice.value) return; if (isFavChoice.value) { await favoritesService.removeFavorite(currentChoice.value.id); isFavChoice.value = false } else { await favoritesService.addFavorite(currentChoice.value.id); isFavChoice.value = true } }
async function toggleFavSpelling() { if (!currentSpelling.value) return; if (isFavSpelling.value) { await favoritesService.removeFavorite(currentSpelling.value.id); isFavSpelling.value = false } else { await favoritesService.addFavorite(currentSpelling.value.id); isFavSpelling.value = true } }

// ===== 表达模式 =====
const expressionTasks = ref([]); const expressionIndex = ref(0)
const expressionSubmitted = ref(false); const expressionFeedback = ref('')
const expressionStats = ref({ completed: 0, total: 0 }); const expressionRoundSize = 5
const expressionHintWords = ref([])
const submittedAnswer = ref(''); const expressionCursor = ref({ wordIndex: 0, letterIndex: 0 })
const expressionUserInput = ref({}); const expressionSlowMode = ref(false)
const hiddenExpressionInput = ref(null)
const expressionBank = [
  { zh: '我需要准确记录每一笔开销。', keywords: ['keep', 'account', 'money', 'spent', 'correct'], hint: 'keep a correct account of the money spent', answer: 'Keep a correct account of the money spent.' },
  { zh: '她给了我一本书作为生日礼物。', keywords: ['give', 'book', 'birthday'], hint: 'give a book for a birthday', answer: 'She gave me a book for my birthday.' },
  { zh: '请来参加聚会。', keywords: ['come', 'party'], hint: 'come to the party', answer: 'Please come to the party.' },
  { zh: '他在报纸上看到一则广告。', keywords: ['see', 'advertisement', 'newspaper'], hint: 'see an advertisement in the newspaper', answer: 'He saw an advertisement in the newspaper.' },
  { zh: '吃饭前先洗手。', keywords: ['wash', 'hands', 'before', 'eating'], hint: 'wash hands before eating', answer: 'Wash your hands before eating.' },
  { zh: '你能帮我一下吗？', keywords: ['give', 'hand', 'help'], hint: 'give me a hand', answer: 'Can you give me a hand?' },
  { zh: '天空乌云密布。', keywords: ['sky', 'black', 'clouds'], hint: 'sky was black with clouds', answer: 'The sky was black with clouds.' },
  { zh: '请保持房间干净。', keywords: ['keep', 'room', 'clean'], hint: 'keep the room clean', answer: 'Please keep the room clean.' },
  { zh: '那是一次善举。', keywords: ['act', 'kindness'], hint: 'an act of kindness', answer: 'It was an act of kindness.' },
  { zh: '她有一副好嗓子。', keywords: ['beautiful', 'voice'], hint: 'a beautiful voice', answer: 'She has a beautiful voice.' },
]
const currentExpression = computed(() => expressionTasks.value.length === 0 ? null : expressionTasks.value[expressionIndex.value])
const expressionFinished = computed(() => expressionTasks.value.length > 0 && expressionIndex.value >= expressionTasks.value.length)
const expressionProgressPercent = computed(() => expressionTasks.value.length === 0 ? 0 : (expressionIndex.value / expressionTasks.value.length) * 100)
function parseAnswerToWords(answer) { const rawWords = answer.split(/\s+/).filter(Boolean); return rawWords.map(w => ({ text: w, letters: w.split('') })) }
const expressionLetterSlots = computed(() => {
  if (!currentExpression.value) return { words: [], totalLetters: 0 }
  const words = parseAnswerToWords(currentExpression.value.answer); const hintedSet = new Set(expressionHintWords.value); let totalLetters = 0
  const result = words.map((word, wi) => { const slots = word.letters.map((char, si) => { const key = `${wi}-${si}`; const isLetter = /[a-zA-Z]/.test(char); if (!isLetter) return { char, display: char, status: 'auto', key }; totalLetters++; const userChar = expressionUserInput.value[key]; if (userChar !== undefined) return { char, display: userChar, status: userChar.toLowerCase() === char.toLowerCase() ? 'filled' : 'wrong', key }; if (hintedSet.has(wi)) return { char, display: '_', status: 'hinted', key }; return { char, display: '_', status: 'pending', key } }); return { text: word.text, slots } }); return { words: result, totalLetters }
})
const expressionAllCorrect = computed(() => { if (!currentExpression.value || expressionSubmitted.value) return false; const slots = expressionLetterSlots.value.words; let allFilled = true; for (const word of slots) { for (const slot of word.slots) { if (slot.status === 'pending' || slot.status === 'wrong' || slot.status === 'hinted') { allFilled = false; break } } if (!allFilled) break }; return allFilled && slots.length > 0 })
watch(expressionAllCorrect, (val) => { if (val) setTimeout(() => submitExpression(), 400) })
const hintedWordObjects = computed(() => { if (!currentExpression.value) return []; const words = parseAnswerToWords(currentExpression.value.answer); return expressionHintWords.value.map(i => words[i]).filter(Boolean) })
function getSlotDisplay(slot) { return slot.display }
function focusExpressionSlots() { const input = hiddenExpressionInput.value; if (input) { input.value = ' '; input.focus() } }
function setExpressionCursor(wi, si) { expressionCursor.value = { wordIndex: wi, letterIndex: si }; focusExpressionSlots() }
function handleHiddenExpressionInput(e) {
  if (expressionSubmitted.value) return; const input = e.target; const val = input.value
  if (val.length > 1) { const char = val.charAt(val.length - 1); if (char === ' ') { const cursor = expressionCursor.value; const slots = expressionLetterSlots.value.words; const nextWord = cursor.wordIndex + 1; if (nextWord < slots.length) { const firstLetter = slots[nextWord].slots.findIndex(s => s.status !== 'auto'); if (firstLetter >= 0) expressionCursor.value = { wordIndex: nextWord, letterIndex: firstLetter } } } else if (/^[a-zA-Z]$/.test(char)) { const cursor = expressionCursor.value; const slot = expressionLetterSlots.value.words[cursor.wordIndex]?.slots[cursor.letterIndex]; if (slot && slot.status !== 'auto') { expressionUserInput.value[slot.key] = char.toLowerCase(); const next = findNextSlot(cursor.wordIndex, cursor.letterIndex); if (next) expressionCursor.value = next } } }
  else if (val.length === 0) { const cursor = expressionCursor.value; const slot = expressionLetterSlots.value.words[cursor.wordIndex]?.slots[cursor.letterIndex]; if (slot && slot.status !== 'auto' && slot.status !== 'pending') { delete expressionUserInput.value[slot.key] } else { const prev = findPrevSlot(cursor.wordIndex, cursor.letterIndex); if (prev) { expressionCursor.value = prev; delete expressionUserInput.value[expressionLetterSlots.value.words[prev.wordIndex].slots[prev.letterIndex].key] } } }
  input.value = ' '
}
function findNextSlot(wi, si) { const slots = expressionLetterSlots.value.words; for (let j = si + 1; j < slots[wi].slots.length; j++) { if (slots[wi].slots[j].status !== 'auto') return { wordIndex: wi, letterIndex: j } } for (let i = wi + 1; i < slots.length; i++) { for (let j = 0; j < slots[i].slots.length; j++) { if (slots[i].slots[j].status !== 'auto') return { wordIndex: i, letterIndex: j } } } return null }
function findPrevSlot(wi, si) { const slots = expressionLetterSlots.value.words; for (let j = si - 1; j >= 0; j--) { if (slots[wi].slots[j].status !== 'auto') return { wordIndex: wi, letterIndex: j } } for (let i = wi - 1; i >= 0; i--) { for (let j = slots[i].slots.length - 1; j >= 0; j--) { if (slots[i].slots[j].status !== 'auto') return { wordIndex: i, letterIndex: j } } } return null }
function handleExpressionKeydown(e) { if (expressionSubmitted.value) return; if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const cursor = expressionCursor.value; if (e.key === 'ArrowLeft') { const prev = findPrevSlot(cursor.wordIndex, cursor.letterIndex); if (prev) expressionCursor.value = prev } else { const next = findNextSlot(cursor.wordIndex, cursor.letterIndex); if (next) expressionCursor.value = next } } }
function initExpressionMode() { const shuffled = [...expressionBank].sort(() => Math.random() - 0.5); expressionTasks.value = shuffled.slice(0, expressionRoundSize); expressionIndex.value = 0; expressionUserInput.value = {}; expressionSubmitted.value = false; expressionFeedback.value = ''; expressionStats.value = { completed: 0, total: expressionRoundSize }; expressionHintWords.value = []; expressionCursor.value = { wordIndex: 0, letterIndex: 0 }; expressionSlowMode.value = false; selectedRate.value = 1.0; nextTick(() => focusExpressionSlots()) }
function toggleExpressionRate() { expressionSlowMode.value = !expressionSlowMode.value; selectedRate.value = expressionSlowMode.value ? 0.75 : 1.0 }
function showExpressionHint() { if (expressionSubmitted.value || !currentExpression.value) return; const words = parseAnswerToWords(currentExpression.value.answer); const hintedSet = new Set(expressionHintWords.value); const unhintedIndices = words.map((_, i) => i).filter(i => !hintedSet.has(i)); if (unhintedIndices.length === 0) return; const randomIdx = unhintedIndices[Math.floor(Math.random() * unhintedIndices.length)]; expressionHintWords.value = [...expressionHintWords.value, randomIdx] }
function clearExpressionHints() { expressionHintWords.value = [] }
function submitExpression() { if (expressionSubmitted.value || !currentExpression.value) return; const slots = expressionLetterSlots.value.words; const words = slots.map(word => word.slots.map(s => s.display).join('')); const answer = words.join(' '); if (!answer.trim()) return; submittedAnswer.value = answer; expressionSubmitted.value = true; const task = currentExpression.value; const keywordsFound = task.keywords.filter(kw => answer.toLowerCase().includes(kw.toLowerCase())); const score = keywordsFound.length / task.keywords.length; let feedback = ''; if (score >= 0.8) { feedback = `🌟 很好！\n参考表达：${task.answer}`; playChoiceSound(true) } else if (score >= 0.5) { feedback = `👍 不错！使用了 ${keywordsFound.length}/${task.keywords.length} 个核心词。\n参考表达：${task.answer}`; playChoiceSound(true) } else { feedback = `💡 试试这样表达：${task.answer}`; playChoiceSound(false) }; expressionFeedback.value = feedback; expressionStats.value.completed++; saveAllProgress(); setTimeout(() => { if (expressionIndex.value + 1 >= expressionTasks.value.length) { expressionIndex.value++; saveAllProgress(); setTimeout(() => playFinishSound(), 100) } else { expressionIndex.value++; expressionUserInput.value = {}; expressionSubmitted.value = false; expressionFeedback.value = ''; expressionHintWords.value = []; expressionCursor.value = { wordIndex: 0, letterIndex: 0 }; expressionSlowMode.value = false; selectedRate.value = 1.0; nextTick(() => focusExpressionSlots()) } }, 2500) }
function restartExpression() { initExpressionMode() }

function saveAllProgress() { localStorage.setItem('ogden850-practice-queue', JSON.stringify(queue.value)); localStorage.setItem('ogden850-practice-idx', currentIndex.value); localStorage.setItem('ogden850-practice-stats', JSON.stringify(stats.value)); localStorage.setItem('ogden850-choice-queue', JSON.stringify(choiceQueue.value)); localStorage.setItem('ogden850-choice-idx', choiceIndex.value); localStorage.setItem('ogden850-choice-stats', JSON.stringify(choiceStats.value)); localStorage.setItem('ogden850-spelling-queue', JSON.stringify(spellingQueue.value)); localStorage.setItem('ogden850-spelling-idx', spellingIndex.value); localStorage.setItem('ogden850-spelling-stats', JSON.stringify(spellingStats.value)); localStorage.setItem('ogden850-spelling-hints', JSON.stringify(spellingHintLetters.value)) }
function loadAllProgress() { try { const sq = localStorage.getItem('ogden850-practice-queue'); if (sq) queue.value = JSON.parse(sq); const si = localStorage.getItem('ogden850-practice-idx'); if (si) currentIndex.value = parseInt(si); const ss = localStorage.getItem('ogden850-practice-stats'); if (ss) stats.value = JSON.parse(ss); const cq = localStorage.getItem('ogden850-choice-queue'); if (cq) choiceQueue.value = JSON.parse(cq); const ci = localStorage.getItem('ogden850-choice-idx'); if (ci) choiceIndex.value = parseInt(ci); const cs = localStorage.getItem('ogden850-choice-stats'); if (cs) choiceStats.value = JSON.parse(cs); if (choiceQueue.value.length > 0 && choiceIndex.value < choiceQueue.value.length) choiceOptions.value = generateOptions(choiceQueue.value[choiceIndex.value]); const pq = localStorage.getItem('ogden850-spelling-queue'); if (pq) spellingQueue.value = JSON.parse(pq); const pi = localStorage.getItem('ogden850-spelling-idx'); if (pi) spellingIndex.value = parseInt(pi); const ps = localStorage.getItem('ogden850-spelling-stats'); if (ps) spellingStats.value = JSON.parse(ps); const sh = localStorage.getItem('ogden850-spelling-hints'); if (sh) spellingHintLetters.value = JSON.parse(sh); if (currentIndex.value >= queue.value.length) currentIndex.value = 0; if (choiceIndex.value >= choiceQueue.value.length) choiceIndex.value = 0; if (spellingIndex.value >= spellingQueue.value.length) spellingIndex.value = 0 } catch { /* */ } }

function handleKeydown(e) {
  if ((e.key === 's' || e.key === 'S') && document.activeElement?.tagName !== 'INPUT' && document.activeElement !== hiddenSpellingInput.value && document.activeElement !== hiddenExpressionInput.value) { e.preventDefault(); speak(); return }
  if (mode.value === 'expression') { if (expressionFinished.value) { if (e.key === 'r' || e.key === 'R') restartExpression(); return }; return }
  if (mode.value === 'spelling') { if (spellingFinished.value) { if (e.key === 'r' || e.key === 'R') restartSpelling(); return }; if (!isSpellingSubmitted.value) { if (e.key === 'Tab') { e.preventDefault(); showSpellingHint() } }; return }
  if (mode.value === 'flashcard') { if (flashcardFinished.value) { if (e.key === 'r' || e.key === 'R') restartFlashcard(); return }; if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); toggleFlip(); return }; if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { e.preventDefault(); prevCard(); playNavSound(); return }; if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { e.preventDefault(); nextCard(); playNavSound(); return }; if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFavFlashcard(); return }; if (isFlipped.value) { if (e.key === '1') { e.preventDefault(); applyGrade('again'); return }; if (e.key === '2') { e.preventDefault(); applyGrade('hard'); return }; if (e.key === '3') { e.preventDefault(); applyGrade('good'); return }; if (e.key === '4') { e.preventDefault(); applyGrade('easy'); return } }; return }
  if (mode.value === 'choice') { if (choiceFinished.value) { if (e.key === 'r' || e.key === 'R') restartChoice(); return }; if (!isAnswered.value) { if (e.key === '1') { e.preventDefault(); highlightChoice(0) } else if (e.key === '2') { e.preventDefault(); highlightChoice(1) } else if (e.key === '3') { e.preventDefault(); highlightChoice(2) } else if (e.key === '4') { e.preventDefault(); highlightChoice(3) } else if (e.key === 'Enter') { e.preventDefault(); confirmChoice() } else if (e.key === 'Escape') { e.preventDefault(); cancelChoice() } }; return }
}
function switchMode(newMode) { mode.value = newMode; if (newMode === 'choice' && choiceQueue.value.length === 0) initChoiceMode(); if (newMode === 'spelling' && spellingQueue.value.length === 0) initSpellingMode(); if (newMode === 'expression' && expressionTasks.value.length === 0) initExpressionMode() }

onMounted(async () => { await store.loadProgress(); loadAllProgress(); initVoices(); window.addEventListener('keydown', handleKeydown); if (queue.value.length > 0 && !isOffline.value) loadImageForCurrent(); if (queryMode) { if (queryMode === 'choice' && choiceQueue.value.length === 0) initChoiceMode(); if (queryMode === 'spelling' && spellingQueue.value.length === 0) initSpellingMode(); if (queryMode === 'expression' && expressionTasks.value.length === 0) initExpressionMode() } })
onUnmounted(() => { window.removeEventListener('keydown', handleKeydown); clearAllTimers(); window.speechSynthesis.cancel() })
</script>

<template>
  <div class="w-full max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
    <div class="flex justify-center items-center gap-1.5 sm:gap-2 mb-5 sm:mb-8 flex-wrap">
      <button @click="switchMode('flashcard')" class="px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer" :style="mode === 'flashcard' ? { backgroundColor: 'var(--accent)', color: '#1A1A2E' } : { backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }">🃏 闪卡</button>
      <button @click="switchMode('choice')" class="px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer" :style="mode === 'choice' ? { backgroundColor: 'var(--accent)', color: '#1A1A2E' } : { backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }">📝 选择</button>
      <button @click="switchMode('spelling')" class="px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer" :style="mode === 'spelling' ? { backgroundColor: 'var(--accent)', color: '#1A1A2E' } : { backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }">⌨️ 拼写</button>
      <button @click="switchMode('expression')" class="px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer" :style="mode === 'expression' ? { backgroundColor: 'var(--accent)', color: '#1A1A2E' } : { backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }">💬 表达</button>
    </div>

    <!-- ==================== 闪卡 ==================== -->
    <template v-if="mode === 'flashcard'">
      <div class="mb-4 sm:mb-6"><div class="flex justify-between text-xs font-medium mb-2" :style="{ color: 'var(--text-muted)' }"><span>📖 学习进度</span><span>第 {{ currentIndex + 1 }} / {{ queue.length }} 张</span></div><div class="h-1 rounded-full" :style="{ backgroundColor: 'var(--bg-secondary)' }"><div class="h-full rounded-full transition-all duration-300" :style="{ width: flashcardProgressPercent + '%', backgroundColor: 'var(--success)' }"></div></div></div>
      <template v-if="!flashcardFinished && currentCard">
        <div class="mb-4 sm:mb-6 cursor-pointer" style="perspective: 1400px;" @click="toggleFlip"><div class="relative w-full transition-transform duration-500" style="transform-style: preserve-3d; min-height: 450px;" :style="{ transform: isFlipped ? 'rotateY(180deg)' : '' }">
          <div class="absolute inset-0 rounded-3xl p-6 sm:p-8 flex flex-col justify-between" style="backface-visibility: hidden;" :style="{ backgroundColor: 'var(--bg)', boxShadow: '0 10px 25px -10px rgba(0,0,0,0.08), 0 0 0 1px var(--border)' }">
            <div class="flex-1 flex flex-col justify-center items-center">
              <div class="flex items-center justify-center gap-2">
                <p class="text-5xl sm:text-6xl font-bold word-display" :style="{ color: 'var(--text)' }">{{ currentCard.word }}</p>
                <button @click.stop="speakFlashcardWord" class="text-2xl sm:text-3xl cursor-pointer transition-all hover:scale-110" :style="{ color: 'var(--accent)' }" title="单词发音">🔊</button>
              </div>
              <span class="text-xs sm:text-sm px-3 sm:px-4 py-1 rounded-full mt-2" :style="{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }">{{ currentCard.phonetic }}</span><div class="mt-4 sm:mt-6 rounded-2xl flex items-center justify-center overflow-hidden w-full" :style="{ backgroundColor: 'var(--bg-secondary)', minHeight: '200px' }"><img v-if="currentImageUrl" :src="currentImageUrl" class="w-full max-h-48 object-cover" alt="illustration" /><div v-else class="text-xs sm:text-sm py-8 flex flex-col items-center justify-center" :style="{ color: 'var(--text-muted)' }"><span v-if="imageLoading && !isOffline" class="animate-pulse">🎨 加载中...</span><span v-else>🖼️ 暂无图片</span></div></div></div><p class="text-xs text-center mt-3" :style="{ color: 'var(--text-muted)' }">⤴️ 点击/空格翻面</p></div>
          <div class="absolute inset-0 rounded-3xl p-5 sm:p-8 flex flex-col justify-between overflow-y-auto" style="backface-visibility: hidden; transform: rotateY(180deg);" :style="{ backgroundColor: 'var(--bg)', boxShadow: '0 10px 25px -10px rgba(0,0,0,0.08), 0 0 0 1px var(--border)' }"><div class="flex-1">
            <div class="mb-3 sm:mb-4 pb-2 sm:pb-3 border-b flex items-center justify-between" :style="{ borderColor: 'var(--border)' }">
              <div><p class="text-[10px] sm:text-xs uppercase font-semibold" :style="{ color: 'var(--accent)' }">📖 单词</p><p class="text-lg sm:text-xl font-bold mt-1" :style="{ color: 'var(--text)' }">{{ currentCard.word }}<span class="mx-3 sm:mx-4 opacity-30" :style="{ color: 'var(--text-muted)' }">|</span><span class="text-base sm:text-lg font-medium" :style="{ color: 'var(--accent)' }">{{ currentCard.chinese }}</span></p></div>
              <button @click.stop="speakFlashcardWord" class="text-xl cursor-pointer transition-all hover:scale-110 flex-shrink-0 ml-2" :style="{ color: 'var(--accent)' }" title="单词发音">🔊</button>
            </div>
            <div class="mb-3 sm:mb-4 pb-2 sm:pb-3 border-b" :style="{ borderColor: 'var(--border)' }"><p class="text-[10px] sm:text-xs uppercase font-semibold" :style="{ color: 'var(--accent)' }">🗣️ 音标</p><p class="text-base sm:text-lg mt-1" :style="{ color: 'var(--text-muted)' }">{{ currentCard.phonetic }}</p></div>
            <div v-if="currentCard.examples?.[0]" class="mb-3 sm:mb-4"><p class="text-[10px] sm:text-xs uppercase font-semibold" :style="{ color: 'var(--accent)' }">📝 例句</p><div class="mt-2 p-2.5 sm:p-3 rounded-2xl" :style="{ backgroundColor: 'var(--bg-secondary)' }"><div class="flex items-start justify-between gap-2"><p class="text-sm sm:text-base leading-relaxed mb-1" :style="{ color: 'var(--text)' }"><template v-for="(token, ti) in splitExampleTokens(currentCard.examples[0].en)" :key="ti"><span :class="isOodWord(token.word) ? 'border-b-2 border-dotted border-red-400 text-red-600 cursor-help' : ''" :title="isOodWord(token.word) ? '⚠️ 超纲词' : ''">{{ token.word }}</span>{{ token.space }}</template></p><button @click.stop="speakFlashcardExample" class="text-lg cursor-pointer transition-all hover:scale-110 flex-shrink-0 mt-0.5" :style="{ color: 'var(--accent)' }" title="例句发音">🔊</button></div><p class="text-xs sm:text-sm" :style="{ color: 'var(--accent)' }">{{ currentCard.examples[0].zh }}</p></div></div>
          </div>
            <div class="flex gap-2 sm:gap-3 mt-3 sm:mt-4">
              <button @click.stop="applyGrade('again')" class="flex-1 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold cursor-pointer active:scale-95" :style="{ backgroundColor: '#fdeaec', color: '#b13e3e' }" title="完全忘记（1）">🔄 Again</button>
              <button @click.stop="applyGrade('hard')" class="flex-1 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold cursor-pointer active:scale-95" :style="{ backgroundColor: '#fff0e0', color: '#c96f0e' }" title="想起困难（2）">⚠️ Hard</button>
              <button @click.stop="applyGrade('good')" class="flex-1 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold cursor-pointer active:scale-95" :style="{ backgroundColor: '#e3f3e0', color: '#2b7551' }" title="正常想起（3）">✔️ Good</button>
              <button @click.stop="applyGrade('easy')" class="flex-1 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold cursor-pointer active:scale-95" :style="{ backgroundColor: '#e0f2ef', color: '#1f7a64' }" title="太简单了（4）">⚡ Easy</button>
            </div>
          </div>
        </div></div>
        <div class="flex justify-center items-center gap-2 sm:gap-3 mb-3 sm:mb-4 flex-wrap">
          <button @click="prevCard" class="px-3 py-1.5 rounded-full text-sm cursor-pointer transition-all hover:opacity-80" :style="{ color: 'var(--text-secondary)' }" title="上一张 (←)">←</button>
          <button @click="toggleAccent" class="px-2 py-1.5 rounded-full text-xs font-medium cursor-pointer border transition-all hover:opacity-80" :style="selectedAccent === 'us' ? { backgroundColor: 'var(--accent)', borderColor: 'var(--accent)', color: '#1A1A2E' } : { backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text)' }">{{ selectedAccent === 'us' ? '🇺🇸' : '🇬🇧' }}</button>
          <button @click="toggleGender" class="px-2 py-1.5 rounded-full text-xs font-medium cursor-pointer border transition-all hover:opacity-80" :style="selectedGender === 'female' ? { backgroundColor: 'var(--accent)', borderColor: 'var(--accent)', color: '#1A1A2E' } : { backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text)' }">{{ selectedGender === 'female' ? '👩' : '👨' }}</button>
          <button @click="flashcardSlowMode = !flashcardSlowMode; selectedRate = flashcardSlowMode ? 0.75 : 1.0" class="px-2 py-1.5 rounded-full text-xs font-medium cursor-pointer border transition-all hover:opacity-80" :style="flashcardSlowMode ? { backgroundColor: 'var(--accent)', borderColor: 'var(--accent)', color: '#1A1A2E' } : { backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text)' }">{{ flashcardSlowMode ? '🐢 0.75x' : '🚶 1x' }}</button>
          <button @click.stop="speak" class="px-3 py-1.5 rounded-full text-sm cursor-pointer" :style="{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text)' }" title="朗读 (S)">🔊</button>
          <button @click.stop="toggleFavFlashcard" class="px-3 py-1.5 rounded-full text-sm cursor-pointer" :style="{ backgroundColor: 'var(--bg-secondary)', color: isFavFlashcard ? '#f59e0b' : 'var(--text)' }" :title="isFavFlashcard ? '取消收藏' : '添加收藏'">{{ isFavFlashcard ? '⭐' : '☆' }}</button>
          <button @click="nextCard" class="px-3 py-1.5 rounded-full text-sm cursor-pointer transition-all hover:opacity-80" :style="{ color: 'var(--text-secondary)' }" title="下一张 (→)">→</button>
        </div>
        <div class="flex justify-center gap-1.5 sm:gap-3 flex-wrap text-[10px] sm:text-xs" :style="{ color: 'var(--text-muted)' }"><span class="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full" :style="{ backgroundColor: 'var(--bg-secondary)' }">🔄 {{ stats.again }}</span><span class="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full" :style="{ backgroundColor: 'var(--bg-secondary)' }">⚠️ {{ stats.hard }}</span><span class="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full" :style="{ backgroundColor: 'var(--bg-secondary)' }">✔️ {{ stats.good }}</span><span class="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full" :style="{ backgroundColor: 'var(--bg-secondary)' }">⚡ {{ stats.easy }}</span><span class="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full" :style="{ backgroundColor: 'var(--bg-secondary)' }">📦 {{ queue.length }}</span></div>
      </template>
      <template v-if="flashcardFinished"><div class="text-center py-16 sm:py-20"><p class="text-4xl sm:text-5xl mb-4">🎉</p><p class="text-2xl sm:text-3xl font-bold mb-2" :style="{ color: 'var(--text)' }">今日单词已复习完毕</p><div class="flex justify-center gap-2 sm:gap-3 flex-wrap mb-6 sm:mb-8 text-xs sm:text-sm" :style="{ color: 'var(--text-muted)' }"><span class="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full" :style="{ backgroundColor: 'var(--bg-secondary)' }">🔄 {{ stats.again }}</span><span class="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full" :style="{ backgroundColor: 'var(--bg-secondary)' }">⚠️ {{ stats.hard }}</span><span class="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full" :style="{ backgroundColor: 'var(--bg-secondary)' }">✔️ {{ stats.good }}</span><span class="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full" :style="{ backgroundColor: 'var(--bg-secondary)' }">⚡ {{ stats.easy }}</span></div><button @click="restartFlashcard" class="px-6 sm:px-8 py-2.5 sm:py-3 text-base sm:text-lg rounded-2xl font-semibold" :style="{ backgroundColor: 'var(--accent)', color: '#1A1A2E' }">开始新一轮 · R</button></div></template>
    </template>

    <!-- ==================== 选择 ==================== -->
    <template v-if="mode === 'choice'">
      <div class="mb-4 sm:mb-6"><div class="flex justify-between text-xs font-medium mb-2" :style="{ color: 'var(--text-muted)' }"><span>📝 第 {{ choiceIndex + 1 > choiceQueue.length ? choiceQueue.length : choiceIndex + 1 }} / {{ choiceQueue.length }} 题</span><span>✅ {{ choiceStats.correct }} ❌ {{ choiceStats.wrong }}</span></div><div class="h-1 rounded-full" :style="{ backgroundColor: 'var(--bg-secondary)' }"><div class="h-full rounded-full transition-all duration-300" :style="{ width: choiceProgressPercent + '%', backgroundColor: 'var(--accent)' }"></div></div></div>
      <template v-if="!choiceFinished && currentChoice"><div class="rounded-2xl sm:rounded-3xl p-5 sm:p-8 mb-3 sm:mb-4 text-center" :style="{ backgroundColor: 'var(--bg)', boxShadow: '0 10px 25px -10px rgba(0,0,0,0.08)' }"><p class="text-xs sm:text-sm mb-1.5" :style="{ color: 'var(--text-muted)' }">以下单词的中文意思是？</p><div class="flex items-center justify-center gap-2"><p class="text-4xl sm:text-5xl font-bold word-display" :style="{ color: 'var(--text)' }">{{ currentChoice.word }}</p><button @click.stop="speak" class="text-2xl cursor-pointer transition-all hover:scale-110" :style="{ color: 'var(--accent)' }" title="发音 (S)">🔊</button></div><p class="text-base sm:text-lg mt-1.5" :style="{ color: 'var(--text-muted)' }">{{ currentChoice.phonetic }}</p></div>
        <p v-if="!isAnswered" class="text-center text-xs mb-3 text-gray-400"><span class="hidden sm:inline">键盘：<kbd>1-4</kbd> 选择 · <kbd>Enter</kbd> 确认 &nbsp;|&nbsp; </span>直接点击选项提交</p>
        <div v-if="choiceOptions && choiceOptions.length" class="grid grid-cols-1 gap-2.5 sm:gap-3 w-full">
          <button v-for="(option, i) in choiceOptions" :key="i" @click="selectChoice(i)" class="w-full text-left px-4 sm:px-6 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl text-base sm:text-lg font-medium transition-all cursor-pointer active:scale-[0.98]" :class="{ 'cursor-default': isAnswered }" :style="isAnswered ? (option.correct ? { backgroundColor: '#e3f3e0', color: '#2b7551', border: '2px solid #5fad56' } : (confirmedOption === i ? { backgroundColor: '#fdeaec', color: '#b13e3e', border: '2px solid #dc6b4a' } : { backgroundColor: 'var(--bg-secondary, #f3f4f6)', color: 'var(--text-muted, #9ca3af)', opacity: '0.5' })) : (highlightedOption === i ? { backgroundColor: 'var(--bg-secondary, #f3f4f6)', color: 'var(--text, #1f2937)', border: '2px solid var(--accent, #3b82f6)', boxShadow: '0 0 0 2px var(--accent, #3b82f6)' } : { backgroundColor: 'var(--bg, #ffffff)', color: 'var(--text, #1f2937)', border: '2px solid var(--border, #e5e7eb)' })">
            <span class="inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full text-xs sm:text-sm text-center mr-2 sm:mr-3 font-bold" :style="isAnswered && option.correct ? { backgroundColor: '#5fad56', color: '#fff' } : (isAnswered && confirmedOption === i ? { backgroundColor: '#dc6b4a', color: '#fff' } : (highlightedOption === i ? { backgroundColor: 'var(--accent, #3b82f6)', color: '#1A1A2E' } : { backgroundColor: 'var(--bg-secondary, #f3f4f6)', color: 'var(--text-muted, #9ca3af)' }))">{{ i + 1 }}</span>{{ option.text }}
          </button>
        </div>
        <div class="flex justify-center mt-4 sm:mt-5 gap-2 sm:gap-2.5 items-center">
          <button @click="choiceSlowMode = !choiceSlowMode; selectedRate = choiceSlowMode ? 0.75 : 1.0" class="px-2 py-1.5 rounded-full text-xs font-medium cursor-pointer border transition-all hover:opacity-80" :style="choiceSlowMode ? { backgroundColor: 'var(--accent)', borderColor: 'var(--accent)', color: '#1A1A2E' } : { backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text)' }">{{ choiceSlowMode ? '🐢 0.75x' : '🚶 1x' }}</button>
          <button @click="speak" class="px-3 py-1.5 rounded-full text-xs cursor-pointer" :style="{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text)' }" title="朗读 (S)">🔊</button>
          <button @click.stop="toggleFavChoice" class="px-3 py-1.5 rounded-full text-xs cursor-pointer" :style="{ backgroundColor: 'var(--bg-secondary)', color: isFavChoice ? '#f59e0b' : 'var(--text)' }" :title="isFavChoice ? '取消收藏' : '添加收藏'">{{ isFavChoice ? '⭐' : '☆' }}</button>
        </div>
      </template>
      <template v-if="choiceFinished"><div class="text-center py-16 sm:py-20"><p class="text-4xl sm:text-5xl mb-4">🎉</p><p class="text-2xl sm:text-3xl font-bold mb-4" :style="{ color: 'var(--text)' }">答题结束</p><p class="text-lg sm:text-xl mb-2" :style="{ color: 'var(--success)' }">✅ {{ choiceStats.correct }} 题</p><p class="text-lg sm:text-xl mb-6 sm:mb-8" :style="{ color: 'var(--danger)' }">❌ {{ choiceStats.wrong }} 题</p><button @click="restartChoice" class="px-6 sm:px-8 py-2.5 sm:py-3 text-base sm:text-lg rounded-2xl font-semibold" :style="{ backgroundColor: 'var(--accent)', color: '#1A1A2E' }">再来一轮 · R</button></div></template>
    </template>

    <!-- ==================== 拼写 ==================== -->
    <template v-if="mode === 'spelling'">
      <div class="mb-4 sm:mb-6"><div class="flex justify-between text-xs font-medium mb-2" :style="{ color: 'var(--text-muted)' }"><span>⌨️ 第 {{ spellingIndex + 1 > spellingQueue.length ? spellingQueue.length : spellingIndex + 1 }} / {{ spellingQueue.length }} 题</span><span>✅ {{ spellingStats.correct }} ❌ {{ spellingStats.wrong }} 💡 {{ spellingStats.hints }}</span></div><div class="h-1 rounded-full" :style="{ backgroundColor: 'var(--bg-secondary)' }"><div class="h-full rounded-full transition-all duration-300" :style="{ width: spellingProgressPercent + '%', backgroundColor: 'var(--accent)' }"></div></div></div>
      <template v-if="!spellingFinished && currentSpelling">
        <div class="rounded-2xl sm:rounded-3xl p-5 sm:p-8 mb-3 sm:mb-4 text-center" :style="{ backgroundColor: 'var(--bg)', boxShadow: '0 10px 25px -10px rgba(0,0,0,0.08)' }"><p class="text-xs sm:text-sm mb-1.5" :style="{ color: 'var(--text-muted)' }">请拼写以下中文对应的英文单词</p><div class="flex items-center justify-center gap-2 mb-1.5"><p class="text-3xl sm:text-4xl font-bold word-display" :style="{ color: 'var(--text)' }">{{ currentSpelling.chinese }}</p><button @click.stop="speak" class="text-2xl cursor-pointer transition-all hover:scale-110" :style="{ color: 'var(--accent)' }" title="发音 (S)">🔊</button></div><p v-if="!hidePhonetic" class="text-base sm:text-lg" :style="{ color: 'var(--text-muted)' }">{{ currentSpelling.phonetic }}</p><button v-if="hidePhonetic && !isSpellingSubmitted" @click="hidePhonetic = false" class="text-xs underline cursor-pointer" :style="{ color: 'var(--text-muted)' }">👁️ 显示音标</button></div>
        <div v-if="!isSpellingSubmitted" class="mb-3 relative">
          <input ref="hiddenSpellingInput" type="text" class="absolute" style="opacity: 0; width: 1px; height: 1px; top: 50%; left: 50%; z-index: -1; pointer-events: none;" autocorrect="off" autocapitalize="none" autocomplete="off" spellcheck="false" @input="handleHiddenSpellingInput" @keydown="handleSpellingKeydown" />
          <div class="flex justify-center gap-1.5 sm:gap-2 outline-none p-3 rounded-xl cursor-pointer" :style="{ backgroundColor: 'var(--bg-secondary)' }" @click="focusSpellingSlots">
            <span v-for="(slot, si) in spellingLetterSlots" :key="si" class="inline-flex items-center justify-center w-9 h-11 sm:w-10 sm:h-12 rounded-lg text-xl sm:text-2xl font-bold font-mono transition-all select-none" :class="{ 'ring-2 ring-[var(--accent)]': !isSpellingSubmitted && spellingCursor === si }" :style="slot.status === 'filled' ? { backgroundColor: '#e3f3e0', color: '#2b7551', border: '2px solid #5fad56' } : slot.status === 'wrong' ? { backgroundColor: '#fdeaec', color: '#b13e3e', border: '2px solid #dc6b4a' } : slot.status === 'hinted' ? { backgroundColor: '#fff8e0', color: '#c96f0e', border: '2px dashed #c96f0e' } : { backgroundColor: 'var(--bg)', color: 'var(--text-muted)', border: '2px dashed var(--border)' }" @click.stop="setSpellingCursor(si)">{{ slot.display }}</span>
          </div>
          <p class="text-center text-[10px] mt-1.5 opacity-50" :style="{ color: 'var(--text-muted)' }">点击上方区域开始输入 · 支持手机键盘 · 全部正确自动提交</p>
        </div>
        <div v-if="isSpellingSubmitted" class="text-center py-4"><p v-if="isSpellingCorrect" class="text-xl sm:text-2xl font-bold" :style="{ color: 'var(--success)' }">✅ 正确！</p><div v-else><p class="text-xl sm:text-2xl font-bold mb-2" :style="{ color: 'var(--danger)' }">❌ 错误</p><p class="text-base sm:text-lg">正确答案：<span :style="{ color: 'var(--success)' }">{{ currentSpelling.word }}</span></p></div></div>
        <p class="text-center text-xs mt-2 mb-2 opacity-60" :style="{ color: 'var(--text)' }"><kbd>Tab</kbd> 提示 · <kbd>S</kbd> 发音 · <kbd>←→</kbd> 移动</p>
        <div class="flex justify-center mt-2 sm:mt-3 gap-2 sm:gap-3 items-center flex-wrap">
          <button v-if="!isSpellingSubmitted" @click="hidePhonetic = !hidePhonetic" class="px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all hover:opacity-80" :style="{ backgroundColor: hidePhonetic ? 'var(--accent)' : 'var(--bg-secondary)', color: hidePhonetic ? '#1A1A2E' : 'var(--text)' }">{{ hidePhonetic ? '👁️ 音标' : '🙈 音标' }}</button>
          <button @click="spellingSlowMode = !spellingSlowMode; selectedRate = spellingSlowMode ? 0.75 : 1.0" class="px-2 py-1.5 rounded-full text-xs font-medium cursor-pointer border transition-all hover:opacity-80" :style="spellingSlowMode ? { backgroundColor: 'var(--accent)', borderColor: 'var(--accent)', color: '#1A1A2E' } : { backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text)' }">{{ spellingSlowMode ? '🐢 0.75x' : '🚶 1x' }}</button>
          <button v-if="!isSpellingSubmitted" @click="showSpellingHint" class="px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all hover:opacity-80" :style="{ backgroundColor: '#fff0e0', color: '#c96f0e' }" title="提示随机字母 (Tab)">💡 提示</button>
          <button v-if="!isSpellingSubmitted && spellingHintLetters.length > 0" @click="clearSpellingHints" class="px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all hover:opacity-80" :style="{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }" title="清除所有提示">🗑️ 清空</button>
          <button @click="speak" class="px-2.5 py-1.5 rounded-full text-lg cursor-pointer transition-all hover:opacity-80" :style="{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text)' }" title="朗读 (S)">🔊</button>
          <button @click.stop="toggleFavSpelling" class="px-3 py-1.5 rounded-full text-xs cursor-pointer" :style="{ backgroundColor: 'var(--bg-secondary)', color: isFavSpelling ? '#f59e0b' : 'var(--text)' }" :title="isFavSpelling ? '取消收藏' : '添加收藏'">{{ isFavSpelling ? '⭐' : '☆' }}</button>
        </div>
      </template>
      <template v-if="spellingFinished"><div class="text-center py-16 sm:py-20"><p class="text-4xl sm:text-5xl mb-4">🎉</p><p class="text-2xl sm:text-3xl font-bold mb-4" :style="{ color: 'var(--text)' }">拼写完成</p><p class="text-lg sm:text-xl mb-2" :style="{ color: 'var(--success)' }">✅ {{ spellingStats.correct }} 题</p><p class="text-lg sm:text-xl mb-2" :style="{ color: 'var(--danger)' }">❌ {{ spellingStats.wrong }} 题</p><p class="text-lg sm:text-xl mb-6 sm:mb-8" :style="{ color: 'var(--text-muted)' }">💡 提示 {{ spellingStats.hints }} 次</p><button @click="restartSpelling" class="px-6 sm:px-8 py-2.5 sm:py-3 text-base sm:text-lg rounded-2xl font-semibold" :style="{ backgroundColor: 'var(--accent)', color: '#1A1A2E' }">再来一轮 · R</button></div></template>
    </template>

    <!-- ==================== 表达 ==================== -->
    <template v-if="mode === 'expression'">
      <div class="mb-4 sm:mb-6"><div class="flex justify-between text-xs font-medium mb-2" :style="{ color: 'var(--text-muted)' }"><span>💬 第 {{ expressionIndex + 1 > expressionTasks.length ? expressionTasks.length : expressionIndex + 1 }} / {{ expressionTasks.length }} 题</span><span>✅ {{ expressionStats.completed }}/{{ expressionStats.total }}</span></div><div class="h-1 rounded-full" :style="{ backgroundColor: 'var(--bg-secondary)' }"><div class="h-full rounded-full transition-all duration-300" :style="{ width: expressionProgressPercent + '%', backgroundColor: 'var(--accent)' }"></div></div></div>
      <template v-if="!expressionFinished && currentExpression">
        <div class="rounded-2xl sm:rounded-3xl p-5 sm:p-8 mb-3 sm:mb-4 text-center" :style="{ backgroundColor: 'var(--bg)', boxShadow: '0 10px 25px -10px rgba(0,0,0,0.08)' }"><p class="text-xs sm:text-sm mb-1.5 sm:mb-2" :style="{ color: 'var(--text-muted)' }">用 Ogden 850 基础词汇表达以下意思：</p><div class="flex items-center justify-center gap-2"><p class="text-2xl sm:text-3xl font-bold" :style="{ color: 'var(--text)' }">{{ currentExpression.zh }}</p><button @click.stop="speak" class="text-2xl cursor-pointer transition-all hover:scale-110" :style="{ color: 'var(--accent)' }" title="发音 (S)">🔊</button></div></div>
        <div v-if="!expressionSubmitted" class="mb-3 relative">
          <div v-if="expressionHintWords.length > 0" class="flex flex-wrap justify-center gap-2 mb-2"><span v-for="(wordObj, i) in hintedWordObjects" :key="i" class="px-2.5 py-1 rounded-lg text-sm font-medium" :style="{ backgroundColor: '#fff0e0', color: '#c96f0e' }">{{ wordObj.text }}</span></div>
          <input ref="hiddenExpressionInput" type="text" class="absolute" style="opacity: 0; width: 1px; height: 1px; top: 50%; left: 50%; z-index: -1; pointer-events: none;" autocorrect="off" autocapitalize="none" autocomplete="off" spellcheck="false" @input="handleHiddenExpressionInput" @keydown="handleExpressionKeydown" />
          <div class="flex flex-wrap justify-center gap-x-3 sm:gap-x-4 gap-y-2 outline-none p-3 rounded-xl cursor-pointer" :style="{ backgroundColor: 'var(--bg-secondary)' }" @click="focusExpressionSlots">
            <div v-for="(word, wi) in expressionLetterSlots.words" :key="wi" class="flex gap-0.5">
              <span v-for="(slot, si) in word.slots" :key="si" class="inline-flex items-center justify-center w-7 h-9 sm:w-8 sm:h-10 rounded-md text-base sm:text-lg font-bold font-mono transition-all select-none" :class="{ 'ring-2 ring-[var(--accent)]': !expressionSubmitted && expressionCursor.wordIndex === wi && expressionCursor.letterIndex === si }" :style="slot.status === 'auto' ? { backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px dashed transparent', fontWeight: '400' } : slot.status === 'filled' ? { backgroundColor: '#e3f3e0', color: '#2b7551', border: '1px solid #5fad56' } : slot.status === 'wrong' ? { backgroundColor: '#fdeaec', color: '#b13e3e', border: '1px solid #dc6b4a' } : slot.status === 'hinted' ? { backgroundColor: '#fff8e0', color: '#c96f0e', border: '1px dashed #c96f0e' } : { backgroundColor: 'var(--bg)', color: 'var(--text-muted)', border: '1px dashed var(--border)' }" @click.stop="setExpressionCursor(wi, si)">{{ getSlotDisplay(slot) }}</span>
            </div>
          </div>
          <p class="text-center text-[10px] mt-1.5 opacity-50" :style="{ color: 'var(--text-muted)' }">点击上方区域开始输入 · 支持手机键盘 · 全部正确自动提交</p>
        </div>
        <div v-if="!expressionSubmitted" class="mt-2 sm:mt-3">
          <div class="flex justify-center gap-1.5 sm:gap-2 items-center flex-wrap">
            <button @click="toggleExpressionRate" class="px-2 py-1.5 rounded-full text-xs font-medium cursor-pointer border transition-all hover:opacity-80" :style="expressionSlowMode ? { backgroundColor: 'var(--accent)', borderColor: 'var(--accent)', color: '#1A1A2E' } : { backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text)' }">{{ expressionSlowMode ? '🐢 0.75x' : '🚶 1x' }}</button>
            <button @click="showExpressionHint" class="px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all hover:opacity-80" :style="{ backgroundColor: '#fff0e0', color: '#c96f0e' }" title="提示随机单词">💡 提示</button>
            <button v-if="expressionHintWords.length > 0" @click="clearExpressionHints" class="px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all hover:opacity-80" :style="{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }" title="清除所有提示">🗑️ 清空提示</button>
            <button @click="speak" class="px-2.5 py-1.5 rounded-full text-lg cursor-pointer transition-all hover:opacity-80" :style="{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text)' }" title="听标准表达 (S)">🔊</button>
          </div>
        </div>
        <div v-if="expressionSubmitted" class="mt-3 sm:mt-4 p-4 sm:p-6 rounded-2xl" :style="{ backgroundColor: 'var(--bg-secondary)' }"><p class="text-xs sm:text-sm mb-2" :style="{ color: 'var(--text-muted)' }">你的回答：</p><p class="text-base sm:text-lg mb-3 sm:mb-4" :style="{ color: 'var(--text)' }">{{ submittedAnswer }}</p><div class="border-t pt-3 sm:pt-4" :style="{ borderColor: 'var(--border)' }"><p class="text-sm sm:text-base font-medium mb-1" :style="{ color: 'var(--accent)' }">📝 反馈：</p><p class="text-sm sm:text-base whitespace-pre-line" :style="{ color: 'var(--text-secondary)' }">{{ expressionFeedback }}</p></div></div>
      </template>
      <template v-if="expressionFinished"><div class="text-center py-16 sm:py-20"><p class="text-4xl sm:text-5xl mb-4">🎉</p><p class="text-2xl sm:text-3xl font-bold mb-4" :style="{ color: 'var(--text)' }">表达训练完成</p><p class="text-base sm:text-lg mb-6 sm:mb-8" :style="{ color: 'var(--text-muted)' }">完成了 {{ expressionStats.total }} 道表达题</p><button @click="restartExpression" class="px-6 sm:px-8 py-2.5 sm:py-3 text-base sm:text-lg rounded-2xl font-semibold" :style="{ backgroundColor: 'var(--accent)', color: '#1A1A2E' }">再来一轮 · R</button></div></template>
    </template>

    <!-- 快捷键浮层（仅大屏） -->
    <div class="fixed bottom-4 right-4 px-4 py-2 rounded-2xl text-xs z-50 pointer-events-none hidden lg:block" :style="{ backgroundColor: 'rgba(30,30,30,0.85)', color: '#e3dccc', backdropFilter: 'blur(8px)' }">
      <p class="font-bold mb-1">⌨️ 快捷键</p>
      <p><kbd>S</kbd> 发音 <kbd>R</kbd> 重新开始</p>
      <template v-if="mode === 'flashcard'"><p><kbd>空格</kbd> 翻面 <kbd>A/D</kbd> 切换</p><p><kbd>1</kbd> Again <kbd>2</kbd> Hard <kbd>3</kbd> Good <kbd>4</kbd> Easy</p></template>
      <template v-if="mode === 'choice'"><p><kbd>1-4</kbd> 选择 <kbd>Enter</kbd> 确认 <kbd>Esc</kbd> 取消</p></template>
      <template v-if="mode === 'spelling'"><p>点击字母块输入 · <kbd>Tab</kbd> 提示 · <kbd>←→</kbd> 移动</p></template>
      <template v-if="mode === 'expression'"><p>点击字母块输入 · 全部正确自动提交</p></template>
    </div>
  </div>
</template>

<style scoped>
kbd { background: #1e1e1c; padding: 2px 6px; border-radius: 20px; margin: 0 2px; font-size: 0.6rem; }
</style>