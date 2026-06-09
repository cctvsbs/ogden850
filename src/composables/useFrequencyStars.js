export function frequencyStars(level) {
  if (!level) return ''
  return '★'.repeat(level) + '☆'.repeat(5 - level)
}
