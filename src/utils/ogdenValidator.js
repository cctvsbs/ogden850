import rawWords from '@/data/ogden850.json'

// Ogden 850 词表 Set
const ogdenSet = new Set(rawWords.map(w => w.word.toLowerCase()))

// 不规则屈折形式
const irregularForms = {
  be: ['am','is','are','was','were','been','being'],
  have: ['has','had','having'],
  do: ['does','did','doing','done'],
  go: ['goes','went','gone','going'],
  come: ['comes','came','coming'],
  make: ['makes','made','making'],
  take: ['takes','took','taken','taking'],
  get: ['gets','got','gotten','getting'],
  give: ['gives','gave','given','giving'],
  put: ['puts','putting'],
  see: ['sees','saw','seen','seeing'],
  say: ['says','said','saying'],
  keep: ['keeps','kept','keeping'],
  let: ['lets','letting'],
  send: ['sends','sent','sending'],
  will: ['would'],
  may: ['might'],
  can: ['could'],
  shall: ['should'],
}

// 规则屈折自动生成
function generateRegularForms(word) {
  const forms = []
  // 复数/三单
  if (/[sxz]$/.test(word) || /[ch|sh]$/.test(word)) forms.push(word + 'es')
  else if (word.endsWith('y') && !'aeiou'.includes(word[word.length-2])) forms.push(word.slice(0,-1) + 'ies')
  else forms.push(word + 's')
  // 过去式
  if (word.endsWith('e')) forms.push(word + 'd')
  else if (word.endsWith('y') && !'aeiou'.includes(word[word.length-2])) forms.push(word.slice(0,-1) + 'ied')
  else if (/[aeiou][^aeiouwxy]$/.test(word) && word.length <= 5) forms.push(word + word[word.length-1] + 'ed')
  else forms.push(word + 'ed')
  // 进行时
  if (word.endsWith('e')) forms.push(word.slice(0,-1) + 'ing')
  else if (/[aeiou][^aeiouwxy]$/.test(word) && word.length <= 5) forms.push(word + word[word.length-1] + 'ing')
  else forms.push(word + 'ing')
  // 比较级/最高级
  if (word.length <= 5 && !word.endsWith('e')) { forms.push(word + 'er', word + 'est') }
  else if (word.length <= 5 && word.endsWith('e')) { forms.push(word + 'r', word + 'st') }
  return forms
}

// 初始化：把所有变形加入集合
rawWords.forEach(w => {
  generateRegularForms(w.word.toLowerCase()).forEach(f => ogdenSet.add(f))
})
Object.values(irregularForms).flat().forEach(f => ogdenSet.add(f.toLowerCase()))

// 常见功能词（可能不在 850 内但必须的）
const functionWords = ['a','an','the','i','me','my','mine','you','your','yours','he','him','his','she','her','hers','it','its','we','us','our','ours','they','them','their','theirs','this','that','these','those','who','whom','whose','which','what','to','for','with','from','on','in','at','by','of','and','or','but','not','if','so','as','than','when','where','how','why','very','too','just','only','also','even','still','yet','all','some','any','no','every','each','both','few','more','most','much','many','other','such','there','here','now','then','always','never','often','sometimes','up','down','out','over','under','off','back','again','away','well','is','am','are','was','were','be','been','being','have','has','had','having','do','does','did','doing','will','would','can','could','may','might','must','shall','should','let','make','made','get','got','go','went','gone','going','come','came','coming','take','took','taken','taking','give','gave','given','giving','see','saw','seen','seeing','say','says','said','saying']
functionWords.forEach(w => ogdenSet.add(w.toLowerCase()))

/**
 * 校验英文句子
 */
export function validateSentence(sentence) {
  const words = sentence
    .toLowerCase()
    .replace(/[.,!?;:'"()—–\-\[\]{}…]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0 && isNaN(w))

  const outOfRange = [...new Set(words.filter(w => !ogdenSet.has(w)))]

  return {
    isCompliant: outOfRange.length === 0,
    outOfRangeWords: outOfRange,
    totalWords: words.length,
    ogdenCount: words.filter(w => ogdenSet.has(w)).length,
  }
}

/**
 * 获取一个例句的合规摘要（轻量版，给 UI 用）
 */
export function getExampleStatus(englishSentence) {
  return validateSentence(englishSentence)
}