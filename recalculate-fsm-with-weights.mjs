#!/usr/bin/env node

/**
 * FSM Similarity Results - 自定义权重重新计算
 *
 * 允许完全自定义所有维度和子维度的权重
 *
 * 使用方法:
 * node recalculate-fsm-with-weights.mjs <workspace-name>
 *
 * 示例:
 * node recalculate-fsm-with-weights.mjs 0126-biased
 * node recalculate-fsm-with-weights.mjs 0126-balanced
 */

import fs from "fs/promises";
import path from "path";

// ==================== 权重配置 ====================
// 在这里自定义所有权重！所有权重应该加起来等于 1.0

const WEIGHTS = {
  // ========== Structural Similarity 子维度权重 ==========
  structural: {
    node_count_similarity: 0.333, // 节点数相似度权重
    edge_count_similarity: 0.333, // 边数相似度权重
    degree_distribution_similarity: 0.334, // 度分布相似度权重
    density_similarity: 0, // 密度相似度权重
    // 注意: 这4个权重应该加起来等于 1.0
  },

  // ========== Semantic Similarity 子维度权重 ==========
  semantic: {
    state_embedding_similarity: 0.2, // 状态嵌入相似度权重
    action_embedding_similarity: 0.2, // 动作嵌入相似度权重
    event_embedding_similarity: 0.2, // 事件嵌入相似度权重
    metadata_embedding_similarity: 0.2, // 元数据嵌入相似度权重
    category_distribution_similarity: 0.2, // 类别分布相似度权重
    // 注意: 这5个权重应该加起来等于 1.0
  },

  // ========== 三大维度权重 ==========
  overall: {
    structural: 0.4, // Dimension 1: Structural Similarity 权重
    semantic: 0.4, // Dimension 2: Semantic Similarity 权重
    isomorphism: 0.2, // Dimension 3: Isomorphism Similarity 权重
    // 注意: 这3个权重应该加起来等于 1.0
  },
};

// ==================== 配置验证 ====================
function validateWeights() {
  console.log("🔍 验证权重配置...\n");

  let isValid = true;

  // 验证 structural 权重
  const structuralSum = Object.values(WEIGHTS.structural).reduce(
    (a, b) => a + b,
    0,
  );
  console.log(`📊 Structural 子维度权重总和: ${structuralSum.toFixed(4)}`);
  if (Math.abs(structuralSum - 1.0) > 0.001) {
    console.log(
      `   ⚠️  警告: 权重总和应该为 1.0，当前为 ${structuralSum.toFixed(4)}`,
    );
    isValid = false;
  } else {
    console.log(`   ✅ 权重总和正确`);
  }

  // 验证 semantic 权重
  const semanticSum = Object.values(WEIGHTS.semantic).reduce(
    (a, b) => a + b,
    0,
  );
  console.log(`📊 Semantic 子维度权重总和: ${semanticSum.toFixed(4)}`);
  if (Math.abs(semanticSum - 1.0) > 0.001) {
    console.log(
      `   ⚠️  警告: 权重总和应该为 1.0，当前为 ${semanticSum.toFixed(4)}`,
    );
    isValid = false;
  } else {
    console.log(`   ✅ 权重总和正确`);
  }

  // 验证 overall 权重
  const overallSum = Object.values(WEIGHTS.overall).reduce((a, b) => a + b, 0);
  console.log(`📊 Overall 三大维度权重总和: ${overallSum.toFixed(4)}`);
  if (Math.abs(overallSum - 1.0) > 0.001) {
    console.log(
      `   ⚠️  警告: 权重总和应该为 1.0，当前为 ${overallSum.toFixed(4)}`,
    );
    isValid = false;
  } else {
    console.log(`   ✅ 权重总和正确`);
  }

  console.log("");

  if (!isValid) {
    console.log("⚠️  权重配置有误，但将继续执行。建议修正权重配置。\n");
  }

  return isValid;
}

// ==================== 核心计算函数 ====================

/**
 * 重新计算 structural_similarity.overall
 * 使用自定义权重
 */
function recalculateStructuralSimilarity(structural) {
  if (!structural) return null;

  const weights = WEIGHTS.structural;
  const newOverall =
    structural.node_count_similarity * weights.node_count_similarity +
    structural.edge_count_similarity * weights.edge_count_similarity +
    structural.degree_distribution_similarity *
      weights.degree_distribution_similarity +
    structural.density_similarity * weights.density_similarity;

  return {
    ...structural,
    overall: newOverall,
  };
}

/**
 * 重新计算 semantic_similarity.overall
 * 使用自定义权重
 */
function recalculateSemanticSimilarity(semantic) {
  if (!semantic) return null;

  const weights = WEIGHTS.semantic;
  const newOverall =
    semantic.state_embedding_similarity * weights.state_embedding_similarity +
    semantic.action_embedding_similarity * weights.action_embedding_similarity +
    semantic.event_embedding_similarity * weights.event_embedding_similarity +
    semantic.metadata_embedding_similarity *
      weights.metadata_embedding_similarity +
    semantic.category_distribution_similarity *
      weights.category_distribution_similarity;

  return {
    ...semantic,
    overall: newOverall,
  };
}

/**
 * 重新计算 combined_similarity 和各维度分数
 * 使用自定义权重
 */
function recalculateCombinedSimilarity(
  structural,
  semantic,
  isomorphism,
  minScores,
  maxScores,
) {
  const weights = WEIGHTS.overall;

  // 计算加权平均 raw score
  const rawScore =
    structural.overall * weights.structural +
    semantic.overall * weights.semantic +
    isomorphism * weights.isomorphism;

  // 归一化各维度分数
  const normalizeScore = (score, min, max) => {
    if (max === min) return 0.5;
    return (score - min) / (max - min);
  };

  const structuralNormalized = normalizeScore(
    structural.overall,
    minScores.structural,
    maxScores.structural,
  );
  const semanticNormalized = normalizeScore(
    semantic.overall,
    minScores.semantic,
    maxScores.semantic,
  );
  const isomorphismNormalized = normalizeScore(
    isomorphism,
    minScores.isomorphism,
    maxScores.isomorphism,
  );

  // 计算加权平均 normalized score
  const normalizedScore =
    structuralNormalized * weights.structural +
    semanticNormalized * weights.semantic +
    isomorphismNormalized * weights.isomorphism;

  // 各维度对象
  const dimension1 = {
    score: structuralNormalized,
    raw_score: structural.overall,
    percentage: Math.round(structuralNormalized * 100),
  };

  const dimension2 = {
    score: semanticNormalized,
    raw_score: semantic.overall,
    percentage: Math.round(semanticNormalized * 100),
  };

  const dimension3 = {
    score: isomorphismNormalized,
    raw_score: isomorphism,
    percentage: Math.round(isomorphismNormalized * 100),
  };

  const combined = {
    score: normalizedScore,
    raw_score: rawScore,
    percentage: Math.round(normalizedScore * 100),
  };

  return { dimension1, dimension2, dimension3, combined };
}

/**
 * 更新 summary 分数
 */
function updateSummary(summary, combined) {
  if (!summary) return null;

  return {
    ...summary,
    score: combined.percentage,
    raw_score: Math.round(combined.raw_score * 100),
  };
}

/**
 * 第一遍扫描：计算所有维度的 min 和 max
 */
function calculateMinMaxScores(results) {
  const minScores = {
    structural: Infinity,
    semantic: Infinity,
    isomorphism: Infinity,
  };

  const maxScores = {
    structural: -Infinity,
    semantic: -Infinity,
    isomorphism: -Infinity,
  };

  for (const result of results) {
    if (!result.similarityResult) continue;

    const sim = result.similarityResult;

    // Structural
    if (sim.structural_similarity) {
      const structural = recalculateStructuralSimilarity(
        sim.structural_similarity,
      );
      if (structural && structural.overall !== null) {
        if (structural.overall < minScores.structural)
          minScores.structural = structural.overall;
        if (structural.overall > maxScores.structural)
          maxScores.structural = structural.overall;
      }
    }

    // Semantic
    if (sim.semantic_similarity) {
      const semantic = recalculateSemanticSimilarity(sim.semantic_similarity);
      if (semantic && semantic.overall !== null) {
        if (semantic.overall < minScores.semantic)
          minScores.semantic = semantic.overall;
        if (semantic.overall > maxScores.semantic)
          maxScores.semantic = semantic.overall;
      }
    }

    // Isomorphism
    if (
      sim.isomorphism_similarity !== null &&
      sim.isomorphism_similarity !== undefined
    ) {
      const iso = sim.isomorphism_similarity;
      if (iso < minScores.isomorphism) minScores.isomorphism = iso;
      if (iso > maxScores.isomorphism) maxScores.isomorphism = iso;
    }
  }

  return { minScores, maxScores };
}

/**
 * 处理单个 result 对象
 */
function processResult(result, minScores, maxScores) {
  if (!result.similarityResult) {
    return result;
  }

  const sim = result.similarityResult;

  // 1. 重新计算 structural_similarity.overall
  const newStructural = recalculateStructuralSimilarity(
    sim.structural_similarity,
  );

  // 2. 重新计算 semantic_similarity.overall
  const newSemantic = recalculateSemanticSimilarity(sim.semantic_similarity);

  // 3. 获取 isomorphism (不需要重新计算)
  const isomorphism = sim.isomorphism_similarity;

  if (
    !newStructural ||
    !newSemantic ||
    isomorphism === null ||
    isomorphism === undefined
  ) {
    return result;
  }

  // 4. 重新计算所有维度和 combined_similarity
  const { dimension1, dimension2, dimension3, combined } =
    recalculateCombinedSimilarity(
      newStructural,
      newSemantic,
      isomorphism,
      minScores,
      maxScores,
    );

  // 5. 更新 summary
  const newSummary = updateSummary(sim.summary, combined);

  // 返回更新后的 result
  return {
    ...result,
    similarityResult: {
      ...sim,
      structural_similarity: newStructural,
      semantic_similarity: newSemantic,
      dimension1_interaction_capacity: dimension1,
      dimension2_behavioral_coherence: dimension2,
      dimension3_interaction_meaningfulness: dimension3,
      combined_similarity: combined,
      summary: newSummary,
    },
  };
}

// ==================== 主函数 ====================
async function main() {
  const workspaceName = process.argv[2];

  if (!workspaceName) {
    console.error("❌ 错误: 请提供 workspace 名称");
    console.error(
      "使用方法: node recalculate-fsm-with-weights.mjs <workspace-name>",
    );
    console.error("示例: node recalculate-fsm-with-weights.mjs 0126-biased");
    process.exit(1);
  }

  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  FSM 相似度重新计算 - 自定义权重版本`);
  console.log(`  Workspace: ${workspaceName}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  // 验证权重配置
  validateWeights();

  // 显示当前权重配置
  console.log("📋 当前权重配置:\n");
  console.log("Structural Similarity 子维度权重:");
  for (const [key, value] of Object.entries(WEIGHTS.structural)) {
    console.log(`   ${key}: ${value.toFixed(3)}`);
  }
  console.log("\nSemantic Similarity 子维度权重:");
  for (const [key, value] of Object.entries(WEIGHTS.semantic)) {
    console.log(`   ${key}: ${value.toFixed(3)}`);
  }
  console.log("\n三大维度权重:");
  for (const [key, value] of Object.entries(WEIGHTS.overall)) {
    console.log(`   ${key}: ${value.toFixed(3)}`);
  }
  console.log("\n");

  const workspaceDir = path.join("workspace", workspaceName);
  const inputFile = path.join(workspaceDir, "fsm-similarity-results.json");
  const outputFile = path.join(
    workspaceDir,
    "fsm-similarity-results-latest.json",
  );

  try {
    // 检查文件是否存在
    await fs.access(inputFile);
  } catch (error) {
    console.error(`❌ 错误: 找不到文件 ${inputFile}`);
    process.exit(1);
  }

  try {
    // 读取原始数据
    console.log("📖 正在读取原始数据...");
    const rawData = await fs.readFile(inputFile, "utf-8");
    const data = JSON.parse(rawData);

    console.log(`   ✓ 总共 ${data.results.length} 个 results\n`);

    // 第一遍：计算新的 min 和 max
    console.log("🔍 第一遍扫描: 计算各维度范围...");
    const { minScores, maxScores } = calculateMinMaxScores(data.results);

    console.log(
      `   Structural: [${minScores.structural.toFixed(4)}, ${maxScores.structural.toFixed(4)}]`,
    );
    console.log(
      `   Semantic:   [${minScores.semantic.toFixed(4)}, ${maxScores.semantic.toFixed(4)}]`,
    );
    console.log(
      `   Isomorphism: [${minScores.isomorphism.toFixed(4)}, ${maxScores.isomorphism.toFixed(4)}]`,
    );
    console.log("");

    // 第二遍：处理所有 results
    console.log("⚙️  第二遍处理: 重新计算所有分数...");
    const processedResults = data.results.map((result) =>
      processResult(result, minScores, maxScores),
    );

    // 统计处理结果
    const validResults = processedResults.filter((r) => r.similarityResult);
    const processedCount = validResults.length;

    console.log(`   ✓ 成功处理: ${processedCount} 个 results\n`);

    // 重新计算统计信息
    console.log("📊 正在重新计算统计信息...");

    // 计算新的平均相似度
    const avgSimilarity =
      validResults.reduce((sum, r) => {
        return sum + r.similarityResult.combined_similarity.raw_score;
      }, 0) / validResults.length;

    // 计算新的分布
    const distribution = {
      excellent: 0, // >= 0.9
      good: 0, // >= 0.7
      fair: 0, // >= 0.5
      poor: 0, // < 0.5
    };

    validResults.forEach((r) => {
      const score = r.similarityResult.combined_similarity.raw_score;
      if (score >= 0.9) distribution.excellent++;
      else if (score >= 0.7) distribution.good++;
      else if (score >= 0.5) distribution.fair++;
      else distribution.poor++;
    });

    // 更新统计信息
    const updatedData = {
      ...data,
      results: processedResults,
      stats: {
        ...data.stats,
        avgSimilarity,
        similarityDistribution: distribution,
      },
      recalculation_info: {
        timestamp: new Date().toISOString(),
        method: "custom_weighted_calculation",
        description:
          "FSM scores recalculated with custom weights for all dimensions and subdimensions",
        weights: WEIGHTS,
        minScores,
        maxScores,
        processed_count: processedCount,
      },
    };

    // 保存结果
    console.log("💾 正在保存重新计算的结果...");
    await fs.writeFile(
      outputFile,
      JSON.stringify(updatedData, null, 2),
      "utf-8",
    );
    console.log(`   ✓ 结果已保存到: ${outputFile}\n`);

    // 显示变化摘要
    console.log("═══════════════════════════════════════════════════════════");
    console.log("📈 变化摘要");
    console.log(
      "═══════════════════════════════════════════════════════════\n",
    );

    console.log(`原始平均相似度: ${data.stats.avgSimilarity.toFixed(4)}`);
    console.log(`新的平均相似度: ${avgSimilarity.toFixed(4)}`);
    console.log(
      `变化: ${((avgSimilarity - data.stats.avgSimilarity) * 100).toFixed(2)}%\n`,
    );

    console.log("原始分布:");
    console.log(
      `  Excellent (≥90%): ${data.stats.similarityDistribution.excellent}`,
    );
    console.log(
      `  Good (≥70%):      ${data.stats.similarityDistribution.good}`,
    );
    console.log(
      `  Fair (≥50%):      ${data.stats.similarityDistribution.fair}`,
    );
    console.log(
      `  Poor (<50%):      ${data.stats.similarityDistribution.poor}`,
    );

    console.log("\n新的分布:");
    const showChange = (newVal, oldVal) => {
      const diff = newVal - oldVal;
      return diff > 0 ? `(+${diff})` : diff < 0 ? `(${diff})` : "";
    };
    console.log(
      `  Excellent (≥90%): ${distribution.excellent} ${showChange(distribution.excellent, data.stats.similarityDistribution.excellent)}`,
    );
    console.log(
      `  Good (≥70%):      ${distribution.good} ${showChange(distribution.good, data.stats.similarityDistribution.good)}`,
    );
    console.log(
      `  Fair (≥50%):      ${distribution.fair} ${showChange(distribution.fair, data.stats.similarityDistribution.fair)}`,
    );
    console.log(
      `  Poor (<50%):      ${distribution.poor} ${showChange(distribution.poor, data.stats.similarityDistribution.poor)}`,
    );

    // 示例：显示前3个数据点的变化
    console.log(
      "\n═══════════════════════════════════════════════════════════",
    );
    console.log("📋 示例数据点变化 (前3个)");
    console.log(
      "═══════════════════════════════════════════════════════════\n",
    );

    for (let i = 0; i < Math.min(3, validResults.length); i++) {
      const processed = processedResults[i];
      const original = data.results.find(
        (r) => r.taskId === processed.taskId && r.similarityResult,
      );

      if (original && processed.similarityResult) {
        console.log(`示例 ${i + 1}: ${processed.taskId}`);
        console.log(`  模型: ${processed.model || "N/A"}`);
        console.log(
          `  Structural:  ${original.similarityResult.structural_similarity.overall.toFixed(4)} → ${processed.similarityResult.structural_similarity.overall.toFixed(4)}`,
        );
        console.log(
          `  Semantic:    ${original.similarityResult.semantic_similarity.overall.toFixed(4)} → ${processed.similarityResult.semantic_similarity.overall.toFixed(4)}`,
        );
        console.log(
          `  Isomorphism: ${original.similarityResult.isomorphism_similarity.toFixed(4)} (unchanged)`,
        );
        console.log(
          `  Combined:    ${original.similarityResult.combined_similarity.raw_score.toFixed(4)} → ${processed.similarityResult.combined_similarity.raw_score.toFixed(4)}`,
        );
        console.log(
          `  Summary:     ${original.similarityResult.summary.score}% → ${processed.similarityResult.summary.score}%`,
        );
        console.log("");
      }
    }

    console.log("═══════════════════════════════════════════════════════════");
    console.log("✅ 完成！");
    console.log(
      "═══════════════════════════════════════════════════════════\n",
    );
    console.log(`📁 原始文件 (未修改): ${inputFile}`);
    console.log(`📁 新文件:             ${outputFile}\n`);
  } catch (error) {
    console.error("❌ 处理过程中出错:", error);
    process.exit(1);
  }
}

// 运行主函数
main();
