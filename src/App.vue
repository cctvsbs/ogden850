<script setup>
import { ref, watch, onMounted } from 'vue'

const themes = ['cream', 'kraft', 'night']
const themeLabels = { cream: '米白', kraft: '牛皮纸', night: '暗夜' }
const themeIcons = { cream: '☀️', kraft: '📜', night: '🌙' }
const currentTheme = ref('cream')
const isFullscreen = ref(false)

onMounted(() => {
  const saved = localStorage.getItem('ogden850-theme')
  if (saved && themes.includes(saved)) {
    currentTheme.value = saved
  }
  applyTheme(currentTheme.value)
  
  // 监听全屏状态变化
  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement
  })
})

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('ogden850-theme', theme)
}

function cycleTheme() {
  const index = themes.indexOf(currentTheme.value)
  const next = themes[(index + 1) % themes.length]
  currentTheme.value = next
  applyTheme(next)
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

watch(currentTheme, applyTheme)
</script>

<template>
  <div class="min-h-screen flex flex-col w-full" :style="{ backgroundColor: 'var(--bg)' }">
    <!-- 顶部导航 -->
    <header
      class="sticky top-0 z-50 border-b w-full"
      :style="{
        backgroundColor: 'var(--bg)',
        borderColor: 'var(--border)'
      }"
    >
      <div class="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
        <router-link to="/" class="flex items-center gap-2 no-underline">
          <span class="text-lg sm:text-xl" role="img" aria-label="雪包">❄️</span>
          <span class="text-base sm:text-lg font-bold tracking-wide" :style="{ color: 'var(--text)' }">
            Ogden 850
          </span>
        </router-link>

        <div class="flex items-center gap-2 sm:gap-3">
          <!-- 最大化按钮 -->
          <button
            @click="toggleFullscreen"
            class="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-base sm:text-lg cursor-pointer
                   transition-transform hover:scale-110 active:scale-95"
            :style="{ backgroundColor: 'var(--bg-secondary)' }"
            :title="isFullscreen ? '退出全屏' : '窗口最大化'"
          >
            {{ isFullscreen ? '🗖' : '🗗' }}
          </button>
          
          <!-- 主题切换按钮 -->
          <button
            @click="cycleTheme"
            class="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-base sm:text-lg cursor-pointer
                   transition-transform hover:scale-110 active:scale-95"
            :style="{ backgroundColor: 'var(--bg-secondary)' }"
            :title="themeLabels[currentTheme]"
          >
            {{ themeIcons[currentTheme] }}
          </button>
        </div>
      </div>
    </header>

    <!-- 主内容区 -->
    <main class="flex-1 w-full flex justify-center">
      <router-view />
    </main>

    <!-- 底部 -->
    <footer
      class="border-t py-3 sm:py-4 text-center text-xs w-full"
      :style="{
        borderColor: 'var(--border)',
        color: 'var(--text-muted)'
      }"
    >
      <div class="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-1 sm:gap-0">
        <span>Ogden 850 · Basic English 表达训练器</span>
        <span class="hidden sm:inline">v0.4.0 · Sprint 5</span>
      </div>
    </footer>
  </div>
</template>