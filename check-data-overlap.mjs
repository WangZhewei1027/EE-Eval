// Quick script to check data overlap
import fs from "fs";

const humanResults = JSON.parse(
  fs.readFileSync("human-evaluation-data/01-28/results.json", "utf-8"),
);
const htmlPages = JSON.parse(
  fs.readFileSync("human-evaluation-data/01-28/html-pages.json", "utf-8"),
);

console.log("Total human-evaluated HTML files:", htmlPages.length);
console.log(
  "Total human evaluations (may have multiple users per HTML):",
  humanResults.length,
);

// Check if these HTML files exist in 0126-balanced
const dataDir = "workspace/0126-balanced/data";
let found = 0;
let notFound = 0;

const models = {};

htmlPages.forEach((htmlFile) => {
  const uuid = htmlFile.replace(".html", "");
  const dataPath = `${dataDir}/${uuid}.json`;

  if (fs.existsSync(dataPath)) {
    found++;
    const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
    const model = data.model || "unknown";
    if (!models[model]) models[model] = [];
    models[model].push(uuid);
  } else {
    notFound++;
    console.log("Not found:", htmlFile);
  }
});

console.log(`\nFound in 0126-balanced: ${found}`);
console.log(`Not found: ${notFound}`);

console.log("\nBreakdown by model:");
Object.keys(models)
  .sort()
  .forEach((model) => {
    console.log(`  ${model}: ${models[model].length} files`);
  });
