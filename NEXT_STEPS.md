# Ogden 850 项目上下文总结 — 发送给 Claude Code 使用

## 一、项目状态

**你正在用**：Claude Code + Agnes 免费 API + 常用 skill 库，项目已进入 AI 功能阶段。
**当前代码位置**：`C:\Users\cctvs\Desktop\ogden850-refactored\`

### 已完成阶段

| 阶段 | 状态 | 内容 |
|------|------|------|
| 阶段 0-6 | ✅ 完成 | 重构：composables + 数据文件 + IndexedDB + 代码去重（v0.7.0） |
| Composables 引用 | ✅ 完成 | 4 个组件已引用 8 个 composables，消除重复代码（v0.7.1） |
| AI 智能评分 | ✅ 完成 | 表达模式 AI 评分 + 关键词降级（v0.8.0） |
| AI 配图 | ✅ 完成 | 闪卡模式 AI 配图替代 Pexels，IndexedDB 缓存 24h（v0.8.0） |
| AI 例句生成 | ✅ 完成 | 结构化解生成 + IndexedDB 缓存 30min（v0.8.0） |
| 数据库 schema | ✅ 完成 | 版本 3，新增 imageCache + exampleCache 表 |
| AI 评分移除 | ✅ 完成 v0.8.1 | 表达模式回归关键词匹配评分，去除 AI 依赖 |
| 选择题记录 | ✅ 完成 v0.8.1 | 选择题对错记录到 mistakesService |
| 题目去重 | ✅ 完成 v0.8.1 | 每次新会话排除最近使用单词，只允许 10% 重复 |
| 卡片翻转音效 | ✅ 完成 v0.8.1 | WordCard 组件翻转加音效 |
| 移动端优化 | ✅ 完成 v0.8.1 | 大按钮、safe-area、touch-manipulation、防缩放 |

### 技术栈

Vue 3 + Vite 8 + TailwindCSS 4 + Pinia + Dexie.js + Web Speech API
在线：https://ogden850.netlify.app
GitHub：https://github.com/cctvsbs/ogden850
版本：v0.8.0（开发中）

---

## 二、待完成功能（按优先级）

### 🔴 高优先级

#### 1. 音节 JSON 补完
- 文件：`src/data/ogden850-phonetic.json`
- 大部分单词缺失音节数据，需为 850 个词补充音节划分/音标/重音

#### 2. 动词时态变化表
- 新建 `src/data/ogden850-verbs.json`
- 收录约 150 个动词的时态变化（past/pp/ing/3rd）
- 展示在单词卡片背面

### 🟡 中优先级

#### 3. AI 例句集成展示
- 当前例句生成已就绪（`getAIExamples`），但尚未在前端展示
- 需在 WordCard/Flashcard 背面展示 AI 生成的例句
- 已有静态例句数据，AI 例句作为增强补充

#### 4. 语音本地缓存
- Python 脚本批量生成 edge-tts 音频，前端 IndexedDB 缓存
- 解决 PC Edge 在线语音卡顿

### 🟢 低优先级

#### 5. 闪卡模式图片加载优化 + 离线模式清理
#### 6. 退格音效

---

## 三、API 信息

### Agnes API

```
Base URL: https://apihub.agnes-ai.com/v1
认证: Authorization: Bearer YOUR_API_KEY

文本模型: agnes-2.0-flash (chat/completions)
图像模型: agnes-image-2.1-flash (images/generations)

注意：
- 不支持 system role（通过 user message 传递 system prompt）
- 不支持 response_format 参数
- 不支持 model=agnes-850
```

### 评分 System Prompt

```
你是 Ogden 850 基础英语教学助手。
核心规则：只使用 Ogden 850 词表内的 850 个基础单词；动词时态用操作词替代；始终主动语态；一个词一种意思。
任务：评估中译英翻译质量（语法 30% + 词汇合规 40% + 语义 30%）。
输出：中文简短反馈，包括总分、语法问题、超纲词提示、推荐表达。
```

### 例句生成 Prompt

```
你是 Ogden 850 基础英语教学助手。
只使用 Ogden 850 词表内的单词，句子简短适合初学者。
输出 JSON：{"basic_en": "简单例句英文", "basic_zh": "简单例句中文", "standard_en": "标准例句英文", "standard_zh": "标准例句中文"}
```

---

## 四、AI 评分实现

### 文件：`src/utils/agnes-scoring.js`

```js
export async function scoreWithAgnes(zhPrompt, referenceAnswer, userAnswer)
export function fallbackKeywordScore(answer, keywords)  // 降级
```

### 集成位置：`src/views/PracticeView.vue`

- `submitExpression` 已改为 async
- 新增 `expressionLoading` 状态
- 模板新增 loading 指示器和 "AI 反馈" 标题

---

## 五、AI 配图实现

### 文件：`src/utils/agnes-images.js`

```js
export async function getAIImage(word, chinese)  // 返回 URL 或 null
```

- 替换 PracticeView 中的 Pexels 搜索逻辑
- IndexedDB 缓存 24 小时
- 抽象词跳过

---

## 六、关键文件路径

```
src/
├── composables/          # 8 个 composables（已在组件中引用）
│   useSpeech.js
│   useAudioFeedback.js
│   useSyllableRendering.js
│   useFavorites.js
│   useKeyboardShortcuts.js
│   useWordNavigation.js
│   useFrequencyStars.js
│   useExampleTokens.js
├── utils/
│   agnes-scoring.js      # AI 评分（新）
│   agnes-images.js       # AI 配图（新）
│   agnes-examples.js     # AI 例句（新）
│   posUtils.js
│   ogdenValidator.js
│   dateUtils.js
├── config/
│   persistence.js        # IndexedDB 持久化
│   themes.js
├── data/
│   expressionTasks.js    # 表达训练题库
│   abstractWords.js
│   functionWords.js
│   ogden850.json
│   ogden850-phonetic.json
├── services/
│   storageService.js     # Dexie v3: imageCache + exampleCache
├── stores/words.js
├── views/
│   PracticeView.vue      # AI 评分 + AI 配图集成
│   PhoneticTrainer.vue   # composables 集成
├── components/
│   WordCard.vue          # composables 集成
│   WordList.vue          # composables 集成
└── App.vue
```

---

## 七、下一步建议

建议 Claude 按以下顺序继续：

1. **AI 例句集成展示**：在 WordCard/Flashcard 背面展示 AI 生成的例句
2. **补充动词时态数据**：创建 verbs.json
3. **语音本地缓存**：edge-tts 脚本
4. **退格音效**：拼写/表达模式退格加音效
