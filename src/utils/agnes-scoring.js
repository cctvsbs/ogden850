const BASE_URL = import.meta.env.VITE_AGNES_BASE_URL || 'https://apihub.agnes-ai.com/v1'
const API_KEY = import.meta.env.VITE_AGNES_API_KEY

const SYSTEM_PROMPT = [
  '你是 Ogden 850 基础英语教学助手。',
  '只使用 Ogden 850 词表内的 850 个基础单词；动词时态用操作词替代；始终主动语态。',
  '请评估以下中译英练习。输出 JSON 格式：{"score": 85, "chinese_feedback": "...", "grammar_issues": [], "out_of_scope_words": []}',
  '评分标准：语法正确性 30%，词汇合规性 40%，语义准确性 30%。'
].join('\n')

/**
 * 调用 Agnes API 进行 AI 评分
 * @param {string} zhPrompt - 中文提示
 * @param {string} referenceAnswer - 参考答案
 * @param {string} userAnswer - 用户回答
 * @returns {Promise<{score: number, feedback: string, grammarIssues: string[], outOfVocab: string[]}>}
 */
export async function scoreWithAgnes(zhPrompt, referenceAnswer, userAnswer) {
  if (!API_KEY) throw new Error('API key not configured')

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
        content: `${SYSTEM_PROMPT}\n\n中文提示：${zhPrompt}\n参考答案：${referenceAnswer}\n用户回答：${userAnswer}`
      }],
      stream: false,
      temperature: 0.3
    })
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Agnes API error ${response.status}: ${errText}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || ''
  return parseAgnesResponse(content)
}

function parseAgnesResponse(content) {
  // 从 AI 响应文本中提取 JSON 对象
  const jsonMatch = content.match(/\{[\s\S]*"score"[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        score: parsed.score ?? 50,
        feedback: parsed.chinese_feedback ?? '',
        grammarIssues: parsed.grammar_issues ?? [],
        outOfVocab: parsed.out_of_scope_words ?? []
      }
    } catch {
      // JSON parse failed, fall through
    }
  }
  return { score: 50, feedback: content, grammarIssues: [], outOfVocab: [] }
}

/**
 * 降级：关键词匹配评分
 * @param {string} answer - 用户回答
 * @param {string[]} keywords - 关键词列表
 * @returns {number} 匹配率 0-1
 */
export function fallbackKeywordScore(answer, keywords) {
  const found = keywords.filter(kw => answer.toLowerCase().includes(kw.toLowerCase()))
  return found.length / keywords.length
}
