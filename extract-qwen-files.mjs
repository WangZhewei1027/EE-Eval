import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Extract all Qwen-generated HTML files from workspace/aied/html
 * and copy them to workspace/aied/html-qwen
 */
async function extractQwenFiles(workspaceName = "aied") {
  const workspaceDir = path.join(__dirname, "workspace", workspaceName);
  const dataDir = path.join(workspaceDir, "data");
  const htmlDir = path.join(workspaceDir, "html");
  const outputDir = path.join(workspaceDir, "html-qwen");

  console.log("\n=== Qwen File Extraction Tool ===\n");
  console.log(`Workspace: ${workspaceName}`);
  console.log(`Data directory: ${dataDir}`);
  console.log(`HTML directory: ${htmlDir}`);
  console.log(`Output directory: ${outputDir}\n`);

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`✓ Created output directory: ${outputDir}\n`);
  }

  // Read all JSON files from data directory
  const dataFiles = fs
    .readdirSync(dataDir)
    .filter((file) => file.endsWith(".json"));
  console.log(`Found ${dataFiles.length} JSON data files\n`);

  const qwenFiles = [];
  const statistics = {
    totalFiles: dataFiles.length,
    qwenFiles: 0,
    qwenModels: {},
    questions: {},
    statusCounts: {},
    hasFSM: 0,
    hasTest: 0,
  };

  // Process each data file
  for (const dataFile of dataFiles) {
    const dataPath = path.join(dataDir, dataFile);
    const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

    // Check if model contains 'qwen' (case-insensitive)
    if (data.model && data.model.toLowerCase().includes("qwen")) {
      qwenFiles.push({
        id: data.id,
        model: data.model,
        question: data.question,
        topic: data.topic,
        status: data.status,
        hasFSM: data.hasFSM,
        hasTest: data.hasTest,
      });

      statistics.qwenFiles++;

      // Track model variations
      if (!statistics.qwenModels[data.model]) {
        statistics.qwenModels[data.model] = 0;
      }
      statistics.qwenModels[data.model]++;

      // Track questions/topics
      const topic = data.topic || data.question;
      if (!statistics.questions[topic]) {
        statistics.questions[topic] = 0;
      }
      statistics.questions[topic]++;

      // Track status
      const status = data.status || "unknown";
      if (!statistics.statusCounts[status]) {
        statistics.statusCounts[status] = 0;
      }
      statistics.statusCounts[status]++;

      // Track FSM and test
      if (data.hasFSM) statistics.hasFSM++;
      if (data.hasTest) statistics.hasTest++;

      // Copy HTML file
      const htmlFileName = `${data.id}.html`;
      const sourcePath = path.join(htmlDir, htmlFileName);
      const destPath = path.join(outputDir, htmlFileName);

      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, destPath);
        console.log(`✓ Copied: ${htmlFileName} (${data.model})`);
      } else {
        console.log(`✗ Missing HTML: ${htmlFileName}`);
      }
    }
  }

  console.log(`\n=== Statistics ===\n`);
  console.log(`Total data files: ${statistics.totalFiles}`);
  console.log(
    `Qwen-generated files: ${statistics.qwenFiles} (${((statistics.qwenFiles / statistics.totalFiles) * 100).toFixed(2)}%)`,
  );
  console.log(`\n--- Qwen Model Breakdown ---`);
  for (const [model, count] of Object.entries(statistics.qwenModels)) {
    console.log(`  ${model}: ${count} files`);
  }

  console.log(`\n--- Topics/Questions (Top 10) ---`);
  const sortedTopics = Object.entries(statistics.questions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  for (const [topic, count] of sortedTopics) {
    console.log(`  ${topic}: ${count} files`);
  }

  console.log(`\n--- Status Distribution ---`);
  for (const [status, count] of Object.entries(statistics.statusCounts)) {
    console.log(
      `  ${status}: ${count} files (${((count / statistics.qwenFiles) * 100).toFixed(2)}%)`,
    );
  }

  console.log(`\n--- Feature Flags ---`);
  console.log(
    `  Has FSM: ${statistics.hasFSM} (${((statistics.hasFSM / statistics.qwenFiles) * 100).toFixed(2)}%)`,
  );
  console.log(
    `  Has Test: ${statistics.hasTest} (${((statistics.hasTest / statistics.qwenFiles) * 100).toFixed(2)}%)`,
  );

  // Save detailed statistics to JSON
  const statsPath = path.join(outputDir, "_qwen_statistics.json");
  const detailedStats = {
    summary: statistics,
    files: qwenFiles,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(statsPath, JSON.stringify(detailedStats, null, 2));
  console.log(`\n✓ Detailed statistics saved to: ${statsPath}`);

  console.log(`\n=== Extraction Complete ===`);
  console.log(`${statistics.qwenFiles} HTML files copied to: ${outputDir}\n`);

  return statistics;
}

// Parse command line arguments
const args = process.argv.slice(2);
const workspaceName = args[0] || "aied";

extractQwenFiles(workspaceName).catch(console.error);
