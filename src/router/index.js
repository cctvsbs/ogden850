import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
    meta: { title: 'Ogden 850 · 单词列表' }
  },
  {
    path: '/word/:id',
    name: 'word-detail',
    component: () => import('@/views/WordDetailView.vue'),
    meta: { title: '单词详情' }
  },
  {
    path: '/practice',
    name: 'practice',
    component: () => import('@/views/PracticeView.vue'),
    meta: { title: '训练模式' }
  },
  {
    path: '/phonetic',
    name: 'phonetic',
    component: () => import('@/views/PhoneticTrainer.vue'),
    meta: { title: '英语发音可视化训练' }
  },
  {
    path: '/stats',
    name: 'stats',
    component: () => import('@/views/StatsView.vue'),
    meta: { title: '学习统计' }
  },
  {
    path: '/expression',
    name: 'expression',
    component: () => import('@/views/ExpressionView.vue'),
    meta: { title: '表达训练' }
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('@/views/AboutView.vue'),
    meta: { title: '关于 Ogden 850' }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: '页面未找到' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

router.afterEach((to) => {
  document.title = to.meta.title || 'Ogden 850'
})

export default router