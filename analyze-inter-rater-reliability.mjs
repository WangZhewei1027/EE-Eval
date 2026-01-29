// Inter-Rater Reliability Analysis
// 计算两个annotators之间的评分相关性
import fs from "fs";
import path from "path";

const HUMAN_EVAL_PATH = path.join(
  "human-evaluation-data",
  "01-28",
  "results.json",
);
const OUTPUT_HTML = "inter-rater-reliability-report.html";
const OUTPUT_JSON = "inter-rater-reliability-data.json";

// ========== UTILS =============
function mean(arr) {
  if (!arr || arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function pearsonCorrelation(x, y) {
  const n = x.length;
  if (n === 0) return 0;

  const mx = mean(x);
  const my = mean(y);
  let num = 0,
    dx = 0,
    dy = 0;

  for (let i = 0; i < n; i++) {
    const diffX = x[i] - mx;
    const diffY = y[i] - my;
    num += diffX * diffY;
    dx += diffX * diffX;
    dy += diffY * diffY;
  }

  if (dx === 0 || dy === 0) return 0;
  return num / Math.sqrt(dx * dy);
}

function spearmanCorrelation(x, y) {
  // Rank the data
  const rankX = getRanks(x);
  const rankY = getRanks(y);
  return pearsonCorrelation(rankX, rankY);
}

function getRanks(arr) {
  const indexed = arr.map((val, idx) => ({ val, idx }));
  indexed.sort((a, b) => a.val - b.val);

  const ranks = new Array(arr.length);
  for (let i = 0; i < indexed.length; i++) {
    ranks[indexed[i].idx] = i + 1;
  }
  return ranks;
}

function calculateICC(x, y) {
  // Intraclass Correlation Coefficient (ICC) - simplified two-rater version
  const n = x.length;
  const grandMean = (mean(x) + mean(y)) / 2;

  // Between-subject variance
  let bss = 0;
  for (let i = 0; i < n; i++) {
    const subjectMean = (x[i] + y[i]) / 2;
    bss += Math.pow(subjectMean - grandMean, 2);
  }
  bss = bss / (n - 1);

  // Within-subject variance
  let wss = 0;
  for (let i = 0; i < n; i++) {
    wss += Math.pow(x[i] - y[i], 2) / 2;
  }
  wss = wss / n;

  // ICC(2,1) - Two-way random effects, single rater
  const icc = (bss - wss) / (bss + wss);
  return Math.max(0, Math.min(1, icc));
}

function calculateCohenKappa(x, y, k = 6) {
  // Cohen's Kappa for ordinal data (scores 0-5)
  const n = x.length;
  const confMatrix = Array(k)
    .fill(0)
    .map(() => Array(k).fill(0));

  // Build confusion matrix
  for (let i = 0; i < n; i++) {
    confMatrix[x[i]][y[i]]++;
  }

  // Observed agreement
  let po = 0;
  for (let i = 0; i < k; i++) {
    po += confMatrix[i][i];
  }
  po = po / n;

  // Expected agreement
  let pe = 0;
  for (let i = 0; i < k; i++) {
    const rowSum = confMatrix[i].reduce((a, b) => a + b, 0);
    const colSum = confMatrix.reduce((sum, row) => sum + row[i], 0);
    pe += (rowSum / n) * (colSum / n);
  }

  const kappa = (po - pe) / (1 - pe);
  return kappa;
}

function interpretCorrelation(r) {
  const absR = Math.abs(r);
  if (absR >= 0.9) return "Excellent";
  if (absR >= 0.7) return "Strong";
  if (absR >= 0.5) return "Moderate";
  if (absR >= 0.3) return "Weak";
  return "Very Weak";
}

function interpretKappa(kappa) {
  if (kappa >= 0.81) return "Almost Perfect";
  if (kappa >= 0.61) return "Substantial";
  if (kappa >= 0.41) return "Moderate";
  if (kappa >= 0.21) return "Fair";
  if (kappa >= 0.0) return "Slight";
  return "Poor";
}

// ========== MAIN ANALYSIS =============
function analyzeInterRaterReliability() {
  console.log("📊 Loading human evaluation data...");
  const data = JSON.parse(fs.readFileSync(HUMAN_EVAL_PATH, "utf-8"));

  // Group by HTML ID
  const byHTML = {};
  for (const r of data) {
    const htmlId = r.html_id;
    if (!byHTML[htmlId]) {
      byHTML[htmlId] = [];
    }
    byHTML[htmlId].push(r);
  }

  // Filter to only HTML pages with exactly 2 raters
  const pairsData = Object.entries(byHTML)
    .filter(([_, ratings]) => ratings.length === 2)
    .map(([htmlId, ratings]) => ({
      htmlId,
      rater1: ratings[0],
      rater2: ratings[1],
    }));

  console.log(`   ✓ Found ${pairsData.length} HTML pages with 2 raters`);
  console.log(`   Total evaluations: ${data.length}`);
  console.log(`   Unique raters: ${new Set(data.map((r) => r.user_id)).size}`);

  // Extract scores by dimension
  const dimensions = ["functional", "visual", "interactivity", "pedagogical"];
  const results = {};

  console.log("\n📈 Calculating inter-rater reliability...\n");

  for (const dim of dimensions) {
    const rater1Scores = pairsData.map((p) => p.rater1.scores[dim]);
    const rater2Scores = pairsData.map((p) => p.rater2.scores[dim]);

    // Calculate multiple reliability metrics
    const pearson = pearsonCorrelation(rater1Scores, rater2Scores);
    const spearman = spearmanCorrelation(rater1Scores, rater2Scores);
    const icc = calculateICC(rater1Scores, rater2Scores);
    const kappa = calculateCohenKappa(rater1Scores, rater2Scores);

    // Calculate agreement statistics
    const exactAgreement =
      rater1Scores.filter((s, i) => s === rater2Scores[i]).length /
      rater1Scores.length;
    const within1Agreement =
      rater1Scores.filter((s, i) => Math.abs(s - rater2Scores[i]) <= 1).length /
      rater1Scores.length;

    // Calculate mean difference
    const differences = rater1Scores.map((s, i) => s - rater2Scores[i]);
    const meanDiff = mean(differences);
    const stdDiff = Math.sqrt(
      mean(differences.map((d) => d * d)) - meanDiff * meanDiff,
    );

    results[dim] = {
      pearson,
      spearman,
      icc,
      kappa,
      exactAgreement,
      within1Agreement,
      meanDifference: meanDiff,
      stdDifference: stdDiff,
      n: rater1Scores.length,
      rater1Mean: mean(rater1Scores),
      rater2Mean: mean(rater2Scores),
      pearsonInterpretation: interpretCorrelation(pearson),
      kappaInterpretation: interpretKappa(kappa),
    };

    console.log(`${dim.toUpperCase()}:`);
    console.log(
      `   Pearson r:        ${pearson.toFixed(3)} (${interpretCorrelation(pearson)})`,
    );
    console.log(`   Spearman ρ:       ${spearman.toFixed(3)}`);
    console.log(`   ICC:              ${icc.toFixed(3)}`);
    console.log(
      `   Cohen's Kappa:    ${kappa.toFixed(3)} (${interpretKappa(kappa)})`,
    );
    console.log(`   Exact Agreement:  ${(exactAgreement * 100).toFixed(1)}%`);
    console.log(`   Within-1 Agree:   ${(within1Agreement * 100).toFixed(1)}%`);
    console.log(
      `   Mean Difference:  ${meanDiff.toFixed(3)} ± ${stdDiff.toFixed(3)}`,
    );
    console.log("");
  }

  return { results, pairsData, dimensions };
}

function generateHTMLReport(analysisResults) {
  const { results, pairsData, dimensions } = analysisResults;
  const dimNames = {
    functional: "Functional",
    visual: "Visual",
    interactivity: "Interactivity",
    pedagogical: "Pedagogical",
  };

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset='utf-8'>
  <title>Inter-Rater Reliability Report</title>
  <style>
    body {
      font-family: 'Times New Roman', Times, serif;
      max-width: 1200px;
      margin: 40px auto;
      padding: 20px;
      line-height: 1.6;
    }
    h1 {
      text-align: center;
      font-size: 24pt;
      margin-bottom: 10px;
    }
    h2 {
      font-size: 18pt;
      margin-top: 30px;
      border-bottom: 2px solid #333;
      padding-bottom: 5px;
    }
    .subtitle {
      text-align: center;
      font-size: 12pt;
      color: #666;
      margin-bottom: 30px;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 20px 0;
      font-size: 11pt;
    }
    th, td {
      border: 1px solid #333;
      padding: 10px 15px;
      text-align: center;
    }
    th {
      background: #f0f0f0;
      font-weight: bold;
    }
    caption {
      font-weight: bold;
      margin-bottom: 10px;
      font-size: 12pt;
    }
    tr:nth-child(even) {
      background: #f9f9f9;
    }
    .excellent { color: #006400; font-weight: bold; }
    .strong { color: #228B22; }
    .moderate { color: #FF8C00; }
    .weak { color: #DC143C; }
    .summary-box {
      background: #f5f5f5;
      border: 1px solid #ddd;
      padding: 15px;
      margin: 20px 0;
      border-radius: 5px;
    }
    .note {
      font-size: 10pt;
      margin-top: 10px;
      font-style: italic;
    }
  </style>
</head>
<body>
  <h1>Inter-Rater Reliability Analysis</h1>
  <div class="subtitle">Human Evaluation Agreement Between Two Annotators</div>
  
  <div class="summary-box">
    <h3>Summary</h3>
    <p><strong>Sample Size:</strong> ${pairsData.length} HTML pages evaluated by 2 annotators</p>
    <p><strong>Dimensions:</strong> Functional, Visual, Interactivity, Pedagogical (0-5 scale)</p>
    <p><strong>Metrics:</strong> Pearson correlation, Spearman correlation, ICC, Cohen's Kappa, Agreement rates</p>
  </div>

  <h2>Reliability Metrics</h2>
  
  <table>
    <caption>Table 1. Inter-Rater Reliability Coefficients</caption>
    <thead>
      <tr>
        <th>Dimension</th>
        <th>Pearson r</th>
        <th>Spearman ρ</th>
        <th>ICC</th>
        <th>Cohen's κ</th>
        <th>Interpretation</th>
      </tr>
    </thead>
    <tbody>
`;

  for (const dim of dimensions) {
    const r = results[dim];
    const className =
      r.pearson >= 0.7
        ? "strong"
        : r.pearson >= 0.5
          ? "moderate"
          : r.pearson >= 0.3
            ? "weak"
            : "";
    html += `      <tr>
        <td><strong>${dimNames[dim]}</strong></td>
        <td class="${className}">${r.pearson.toFixed(3)}</td>
        <td>${r.spearman.toFixed(3)}</td>
        <td>${r.icc.toFixed(3)}</td>
        <td>${r.kappa.toFixed(3)}</td>
        <td>${r.pearsonInterpretation}</td>
      </tr>
`;
  }

  html += `    </tbody>
  </table>
  
  <p class="note"><strong>Interpretation Guidelines:</strong><br>
  Pearson/Spearman: &ge;0.9 Excellent, &ge;0.7 Strong, &ge;0.5 Moderate, &ge;0.3 Weak<br>
  ICC: Same as Pearson<br>
  Cohen's Kappa: &ge;0.81 Almost Perfect, &ge;0.61 Substantial, &ge;0.41 Moderate</p>

  <h2>Agreement Statistics</h2>
  
  <table>
    <caption>Table 2. Agreement Rates and Score Differences</caption>
    <thead>
      <tr>
        <th>Dimension</th>
        <th>Exact Agreement</th>
        <th>Within-1 Agreement</th>
        <th>Mean Diff (R1-R2)</th>
        <th>Std Diff</th>
      </tr>
    </thead>
    <tbody>
`;

  for (const dim of dimensions) {
    const r = results[dim];
    html += `      <tr>
        <td><strong>${dimNames[dim]}</strong></td>
        <td>${(r.exactAgreement * 100).toFixed(1)}%</td>
        <td>${(r.within1Agreement * 100).toFixed(1)}%</td>
        <td>${r.meanDifference.toFixed(3)}</td>
        <td>±${r.stdDifference.toFixed(3)}</td>
      </tr>
`;
  }

  html += `    </tbody>
  </table>
  
  <p class="note"><strong>Exact Agreement:</strong> Percentage of cases where both raters gave identical scores<br>
  <strong>Within-1 Agreement:</strong> Percentage where scores differ by at most 1 point<br>
  <strong>Mean Difference:</strong> Average difference (Rater 1 - Rater 2); positive means Rater 1 scored higher</p>

  <h2>Mean Scores by Rater</h2>
  
  <table>
    <caption>Table 3. Average Scores per Rater</caption>
    <thead>
      <tr>
        <th>Dimension</th>
        <th>Rater 1 Mean</th>
        <th>Rater 2 Mean</th>
        <th>Difference</th>
      </tr>
    </thead>
    <tbody>
`;

  for (const dim of dimensions) {
    const r = results[dim];
    const diff = r.rater1Mean - r.rater2Mean;
    html += `      <tr>
        <td><strong>${dimNames[dim]}</strong></td>
        <td>${r.rater1Mean.toFixed(2)}</td>
        <td>${r.rater2Mean.toFixed(2)}</td>
        <td>${diff.toFixed(2)}</td>
      </tr>
`;
  }

  html += `    </tbody>
  </table>

  <h2>Interpretation</h2>
  <div class="summary-box">
`;

  // Calculate overall reliability
  const avgPearson = mean(dimensions.map((d) => results[d].pearson));
  const avgKappa = mean(dimensions.map((d) => results[d].kappa));

  html += `    <h3>Overall Reliability: ${interpretCorrelation(avgPearson)}</h3>
    <p><strong>Average Pearson r:</strong> ${avgPearson.toFixed(3)}</p>
    <p><strong>Average Cohen's Kappa:</strong> ${avgKappa.toFixed(3)} (${interpretKappa(avgKappa)})</p>
    
    <h3>Key Findings:</h3>
    <ul>
`;

  // Generate insights
  const bestDim = dimensions.reduce((a, b) =>
    results[a].pearson > results[b].pearson ? a : b,
  );
  const worstDim = dimensions.reduce((a, b) =>
    results[a].pearson < results[b].pearson ? a : b,
  );

  html += `      <li><strong>Highest Agreement:</strong> ${dimNames[bestDim]} (r=${results[bestDim].pearson.toFixed(3)})</li>
      <li><strong>Lowest Agreement:</strong> ${dimNames[worstDim]} (r=${results[worstDim].pearson.toFixed(3)})</li>
`;

  // Check for systematic bias
  const systematicBias = dimensions.filter(
    (d) => Math.abs(results[d].meanDifference) > 0.5,
  );
  if (systematicBias.length > 0) {
    html += `      <li><strong>Systematic Bias Detected:</strong> ${systematicBias.map((d) => dimNames[d]).join(", ")} show mean difference > 0.5</li>
`;
  }

  html += `    </ul>
  </div>

  <p class="note"><strong>Generated:</strong> ${new Date().toISOString()}</p>
</body>
</html>`;

  return html;
}

// ========== RUN =============
function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Inter-Rater Reliability Analysis");
  console.log("═══════════════════════════════════════════════════════════\n");

  const analysisResults = analyzeInterRaterReliability();

  // Save results
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(analysisResults, null, 2));
  fs.writeFileSync(OUTPUT_HTML, generateHTMLReport(analysisResults));

  console.log("═══════════════════════════════════════════════════════════");
  console.log(`✅ Analysis complete!`);
  console.log(`   📊 HTML Report: ${OUTPUT_HTML}`);
  console.log(`   📁 Raw Data: ${OUTPUT_JSON}`);
  console.log("═══════════════════════════════════════════════════════════\n");
}

main();
