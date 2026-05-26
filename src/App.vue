<script setup>
import { ref, watch, onMounted } from 'vue'

const themes = ['cream', 'kraft', 'night', 'green']
const themeLabels = { cream: '米白', kraft: '牛皮纸', night: '暗夜', green: '护眼' }
const themeIcons = { cream: '☀️', kraft: '📜', night: '🌙', green: '🌿' }
const currentTheme = ref('cream')
const isFullscreen = ref(false)
const showThemeMenu = ref(false)
const showChangelog = ref(false)
const showContact = ref(false)
let closeTimer = null

const version = 'v0.5.0'

onMounted(() => {
  const saved = localStorage.getItem('ogden850-theme')
  if (saved && themes.includes(saved)) {
    currentTheme.value = saved
  }
  applyTheme(currentTheme.value)

  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement
  })
})

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('ogden850-theme', theme)
}

function selectTheme(theme) {
  currentTheme.value = theme
  applyTheme(theme)
  showThemeMenu.value = false
  if (closeTimer) clearTimeout(closeTimer)
}

function openThemeMenu() {
  showThemeMenu.value = true
  if (closeTimer) clearTimeout(closeTimer)
}

function scheduleClose() {
  closeTimer = setTimeout(() => {
    showThemeMenu.value = false
  }, 200)
}

function cancelClose() {
  if (closeTimer) clearTimeout(closeTimer)
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
            Ogden 850 主页
          </span>
          <span class="hidden sm:flex items-center gap-1 text-[10px] opacity-50" :style="{ color: 'var(--text-muted)' }">
            推荐
            <span class="inline-flex items-center gap-0.5">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="white"/><path d="M12 2a10 10 0 0 1 0 20v-4a6 6 0 0 0 0-12V2z" fill="#1a73e8"/><path d="M12 22a10 10 0 0 1 0-20v4a6 6 0 0 0 0 12v4z" fill="#fbbc04"/><path d="M22 12h-4a6 6 0 0 1-6 6v4a10 10 0 0 0 10-10z" fill="#34a853"/><path d="M2 12a10 10 0 0 0 10 10v-4a6 6 0 0 1-6-6H2z" fill="#ea4335"/></svg>
              Chrome
            </span>
            <span class="inline-flex items-center gap-0.5">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#0078D7"/><path d="M7.2 18.6c-1.2-1.8-1.8-3.9-1.8-6 0-1.8.5-3.6 1.2-5.1L12 12l-4.8 6.6z" fill="#00BCF2"/><path d="M16.8 5.4C15.6 3.6 13.8 2.4 12 2v10l4.8-6.6z" fill="#0078D7"/><path d="M12 22c2.1 0 4.2-.6 6-1.8L12 12l-6 8.4c1.8 1.2 3.9 1.6 6 1.6z" fill="#107C10"/></svg>
              Edge
            </span>
          </span>
        </router-link>

        <div class="flex items-center gap-2 sm:gap-3">
          <button
            @click="toggleFullscreen"
            class="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-base sm:text-lg cursor-pointer
                   transition-transform hover:scale-110 active:scale-95"
            :style="{ backgroundColor: 'var(--bg-secondary)' }"
            :title="isFullscreen ? '退出全屏' : '窗口最大化'"
          >
            {{ isFullscreen ? '🗖' : '🗗' }}
          </button>

          <div
            class="relative"
            @mouseenter="openThemeMenu"
            @mouseleave="scheduleClose"
          >
            <button
              @click="showThemeMenu = !showThemeMenu"
              class="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-base sm:text-lg cursor-pointer
                     transition-transform hover:scale-110 active:scale-95"
              :style="{ backgroundColor: 'var(--bg-secondary)' }"
              :title="themeLabels[currentTheme]"
            >
              {{ themeIcons[currentTheme] }}
            </button>

            <Transition name="theme-drop">
              <div
                v-if="showThemeMenu"
                @mouseenter="cancelClose"
                @mouseleave="scheduleClose"
                class="absolute right-0 top-full mt-2 py-1.5 rounded-xl border shadow-lg z-50 min-w-[120px]"
                :style="{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }"
              >
                <button
                  v-for="theme in themes"
                  :key="theme"
                  @click="selectTheme(theme)"
                  class="w-full px-4 py-2 text-left text-sm flex items-center gap-2.5 transition-colors hover:opacity-80"
                  :style="{
                    backgroundColor: currentTheme === theme ? 'var(--bg-secondary)' : 'transparent',
                    color: 'var(--text)'
                  }"
                >
                  <span class="text-base">{{ themeIcons[theme] }}</span>
                  <span>{{ themeLabels[theme] }}</span>
                  <span v-if="currentTheme === theme" class="ml-auto text-xs" :style="{ color: 'var(--accent)' }">✓</span>
                </button>
              </div>
            </Transition>
          </div>
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
      <div class="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0">
        <span>Ogden 850 · Basic English 表达训练器</span>
        <span class="flex items-center gap-2 sm:gap-4">
          <button @click="showChangelog = true" class="cursor-pointer hover:opacity-70 transition-opacity" :style="{ color: 'var(--text-muted)' }">📋 更新日志</button>
          <button @click="showContact = true" class="cursor-pointer hover:opacity-70 transition-opacity" :style="{ color: 'var(--text-muted)' }">📬 联系我</button>
          <span>{{ version }}</span>
        </span>
      </div>
    </footer>

    <!-- ==================== 更新日志弹窗 ==================== -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showChangelog" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="showChangelog = false">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
          <div class="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl p-6 sm:p-8" :style="{ backgroundColor: 'var(--bg)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }">
            <button @click="showChangelog = false" class="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-lg cursor-pointer hover:opacity-70" :style="{ color: 'var(--text-muted)' }">✕</button>
            <h2 class="text-xl font-bold mb-4" :style="{ color: 'var(--text)' }">📋 更新日志</h2>

            <div class="space-y-5 text-sm">
              <div>
                <p class="font-bold mb-1.5" :style="{ color: 'var(--accent)' }">v0.5.0 — 2026年5月</p>
                <ul class="space-y-1 pl-4" :style="{ color: 'var(--text-secondary)' }">
                  <li>✨ 新增护眼绿主题，四种主题随心切换</li>
                  <li>✨ 表达模式升级：逐字母显示 + 单词分隔 + 提示随机单词</li>
                  <li>✨ 选择题支持键盘操作（1-4选择，Enter确认，Esc取消）</li>
                  <li>✨ 拼写模式默认隐藏音标，增加清空提示功能</li>
                  <li>✨ 单词卡片弹窗加入变速播放和音节说明</li>
                  <li>✨ 首页改为四个训练大按钮，直达各训练模式</li>
                  <li>🔧 优化语音引擎，修复发音时有时无、响应慢的问题</li>
                  <li>🔧 主题切换改为下拉菜单，操作更便捷</li>
                  <li>🗑️ 删除发音训练独立页面，功能整合到单词卡片</li>
                  <li>🗑️ 删除列表视图、下载按钮、频率筛选等低频功能</li>
                </ul>
              </div>
              <div>
                <p class="font-bold mb-1.5" :style="{ color: 'var(--accent)' }">v0.4.0 — Sprint 5</p>
                <ul class="space-y-1 pl-4" :style="{ color: 'var(--text-secondary)' }">
                  <li>✨ 新增发音可视化训练页</li>
                  <li>✨ 单词卡片增加音节划分和重音高亮</li>
                  <li>✨ 表达训练模式上线</li>
                </ul>
              </div>
              <div>
                <p class="font-bold mb-1.5" :style="{ color: 'var(--accent)' }">v0.3.0 — Sprint 4</p>
                <ul class="space-y-1 pl-4" :style="{ color: 'var(--text-secondary)' }">
                  <li>✨ SM-2 间隔重复闪卡系统</li>
                  <li>✨ 拼写训练模式</li>
                  <li>✨ 选择题训练模式</li>
                </ul>
              </div>
              <div>
                <p class="font-bold mb-1.5" :style="{ color: 'var(--accent)' }">v0.2.0 — Sprint 3</p>
                <ul class="space-y-1 pl-4" :style="{ color: 'var(--text-secondary)' }">
                  <li>✨ 单词浏览、搜索、分类筛选</li>
                  <li>✨ 收藏夹和错题集</li>
                </ul>
              </div>
              <div>
                <p class="font-bold mb-1.5" :style="{ color: 'var(--accent)' }">v0.1.0 — Sprint 1-2</p>
                <ul class="space-y-1 pl-4" :style="{ color: 'var(--text-secondary)' }">
                  <li>🎉 项目初始化，Ogden 850 词表导入</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ==================== 联系方式弹窗 ==================== -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showContact" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="showContact = false">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
          <div class="relative w-full max-w-sm rounded-2xl p-6 sm:p-8 text-center" :style="{ backgroundColor: 'var(--bg)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }">
            <button @click="showContact = false" class="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-lg cursor-pointer hover:opacity-70" :style="{ color: 'var(--text-muted)' }">✕</button>
            <h2 class="text-xl font-bold mb-5" :style="{ color: 'var(--text)' }">📬 联系我</h2>

            <!-- 微信 -->
            <div class="mb-5">
              <p class="text-sm font-medium mb-2" :style="{ color: 'var(--text-secondary)' }">💬 微信</p>
              <img src="/wechat.jpg" alt="微信二维码" class="w-40 h-40 mx-auto rounded-xl mb-2" style="object-fit: cover; object-position: center;" />
              <p class="text-xs" :style="{ color: 'var(--accent)' }">cchy_love</p>
              <p class="text-xs" :style="{ color: 'var(--text-muted)' }">口袋茶叶</p>
            </div>

            <div class="w-3/4 h-px mx-auto mb-5 opacity-20" :style="{ backgroundColor: 'var(--text-muted)' }"></div>

            <!-- 小红书 -->
            <div>
              <p class="text-sm font-medium mb-2" :style="{ color: 'var(--text-secondary)' }">📕 小红书</p>
              <img src="/rednote.jpg" alt="小红书二维码" class="w-40 h-40 mx-auto rounded-xl mb-2" style="object-fit: cover; object-position: center;" />
              <p class="text-xs" :style="{ color: 'var(--text-muted)' }">陈爸爸视光屋</p>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.theme-drop-enter-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.theme-drop-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}
.theme-drop-enter-from {
  opacity: 0;
  transform: translateY(-6px);
}
.theme-drop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
.modal-enter-active, .modal-leave-active {
  transition: opacity 0.25s ease;
}
.modal-enter-from, .modal-leave-to {
  opacity: 0;
}
</style>