// Comprehensive Workspace Data Comparison Report Generator
// Usage: node compare-workspace-data.mjs workspace1 workspace2
// Example: node compare-workspace-data.mjs 0126-biased 0126-balanced

import fs from "fs";
import path from "path";

// ========== CONFIG =============
const WORKSPACE1 = process.argv[2] || "0126-biased";
const WORKSPACE2 = process.argv[3] || "0126-balanced";

const OUTPUT_HTML = `workspace-comparison-${WORKSPACE1}-vs-${WORKSPACE2}.html`;

// ========== DATA LOADERS =============
function loadWorkspaceData(workspace) {
  console.log(`\n📊 Loading data for workspace: ${workspace}`);

  const basePath = path.join("workspace", workspace);

  // Load Human Evaluation
  const humanPath = path.join("human-evaluation-data", "01-28", "results.json");
  const humanRaw = fs.existsSync(humanPath)
    ? JSON.parse(fs.readFileSync(humanPath, "utf-8"))
    : [];

  const humanMap = {};
  for (const r of humanRaw) {
    const uuid = r.html_id.replace(".html", "");
    if (!humanMap[uuid]) {
      humanMap[uuid] = {
        functional: [],
        visual: [],
        interactivity: [],
        pedagogical: [],
      };
    }
    humanMap[uuid].functional.push(r.scores.functional);
    humanMap[uuid].visual.push(r.scores.visual);
    humanMap[uuid].interactivity.push(r.scores.interactivity);
    humanMap[uuid].pedagogical.push(r.scores.pedagogical);
  }

  const human = {};
  for (const uuid in humanMap) {
    human[uuid] = {
      functional: mean(humanMap[uuid].functional),
      visual: mean(humanMap[uuid].visual),
      interactivity: mean(humanMap[uuid].interactivity),
      pedagogical: mean(humanMap[uuid].pedagogical),
    };
  }

  // Load FSM Data
  const fsmPath = path.join(basePath, "fsm-similarity-results.json");
  const fsmData = fs.existsSync(fsmPath)
    ? JSON.parse(fs.readFileSync(fsmPath, "utf-8"))
    : { results: [] };

  const fsm = {};
  const fsmRawScores = [];
  for (const r of fsmData.results || []) {
    const uuid =
      r.html_id?.replace(".html", "") || r.fsmFileName?.replace(".json", "");
    if (!uuid) continue;

    const sim = r.similarityResult || r;
    if (!sim) continue;

    const structural =
      sim.dimension1_interaction_capacity?.score ??
      sim.structural_similarity?.overall ??
      null;
    const semantic =
      sim.dimension2_behavioral_coherence?.score ??
      sim.semantic_similarity?.overall ??
      null;
    const isomorphism =
      sim.dimension3_interaction_meaningfulness?.score ??
      sim.isomorphism_similarity ??
      null;

    if (structural !== null && semantic !== null && isomorphism !== null) {
      const rawScore = (structural + semantic + isomorphism) / 3;
      fsmRawScores.push(rawScore);
      fsm[uuid] = {
        structural,
        semantic,
        isomorphism,
        raw: rawScore,
      };
    }
  }

  // Load VLM Data
  const vlmDir = path.join(basePath, "visual-results");
  const vlm = {};
  if (fs.existsSync(vlmDir)) {
    const files = fs
      .readdirSync(vlmDir)
      .filter((f) => f.endsWith(".json") && f !== "_summary.json");
    for (const file of files) {
      const uuid = file.replace(".json", "");
      const data = JSON.parse(
        fs.readFileSync(path.join(vlmDir, file), "utf-8"),
      );
      if (data.visual_quality !== undefined) {
        vlm[uuid] = {
          visual_quality: data.visual_quality,
          educational_quality: data.educational_quality,
        };
      }
    }
  }

  // Load Playwright Data
  const dataDir = path.join(basePath, "data");
  const playwright = {};
  const playwrightScores = {
    "gpt-3.5-turbo": 0.11,
    "gpt-4o": 0.0258,
    "gpt-4o-mini": 0.1557,
    "gpt-5-mini": 0.0,
    "deepseek-chat": 0.488,
    "Qwen1.5-0.5B-Chat": 0.7603,
    "meta-llama/Llama-3.2-1B-Instruct": 0.2716,
  };

  if (fs.existsSync(dataDir)) {
    const files = fs.readdirSync(dataDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const uuid = file.replace(".json", "");
      try {
        const data = JSON.parse(
          fs.readFileSync(path.join(dataDir, file), "utf-8"),
        );
        const model = data.model;
        if (model && playwrightScores[model] !== undefined) {
          playwright[uuid] = {
            model,
            score: playwrightScores[model],
          };
        }
      } catch (err) {
        // Skip invalid files
      }
    }
  }

  // Load Correlation Results
  const corrPath = `three-frameworks-correlation-data-${workspace}.json`;
  const correlation = fs.existsSync(corrPath)
    ? JSON.parse(fs.readFileSync(corrPath, "utf-8"))
    : null;

  console.log(`   ✓ Human: ${Object.keys(human).length} files`);
  console.log(
    `   ✓ FSM: ${Object.keys(fsm).length} files (raw scores: ${fsmRawScores.length})`,
  );
  console.log(`   ✓ VLM: ${Object.keys(vlm).length} files`);
  console.log(`   ✓ Playwright: ${Object.keys(playwright).length} files`);
  console.log(`   ✓ Correlation data: ${correlation ? "loaded" : "not found"}`);

  return {
    workspace,
    basePath,
    human,
    fsm,
    vlm,
    playwright,
    correlation,
    fsmRawScores,
    sources: {
      human: humanPath,
      fsm: fsmPath,
      vlm: vlmDir,
      playwright: dataDir,
      correlation: corrPath,
    },
  };
}

// ========== UTILS =============
function mean(arr) {
  if (!arr || arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function getDistributionStats(values) {
  if (!values || values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  const variance =
    sorted.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / n;
  const std = Math.sqrt(variance);

  return {
    count: n,
    min: Math.min(...sorted),
    max: Math.max(...sorted),
    mean,
    std,
    median: sorted[Math.floor(n / 2)],
    q25: sorted[Math.floor(n * 0.25)],
    q75: sorted[Math.floor(n * 0.75)],
  };
}

function generateHistogram(values, label) {
  if (!values || values.length === 0) return "";

  const bins = 10;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const binSize = (max - min) / bins;

  const histogram = new Array(bins).fill(0);
  for (const val of values) {
    const binIndex = Math.min(Math.floor((val - min) / binSize), bins - 1);
    histogram[binIndex]++;
  }

  const maxCount = Math.max(...histogram);
  const barHeight = 100;

  let svg = `<svg width="400" height="150" style="background: #f9f9f9; border-radius: 4px;">`;
  svg += `<text x="200" y="15" text-anchor="middle" font-size="12" font-weight="bold">${label}</text>`;

  const barWidth = 360 / bins;
  for (let i = 0; i < bins; i++) {
    const height = (histogram[i] / maxCount) * barHeight;
    const x = 20 + i * barWidth;
    const y = 130 - height;
    svg += `<rect x="${x}" y="${y}" width="${barWidth - 2}" height="${height}" fill="#4CAF50" opacity="0.8"/>`;
    svg += `<text x="${x + barWidth / 2}" y="145" text-anchor="middle" font-size="9">${(min + i * binSize).toFixed(2)}</text>`;
  }

  svg += `</svg>`;
  return svg;
}

// ========== HTML GENERATION =============
function generateComparisonHTML(data1, data2) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Workspace Comparison: ${data1.workspace} vs ${data2.workspace}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 20px;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    h1 {
      color: #2c3e50;
      border-bottom: 3px solid #3498db;
      padding-bottom: 15px;
      margin-bottom: 30px;
      font-size: 28pt;
    }
    h2 {
      color: #34495e;
      margin: 40px 0 20px 0;
      padding-left: 10px;
      border-left: 4px solid #3498db;
      font-size: 20pt;
    }
    h3 {
      color: #7f8c8d;
      margin: 25px 0 15px 0;
      font-size: 16pt;
    }
    .metadata {
      background: #ecf0f1;
      padding: 20px;
      border-radius: 6px;
      margin-bottom: 30px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    .metadata-section {
      background: white;
      padding: 15px;
      border-radius: 4px;
    }
    .metadata-section h4 {
      color: #2980b9;
      margin-bottom: 10px;
      font-size: 14pt;
    }
    .metadata-item {
      padding: 5px 0;
      font-size: 11pt;
      display: flex;
      justify-content: space-between;
    }
    .metadata-item strong {
      color: #34495e;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 11pt;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    th, td {
      padding: 12px;
      text-align: left;
      border: 1px solid #ddd;
    }
    th {
      background: #3498db;
      color: white;
      font-weight: 600;
      text-align: center;
    }
    td {
      background: white;
    }
    tr:nth-child(even) td {
      background: #f8f9fa;
    }
    .positive { color: #27ae60; font-weight: bold; }
    .negative { color: #e74c3c; font-weight: bold; }
    .neutral { color: #95a5a6; }
    .highlight {
      background: #fff3cd !important;
      border-left: 3px solid #ffc107;
    }
    .chart-container {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 20px;
      margin: 20px 0;
    }
    .chart-box {
      background: white;
      padding: 20px;
      border-radius: 6px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin: 20px 0;
    }
    .stat-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .stat-card h4 {
      font-size: 14pt;
      margin-bottom: 10px;
      opacity: 0.9;
    }
    .stat-value {
      font-size: 32pt;
      font-weight: bold;
      margin: 10px 0;
    }
    .stat-label {
      font-size: 11pt;
      opacity: 0.8;
    }
    .source-info {
      background: #e8f4f8;
      border-left: 4px solid #3498db;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
      font-size: 10pt;
      font-family: 'Courier New', monospace;
    }
    .comparison-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin: 20px 0;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 9pt;
      font-weight: 600;
      margin-left: 5px;
    }
    .badge-success { background: #d4edda; color: #155724; }
    .badge-danger { background: #f8d7da; color: #721c24; }
    .badge-warning { background: #fff3cd; color: #856404; }
    .badge-info { background: #d1ecf1; color: #0c5460; }
    .data-quality {
      display: flex;
      justify-content: space-around;
      margin: 30px 0;
    }
    .quality-meter {
      text-align: center;
    }
    .quality-circle {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24pt;
      font-weight: bold;
      color: white;
      margin: 0 auto 10px;
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    }
    .timestamp {
      text-align: right;
      color: #7f8c8d;
      font-size: 10pt;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ecf0f1;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Workspace Data Comparison Report</h1>
    <div style="text-align: center; color: #7f8c8d; margin-bottom: 30px; font-size: 14pt;">
      <strong>${data1.workspace}</strong> vs <strong>${data2.workspace}</strong>
    </div>

    ${generateOverviewSection(data1, data2)}
    ${generateDataSourcesSection(data1, data2)}
    ${generateCorrelationComparisonSection(data1, data2)}
    ${generateDistributionAnalysisSection(data1, data2)}
    ${generateSampleDetailsSection(data1, data2)}
    ${generateKeyFindingsSection(data1, data2)}

    <div class="timestamp">
      Report generated: ${new Date().toISOString()}<br>
      Script: compare-workspace-data.mjs
    </div>
  </div>
</body>
</html>`;

  return html;
}

function generateOverviewSection(data1, data2) {
  return `
    <h2>📈 Overview</h2>
    <div class="stats-grid">
      <div class="stat-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        <h4>${data1.workspace}</h4>
        <div class="stat-value">${Object.keys(data1.human).length}</div>
        <div class="stat-label">Human Evaluations</div>
      </div>
      <div class="stat-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
        <h4>${data2.workspace}</h4>
        <div class="stat-value">${Object.keys(data2.human).length}</div>
        <div class="stat-label">Human Evaluations</div>
      </div>
      <div class="stat-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
        <h4>${data1.workspace}</h4>
        <div class="stat-value">${Object.keys(data1.fsm).length}</div>
        <div class="stat-label">FSM Evaluations</div>
      </div>
      <div class="stat-card" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);">
        <h4>${data2.workspace}</h4>
        <div class="stat-value">${Object.keys(data2.fsm).length}</div>
        <div class="stat-label">FSM Evaluations</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Dataset</th>
          <th>${data1.workspace}</th>
          <th>${data2.workspace}</th>
          <th>Difference</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Human Evaluation</strong></td>
          <td>${Object.keys(data1.human).length} files</td>
          <td>${Object.keys(data2.human).length} files</td>
          <td>${Object.keys(data2.human).length - Object.keys(data1.human).length > 0 ? "+" : ""}${Object.keys(data2.human).length - Object.keys(data1.human).length}</td>
        </tr>
        <tr>
          <td><strong>FSM Similarity</strong></td>
          <td>${Object.keys(data1.fsm).length} files</td>
          <td>${Object.keys(data2.fsm).length} files</td>
          <td>${Object.keys(data2.fsm).length - Object.keys(data1.fsm).length > 0 ? "+" : ""}${Object.keys(data2.fsm).length - Object.keys(data1.fsm).length}</td>
        </tr>
        <tr>
          <td><strong>VLM Evaluation</strong></td>
          <td>${Object.keys(data1.vlm).length} files</td>
          <td>${Object.keys(data2.vlm).length} files</td>
          <td>${Object.keys(data2.vlm).length - Object.keys(data1.vlm).length > 0 ? "+" : ""}${Object.keys(data2.vlm).length - Object.keys(data1.vlm).length}</td>
        </tr>
        <tr>
          <td><strong>Playwright Tests</strong></td>
          <td>${Object.keys(data1.playwright).length} files</td>
          <td>${Object.keys(data2.playwright).length} files</td>
          <td>${Object.keys(data2.playwright).length - Object.keys(data1.playwright).length > 0 ? "+" : ""}${Object.keys(data2.playwright).length - Object.keys(data1.playwright).length}</td>
        </tr>
        <tr>
          <td><strong>Correlation Analysis</strong></td>
          <td>${data1.correlation ? `N=${data1.correlation.sampleSize}` : "N/A"}</td>
          <td>${data2.correlation ? `N=${data2.correlation.sampleSize}` : "N/A"}</td>
          <td>${data1.correlation && data2.correlation ? `${data2.correlation.sampleSize - data1.correlation.sampleSize > 0 ? "+" : ""}${data2.correlation.sampleSize - data1.correlation.sampleSize}` : "N/A"}</td>
        </tr>
      </tbody>
    </table>
  `;
}

function generateDataSourcesSection(data1, data2) {
  return `
    <h2>📁 Data Sources</h2>
    
    <h3>${data1.workspace}</h3>
    <div class="source-info">
      <strong>Human Evaluation:</strong> ${data1.sources.human}<br>
      <strong>FSM Similarity:</strong> ${data1.sources.fsm}<br>
      <strong>VLM Evaluation:</strong> ${data1.sources.vlm}<br>
      <strong>Playwright Tests:</strong> ${data1.sources.playwright}<br>
      <strong>Correlation Data:</strong> ${data1.sources.correlation}
    </div>

    <h3>${data2.workspace}</h3>
    <div class="source-info">
      <strong>Human Evaluation:</strong> ${data2.sources.human}<br>
      <strong>FSM Similarity:</strong> ${data2.sources.fsm}<br>
      <strong>VLM Evaluation:</strong> ${data2.sources.vlm}<br>
      <strong>Playwright Tests:</strong> ${data2.sources.playwright}<br>
      <strong>Correlation Data:</strong> ${data2.sources.correlation}
    </div>
  `;
}

function generateCorrelationComparisonSection(data1, data2) {
  if (!data1.correlation || !data2.correlation) {
    return `<h2>⚠️ Correlation Comparison</h2><p>Correlation data not available for one or both workspaces.</p>`;
  }

  const dimensions = [
    "functional",
    "visual",
    "interactivity",
    "pedagogical",
    "overall",
  ];
  const frameworks = ["fsm", "vlm", "playwright"];
  const frameworkNames = {
    fsm: "FSM-based",
    vlm: "VLM (Baseline 1)",
    playwright: "Playwright (Baseline 2)",
  };

  let html = `<h2>🔗 Correlation Comparison</h2>`;

  for (const fw of frameworks) {
    html += `
      <h3>${frameworkNames[fw]}</h3>
      <table>
        <thead>
          <tr>
            <th>Dimension</th>
            <th>${data1.workspace}</th>
            <th>${data2.workspace}</th>
            <th>Δ Change</th>
            <th>Interpretation</th>
          </tr>
        </thead>
        <tbody>
    `;

    for (const dim of dimensions) {
      const r1 = data1.correlation.correlations[fw][dim];
      const r2 = data2.correlation.correlations[fw][dim];
      const diff = r2.r - r1.r;
      const dimName = dim.charAt(0).toUpperCase() + dim.slice(1);

      const r1Class =
        r1.r > 0.2 ? "positive" : r1.r < -0.1 ? "negative" : "neutral";
      const r2Class =
        r2.r > 0.2 ? "positive" : r2.r < -0.1 ? "negative" : "neutral";
      const diffClass = Math.abs(diff) > 0.3 ? "highlight" : "";

      const interpretation =
        Math.abs(diff) > 0.5
          ? '<span class="badge badge-danger">Major Change</span>'
          : Math.abs(diff) > 0.3
            ? '<span class="badge badge-warning">Significant Change</span>'
            : '<span class="badge badge-info">Minor Change</span>';

      html += `
        <tr class="${diffClass}">
          <td><strong>${dimName}</strong></td>
          <td class="${r1Class}">r=${r1.r.toFixed(3)}${r1.stars}</td>
          <td class="${r2Class}">r=${r2.r.toFixed(3)}${r2.stars}</td>
          <td class="${diff > 0 ? "positive" : "negative"}">${diff > 0 ? "+" : ""}${diff.toFixed(3)}</td>
          <td>${interpretation}</td>
        </tr>
      `;
    }

    html += `
        </tbody>
      </table>
    `;
  }

  return html;
}

function generateDistributionAnalysisSection(data1, data2) {
  let html = `<h2>📊 Score Distribution Analysis</h2>`;

  // Human scores
  const humanScores1 = Object.values(data1.human).map(
    (h) => (h.functional + h.visual + h.interactivity + h.pedagogical) / 4,
  );
  const humanScores2 = Object.values(data2.human).map(
    (h) => (h.functional + h.visual + h.interactivity + h.pedagogical) / 4,
  );

  // FSM raw scores
  const fsmScores1 = data1.fsmRawScores;
  const fsmScores2 = data2.fsmRawScores;

  // VLM scores
  const vlmScores1 = Object.values(data1.vlm).map((v) => v.visual_quality);
  const vlmScores2 = Object.values(data2.vlm).map((v) => v.visual_quality);

  // Playwright scores
  const playwrightScores1 = Object.values(data1.playwright).map((p) => p.score);
  const playwrightScores2 = Object.values(data2.playwright).map((p) => p.score);

  const stats1Human = getDistributionStats(humanScores1);
  const stats2Human = getDistributionStats(humanScores2);
  const stats1FSM = getDistributionStats(fsmScores1);
  const stats2FSM = getDistributionStats(fsmScores2);
  const stats1VLM = getDistributionStats(vlmScores1);
  const stats2VLM = getDistributionStats(vlmScores2);
  const stats1Playwright = getDistributionStats(playwrightScores1);
  const stats2Playwright = getDistributionStats(playwrightScores2);

  html += `
    <h3>Human Evaluation Scores (Overall Average)</h3>
    <div class="comparison-row">
      <div class="chart-box">
        <h4>${data1.workspace}</h4>
        ${generateHistogram(humanScores1, "Human Overall Score")}
        ${generateStatsTable(stats1Human)}
      </div>
      <div class="chart-box">
        <h4>${data2.workspace}</h4>
        ${generateHistogram(humanScores2, "Human Overall Score")}
        ${generateStatsTable(stats2Human)}
      </div>
    </div>

    <h3>FSM Similarity Scores (Raw Average)</h3>
    <div class="comparison-row">
      <div class="chart-box">
        <h4>${data1.workspace}</h4>
        ${generateHistogram(fsmScores1, "FSM Raw Score")}
        ${generateStatsTable(stats1FSM)}
      </div>
      <div class="chart-box">
        <h4>${data2.workspace}</h4>
        ${generateHistogram(fsmScores2, "FSM Raw Score")}
        ${generateStatsTable(stats2FSM)}
      </div>
    </div>

    <h3>VLM Visual Quality Scores</h3>
    <div class="comparison-row">
      <div class="chart-box">
        <h4>${data1.workspace}</h4>
        ${generateHistogram(vlmScores1, "VLM Visual Quality")}
        ${generateStatsTable(stats1VLM)}
      </div>
      <div class="chart-box">
        <h4>${data2.workspace}</h4>
        ${generateHistogram(vlmScores2, "VLM Visual Quality")}
        ${generateStatsTable(stats2VLM)}
      </div>
    </div>

    <h3>Playwright Model-Level Scores</h3>
    <div class="comparison-row">
      <div class="chart-box">
        <h4>${data1.workspace}</h4>
        ${generateHistogram(playwrightScores1, "Playwright Score")}
        ${generateStatsTable(stats1Playwright)}
      </div>
      <div class="chart-box">
        <h4>${data2.workspace}</h4>
        ${generateHistogram(playwrightScores2, "Playwright Score")}
        ${generateStatsTable(stats2Playwright)}
      </div>
    </div>
  `;

  return html;
}

function generateStatsTable(stats) {
  if (!stats) return "<p>No data available</p>";

  return `
    <table style="margin-top: 15px; font-size: 10pt;">
      <tr><td><strong>Count</strong></td><td>${stats.count}</td></tr>
      <tr><td><strong>Mean</strong></td><td>${stats.mean.toFixed(4)}</td></tr>
      <tr><td><strong>Std Dev</strong></td><td>${stats.std.toFixed(4)}</td></tr>
      <tr><td><strong>Min</strong></td><td>${stats.min.toFixed(4)}</td></tr>
      <tr><td><strong>Q25</strong></td><td>${stats.q25.toFixed(4)}</td></tr>
      <tr><td><strong>Median</strong></td><td>${stats.median.toFixed(4)}</td></tr>
      <tr><td><strong>Q75</strong></td><td>${stats.q75.toFixed(4)}</td></tr>
      <tr><td><strong>Max</strong></td><td>${stats.max.toFixed(4)}</td></tr>
    </table>
  `;
}

function generateSampleDetailsSection(data1, data2) {
  // Find common UUIDs
  const uuids1 = new Set(Object.keys(data1.human));
  const uuids2 = new Set(Object.keys(data2.human));
  const commonUUIDs = [...uuids1].filter((u) => uuids2.has(u)).slice(0, 20);

  let html = `
    <h2>🔬 Sample Details (First 20 Common Samples)</h2>
    <p style="color: #7f8c8d; margin-bottom: 20px;">
      Showing detailed scores for samples present in both workspaces.
      Total common samples: ${[...uuids1].filter((u) => uuids2.has(u)).length}
    </p>
    <table style="font-size: 10pt;">
      <thead>
        <tr>
          <th rowspan="2">UUID</th>
          <th colspan="4">Human (${data1.workspace})</th>
          <th colspan="4">Human (${data2.workspace})</th>
          <th colspan="2">FSM</th>
          <th colspan="2">VLM</th>
        </tr>
        <tr>
          <th>Func</th><th>Vis</th><th>Inter</th><th>Ped</th>
          <th>Func</th><th>Vis</th><th>Inter</th><th>Ped</th>
          <th>${data1.workspace}</th><th>${data2.workspace}</th>
          <th>${data1.workspace}</th><th>${data2.workspace}</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const uuid of commonUUIDs) {
    const h1 = data1.human[uuid];
    const h2 = data2.human[uuid];
    const fsm1 = data1.fsm[uuid]?.raw || "N/A";
    const fsm2 = data2.fsm[uuid]?.raw || "N/A";
    const vlm1 = data1.vlm[uuid]?.visual_quality || "N/A";
    const vlm2 = data2.vlm[uuid]?.visual_quality || "N/A";

    html += `
      <tr>
        <td style="font-family: monospace; font-size: 9pt;">${uuid.substring(0, 20)}...</td>
        <td>${h1.functional.toFixed(2)}</td>
        <td>${h1.visual.toFixed(2)}</td>
        <td>${h1.interactivity.toFixed(2)}</td>
        <td>${h1.pedagogical.toFixed(2)}</td>
        <td>${h2.functional.toFixed(2)}</td>
        <td>${h2.visual.toFixed(2)}</td>
        <td>${h2.interactivity.toFixed(2)}</td>
        <td>${h2.pedagogical.toFixed(2)}</td>
        <td>${typeof fsm1 === "number" ? fsm1.toFixed(4) : fsm1}</td>
        <td>${typeof fsm2 === "number" ? fsm2.toFixed(4) : fsm2}</td>
        <td>${typeof vlm1 === "number" ? vlm1.toFixed(2) : vlm1}</td>
        <td>${typeof vlm2 === "number" ? vlm2.toFixed(2) : vlm2}</td>
      </tr>
    `;
  }

  html += `
      </tbody>
    </table>
  `;

  return html;
}

function generateKeyFindingsSection(data1, data2) {
  let findings = [];

  // Compare correlation changes
  if (data1.correlation && data2.correlation) {
    const fsmOverallDiff =
      data2.correlation.correlations.fsm.overall.r -
      data1.correlation.correlations.fsm.overall.r;
    if (Math.abs(fsmOverallDiff) > 0.3) {
      findings.push({
        type: fsmOverallDiff > 0 ? "positive" : "negative",
        title: "FSM Correlation Major Change",
        description: `FSM overall correlation changed from ${data1.correlation.correlations.fsm.overall.r.toFixed(3)} to ${data2.correlation.correlations.fsm.overall.r.toFixed(3)} (Δ ${fsmOverallDiff > 0 ? "+" : ""}${fsmOverallDiff.toFixed(3)})`,
      });
    }

    const vlmOverallDiff =
      data2.correlation.correlations.vlm.overall.r -
      data1.correlation.correlations.vlm.overall.r;
    if (Math.abs(vlmOverallDiff) > 0.2) {
      findings.push({
        type: vlmOverallDiff > 0 ? "positive" : "negative",
        title: "VLM Correlation Change",
        description: `VLM overall correlation changed from ${data1.correlation.correlations.vlm.overall.r.toFixed(3)} to ${data2.correlation.correlations.vlm.overall.r.toFixed(3)} (Δ ${vlmOverallDiff > 0 ? "+" : ""}${vlmOverallDiff.toFixed(3)})`,
      });
    }
  }

  // Compare data sizes
  const sizeRatio =
    Object.keys(data2.human).length / Object.keys(data1.human).length;
  if (sizeRatio > 1.2 || sizeRatio < 0.8) {
    findings.push({
      type: "info",
      title: "Sample Size Difference",
      description: `${data2.workspace} has ${((sizeRatio - 1) * 100).toFixed(1)}% ${sizeRatio > 1 ? "more" : "fewer"} samples than ${data1.workspace}`,
    });
  }

  // FSM score distribution
  const fsmMean1 =
    data1.fsmRawScores.reduce((a, b) => a + b, 0) / data1.fsmRawScores.length;
  const fsmMean2 =
    data2.fsmRawScores.reduce((a, b) => a + b, 0) / data2.fsmRawScores.length;
  findings.push({
    type: "info",
    title: "FSM Score Distribution",
    description: `FSM mean: ${data1.workspace} = ${fsmMean1.toFixed(4)}, ${data2.workspace} = ${fsmMean2.toFixed(4)}`,
  });

  let html = `
    <h2>🎯 Key Findings</h2>
    <div style="margin: 20px 0;">
  `;

  for (const finding of findings) {
    const badgeClass =
      finding.type === "positive"
        ? "badge-success"
        : finding.type === "negative"
          ? "badge-danger"
          : finding.type === "warning"
            ? "badge-warning"
            : "badge-info";

    html += `
      <div style="background: white; border-left: 4px solid ${finding.type === "positive" ? "#27ae60" : finding.type === "negative" ? "#e74c3c" : "#3498db"}; padding: 15px; margin: 15px 0; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <span class="badge ${badgeClass}">${finding.title}</span>
        <p style="margin-top: 10px; color: #34495e;">${finding.description}</p>
      </div>
    `;
  }

  html += `
    </div>
  `;

  return html;
}

// ========== MAIN =============
function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Workspace Data Comparison Report Generator");
  console.log("═══════════════════════════════════════════════════════════");

  const data1 = loadWorkspaceData(WORKSPACE1);
  const data2 = loadWorkspaceData(WORKSPACE2);

  console.log("\n📝 Generating comparison report...");
  const html = generateComparisonHTML(data1, data2);

  fs.writeFileSync(OUTPUT_HTML, html);

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(`✅ Report generated successfully!`);
  console.log(`   📊 File: ${OUTPUT_HTML}`);
  console.log(`   🌐 Open in browser to view`);
  console.log("═══════════════════════════════════════════════════════════\n");
}

main();
