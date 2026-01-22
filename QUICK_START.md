# ⚡ 快速开始 - Embedding-Based Evaluation

## 🎯 当前状态

✅ 代码已完成修改  
⚠️ Endpoint 需要启动  
⬜ 准备运行测试

---

## 📋 实施步骤总结

### 已完成的修改

1. **lib/ai-api.mjs**
   - ✅ 添加 `EMBEDDING_ENDPOINT` 配置
   - ✅ 添加 `getEmbedding()` 函数
   - ✅ 添加 `cosineSimilarity()` 函数
   - ✅ 添加 `getAverageEmbedding()` 函数

2. **lib/fsm-similarity.mjs**
   - ✅ 导入 embedding 函数
   - ✅ 修改 `computeSemanticSimilarity()` 为异步
   - ✅ 使用 embedding 计算语义相似度
   - ✅ 修改 `compareFSMs()` 为异步
   - ✅ 保留原方法作为 fallback

3. **batch-similarity-eval.mjs**
   - ✅ 添加 `await` 调用 `compareFSMs()`

4. **测试脚本**
   - ✅ 创建 `test-embedding.mjs`

---

## 🚀 启动 HuggingFace Endpoint

### 方法 1: Web 界面（推荐）

1. 访问 [HuggingFace Endpoints](https://ui.endpoints.huggingface.co/)
2. 找到你的 embedding endpoint
3. 点击 **"Resume"** 或 **"Restart"** 按钮
4. 等待状态变为 **"Running"** (绿色)

### 方法 2: API 方式

```bash
# 使用 HuggingFace CLI
huggingface-cli endpoint resume <endpoint-name>

# 或直接访问控制台
# https://ui.endpoints.huggingface.co/
```

---

## ✅ 验证步骤

### Step 1: 测试 Embedding API

```bash
node test-embedding.mjs
```

**成功输出示例：**

```
🧪 Testing Embedding API...

Test 1: Single text embedding
✅ Text: "Bubble Sort"
   Embedding dimension: 384
   Sample values: [0.0234, -0.1567, 0.0891, ...]

🎉 All tests passed!
```

### Step 2: 小规模测试

先测试几个样本确保工作正常：

```bash
# 创建测试目录
mkdir -p workspace/test-embedding

# 复制几个 FSM 文件
cp workspace/batch-1207/fsm/0ba73d90-d5b2-11f0-b169-abe023d0d932.json workspace/test-embedding/fsm/
cp workspace/batch-1207/data/0ba73d90-d5b2-11f0-b169-abe023d0d932.json workspace/test-embedding/data/
# ... 复制 3-5 个样本

# 复制 ideal-fsm
cp -r workspace/batch-1207/ideal-fsm workspace/test-embedding/

# 运行测试
node batch-similarity-eval.mjs test-embedding
```

### Step 3: 全量评估

确认无误后运行完整评估：

```bash
node batch-similarity-eval.mjs batch-1207
```

**预计时间：** 20-30 分钟 (取决于样本数量)

---

## 📊 预期输出变化

### 旧输出 (规则-based)

```json
{
  "semantic_similarity": {
    "state_category_similarity": 0.75,
    "event_type_similarity": 0.68,
    "action_similarity": 0.72,
    "metadata_similarity": 0.85,
    "overall": 0.75
  }
}
```

### 新输出 (Embedding-based)

```json
{
  "semantic_similarity": {
    "state_embedding_similarity": 0.82,
    "action_embedding_similarity": 0.78,
    "event_embedding_similarity": 0.8,
    "metadata_embedding_similarity": 0.88,
    "category_distribution_similarity": 0.75,
    "overall": 0.82
  }
}
```

**关键差异：**

- 新增 `_embedding_similarity` 字段
- `category_distribution_similarity` 作为辅助特征保留
- `overall` 基于 embedding 计算（通常更高）

---

## 🔧 常见问题

### Q1: Endpoint 一直显示 "Paused"

**A**:

1. 访问 HuggingFace 控制台手动启动
2. 检查账户配额是否用完
3. 考虑升级到付费计划

### Q2: 测试时出现 timeout

**A**:

```bash
# 增加超时时间
export NODE_OPTIONS="--max-http-header-size=80000"
node test-embedding.mjs
```

### Q3: Embedding API 返回 401 Unauthorized

**A**: 检查 `.env` 文件：

```bash
# 确保 token 正确
echo $Xiaozao_HF_TOKEN

# 或者手动设置
export Xiaozao_HF_TOKEN="hf_xxxxxxxxxxxxx"
```

### Q4: 相似度计算很慢

**A**: 这是正常的，因为：

- 每个 FSM 需要多次 API 调用
- HuggingFace endpoint 有速率限制
- 考虑添加缓存机制（见优化建议）

---

## 🎨 性能优化（可选）

### 添加 Embedding 缓存

在 `lib/fsm-similarity.mjs` 添加：

```javascript
// 在文件顶部
const embeddingCache = new Map();

// 修改 helper 函数
async function getCachedEmbedding(texts) {
  const key = JSON.stringify(texts);
  if (embeddingCache.has(key)) {
    return embeddingCache.get(key);
  }
  const emb = await getAverageEmbedding(texts);
  embeddingCache.set(key, emb);
  return emb;
}

// 在 computeSemanticSimilarity 中使用
const stateEmb1 = await getCachedEmbedding(state1Labels);
```

### 批量优化

```javascript
// 批量获取所有 embeddings
const allTexts = [...state1Labels, ...state2Labels, ...actions1, ...actions2];
const allEmbeddings = await getEmbedding(allTexts);

// 分配到各个组
const stateEmb1 = allEmbeddings.slice(0, state1Labels.length);
// ...
```

---

## 📈 结果对比

运行完成后，对比新旧方法：

```bash
# 备份旧结果
cp workspace/batch-1207/fsm-similarity-results.json results_old.json

# 运行新方法
node batch-similarity-eval.mjs batch-1207

# 对比
node -e "
const old = require('./results_old.json');
const newR = require('./workspace/batch-1207/fsm-similarity-results.json');
console.log('Old avg:', old.stats.avgSimilarity);
console.log('New avg:', newR.stats.avgSimilarity);
"
```

---

## 📝 论文写作素材

### 方法描述

```
We enhanced the semantic similarity component by replacing rule-based
categorization with pre-trained sentence embeddings. Specifically, we:

1. Deployed sentence-transformers/all-MiniLM-L6-v2 on HuggingFace Inference
2. Computed embeddings for states, actions, events, and metadata
3. Used cosine similarity to measure semantic alignment
4. Retained category distribution as an auxiliary feature

This hybrid approach combines structural graph metrics with semantic
understanding, enabling more nuanced evaluation of FSM quality.
```

### 实验设置

```
- Embedding Model: sentence-transformers/all-MiniLM-L6-v2
- Embedding Dimension: 384
- Similarity Metric: Cosine Similarity
- Semantic Weight: 40% (unchanged)
- Fallback: Rule-based methods for API failures
- Evaluation Dataset: 219 FSM samples across 5 LLM models
```

---

## ✅ 检查清单

- [ ] HuggingFace Endpoint 已启动
- [ ] `Xiaozao_HF_TOKEN` 已设置
- [ ] `test-embedding.mjs` 测试通过
- [ ] 小规模测试 (3-5 样本) 成功
- [ ] 全量评估完成
- [ ] 结果对比分析完成
- [ ] 论文相关章节已更新

---

## 🎯 下一步行动

1. **立即执行**: 启动 HuggingFace Endpoint
2. **验证**: 运行 `node test-embedding.mjs`
3. **测试**: 小规模样本测试
4. **评估**: 运行 `node batch-similarity-eval.mjs batch-1207`
5. **分析**: 对比新旧方法结果
6. **撰写**: 更新论文方法章节

---

## 📞 需要帮助？

如果遇到问题：

1. 检查本文档的"常见问题"部分
2. 查看 `EMBEDDING_GUIDE.md` 的详细说明
3. 运行 `test-embedding.mjs` 诊断
4. 检查 HuggingFace 控制台状态

祝评估顺利！🚀
