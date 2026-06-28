#!/usr/bin/env node
import fs from "fs";
import path from "path";

/**
 * Analyze test score distribution and generate visualization HTML report
 * Usage: node analyze-scores.mjs <workspace-path>
 * Example: node analyze-scores.mjs workspace/11-08-0003
 */

// 计算平均值
function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// 计算标准差
function standardDeviation(arr) {
  const avg = mean(arr);
  const squareDiffs = arr.map((value) => Math.pow(value - avg, 2));
  const avgSquareDiff = mean(squareDiffs);
  return Math.sqrt(avgSquareDiff);
}

// 计算正态分布概率密度函数
function normalPDF(x, mean, stdDev) {
  const exponent = -Math.pow(x - mean, 2) / (2 * Math.pow(stdDev, 2));
  return (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
}

// 生成分数段统计
function generateScoreBins(scores, binSize = 0.1) {
  const bins = {};

  // 初始化所有分数段（0-1，步长0.1）
  for (let i = 0; i <= 1; i += binSize) {
    const binKey = i.toFixed(1);
    bins[binKey] = {
      range: `${(i * 100).toFixed(0)}-${((i + binSize) * 100).toFixed(0)}%`,
      count: 0,
      percentage: 0,
      scores: [],
    };
  }

  // 统计每个分数段的数量
  scores.forEach((score) => {
    const binIndex = Math.floor(score / binSize) * binSize;
    const binKey = Math.min(binIndex, 1.0).toFixed(1);

    if (bins[binKey]) {
      bins[binKey].count++;
      bins[binKey].scores.push(score);
    }
  });

  // 计算百分比
  const total = scores.length;
  Object.keys(bins).forEach((key) => {
    bins[key].percentage = ((bins[key].count / total) * 100).toFixed(2);
  });

  return bins;
}

// 卡方检验（简化版）
function chiSquareTest(observed, expected) {
  let chiSquare = 0;
  for (let i = 0; i < observed.length; i++) {
    if (expected[i] > 0) {
      chiSquare += Math.pow(observed[i] - expected[i], 2) / expected[i];
    }
  }
  return chiSquare;
}

// 生成HTML报告
function generateHTMLReport(stats, outputPath) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Score Distribution Analysis</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        @media print {
            body { margin: 0; background: white; }
            .no-print { display: none; }
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Times New Roman', Times, serif;
            background: white;
            color: #000;
            padding: 40px;
            line-height: 1.6;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        h1 {
            font-size: 18pt;
            font-weight: bold;
            text-align: center;
            margin-bottom: 30px;
            color: #000;
            letter-spacing: 0.5px;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-bottom: 40px;
            border: 1px solid #000;
        }
        
        .stat-card {
            background: white;
            padding: 15px;
            border-right: 1px solid #000;
            border-bottom: 1px solid #000;
            text-align: center;
        }
        
        .stat-card:nth-child(3n) {
            border-right: none;
        }
        
        .stat-label {
            font-size: 10pt;
            margin-bottom: 8px;
            font-weight: normal;
            color: #000;
        }
        
        .stat-value {
            font-size: 16pt;
            font-weight: bold;
            color: #000;
            font-family: 'Times New Roman', Times, serif;
        }
        
        .chart-container {
            background: white;
            padding: 20px;
            margin-bottom: 40px;
            border: 1px solid #000;
        }
        
        .chart-title {
            font-size: 12pt;
            font-weight: bold;
            color: #000;
            margin-bottom: 15px;
            text-align: center;
        }
        
        canvas {
            max-height: 400px;
            image-rendering: -webkit-optimize-contrast;
            image-rendering: crisp-edges;
        }
        
        .distribution-table {
            background: white;
            padding: 20px;
            margin-bottom: 40px;
            border: 1px solid #000;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10pt;
        }
        
        th, td {
            padding: 8px 12px;
            text-align: center;
            border: 1px solid #000;
        }
        
        th {
            background: #f0f0f0;
            font-weight: bold;
            color: #000;
        }
        
        .progress-bar {
            height: 16px;
            background: white;
            border: 1px solid #000;
            position: relative;
            margin: 0 auto;
            width: 100%;
        }
        
        .progress-fill {
            height: 100%;
            background: repeating-linear-gradient(
                45deg,
                #000,
                #000 2px,
                #fff 2px,
                #fff 4px
            );
        }
        
        .analysis-section {
            background: white;
            padding: 20px;
            margin-bottom: 40px;
            border: 1px solid #000;
        }
        
        .analysis-title {
            font-size: 12pt;
            font-weight: bold;
            color: #000;
            margin-bottom: 15px;
            border-bottom: 2px solid #000;
            padding-bottom: 5px;
        }
        
        .analysis-content {
            font-size: 10pt;
            color: #000;
            line-height: 1.8;
        }
        
        .analysis-content p {
            margin-bottom: 10px;
        }
        
        .conclusion {
            border: 2px solid #000;
            padding: 15px;
            margin-top: 20px;
            background: #f9f9f9;
        }
        
        .percentile-info {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-top: 20px;
            border: 1px solid #000;
        }
        
        .percentile-card {
            background: #f5f5f5;
            padding: 12px;
            text-align: center;
            border-right: 1px solid #000;
        }
        
        .percentile-card:last-child {
            border-right: none;
        }
        
        .percentile-label {
            font-size: 9pt;
            color: #000;
            margin-bottom: 5px;
        }
        
        .percentile-value {
            font-size: 14pt;
            font-weight: bold;
            color: #000;
        }
        
        .figure-caption {
            font-size: 10pt;
            text-align: center;
            margin-top: 10px;
            font-style: italic;
            color: #000;
        }
        
        .table-caption {
            font-size: 10pt;
            text-align: center;
            margin-bottom: 10px;
            font-weight: bold;
            color: #000;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Test Score Distribution Analysis Report</h1>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Sample Size (n)</div>
                <div class="stat-value">${stats.total}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Mean (μ)</div>
                <div class="stat-value">${(stats.mean * 100).toFixed(2)}%</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Median</div>
                <div class="stat-value">${(stats.median * 100).toFixed(
                  2
                )}%</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Std. Dev (σ)</div>
                <div class="stat-value">${(stats.stdDev * 100).toFixed(
                  2
                )}%</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Maximum</div>
                <div class="stat-value">${(stats.max * 100).toFixed(2)}%</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Minimum</div>
                <div class="stat-value">${(stats.min * 100).toFixed(2)}%</div>
            </div>
        </div>
        
        <div class="chart-container">
            <div class="chart-title">Figure 1. Score Distribution Histogram (Observed vs. Normal Distribution)</div>
            <canvas id="histogramChart"></canvas>
            <div class="figure-caption">Comparison of observed score distribution with theoretical normal distribution (n=${
              stats.total
            }, μ=${(stats.mean * 100).toFixed(2)}%, σ=${(
    stats.stdDev * 100
  ).toFixed(2)}%)</div>
        </div>
        
        <div class="chart-container">
            <div class="chart-title">Figure 2. Cumulative Distribution Function (CDF)</div>
            <canvas id="cdfChart"></canvas>
            <div class="figure-caption">Empirical cumulative distribution function of test scores</div>
        </div>
        
        <div class="distribution-table">
            <div class="table-caption">Table I. Score Range Distribution Statistics</div>
            <table>
                <thead>
                    <tr>
                        <th>Score Range</th>
                        <th>Count</th>
                        <th>Percentage</th>
                        <th>Visualization</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(stats.bins)
                      .map(
                        ([key, bin]) => `
                    <tr>
                        <td><strong>${bin.range}</strong></td>
                        <td>${bin.count}</td>
                        <td>${bin.percentage}%</td>
                        <td>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${bin.percentage}%"></div>
                            </div>
                        </td>
                    </tr>
                    `
                      )
                      .join("")}
                </tbody>
            </table>
        </div>
        
        <div class="analysis-section">
            <div class="analysis-title">I. DISTRIBUTION CHARACTERISTICS</div>
            <div class="analysis-content">
                <p><strong>A. Skewness:</strong> ${stats.skewness.toFixed(
                  3
                )}</p>
                <p style="margin-left: 20px;">
                    ${
                      Math.abs(stats.skewness) < 0.5
                        ? "The distribution exhibits near-symmetric characteristics, consistent with normal distribution properties."
                        : stats.skewness > 0
                        ? "The distribution shows positive skewness (right-skewed), indicating a concentration of lower scores."
                        : "The distribution shows negative skewness (left-skewed), indicating a concentration of higher scores."
                    }
                </p>
                
                <p style="margin-top: 15px;"><strong>B. Kurtosis:</strong> ${stats.kurtosis.toFixed(
                  3
                )}</p>
                <p style="margin-left: 20px;">
                    ${
                      Math.abs(stats.kurtosis) < 0.5
                        ? "The kurtosis value approximates that of a normal distribution (excess kurtosis ≈ 0)."
                        : stats.kurtosis > 0
                        ? "The distribution exhibits leptokurtic characteristics (positive excess kurtosis), indicating high concentration around the mean."
                        : "The distribution exhibits platykurtic characteristics (negative excess kurtosis), indicating high dispersion."
                    }
                </p>
                
                <p style="margin-top: 15px;"><strong>C. Chi-Square Test Statistic:</strong> ${stats.chiSquare.toFixed(
                  3
                )}</p>
                <p style="margin-left: 20px;">
                    ${
                      stats.chiSquare < 15.507
                        ? "The distribution passes the normality test (χ² < 15.507, p > 0.05, df=9)."
                        : stats.chiSquare < 20.09
                        ? "The distribution marginally passes the normality test (p ≈ 0.05)."
                        : "The distribution fails the normality test (χ² > 20.09, p < 0.05, df=9)."
                    }
                </p>
                
                <div style="margin-top: 20px;">
                    <p><strong>D. Percentile Analysis:</strong></p>
                    <div class="percentile-info">
                        <div class="percentile-card">
                            <div class="percentile-label">25th Percentile</div>
                            <div class="percentile-value">${(
                              stats.percentiles.p25 * 100
                            ).toFixed(1)}%</div>
                        </div>
                        <div class="percentile-card">
                            <div class="percentile-label">50th Percentile</div>
                            <div class="percentile-value">${(
                              stats.percentiles.p50 * 100
                            ).toFixed(1)}%</div>
                        </div>
                        <div class="percentile-card">
                            <div class="percentile-label">75th Percentile</div>
                            <div class="percentile-value">${(
                              stats.percentiles.p75 * 100
                            ).toFixed(1)}%</div>
                        </div>
                        <div class="percentile-card">
                            <div class="percentile-label">90th Percentile</div>
                            <div class="percentile-value">${(
                              stats.percentiles.p90 * 100
                            ).toFixed(1)}%</div>
                        </div>
                    </div>
                </div>
                
                <div class="conclusion">
                    <strong>II. NORMALITY ASSESSMENT</strong>
                    <p style="margin-top: 10px;">
                        Normality Score: ${(stats.normalityScore * 100).toFixed(
                          1
                        )}%
                    </p>
                    <p style="margin-top: 10px;">
                        ${
                          stats.normalityScore >= 0.8
                            ? "The score distribution demonstrates strong adherence to normality, indicating reliable test results with appropriate difficulty calibration."
                            : stats.normalityScore >= 0.6
                            ? "The score distribution partially conforms to normality. Further optimization of test cases is recommended to improve distribution characteristics."
                            : "The score distribution exhibits significant deviation from normality. Review of test design and implementation quality is strongly recommended."
                        }
                    </p>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        // Configure Chart.js for academic black and white style
        Chart.defaults.font.family = "'Times New Roman', Times, serif";
        Chart.defaults.font.size = 11;
        Chart.defaults.color = '#000';
        Chart.defaults.borderColor = '#000';
        
        // Histogram Chart - Observed vs Normal Distribution
        const histogramCtx = document.getElementById('histogramChart').getContext('2d');
        new Chart(histogramCtx, {
            type: 'bar',
            data: {
                labels: ${JSON.stringify(
                  Object.values(stats.bins).map((b) => b.range)
                )},
                datasets: [{
                    label: 'Observed Distribution',
                    data: ${JSON.stringify(
                      Object.values(stats.bins).map((b) => b.count)
                    )},
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    borderColor: '#000',
                    borderWidth: 1
                }, {
                    label: 'Theoretical Normal Distribution',
                    data: ${JSON.stringify(stats.expectedNormal)},
                    type: 'line',
                    borderColor: '#000',
                    backgroundColor: 'rgba(0, 0, 0, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    borderDash: [5, 5],
                    pointRadius: 3,
                    pointBackgroundColor: '#000',
                    pointBorderColor: '#000'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#000',
                            font: {
                                family: "'Times New Roman', Times, serif",
                                size: 11
                            },
                            usePointStyle: true,
                            boxWidth: 15
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        titleColor: '#000',
                        bodyColor: '#000',
                        borderColor: '#000',
                        borderWidth: 1
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Frequency',
                            color: '#000',
                            font: {
                                family: "'Times New Roman', Times, serif",
                                size: 12,
                                weight: 'bold'
                            }
                        },
                        ticks: {
                            color: '#000'
                        },
                        grid: {
                            color: '#ccc',
                            drawBorder: true,
                            borderColor: '#000',
                            borderWidth: 2
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Score Range (%)',
                            color: '#000',
                            font: {
                                family: "'Times New Roman', Times, serif",
                                size: 12,
                                weight: 'bold'
                            }
                        },
                        ticks: {
                            color: '#000'
                        },
                        grid: {
                            color: '#ccc',
                            drawBorder: true,
                            borderColor: '#000',
                            borderWidth: 2
                        }
                    }
                }
            }
        });
        
        // CDF Chart
        const cdfCtx = document.getElementById('cdfChart').getContext('2d');
        new Chart(cdfCtx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(stats.cdfData.labels)},
                datasets: [{
                    label: 'Cumulative Distribution',
                    data: ${JSON.stringify(stats.cdfData.values)},
                    borderColor: '#000',
                    backgroundColor: 'rgba(0, 0, 0, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 2,
                    pointBackgroundColor: '#000',
                    pointBorderColor: '#000'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            color: '#000',
                            font: {
                                family: "'Times New Roman', Times, serif",
                                size: 11
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        titleColor: '#000',
                        bodyColor: '#000',
                        borderColor: '#000',
                        borderWidth: 1
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Cumulative Percentage (%)',
                            color: '#000',
                            font: {
                                family: "'Times New Roman', Times, serif",
                                size: 12,
                                weight: 'bold'
                            }
                        },
                        ticks: {
                            color: '#000'
                        },
                        grid: {
                            color: '#ccc',
                            drawBorder: true,
                            borderColor: '#000',
                            borderWidth: 2
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Score (%)',
                            color: '#000',
                            font: {
                                family: "'Times New Roman', Times, serif",
                                size: 12,
                                weight: 'bold'
                            }
                        },
                        ticks: {
                            color: '#000'
                        },
                        grid: {
                            color: '#ccc',
                            drawBorder: true,
                            borderColor: '#000',
                            borderWidth: 2
                        }
                    }
                }
            }
        });
    </script>
</body>
</html>`;

  fs.writeFileSync(outputPath, html, "utf8");
}

// Helper function to calculate pass rate
function calculatePassRate(testResults) {
  const passed = testResults.filter((t) => t.status === "passed").length;
  const total = testResults.length;
  return total > 0 ? passed / total : 0;
}

// Extract scores from test-results/results.json (new format)
function extractScoresFromTestResults(workspacePath) {
  const resultsPath = path.join(workspacePath, "test-results", "results.json");

  if (!fs.existsSync(resultsPath)) {
    return null;
  }

  const testResults = JSON.parse(fs.readFileSync(resultsPath, "utf8"));

  if (!testResults.suites || testResults.suites.length === 0) {
    return null;
  }

  const scores = [];

  testResults.suites.forEach((suite) => {
    if (suite.suites && suite.suites.length > 0) {
      suite.suites.forEach((subSuite) => {
        if (subSuite.specs && subSuite.specs.length > 0) {
          const allTests = [];
          subSuite.specs.forEach((spec) => {
            if (spec.tests && spec.tests.length > 0) {
              spec.tests.forEach((test) => {
                if (test.results && test.results.length > 0) {
                  allTests.push(...test.results);
                }
              });
            }
          });

          if (allTests.length > 0) {
            const passRate = calculatePassRate(allTests);
            scores.push(passRate);
          }
        }
      });
    }
  });

  return scores.length > 0 ? scores : null;
}

// Extract scores from data/data.json (old format)
function extractScoresFromDataJson(workspacePath) {
  const dataPath = path.join(workspacePath, "data", "data.json");

  if (!fs.existsSync(dataPath)) {
    return null;
  }

  const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const dataArray = Array.isArray(data) ? data : Object.values(data);
  const scores = [];

  dataArray.forEach((item) => {
    if (item.testStats && typeof item.testStats.score === "number") {
      scores.push(item.testStats.score);
    }
  });

  return scores.length > 0 ? scores : null;
}

function analyzeScores(workspacePath) {
  // Try new format first (test-results/results.json)
  let scores = extractScoresFromTestResults(workspacePath);
  let dataSource = "test-results/results.json (pass rates)";

  // Fall back to old format (data/data.json)
  if (!scores) {
    scores = extractScoresFromDataJson(workspacePath);
    dataSource = "data/data.json (test scores)";
  }

  if (!scores) {
    console.error("❌ No valid score data found");
    console.error("   Tried:");
    console.error("   - test-results/results.json");
    console.error("   - data/data.json");
    process.exit(1);
  }

  console.log(
    `📊 Analyzing ${scores.length} test scores from ${dataSource}...\n`
  );

  // 排序
  const sortedScores = [...scores].sort((a, b) => a - b);

  // 基本统计
  const avg = mean(scores);
  const stdDev = standardDeviation(scores);
  const median = sortedScores[Math.floor(sortedScores.length / 2)];
  const min = Math.min(...scores);
  const max = Math.max(...scores);

  // 百分位数
  const getPercentile = (arr, p) => {
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, index)];
  };

  const percentiles = {
    p25: getPercentile(sortedScores, 25),
    p50: median,
    p75: getPercentile(sortedScores, 75),
    p90: getPercentile(sortedScores, 90),
  };

  // 计算偏度和峰度
  const n = scores.length;
  const m3 = scores.reduce((sum, x) => sum + Math.pow(x - avg, 3), 0) / n;
  const m4 = scores.reduce((sum, x) => sum + Math.pow(x - avg, 4), 0) / n;
  const skewness = m3 / Math.pow(stdDev, 3);
  const kurtosis = m4 / Math.pow(stdDev, 4) - 3;

  // 生成分数段统计
  const bins = generateScoreBins(scores, 0.1);

  // 计算期望的正态分布
  const expectedNormal = Object.keys(bins).map((key) => {
    const binStart = parseFloat(key);
    const binEnd = binStart + 0.1;
    const binMid = (binStart + binEnd) / 2;

    // 计算该分数段在正态分布下的期望频数
    const probability = normalPDF(binMid, avg, stdDev) * 0.1; // 区间宽度
    return probability * scores.length;
  });

  // 卡方检验
  const observed = Object.values(bins).map((b) => b.count);
  const chiSquare = chiSquareTest(observed, expectedNormal);

  // 生成CDF数据
  const cdfData = {
    labels: [],
    values: [],
  };

  for (let i = 0; i <= 100; i += 5) {
    const score = i / 100;
    const count = sortedScores.filter((s) => s <= score).length;
    const percentage = (count / scores.length) * 100;
    cdfData.labels.push(`${i}%`);
    cdfData.values.push(percentage);
  }

  // 计算正态性综合评分（0-1）
  const skewnessScore = Math.max(0, 1 - Math.abs(skewness) / 2);
  const kurtosisScore = Math.max(0, 1 - Math.abs(kurtosis) / 3);
  const chiSquareScore = Math.max(0, 1 - chiSquare / 30);
  const normalityScore = (skewnessScore + kurtosisScore + chiSquareScore) / 3;

  const stats = {
    total: scores.length,
    mean: avg,
    median,
    stdDev,
    min,
    max,
    percentiles,
    skewness,
    kurtosis,
    chiSquare,
    normalityScore,
    bins,
    expectedNormal,
    cdfData,
  };

  // 输出控制台摘要
  console.log("📈 Basic Statistics:");
  console.log(`   Sample Size: ${stats.total}`);
  console.log(`   Mean: ${(avg * 100).toFixed(2)}%`);
  console.log(`   Median: ${(median * 100).toFixed(2)}%`);
  console.log(`   Std. Deviation: ${(stdDev * 100).toFixed(2)}%`);
  console.log(`   Maximum: ${(max * 100).toFixed(2)}%`);
  console.log(`   Minimum: ${(min * 100).toFixed(2)}%`);

  console.log("\n📊 Distribution Characteristics:");
  console.log(`   Skewness: ${skewness.toFixed(3)}`);
  console.log(`   Kurtosis: ${kurtosis.toFixed(3)}`);
  console.log(`   Chi-Square: ${chiSquare.toFixed(3)}`);
  console.log(`   Normality Score: ${(normalityScore * 100).toFixed(1)}%`);

  console.log("\n📉 Percentiles:");
  console.log(`   25%: ${(percentiles.p25 * 100).toFixed(1)}%`);
  console.log(`   50%: ${(percentiles.p50 * 100).toFixed(1)}%`);
  console.log(`   75%: ${(percentiles.p75 * 100).toFixed(1)}%`);
  console.log(`   90%: ${(percentiles.p90 * 100).toFixed(1)}%`);

  console.log("\n📋 Score Distribution:");
  Object.entries(bins).forEach(([key, bin]) => {
    if (bin.count > 0) {
      const bar = "█".repeat(Math.ceil(parseFloat(bin.percentage) / 2));
      console.log(
        `   ${bin.range.padEnd(10)} | ${bar} ${bin.count} (${bin.percentage}%)`
      );
    }
  });

  // 生成HTML报告
  const reportPath = path.join(workspacePath, "score-analysis-report.html");
  generateHTMLReport(stats, reportPath);
  console.log(`\n✅ Analysis report generated: ${reportPath}`);

  // 正态性结论
  console.log("\n🎯 Normality Conclusion:");
  if (normalityScore >= 0.8) {
    console.log("   ✅ Score distribution conforms to normality");
  } else if (normalityScore >= 0.6) {
    console.log("   ⚠️  Score distribution partially conforms to normality");
  } else {
    console.log(
      "   ❌ Score distribution deviates significantly from normality"
    );
  }
}

// 主程序
const workspacePath = process.argv[2];

if (!workspacePath) {
  console.error("Usage: node analyze-scores.mjs <workspace-path>");
  console.error("Example: node analyze-scores.mjs workspace/11-08-0003");
  process.exit(1);
}

analyzeScores(workspacePath);
