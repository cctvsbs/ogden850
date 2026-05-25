<script setup>
defineProps({
  modelValue: { type: String, default: '' }
})
defineEmits(['update:modelValue'])
</script>

<template>
  <div class="relative w-full max-w-xl mx-auto">
    <svg
      class="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none"
      :style="{ color: 'var(--text-muted)' }"
      fill="none" stroke="currentColor" viewBox="0 0 24 24"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>

    <input
      type="text"
      :value="modelValue"
      @input="$emit('update:modelValue', $event.target.value)"
      placeholder="搜索单词或释义..."
      class="w-full pl-14 pr-5 py-4 text-lg rounded-2xl border outline-none transition-all duration-200"
      :style="{
        backgroundColor: 'var(--bg)',
        borderColor: 'var(--border)',
        color: 'var(--text)',
        boxShadow: 'var(--shadow-sm)'
      }"
      @focus="e => {
        e.target.style.borderColor = 'var(--accent)'
        e.target.style.boxShadow = 'var(--shadow-md)'
      }"
      @blur="e => {
        e.target.style.borderColor = 'var(--border)'
        e.target.style.boxShadow = 'var(--shadow-sm)'
      }"
    />

    <button
      v-if="modelValue"
      @click="$emit('update:modelValue', '')"
      class="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center
             rounded-full text-sm cursor-pointer hover:opacity-70"
      :style="{ color: 'var(--text-muted)' }"
    >✕</button>
  </div>
</template>