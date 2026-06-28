import fs from "fs";
import path from "path";

const PLAYWRIGHT_SCORES = {
  "gpt-3.5-turbo": 0.11,
  "gpt-4o": 0.0258,
  "gpt-4o-mini": 0.1557,
  "gpt-5-mini": 0.0,
  "deepseek-chat": 0.488,
  "Qwen1.5-0.5B-Chat": 0.7603,
  "meta-llama/Llama-3.2-1B-Instruct": 0.2716,
};

const workspace = process.argv[2] || "0126-balanced";
const correlationData = JSON.parse(
  fs.readFileSync(
    `three-frameworks-correlation-data-${workspace}.json`,
    "utf-8",
  ),
);
const humanData = JSON.parse(
  fs.readFileSync("human-evaluation-data/01-28/results.json", "utf-8"),
);

// Build UUID to human score mapping (average across annotators)
const humanScores = {};
for (const r of humanData) {
  const uuid = r.html_id.replace(".html", "");
  if (!humanScores[uuid]) {
    humanScores[uuid] = {
      functional: [],
      visual: [],
      interactivity: [],
      pedagogical: [],
    };
  }
  humanScores[uuid].functional.push(r.scores.functional);
  humanScores[uuid].visual.push(r.scores.visual);
  humanScores[uuid].interactivity.push(r.scores.interactivity);
  humanScores[uuid].pedagogical.push(r.scores.pedagogical);
}

// Average across annotators
for (const uuid in humanScores) {
  const h = humanScores[uuid];
  h.functional = h.functional.reduce((a, b) => a + b, 0) / h.functional.length;
  h.visual = h.visual.reduce((a, b) => a + b, 0) / h.visual.length;
  h.interactivity =
    h.interactivity.reduce((a, b) => a + b, 0) / h.interactivity.length;
  h.pedagogical =
    h.pedagogical.reduce((a, b) => a + b, 0) / h.pedagogical.length;
  h.overall = (h.functional + h.visual + h.interactivity + h.pedagogical) / 4;
}

// Load model information from data files
const DATA_DIR = path.join("workspace", workspace, "data");
const uuidToModel = {};
if (fs.existsSync(DATA_DIR)) {
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    const uuid = file.replace(".json", "");
    try {
      const content = JSON.parse(
        fs.readFileSync(path.join(DATA_DIR, file), "utf-8"),
      );
      if (content.model) {
        uuidToModel[uuid] = content.model;
      }
    } catch (e) {
      // Skip invalid files
    }
  }
}

// Add model info to humanScores
for (const uuid in humanScores) {
  if (uuidToModel[uuid]) {
    humanScores[uuid].model = uuidToModel[uuid];
  }
}

// Analyze model distribution in this workspace
const modelStats = {};
const uuidsInWorkspace = new Set(correlationData.uuids);

for (const uuid of correlationData.uuids) {
  const h = humanScores[uuid];
  if (!h) {
    continue; // Skip if no human evaluation
  }

  if (!h.model) {
    continue; // Skip if no model info
  }

  const model = h.model;
  if (!PLAYWRIGHT_SCORES[model]) {
    continue; // Skip if model not in playwright scores
  }

  if (!modelStats[model]) {
    modelStats[model] = {
      count: 0,
      playwrightScore: PLAYWRIGHT_SCORES[model],
      humanScores: [],
    };
  }
  modelStats[model].count++;
  modelStats[model].humanScores.push(h.overall);
}

// Calculate average human score per model
for (const model in modelStats) {
  const scores = modelStats[model].humanScores;
  modelStats[model].avgHumanScore =
    scores.reduce((a, b) => a + b, 0) / scores.length;
  modelStats[model].minHumanScore = Math.min(...scores);
  modelStats[model].maxHumanScore = Math.max(...scores);
}

console.log(`\n📊 Playwright Correlation Analysis for ${workspace}`);
console.log("=".repeat(80));
console.log("\nModel Distribution (sorted by Playwright score, descending):\n");
console.log(
  "Model".padEnd(35) +
    "Count".padEnd(8) +
    "PW Score".padEnd(12) +
    "Avg Human".padEnd(12) +
    "Range",
);
console.log("-".repeat(80));

const sortedModels = Object.entries(modelStats).sort(
  (a, b) => b[1].playwrightScore - a[1].playwrightScore,
);

for (const [model, stats] of sortedModels) {
  console.log(
    model.padEnd(35) +
      stats.count.toString().padEnd(8) +
      stats.playwrightScore.toFixed(4).padEnd(12) +
      stats.avgHumanScore.toFixed(2).padEnd(12) +
      `[${stats.minHumanScore.toFixed(2)}-${stats.maxHumanScore.toFixed(2)}]`,
  );
}

console.log("\n🔍 Key Observations:\n");

// Check if high PW score models have low human scores
const highPW = sortedModels.slice(0, 3);
const lowPW = sortedModels.slice(-3);

const avgHumanHighPW =
  highPW.reduce((sum, [, stats]) => sum + stats.avgHumanScore, 0) /
  highPW.length;
const avgHumanLowPW =
  lowPW.reduce((sum, [, stats]) => sum + stats.avgHumanScore, 0) / lowPW.length;

console.log(
  `1. Models with HIGH Playwright scores (top 3): avg human = ${avgHumanHighPW.toFixed(2)}`,
);
console.log(`   Models: ${highPW.map(([m]) => m).join(", ")}`);

console.log(
  `\n2. Models with LOW Playwright scores (bottom 3): avg human = ${avgHumanLowPW.toFixed(2)}`,
);
console.log(`   Models: ${lowPW.map(([m]) => m).join(", ")}`);

console.log(
  `\n3. Correlation direction: ${avgHumanHighPW < avgHumanLowPW ? "NEGATIVE ❌" : "POSITIVE ✓"}`,
);
console.log(
  `   → High PW score = ${avgHumanHighPW < avgHumanLowPW ? "LOWER" : "HIGHER"} human quality`,
);

console.log("\n💡 Explanation:");
if (avgHumanHighPW < avgHumanLowPW) {
  console.log(
    "   The negative correlation occurs because models with HIGH test pass rates",
  );
  console.log(
    "   (like Qwen and Deepseek) actually produce LOWER quality outputs according to",
  );
  console.log("   human evaluation. This suggests:");
  console.log(
    "   • The Playwright tests may be testing the WRONG things (too easy)",
  );
  console.log(
    "   • Weaker models might generate simpler code that passes basic tests",
  );
  console.log(
    "   • Stronger models might generate more complex/ambitious code that fails tests",
  );
} else {
  console.log("   The correlation is positive as expected.");
}

console.log("\n");
