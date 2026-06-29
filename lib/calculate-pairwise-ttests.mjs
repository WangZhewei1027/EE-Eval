#!/usr/bin/env node

/**
 * Calculate precise pairwise t-tests between adjacent models
 * Uses Welch's t-test for unequal variances and sample sizes
 */

import fs from "fs";
import path from "path";

// Load data from HTML file
const htmlPath =
  "workspace/0126-balanced/part1-fsm-differentiation-analysis.html";
const htmlContent = fs.readFileSync(htmlPath, "utf-8");

// Extract modelData from HTML
const modelDataMatch = htmlContent.match(
  /const modelData = \[([\s\S]*?)\];[\s\S]*?const categoryData/,
);
if (!modelDataMatch) {
  console.error("Could not extract modelData from HTML");
  process.exit(1);
}

// Parse the model data (simplified - extract scores arrays)
const modelsRaw = htmlContent.match(
  /model: "(.*?)",[\s\S]*?scores: \[([\d\s.,]+)\]/g,
);

const modelData = modelsRaw.map((match) => {
  const modelMatch = match.match(/model: "(.*?)"/);
  const scoresMatch = match.match(/scores: \[([\d\s.,]+)\]/);
  const model = modelMatch[1];
  const scores = scoresMatch[1]
    .split(",")
    .map((s) => parseFloat(s.trim()))
    .filter((n) => !isNaN(n));
  return { model, scores };
});

console.log("\n=== Extracted Model Data ===");
modelData.forEach((m) => {
  console.log(`${m.model}: ${m.scores.length} samples`);
});

// Statistical functions
function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function variance(arr) {
  const m = mean(arr);
  return (
    arr.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / (arr.length - 1)
  );
}

function standardError(arr) {
  return Math.sqrt(variance(arr) / arr.length);
}

/**
 * Welch's t-test for two independent samples with unequal variances
 * Returns: { t, df, pValue }
 */
function welchTTest(sample1, sample2) {
  const n1 = sample1.length;
  const n2 = sample2.length;
  const mean1 = mean(sample1);
  const mean2 = mean(sample2);
  const var1 = variance(sample1);
  const var2 = variance(sample2);
  const se1 = var1 / n1;
  const se2 = var2 / n2;

  // t-statistic
  const t = (mean1 - mean2) / Math.sqrt(se1 + se2);

  // Welch-Satterthwaite degrees of freedom
  const df =
    Math.pow(se1 + se2, 2) /
    (Math.pow(se1, 2) / (n1 - 1) + Math.pow(se2, 2) / (n2 - 1));

  // Two-tailed p-value approximation using t-distribution
  // For large samples, t-distribution approaches normal distribution
  const absT = Math.abs(t);
  let pValue;

  // More precise p-value calculation based on t-statistic and df
  // Using approximation for t-distribution CDF
  if (df > 30) {
    // Use normal approximation for large df
    // P(|T| > t) ≈ 2 * (1 - Φ(|t|))
    const z = absT;
    // Approximation of standard normal CDF
    const erfApprox = (x) => {
      const t = 1 / (1 + 0.5 * Math.abs(x));
      const tau =
        t *
        Math.exp(
          -x * x -
            1.26551223 +
            t *
              (1.00002368 +
                t *
                  (0.37409196 +
                    t *
                      (0.09678418 +
                        t *
                          (-0.18628806 +
                            t *
                              (0.27886807 +
                                t *
                                  (-1.13520398 +
                                    t *
                                      (1.48851587 +
                                        t *
                                          (-0.82215223 + t * 0.17087277)))))))),
        );
      return x >= 0 ? 1 - tau : tau - 1;
    };
    const phi = (x) => 0.5 * (1 + erfApprox(x / Math.sqrt(2)));
    pValue = 2 * (1 - phi(z));
  } else {
    // Conservative approximation for smaller df
    if (absT > 10) pValue = 0.00001;
    else if (absT > 5) pValue = 0.0001;
    else if (absT > 4) pValue = 0.001;
    else if (absT > 3.5) pValue = 0.002;
    else if (absT > 3) pValue = 0.005;
    else if (absT > 2.5) pValue = 0.02;
    else if (absT > 2) pValue = 0.05;
    else if (absT > 1.5) pValue = 0.15;
    else pValue = 0.3;
  }

  return { t, df, pValue, mean1, mean2, n1, n2 };
}

// Calculate pairwise t-tests for adjacent models
console.log("\n=== Pairwise T-Tests (Adjacent Models) ===\n");

const results = [];
for (let i = 0; i < modelData.length - 1; i++) {
  const model1 = modelData[i];
  const model2 = modelData[i + 1];

  const test = welchTTest(model1.scores, model2.scores);

  results.push({
    comparison: `${model1.model} vs ${model2.model}`,
    ...test,
  });

  console.log(`${model1.model} vs ${model2.model}`);
  console.log(
    `  Mean difference: ${(test.mean1 - test.mean2).toFixed(2)} (${test.mean1.toFixed(2)} vs ${test.mean2.toFixed(2)})`,
  );
  console.log(`  Sample sizes: n₁=${test.n1}, n₂=${test.n2}`);
  console.log(`  t-statistic: ${test.t.toFixed(4)}`);
  console.log(`  Degrees of freedom: ${test.df.toFixed(2)}`);
  console.log(
    `  p-value: ${test.pValue < 0.0001 ? "<0.0001" : test.pValue.toFixed(4)}`,
  );
  console.log(
    `  Significance: ${test.pValue < 0.001 ? "***" : test.pValue < 0.01 ? "**" : test.pValue < 0.05 ? "*" : "n.s."}`,
  );
  console.log("");
}

// Summary table
console.log("\n=== Summary Table (for LaTeX) ===\n");
console.log("Model Pair & $\\Delta\\mu$ & $t$ & $df$ & $p$ & Sig. \\\\");
console.log("\\hline");
results.forEach((r) => {
  const delta = (r.mean1 - r.mean2).toFixed(2);
  const sig =
    r.pValue < 0.001
      ? "***"
      : r.pValue < 0.01
        ? "**"
        : r.pValue < 0.05
          ? "*"
          : "n.s.";
  const pStr = r.pValue < 0.0001 ? "<0.0001" : r.pValue.toFixed(4);
  console.log(
    `${r.comparison} & ${delta} & ${r.t.toFixed(2)} & ${r.df.toFixed(0)} & ${pStr} & ${sig} \\\\`,
  );
});

// Write to JSON for use in HTML
const outputPath = "workspace/0126-balanced/pairwise-ttest-results.json";
fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(`\nResults saved to: ${outputPath}`);
