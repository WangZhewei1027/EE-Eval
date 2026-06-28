#!/usr/bin/env node
/**
 * FSM Similarity Analysis by AI Model
 * 分析不同AI模型生成的FSM相似度并创建可视化图表
 */

import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 读取并分析FSM相似度结果
 */
async function analyzeSimilarityByModel(workspaceName) {
  const workspacePath = path.join("workspace", workspaceName);
  const resultsPath = path.join(workspacePath, "fsm-similarity-results.json");
  const dataDir = path.join(workspacePath, "data");

  console.log(`
╔════════════════════════════════════════════════════════════════════════╗
║  FSM相似度模型分析器 - FSM Similarity Model Analyzer                   ║
╚════════════════════════════════════════════════════════════════════════╝

工作空间: ${workspaceName}
数据路径: ${resultsPath}
`);

  // 读取相似度结果
  const resultsContent = await fs.readFile(resultsPath, "utf-8");
  const results = JSON.parse(resultsContent);

  console.log(
    `📊 总体统计: ${results.stats.total} 个文件, ${results.stats.success} 个成功匹配`
  );

  // 提取成功的结果
  const successfulResults = results.results.filter(
    (r) => r.success && r.similarityResult
  );
  console.log(`✅ 成功分析的FSM数量: ${successfulResults.length}`);

  // 为每个成功结果获取模型信息
  const modelAnalysis = {};

  for (const result of successfulResults) {
    try {
      // 从文件名中提取ID (去掉.json后缀)
      const fileId = result.fsmFileName.replace(".json", "");
      const dataFilePath = path.join(dataDir, `${fileId}.json`);

      // 读取对应的数据文件获取模型信息 !!!!!!!!!!!!!!!!!!!!!!!!!!!!!
      const dataContent = await fs.readFile(dataFilePath, "utf-8");
      const dataFile = JSON.parse(dataContent);

      const model = dataFile.model || "unknown";

      if (!modelAnalysis[model]) {
        modelAnalysis[model] = {
          count: 0,
          totalSimilarity: 0,
          similarities: [],
          concepts: [],
          structuralSimilarities: [],
          semanticSimilarities: [],
          isomorphismSimilarities: [],
        };
      }

      const similarity = result.similarityResult.combined_similarity;
      modelAnalysis[model].count++;
      modelAnalysis[model].totalSimilarity += similarity;
      modelAnalysis[model].similarities.push(similarity);
      modelAnalysis[model].concepts.push(result.concept);
      modelAnalysis[model].structuralSimilarities.push(
        result.similarityResult.structural_similarity.overall
      );
      modelAnalysis[model].semanticSimilarities.push(
        result.similarityResult.semantic_similarity.overall
      );
      modelAnalysis[model].isomorphismSimilarities.push(
        result.similarityResult.isomorphism_similarity
      );
    } catch (error) {
      console.warn(
        `⚠️ 无法读取数据文件 ${result.fsmFileName}: ${error.message}`
      );
    }
  }

  // 计算每个模型的统计信息
  const modelStats = {};
  for (const [model, data] of Object.entries(modelAnalysis)) {
    modelStats[model] = {
      count: data.count,
      averageSimilarity: data.totalSimilarity / data.count,
      averageStructural:
        data.structuralSimilarities.reduce((a, b) => a + b, 0) / data.count,
      averageSemantic:
        data.semanticSimilarities.reduce((a, b) => a + b, 0) / data.count,
      averageIsomorphism:
        data.isomorphismSimilarities.reduce((a, b) => a + b, 0) / data.count,
      minSimilarity: Math.min(...data.similarities),
      maxSimilarity: Math.max(...data.similarities),
      stdDeviation: calculateStandardDeviation(data.similarities),
      concepts: data.concepts,
    };
  }

  // 显示分析结果
  console.log(`\n📈 模型性能分析:`);
  console.log(
    `${"模型".padEnd(20)} | ${"数量".padEnd(6)} | ${"平均相似度".padEnd(
      12
    )} | ${"结构".padEnd(8)} | ${"语义".padEnd(8)} | ${"同构".padEnd(
      8
    )} | ${"标准差".padEnd(8)}`
  );
  console.log("─".repeat(85));

  for (const [model, stats] of Object.entries(modelStats).sort(
    (a, b) => b[1].averageSimilarity - a[1].averageSimilarity
  )) {
    console.log(
      `${model.padEnd(20)} | ${stats.count.toString().padEnd(6)} | ${(
        stats.averageSimilarity * 100
      )
        .toFixed(1)
        .padEnd(12)}% | ${(stats.averageStructural * 100)
        .toFixed(1)
        .padEnd(8)}% | ${(stats.averageSemantic * 100)
        .toFixed(1)
        .padEnd(8)}% | ${(stats.averageIsomorphism * 100)
        .toFixed(1)
        .padEnd(8)}% | ${stats.stdDeviation.toFixed(3).padEnd(8)}`
    );
  }

  // 生成HTML可视化报告
  await generateVisualizationReport(modelStats, workspacePath);

  return modelStats;
}

/**
 * 计算标准差
 */
function calculateStandardDeviation(values) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((value) => Math.pow(value - mean, 2));
  const avgSquaredDiff =
    squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquaredDiff);
}

/**
 * 生成HTML可视化报告
 */
async function generateVisualizationReport(modelStats, workspacePath) {
  const reportPath = path.join(workspacePath, "model-similarity-analysis.html");

  // 准备图表数据
  const models = Object.keys(modelStats);
  const averageSimilarities = models.map((m) =>
    (modelStats[m].averageSimilarity * 100).toFixed(1)
  );
  const structuralSimilarities = models.map((m) =>
    (modelStats[m].averageStructural * 100).toFixed(1)
  );
  const semanticSimilarities = models.map((m) =>
    (modelStats[m].averageSemantic * 100).toFixed(1)
  );
  const isomorphismSimilarities = models.map((m) =>
    (modelStats[m].averageIsomorphism * 100).toFixed(1)
  );
  const counts = models.map((m) => modelStats[m].count);

  const htmlContent = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI模型FSM相似度分析报告</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5rem;
        }
        .header p {
            margin: 10px 0 0 0;
            font-size: 1.2rem;
            opacity: 0.9;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            padding: 30px;
        }
        .stat-card {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            border-left: 4px solid #667eea;
        }
        .stat-card h3 {
            margin: 0 0 10px 0;
            color: #333;
            font-size: 1.1rem;
        }
        .stat-number {
            font-size: 2rem;
            font-weight: bold;
            color: #667eea;
        }
        .charts-section {
            padding: 30px;
        }
        .chart-container {
            margin-bottom: 40px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .chart-header {
            background: #f8f9fa;
            padding: 20px;
            border-bottom: 1px solid #e9ecef;
        }
        .chart-header h3 {
            margin: 0;
            color: #333;
        }
        .chart-content {
            padding: 20px;
            height: 400px;
            position: relative;
        }
        .model-details {
            padding: 30px;
            background: #f8f9fa;
        }
        .model-table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .model-table th {
            background: #667eea;
            color: white;
            padding: 15px;
            text-align: left;
        }
        .model-table td {
            padding: 15px;
            border-bottom: 1px solid #e9ecef;
        }
        .model-table tr:hover {
            background: #f8f9fa;
        }
        .score {
            font-weight: bold;
        }
        .score.high { color: #28a745; }
        .score.medium { color: #ffc107; }
        .score.low { color: #dc3545; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 AI模型FSM相似度分析报告</h1>
            <p>不同AI模型生成的FSM与理想FSM相似度对比分析</p>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <h3>参与模型数量</h3>
                <div class="stat-number">${models.length}</div>
            </div>
            <div class="stat-card">
                <h3>总分析样本</h3>
                <div class="stat-number">${counts.reduce(
                  (a, b) => a + b,
                  0
                )}</div>
            </div>
            <div class="stat-card">
                <h3>最佳模型</h3>
                <div class="stat-number">${models[0]}</div>
            </div>
            <div class="stat-card">
                <h3>最高平均相似度</h3>
                <div class="stat-number">${averageSimilarities[0]}%</div>
            </div>
        </div>

        <div class="charts-section">
            <div class="chart-container">
                <div class="chart-header">
                    <h3>📊 各模型平均相似度对比</h3>
                </div>
                <div class="chart-content">
                    <canvas id="overallChart"></canvas>
                </div>
            </div>

            <div class="chart-container">
                <div class="chart-header">
                    <h3>📈 相似度维度详细对比</h3>
                </div>
                <div class="chart-content">
                    <canvas id="detailedChart"></canvas>
                </div>
            </div>

            <div class="chart-container">
                <div class="chart-header">
                    <h3>📋 样本数量分布</h3>
                </div>
                <div class="chart-content">
                    <canvas id="sampleChart"></canvas>
                </div>
            </div>
        </div>

        <div class="model-details">
            <h3>详细数据表</h3>
            <table class="model-table">
                <thead>
                    <tr>
                        <th>模型名称</th>
                        <th>样本数量</th>
                        <th>平均相似度</th>
                        <th>结构相似度</th>
                        <th>语义相似度</th>
                        <th>同构相似度</th>
                        <th>标准差</th>
                        <th>相似度区间</th>
                    </tr>
                </thead>
                <tbody>
                    ${models
                      .map((model) => {
                        const stats = modelStats[model];
                        const avgScore = (
                          stats.averageSimilarity * 100
                        ).toFixed(1);
                        const scoreClass =
                          avgScore >= 70
                            ? "high"
                            : avgScore >= 50
                            ? "medium"
                            : "low";
                        return `
                        <tr>
                            <td><strong>${model}</strong></td>
                            <td>${stats.count}</td>
                            <td><span class="score ${scoreClass}">${avgScore}%</span></td>
                            <td>${(stats.averageStructural * 100).toFixed(
                              1
                            )}%</td>
                            <td>${(stats.averageSemantic * 100).toFixed(
                              1
                            )}%</td>
                            <td>${(stats.averageIsomorphism * 100).toFixed(
                              1
                            )}%</td>
                            <td>${stats.stdDeviation.toFixed(3)}</td>
                            <td>${(stats.minSimilarity * 100).toFixed(1)}% - ${(
                          stats.maxSimilarity * 100
                        ).toFixed(1)}%</td>
                        </tr>
                        `;
                      })
                      .join("")}
                </tbody>
            </table>
        </div>
    </div>

    <script>
        // 图表配置
        const chartColors = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', 
            '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
        ];

        const models = ${JSON.stringify(models)};
        const averageSimilarities = ${JSON.stringify(
          averageSimilarities.map(Number)
        )};
        const structuralSimilarities = ${JSON.stringify(
          structuralSimilarities.map(Number)
        )};
        const semanticSimilarities = ${JSON.stringify(
          semanticSimilarities.map(Number)
        )};
        const isomorphismSimilarities = ${JSON.stringify(
          isomorphismSimilarities.map(Number)
        )};
        const counts = ${JSON.stringify(counts)};

        // 1. 综合相似度柱状图
        const overallCtx = document.getElementById('overallChart').getContext('2d');
        new Chart(overallCtx, {
            type: 'bar',
            data: {
                labels: models,
                datasets: [{
                    label: '平均相似度 (%)',
                    data: averageSimilarities,
                    backgroundColor: chartColors.slice(0, models.length),
                    borderColor: chartColors.slice(0, models.length),
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: '相似度 (%)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return \`相似度: \${context.parsed.y}%\`;
                            }
                        }
                    }
                }
            }
        });

        // 2. 详细维度对比
        const detailedCtx = document.getElementById('detailedChart').getContext('2d');
        const detailDatasets = models.map((model, index) => ({
            label: model,
            data: [
                averageSimilarities[index],
                structuralSimilarities[index],
                semanticSimilarities[index],
                isomorphismSimilarities[index]
            ],
            backgroundColor: chartColors[index] + '33',
            borderColor: chartColors[index],
            borderWidth: 2,
            pointBackgroundColor: chartColors[index]
        }));

        new Chart(detailedCtx, {
            type: 'radar',
            data: {
                labels: ['综合相似度', '结构相似度', '语义相似度', '同构相似度'],
                datasets: detailDatasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        });

        // 3. 样本数量分布
        const sampleCtx = document.getElementById('sampleChart').getContext('2d');
        new Chart(sampleCtx, {
            type: 'doughnut',
            data: {
                labels: models,
                datasets: [{
                    data: counts,
                    backgroundColor: chartColors.slice(0, models.length),
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return \`\${context.label}: \${context.parsed} 个 (\${percentage}%)\`;
                            }
                        }
                    }
                }
            }
        });
    </script>
</body>
</html>
  `;

  await fs.writeFile(reportPath, htmlContent);
  console.log(`\n📊 可视化报告已生成: ${reportPath}`);
  console.log(`🌐 在浏览器中打开查看详细图表和分析`);
}

// 命令行参数处理
function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
用法: node analyze-model-similarity.mjs <workspace-name>

参数:
  <workspace-name>    包含fsm-similarity-results.json的工作空间名称

示例:
  node analyze-model-similarity.mjs batch-fsm-similarity
    `);
    process.exit(0);
  }

  return args[0];
}

// 如果直接运行此文件
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const workspaceName = parseArgs();

  analyzeSimilarityByModel(workspaceName)
    .then((modelStats) => {
      console.log("\n🎉 AI模型FSM相似度分析完成！");

      // 输出总结
      const sortedModels = Object.entries(modelStats).sort(
        (a, b) => b[1].averageSimilarity - a[1].averageSimilarity
      );

      console.log("\n🏆 模型排名（按平均相似度）:");
      sortedModels.forEach(([model, stats], index) => {
        console.log(
          `${index + 1}. ${model}: ${(stats.averageSimilarity * 100).toFixed(
            1
          )}% (${stats.count} 个样本)`
        );
      });

      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 分析失败:", error.message);
      process.exit(1);
    });
}

export default analyzeSimilarityByModel;
