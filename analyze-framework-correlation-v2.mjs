// Correlation analysis for 0126-biased workspace (copied from analyze-framework-correlation.mjs)
import fs from "fs";
import path from "path";

// ========== CONFIG =============
const WORKSPACE = "0126-biased";
const HUMAN_EVAL_PATH = path.join(
  "human-evaluation-data",
  "01-28",
  "results.json",
);
const FSM_EVAL_PATH = path.join(
  "workspace",
  WORKSPACE,
  "fsm-similarity-results.json",
);
const VLM_EVAL_DIR = path.join("workspace", WORKSPACE, "visual-results");

const OUTPUT_HTML = `framework-correlation-v2-report.html`;
const OUTPUT_JSON = `framework-correlation-v2-data.json`;

// ========== LOADERS =============
function loadHumanEvaluation() {
  const data = JSON.parse(fs.readFileSync(HUMAN_EVAL_PATH, "utf-8"));
  // Map: uuid -> { functional: [scores], visual: [scores], interactivity: [scores], pedagogical: [scores] }
  const map = {};
  for (const r of data) {
    const uuid = r.html_id.replace(".html", "");
    if (!map[uuid])
      map[uuid] = {
        functional: [],
        visual: [],
        interactivity: [],
        pedagogical: [],
      };
    map[uuid].functional.push(r.functional);
    map[uuid].visual.push(r.visual);
    map[uuid].interactivity.push(r.interactivity);
    map[uuid].pedagogical.push(r.pedagogical);
  }
  // Average per uuid
  const avg = {};
  for (const uuid in map) {
    avg[uuid] = {
      functional: mean(map[uuid].functional),
      visual: mean(map[uuid].visual),
      interactivity: mean(map[uuid].interactivity),
      pedagogical: mean(map[uuid].pedagogical),
    };
  }
  return avg;
}

function loadFSMEvaluation() {
  const raw = JSON.parse(fs.readFileSync(FSM_EVAL_PATH, "utf-8"));
  const data = raw.results || [];
  // Map: uuid -> { structural, semantic, isomorphism, combined }
  const map = {};
  for (const r of data) {
    // Some records may use html_id, some may use fsmFileName (for ideal FSMs)
    const uuid = r.html_id
      ? r.html_id.replace(".html", "")
      : r.fsmFileName
        ? r.fsmFileName.replace(".json", "")
        : null;
    if (!uuid) continue;
    // similarityResult is the main result object
    const sim = r.similarityResult || r;
    map[uuid] = {
      structural: sim.dimension1_interaction_capacity?.score ?? null,
      semantic: sim.dimension2_behavioral_coherence?.score ?? null,
      isomorphism: sim.dimension3_interaction_meaningfulness?.score ?? null,
      combined: sim.combined_similarity?.score ?? null,
    };
  }
  return map;
}

function loadVLMEvaluation() {
  const map = {};
  if (!fs.existsSync(VLM_EVAL_DIR)) return map;
  for (const file of fs.readdirSync(VLM_EVAL_DIR)) {
    if (!file.endsWith(".json")) continue;
    const uuid = file.replace(".json", "");
    const data = JSON.parse(
      fs.readFileSync(path.join(VLM_EVAL_DIR, file), "utf-8"),
    );
    map[uuid] = {
      visual_quality: data.visual_quality ?? null,
      pedagogical_quality: data.pedagogical_quality ?? null,
      interactivity_quality: data.interactivity_quality ?? null,
      functional_quality: data.functional_quality ?? null,
    };
  }
  return map;
}

// ========== UTILS =============
function mean(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function pearsonCorrelation(x, y) {
  const n = x.length;
  const mx = mean(x);
  const my = mean(y);
  let num = 0,
    dx = 0,
    dy = 0;
  for (let i = 0; i < n; ++i) {
    num += (x[i] - mx) * (y[i] - my);
    dx += (x[i] - mx) ** 2;
    dy += (y[i] - my) ** 2;
  }
  return num / Math.sqrt(dx * dy);
}

function calculatePValue(r, n) {
  if (n < 3) return 1.0;
  const t = r * Math.sqrt((n - 2) / (1 - r * r));
  // 2-sided p-value from t-distribution (approximate with normal for large n)
  const p = 2 * (1 - normalCdf(Math.abs(t)));
  return p;
}

function normalCdf(z) {
  // Standard normal CDF
  return 0.5 * (1 + erf(z / Math.sqrt(2)));
}
function erf(x) {
  // Approximate error function
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
  // Fisher z-transform for 95% CI
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
function alignDatasets(human, fsm, vlm) {
  // Only keep uuids present in all three
  const uuids = Object.keys(human).filter((u) => fsm[u] && vlm[u]);
  return uuids;
}

// ========== MAIN ANALYSIS =============
function calculateCorrelations(human, fsm, vlm, uuids) {
  // For each dimension: functional, visual, interactivity, pedagogical
  // For each framework: FSM (combined), VLM (visual_quality)
  const dimensions = ["functional", "visual", "interactivity", "pedagogical"];
  const correlations = { fsm: {}, vlm: {} };
  for (const dim of dimensions) {
    // FSM
    const x1 = uuids.map((u) => human[u][dim]);
    const y1 = uuids.map((u) => fsm[u].combined);
    const r1 = pearsonCorrelation(x1, y1);
    const p1 = calculatePValue(r1, uuids.length);
    const ci1 = calculateCI(r1, uuids.length);
    correlations.fsm[dim] = {
      r: r1,
      p: p1,
      n: uuids.length,
      ci: ci1,
      stars: getSignificanceStars(p1),
    };
    // VLM
    const y2 = uuids.map((u) => vlm[u].visual_quality);
    const r2 = pearsonCorrelation(x1, y2);
    const p2 = calculatePValue(r2, uuids.length);
    const ci2 = calculateCI(r2, uuids.length);
    correlations.vlm[dim] = {
      r: r2,
      p: p2,
      n: uuids.length,
      ci: ci2,
      stars: getSignificanceStars(p2),
    };
  }
  return correlations;
}

function generateHTMLReport(correlations) {
  const dims = ["functional", "visual", "interactivity", "pedagogical"];
  const dimNames = {
    functional: "Functional",
    visual: "Visual",
    interactivity: "Interactivity",
    pedagogical: "Pedagogical",
  };
  let html = `<!DOCTYPE html>\n<html><head><meta charset='utf-8'><title>Framework Correlation Report (0126-biased)</title>\n<style>body{font-family:Times New Roman,serif;}table{border-collapse:collapse;}th,td{border:1px solid #888;padding:6px 12px;}th{background:#eee;}caption{font-weight:bold;margin-bottom:8px;}tr:nth-child(even){background:#f9f9f9;}td.rpos{color:#006400;}td.rneg{color:#b22222;}td.stars{font-weight:bold;color:#b22222;}</style></head><body>\n`;
  html += `<h2>Framework-Human Correlation Report (0126-biased)</h2>\n`;
  html += `<table><caption>Pearson Correlation (r) between Automated Frameworks and Human Evaluation</caption>\n<tr><th>Dimension</th><th>FSM (r)</th><th>VLM (r)</th></tr>\n`;
  for (const dim of dims) {
    const f = correlations.fsm[dim];
    const v = correlations.vlm[dim];
    html += `<tr><td>${dimNames[dim]}</td>`;
    html += `<td class='${f.r > 0.3 ? "rpos" : f.r < -0.1 ? "rneg" : ""}'>${f.r.toFixed(3)}${f.stars}</td>`;
    html += `<td class='${v.r > 0.3 ? "rpos" : v.r < -0.1 ? "rneg" : ""}'>${v.r.toFixed(3)}${v.stars}</td></tr>\n`;
  }
  html += `</table>\n`;
  html += `<p><b>Note:</b> * p&lt;0.05, ** p&lt;0.01, *** p&lt;0.001</p>\n`;
  html += `<h3>Details</h3>\n<table><tr><th>Dimension</th><th>Framework</th><th>r</th><th>n</th><th>p-value</th><th>95% CI</th></tr>\n`;
  for (const dim of dims) {
    for (const fw of ["fsm", "vlm"]) {
      const c = correlations[fw][dim];
      html += `<tr><td>${dimNames[dim]}</td><td>${fw.toUpperCase()}</td><td>${c.r.toFixed(3)}${c.stars}</td><td>${c.n}</td><td>${c.p.toExponential(2)}</td><td>[${c.ci[0].toFixed(2)}, ${c.ci[1].toFixed(2)}]</td></tr>\n`;
    }
  }
  html += `</table>\n`;
  html += `</body></html>`;
  return html;
}

// ========== RUN =============
function main() {
  console.log("Loading data...");
  const human = loadHumanEvaluation();
  const fsm = loadFSMEvaluation();
  const vlm = loadVLMEvaluation();
  const uuids = alignDatasets(human, fsm, vlm);
  console.log(`Aligned samples: ${uuids.length}`);
  if (uuids.length < 10) {
    console.error("Too few aligned samples for reliable correlation.");
    process.exit(1);
  }
  const correlations = calculateCorrelations(human, fsm, vlm, uuids);
  fs.writeFileSync(
    OUTPUT_JSON,
    JSON.stringify({ correlations, uuids }, null, 2),
  );
  fs.writeFileSync(OUTPUT_HTML, generateHTMLReport(correlations));
  console.log("Report generated:", OUTPUT_HTML);
}

main();
