<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useWordsStore } from '@/stores/words'
import { useRouter } from 'vue-router'

const store = useWordsStore()
const router = useRouter()

const themes = ['cream', 'kraft', 'night', 'green']
const themeLabels = { cream: '米白', kraft: '牛皮纸', night: '暗夜', green: '护眼' }
const themeIcons = { cream: '☀️', kraft: '📜', night: '🌙', green: '🌿' }
const currentTheme = ref('cream')
const isFullscreen = ref(false)
const showThemeMenu = ref(false)
const showChangelog = ref(false)
const showContact = ref(false)
let closeTimer = null

const version = 'v0.6.0'

onMounted(() => {
  const saved = localStorage.getItem('ogden850-theme')
  if (saved && themes.includes(saved)) {
    currentTheme.value = saved
  }
  applyTheme(currentTheme.value)
  document.addEventListener('fullscreenchange', () => { isFullscreen.value = !!document.fullscreenElement })
  initFab()
})

function applyTheme(theme) { document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('ogden850-theme', theme) }
function selectTheme(theme) { currentTheme.value = theme; applyTheme(theme); showThemeMenu.value = false; if (closeTimer) clearTimeout(closeTimer) }
function openThemeMenu() { showThemeMenu.value = true; if (closeTimer) clearTimeout(closeTimer) }
function scheduleClose() { closeTimer = setTimeout(() => { showThemeMenu.value = false }, 200) }
function cancelClose() { if (closeTimer) clearTimeout(closeTimer) }
function toggleFullscreen() { if (!document.fullscreenElement) { document.documentElement.requestFullscreen() } else { document.exitFullscreen() } }

function getPosTag(category) { const map = { operations: '操作词', thingsGeneral: '名词', thingsPicturable: '名词', qualitiesGeneral: '形容词', qualitiesOpposite: '形容词' }; return map[category] || '' }
function downloadPDF() {
  const rows = store.words.map(w => `<tr><td>${w.word}</td><td>${w.chinese}</td><td>${w.phonetic || ''}</td><td>${getPosTag(w.category)}</td></tr>`).join('')
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ogden 850 Word List</title><style>body{font-family:sans-serif;padding:20px}h1{font-size:18px;margin-bottom:5px}p{font-size:12px;color:#666;margin-bottom:15px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #ddd;padding:4px 8px;text-align:left}th{background:#f5f5f5}@media print{button{display:none}}</style></head><body><h1>Ogden 850 Basic English Word List</h1><p>Total: 850 words | Date: ${new Date().toISOString().slice(0,10)}</p><table><thead><tr><th>Word</th><th>Chinese</th><th>Phonetic</th><th>POS</th></tr></thead><tbody>${rows}</tbody></table><p style="text-align:center;margin-top:20px"><button onclick="window.print()" style="padding:10px 30px;font-size:14px">🖨️ 打印 / 导出 PDF</button></p></body></html>`
  const win = window.open('', '_blank', 'width=900,height=700'); win.document.write(html); win.document.close()
}

watch(currentTheme, applyTheme)

// ===== 移动端浮动导航 =====
const fabCollapsed = ref(true)
let fabHideTimer = null
let fabDragging = false
let fabStartX = 0, fabStartY = 0, fabStartLeft = 0, fabStartTop = 0
let fabMoved = false
const fabMoveThreshold = 6

function fabCollapse() { fabCollapsed.value = true; if (fabHideTimer) clearTimeout(fabHideTimer) }
function fabExpand() { fabCollapsed.value = false; fabResetTimer() }
function fabResetTimer() { if (fabHideTimer) clearTimeout(fabHideTimer); fabHideTimer = setTimeout(() => fabCollapse(), 3000) }

function fabGo(mode) {
  if (mode === 'home') router.push('/')
  else router.push(`/practice?mode=${mode}`)
  fabResetTimer()
}

function fabPointerDown(e) {
  fabDragging = true; fabMoved = false
  const wrapper = document.getElementById('fabWrapper')
  const screen = document.getElementById('app')
  wrapper.classList.add('dragging')
  fabStartX = e.clientX; fabStartY = e.clientY
  const rect = wrapper.getBoundingClientRect()
  const sRect = screen.getBoundingClientRect()
  fabStartLeft = rect.left - sRect.left; fabStartTop = rect.top - sRect.top
  document.getElementById('fabBall').setPointerCapture(e.pointerId)
  e.preventDefault()
}

function fabPointerMove(e) {
  if (!fabDragging) return
  const dx = e.clientX - fabStartX; const dy = e.clientY - fabStartY
  if (Math.abs(dx) > fabMoveThreshold || Math.abs(dy) > fabMoveThreshold) fabMoved = true
  if (!fabMoved) return
  if (!fabCollapsed.value) fabCollapse()
  const wrapper = document.getElementById('fabWrapper')
  const screen = document.getElementById('app')
  let newLeft = fabStartLeft + dx; let newTop = fabStartTop + dy
  const sRect = screen.getBoundingClientRect()
  const maxLeft = sRect.width - wrapper.offsetWidth - 16; const maxTop = sRect.height - wrapper.offsetHeight - 16
  newLeft = Math.max(16, Math.min(newLeft, maxLeft)); newTop = Math.max(16, Math.min(newTop, maxTop))
  wrapper.style.left = newLeft + 'px'; wrapper.style.right = 'auto'; wrapper.style.top = newTop + 'px'
}

function fabPointerUp(e) {
  if (!fabDragging) return
  fabDragging = false
  const wrapper = document.getElementById('fabWrapper')
  wrapper.classList.remove('dragging')
  if (!fabMoved) { fabCollapsed.value ? fabExpand() : fabCollapse() }
  else {
    const screen = document.getElementById('app')
    const sRect = screen.getBoundingClientRect()
    const wRect = wrapper.getBoundingClientRect()
    const currentLeft = wRect.left - sRect.left
    if (currentLeft + wRect.width / 2 < sRect.width / 2) { wrapper.style.left = '16px'; wrapper.style.right = 'auto' }
    else { wrapper.style.left = 'auto'; wrapper.style.right = '16px' }
    fabResetTimer()
  }
}

function initFab() {
  const wrapper = document.getElementById('fabWrapper')
  if (!wrapper) return
  wrapper.style.right = '16px'
  wrapper.style.top = '70%'
  const ball = document.getElementById('fabBall')
  if (ball) {
    ball.addEventListener('pointerdown', fabPointerDown)
    ball.addEventListener('pointermove', fabPointerMove)
    ball.addEventListener('pointerup', fabPointerUp)
    ball.addEventListener('pointercancel', () => { fabDragging = false; document.getElementById('fabWrapper')?.classList.remove('dragging') })
  }
}
</script>

<template>
  <div id="app" class="min-h-screen flex flex-col w-full" :style="{ backgroundColor: 'var(--bg)' }">
    <header class="sticky top-0 z-50 border-b w-full" :style="{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
        <router-link to="/" class="flex items-center gap-2 no-underline">
          <span class="text-lg sm:text-xl" role="img" aria-label="雪包">❄️</span>
          <span class="text-base sm:text-lg font-bold tracking-wide" :style="{ color: 'var(--text)' }">Ogden 850 主页</span>
          <span class="hidden sm:flex items-center gap-1 text-[10px] opacity-50" :style="{ color: 'var(--text-muted)' }">
            推荐
            <span class="inline-flex items-center gap-0.5">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="white"/><path d="M12 2a10 10 0 0 1 0 20v-4a6 6 0 0 0 0-12V2z" fill="#1a73e8"/><path d="M12 22a10 10 0 0 1 0-20v4a6 6 0 0 0 0 12v4z" fill="#fbbc04"/><path d="M22 12h-4a6 6 0 0 1-6 6v4a10 10 0 0 0 10-10z" fill="#34a853"/><path d="M2 12a10 10 0 0 0 10 10v-4a6 6 0 0 1-6-6H2z" fill="#ea4335"/></svg>Chrome
            </span>
            <span class="inline-flex items-center gap-0.5">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#0078D7"/><path d="M7.2 18.6c-1.2-1.8-1.8-3.9-1.8-6 0-1.8.5-3.6 1.2-5.1L12 12l-4.8 6.6z" fill="#00BCF2"/><path d="M16.8 5.4C15.6 3.6 13.8 2.4 12 2v10l4.8-6.6z" fill="#0078D7"/><path d="M12 22c2.1 0 4.2-.6 6-1.8L12 12l-6 8.4c1.8 1.2 3.9 1.6 6 1.6z" fill="#107C10"/></svg>Edge
            </span>
          </span>
        </router-link>

        <div class="flex items-center gap-2 sm:gap-3">
          <button @click="toggleFullscreen" class="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-base sm:text-lg cursor-pointer transition-transform hover:scale-110 active:scale-95" :style="{ backgroundColor: 'var(--bg-secondary)' }" :title="isFullscreen ? '退出全屏' : '窗口最大化'">{{ isFullscreen ? '🗖' : '🗗' }}</button>
          <div class="relative" @mouseenter="openThemeMenu" @mouseleave="scheduleClose">
            <button @click="showThemeMenu = !showThemeMenu" class="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-base sm:text-lg cursor-pointer transition-transform hover:scale-110 active:scale-95" :style="{ backgroundColor: 'var(--bg-secondary)' }" :title="themeLabels[currentTheme]">{{ themeIcons[currentTheme] }}</button>
            <Transition name="theme-drop">
              <div v-if="showThemeMenu" @mouseenter="cancelClose" @mouseleave="scheduleClose" class="absolute right-0 top-full mt-2 py-1.5 rounded-xl border shadow-lg z-50 min-w-[120px]" :style="{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }">
                <button v-for="theme in themes" :key="theme" @click="selectTheme(theme)" class="w-full px-4 py-2 text-left text-sm flex items-center gap-2.5 transition-colors hover:opacity-80" :style="{ backgroundColor: currentTheme === theme ? 'var(--bg-secondary)' : 'transparent', color: 'var(--text)' }"><span class="text-base">{{ themeIcons[theme] }}</span><span>{{ themeLabels[theme] }}</span><span v-if="currentTheme === theme" class="ml-auto text-xs" :style="{ color: 'var(--accent)' }">✓</span></button>
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </header>

    <main class="flex-1 w-full flex justify-center">
      <router-view />
    </main>

    <footer class="border-t py-3 sm:py-4 text-center text-xs w-full" :style="{ borderColor: 'var(--border)', color: 'var(--text-muted)' }">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0">
        <span><router-link to="/" class="cursor-pointer hover:opacity-70 transition-opacity no-underline" :style="{ color: 'var(--text-muted)' }">🏠 主页面</router-link></span>
        <span class="flex items-center gap-2 sm:gap-4">
          <a href="https://dn710107.ca.archive.org/0/items/ogdens-basic-english-words-list-alphabetic/Ogden%27s%20Basic%20English%20Words%20List%20alphabetic.pdf" target="_blank" class="cursor-pointer hover:opacity-70 transition-opacity no-underline" :style="{ color: 'var(--text-muted)' }">📖 原档</a>
          <button @click="downloadPDF" class="cursor-pointer hover:opacity-70 transition-opacity" :style="{ color: 'var(--text-muted)' }">📄 PDF</button>
          <button @click="showChangelog = true" class="cursor-pointer hover:opacity-70 transition-opacity" :style="{ color: 'var(--text-muted)' }">📋 更新日志</button>
          <button @click="showContact = true" class="cursor-pointer hover:opacity-70 transition-opacity" :style="{ color: 'var(--text-muted)' }">📬 联系我</button>
          <span>{{ version }}</span>
        </span>
      </div>
    </footer>

    <!-- 更新日志弹窗 -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showChangelog" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="showChangelog = false">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
          <div class="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl p-6 sm:p-8" :style="{ backgroundColor: 'var(--bg)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }">
            <button @click="showChangelog = false" class="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-lg cursor-pointer hover:opacity-70" :style="{ color: 'var(--text-muted)' }">✕</button>
            <h2 class="text-xl font-bold mb-4" :style="{ color: 'var(--text)' }">📋 更新日志</h2>
            <div class="space-y-5 text-sm">
              <div><p class="font-bold mb-1.5" :style="{ color: 'var(--accent)' }">v0.6.0 — 2026年5月</p><ul class="space-y-1 pl-4" :style="{ color: 'var(--text-secondary)' }"><li>✨ 新增移动端浮动导航球（可拖动、自动收缩）</li><li>✨ 拼写模式改为字母块二合一输入</li><li>✨ 拼写/表达模式全部正确自动提交</li><li>✨ 闪卡模式按钮简化，收藏移到喇叭右侧</li><li>✨ 单词卡片背面增高，例句标签与说明同行</li><li>✨ 全局变速统一为 0.75x / 1.0x 双档切换</li><li>✨ US/UK、男女声改为单按钮切换</li><li>🔧 优化语音引擎（resume 唤醒 + 链式播放 + 超时兜底）</li><li>🔧 闪卡背面中文移到英文例句后面</li><li>🎨 新增联系方式弹窗（微信 + 小红书二维码）</li><li>🎨 新增更新日志弹窗</li><li>🎨 Footer 恢复原档/PDF 下载，新增主页面快捷入口</li><li>🗑️ 删除发音训练独立页面</li><li>🗑️ 删除列表视图、频率筛选</li></ul></div>
              <div><p class="font-bold mb-1.5" :style="{ color: 'var(--accent)' }">v0.5.0 — 2026年5月</p><ul class="space-y-1 pl-4" :style="{ color: 'var(--text-secondary)' }"><li>✨ 新增护眼绿主题，四种主题随心切换</li><li>✨ 表达模式升级：逐字母显示 + 单词分隔 + 提示随机单词</li><li>✨ 选择题支持键盘操作（1-4选择，Enter确认，Esc取消）</li><li>✨ 拼写模式默认隐藏音标，增加清空提示功能</li><li>✨ 单词卡片弹窗加入变速播放和音节说明</li><li>✨ 首页改为四个训练大按钮，直达各训练模式</li><li>🔧 优化语音引擎，修复发音时有时无、响应慢的问题</li><li>🔧 主题切换改为下拉菜单，操作更便捷</li><li>🗑️ 删除发音训练独立页面，功能整合到单词卡片</li><li>🗑️ 删除列表视图、下载按钮、频率筛选等低频功能</li></ul></div>
              <div><p class="font-bold mb-1.5" :style="{ color: 'var(--accent)' }">v0.4.0 — Sprint 5</p><ul class="space-y-1 pl-4" :style="{ color: 'var(--text-secondary)' }"><li>✨ 新增发音可视化训练页</li><li>✨ 单词卡片增加音节划分和重音高亮</li><li>✨ 表达训练模式上线</li></ul></div>
              <div><p class="font-bold mb-1.5" :style="{ color: 'var(--accent)' }">v0.3.0 — Sprint 4</p><ul class="space-y-1 pl-4" :style="{ color: 'var(--text-secondary)' }"><li>✨ SM-2 间隔重复闪卡系统</li><li>✨ 拼写训练模式</li><li>✨ 选择题训练模式</li></ul></div>
              <div><p class="font-bold mb-1.5" :style="{ color: 'var(--accent)' }">v0.2.0 — Sprint 3</p><ul class="space-y-1 pl-4" :style="{ color: 'var(--text-secondary)' }"><li>✨ 单词浏览、搜索、分类筛选</li><li>✨ 收藏夹和错题集</li></ul></div>
              <div><p class="font-bold mb-1.5" :style="{ color: 'var(--accent)' }">v0.1.0 — Sprint 1-2</p><ul class="space-y-1 pl-4" :style="{ color: 'var(--text-secondary)' }"><li>🎉 项目初始化，Ogden 850 词表导入</li></ul></div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 联系方式弹窗 -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showContact" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="showContact = false">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
          <div class="relative w-full max-w-sm rounded-2xl p-6 sm:p-8 text-center" :style="{ backgroundColor: 'var(--bg)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }">
            <button @click="showContact = false" class="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-lg cursor-pointer hover:opacity-70" :style="{ color: 'var(--text-muted)' }">✕</button>
            <h2 class="text-xl font-bold mb-5" :style="{ color: 'var(--text)' }">📬 联系我</h2>
            <div class="mb-5"><p class="text-sm font-medium mb-2" :style="{ color: 'var(--text-secondary)' }">💬 微信</p><img src="/wechat.jpg" alt="微信二维码" class="w-40 h-40 mx-auto rounded-xl mb-2" style="object-fit: cover; object-position: center;" /><p class="text-xs" :style="{ color: 'var(--accent)' }">cchy_love</p><p class="text-xs" :style="{ color: 'var(--text-muted)' }">口袋茶叶</p></div>
            <div class="w-3/4 h-px mx-auto mb-5 opacity-20" :style="{ backgroundColor: 'var(--text-muted)' }"></div>
            <div><p class="text-sm font-medium mb-2" :style="{ color: 'var(--text-secondary)' }">📕 小红书</p><img src="/rednote.jpg" alt="小红书二维码" class="w-40 h-40 mx-auto rounded-xl mb-2" style="object-fit: cover; object-position: center;" /><p class="text-xs" :style="{ color: 'var(--text-muted)' }">陈爸爸视光屋</p></div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 移动端浮动导航 -->
    <div id="fabWrapper" class="fab-wrapper">
      <div class="fab-menu" :class="{ collapsed: fabCollapsed }">
        <button class="fab-btn fab-btn-flashcard" @click.stop="fabGo('flashcard')"><span class="fab-label">闪卡</span>🃏</button>
        <button class="fab-btn fab-btn-choice" @click.stop="fabGo('choice')"><span class="fab-label">选择</span>📝</button>
        <button class="fab-btn fab-btn-spelling" @click.stop="fabGo('spelling')"><span class="fab-label">拼词</span>⌨️</button>
        <button class="fab-btn fab-btn-express" @click.stop="fabGo('expression')"><span class="fab-label">拼句</span>💬</button>
        <button class="fab-btn fab-btn-home" @click.stop="fabGo('home')"><span class="fab-label">主页</span>🏠</button>
      </div>
      <div id="fabBall" class="fab-toggle-ball">⋯</div>
    </div>
  </div>
</template>

<style scoped>
.theme-drop-enter-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.theme-drop-leave-active { transition: opacity 0.1s ease, transform 0.1s ease; }
.theme-drop-enter-from { opacity: 0; transform: translateY(-6px); }
.theme-drop-leave-to { opacity: 0; transform: translateY(-4px); }
.modal-enter-active, .modal-leave-active { transition: opacity 0.25s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }

/* ===== 移动端浮动导航样式 ===== */
.fab-wrapper {
  display: none;
  position: fixed;
  z-index: 9999;
  flex-direction: column;
  align-items: center;
  touch-action: none;
  transition: left 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28), right 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
}
.fab-wrapper.dragging { transition: none; }

@media (max-width: 768px) {
  .fab-wrapper { display: flex; }
}

.fab-menu {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 1;
  transform: scale(1);
  pointer-events: auto;
  transform-origin: bottom center;
}
.fab-menu.collapsed {
  opacity: 0;
  transform: scale(0);
  height: 0;
  margin-bottom: 0;
  pointer-events: none;
}

.fab-btn {
  width: 42px; height: 42px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  font-size: 19px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 10px rgba(0,0,0,0.18);
  color: #fff;
  position: relative;
  -webkit-tap-highlight-color: transparent;
}
.fab-btn:active { transform: scale(0.88); }
.fab-btn-flashcard { background: #E8B86D; }
.fab-btn-choice   { background: #4A90D9; }
.fab-btn-spelling { background: #52B788; }
.fab-btn-express  { background: #D94A8F; }
.fab-btn-home     { background: #8B5CF6; }

.fab-label {
  position: absolute;
  right: 50px;
  background: rgba(30,30,30,0.88);
  color: #fff;
  padding: 5px 12px;
  border-radius: 14px;
  font-size: 12px;
  white-space: nowrap;
  font-weight: 500;
  opacity: 0;
  pointer-events: none;
}
.fab-btn:active .fab-label { opacity: 1; }

.fab-toggle-ball {
  width: 42px; height: 42px;
  border-radius: 50%;
  background: #1A1A2E;
  border: 1.5px solid rgba(255,255,255,0.25);
  cursor: grab;
  font-size: 18px;
  color: rgba(255,255,255,0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 3px 12px rgba(0,0,0,0.25);
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  flex-shrink: 0;
}
.fab-toggle-ball:active { cursor: grabbing; background: #2e2e4f; }
</style>