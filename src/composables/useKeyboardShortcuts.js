import { onMounted, onUnmounted } from 'vue'

export function useKeyboardShortcuts(handlers, options = { excludeInputs: true }) {
  const handleKeydown = (e) => {
    if (options.excludeInputs) {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    }
    for (const [keys, action] of Object.entries(handlers)) {
      if (keys.includes(e.key) || keys.includes(e.code)) {
        e.preventDefault()
        action(e)
        return
      }
    }
  }

  onMounted(() => window.addEventListener('keydown', handleKeydown))
  onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
}
