#!/usr/bin/env node
/**
 * Create a balanced human evaluation template
 * 60 samples total: 10 samples from each of 6 models
 * Grouped by model for easier evaluation
 */

import fs from "fs/promises";
import path from "path";

const WORKSPACE_DIR = "workspace/batch-1207";
const FSM_RESULTS_FILE = path.join(
  WORKSPACE_DIR,
  "fsm-similarity-results.json"
);
const OUTPUT_FILE = path.join(WORKSPACE_DIR, "human-evaluation-template.json");

async function main() {
  console.log("📊 Loading FSM results...");
  const fsmData = JSON.parse(await fs.readFile(FSM_RESULTS_FILE, "utf-8"));

  // Group samples by model
  const samplesByModel = {};
  fsmData.results.forEach((result) => {
    if (!result.model || result.model === "undefined") return;

    // Use simplified model name
    let modelName = result.model;
    if (modelName.includes("meta-llama")) {
      modelName = "Llama-3.2-1B-Instruct";
    }

    if (!samplesByModel[modelName]) {
      samplesByModel[modelName] = [];
    }
    samplesByModel[modelName].push(result);
  });

  console.log("\n📋 Samples per model:");
  Object.entries(samplesByModel).forEach(([model, samples]) => {
    console.log(`  ${model}: ${samples.length} samples`);
  });

  // Select 10 random samples from each model
  const selectedSamples = [];
  const modelOrder = [
    "gpt-5-mini",
    "gpt-4o-mini",
    "gpt-3.5-turbo",
    "deepseek-chat",
    "Qwen1.5-0.5B-Chat",
    "Llama-3.2-1B-Instruct",
  ];

  console.log("\n🎲 Selecting 10 random samples from each model...");

  modelOrder.forEach((modelName) => {
    const samples = samplesByModel[modelName] || [];

    if (samples.length === 0) {
      console.warn(`⚠️  No samples found for ${modelName}`);
      return;
    }

    // Shuffle and take first 10
    const shuffled = samples.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(10, samples.length));

    console.log(`  ✓ ${modelName}: selected ${selected.length} samples`);

    selectedSamples.push(
      ...selected.map((s) => ({
        ...s,
        displayModel: modelName,
      }))
    );
  });

  console.log(`\n✅ Total selected samples: ${selectedSamples.length}`);

  // Create template structure
  const template = {
    metadata: {
      generatedAt: new Date().toISOString(),
      workspace: "batch-1207",
      totalSamples: selectedSamples.length,
      samplesPerModel: 10,
      modelOrder: modelOrder,
      evaluationCriteria: {
        interactivity: {
          description: "交互性评分 - 页面的交互元素是否完整、响应是否流畅",
          scale: "0-100分",
          guidelines: [
            "0-20分: 几乎无交互或交互完全失效",
            "30-40分: 交互功能严重缺失或大量bug",
            "50-60分: 基本交互可用，但体验较差",
            "70-80分: 交互功能完整，体验良好",
            "90-100分: 交互优秀，流畅且符合直觉",
          ],
        },
        pedagogical_effectiveness: {
          description: "教学效果评分 - 是否能有效帮助理解该CS概念",
          scale: "0-100分",
          guidelines: [
            "0-20分: 完全无法理解或误导性内容",
            "30-40分: 信息不准确或解释不清",
            "50-60分: 基本正确但缺乏深度",
            "70-80分: 清晰准确，有助于理解",
            "90-100分: 优秀的教学设计，深入浅出",
          ],
        },
        visual_quality: {
          description: "视觉质量评分 - 界面设计、可视化效果",
          scale: "0-100分",
          guidelines: [
            "0-20分: 布局混乱或显示错误",
            "30-40分: 视觉效果较差",
            "50-60分: 基本可接受",
            "70-80分: 设计清晰美观",
            "90-100分: 专业级别的视觉设计",
          ],
        },
        overall_quality: {
          description: "综合质量评分 - 整体使用体验",
          scale: "0-100分",
          guidelines: ["考虑所有方面的综合评价", "是否愿意推荐给学习者使用"],
        },
      },
      instructions: [
        "1. 打开对应的HTML文件（路径在htmlPath字段中）",
        "2. 仔细体验交互功能、教学效果和视觉设计",
        "3. 根据评分标准给出四个维度的分数（0-100分）",
        "4. 可以在notes字段记录具体的优点、问题或建议",
        "5. 完成后将completed字段设为true",
        "6. 评估界面已按模型分组，便于对比同一模型的不同样本",
      ],
    },
    samples: [],
  };

  // Add samples with proper structure
  let sampleId = 1;
  selectedSamples.forEach((sample) => {
    const fileId = sample.fileId || sample.fsmFileName.replace(".json", "");

    template.samples.push({
      id: sampleId++,
      fileId: fileId,
      fsmFileName: sample.fsmFileName,
      htmlPath: `html/${fileId}.html`,
      concept: sample.concept,
      conceptCategory: getCategoryForConcept(sample.concept),
      model: sample.displayModel,
      fsm_reference: {
        combined_similarity: sample.similarityResult?.combined_similarity || 0,
        structural_similarity:
          sample.similarityResult?.structural_similarity || {},
        semantic_similarity: sample.similarityResult?.semantic_similarity || {},
        score: Math.round(
          (sample.similarityResult?.combined_similarity || 0) * 100
        ),
        interpretation: getInterpretation(
          sample.similarityResult?.combined_similarity || 0
        ),
      },
      human_evaluation: {
        interactivity_score: null,
        pedagogical_score: null,
        visual_quality_score: null,
        overall_quality_score: null,
        notes: "",
        evaluator: "",
        evaluation_date: "",
        time_spent_minutes: null,
      },
    });
  });

  // Save template
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(template, null, 2), "utf-8");

  console.log(`\n✅ Template created successfully!`);
  console.log(`📄 Saved to: ${OUTPUT_FILE}`);
  console.log(`\n📊 Sample distribution by model:`);

  const distribution = {};
  template.samples.forEach((s) => {
    distribution[s.model] = (distribution[s.model] || 0) + 1;
  });

  Object.entries(distribution).forEach(([model, count]) => {
    console.log(`  ${model}: ${count} samples`);
  });
}

function getCategoryForConcept(concept) {
  const normalized = concept.toLowerCase();

  const categories = {
    "Data Structures": [
      "array",
      "stack",
      "queue",
      "linked list",
      "deque",
      "hash",
      "heap",
      "tree",
      "set",
      "trie",
      "graph",
      "priority queue",
      "union-find",
      "disjoint",
    ],
    "Sorting Algorithms": [
      "sort",
      "bubble",
      "insertion",
      "selection",
      "merge",
      "quick",
      "heap sort",
      "counting",
    ],
    "Searching Algorithms": ["search", "binary search", "linear search"],
    "Graph Algorithms": [
      "graph",
      "bfs",
      "dfs",
      "dijkstra",
      "bellman",
      "prim",
      "kruskal",
      "floyd",
      "warshall",
      "topological",
    ],
    "Advanced Algorithms": [
      "dynamic",
      "knapsack",
      "subsequence",
      "recursion",
      "divide and conquer",
      "backtrack",
      "greedy",
      "fibonacci",
      "huffman",
      "sliding window",
      "two pointer",
    ],
    "Machine Learning": [
      "regression",
      "neural",
      "machine learning",
      "classification",
    ],
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return category;
    }
  }

  return "Other";
}

function getInterpretation(score) {
  if (score >= 0.8) return "Very High - FSMs are nearly identical";
  if (score >= 0.6) return "High - FSMs are quite similar";
  if (score >= 0.4) return "Moderate - FSMs share some similarities";
  if (score >= 0.2) return "Low - FSMs have few similarities";
  return "Very Low - FSMs are quite different";
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
