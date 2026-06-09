import { db } from '@/services/storageService'

const BASE_URL = import.meta.env.VITE_AGNES_BASE_URL || 'https://apihub.agnes-ai.com/v1'
const API_KEY = import.meta.env.VITE_AGNES_API_KEY
export const CACHE_PREFIX = 'image:'
export const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 小时缓存

/**
 * 获取单词的 AI 配图 URL（带 IndexedDB 缓存）
 * @param {string} word - 英文单词
 * @param {string} chinese - 中文释义（可选，用于生成更精确的 prompt）
 * @returns {Promise<string | null>} 图片 URL 或 null
 */
export async function getAIImage(word, chinese) {
  const cacheKey = `${CACHE_PREFIX}${word}`
  const cached = await db.imageCache.get(cacheKey)
  if (cached && cached.value) {
    if (Date.now() - (cached.updatedAt || 0) < CACHE_TTL) {
      return cached.value
    }
  }

  if (!API_KEY) return null

  try {
    const description = chinese || word
    const prompt = `Simple cartoon illustration of ${description}, clean white background, educational style, no text`

    const response = await fetch(`${BASE_URL}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'agnes-image-2.1-flash',
        prompt,
        size: '1024x1024'
      })
    })

    if (!response.ok) {
      console.warn(`[AI Image] Failed for "${word}": ${response.status}`)
      // 缓存失败结果，避免重复请求
      await db.imageCache.put({ key: cacheKey, value: '', updatedAt: Date.now() })
      return null
    }

    const data = await response.json()
    const url = data.data?.[0]?.url

    if (url) {
      await db.imageCache.put({ key: cacheKey, value: url, updatedAt: Date.now() })
      return url
    }
  } catch (err) {
    console.warn('[AI Image] Error for', word, err)
  }

  // 缓存空结果，避免频繁重试
  await db.imageCache.put({ key: cacheKey, value: '', updatedAt: Date.now() })
  return null
}
