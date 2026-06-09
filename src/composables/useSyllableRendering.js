export const SYLLABLE_COLORS = ['#4A90D9', '#52B788', '#E8864A', '#D94A8F', '#8B5CF6']

export function renderColoredSyllables(syllables, stressIdx) {
  return syllables.map((s, i) => {
    const c = SYLLABLE_COLORS[i % SYLLABLE_COLORS.length]
    const bold = i === stressIdx ? 'font-weight:800;text-decoration:underline;text-underline-offset:4px;' : ''
    return `<span style="color:${c};${bold}">${s}</span>`
  }).join(' . ')
}

export function renderColoredIPA(ipa, stressIdx) {
  const p = ipa.replace(/^\/|\/$/g, '')
  const parts = p.split('.')
  const colored = parts.map((part, i) => {
    const c = SYLLABLE_COLORS[i % SYLLABLE_COLORS.length]
    const bold = i === stressIdx ? 'font-weight:700;text-decoration:underline;text-underline-offset:3px;' : ''
    return `<span style="color:${c};${bold}">${part}</span>`
  }).join(' . ')
  return `<span style="color:#999">/</span>${colored}<span style="color:#999">/</span>`
}
