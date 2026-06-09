export function splitExampleTokens(sentence) {
  const tokens = []
  const regex = /(\S+)(\s*)/g
  let match
  while ((match = regex.exec(sentence)) !== null) {
    tokens.push({ word: match[1], space: match[2] })
  }
  return tokens
}
