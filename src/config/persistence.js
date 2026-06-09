import { db } from '@/services/storageService'

const PRACTICE_PREFIX = 'practice:'

export async function savePracticeState(subKey, value) {
  await db.settings.put({ key: `${PRACTICE_PREFIX}${subKey}`, value })
}

export async function loadPracticeState(subKey, fallback) {
  const record = await db.settings.get(`${PRACTICE_PREFIX}${subKey}`)
  return record?.value ?? fallback
}

export async function saveAllPracticeState(state) {
  if (!state || typeof state !== 'object') return
  const entries = Object.entries(state)
  await db.settings.bulkPut(entries.map(([subKey, value]) => ({
    key: `${PRACTICE_PREFIX}${subKey}`,
    value: JSON.stringify(value)
  })))
}

export async function loadAllPracticeState() {
  const records = await db.settings.where('key').startsWith(PRACTICE_PREFIX).toArray()
  const result = {}
  records.forEach(r => {
    const subKey = r.key.replace(PRACTICE_PREFIX, '')
    try {
      result[subKey] = JSON.parse(r.value)
    } catch {
      result[subKey] = r.value
    }
  })
  return result
}
