import { ref, onUnmounted } from 'vue'

export function useSpeech(options = {}) {
  const { defaultRate = 1.0, accent = 'en-US' } = options
  const isSpeaking = ref(false)
  const speechTimeout = ref(null)
  const resumeInterval = ref(null)
  let activeUtterance = null
  let lastSpokenText = ''

  function clearAllTimers() {
    if (speechTimeout.value) clearTimeout(speechTimeout.value)
    if (resumeInterval.value) clearInterval(resumeInterval.value)
  }

  function stop() {
    clearAllTimers()
    if (window.speechSynthesis) window.speechSynthesis.cancel()
    isSpeaking.value = false
    activeUtterance = null
  }

  function speak(text, opts = {}) {
    if (!text) return
    if (isSpeaking.value && text === lastSpokenText) return
    stop()
    if (window.speechSynthesis.speaking) window.speechSynthesis.cancel()
    isSpeaking.value = true
    lastSpokenText = text
    activeUtterance = new SpeechSynthesisUtterance(text)
    activeUtterance.lang = (opts.accent || accent) === 'uk' ? 'en-GB' : 'en-US'
    activeUtterance.rate = opts.rate || defaultRate
    activeUtterance.pitch = opts.pitch ?? 1.0
    if (opts.voice) activeUtterance.voice = opts.voice
    activeUtterance.onstart = () => {
      resumeInterval.value = setInterval(() => {
        if (window.speechSynthesis.speaking) window.speechSynthesis.resume()
      }, 500)
    }
    activeUtterance.onend = () => { isSpeaking.value = false; activeUtterance = null; clearAllTimers() }
    activeUtterance.onerror = (event) => {
      isSpeaking.value = false; activeUtterance = null; clearAllTimers()
      if (event.error === 'network' || event.error === 'interrupted') {
        // trigger warm-up at caller level
      }
    }
    speechTimeout.value = setTimeout(() => {
      if (isSpeaking.value) { isSpeaking.value = false; stop() }
    }, opts.timeout ?? 5000)
    window.speechSynthesis.speak(activeUtterance)
  }

  onUnmounted(stop)
  return { isSpeaking, speak, stop }
}
