import Dexie from 'dexie'

// ===== 数据库初始化 =====
const db = new Dexie('ogden850')

db.version(3).stores({
  progress: 'wordId, stage, nextReview',
  stats: 'key',
  settings: 'key',
  mistakes: '++id, wordId, mode, createdAt',
  favorites: 'wordId, createdAt',
  imageCache: 'key, updatedAt',
  exampleCache: 'key, updatedAt'
})

// ===== 单词进度 =====
export const progressService = {
  async getWordProgress(wordId) {
    return await db.progress.get(wordId) || null
  },
  async getAllProgress() {
    return await db.progress.toArray()
  },
  async saveProgress(wordId, data) {
    await db.progress.put({
      wordId,
      stage: data.stage || 0,
      srs: data.srs || { interval: 0, ease: 2.5, nextReview: null, repetitions: 0 },
      updatedAt: new Date().toISOString()
    })
  },
  async saveAllProgress(progressList) {
    await db.progress.bulkPut(progressList)
  },
  async getDueWords() {
    const now = new Date().toISOString()
    return await db.progress.filter(p => !p.srs?.nextReview || p.srs.nextReview <= now).toArray()
  },
  async getMasteredWords() {
    return await db.progress.filter(p => p.stage >= 5).toArray()
  },
  async getTodayLearned() {
    const today = new Date().toISOString().slice(0, 10)
    return await db.progress.filter(p => p.updatedAt?.startsWith(today)).count()
  },
  async clearAll() {
    await db.progress.clear()
  }
}

// ===== 训练统计 =====
export const statsService = {
  async getStat(key) {
    const record = await db.stats.get(key)
    return record?.value ?? 0
  },
  async setStat(key, value) {
    await db.stats.put({ key, value })
  },
  async incrementStat(key, amount = 1) {
    await db.transaction('rw', db.stats, async () => {
      const record = await db.stats.get(key)
      const current = record?.value ?? 0
      await db.stats.put({ key, value: current + amount })
    })
  },
  async getAllStats() {
    const records = await db.stats.toArray()
    const result = {}
    records.forEach(r => { result[r.key] = r.value })
    return result
  },
  async clearAll() {
    await db.stats.clear()
  }
}

// ===== 用户设置 =====
export const settingsService = {
  async get(key) {
    const record = await db.settings.get(key)
    return record?.value ?? null
  },
  async set(key, value) {
    await db.settings.put({ key, value })
  },
  async getAll() {
    const records = await db.settings.toArray()
    const result = {}
    records.forEach(r => { result[r.key] = r.value })
    return result
  }
}

// ===== 错题集 =====
export const mistakesService = {
  async addMistake(wordId, mode, userAnswer, correctAnswer, word, chinese) {
    const existing = await db.mistakes.where({ wordId, mode }).first()
    if (existing) {
      await db.mistakes.update(existing.id, {
        userAnswer,
        correctAnswer,
        word,
        chinese,
        createdAt: new Date().toISOString()
      })
      return
    }
    await db.mistakes.put({
      wordId,
      mode,
      userAnswer,
      correctAnswer,
      word,
      chinese,
      createdAt: new Date().toISOString()
    })
  },
  async getAllMistakes() {
    return await db.mistakes.orderBy('createdAt').reverse().toArray()
  },
  async removeMistake(id) {
    await db.mistakes.delete(id)
  },
  async removeMistakeByWordId(wordId) {
    await db.mistakes.where({ wordId }).delete()
  },
  async clearAll() {
    await db.mistakes.clear()
  },
  async getCount() {
    return await db.mistakes.count()
  }
}

// ===== 收藏夹 =====
export const favoritesService = {
  async addFavorite(wordId) {
    const existing = await db.favorites.get(wordId)
    if (!existing) {
      await db.favorites.put({
        wordId,
        createdAt: new Date().toISOString()
      })
    }
  },
  async removeFavorite(wordId) {
    await db.favorites.delete(wordId)
  },
  async isFavorite(wordId) {
    const record = await db.favorites.get(wordId)
    return !!record
  },
  async getAllFavoriteIds() {
    const records = await db.favorites.toArray()
    return records.map(r => r.wordId)
  },
  async getCount() {
    return await db.favorites.count()
  }
}

// ===== 导出/导入（用于备份） =====
export const backupService = {
  async exportData() {
    const progress = await db.progress.toArray()
    const stats = await db.stats.toArray()
    const settings = await db.settings.toArray()
    const mistakes = await db.mistakes.toArray()
    const favorites = await db.favorites.toArray()
    return {
      version: 3,
      date: new Date().toISOString(),
      progress,
      stats,
      settings,
      mistakes,
      favorites
    }
  },
  async importData(data) {
    if (data.progress) await db.progress.bulkPut(data.progress)
    if (data.stats) await db.stats.bulkPut(data.stats)
    if (data.settings) await db.settings.bulkPut(data.settings)
    if (data.mistakes) await db.mistakes.bulkPut(data.mistakes)
    if (data.favorites) await db.favorites.bulkPut(data.favorites)
  },
  async clearAll() {
    await db.progress.clear()
    await db.stats.clear()
    await db.settings.clear()
    await db.mistakes.clear()
    await db.favorites.clear()
  }
}

export { db }