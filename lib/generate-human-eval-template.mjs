#!/usr/bin/env node
/**
 * Generate Human Evaluation Template
 * 从实验结果中随机选取样本，生成人工评估模板
 */

import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 随机选取样本
 */
function randomSample(array, sampleSize) {
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, sampleSize);
}

/**
 * 对CS概念进行分类
 */
function categorizeConcept(concept) {
  const dataStructures = [
    "Array",
    "Linked List",
    "Stack",
    "Queue",
    "Deque",
    "Hash Table",
    "Hash Map",
    "Set",
    "Binary Tree",
    "Binary Search Tree",
    "BST",
    "Red-Black Tree",
    "Heap",
    "Graph",
    "Weighted Graph",
    "Adjacency Matrix",
    "Adjacency List",
    "Union-Find",
    "Disjoint Set",
    "Priority Queue",
  ];

  const sortingAlgorithms = [
    "Bubble Sort",
    "Selection Sort",
    "Insertion Sort",
    "Merge Sort",
    "Quick Sort",
    "Heap Sort",
    "Counting Sort",
    "Radix Sort",
  ];

  const searchingAlgorithms = [
    "Linear Search",
    "Binary Search",
    "Depth-First Search",
    "DFS",
    "Breadth-First Search",
    "BFS",
  ];

  const graphAlgorithms = [
    "Dijkstra",
    "Bellman-Ford",
    "Floyd-Warshall",
    "Kruskal",
    "Prim",
    "Topological Sort",
  ];

  const advancedAlgorithms = [
    "Fibonacci",
    "Knapsack",
    "Longest Common Subsequence",
    "Huffman Coding",
    "Recursion",
    "Divide and Conquer",
    "Sliding Window",
    "Two Pointers",
  ];

  const machineLearning = [
    "Linear Regression",
    "K-Nearest Neighbors",
    "KNN",
    "K-Means Clustering",
  ];

  const conceptLower = concept.toLowerCase();

  if (dataStructures.some((ds) => conceptLower.includes(ds.toLowerCase()))) {
    return "Data Structures";
  } else if (
    sortingAlgorithms.some((sa) => conceptLower.includes(sa.toLowerCase()))
  ) {
    return "Sorting Algorithms";
  } else if (
    searchingAlgorithms.some((sa) => conceptLower.includes(sa.toLowerCase()))
  ) {
    return "Searching Algorithms";
  } else if (
    graphAlgorithms.some((ga) => conceptLower.includes(ga.toLowerCase()))
  ) {
    return "Graph Algorithms";
  } else if (
    machineLearning.some((ml) => conceptLower.includes(ml.toLowerCase()))
  ) {
    return "Machine Learning";
  } else if (
    advancedAlgorithms.some((aa) => conceptLower.includes(aa.toLowerCase()))
  ) {
    return "Advanced Algorithms";
  }

  return "Other";
}

/**
 * 生成人工评估模板
 */
async function generateHumanEvalTemplate(workspaceName, sampleSize = 50) {
  const workspacePath = path.join("workspace", workspaceName);
  const resultsPath = path.join(workspacePath, "fsm-similarity-results.json");
  const dataDir = path.join(workspacePath, "data");
  const htmlDir = path.join(workspacePath, "html");

  console.log(`
╔════════════════════════════════════════════════════════════════════════╗
║  Human Evaluation Template Generator - 人工评估模板生成器              ║
╚════════════════════════════════════════════════════════════════════════╝

工作空间: ${workspaceName}
样本数量: ${sampleSize}
`);

  // 读取FSM相似度结果
  const resultsContent = await fs.readFile(resultsPath, "utf-8");
  const results = JSON.parse(resultsContent);

  // 获取所有成功的结果
  const successfulResults = results.results.filter(
    (r) => r.success && r.matched
  );
  console.log(`✅ 可用样本数: ${successfulResults.length}`);

  // 按模型和概念类别分层抽样，确保代表性
  const modelGroups = {};

  for (const result of successfulResults) {
    const fileId = result.fsmFileName.replace(".json", "");
    const dataFilePath = path.join(dataDir, `${fileId}.json`);

    try {
      const dataContent = await fs.readFile(dataFilePath, "utf-8");
      const dataFile = JSON.parse(dataContent);
      const model = dataFile.model || "unknown";

      if (!modelGroups[model]) {
        modelGroups[model] = [];
      }

      modelGroups[model].push({
        ...result,
        model,
        category: categorizeConcept(result.concept),
        fileId,
      });
    } catch (error) {
      // 跳过无法读取的文件
    }
  }

  console.log("\n📊 各模型可用样本数:");
  Object.entries(modelGroups).forEach(([model, samples]) => {
    console.log(`  ${model}: ${samples.length} 个`);
  });

  // 分层随机抽样：每个模型抽取相同比例的样本
  let selectedSamples = [];
  const samplesPerModel = Math.ceil(
    sampleSize / Object.keys(modelGroups).length
  );

  for (const [model, samples] of Object.entries(modelGroups)) {
    const modelSamples = randomSample(
      samples,
      Math.min(samplesPerModel, samples.length)
    );
    selectedSamples.push(...modelSamples);
  }

  // 如果样本不足，补充随机样本
  if (selectedSamples.length < sampleSize) {
    const allSamples = Object.values(modelGroups).flat();
    const remaining = randomSample(
      allSamples.filter((s) => !selectedSamples.includes(s)),
      sampleSize - selectedSamples.length
    );
    selectedSamples.push(...remaining);
  } else if (selectedSamples.length > sampleSize) {
    selectedSamples = randomSample(selectedSamples, sampleSize);
  }

  console.log(`\n🎲 已随机选取 ${selectedSamples.length} 个样本`);

  // 生成人工评估模板
  const evaluationTemplate = {
    metadata: {
      generatedAt: new Date().toISOString(),
      workspace: workspaceName,
      totalSamples: selectedSamples.length,
      evaluationCriteria: {
        interactivity: {
          description: "交互性评分 - 页面的交互元素是否完整、响应是否流畅",
          scale: "0-10分",
          guidelines: [
            "0-2分: 几乎无交互或交互完全失效",
            "3-4分: 交互功能严重缺失或大量bug",
            "5-6分: 基本交互可用，但体验较差",
            "7-8分: 交互功能完整，体验良好",
            "9-10分: 交互优秀，流畅且符合直觉",
          ],
        },
        pedagogical_effectiveness: {
          description: "教学效果评分 - 是否能有效帮助理解该CS概念",
          scale: "0-10分",
          guidelines: [
            "0-2分: 完全无法理解或误导性内容",
            "3-4分: 信息不准确或解释不清",
            "5-6分: 基本正确但缺乏深度",
            "7-8分: 清晰准确，有助于理解",
            "9-10分: 优秀的教学设计，深入浅出",
          ],
        },
        visual_quality: {
          description: "视觉质量评分 - 界面设计、可视化效果",
          scale: "0-10分",
          guidelines: [
            "0-2分: 布局混乱或显示错误",
            "3-4分: 视觉效果较差",
            "5-6分: 基本可接受",
            "7-8分: 设计清晰美观",
            "9-10分: 专业级别的视觉设计",
          ],
        },
        overall_quality: {
          description: "综合质量评分 - 整体使用体验",
          scale: "0-10分",
          guidelines: ["考虑所有方面的综合评价", "是否愿意推荐给学习者使用"],
        },
      },
      instructions: [
        "1. 打开对应的HTML文件（路径在htmlPath字段中）",
        "2. 充分测试页面的所有交互功能",
        "3. 根据评分标准对每个维度进行打分（0-10分）",
        "4. 在notes字段中记录观察到的优点和问题",
        "5. 完成后保存为 human-evaluation-results.json",
      ],
    },
    samples: selectedSamples.map((sample, index) => ({
      id: index + 1,
      fileId: sample.fileId,
      fsmFileName: sample.fsmFileName,
      htmlPath: `html/${sample.fileId}.html`,
      concept: sample.concept,
      conceptCategory: sample.category,
      model: sample.model,

      // FSM自动评估结果（仅供参考，不影响人工打分）
      fsm_reference: {
        combined_similarity: sample.similarityResult.combined_similarity,
        structural_similarity:
          sample.similarityResult.structural_similarity.overall,
        semantic_similarity:
          sample.similarityResult.semantic_similarity.overall,
        score: sample.summary.score,
        interpretation: sample.summary.interpretation,
      },

      // 人工评估字段（待填写）
      human_evaluation: {
        interactivity_score: null, // 0-10
        pedagogical_score: null, // 0-10
        visual_quality_score: null, // 0-10
        overall_quality_score: null, // 0-10
        notes: "", // 观察记录
        evaluator: "", // 评估人员姓名
        evaluation_date: "", // 评估日期
        time_spent_minutes: null, // 评估用时（分钟）
      },
    })),
  };

  // 保存评估模板
  const templatePath = path.join(
    workspacePath,
    "human-evaluation-template.json"
  );
  await fs.writeFile(templatePath, JSON.stringify(evaluationTemplate, null, 2));

  console.log(`\n✅ 人工评估模板已生成: ${templatePath}`);

  // 生成统计摘要
  const categoryCounts = {};
  const modelCounts = {};

  selectedSamples.forEach((sample) => {
    categoryCounts[sample.category] =
      (categoryCounts[sample.category] || 0) + 1;
    modelCounts[sample.model] = (modelCounts[sample.model] || 0) + 1;
  });

  console.log("\n📊 样本分布:");
  console.log("\n  按概念类别:");
  Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      console.log(`    ${cat}: ${count} 个`);
    });

  console.log("\n  按模型:");
  Object.entries(modelCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([model, count]) => {
      console.log(`    ${model}: ${count} 个`);
    });

  // 生成简化的评估checklist
  const checklistPath = path.join(
    workspacePath,
    "human-evaluation-checklist.md"
  );
  const checklist = `# Human Evaluation Checklist

## 评估说明
- 总样本数: ${selectedSamples.length}
- 评估标准: 每个维度 0-10 分
- 预计用时: ${Math.ceil(selectedSamples.length * 3)} - ${Math.ceil(
    selectedSamples.length * 5
  )} 分钟

## 评估流程
1. 打开 \`${templatePath}\`
2. 依次打开每个样本的 HTML 文件
3. 测试所有交互功能
4. 在 \`human_evaluation\` 字段中填写分数
5. 保存为 \`human-evaluation-results.json\`

## 快速评估清单

${selectedSamples
  .map(
    (sample, i) => `
### ${i + 1}. ${sample.concept} (${sample.model})
- [ ] 文件: \`${sample.fileId}.html\`
- [ ] 类别: ${sample.category}
- [ ] FSM参考分: ${sample.summary.score}/100
- [ ] 交互性评分: ___/10
- [ ] 教学效果评分: ___/10
- [ ] 视觉质量评分: ___/10
- [ ] 综合评分: ___/10
- [ ] 备注: ___________
`
  )
  .join("\n")}

## 评分标准快速参考

### 交互性 (Interactivity)
- **9-10**: 交互优秀，流畅且符合直觉
- **7-8**: 交互功能完整，体验良好
- **5-6**: 基本交互可用，但体验较差
- **3-4**: 交互功能严重缺失或大量bug
- **0-2**: 几乎无交互或交互完全失效

### 教学效果 (Pedagogical Effectiveness)
- **9-10**: 优秀的教学设计，深入浅出
- **7-8**: 清晰准确，有助于理解
- **5-6**: 基本正确但缺乏深度
- **3-4**: 信息不准确或解释不清
- **0-2**: 完全无法理解或误导性内容

### 视觉质量 (Visual Quality)
- **9-10**: 专业级别的视觉设计
- **7-8**: 设计清晰美观
- **5-6**: 基本可接受
- **3-4**: 视觉效果较差
- **0-2**: 布局混乱或显示错误

### 综合质量 (Overall Quality)
- 考虑所有方面的综合评价
- 是否愿意推荐给学习者使用
`;

  await fs.writeFile(checklistPath, checklist);
  console.log(`\n📝 评估清单已生成: ${checklistPath}`);

  console.log(`
\n╔════════════════════════════════════════════════════════════════════════╗
║  下一步操作                                                             ║
╚════════════════════════════════════════════════════════════════════════╝

1. 📋 查看评估模板: ${templatePath}
2. ✍️  参考清单进行评估: ${checklistPath}
3. 💾 完成后保存结果为: human-evaluation-results.json

建议评估方式:
- 可以多人分工评估，每人评估一部分
- 评估时打开HTML文件充分测试
- 记录具体的优点和问题以便后续分析
`);

  return {
    templatePath,
    checklistPath,
    sampleCount: selectedSamples.length,
    categoryCounts,
    modelCounts,
  };
}

// 命令行参数处理
function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
用法: node generate-human-eval-template.mjs <workspace-name> [sample-size]

参数:
  <workspace-name>    工作空间名称
  [sample-size]       样本数量 (默认: 50)

示例:
  node generate-human-eval-template.mjs batch-1207
  node generate-human-eval-template.mjs batch-1207 60
    `);
    process.exit(0);
  }

  return {
    workspaceName: args[0],
    sampleSize: parseInt(args[1]) || 50,
  };
}

// 主函数
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { workspaceName, sampleSize } = parseArgs();

  generateHumanEvalTemplate(workspaceName, sampleSize)
    .then((result) => {
      console.log("\n🎉 人工评估模板生成完成！");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 生成失败:", error.message);
      console.error(error.stack);
      process.exit(1);
    });
}

export default generateHumanEvalTemplate;
