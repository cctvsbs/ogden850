export function useWordNavigation(words, currentIndex, onSelect, onNav) {
  function goPrev() {
    if (!words?.value?.length) return
    const newIdx = currentIndex.value <= 0 ? words.value.length - 1 : currentIndex.value - 1
    onNav?.()
    onSelect(words.value[newIdx], newIdx)
  }
  function goNext() {
    if (!words?.value?.length) return
    const newIdx = currentIndex.value >= words.value.length - 1 ? 0 : currentIndex.value + 1
    onNav?.()
    onSelect(words.value[newIdx], newIdx)
  }
  return { goPrev, goNext }
}
