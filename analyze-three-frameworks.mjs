// Complete Correlation Analysis: FSM vs VLM vs Playwright with Human Evaluation
// Usage: node analyze-three-frameworks.mjs [workspace-name]
// Example: node analyze-three-frameworks.mjs 0126-biased
import fs from "fs";
import path from "path";

// ========== CONFIG =============
// Get workspace from command line argument, default to "0126-biased"
const WORKSPACE = process.argv[2] || "0126-biased";
const HUMAN_EVAL_PATH = path.join(
  "human-evaluation-data",
  "01-28",
  "results.json",
);
const FSM_EVAL_PATH = path.join(
  "workspace",
  WORKSPACE,
  // "fsm-similarity-results.json",
  "fsm-similarity-results-latest.json",
);

const VLM_EVAL_DIR = path.join("workspace", WORKSPACE, "visual-results");
const DATA_DIR = path.join("workspace", WORKSPACE, "data");

const OUTPUT_HTML = `three-frameworks-correlation-report-${WORKSPACE}.html`;
const OUTPUT_JSON = `three-frameworks-correlation-data-${WORKSPACE}.json`;

// Playwright model-level scores from baseline-report.html
const PLAYWRIGHT_SCORES = {
  "gpt-3.5-turbo": 0.11,
  "gpt-4o": 0.0258,
  "gpt-4o-mini": 0.1557,
  "gpt-5-mini": 0.0,
  "deepseek-chat": 0.488,
  "Qwen1.5-0.5B-Chat": 0.7603,
  "meta-llama/Llama-3.2-1B-Instruct": 0.2716,
};

// ========== LOADERS =============
function loadHumanEvaluation() {
  console.log("📊 Loading human evaluation data...");
  const data = JSON.parse(fs.readFileSync(HUMAN_EVAL_PATH, "utf-8"));
  const map = {};

  for (const r of data) {
    const uuid = r.html_id.replace(".html", "");
    if (!map[uuid]) {
      map[uuid] = {
        functional: [],
        visual: [],
        interactivity: [],
        pedagogical: [],
      };
    }
    map[uuid].functional.push(r.scores.functional);
    map[uuid].visual.push(r.scores.visual);
    map[uuid].interactivity.push(r.scores.interactivity);
    map[uuid].pedagogical.push(r.scores.pedagogical);
  }

  // Average across annotators
  const avg = {};
  for (const uuid in map) {
    avg[uuid] = {
      functional: mean(map[uuid].functional),
      visual: mean(map[uuid].visual),
      interactivity: mean(map[uuid].interactivity),
      pedagogical: mean(map[uuid].pedagogical),
    };
  }

  console.log(
    `   ✓ Loaded ${Object.keys(avg).length} HTML files with human ratings`,
  );
  return avg;
}

function loadFSMEvaluation() {
  console.log("📊 Loading FSM evaluation data...");
  const raw = JSON.parse(fs.readFileSync(FSM_EVAL_PATH, "utf-8"));
  const data = raw.results || [];
  const rawData = {};

  // First pass: collect raw scores
  for (const r of data) {
    const uuid = r.html_id
      ? r.html_id.replace(".html", "")
      : r.fsmFileName
        ? r.fsmFileName.replace(".json", "")
        : null;
    if (!uuid) continue;

    const sim = r.similarityResult || r;
    if (!sim) continue;

    // Use combined_similarity.raw_score from the recalculated data (respects custom weights)
    // Fallback to individual dimensions if combined_similarity is not available
    let average;
    if (sim.combined_similarity?.raw_score !== undefined) {
      // Use the pre-calculated weighted score from fsm-similarity-results-latest.json
      average = sim.combined_similarity.raw_score;
    } else {
      // Fallback: calculate average of 3 dimensions (equal weights)
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

      if (structural === null || semantic === null || isomorphism === null) {
        continue;
      }
      average = (structural + semantic + isomorphism) / 3;
    }

    // Still collect individual dimensions for reference
    const structural =
      sim.dimension1_interaction_capacity?.score ??
      sim.structural_similarity?.overall ??
      0;
    const semantic =
      sim.dimension2_behavioral_coherence?.score ??
      sim.semantic_similarity?.overall ??
      0;
    const isomorphism =
      sim.dimension3_interaction_meaningfulness?.score ??
      sim.isomorphism_similarity ??
      0;

    rawData[uuid] = {
      structural,
      semantic,
      isomorphism,
      average,
    };
  }

  // Second pass: normalize average scores using min-max to [0, 1]
  const averages = Object.values(rawData).map((d) => d.average);
  const minScore = Math.min(...averages);
  const maxScore = Math.max(...averages);
  const range = maxScore - minScore;

  console.log(
    `   📊 FSM raw average range: [${minScore.toFixed(4)}, ${maxScore.toFixed(4)}]`,
  );

  const map = {};
  for (const uuid in rawData) {
    // Normalize to [0, 1] - no inversion
    // Higher FSM similarity = higher score (better quality alignment)
    const normalized =
      range > 0 ? (rawData[uuid].average - minScore) / range : 0.5;

    map[uuid] = {
      structural: rawData[uuid].structural,
      semantic: rawData[uuid].semantic,
      isomorphism: rawData[uuid].isomorphism,
      average: normalized, // Normalized score without inversion
    };
  }

  console.log(
    `   ✓ Loaded ${Object.keys(map).length} FSM evaluation results (average normalized to [0, 1])`,
  );
  return map;
}

function loadVLMEvaluation() {
  console.log("📊 Loading VLM evaluation data...");
  const map = {};
  if (!fs.existsSync(VLM_EVAL_DIR)) return map;

  const files = fs
    .readdirSync(VLM_EVAL_DIR)
    .filter((f) => f.endsWith(".json") && f !== "_summary.json");
  for (const file of files) {
    const uuid = file.replace(".json", "");
    const data = JSON.parse(
      fs.readFileSync(path.join(VLM_EVAL_DIR, file), "utf-8"),
    );
    if (data.visual_quality !== undefined) {
      map[uuid] = {
        visual_quality: data.visual_quality,
        educational_quality: data.educational_quality,
      };
    }
  }

  console.log(`   ✓ Loaded ${Object.keys(map).length} VLM evaluation results`);
  return map;
}

function loadPlaywrightEvaluation() {
  console.log("📊 Loading Playwright evaluation data (model-level)...");
  const map = {};

  // Read all data files to get model information
  if (!fs.existsSync(DATA_DIR)) {
    console.log("   ⚠️  Data directory not found");
    return map;
  }

  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    const uuid = file.replace(".json", "");
    try {
      const data = JSON.parse(
        fs.readFileSync(path.join(DATA_DIR, file), "utf-8"),
      );
      const model = data.model;

      if (model && PLAYWRIGHT_SCORES[model] !== undefined) {
        map[uuid] = {
          model,
          score: PLAYWRIGHT_SCORES[model],
        };
      }
    } catch (err) {
      // Skip invalid files
    }
  }

  console.log(
    `   ✓ Loaded ${Object.keys(map).length} HTML files with Playwright scores`,
  );
  return map;
}

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

function calculatePValue(r, n) {
  if (n < 3) return 1.0;
  const t = r * Math.sqrt((n - 2) / (1 - r * r));
  return 2 * (1 - normalCdf(Math.abs(t)));
}

function normalCdf(z) {
  return 0.5 * (1 + erf(z / Math.sqrt(2)));
}

function erf(x) {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const a1 = 0.254829592,
    a2 = -0.284496736,
    a3 = 1.421413741;
  const a4 = -1.453152027,
    a5 = 1.061405429,
    p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y =
    1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

function calculateCI(r, n) {
  if (n < 4) return [r, r];
  const z = 0.5 * Math.log((1 + r) / (1 - r));
  const se = 1 / Math.sqrt(n - 3);
  const zLow = z - 1.96 * se;
  const zHigh = z + 1.96 * se;
  const rLow = (Math.exp(2 * zLow) - 1) / (Math.exp(2 * zLow) + 1);
  const rHigh = (Math.exp(2 * zHigh) - 1) / (Math.exp(2 * zHigh) + 1);
  return [rLow, rHigh];
}

function getSignificanceStars(p) {
  if (p < 0.001) return "***";
  if (p < 0.01) return "**";
  if (p < 0.05) return "*";
  return "";
}

// ========== ALIGN DATASETS =============
function alignDatasets(human, fsm, vlm, playwright) {
  console.log("\n🔗 Aligning datasets...");

  // Find UUIDs present in all datasets
  const humanUUIDs = new Set(Object.keys(human));
  const fsmUUIDs = new Set(Object.keys(fsm));
  const vlmUUIDs = new Set(Object.keys(vlm));
  const playwrightUUIDs = new Set(Object.keys(playwright));

  const uuids = [...humanUUIDs].filter(
    (u) => fsmUUIDs.has(u) && vlmUUIDs.has(u) && playwrightUUIDs.has(u),
  );

  console.log(`   Human: ${humanUUIDs.size} files`);
  console.log(`   FSM: ${fsmUUIDs.size} files`);
  console.log(`   VLM: ${vlmUUIDs.size} files`);
  console.log(`   Playwright: ${playwrightUUIDs.size} files`);
  console.log(`   ✓ Aligned: ${uuids.length} files with complete data`);

  // Distribution by model
  const modelCounts = {};
  for (const uuid of uuids) {
    const model = playwright[uuid].model;
    modelCounts[model] = (modelCounts[model] || 0) + 1;
  }
  console.log("\n   Distribution by model:");
  for (const [model, count] of Object.entries(modelCounts).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`      ${model}: ${count} files`);
  }

  return uuids;
}

// ========== MAIN ANALYSIS =============
function calculateCorrelations(human, fsm, vlm, playwright, uuids) {
  console.log("\n📈 Calculating correlations...\n");

  const dimensions = [
    "functional",
    "visual",
    "interactivity",
    "pedagogical",
    "overall",
  ];
  const correlations = {
    fsm: {},
    vlm: {},
    playwright: {},
  };

  for (const dim of dimensions) {
    // Extract human scores for this dimension
    let humanScores;
    if (dim === "overall") {
      // Calculate overall as average of all 4 dimensions
      humanScores = uuids.map((u) => {
        const h = human[u];
        return (h.functional + h.visual + h.interactivity + h.pedagogical) / 4;
      });
    } else {
      humanScores = uuids.map((u) => human[u][dim]);
    }

    // FSM: use average of 3 dimensions
    const fsmScores = uuids.map((u) => fsm[u].average);
    const rFsm = pearsonCorrelation(humanScores, fsmScores);
    const pFsm = calculatePValue(rFsm, uuids.length);
    const ciFsm = calculateCI(rFsm, uuids.length);
    correlations.fsm[dim] = {
      r: rFsm,
      p: pFsm,
      n: uuids.length,
      ci: ciFsm,
      stars: getSignificanceStars(pFsm),
    };

    // VLM: use visual_quality
    const vlmScores = uuids.map((u) => vlm[u].visual_quality);
    const rVlm = pearsonCorrelation(humanScores, vlmScores);
    const pVlm = calculatePValue(rVlm, uuids.length);
    const ciVlm = calculateCI(rVlm, uuids.length);
    correlations.vlm[dim] = {
      r: rVlm,
      p: pVlm,
      n: uuids.length,
      ci: ciVlm,
      stars: getSignificanceStars(pVlm),
    };

    // Playwright: use model-level score
    const playwrightScores = uuids.map((u) => playwright[u].score);
    const rPlay = pearsonCorrelation(humanScores, playwrightScores);
    const pPlay = calculatePValue(rPlay, uuids.length);
    const ciPlay = calculateCI(rPlay, uuids.length);
    correlations.playwright[dim] = {
      r: rPlay,
      p: pPlay,
      n: uuids.length,
      ci: ciPlay,
      stars: getSignificanceStars(pPlay),
    };

    // Print results
    console.log(`${dim.toUpperCase()}:`);
    console.log(
      `   FSM:        r=${rFsm.toFixed(3)}${correlations.fsm[dim].stars.padEnd(3)} (p=${pFsm.toFixed(4)}, CI=[${ciFsm[0].toFixed(2)}, ${ciFsm[1].toFixed(2)}])`,
    );
    console.log(
      `   VLM:        r=${rVlm.toFixed(3)}${correlations.vlm[dim].stars.padEnd(3)} (p=${pVlm.toFixed(4)}, CI=[${ciVlm[0].toFixed(2)}, ${ciVlm[1].toFixed(2)}])`,
    );
    console.log(
      `   Playwright: r=${rPlay.toFixed(3)}${correlations.playwright[dim].stars.padEnd(3)} (p=${pPlay.toFixed(4)}, CI=[${ciPlay[0].toFixed(2)}, ${ciPlay[1].toFixed(2)}])`,
    );
    console.log("");
  }

  return correlations;
}

function generateHTMLReport(correlations, nSamples) {
  const dims = [
    "functional",
    "visual",
    "interactivity",
    "pedagogical",
    "overall",
  ];
  const dimNames = {
    functional: "Functional",
    visual: "Visual",
    interactivity: "Interactivity",
    pedagogical: "Pedagogical",
    overall: "Overall",
  };

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset='utf-8'>
  <title>Three-Framework Correlation Analysis (${WORKSPACE})</title>
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
      margin-bottom: 15px;
      border-bottom: 2px solid #333;
      padding-bottom: 5px;
    }
    h3 {
      font-size: 14pt;
      margin-top: 20px;
      margin-bottom: 10px;
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
      text-align: center;
    }
    tr:nth-child(even) { 
      background: #f9f9f9; 
    }
    .rpos { 
      color: #006400; 
      font-weight: bold;
    }
    .rneg { 
      color: #b22222; 
      font-weight: bold;
    }
    .stars { 
      color: #d9534f;
      font-size: 9pt;
      vertical-align: super;
    }
    .note {
      font-size: 10pt;
      margin-top: 10px;
      font-style: italic;
    }
    .summary-box {
      background: #f5f5f5;
      border: 1px solid #ddd;
      padding: 15px;
      margin: 20px 0;
      border-radius: 5px;
    }
    .method-section {
      margin: 30px 0;
      padding: 15px;
      background: #fafafa;
      border-left: 4px solid #333;
    }
    .framework-desc {
      margin: 10px 0;
      padding-left: 20px;
    }
  </style>
</head>
<body>
  <h1>Correlation Analysis: Three Evaluation Frameworks vs Human Judgment</h1>
  <div class="subtitle">Workspace: ${WORKSPACE} | Sample Size: N=${nSamples}</div>
  
  <div class="summary-box">
    <h3>Executive Summary</h3>
    <p><strong>Objective:</strong> Compare three automated evaluation frameworks against human judgment across four quality dimensions.</p>
    <p><strong>Sample Size:</strong> ${nSamples} HTML pages with complete evaluation data from all frameworks.</p>
    <p><strong>Statistical Method:</strong> Pearson correlation coefficient with significance testing (*** p&lt;0.001, ** p&lt;0.01, * p&lt;0.05).</p>
  </div>

  <div class="method-section">
    <h3>Evaluation Frameworks</h3>
    <div class="framework-desc">
      <strong>FSM-based Framework:</strong> Structural behavior analysis using finite state machines. Score = average of three dimensions (structural similarity, semantic similarity, isomorphism similarity). Range: 0-1.
    </div>
    <div class="framework-desc">
      <strong>VLM Framework (Baseline 1):</strong> Vision-Language Model evaluation using GPT-4 Vision API. Score = visual_quality rating. Range: 0-5.
    </div>
    <div class="framework-desc">
      <strong>Playwright Framework (Baseline 2):</strong> DOM-driven functional testing. Score = model-level test pass rate (mean across all tests for each model). Range: 0-1.
    </div>
    <div class="framework-desc">
      <strong>Human Evaluation:</strong> Manual ratings by 2 annotators across 4 dimensions (Functional, Visual, Interactivity, Pedagogical). Range: 0-5.
    </div>
  </div>

  <h2>Main Results</h2>
  
  <table>
    <caption>Table 1. Pearson Correlation (r) between Automated Frameworks and Human Evaluation</caption>
    <thead>
      <tr>
        <th>Framework</th>
        <th>Functional</th>
        <th>Visual</th>
        <th>Interactivity</th>
        <th>Pedagogical</th>
        <th>Overall</th>
      </tr>
    </thead>
    <tbody>
`;

  const frameworks = [
    { key: "fsm", name: "FSM-based" },
    { key: "vlm", name: "VLM (Baseline 1)" },
    { key: "playwright", name: "Playwright (Baseline 2)" },
  ];

  for (const fw of frameworks) {
    html += `      <tr>\n        <td><strong>${fw.name}</strong></td>\n`;
    for (const dim of dims) {
      const c = correlations[fw.key][dim];
      const className = c.r > 0.2 ? "rpos" : c.r < -0.1 ? "rneg" : "";
      html += `        <td class='${className}'>${c.r.toFixed(3)}<span class="stars">${c.stars}</span></td>\n`;
    }
    html += `      </tr>\n`;
  }

  html += `    </tbody>
  </table>
  
  <p class="note"><strong>Note:</strong> * p&lt;0.05, ** p&lt;0.01, *** p&lt;0.001. Green indicates positive correlation (r&gt;0.2), red indicates negative correlation (r&lt;-0.1).</p>

  <h2>Detailed Statistics</h2>
  
  <table>
    <caption>Table 2. Complete Statistical Analysis</caption>
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
`;

  for (const fw of frameworks) {
    for (const dim of dims) {
      const c = correlations[fw.key][dim];
      let interpretation = "";
      if (c.p < 0.001) interpretation = "Highly significant";
      else if (c.p < 0.01) interpretation = "Very significant";
      else if (c.p < 0.05) interpretation = "Significant";
      else interpretation = "Not significant";

      if (Math.abs(c.r) < 0.1) interpretation += ", negligible";
      else if (Math.abs(c.r) < 0.3) interpretation += ", weak";
      else if (Math.abs(c.r) < 0.5) interpretation += ", moderate";
      else interpretation += ", strong";

      html += `      <tr>
        <td>${fw.name}</td>
        <td>${dimNames[dim]}</td>
        <td>${c.r.toFixed(3)}${c.stars}</td>
        <td>${c.n}</td>
        <td>${c.p < 0.001 ? "<0.001" : c.p.toFixed(4)}</td>
        <td>[${c.ci[0].toFixed(2)}, ${c.ci[1].toFixed(2)}]</td>
        <td>${interpretation}</td>
      </tr>
`;
    }
  }

  html += `    </tbody>
  </table>

  <h2>Key Findings</h2>
  <div class="summary-box">
    <h3>1. FSM-based Framework Performance</h3>
    <ul>
`;

  // Analyze FSM results
  for (const dim of dims) {
    const c = correlations.fsm[dim];
    html += `      <li><strong>${dimNames[dim]}:</strong> r=${c.r.toFixed(3)}${c.stars} (${c.p < 0.05 ? "significant" : "not significant"})</li>\n`;
  }

  html += `    </ul>
    
    <h3>2. VLM Framework Performance</h3>
    <ul>
`;

  for (const dim of dims) {
    const c = correlations.vlm[dim];
    html += `      <li><strong>${dimNames[dim]}:</strong> r=${c.r.toFixed(3)}${c.stars} (${c.p < 0.05 ? "significant" : "not significant"})</li>\n`;
  }

  html += `    </ul>
    
    <h3>3. Playwright Framework Performance</h3>
    <ul>
`;

  for (const dim of dims) {
    const c = correlations.playwright[dim];
    html += `      <li><strong>${dimNames[dim]}:</strong> r=${c.r.toFixed(3)}${c.stars} (${c.p < 0.05 ? "significant" : "not significant"})</li>\n`;
  }

  html += `    </ul>
  </div>

  <h2>Conclusion</h2>
  <p>This analysis compared three automated evaluation frameworks against human judgment across four quality dimensions using ${nSamples} HTML pages from the ${WORKSPACE} workspace. Statistical significance was assessed using Pearson correlation coefficients with p-value calculations.</p>
  
  <p class="note"><strong>Generated:</strong> ${new Date().toISOString()}</p>
</body>
</html>`;

  return html;
}

// ========== RUN =============
function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Three-Framework Correlation Analysis (${WORKSPACE})`);
  console.log("═══════════════════════════════════════════════════════════\n");

  // Validate workspace exists
  const workspaceDir = path.join("workspace", WORKSPACE);
  if (!fs.existsSync(workspaceDir)) {
    console.error(`\n❌ ERROR: Workspace directory not found: ${workspaceDir}`);
    console.error(`   Available workspaces:`);
    const workspaces = fs
      .readdirSync("workspace")
      .filter((f) => fs.statSync(path.join("workspace", f)).isDirectory());
    workspaces.forEach((w) => console.error(`      - ${w}`));
    process.exit(1);
  }

  // Load all data
  const human = loadHumanEvaluation();
  const fsm = loadFSMEvaluation();
  const vlm = loadVLMEvaluation();
  const playwright = loadPlaywrightEvaluation();

  // Align datasets
  const uuids = alignDatasets(human, fsm, vlm, playwright);

  if (uuids.length < 10) {
    console.error(
      "\n❌ ERROR: Too few aligned samples for reliable correlation analysis.",
    );
    console.error(`   Need at least 10 samples, found ${uuids.length}.`);
    process.exit(1);
  }

  // Calculate correlations
  const correlations = calculateCorrelations(
    human,
    fsm,
    vlm,
    playwright,
    uuids,
  );

  // Save results
  const results = {
    workspace: WORKSPACE,
    sampleSize: uuids.length,
    timestamp: new Date().toISOString(),
    correlations,
    uuids,
    methodology: {
      human:
        "Average of 2 annotators across 4 dimensions (Functional, Visual, Interactivity, Pedagogical)",
      fsm: "Average of 3 dimensions (structural, semantic, isomorphism)",
      vlm: "visual_quality score from Vision-Language Model",
      playwright: "Model-level test pass rate (mean)",
    },
  };

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(results, null, 2));
  fs.writeFileSync(OUTPUT_HTML, generateHTMLReport(correlations, uuids.length));

  console.log("═══════════════════════════════════════════════════════════");
  console.log(`✅ Analysis complete!`);
  console.log(`   📊 HTML Report: ${OUTPUT_HTML}`);
  console.log(`   📁 Raw Data: ${OUTPUT_JSON}`);
  console.log("═══════════════════════════════════════════════════════════\n");
}

main();
