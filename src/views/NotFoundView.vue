<template>
  <div class="min-h-screen flex items-center justify-center">
    <div class="text-center">
      <h1 class="text-6xl font-bold mb-4 word-display" :style="{ color: 'var(--accent)' }">404</h1>
      <p :style="{ color: 'var(--text-secondary)' }">这个页面不存在</p>
      <router-link
        to="/"
        class="inline-block mt-4 px-4 py-2 rounded-lg"
        :style="{ backgroundColor: 'var(--accent)', color: '#1A1A2E' }"
      >
        返回首页
      </router-link>
    </div>
  </div>
</template>