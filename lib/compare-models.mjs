#!/usr/bin/env node
import fs from "fs";
import path from "path";

/**
 * Compare score distributions across multiple models and generate comparison report
 * Usage: node compare-models.mjs <workspace-path-1> <workspace-path-2> [workspace-path-3] ...
 * Example: node compare-models.mjs workspace/baseline-html2test-gpt-3.5-turbo workspace/baseline-html2test-gpt-4o workspace/baseline-html2test-gpt-5-mini
 */

// Calculate mean
function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// Calculate standard deviation
function standardDeviation(arr) {
  const avg = mean(arr);
  const squareDiffs = arr.map((value) => Math.pow(value - avg, 2));
  const avgSquareDiff = mean(squareDiffs);
  return Math.sqrt(avgSquareDiff);
}

// Helper function to calculate pass rate
function calculatePassRate(testResults) {
  const passed = testResults.filter((t) => t.status === "passed").length;
  const total = testResults.length;
  return total > 0 ? passed / total : 0;
}

// Extract scores from test-results/results.json
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

// Extract scores from data/data.json
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

// Extract model name from workspace path
function extractModelName(workspacePath) {
  const basename = path.basename(workspacePath);
  // Extract model name from patterns like "baseline-html2test-gpt-4o"
  const match = basename.match(/gpt-[^\/]+$/i);
  if (match) {
    return match[0];
  }
  return basename;
}

// Generate score bins for distribution
function generateScoreBins(scores, binSize = 0.1) {
  const bins = {};

  for (let i = 0; i <= 1; i += binSize) {
    const binKey = i.toFixed(1);
    bins[binKey] = {
      range: `${(i * 100).toFixed(0)}-${((i + binSize) * 100).toFixed(0)}%`,
      count: 0,
      percentage: 0,
    };
  }

  scores.forEach((score) => {
    const binIndex = Math.floor(score / binSize) * binSize;
    const binKey = Math.min(binIndex, 1.0).toFixed(1);
    if (bins[binKey]) {
      bins[binKey].count++;
    }
  });

  const total = scores.length;
  Object.keys(bins).forEach((key) => {
    bins[key].percentage = ((bins[key].count / total) * 100).toFixed(2);
  });

  return bins;
}

// Calculate CDF data
function calculateCDF(scores) {
  const sortedScores = [...scores].sort((a, b) => a - b);
  const cdfData = { labels: [], values: [] };

  for (let i = 0; i <= 100; i += 5) {
    const score = i / 100;
    const count = sortedScores.filter((s) => s <= score).length;
    const percentage = (count / scores.length) * 100;
    cdfData.labels.push(`${i}%`);
    cdfData.values.push(percentage);
  }

  return cdfData;
}

// Generate HTML comparison report
function generateComparisonReport(modelsData, outputPath) {
  const colors = [
    { line: "#1f77b4", bg: "rgba(31, 119, 180, 0.1)", dash: [] }, // Blue (solid)
    { line: "#ff7f0e", bg: "rgba(255, 127, 14, 0.1)", dash: [5, 5] }, // Orange (dashed)
    { line: "#2ca02c", bg: "rgba(44, 160, 44, 0.1)", dash: [10, 5] }, // Green (long dash)
    { line: "#d62728", bg: "rgba(214, 39, 40, 0.1)", dash: [2, 2] }, // Red (dotted)
    { line: "#9467bd", bg: "rgba(148, 103, 189, 0.1)", dash: [8, 4, 2, 4] }, // Purple (dash-dot)
    { line: "#8c564b", bg: "rgba(140, 86, 75, 0.1)", dash: [12, 3] }, // Brown (custom dash)
  ];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Model Score Distribution Comparison</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        @media print {
            body { margin: 0; background: white; }
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
        
        .summary-table {
            background: white;
            padding: 20px;
            margin-bottom: 40px;
            border: 1px solid #000;
        }
        
        .table-caption {
            font-size: 10pt;
            text-align: center;
            margin-bottom: 10px;
            font-weight: bold;
            color: #000;
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
            max-height: 450px;
            image-rendering: -webkit-optimize-contrast;
            image-rendering: crisp-edges;
        }
        
        .figure-caption {
            font-size: 10pt;
            text-align: center;
            margin-top: 10px;
            font-style: italic;
            color: #000;
        }
        
        .legend-item {
            display: inline-block;
            margin-right: 20px;
            font-size: 10pt;
        }
        
        .legend-box {
            display: inline-block;
            width: 20px;
            height: 2px;
            background: #000;
            margin-right: 5px;
            vertical-align: middle;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Model Score Distribution Comparison Report</h1>
        
        <div class="summary-table">
            <div class="table-caption">Table I. Summary Statistics for Each Model</div>
            <table>
                <thead>
                    <tr>
                        <th>Model</th>
                        <th>Sample Size (n)</th>
                        <th>Mean (μ)</th>
                        <th>Median</th>
                        <th>Std. Dev (σ)</th>
                        <th>Min</th>
                        <th>Max</th>
                    </tr>
                </thead>
                <tbody>
                    ${modelsData
                      .map(
                        (model) => `
                    <tr>
                        <td><strong>${model.name}</strong></td>
                        <td>${model.stats.total}</td>
                        <td>${(model.stats.mean * 100).toFixed(2)}%</td>
                        <td>${(model.stats.median * 100).toFixed(2)}%</td>
                        <td>${(model.stats.stdDev * 100).toFixed(2)}%</td>
                        <td>${(model.stats.min * 100).toFixed(2)}%</td>
                        <td>${(model.stats.max * 100).toFixed(2)}%</td>
                    </tr>
                    `
                      )
                      .join("")}
                </tbody>
            </table>
        </div>
        
        <div class="chart-container">
            <div class="chart-title">Figure 1. Test Pass Rate Distribution Across Models</div>
            <canvas id="histogramChart"></canvas>
            <div class="figure-caption">Frequency distribution of test pass rates for each model. Each line represents the number of test cases falling within each score range.</div>
        </div>
        
        <div class="chart-container">
            <div class="chart-title">Figure 2. Cumulative Pass Rate Distribution</div>
            <canvas id="cdfChart"></canvas>
            <div class="figure-caption">Cumulative distribution showing the percentage of test cases achieving scores below each threshold. Curves closer to the top-right indicate better overall performance.</div>
        </div>
        
        <div class="chart-container">
            <div class="chart-title">Figure 3. Normalized Pass Rate Distribution</div>
            <canvas id="densityChart"></canvas>
            <div class="figure-caption">Percentage-based distribution showing the concentration of test scores across different ranges. Higher peaks indicate greater clustering of scores in specific ranges.</div>
        </div>
    </div>
    
    <script>
        Chart.defaults.font.family = "'Times New Roman', Times, serif";
        Chart.defaults.font.size = 11;
        Chart.defaults.color = '#000';
        Chart.defaults.borderColor = '#000';
        
        const colors = ${JSON.stringify(colors)};
        
        // Histogram Chart
        const histogramCtx = document.getElementById('histogramChart').getContext('2d');
        new Chart(histogramCtx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(
                  Object.values(modelsData[0].bins).map((b) => b.range)
                )},
                datasets: [
                    ${modelsData
                      .map(
                        (model, idx) => `
                    {
                        label: '${model.name}',
                        data: ${JSON.stringify(
                          Object.values(model.bins).map((b) => b.count)
                        )},
                        borderColor: colors[${idx % colors.length}].line,
                        backgroundColor: colors[${idx % colors.length}].bg,
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4,
                        borderDash: colors[${idx % colors.length}].dash,
                        pointRadius: 3,
                        pointBackgroundColor: colors[${
                          idx % colors.length
                        }].line,
                        pointBorderColor: colors[${idx % colors.length}].line
                    }`
                      )
                      .join(",")}
                ]
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
                            font: { family: "'Times New Roman', Times, serif", size: 11 },
                            usePointStyle: true,
                            boxWidth: 20
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
                            font: { family: "'Times New Roman', Times, serif", size: 12, weight: 'bold' }
                        },
                        ticks: { color: '#000' },
                        grid: { color: '#ccc', drawBorder: true, borderColor: '#000', borderWidth: 2 }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Score Range (%)',
                            color: '#000',
                            font: { family: "'Times New Roman', Times, serif", size: 12, weight: 'bold' }
                        },
                        ticks: { color: '#000' },
                        grid: { color: '#ccc', drawBorder: true, borderColor: '#000', borderWidth: 2 }
                    }
                }
            }
        });
        
        // CDF Chart
        const cdfCtx = document.getElementById('cdfChart').getContext('2d');
        new Chart(cdfCtx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(modelsData[0].cdf.labels)},
                datasets: [
                    ${modelsData
                      .map(
                        (model, idx) => `
                    {
                        label: '${model.name}',
                        data: ${JSON.stringify(model.cdf.values)},
                        borderColor: colors[${idx % colors.length}].line,
                        backgroundColor: colors[${idx % colors.length}].bg,
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4,
                        borderDash: colors[${idx % colors.length}].dash,
                        pointRadius: 2,
                        pointBackgroundColor: colors[${
                          idx % colors.length
                        }].line,
                        pointBorderColor: colors[${idx % colors.length}].line
                    }`
                      )
                      .join(",")}
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            color: '#000',
                            font: { family: "'Times New Roman', Times, serif", size: 11 }
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
                            font: { family: "'Times New Roman', Times, serif", size: 12, weight: 'bold' }
                        },
                        ticks: { color: '#000' },
                        grid: { color: '#ccc', drawBorder: true, borderColor: '#000', borderWidth: 2 }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Score (%)',
                            color: '#000',
                            font: { family: "'Times New Roman', Times, serif", size: 12, weight: 'bold' }
                        },
                        ticks: { color: '#000' },
                        grid: { color: '#ccc', drawBorder: true, borderColor: '#000', borderWidth: 2 }
                    }
                }
            }
        });
        
        // Density Chart (percentage-based)
        const densityCtx = document.getElementById('densityChart').getContext('2d');
        new Chart(densityCtx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(
                  Object.values(modelsData[0].bins).map((b) => b.range)
                )},
                datasets: [
                    ${modelsData
                      .map(
                        (model, idx) => `
                    {
                        label: '${model.name}',
                        data: ${JSON.stringify(
                          Object.values(model.bins).map((b) =>
                            parseFloat(b.percentage)
                          )
                        )},
                        borderColor: colors[${idx % colors.length}].line,
                        backgroundColor: colors[${idx % colors.length}].bg,
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4,
                        borderDash: colors[${idx % colors.length}].dash,
                        pointRadius: 3,
                        pointBackgroundColor: colors[${
                          idx % colors.length
                        }].line,
                        pointBorderColor: colors[${idx % colors.length}].line
                    }`
                      )
                      .join(",")}
                ]
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
                            font: { family: "'Times New Roman', Times, serif", size: 11 },
                            usePointStyle: true,
                            boxWidth: 20
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        titleColor: '#000',
                        bodyColor: '#000',
                        borderColor: '#000',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + context.parsed.y.toFixed(2) + '%';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Percentage of Samples (%)',
                            color: '#000',
                            font: { family: "'Times New Roman', Times, serif", size: 12, weight: 'bold' }
                        },
                        ticks: { 
                            color: '#000',
                            callback: function(value) {
                                return value + '%';
                            }
                        },
                        grid: { color: '#ccc', drawBorder: true, borderColor: '#000', borderWidth: 2 }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Score Range (%)',
                            color: '#000',
                            font: { family: "'Times New Roman', Times, serif", size: 12, weight: 'bold' }
                        },
                        ticks: { color: '#000' },
                        grid: { color: '#ccc', drawBorder: true, borderColor: '#000', borderWidth: 2 }
                    }
                }
            }
        });
    </script>
</body>
</html>`;

  fs.writeFileSync(outputPath, html, "utf8");
}

// Main function
function compareModels(workspacePaths, outputPath) {
  if (workspacePaths.length < 2) {
    console.error("❌ At least 2 workspaces are required for comparison");
    process.exit(1);
  }

  const modelsData = [];

  // Extract data for each model
  workspacePaths.forEach((workspacePath) => {
    console.log(`📊 Processing ${workspacePath}...`);

    // Try new format first
    let scores = extractScoresFromTestResults(workspacePath);

    // Fall back to old format
    if (!scores) {
      scores = extractScoresFromDataJson(workspacePath);
    }

    if (!scores) {
      console.error(`❌ No valid score data found in ${workspacePath}`);
      return;
    }

    const modelName = extractModelName(workspacePath);
    const sortedScores = [...scores].sort((a, b) => a - b);

    const stats = {
      total: scores.length,
      mean: mean(scores),
      median: sortedScores[Math.floor(sortedScores.length / 2)],
      stdDev: standardDeviation(scores),
      min: Math.min(...scores),
      max: Math.max(...scores),
    };

    const bins = generateScoreBins(scores);
    const cdf = calculateCDF(scores);

    modelsData.push({
      name: modelName,
      stats,
      bins,
      cdf,
    });

    console.log(
      `   ✅ ${modelName}: ${scores.length} samples, mean=${(
        stats.mean * 100
      ).toFixed(2)}%`
    );
  });

  if (modelsData.length < 2) {
    console.error("❌ At least 2 valid datasets are required");
    process.exit(1);
  }

  // Generate comparison report
  generateComparisonReport(modelsData, outputPath);
  console.log(`\n✅ Comparison report generated: ${outputPath}`);

  // Print summary table
  console.log("\n📊 Summary Statistics:");
  console.log(
    "Model".padEnd(25) +
      " n".padEnd(8) +
      "Mean".padEnd(10) +
      "Median".padEnd(10) +
      "Std Dev"
  );
  console.log("-".repeat(70));
  modelsData.forEach((model) => {
    console.log(
      model.name.padEnd(25) +
        model.stats.total.toString().padEnd(8) +
        `${(model.stats.mean * 100).toFixed(2)}%`.padEnd(10) +
        `${(model.stats.median * 100).toFixed(2)}%`.padEnd(10) +
        `${(model.stats.stdDev * 100).toFixed(2)}%`
    );
  });
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error(
    "Usage: node compare-models.mjs <workspace-path-1> <workspace-path-2> [workspace-path-3] ..."
  );
  console.error(
    "Example: node compare-models.mjs workspace/baseline-html2test-gpt-3.5-turbo workspace/baseline-html2test-gpt-4o"
  );
  process.exit(1);
}

const outputPath = "model-comparison-report.html";
compareModels(args, outputPath);
