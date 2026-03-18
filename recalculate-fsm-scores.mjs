#!/usr/bin/env node

/**
 * 重新计算 FSM Similarity Results
 *
 * 主要变更：
 * 1. structural_similarity.overall: 不考虑 density_similarity，只用其余三个指标的平均值
 * 2. 重新计算 combined_similarity 和 dimension1 的分数
 * 3. 更新 summary 中的分数
 *
 * 使用方法:
 * node recalculate-fsm-scores.mjs <workspace-name>
 *
 * 示例:
 * node recalculate-fsm-scores.mjs 0126-biased
 * node recalculate-fsm-scores.mjs 0126-balanced
 */

import fs from "fs/promises";
import path from "path";

// 获取命令行参数
const workspaceName = process.argv[2];

if (!workspaceName) {
  console.error("错误: 请提供 workspace 名称");
  console.error("使用方法: node recalculate-fsm-scores.mjs <workspace-name>");
  console.error("示例: node recalculate-fsm-scores.mjs 0126-biased");
  process.exit(1);
}

const workspaceDir = path.join("workspace", workspaceName);
const inputFile = path.join(workspaceDir, "fsm-similarity-results.json");
const backupFile = path.join(
  workspaceDir,
  "fsm-similarity-results.backup.json",
);
const outputFile = path.join(
  workspaceDir,
  "fsm-similarity-results-recalculated.json",
);

/**
 * 重新计算 structural_similarity.overall
 * 不考虑 density_similarity，只用其余三个指标的平均值
 */
function recalculateStructuralSimilarity(structural) {
  if (!structural) return null;

  const {
    node_count_similarity,
    edge_count_similarity,
    degree_distribution_similarity,
  } = structural;

  // 只使用这三个指标计算平均值（去掉 density_similarity）
  const newOverall =
    (node_count_similarity +
      edge_count_similarity +
      degree_distribution_similarity) /
    3;

  return {
    ...structural,
    overall: newOverall,
  };
}

/**
 * 重新计算 dimension1_interaction_capacity 的分数
 * 基于新的 structural_similarity.overall
 */
function recalculateDimension1(structural, minScore, maxScore) {
  const rawScore = structural.overall;

  // 归一化到 [0, 1] 范围
  let normalizedScore;
  if (maxScore === minScore) {
    normalizedScore = 0.5; // 避免除以零
  } else {
    normalizedScore = (rawScore - minScore) / (maxScore - minScore);
  }

  // 转换为百分比分数（0-100）
  const score = normalizedScore;
  const percentage = Math.round(score * 100);

  return {
    score,
    raw_score: rawScore,
    percentage,
  };
}

/**
 * 重新计算 combined_similarity
 * 基于三个维度的新分数
 */
function recalculateCombinedSimilarity(dimension1, dimension2, dimension3) {
  // 使用三个维度的 raw_score 平均值
  const rawScore =
    (dimension1.raw_score + dimension2.raw_score + dimension3.raw_score) / 3;

  // score 使用归一化后的值平均
  const score = (dimension1.score + dimension2.score + dimension3.score) / 3;
  const percentage = Math.round(score * 100);

  return {
    score,
    raw_score: rawScore,
    percentage,
  };
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
 * 处理单个 result 对象
 */
function processResult(result, minStructural, maxStructural) {
  // 如果没有 similarityResult，直接返回原对象
  if (!result.similarityResult) {
    return result;
  }

  const { similarityResult } = result;

  // 1. 重新计算 structural_similarity.overall
  const newStructural = recalculateStructuralSimilarity(
    similarityResult.structural_similarity,
  );

  if (!newStructural) {
    return result; // 如果 structural 为空，返回原对象
  }

  // 2. 重新计算 dimension1
  const newDimension1 = recalculateDimension1(
    newStructural,
    minStructural,
    maxStructural,
  );

  // 3. 保持 dimension2 和 dimension3 不变
  const dimension2 = similarityResult.dimension2_behavioral_coherence;
  const dimension3 = similarityResult.dimension3_interaction_meaningfulness;

  // 4. 重新计算 combined_similarity
  const newCombined = recalculateCombinedSimilarity(
    newDimension1,
    dimension2,
    dimension3,
  );

  // 5. 更新 summary
  const newSummary = updateSummary(similarityResult.summary, newCombined);

  // 返回更新后的 result
  return {
    ...result,
    similarityResult: {
      ...similarityResult,
      structural_similarity: newStructural,
      dimension1_interaction_capacity: newDimension1,
      combined_similarity: newCombined,
      summary: newSummary,
    },
  };
}

/**
 * 第一遍扫描：计算新的 structural_similarity.overall 的 min 和 max
 */
function calculateMinMaxStructural(results) {
  let min = Infinity;
  let max = -Infinity;

  for (const result of results) {
    if (!result.similarityResult?.structural_similarity) continue;

    const structural = result.similarityResult.structural_similarity;
    const {
      node_count_similarity,
      edge_count_similarity,
      degree_distribution_similarity,
    } = structural;

    // 计算新的 overall（不包含 density_similarity）
    const newOverall =
      (node_count_similarity +
        edge_count_similarity +
        degree_distribution_similarity) /
      3;

    if (newOverall < min) min = newOverall;
    if (newOverall > max) max = newOverall;
  }

  return { min, max };
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log(`正在处理 workspace: ${workspaceName}`);
    console.log(`输入文件: ${inputFile}`);

    // 检查文件是否存在
    try {
      await fs.access(inputFile);
    } catch (error) {
      console.error(`错误: 找不到文件 ${inputFile}`);
      process.exit(1);
    }

    // 读取原始数据
    console.log("正在读取原始数据...");
    const rawData = await fs.readFile(inputFile, "utf-8");
    const data = JSON.parse(rawData);

    console.log(`总共 ${data.results.length} 个 results`);

    // 创建备份
    console.log("正在创建备份...");
    await fs.writeFile(backupFile, rawData, "utf-8");
    console.log(`备份已保存到: ${backupFile}`);

    // 第一遍：计算新的 min 和 max
    console.log("\n第一遍扫描: 计算新的 structural_similarity 范围...");
    const { min, max } = calculateMinMaxStructural(data.results);
    console.log(
      `新的 structural_similarity.overall 范围: [${min.toFixed(4)}, ${max.toFixed(4)}]`,
    );

    // 第二遍：处理所有 results
    console.log("\n第二遍处理: 重新计算所有分数...");
    const processedResults = data.results.map((result) =>
      processResult(result, min, max),
    );

    // 统计处理结果
    const validResults = processedResults.filter((r) => r.similarityResult);
    const processedCount = validResults.length;

    console.log(`成功处理: ${processedCount} 个 results`);

    // 重新计算统计信息
    console.log("\n正在重新计算统计信息...");

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
        method: "structural_similarity without density_similarity",
        description:
          "structural_similarity.overall = (node_count + edge_count + degree_distribution) / 3",
        min_structural: min,
        max_structural: max,
        processed_count: processedCount,
      },
    };

    // 保存结果
    console.log("\n正在保存重新计算的结果...");
    await fs.writeFile(
      outputFile,
      JSON.stringify(updatedData, null, 2),
      "utf-8",
    );
    console.log(`重新计算的结果已保存到: ${outputFile}`);

    // 显示变化摘要
    console.log("\n========== 变化摘要 ==========");
    console.log(`原始平均相似度: ${data.stats.avgSimilarity.toFixed(4)}`);
    console.log(`新的平均相似度: ${avgSimilarity.toFixed(4)}`);
    console.log(
      `变化: ${((avgSimilarity - data.stats.avgSimilarity) * 100).toFixed(2)}%`,
    );

    console.log("\n原始分布:");
    console.log(`  Excellent: ${data.stats.similarityDistribution.excellent}`);
    console.log(`  Good: ${data.stats.similarityDistribution.good}`);
    console.log(`  Fair: ${data.stats.similarityDistribution.fair}`);
    console.log(`  Poor: ${data.stats.similarityDistribution.poor}`);

    console.log("\n新的分布:");
    console.log(
      `  Excellent: ${distribution.excellent} (${distribution.excellent > data.stats.similarityDistribution.excellent ? "+" : ""}${distribution.excellent - data.stats.similarityDistribution.excellent})`,
    );
    console.log(
      `  Good: ${distribution.good} (${distribution.good > data.stats.similarityDistribution.good ? "+" : ""}${distribution.good - data.stats.similarityDistribution.good})`,
    );
    console.log(
      `  Fair: ${distribution.fair} (${distribution.fair > data.stats.similarityDistribution.fair ? "+" : ""}${distribution.fair - data.stats.similarityDistribution.fair})`,
    );
    console.log(
      `  Poor: ${distribution.poor} (${distribution.poor > data.stats.similarityDistribution.poor ? "+" : ""}${distribution.poor - data.stats.similarityDistribution.poor})`,
    );

    // 示例：显示前3个数据点的变化
    console.log("\n========== 示例数据点变化 ==========");
    for (let i = 0; i < Math.min(3, validResults.length); i++) {
      const original = data.results.find(
        (r) => r.taskId === processedResults[i].taskId && r.similarityResult,
      );
      const processed = processedResults[i];

      if (original && processed.similarityResult) {
        console.log(
          `\n示例 ${i + 1}: ${processed.taskId} - ${processed.model}`,
        );
        console.log(
          `  Structural Overall: ${original.similarityResult.structural_similarity.overall.toFixed(4)} -> ${processed.similarityResult.structural_similarity.overall.toFixed(4)}`,
        );
        console.log(
          `  Dimension1 Score: ${original.similarityResult.dimension1_interaction_capacity.score.toFixed(4)} -> ${processed.similarityResult.dimension1_interaction_capacity.score.toFixed(4)}`,
        );
        console.log(
          `  Combined Score: ${original.similarityResult.combined_similarity.score.toFixed(4)} -> ${processed.similarityResult.combined_similarity.score.toFixed(4)}`,
        );
        console.log(
          `  Summary Percentage: ${original.similarityResult.summary.score}% -> ${processed.similarityResult.summary.score}%`,
        );
      }
    }

    console.log("\n========== 完成 ==========");
    console.log("✅ 重新计算完成！");
    console.log(`✅ 备份文件: ${backupFile}`);
    console.log(`✅ 新文件: ${outputFile}`);
    console.log("\n如果要替换原文件，请运行:");
    console.log(`  copy "${outputFile}" "${inputFile}"`);
  } catch (error) {
    console.error("处理过程中出错:", error);
    process.exit(1);
  }
}

// 运行主函数
main();
