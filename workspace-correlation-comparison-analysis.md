# Workspace Correlation Comparison Analysis

## 问题总结

两个workspace的correlation结果差异巨大，特别是FSM从正相关变成了负相关。

---

## 数据对比

### 1. **样本量**

- **0126-biased**: N=77
- **0126-balanced**: N=87

### 2. **FSM Score Distribution (Raw)**

```
0126-biased:
  Count: 1708
  Range: [0.5293, 1.0000]
  Mean: 0.8063
  Median: 0.8107

0126-balanced:
  Count: 663
  Range: [0.5215, 1.0000]
  Mean: 0.8088
  Median: 0.8351
```

### 3. **Correlation Results**

| Framework      | Dimension     | 0126-biased  | 0126-balanced | Difference    |
| -------------- | ------------- | ------------ | ------------- | ------------- |
| **FSM**        | Functional    | **+0.298** ✓ | **-0.231** ✗  | **-0.529** ⚠️ |
|                | Visual        | +0.044       | -0.263        | -0.307        |
|                | Interactivity | **+0.299** ✓ | **-0.264** ✗  | **-0.563** ⚠️ |
|                | Pedagogical   | **+0.329** ✓ | -0.099        | **-0.428** ⚠️ |
|                | **Overall**   | **+0.297** ✓ | **-0.223** ✗  | **-0.520** ⚠️ |
| **VLM**        | Functional    | +0.186       | **+0.562\***  | +0.376 ⬆️     |
|                | Visual        | **+0.608\*** | **+0.670\***  | +0.062        |
|                | Interactivity | +0.031       | **+0.547\***  | +0.516 ⬆️     |
|                | Pedagogical   | +0.057       | **+0.608\***  | +0.551 ⬆️     |
|                | **Overall**   | **+0.258\*** | **+0.619\***  | +0.361 ⬆️     |
| **Playwright** | Functional    | -0.189       | **-0.573\***  | -0.384 ⬇️     |
|                | Visual        | **-0.298**   | **-0.626\***  | -0.328 ⬇️     |
|                | Interactivity | -0.090       | **-0.592\***  | -0.502 ⬇️     |
|                | Pedagogical   | +0.029       | **-0.483\***  | -0.512 ⬇️     |
|                | **Overall**   | -0.162       | **-0.591\***  | -0.429 ⬇️     |

---

## 核心问题分析

### 🔴 问题1: FSM Normalization的局限性

**当前代码的问题：**

```javascript
// 当前实现：基于单个workspace的min-max normalization + inversion
const minScore = Math.min(...averages); // 0126-biased: 0.4605, balanced: 0.5215
const maxScore = Math.max(...averages); // 两者都是1.0000
const normalized = (score - minScore) / range;
const inverted = 1 - normalized;
```

**问题所在：**

1. **不同workspace的min/max不同**，导致normalization标准不一致
2. **0126-biased**: range = 1.0000 - 0.4605 = 0.5395
3. **0126-balanced**: range = 1.0000 - 0.5215 = 0.4785
4. 相同的raw score在两个workspace中会被normalize成**不同的值**！

**举例：**

- 原始分数 0.85:
  - 在biased中: normalized = (0.85-0.4605)/0.5395 = 0.723 → inverted = 0.277
  - 在balanced中: normalized = (0.85-0.5215)/0.4785 = 0.686 → inverted = 0.314
- 同样的FSM score，在balanced中被认为"质量更低"！

### 🔴 问题2: Inversion假设的有效性问题

**Inversion的假设：** "高FSM相似度 = 低质量"

这个假设在**0126-biased**中成立（因此correlation变正），但在**0126-balanced**中**不成立**（因此correlation仍为负）！

**可能原因：**

1. **0126-balanced**的数据分布更加合理，包含了真正高质量且高相似度的样本
2. **0126-biased**可能有data bias，导致高相似度样本质量反而差
3. FSM similarity本身可能就不是quality的good predictor

### 🟢 问题3: VLM在balanced中表现更好

VLM在0126-balanced中的correlation大幅提升：

- Overall: 0.258\* → **0.619\***
- 所有维度都达到了moderate to strong correlation (0.547-0.670)

**说明：**

- 0126-balanced的数据质量更好
- 样本分布更合理，能更好地反映VLM的真实预测能力

### 🔴 问题4: Playwright在balanced中负相关更强

Playwright的负相关在balanced中变得非常显著：

- Overall: -0.162 → **-0.591\***

**原因：**

- Playwright用的是**model-level**分数（所有同一模型的HTML得分相同）
- 这种粗粒度评分无法区分individual sample quality
- 在更balanced的数据中，这个问题更明显

---

## 🎯 根本原因

### 1. **FSM Normalization不应该per-workspace**

当前的min-max normalization依赖于每个workspace的score分布，导致：

- 不同workspace之间结果不可比较
- 相同的raw score被映射到不同的normalized value
- Correlation方向完全翻转

### 2. **Inversion假设不可靠**

"高相似度=低质量"这个假设：

- 在某些数据集中偶然成立（biased）
- 在另一些数据集中不成立（balanced）
- 本质上这是错误的假设：FSM similarity应该反映的是**结构一致性**，不是**绝对质量**

### 3. **数据分布差异**

- **0126-biased**: 可能包含更多edge cases，数据质量分布不均
- **0126-balanced**: 数据分布更合理，质量梯度更清晰

---

## ✅ 解决方案

### 方案1: 使用全局normalization（推荐）

```javascript
// 在所有workspace上统一normalization标准
const GLOBAL_FSM_MIN = 0.46; // 从所有数据中统计
const GLOBAL_FSM_MAX = 1.0;
const normalized = (score - GLOBAL_FSM_MIN) / (GLOBAL_FSM_MAX - GLOBAL_FSM_MIN);
// 不要invert！
```

### 方案2: 移除inversion

```javascript
// 直接使用normalized score，不要invert
// 让数据自己说话，看correlation是正还是负
const normalized = (score - minScore) / range;
```

### 方案3: 使用raw FSM score

```javascript
// 完全不normalize，直接使用原始的average score
// 这样至少在不同workspace间是一致的
const fsmScore = (structural + semantic + isomorphism) / 3;
```

---

## 📊 建议的下一步

1. **重新运行分析，使用方案2（移除inversion）**
   - 看看两个workspace的FSM correlation方向是否一致
2. **检查数据质量**
   - 0126-biased vs 0126-balanced的差异是什么？
   - 为什么叫"biased"和"balanced"？
3. **使用instance-level Playwright scores**
   - 当前的model-level分数太粗糙
   - 应该使用每个HTML文件的实际test pass rate

4. **深入分析FSM**
   - FSM similarity到底在测量什么？
   - 它跟quality的真实关系是什么？
   - 也许需要重新思考FSM evaluation的意义

---

## 🏁 结论

**数据没有错，问题在于normalization方法不合理：**

1. ❌ **Per-workspace min-max normalization** 导致不同workspace结果不可比
2. ❌ **Inversion假设** (高相似度=低质量) 在某些数据上偶然成立，但不可靠
3. ✅ **VLM的强相关** (尤其在balanced中) 说明数据本身是可靠的
4. ⚠️ **Playwright的model-level分数** 太粗糙，无法capture individual quality

**建议：移除FSM的inversion，使用一致的normalization标准，让数据自己说话。**
