import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Copy all Qwen-generated files from aied to 0126-balanced
 * Including: HTML, FSM, tests, and data JSON files
 */
async function copyQwenToBalanced() {
  const sourceWorkspace = path.join(__dirname, "workspace", "aied");
  const targetWorkspace = path.join(__dirname, "workspace", "0126-balanced");

  // Read Qwen statistics to get file IDs
  const statsPath = path.join(
    sourceWorkspace,
    "html-qwen",
    "_qwen_statistics.json",
  );
  const stats = JSON.parse(fs.readFileSync(statsPath, "utf-8"));
  const qwenFiles = stats.files;

  console.log("\n=== Copy Qwen Files to 0126-balanced ===\n");
  console.log(`Source: ${sourceWorkspace}`);
  console.log(`Target: ${targetWorkspace}`);
  console.log(`Total Qwen files to copy: ${qwenFiles.length}\n`);

  // Ensure target directories exist
  const directories = ["html", "fsm", "tests", "data"];
  for (const dir of directories) {
    const targetDir = path.join(targetWorkspace, dir);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
      console.log(`✓ Created directory: ${dir}/`);
    }
  }
  console.log("");

  const results = {
    html: { copied: 0, missing: 0, files: [] },
    fsm: { copied: 0, missing: 0, files: [] },
    tests: { copied: 0, missing: 0, files: [] },
    data: { copied: 0, missing: 0, files: [] },
  };

  // Copy each file type
  for (const file of qwenFiles) {
    const fileId = file.id;

    // 1. Copy HTML file
    const htmlFileName = `${fileId}.html`;
    const htmlSource = path.join(sourceWorkspace, "html", htmlFileName);
    const htmlTarget = path.join(targetWorkspace, "html", htmlFileName);

    if (fs.existsSync(htmlSource)) {
      fs.copyFileSync(htmlSource, htmlTarget);
      results.html.copied++;
      results.html.files.push(htmlFileName);
    } else {
      results.html.missing++;
      console.log(`✗ Missing HTML: ${htmlFileName}`);
    }

    // 2. Copy FSM file
    const fsmFileName = `${fileId}.json`;
    const fsmSource = path.join(sourceWorkspace, "fsm", fsmFileName);
    const fsmTarget = path.join(targetWorkspace, "fsm", fsmFileName);

    if (fs.existsSync(fsmSource)) {
      fs.copyFileSync(fsmSource, fsmTarget);
      results.fsm.copied++;
      results.fsm.files.push(fsmFileName);
    } else {
      results.fsm.missing++;
      console.log(`✗ Missing FSM: ${fsmFileName}`);
    }

    // 3. Copy test file
    const testFileName = `${fileId}.spec.js`;
    const testSource = path.join(sourceWorkspace, "tests", testFileName);
    const testTarget = path.join(targetWorkspace, "tests", testFileName);

    if (fs.existsSync(testSource)) {
      fs.copyFileSync(testSource, testTarget);
      results.tests.copied++;
      results.tests.files.push(testFileName);
    } else {
      results.tests.missing++;
      console.log(`✗ Missing test: ${testFileName}`);
    }

    // 4. Copy data JSON file
    const dataFileName = `${fileId}.json`;
    const dataSource = path.join(sourceWorkspace, "data", dataFileName);
    const dataTarget = path.join(targetWorkspace, "data", dataFileName);

    if (fs.existsSync(dataSource)) {
      fs.copyFileSync(dataSource, dataTarget);
      results.data.copied++;
      results.data.files.push(dataFileName);
    } else {
      results.data.missing++;
      console.log(`✗ Missing data: ${dataFileName}`);
    }
  }

  // Print summary
  console.log("\n=== Copy Results ===\n");

  console.log("HTML Files:");
  console.log(`  ✓ Copied: ${results.html.copied}`);
  console.log(`  ✗ Missing: ${results.html.missing}`);

  console.log("\nFSM Files:");
  console.log(`  ✓ Copied: ${results.fsm.copied}`);
  console.log(`  ✗ Missing: ${results.fsm.missing}`);

  console.log("\nTest Files:");
  console.log(`  ✓ Copied: ${results.tests.copied}`);
  console.log(`  ✗ Missing: ${results.tests.missing}`);

  console.log("\nData JSON Files:");
  console.log(`  ✓ Copied: ${results.data.copied}`);
  console.log(`  ✗ Missing: ${results.data.missing}`);

  const totalCopied =
    results.html.copied +
    results.fsm.copied +
    results.tests.copied +
    results.data.copied;
  const totalMissing =
    results.html.missing +
    results.fsm.missing +
    results.tests.missing +
    results.data.missing;

  console.log(`\n=== Total Summary ===`);
  console.log(`✓ Total files copied: ${totalCopied}`);
  console.log(`✗ Total files missing: ${totalMissing}`);
  console.log(
    `\nSuccess rate: ${((totalCopied / (totalCopied + totalMissing)) * 100).toFixed(2)}%`,
  );

  // Save copy report
  const reportPath = path.join(targetWorkspace, "_qwen_copy_report.json");
  const report = {
    timestamp: new Date().toISOString(),
    source: "workspace/aied",
    target: "workspace/0126-balanced",
    totalQwenFiles: qwenFiles.length,
    results: results,
    summary: {
      totalCopied,
      totalMissing,
      successRate: (totalCopied / (totalCopied + totalMissing)) * 100,
    },
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n✓ Copy report saved to: ${reportPath}\n`);

  return results;
}

copyQwenToBalanced().catch(console.error);
