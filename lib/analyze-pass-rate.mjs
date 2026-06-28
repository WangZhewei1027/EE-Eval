#!/usr/bin/env node
import fs from "fs";
import path from "path";

/**
 * Analyze test pass rate distribution and generate visual HTML report
 * Usage: node analyze-pass-rate.mjs <workspace-path>
 * Example: node analyze-pass-rate.mjs workspace/baseline-html2test-gpt4o
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

// Calculate normal distribution probability density function
function normalPDF(x, mean, stdDev) {
  const exponent = -Math.pow(x - mean, 2) / (2 * Math.pow(stdDev, 2));
  return (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
}

// Generate score bins statistics
function generateScoreBins(scores, binSize = 0.1) {
  const bins = {};

  // Initialize all score bins (0-1, step 0.1)
  for (let i = 0; i <= 1; i += binSize) {
    const binKey = i.toFixed(1);
    bins[binKey] = {
      range: `${(i * 100).toFixed(0)}-${((i + binSize) * 100).toFixed(0)}%`,
      count: 0,
      percentage: 0,
      scores: [],
    };
  }

  // Count scores in each bin
  scores.forEach((score) => {
    const binIndex = Math.floor(score / binSize) * binSize;
    const binKey = Math.min(binIndex, 1.0).toFixed(1);

    if (bins[binKey]) {
      bins[binKey].count++;
      bins[binKey].scores.push(score);
    }
  });

  // Calculate percentages
  const total = scores.length;
  Object.keys(bins).forEach((key) => {
    bins[key].percentage = ((bins[key].count / total) * 100).toFixed(2);
  });

  return bins;
}

// Chi-square test (simplified)
function chiSquareTest(observed, expected) {
  let chiSquare = 0;
  for (let i = 0; i < observed.length; i++) {
    if (expected[i] > 0) {
      chiSquare += Math.pow(observed[i] - expected[i], 2) / expected[i];
    }
  }
  return chiSquare;
}

// Calculate pass rate from Playwright test results
function calculatePassRate(testResults) {
  if (!testResults || testResults.length === 0) {
    return 0;
  }

  const passedTests = testResults.filter(
    (result) => result.status === "passed"
  ).length;
  return passedTests / testResults.length;
}

// Generate HTML report
function generateHTMLReport(stats, outputPath) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Pass Rate Distribution Analysis</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            min-height: 100vh;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        
        h1 {
            color: white;
            text-align: center;
            margin-bottom: 30px;
            font-size: 2.5rem;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 15px;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
        }
        
        .stat-label {
            color: #666;
            font-size: 0.9rem;
            margin-bottom: 8px;
            font-weight: 500;
        }
        
        .stat-value {
            color: #333;
            font-size: 2rem;
            font-weight: bold;
        }
        
        .stat-value.large {
            font-size: 2.5rem;
            color: #667eea;
        }
        
        .chart-container {
            background: white;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
            margin-bottom: 30px;
        }
        
        .chart-title {
            font-size: 1.5rem;
            color: #333;
            margin-bottom: 20px;
            font-weight: 600;
        }
        
        canvas {
            max-height: 400px;
        }
        
        .distribution-table {
            background: white;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
            margin-bottom: 30px;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
        }
        
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e0e0e0;
        }
        
        th {
            background: #f5f5f5;
            font-weight: 600;
            color: #333;
        }
        
        tr:hover {
            background: #f9f9f9;
        }
        
        .progress-bar {
            height: 20px;
            background: #e0e0e0;
            border-radius: 10px;
            overflow: hidden;
            position: relative;
        }
        
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            transition: width 0.3s ease;
        }
        
        .analysis-section {
            background: white;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
            margin-bottom: 30px;
        }
        
        .analysis-title {
            font-size: 1.3rem;
            color: #333;
            margin-bottom: 15px;
            font-weight: 600;
        }
        
        .analysis-content {
            color: #666;
            line-height: 1.6;
        }
        
        .conclusion {
            background: #e8f5e9;
            border-left: 4px solid #4caf50;
            padding: 15px;
            margin-top: 15px;
            border-radius: 5px;
        }
        
        .conclusion.warning {
            background: #fff3e0;
            border-left-color: #ff9800;
        }
        
        .conclusion.error {
            background: #ffebee;
            border-left-color: #f44336;
        }
        
        .percentile-info {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }
        
        .percentile-card {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 10px;
            text-align: center;
        }
        
        .percentile-label {
            font-size: 0.85rem;
            color: #666;
            margin-bottom: 5px;
        }
        
        .percentile-value {
            font-size: 1.5rem;
            font-weight: bold;
            color: #667eea;
        }

        .test-details-table {
            margin-top: 20px;
        }

        .test-details-table table {
            font-size: 0.9rem;
        }

        .test-details-table td, .test-details-table th {
            padding: 8px 12px;
        }

        .pass-rate-low {
            color: #f44336;
            font-weight: bold;
        }

        .pass-rate-medium {
            color: #ff9800;
            font-weight: bold;
        }

        .pass-rate-high {
            color: #4caf50;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Test Pass Rate Distribution Analysis Report</h1>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Total Test Files</div>
                <div class="stat-value large">${stats.total}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Average Pass Rate</div>
                <div class="stat-value">${(stats.mean * 100).toFixed(2)}%</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Median</div>
                <div class="stat-value">${(stats.median * 100).toFixed(
                  2
                )}%</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Standard Deviation</div>
                <div class="stat-value">${(stats.stdDev * 100).toFixed(
                  2
                )}%</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Maximum Pass Rate</div>
                <div class="stat-value">${(stats.max * 100).toFixed(2)}%</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Minimum Pass Rate</div>
                <div class="stat-value">${(stats.min * 100).toFixed(2)}%</div>
            </div>
        </div>
        
        <div class="chart-container">
            <div class="chart-title">Pass Rate Distribution Histogram (Actual vs Normal Distribution)</div>
            <canvas id="histogramChart"></canvas>
        </div>
        
        <div class="chart-container">
            <div class="chart-title">Cumulative Distribution Function (CDF)</div>
            <canvas id="cdfChart"></canvas>
        </div>
        
        <div class="distribution-table">
            <div class="chart-title">Pass Rate Range Statistics</div>
            <table>
                <thead>
                    <tr>
                        <th>Pass Rate Range</th>
                        <th>File Count</th>
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
            <div class="analysis-title">Low Pass Rate Test Files (Pass Rate < 50%)</div>
            <div class="test-details-table">
                ${
                  stats.lowPassRateTests.length > 0
                    ? `
                <table>
                    <thead>
                        <tr>
                            <th>File Name</th>
                            <th>Topic</th>
                            <th>Pass Rate</th>
                            <th>Passed/Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${stats.lowPassRateTests
                          .map(
                            (test) => `
                        <tr>
                            <td>${test.fileName}</td>
                            <td>${test.topic || "N/A"}</td>
                            <td class="pass-rate-low">${(
                              test.passRate * 100
                            ).toFixed(1)}%</td>
                            <td>${test.passed}/${test.total}</td>
                        </tr>
                        `
                          )
                          .join("")}
                    </tbody>
                </table>
                `
                    : `<p>No test files with pass rate below 50%</p>`
                }
            </div>
        </div>
        
        <div class="analysis-section">
            <div class="analysis-title">Distribution Characteristics Analysis</div>
            <div class="analysis-content">
                <p><strong>Skewness:</strong> ${stats.skewness.toFixed(3)}</p>
                <p style="margin-top: 10px;">
                    ${
                      Math.abs(stats.skewness) < 0.5
                        ? "Close to symmetric distribution (characteristic of normal distribution)"
                        : stats.skewness > 0
                        ? "Right-skewed distribution (more low pass rates, fewer high pass rates)"
                        : "Left-skewed distribution (more high pass rates, fewer low pass rates)"
                    }
                </p>
                
                <p style="margin-top: 15px;"><strong>Kurtosis:</strong> ${stats.kurtosis.toFixed(
                  3
                )}</p>
                <p style="margin-top: 10px;">
                    ${
                      Math.abs(stats.kurtosis) < 0.5
                        ? "Close to normal distribution kurtosis"
                        : stats.kurtosis > 0
                        ? "Leptokurtic distribution (high concentration of pass rates)"
                        : "Platykurtic distribution (high dispersion of pass rates)"
                    }
                </p>
                
                <p style="margin-top: 15px;"><strong>Chi-square Test Statistic:</strong> ${stats.chiSquare.toFixed(
                  3
                )}</p>
                <p style="margin-top: 10px;">
                    ${
                      stats.chiSquare < 15.507
                        ? "Passes normality test (p > 0.05)"
                        : stats.chiSquare < 20.09
                        ? "Marginal pass (p ≈ 0.05)"
                        : "Does not pass normality test (p < 0.05)"
                    }
                </p>
                
                <div class="percentile-info">
                    <div class="percentile-card">
                        <div class="percentile-label">25th Percentile</div>
                        <div class="percentile-value">${(
                          stats.percentiles.p25 * 100
                        ).toFixed(1)}%</div>
                    </div>
                    <div class="percentile-card">
                        <div class="percentile-label">50th Percentile (Median)</div>
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
                
                <div class="conclusion ${
                  stats.normalityScore >= 0.8
                    ? ""
                    : stats.normalityScore >= 0.6
                    ? "warning"
                    : "error"
                }">
                    <strong>Normality Score: ${(
                      stats.normalityScore * 100
                    ).toFixed(1)}%</strong>
                    <p style="margin-top: 10px;">
                        ${
                          stats.normalityScore >= 0.8
                            ? "Pass rate distribution basically follows normal distribution, test results are reliable."
                            : stats.normalityScore >= 0.6
                            ? "Pass rate distribution partially follows normal distribution, suggest further optimizing test cases."
                            : "Pass rate distribution deviates significantly from normal distribution, suggest reviewing test design and implementation quality."
                        }
                    </p>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        // Histogram - Actual vs Normal Distribution
        const histogramCtx = document.getElementById('histogramChart').getContext('2d');
        new Chart(histogramCtx, {
            type: 'bar',
            data: {
                labels: ${JSON.stringify(
                  Object.values(stats.bins).map((b) => b.range)
                )},
                datasets: [{
                    label: 'Actual Distribution',
                    data: ${JSON.stringify(
                      Object.values(stats.bins).map((b) => b.count)
                    )},
                    backgroundColor: 'rgba(102, 126, 234, 0.6)',
                    borderColor: 'rgba(102, 126, 234, 1)',
                    borderWidth: 2
                }, {
                    label: 'Theoretical Normal Distribution',
                    data: ${JSON.stringify(stats.expectedNormal)},
                    type: 'line',
                    borderColor: 'rgba(244, 67, 54, 0.8)',
                    backgroundColor: 'rgba(244, 67, 54, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'File Count'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Pass Rate Range'
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
                    borderColor: 'rgba(102, 126, 234, 1)',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Cumulative Percentage (%)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Pass Rate'
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

function analyzePassRates(workspacePath) {
  const resultsPath = path.join(workspacePath, "test-results", "results.json");

  if (!fs.existsSync(resultsPath)) {
    console.error(`Test results file not found: ${resultsPath}`);
    process.exit(1);
  }

  // Read test results
  const testResults = JSON.parse(fs.readFileSync(resultsPath, "utf8"));

  if (!testResults.suites || testResults.suites.length === 0) {
    console.error("No test suite data found");
    process.exit(1);
  }

  // Extract pass rate for each test file
  const passRates = [];
  const testDetails = [];

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
            passRates.push(passRate);

            const fileName = path.basename(suite.file);
            const passed = allTests.filter((t) => t.status === "passed").length;

            testDetails.push({
              fileName: fileName,
              topic: subSuite.title,
              passRate: passRate,
              passed: passed,
              total: allTests.length,
            });
          }
        }
      });
    }
  });

  if (passRates.length === 0) {
    console.error("No valid test pass rate data found");
    process.exit(1);
  }

  console.log(`Analyzing ${passRates.length} test files for pass rate...\n`);

  // Sort
  const sortedPassRates = [...passRates].sort((a, b) => a - b);

  // Basic statistics
  const avg = mean(passRates);
  const stdDev = standardDeviation(passRates);
  const median = sortedPassRates[Math.floor(sortedPassRates.length / 2)];
  const min = Math.min(...passRates);
  const max = Math.max(...passRates);

  // Percentiles
  const getPercentile = (arr, p) => {
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, index)];
  };

  const percentiles = {
    p25: getPercentile(sortedPassRates, 25),
    p50: median,
    p75: getPercentile(sortedPassRates, 75),
    p90: getPercentile(sortedPassRates, 90),
  };

  // Calculate skewness and kurtosis
  const n = passRates.length;
  const m3 = passRates.reduce((sum, x) => sum + Math.pow(x - avg, 3), 0) / n;
  const m4 = passRates.reduce((sum, x) => sum + Math.pow(x - avg, 4), 0) / n;
  const skewness = m3 / Math.pow(stdDev, 3);
  const kurtosis = m4 / Math.pow(stdDev, 4) - 3;

  // Generate pass rate bins
  const bins = generateScoreBins(passRates, 0.1);

  // Calculate expected normal distribution
  const expectedNormal = Object.keys(bins).map((key) => {
    const binStart = parseFloat(key);
    const binEnd = binStart + 0.1;
    const binMid = (binStart + binEnd) / 2;

    // Calculate expected frequency for this bin under normal distribution
    const probability = normalPDF(binMid, avg, stdDev) * 0.1; // Bin width
    return probability * passRates.length;
  });

  // Chi-square test
  const observed = Object.values(bins).map((b) => b.count);
  const chiSquare = chiSquareTest(observed, expectedNormal);

  // Generate CDF data
  const cdfData = {
    labels: [],
    values: [],
  };

  for (let i = 0; i <= 100; i += 5) {
    const score = i / 100;
    const count = sortedPassRates.filter((s) => s <= score).length;
    const percentage = (count / passRates.length) * 100;
    cdfData.labels.push(`${i}%`);
    cdfData.values.push(percentage);
  }

  // Calculate normality score (0-1)
  const skewnessScore = Math.max(0, 1 - Math.abs(skewness) / 2);
  const kurtosisScore = Math.max(0, 1 - Math.abs(kurtosis) / 3);
  const chiSquareScore = Math.max(0, 1 - chiSquare / 30);
  const normalityScore = (skewnessScore + kurtosisScore + chiSquareScore) / 3;

  // Find low pass rate tests
  const lowPassRateTests = testDetails
    .filter((t) => t.passRate < 0.5)
    .sort((a, b) => a.passRate - b.passRate);

  const stats = {
    total: passRates.length,
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
    lowPassRateTests,
  };

  // Output console summary
  console.log("Basic Statistics:");
  console.log(`   Total test files: ${stats.total}`);
  console.log(`   Average pass rate: ${(avg * 100).toFixed(2)}%`);
  console.log(`   Median: ${(median * 100).toFixed(2)}%`);
  console.log(`   Standard deviation: ${(stdDev * 100).toFixed(2)}%`);
  console.log(`   Maximum pass rate: ${(max * 100).toFixed(2)}%`);
  console.log(`   Minimum pass rate: ${(min * 100).toFixed(2)}%`);

  console.log("\nDistribution Characteristics:");
  console.log(`   Skewness: ${skewness.toFixed(3)}`);
  console.log(`   Kurtosis: ${kurtosis.toFixed(3)}`);
  console.log(`   Chi-square statistic: ${chiSquare.toFixed(3)}`);
  console.log(`   Normality score: ${(normalityScore * 100).toFixed(1)}%`);

  console.log("\nPercentiles:");
  console.log(`   25%: ${(percentiles.p25 * 100).toFixed(1)}%`);
  console.log(`   50%: ${(percentiles.p50 * 100).toFixed(1)}%`);
  console.log(`   75%: ${(percentiles.p75 * 100).toFixed(1)}%`);
  console.log(`   90%: ${(percentiles.p90 * 100).toFixed(1)}%`);

  console.log("\nPass Rate Distribution:");
  Object.entries(bins).forEach(([key, bin]) => {
    if (bin.count > 0) {
      const bar = "█".repeat(Math.ceil(parseFloat(bin.percentage) / 2));
      console.log(
        `   ${bin.range.padEnd(10)} | ${bar} ${bin.count} (${bin.percentage}%)`
      );
    }
  });

  if (lowPassRateTests.length > 0) {
    console.log(
      `\nLow pass rate test files (< 50%): ${lowPassRateTests.length} files`
    );
    lowPassRateTests.slice(0, 10).forEach((test) => {
      console.log(
        `   ${test.fileName.padEnd(50)} ${(test.passRate * 100).toFixed(1)}% (${
          test.passed
        }/${test.total})`
      );
    });
    if (lowPassRateTests.length > 10) {
      console.log(`   ... and ${lowPassRateTests.length - 10} more files`);
    }
  }

  // Generate HTML report
  const reportPath = path.join(workspacePath, "pass-rate-analysis-report.html");
  generateHTMLReport(stats, reportPath);
  console.log(`\nAnalysis report generated: ${reportPath}`);

  // Normality conclusion
  console.log("\nNormality Conclusion:");
  if (normalityScore >= 0.8) {
    console.log(
      "   Pass rate distribution basically follows normal distribution"
    );
  } else if (normalityScore >= 0.6) {
    console.log(
      "   Pass rate distribution partially follows normal distribution"
    );
  } else {
    console.log(
      "   Pass rate distribution deviates significantly from normal distribution"
    );
  }
}

// Main program
const workspacePath = process.argv[2];

if (!workspacePath) {
  console.error("Usage: node analyze-pass-rate.mjs <workspace-path>");
  console.error(
    "Example: node analyze-pass-rate.mjs workspace/baseline-html2test-gpt4o"
  );
  process.exit(1);
}

analyzePassRates(workspacePath);
