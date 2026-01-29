/**
 * Framework-Human Correlation Analysis
 *
 * 分析三个评估框架与人类评估的相关性：
 * 1. FSM-based evaluation (structural, semantic, isomorphism similarity)
 * 2. Baseline 1 - Playwright evaluation (test pass rate)
 * 3. Baseline 2 - VLM evaluation (visual quality)
 *
 * 对比这三个框架分别与人类评估四个维度的相关性：
 * - Functional, Visual, Interactivity, Pedagogical
 */

import fs from "fs";
import path from "path";

// Pearson Correlation Coefficient 计算
function pearsonCorrelation(x, y) {
  const n = x.length;
  if (n !== y.length || n === 0) {
    throw new Error("Arrays must have the same non-zero length");
  }

  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  if (denomX === 0 || denomY === 0) {
    return 0;
  }

  return numerator / Math.sqrt(denomX * denomY);
}

// 计算 p-value (双尾检验)
function calculatePValue(r, n) {
  if (n < 3) return 1;

  const t = r * Math.sqrt((n - 2) / (1 - r * r));
  const df = n - 2;

  // 使用 t-distribution 近似计算 p-value
  // 简化版本，使用正态分布近似
  const pValue = 2 * (1 - normalCDF(Math.abs(t)));
  return pValue;
}

// 标准正态分布的累积分布函数
function normalCDF(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

// 计算 95% 置信区间 (Fisher's z-transformation)
function calculateConfidenceInterval(r, n, confidence = 0.95) {
  if (n < 4) return { lower: null, upper: null };

  // Fisher's z transformation
  const z = 0.5 * Math.log((1 + r) / (1 - r));
  const se = 1 / Math.sqrt(n - 3);

  // z-score for confidence level
  const zScore = confidence === 0.95 ? 1.96 : 2.576;

  const zLower = z - zScore * se;
  const zUpper = z + zScore * se;

  // Transform back to r
  const rLower = (Math.exp(2 * zLower) - 1) / (Math.exp(2 * zLower) + 1);
  const rUpper = (Math.exp(2 * zUpper) - 1) / (Math.exp(2 * zUpper) + 1);

  return { lower: rLower, upper: rUpper };
}

// 判断相关性强度
function interpretCorrelation(r) {
  const absR = Math.abs(r);
  if (absR >= 0.7) return "Strong";
  if (absR >= 0.5) return "Moderate";
  if (absR >= 0.3) return "Weak";
  return "Very Weak";
}

// 主分析函数
async function analyzeCorrelations() {
  console.log("📊 Starting Framework-Human Correlation Analysis...\n");

  // 1. 读取人类评估数据
  console.log("📖 Reading human evaluation data...");
  const humanDataPath = "human-evaluation-data/01-28/results.json";
  const humanData = JSON.parse(fs.readFileSync(humanDataPath, "utf-8"));

  // 聚合人类评估数据：计算每个HTML的平均分数
  const humanScores = {};
  humanData.forEach((entry) => {
    const htmlId = entry.html_id.replace(".html", "");
    if (!humanScores[htmlId]) {
      humanScores[htmlId] = {
        functional: [],
        visual: [],
        pedagogical: [],
        interactivity: [],
      };
    }
    humanScores[htmlId].functional.push(entry.scores.functional);
    humanScores[htmlId].visual.push(entry.scores.visual);
    humanScores[htmlId].pedagogical.push(entry.scores.pedagogical);
    humanScores[htmlId].interactivity.push(entry.scores.interactivity);
  });

  // 计算每个HTML的平均人类评分
  Object.keys(humanScores).forEach((htmlId) => {
    ["functional", "visual", "pedagogical", "interactivity"].forEach((dim) => {
      const scores = humanScores[htmlId][dim];
      humanScores[htmlId][dim] =
        scores.reduce((a, b) => a + b, 0) / scores.length;
    });
  });

  console.log(
    `✅ Loaded human evaluations for ${Object.keys(humanScores).length} HTML files\n`,
  );

  // 2. 读取FSM评估数据
  console.log("📖 Reading FSM evaluation data...");
  const fsmDataPath = "workspace/0126-biased/fsm-similarity-results.json";
  const fsmData = JSON.parse(fs.readFileSync(fsmDataPath, "utf-8"));

  const fsmScores = {};
  fsmData.results.forEach((result) => {
    if (result.success && result.matched) {
      const htmlId = result.fsmFileName.replace(".json", "");
      const sim = result.similarityResult;
      // 计算总体相似度（三个维度的平均值）
      fsmScores[htmlId] =
        (sim.structural_similarity.overall +
          sim.semantic_similarity.overall +
          sim.isomorphism_similarity) /
        3;
    }
  });

  console.log(
    `✅ Loaded FSM scores for ${Object.keys(fsmScores).length} HTML files\n`,
  );

  // 3. 读取VLM评估数据
  console.log("📖 Reading VLM evaluation data...");
  const vlmDir = "workspace/0126-biased/visual-results";
  const vlmFiles = fs
    .readdirSync(vlmDir)
    .filter((f) => f.endsWith(".json") && f !== "_summary.json");

  const vlmScores = {};
  vlmFiles.forEach((file) => {
    const htmlId = file.replace(".json", "");
    const data = JSON.parse(fs.readFileSync(path.join(vlmDir, file), "utf-8"));
    vlmScores[htmlId] = data.visual_quality;
  });

  console.log(
    `✅ Loaded VLM scores for ${Object.keys(vlmScores).length} HTML files\n`,
  );

  // 4. 读取Playwright评估数据 (可选)
  console.log("📖 Reading Playwright (baseline) data...");
  const dataJsonDir = "workspace/0126-biased/data";
  const dataFiles = fs
    .readdirSync(dataJsonDir)
    .filter((f) => f.endsWith(".json"));

  const playwrightScores = {};
  dataFiles.forEach((file) => {
    const htmlId = file.replace(".json", "");
    try {
      const data = JSON.parse(
        fs.readFileSync(path.join(dataJsonDir, file), "utf-8"),
      );

      // 如果有testStats，计算pass rate
      if (data.testStats && data.testStats.total > 0) {
        playwrightScores[htmlId] = data.testStats.passed / data.testStats.total;
      } else if (
        data.evaluation &&
        data.evaluation.score !== null &&
        data.evaluation.score !== undefined
      ) {
        // 如果有evaluation.score
        playwrightScores[htmlId] = data.evaluation.score;
      }
    } catch (err) {
      // Skip files that can't be read
    }
  });

  const hasPlaywrightData = Object.keys(playwrightScores).length > 0;
  console.log(
    `✅ Loaded Playwright scores for ${Object.keys(playwrightScores).length} HTML files${hasPlaywrightData ? "" : " (skipping Playwright analysis)"}\n`,
  );

  // 5. 匹配数据：找到同时存在于所有数据集的HTML
  console.log("🔗 Matching data across all sources...");

  // 基础匹配：FSM + VLM + Human
  let commonHtmlIds = Object.keys(humanScores).filter(
    (id) => fsmScores[id] !== undefined && vlmScores[id] !== undefined,
  );

  console.log(
    `✅ Found ${commonHtmlIds.length} HTML files with FSM + VLM + Human data\n`,
  );

  if (hasPlaywrightData) {
    const withPlaywright = commonHtmlIds.filter(
      (id) => playwrightScores[id] !== undefined,
    );
    console.log(
      `   (${withPlaywright.length} files also have Playwright data)\n`,
    );
  }

  if (commonHtmlIds.length < 3) {
    console.error(
      "❌ Error: Not enough matched data points for correlation analysis",
    );
    return;
  }

  // 6. 准备数据数组
  const datasets = {
    fsm: commonHtmlIds.map((id) => fsmScores[id]),
    vlm: commonHtmlIds.map((id) => vlmScores[id]),
    human: {
      functional: commonHtmlIds.map((id) => humanScores[id].functional),
      visual: commonHtmlIds.map((id) => humanScores[id].visual),
      pedagogical: commonHtmlIds.map((id) => humanScores[id].pedagogical),
      interactivity: commonHtmlIds.map((id) => humanScores[id].interactivity),
    },
  };

  // 如果有Playwright数据，添加到datasets
  if (hasPlaywrightData) {
    // 只保留也有Playwright数据的HTML
    const withPlaywrightIds = commonHtmlIds.filter(
      (id) => playwrightScores[id] !== undefined,
    );
    if (withPlaywrightIds.length >= 3) {
      datasets.playwright = withPlaywrightIds.map((id) => playwrightScores[id]);
      // 更新其他数据集
      commonHtmlIds = withPlaywrightIds;
      datasets.fsm = withPlaywrightIds.map((id) => fsmScores[id]);
      datasets.vlm = withPlaywrightIds.map((id) => vlmScores[id]);
      datasets.human = {
        functional: withPlaywrightIds.map((id) => humanScores[id].functional),
        visual: withPlaywrightIds.map((id) => humanScores[id].visual),
        pedagogical: withPlaywrightIds.map((id) => humanScores[id].pedagogical),
        interactivity: withPlaywrightIds.map(
          (id) => humanScores[id].interactivity,
        ),
      };
    }
  }

  // 7. 计算相关性
  console.log("📈 Computing correlations...\n");

  const results = {
    metadata: {
      timestamp: new Date().toISOString(),
      sample_size: commonHtmlIds.length,
      human_data_source: humanDataPath,
      fsm_data_source: fsmDataPath,
      vlm_data_source: vlmDir,
      playwright_data_source:
        hasPlaywrightData && datasets.playwright
          ? dataJsonDir
          : "N/A (not available)",
      frameworks_analyzed:
        hasPlaywrightData && datasets.playwright
          ? ["fsm", "vlm", "playwright"]
          : ["fsm", "vlm"],
    },
    correlations: {},
  };

  const frameworks =
    hasPlaywrightData && datasets.playwright
      ? ["fsm", "vlm", "playwright"]
      : ["fsm", "vlm"];
  const humanDimensions = [
    "functional",
    "visual",
    "pedagogical",
    "interactivity",
  ];

  frameworks.forEach((framework) => {
    results.correlations[framework] = {};

    humanDimensions.forEach((dimension) => {
      const x = datasets[framework];
      const y = datasets.human[dimension];

      const r = pearsonCorrelation(x, y);
      const n = x.length;
      const pValue = calculatePValue(r, n);
      const ci = calculateConfidenceInterval(r, n);
      const interpretation = interpretCorrelation(r);

      results.correlations[framework][dimension] = {
        r,
        n,
        p_value: pValue,
        confidence_interval_95: ci,
        interpretation,
        significant: pValue < 0.05,
      };
    });
  });

  // 8. 输出结果
  console.log("═".repeat(80));
  console.log("📊 CORRELATION ANALYSIS RESULTS");
  console.log("═".repeat(80));
  console.log(`\n📋 Sample Size: N = ${results.metadata.sample_size}\n`);

  // 创建表格
  console.log(
    "┌─────────────────┬────────────┬──────────┬───────────┬─────────────────────────┬──────────────┐",
  );
  console.log(
    "│ Framework       │ Dimension  │    r     │  p-value  │   95% CI                │ Significance │",
  );
  console.log(
    "├─────────────────┼────────────┼──────────┼───────────┼─────────────────────────┼──────────────┤",
  );

  const frameworkNames = {
    fsm: "FSM-based",
    vlm: "VLM (Visual)",
    playwright: "Playwright",
  };

  frameworks.forEach((framework) => {
    humanDimensions.forEach((dimension, idx) => {
      const result = results.correlations[framework][dimension];
      const frameworkLabel = idx === 0 ? frameworkNames[framework] : "";
      const dimLabel = dimension.charAt(0).toUpperCase() + dimension.slice(1);
      const ciStr =
        result.confidence_interval_95.lower !== null
          ? `[${result.confidence_interval_95.lower.toFixed(3)}, ${result.confidence_interval_95.upper.toFixed(3)}]`
          : "N/A";
      const sigStr = result.significant ? "✓ (p < 0.05)" : "✗ (n.s.)";

      console.log(
        `│ ${frameworkLabel.padEnd(15)} │ ${dimLabel.padEnd(10)} │ ${result.r.toFixed(3).padStart(8)} │ ${result.p_value.toFixed(4).padStart(9)} │ ${ciStr.padEnd(23)} │ ${sigStr.padEnd(12)} │`,
      );
    });
    if (framework !== frameworks[frameworks.length - 1]) {
      console.log(
        "├─────────────────┼────────────┼──────────┼───────────┼─────────────────────────┼──────────────┤",
      );
    }
  });

  console.log(
    "└─────────────────┴────────────┴──────────┴───────────┴─────────────────────────┴──────────────┘",
  );

  // 9. 统计摘要
  console.log("\n" + "═".repeat(80));
  console.log("📊 STATISTICAL SUMMARY");
  console.log("═".repeat(80) + "\n");

  frameworks.forEach((framework) => {
    console.log(`\n🔹 ${frameworkNames[framework]} Framework:`);

    humanDimensions.forEach((dimension) => {
      const result = results.correlations[framework][dimension];
      console.log(`\n   ${dimension.toUpperCase()}:`);
      console.log(
        `      Correlation: r = ${result.r.toFixed(3)} (${result.interpretation})`,
      );
      console.log(
        `      Significance: p = ${result.p_value.toFixed(4)} ${result.significant ? "(significant)" : "(not significant)"}`,
      );
      if (result.confidence_interval_95.lower !== null) {
        console.log(
          `      95% CI: [${result.confidence_interval_95.lower.toFixed(3)}, ${result.confidence_interval_95.upper.toFixed(3)}]`,
        );
      }
      console.log(`      Direction: ${result.r > 0 ? "Positive" : "Negative"}`);
    });
  });

  // 10. 关键发现
  console.log("\n" + "═".repeat(80));
  console.log("🔑 KEY FINDINGS");
  console.log("═".repeat(80) + "\n");

  // 找出每个维度中相关性最高的框架
  humanDimensions.forEach((dimension) => {
    const correlations = frameworks.map((fw) => ({
      framework: frameworkNames[fw],
      r: results.correlations[fw][dimension].r,
      significant: results.correlations[fw][dimension].significant,
    }));

    correlations.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

    console.log(`📌 ${dimension.toUpperCase()} Dimension:`);
    console.log(
      `   Best predictor: ${correlations[0].framework} (r = ${correlations[0].r.toFixed(3)})`,
    );
    if (correlations[0].significant) {
      console.log(`   ✓ Statistically significant correlation\n`);
    } else {
      console.log(`   ✗ Correlation not statistically significant\n`);
    }
  });

  // 11. 保存结果
  const outputPath = "framework-human-correlation-data.json";
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n✅ Results saved to: ${outputPath}`);

  // 12. 生成HTML报告
  generateHTMLReport(results, frameworkNames, humanDimensions);

  console.log(
    "✅ HTML report saved to: framework-human-correlation-report.html\n",
  );
  console.log("✨ Analysis complete!\n");

  return results;
}

// 生成HTML报告
function generateHTMLReport(results, frameworkNames, humanDimensions) {
  const frameworks = results.metadata.frameworks_analyzed; // Use actual frameworks from results

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Framework-Human Correlation Analysis</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 20px;
            line-height: 1.6;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 {
            color: #2d3748;
            font-size: 2.5em;
            margin-bottom: 10px;
            text-align: center;
        }
        .subtitle {
            text-align: center;
            color: #718096;
            margin-bottom: 40px;
            font-size: 1.1em;
        }
        .meta-info {
            background: #f7fafc;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 30px;
            border-left: 4px solid #667eea;
        }
        .meta-info h3 {
            color: #2d3748;
            margin-bottom: 10px;
        }
        .meta-info p {
            color: #4a5568;
            margin: 5px 0;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 30px 0;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        th {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px;
            text-align: left;
            font-weight: 600;
        }
        td {
            padding: 15px;
            border-bottom: 1px solid #e2e8f0;
        }
        tr:hover {
            background: #f7fafc;
        }
        .correlation-cell {
            font-weight: bold;
        }
        .positive { color: #48bb78; }
        .negative { color: #f56565; }
        .weak { opacity: 0.6; }
        .significant {
            background: #c6f6d5;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.9em;
        }
        .not-significant {
            background: #fed7d7;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.9em;
        }
        .section {
            margin: 40px 0;
        }
        .section h2 {
            color: #2d3748;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 3px solid #667eea;
        }
        .finding {
            background: #edf2f7;
            padding: 20px;
            margin: 15px 0;
            border-radius: 10px;
            border-left: 4px solid #4299e1;
        }
        .finding h4 {
            color: #2d3748;
            margin-bottom: 10px;
        }
        .finding p {
            color: #4a5568;
        }
        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: 600;
            margin-left: 10px;
        }
        .badge-strong { background: #48bb78; color: white; }
        .badge-moderate { background: #ed8936; color: white; }
        .badge-weak { background: #ecc94b; color: #2d3748; }
        .badge-very-weak { background: #cbd5e0; color: #2d3748; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔬 Framework-Human Correlation Analysis</h1>
        <p class="subtitle">Evaluating the alignment of automated evaluation frameworks with human judgment</p>
        
        <div class="meta-info">
            <h3>📋 Analysis Metadata</h3>
            <p><strong>Sample Size:</strong> N = ${results.metadata.sample_size}</p>
            <p><strong>Analysis Date:</strong> ${new Date(results.metadata.timestamp).toLocaleString()}</p>
            <p><strong>Statistical Method:</strong> Pearson Correlation with two-tailed significance test</p>
            <p><strong>Confidence Level:</strong> 95% (α = 0.05)</p>
        </div>

        <div class="section">
            <h2>📊 Correlation Results</h2>
            <table>
                <thead>
                    <tr>
                        <th>Framework</th>
                        <th>Human Dimension</th>
                        <th>Correlation (r)</th>
                        <th>p-value</th>
                        <th>95% CI</th>
                        <th>Significance</th>
                        <th>Interpretation</th>
                    </tr>
                </thead>
                <tbody>
${frameworks
  .map((fw) =>
    humanDimensions
      .map((dim, idx) => {
        const result = results.correlations[fw][dim];
        const ciStr =
          result.confidence_interval_95.lower !== null
            ? `[${result.confidence_interval_95.lower.toFixed(3)}, ${result.confidence_interval_95.upper.toFixed(3)}]`
            : "N/A";
        const corrClass = result.r > 0 ? "positive" : "negative";
        const strengthClass = result.interpretation
          .toLowerCase()
          .replace(" ", "-");

        return `                    <tr>
                        ${idx === 0 ? `<td rowspan="4"><strong>${frameworkNames[fw]}</strong></td>` : ""}
                        <td>${dim.charAt(0).toUpperCase() + dim.slice(1)}</td>
                        <td class="correlation-cell ${corrClass}">${result.r.toFixed(3)}</td>
                        <td>${result.p_value.toFixed(4)}</td>
                        <td>${ciStr}</td>
                        <td><span class="${result.significant ? "significant" : "not-significant"}">${result.significant ? "✓ Significant" : "✗ Not Sig."}</span></td>
                        <td><span class="badge badge-${strengthClass}">${result.interpretation}</span></td>
                    </tr>`;
      })
      .join("\n"),
  )
  .join("\n")}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>🔑 Key Findings</h2>
${humanDimensions
  .map((dimension) => {
    const correlations = frameworks.map((fw) => ({
      framework: frameworkNames[fw],
      r: results.correlations[fw][dimension].r,
      absR: Math.abs(results.correlations[fw][dimension].r),
      significant: results.correlations[fw][dimension].significant,
      interpretation: results.correlations[fw][dimension].interpretation,
    }));

    correlations.sort((a, b) => b.absR - a.absR);

    return `            <div class="finding">
                <h4>📌 ${dimension.toUpperCase()} Dimension</h4>
                <p><strong>Best Predictor:</strong> ${correlations[0].framework} (r = ${correlations[0].r.toFixed(3)}, ${correlations[0].interpretation})</p>
                <p>${correlations[0].significant ? "✓ This correlation is statistically significant (p < 0.05)." : "✗ This correlation is not statistically significant."}</p>
                <p><strong>Ranking:</strong> ${correlations.map((c, i) => `${i + 1}. ${c.framework} (r = ${c.r.toFixed(3)})`).join(", ")}</p>
            </div>`;
  })
  .join("\n")}
        </div>

        <div class="section">
            <h2>📖 Interpretation Guide</h2>
            <div class="finding">
                <h4>Correlation Strength</h4>
                <p><span class="badge badge-strong">Strong</span> |r| ≥ 0.7 - Strong linear relationship</p>
                <p><span class="badge badge-moderate">Moderate</span> 0.5 ≤ |r| < 0.7 - Moderate linear relationship</p>
                <p><span class="badge badge-weak">Weak</span> 0.3 ≤ |r| < 0.5 - Weak linear relationship</p>
                <p><span class="badge badge-very-weak">Very Weak</span> |r| < 0.3 - Very weak or no linear relationship</p>
            </div>
            <div class="finding">
                <h4>Statistical Significance</h4>
                <p>A correlation is considered statistically significant if p-value < 0.05, meaning there is less than 5% probability that the observed correlation occurred by chance.</p>
            </div>
        </div>
    </div>
</body>
</html>`;

  fs.writeFileSync("framework-human-correlation-report.html", html);
}

// 运行分析
analyzeCorrelations().catch((error) => {
  console.error("❌ Error during analysis:", error);
  process.exit(1);
});
