import { db } from '@/services/storageService'

const BASE_URL = import.meta.env.VITE_AGNES_BASE_URL || 'https://apihub.agnes-ai.com/v1'
const API_KEY = import.meta.env.VITE_AGNES_API_KEY
const CACHE_PREFIX = 'ex:'
const CACHE_TTL = 30 * 60 * 1000 // 30 分钟缓存

const EXAMPLE_PROMPT = [
  '你是 Ogden 850 基础英语教学助手。',
  '只使用 Ogden 850 词表内的 850 个基础单词，句子简短适合初学者。',
  '输出 JSON 格式：{"basic_en": "简单例句英文", "basic_zh": "简单例句中文", "standard_en": "标准例句英文", "standard_zh": "标准例句中文"}'
].join('\n')

/**
 * 获取单词的 AI 例句（带 IndexedDB 缓存）
 * @param {string} word - 英文单词
 * @returns {Promise<{basic_en: string, basic_zh: string, standard_en: string, standard_zh: string} | null>}
 */
export async function getAIExamples(word) {
  const cached = await db.exampleCache.get(`${CACHE_PREFIX}${word}`)
  if (cached && cached.value) {
    if (Date.now() - (cached.updatedAt || 0) < CACHE_TTL) {
      try {
        return JSON.parse(cached.value)
      } catch { /* corrupted cache, regenerate */ }
    }
  }

  if (!API_KEY) return null

  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'agnes-2.0-flash',
        messages: [{
          role: 'user',
          content: `${EXAMPLE_PROMPT}\n\n单词：${word}`
        }],
        stream: false,
        temperature: 0.5
      })
    })

    if (!response.ok) return null

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''

    // 提取 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      // 缓存
      await db.exampleCache.put({
        key: `${CACHE_PREFIX}${word}`,
        value: JSON.stringify(parsed),
        updatedAt: Date.now()
      })
      return parsed
    }
  } catch { /* cache miss */ }

  return null
}
