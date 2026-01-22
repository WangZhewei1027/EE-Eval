# 🔄 Embedding-Based FSM Similarity Evaluation

## 📋 改进说明

我们将 FSM 相似度评估的 **Semantic Similarity** 模块从基于规则的方法升级为基于 **Embedding** 的方法。

### 改进对比

| 维度             | 原方法             | 新方法 (Embedding-based) |
| ---------------- | ------------------ | ------------------------ |
| **状态相似度**   | 硬编码分类规则     | 语义 embedding 向量      |
| **动作相似度**   | Jaccard 集合相似度 | Embedding cosine 相似度  |
| **事件相似度**   | 关键词匹配         | Embedding cosine 相似度  |
| **元数据相似度** | 编辑距离           | Embedding cosine 相似度  |
| **优势**         | 快速、确定性       | 语义化、更准确、无需规则 |

---

## 🚀 使用步骤

### 1. 测试 Embedding API

```bash
node test-embedding.mjs
```

**预期输出：**

```
🧪 Testing Embedding API...

Test 1: Single text embedding
✅ Text: "Bubble Sort"
   Embedding dimension: 384
   Sample values: [0.0234, -0.1567, 0.0891, ...]

Test 4: Cosine similarity
✅ Similarity between "Bubble Sort" and "Sorting Algorithm": 0.8234
   Similarity between "Bubble Sort" and "Binary Search": 0.6789
```

### 2. 运行 FSM 相似度评估

```bash
node batch-similarity-eval.mjs batch-1207
```

**新增输出：**

```
⚡ 计算相似度 (使用 embedding)...
Normalizing FSMs...
Computing structural similarity...
Computing semantic similarity with embeddings...
Computing isomorphism similarity...
✅ [Task-001] xxx.json - 相似度: 78%
   📊 结构: 75% | 语义: 82% | 同构: 0%
```

### 3. 查看结果

结果保存在 `workspace/batch-1207/fsm-similarity-results.json`，新增字段：

```json
{
  "semantic_similarity": {
    "state_embedding_similarity": 0.82,
    "action_embedding_similarity": 0.78,
    "event_embedding_similarity": 0.85,
    "metadata_embedding_similarity": 0.9,
    "category_distribution_similarity": 0.75,
    "overall": 0.8375
  }
}
```

---

## 🔧 配置说明

### 环境变量

在 `.env` 文件中确保设置：

```bash
# HuggingFace Token (Xiaozao 或你的 token)
Xiaozao_HF_TOKEN=hf_xxxxxxxxxxxxx
```

### Embedding Endpoint

在 `lib/ai-api.mjs` 中配置：

```javascript
const EMBEDDING_ENDPOINT = {
  baseURL: "https://twkgcktmy8nvnxvy.us-east-1.aws.endpoints.huggingface.cloud",
  apiKey: process.env.Xiaozao_HF_TOKEN,
};
```

---

## 📊 技术细节

### Embedding 模型

- **模型**: `sentence-transformers/all-MiniLM-L6-v2`
- **维度**: 384
- **优势**:
  - 快速 (适合批量评估)
  - 高质量语义表示
  - 支持多语言

### 相似度计算

```javascript
// 1. 提取文本
const states = fsm.nodes.map((n) => n.label); // ["Idle", "Compare", "Swap"]

// 2. 获取 embedding
const embedding = await getAverageEmbedding(states);

// 3. 计算余弦相似度
const similarity = cosineSimilarity(embedding1, embedding2);
```

### Fallback 机制

如果 embedding API 失败，自动回退到原有方法：

```javascript
const stateEmbSim =
  stateEmb1 && stateEmb2
    ? cosineSimilarity(stateEmb1, stateEmb2)
    : computeStateCategorySimilarity(fsm1, fsm2); // Fallback
```

---

## 📈 预期改进

### 1. 更高的语义准确性

**示例：**

- 原方法: "Idle" vs "Start" → 不同分类 → 低相似度
- Embedding: "Idle" vs "Start" → 语义相近 → 高相似度

### 2. 更好的模型区分度

- 能更细致地区分不同模型生成的 FSM 质量
- 减少因命名差异导致的误判

### 3. 跨领域适应性

- 不依赖硬编码规则
- 自动适应不同类型的教学概念

---

## 🧪 验证方法

### 对比实验

可以运行两个版本的评估：

```bash
# 原方法 (备份)
git stash
node batch-similarity-eval.mjs batch-1207
cp workspace/batch-1207/fsm-similarity-results.json results_old.json

# 新方法 (embedding)
git stash pop
node batch-similarity-eval.mjs batch-1207
cp workspace/batch-1207/fsm-similarity-results.json results_new.json

# 对比
node compare-methods.mjs results_old.json results_new.json
```

### 关键指标

1. **平均相似度变化**: 预期略有提升
2. **标准差变化**: 预期降低（更一致）
3. **与人工评分相关性**: 预期提升

---

## ⚠️ 注意事项

### 1. API 限速

HuggingFace Endpoint 有请求限制，建议：

- 使用并发限制 (`ConcurrencyLimiter`)
- 批量处理时间较长（预计 20-30 分钟）

### 2. 成本考虑

- HuggingFace Inference Endpoint 按计算时间收费
- 建议在小批量测试后再大规模运行

### 3. 缓存优化（可选）

可以添加 embedding 缓存避免重复计算：

```javascript
const embeddingCache = new Map();

async function getCachedEmbedding(text) {
  if (embeddingCache.has(text)) {
    return embeddingCache.get(text);
  }
  const emb = await getEmbedding(text);
  embeddingCache.set(text, emb);
  return emb;
}
```

---

## 📝 论文写作建议

### 方法描述

> "To enhance semantic similarity computation, we replaced rule-based state categorization with pre-trained sentence embeddings (sentence-transformers/all-MiniLM-L6-v2). This approach captures deeper semantic relationships beyond surface-level string matching, enabling more accurate assessment of FSM conceptual alignment."

### 技术优势

1. **Learning-based vs Rule-based**: 从硬编码规则到学习语义表示
2. **Domain-agnostic**: 不依赖特定领域的分类规则
3. **Robust to variations**: 对命名变体更鲁棒

### 实验设置

```
- Embedding Model: sentence-transformers/all-MiniLM-L6-v2
- Embedding Dimension: 384
- Similarity Metric: Cosine Similarity
- Fallback: Rule-based methods for API failures
```

---

## 🎯 下一步

1. ✅ 测试 Embedding API (`node test-embedding.mjs`)
2. ✅ 小规模测试 (10-20 个样本)
3. ⬜ 对比新旧方法结果
4. ⬜ 大规模评估 (batch-1207 全部样本)
5. ⬜ 分析改进效果
6. ⬜ 撰写论文相关章节

---

## 🐛 故障排查

### 问题 1: Embedding API 返回空

**原因**: Endpoint 未启动或配置错误

**解决**:

```bash
# 检查 endpoint 状态
curl -X POST https://twkgcktmy8nvnxvy.us-east-1.aws.endpoints.huggingface.cloud \
  -H "Authorization: Bearer $Xiaozao_HF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"inputs": ["test"]}'
```

### 问题 2: 相似度为 0

**原因**: Embedding 向量维度不匹配或为空

**解决**: 检查 `test-embedding.mjs` 输出，确认向量正常

### 问题 3: 运行时间过长

**原因**: 批量 API 调用

**解决**:

- 减少并发数 (`ConcurrencyLimiter` 参数)
- 使用缓存机制

---

## 📞 技术支持

如遇问题，检查：

1. `.env` 文件中的 `Xiaozao_HF_TOKEN`
2. Embedding endpoint URL
3. HuggingFace 账户状态和配额
4. `test-embedding.mjs` 测试结果
