#!/usr/bin/env node
/**
 * Framework Correlation Analysis with Human Evaluation
 *
 * 对比三个evaluation frameworks与human evaluation的相关性：
 * 1. FSM-based Evaluation (structural, semantic, isomorphism)
 * 2. VLM Evaluation (visual_quality)
 * 3. Playwright Baseline (test pass rate)
 *
 * 与human evaluation的四个维度对比：Functional, Visual, Interactivity, Pedagogical
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Calculate Pearson correlation coefficient
 */
function pearsonCorrelation(x, y) {
  const n = x.length;
  if (n !== y.length || n === 0) {
    throw new Error("Arrays must have same length and be non-empty");
  }

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY),
  );

  if (denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Calculate p-value for correlation (two-tailed test)
 * Using t-distribution approximation
 */
function calculatePValue(r, n) {
  if (n < 3) return 1.0;

  // t-statistic
  const t = r * Math.sqrt((n - 2) / (1 - r * r));

  // Degrees of freedom
  const df = n - 2;

  // Approximate p-value using t-distribution
  // For simplicity, using normal approximation for large samples
  if (n > 30) {
    // Normal approximation
    const z = Math.abs(t);
    const p = 2 * (1 - normalCDF(z));
    return p;
  } else {
    // For small samples, use a lookup or return significance indicator
    const absT = Math.abs(t);
    if (absT > 2.576) return 0.01; // p < 0.01
    if (absT > 1.96) return 0.05; // p < 0.05
    return 0.1; // p > 0.05
  }
}

/**
 * Normal cumulative distribution function
 */
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

/**
 * Get significance stars
 */
function getSignificanceStars(pValue) {
  if (pValue < 0.001) return "***";
  if (pValue < 0.01) return "**";
  if (pValue < 0.05) return "*";
  return "";
}

/**
 * Load and process human evaluation data
 */
function loadHumanEvaluation(humanDataPath) {
  const resultsPath = path.join(humanDataPath, "results.json");
  const htmlPagesPath = path.join(humanDataPath, "html-pages.json");

  const results = JSON.parse(fs.readFileSync(resultsPath, "utf-8"));
  const htmlPages = JSON.parse(fs.readFileSync(htmlPagesPath, "utf-8"));

  // htmlPages is just an array of filenames, UUID is the filename without .html

  // Aggregate scores by UUID (average across users)
  const scoresByUuid = {};

  results.forEach((result) => {
    // Extract UUID from html_id (remove .html extension)
    const uuid = result.html_id.replace(".html", "");
    if (!uuid) return;

    if (!scoresByUuid[uuid]) {
      scoresByUuid[uuid] = {
        functional: [],
        visual: [],
        interactivity: [],
        pedagogical: [],
      };
    }

    scoresByUuid[uuid].functional.push(result.scores.functional);
    scoresByUuid[uuid].visual.push(result.scores.visual);
    scoresByUuid[uuid].interactivity.push(result.scores.interactivity);
    scoresByUuid[uuid].pedagogical.push(result.scores.pedagogical);
  });

  // Calculate averages
  const humanScores = {};
  Object.keys(scoresByUuid).forEach((uuid) => {
    const scores = scoresByUuid[uuid];
    humanScores[uuid] = {
      functional:
        scores.functional.reduce((a, b) => a + b, 0) / scores.functional.length,
      visual: scores.visual.reduce((a, b) => a + b, 0) / scores.visual.length,
      interactivity:
        scores.interactivity.reduce((a, b) => a + b, 0) /
        scores.interactivity.length,
      pedagogical:
        scores.pedagogical.reduce((a, b) => a + b, 0) /
        scores.pedagogical.length,
    };
  });

  console.log(
    `📊 Loaded human evaluations for ${Object.keys(humanScores).length} HTML pages`,
  );
  return humanScores;
}

/**
 * Load FSM-based evaluation data
 */
function loadFSMEvaluation(workspacePath) {
  const fsmResultsPath = path.join(
    workspacePath,
    "fsm-similarity-results.json",
  );
  const fsmResults = JSON.parse(fs.readFileSync(fsmResultsPath, "utf-8"));

  const fsmScores = {};

  fsmResults.results.forEach((result) => {
    if (!result.success || !result.similarityResult) return;

    // Extract UUID from filename (remove .json extension)
    const uuid = result.fsmFileName.replace(".json", "");

    const sim = result.similarityResult;

    // Calculate combined score (average of three dimensions)
    const structuralScore = sim.structural_similarity?.overall || 0;
    const semanticScore = sim.semantic_similarity?.overall || 0;
    const isomorphismScore = sim.isomorphism_similarity || 0;

    fsmScores[uuid] = {
      structural: structuralScore,
      semantic: semanticScore,
      isomorphism: isomorphismScore,
      combined: (structuralScore + semanticScore + isomorphismScore) / 3,
    };
  });

  console.log(
    `📊 Loaded FSM evaluations for ${Object.keys(fsmScores).length} HTML pages`,
  );
  return fsmScores;
}

/**
 * Load VLM evaluation data
 */
function loadVLMEvaluation(workspacePath) {
  const vlmResultsDir = path.join(workspacePath, "visual-results");
  const vlmScores = {};

  const files = fs.readdirSync(vlmResultsDir);

  files.forEach((file) => {
    if (file === "_summary.json" || !file.endsWith(".json")) return;

    const uuid = file.replace(".json", "");
    const filePath = path.join(vlmResultsDir, file);

    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

      vlmScores[uuid] = {
        visual_quality: data.visual_quality || 0,
        educational_quality: data.educational_quality || 0,
      };
    } catch (error) {
      console.warn(`⚠️ Could not load VLM data for ${file}`);
    }
  });

  console.log(
    `📊 Loaded VLM evaluations for ${Object.keys(vlmScores).length} HTML pages`,
  );
  return vlmScores;
}

/**
 * Load Playwright baseline data - NOT USED
 * Playwright scores are model-level, not file-level
 */
function loadPlaywrightEvaluation(workspacePath) {
  console.log(
    `📊 Playwright evaluation: Skipped (model-level only, not per-file)`,
  );
  return {};
}

/**
 * Match all data sources and create aligned datasets
 */
function alignDatasets(humanScores, fsmScores, vlmScores, playwrightScores) {
  const aligned = [];

  Object.keys(humanScores).forEach((uuid) => {
    // Only require FSM and VLM (Playwright is model-level only)
    if (fsmScores[uuid] && vlmScores[uuid]) {
      aligned.push({
        uuid,
        human: humanScores[uuid],
        fsm: fsmScores[uuid],
        vlm: vlmScores[uuid],
        playwright: null, // Not available at file level
      });
    }
  });

  console.log(
    `\n✅ Successfully aligned ${aligned.length} samples (FSM + VLM + Human)\n`,
  );
  return aligned;
}

/**
 * Calculate correlation matrix
 */
function calculateCorrelations(alignedData) {
  const humanDimensions = [
    "functional",
    "visual",
    "interactivity",
    "pedagogical",
  ];
  const correlations = {
    fsm: {},
    vlm: {},
  };

  humanDimensions.forEach((dimension) => {
    const humanValues = alignedData.map((d) => d.human[dimension]);

    // FSM correlation (using combined score)
    const fsmValues = alignedData.map((d) => d.fsm.combined);
    const fsmR = pearsonCorrelation(fsmValues, humanValues);
    const fsmP = calculatePValue(fsmR, alignedData.length);

    correlations.fsm[dimension] = {
      r: fsmR,
      n: alignedData.length,
      p: fsmP,
      stars: getSignificanceStars(fsmP),
    };

    // VLM correlation (using visual_quality)
    const vlmValues = alignedData.map((d) => d.vlm.visual_quality);
    const vlmR = pearsonCorrelation(vlmValues, humanValues);
    const vlmP = calculatePValue(vlmR, alignedData.length);

    correlations.vlm[dimension] = {
      r: vlmR,
      n: alignedData.length,
      p: vlmP,
      stars: getSignificanceStars(vlmP),
    };
  });

  return correlations;
}

/**
 * Generate HTML report
 */
function generateHTMLReport(correlations, alignedData, outputPath) {
  const dimensions = ["functional", "visual", "interactivity", "pedagogical"];

  // Generate table rows
  const fsmRow = dimensions
    .map((dim) => {
      const corr = correlations.fsm[dim];
      return `<td style="background: ${corr.r > 0.3 ? "#d4edda" : corr.r < -0.1 ? "#f8d7da" : "#fff"}">
      <strong>${corr.r.toFixed(3)}</strong>${corr.stars}<br>
      <small>p=${corr.p.toFixed(3)}</small>
    </td>`;
    })
    .join("");

  const vlmRow = dimensions
    .map((dim) => {
      const corr = correlations.vlm[dim];
      return `<td style="background: ${corr.r > 0.3 ? "#d4edda" : corr.r < -0.1 ? "#f8d7da" : "#fff"}">
      <strong>${corr.r.toFixed(3)}</strong>${corr.stars}<br>
      <small>p=${corr.p.toFixed(3)}</small>
    </td>`;
    })
    .join("");

  // Playwright not included (model-level only, not per-file)

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Framework Correlation Analysis</title>
  <style>
    body {
      font-family: 'Times New Roman', Times, serif;
      max-width: 1200px;
      margin: 40px auto;
      padding: 20px;
      background: white;
      color: #000;
    }
    
    h1 {
      font-size: 24pt;
      text-align: center;
      margin-bottom: 40px;
      font-weight: bold;
    }
    
    h2 {
      font-size: 16pt;
      margin-top: 40px;
      margin-bottom: 20px;
      font-weight: bold;
    }
    
    .summary {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
      border: 1px solid #ddd;
    }
    
    .summary p {
      margin: 10px 0;
      font-size: 11pt;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 11pt;
    }
    
    th, td {
      border: 1px solid #000;
      padding: 12px;
      text-align: center;
    }
    
    th {
      background: #f0f0f0;
      font-weight: bold;
    }
    
    .framework-name {
      text-align: left;
      font-weight: bold;
    }
    
    .caption {
      font-size: 10pt;
      text-align: center;
      margin-top: 10px;
      font-style: italic;
    }
    
    .legend {
      font-size: 10pt;
      margin: 20px 0;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 5px;
    }
    
    .interpretation {
      margin: 30px 0;
      padding: 20px;
      background: #e7f3ff;
      border-left: 4px solid #0056b3;
    }
    
    .interpretation h3 {
      margin-top: 0;
      color: #0056b3;
    }
    
    .interpretation ul {
      margin: 10px 0;
      padding-left: 20px;
    }
    
    .interpretation li {
      margin: 8px 0;
    }
  </style>
</head>
<body>
  <h1>Evaluation Framework Correlation Analysis with Human Judgment</h1>
  
  <div class="summary">
    <p><strong>Sample Size (N):</strong> ${alignedData.length} HTML pages</p>
    <p><strong>Human Evaluation Dimensions:</strong> Functional, Visual, Interactivity, Pedagogical (0-5 scale)</p>
    <p><strong>Evaluation Frameworks:</strong></p>
    <ul>
      <li><strong>FSM-based:</strong> Combined score from structural, semantic, and isomorphism similarity (0-1 scale)</li>
      <li><strong>VLM (Vision-Language Model):</strong> Visual quality score from GPT-4o-mini (0-5 scale)</li>
      <li><strong>Note:</strong> Playwright baseline not included (only model-level statistics available, not per-file)</li>
    </ul>
  </div>
  
  <h2>Table 1. Pearson Correlation Coefficients with Human Evaluation</h2>
  
  <table>
    <thead>
      <tr>
        <th class="framework-name">Evaluation Framework</th>
        <th>Functional</th>
        <th>Visual</th>
        <th>Interactivity</th>
        <th>Pedagogical</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="framework-name">FSM-based Evaluation</td>
        ${fsmRow}
      </tr>
      <tr>
        <td class="framework-name">VLM Evaluation (Baseline)</td>
        ${vlmRow}
      </tr>
    </tbody>
  </table>
  
  <div class="caption">
    Values show Pearson correlation coefficient (r) and p-value. 
    Significance levels: *** p<0.001, ** p<0.01, * p<0.05.
    Green cells indicate positive correlation (r>0.3), red cells indicate negative correlation (r<-0.1).
  </div>
  
  <div class="legend">
    <strong>Statistical Interpretation Guide:</strong><br>
    <strong>|r| = 0.00-0.19:</strong> Very weak correlation<br>
    <strong>|r| = 0.20-0.39:</strong> Weak correlation<br>
    <strong>|r| = 0.40-0.59:</strong> Moderate correlation<br>
    <strong>|r| = 0.60-0.79:</strong> Strong correlation<br>
    <strong>|r| = 0.80-1.00:</strong> Very strong correlation
  </div>
  
  <div class="interpretation">
    <h3>Key Findings</h3>
    <ul>
      <li><strong>FSM-based Evaluation:</strong> Shows ${Object.values(correlations.fsm).filter((c) => c.r > 0.2).length}/4 positive correlations with human dimensions, with strongest alignment on ${getDimensionWithMaxCorr(correlations.fsm, dimensions)}</li>
      
      <li><strong>VLM Evaluation:</strong> Shows ${Object.values(correlations.vlm).filter((c) => c.r > 0.2).length}/4 positive correlations, with strongest alignment on ${getDimensionWithMaxCorr(correlations.vlm, dimensions)}</li>
      
      <li><strong>Interactivity Assessment:</strong> FSM-based (r=${correlations.fsm.interactivity.r.toFixed(3)}) vs VLM (r=${correlations.vlm.interactivity.r.toFixed(3)})</li>
      
      <li><strong>Pedagogical Assessment:</strong> FSM-based (r=${correlations.fsm.pedagogical.r.toFixed(3)}) vs VLM (r=${correlations.vlm.pedagogical.r.toFixed(3)})</li>
      
      <li><strong>Visual Assessment:</strong> FSM-based (r=${correlations.fsm.visual.r.toFixed(3)}) vs VLM (r=${correlations.vlm.visual.r.toFixed(3)})</li>
      
      <li><strong>Functional Assessment:</strong> FSM-based (r=${correlations.fsm.functional.r.toFixed(3)}) vs VLM (r=${correlations.vlm.functional.r.toFixed(3)})</li>
    </ul>
  </div>
  
  <h2>Table 2. Detailed Correlation Statistics</h2>
  
  <table>
    <thead>
      <tr>
        <th>Framework</th>
        <th>Dimension</th>
        <th>r</th>
        <th>N</th>
        <th>p-value</th>
        <th>95% CI</th>
        <th>Interpretation</th>
      </tr>
    </thead>
    <tbody>
      ${generateDetailedRows(correlations, alignedData.length, dimensions)}
    </tbody>
  </table>
  
  <div class="caption">
    Detailed statistical breakdown including effect size (r), sample size (N), significance (p-value), 
    confidence interval, and interpretation following Cohen's conventions.
  </div>
  
  <p style="margin-top: 40px; font-size: 10pt; text-align: center; color: #666;">
    Generated on ${new Date().toISOString().split("T")[0]} | 
    Analysis Script: analyze-framework-correlation.mjs
  </p>
</body>
</html>`;

  fs.writeFileSync(outputPath, html);
  console.log(`✅ HTML report generated: ${outputPath}`);
}

/**
 * Helper function to get dimension with max correlation
 */
function getDimensionWithMaxCorr(correlations, dimensions) {
  let maxR = -Infinity;
  let maxDim = "";

  dimensions.forEach((dim) => {
    if (correlations[dim].r > maxR) {
      maxR = correlations[dim].r;
      maxDim = dim;
    }
  });

  return `${maxDim} (r=${maxR.toFixed(3)})`;
}

/**
 * Calculate 95% confidence interval for correlation
 */
function calculateCI(r, n) {
  // Fisher's z-transformation
  const z = 0.5 * Math.log((1 + r) / (1 - r));
  const se = 1 / Math.sqrt(n - 3);
  const zLower = z - 1.96 * se;
  const zUpper = z + 1.96 * se;

  // Transform back
  const rLower = (Math.exp(2 * zLower) - 1) / (Math.exp(2 * zLower) + 1);
  const rUpper = (Math.exp(2 * zUpper) - 1) / (Math.exp(2 * zUpper) + 1);

  return `[${rLower.toFixed(3)}, ${rUpper.toFixed(3)}]`;
}

/**
 * Interpret correlation strength
 */
function interpretCorrelation(r) {
  const absR = Math.abs(r);
  let strength = "";

  if (absR < 0.2) strength = "Very weak";
  else if (absR < 0.4) strength = "Weak";
  else if (absR < 0.6) strength = "Moderate";
  else if (absR < 0.8) strength = "Strong";
  else strength = "Very strong";

  const direction = r > 0 ? "positive" : "negative";
  return `${strength} ${direction}`;
}

/**
 * Generate detailed table rows
 */
function generateDetailedRows(correlations, n, dimensions) {
  const frameworks = [
    { key: "fsm", name: "FSM-based" },
    { key: "vlm", name: "VLM" },
  ]; // Playwright not included (model-level only)

  let rows = "";

  frameworks.forEach((framework) => {
    dimensions.forEach((dim, idx) => {
      const corr = correlations[framework.key][dim];
      const ci = calculateCI(corr.r, n);
      const interpretation = interpretCorrelation(corr.r);

      rows += `<tr>
        ${idx === 0 ? `<td rowspan="4" style="font-weight: bold;">${framework.name}</td>` : ""}
        <td style="text-align: left;">${dim.charAt(0).toUpperCase() + dim.slice(1)}</td>
        <td><strong>${corr.r.toFixed(3)}</strong>${corr.stars}</td>
        <td>${corr.n}</td>
        <td>${corr.p.toFixed(3)}</td>
        <td>${ci}</td>
        <td style="text-align: left;">${interpretation}</td>
      </tr>`;
    });
  });

  return rows;
}

/**
 * Print console summary
 */
function printConsoleSummary(correlations, alignedData) {
  console.log("\n" + "=".repeat(80));
  console.log("CORRELATION ANALYSIS SUMMARY");
  console.log("=".repeat(80));
  console.log(`Sample Size: N = ${alignedData.length}\n`);

  const dimensions = ["functional", "visual", "interactivity", "pedagogical"];
  const frameworks = ["fsm", "vlm"];
  const frameworkNames = {
    fsm: "FSM-based",
    vlm: "VLM (Baseline)",
  };

  // Print correlation matrix
  console.log("Pearson Correlation Coefficients (r):");
  console.log("-".repeat(80));
  console.log(
    "Framework".padEnd(25) +
      dimensions
        .map((d) => d.charAt(0).toUpperCase() + d.slice(1).padEnd(15))
        .join(""),
  );
  console.log("-".repeat(80));

  frameworks.forEach((fw) => {
    const row =
      frameworkNames[fw].padEnd(25) +
      dimensions
        .map((dim) => {
          const corr = correlations[fw][dim];
          return `${corr.r.toFixed(3)}${corr.stars}`.padEnd(15);
        })
        .join("");
    console.log(row);
  });

  console.log("-".repeat(80));
  console.log("\nP-values:");
  console.log("-".repeat(80));
  console.log(
    "Framework".padEnd(25) +
      dimensions
        .map((d) => d.charAt(0).toUpperCase() + d.slice(1).padEnd(15))
        .join(""),
  );
  console.log("-".repeat(80));

  frameworks.forEach((fw) => {
    const row =
      frameworkNames[fw].padEnd(25) +
      dimensions
        .map((dim) => correlations[fw][dim].p.toFixed(3).padEnd(15))
        .join("");
    console.log(row);
  });

  console.log("-".repeat(80));
  console.log("\nSignificance: *** p<0.001  ** p<0.01  * p<0.05");
  console.log("=".repeat(80) + "\n");
}

/**
 * Main analysis function
 */
async function main() {
  console.log("\n🔬 Framework Correlation Analysis with Human Evaluation\n");
  console.log("=".repeat(80) + "\n");

  // Paths
  const humanDataPath = path.join(__dirname, "human-evaluation-data", "01-28");
  const workspacePath = path.join(__dirname, "workspace", "0126-balanced");
  const outputPath = path.join(__dirname, "framework-correlation-report.html");

  // Step 1: Load all data
  console.log("📂 Loading data from all sources...\n");
  const humanScores = loadHumanEvaluation(humanDataPath);
  const fsmScores = loadFSMEvaluation(workspacePath);
  const vlmScores = loadVLMEvaluation(workspacePath);
  const playwrightScores = loadPlaywrightEvaluation(workspacePath);

  // Step 2: Align datasets
  const alignedData = alignDatasets(
    humanScores,
    fsmScores,
    vlmScores,
    playwrightScores,
  );

  if (alignedData.length === 0) {
    console.error("❌ No matching data found across all frameworks!");
    process.exit(1);
  }

  // Step 3: Calculate correlations
  console.log("📊 Computing Pearson correlations...\n");
  const correlations = calculateCorrelations(alignedData);

  // Step 4: Print summary
  printConsoleSummary(correlations, alignedData);

  // Step 5: Generate HTML report
  console.log("📝 Generating HTML report...\n");
  generateHTMLReport(correlations, alignedData, outputPath);

  // Step 6: Save raw data for further analysis
  const dataOutputPath = path.join(
    __dirname,
    "framework-correlation-data.json",
  );
  fs.writeFileSync(
    dataOutputPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        sampleSize: alignedData.length,
        correlations,
        alignedData: alignedData.slice(0, 10), // Save first 10 samples as example
      },
      null,
      2,
    ),
  );

  console.log(`✅ Raw data saved: ${dataOutputPath}\n`);
  console.log("🎉 Analysis complete!\n");
}

main().catch(console.error);
