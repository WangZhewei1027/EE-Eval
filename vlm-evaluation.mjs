#!/usr/bin/env node

/**
 * VLM (Vision Language Model) Evaluation Tool
 *
 * Evaluates interactive learning materials using vision-only analysis.
 * Uses OpenAI Vision API to score visual quality and educational value
 * based solely on screenshots (no interaction testing).
 *
 * Usage:
 *   node vlm-evaluation.mjs -c 100 --vlm-model "gpt-4o-mini" -w "0126-balanced"
 *
 * Arguments:
 *   -c <number>           Concurrency limit (default: 10)
 *   --vlm-model <model>   VLM model to use (default: "gpt-4o-mini")
 *   -w <workspace>        Workspace name (default: "0126-balanced")
 *
 * Output:
 *   Saves evaluation results to workspace/<name>/visual-results/
 *   Each file named after the corresponding HTML file (e.g., abc-123.json)
 */

import OpenAI from "openai";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    concurrency: 10,
    vlmModel: "gpt-4o-mini",
    workspace: "0126-balanced",
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-c" && args[i + 1]) {
      config.concurrency = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === "--vlm-model" && args[i + 1]) {
      config.vlmModel = args[i + 1];
      i++;
    } else if (args[i] === "-w" && args[i + 1]) {
      config.workspace = args[i + 1];
      i++;
    }
  }

  return config;
}

const config = parseArgs();

console.log(`
╔════════════════════════════════════════════════════════════════╗
║              🎨 VLM Evaluation Tool                            ║
╠════════════════════════════════════════════════════════════════╣
║  Workspace:    ${config.workspace.padEnd(45)} ║
║  VLM Model:    ${config.vlmModel.padEnd(45)} ║
║  Concurrency:  ${config.concurrency.toString().padEnd(45)} ║
╚════════════════════════════════════════════════════════════════╝
`);

// Initialize OpenAI client
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

// Paths
const workspaceDir = path.join(__dirname, "workspace", config.workspace);
const visualsDir = path.join(workspaceDir, "visuals");
const resultsDir = path.join(workspaceDir, "visual-results");

// Ensure results directory exists
await fs.mkdir(resultsDir, { recursive: true });

/**
 * Get all PNG files from visuals directory
 */
async function getScreenshots() {
  try {
    const files = await fs.readdir(visualsDir);
    return files
      .filter((file) => file.endsWith(".png"))
      .map((file) => ({
        filename: file,
        basename: path.basename(file, ".png"),
        path: path.join(visualsDir, file),
      }));
  } catch (error) {
    console.error(`❌ Cannot read visuals directory: ${visualsDir}`);
    process.exit(1);
  }
}

/**
 * Evaluation prompt for VLM
 */
const EVALUATION_PROMPT = `You are an expert evaluator of educational materials. Analyze this screenshot of an interactive learning application and provide scores based ONLY on what you can see in this single image.

Evaluate TWO independent dimensions:

1. **Visual Quality (0-5)**: Rate the aesthetic and presentation quality
   - Layout and organization
   - Visual appeal and design
   - Use of color and typography
   - Information density and clarity
   - Overall visual polish

2. **Educational Quality (0-5)**: Rate the potential educational value based on visual content
   - Clarity of educational concept being taught
   - Appropriateness of visual representation for learning
   - Presence of instructional elements (labels, legends, instructions)
   - Apparent learning objectives
   - Pedagogical effectiveness of visual design

IMPORTANT: These scores are INDEPENDENT. A visually appealing page may have low educational value, and vice versa.

Return your evaluation in the following JSON format:
{
  "visual_quality": <score 0-5>,
  "educational_quality": <score 0-5>,
  "visual_analysis": "<brief explanation of visual quality score in 2-3 sentences>",
  "educational_analysis": "<brief explanation of educational quality score in 2-3 sentences>"
}`;

/**
 * Evaluate a single screenshot using VLM
 */
async function evaluateScreenshot(screenshot) {
  try {
    // Read image and convert to base64
    const imageBuffer = await fs.readFile(screenshot.path);
    const base64Image = imageBuffer.toString("base64");
    const imageDataUri = `data:image/png;base64,${base64Image}`;

    // Call OpenAI Vision API
    const response = await client.responses.create({
      model: config.vlmModel,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: EVALUATION_PROMPT },
            { type: "input_image", image_url: imageDataUri },
          ],
        },
      ],
    });

    // Extract text from response
    let responseText = "";
    if (Array.isArray(response.output)) {
      for (const out of response.output) {
        if (out.content && Array.isArray(out.content)) {
          for (const c of out.content) {
            if (c.type === "output_text" && c.text) {
              responseText += c.text;
            }
          }
        }
      }
    }

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const evaluation = JSON.parse(jsonMatch[0]);

    // Validate scores
    if (
      typeof evaluation.visual_quality !== "number" ||
      typeof evaluation.educational_quality !== "number"
    ) {
      throw new Error("Invalid score format");
    }

    // Add metadata
    const result = {
      ...evaluation,
      metadata: {
        html_filename: `${screenshot.basename}.html`,
        screenshot_filename: screenshot.filename,
        workspace: config.workspace,
        vlm_model: config.vlmModel,
        evaluated_at: new Date().toISOString(),
      },
    };

    // Save result
    const resultPath = path.join(resultsDir, `${screenshot.basename}.json`);
    await fs.writeFile(resultPath, JSON.stringify(result, null, 2), "utf-8");

    return {
      success: true,
      filename: screenshot.filename,
      visual_quality: evaluation.visual_quality,
      educational_quality: evaluation.educational_quality,
    };
  } catch (error) {
    return {
      success: false,
      filename: screenshot.filename,
      error: error.message,
    };
  }
}

/**
 * Process screenshots with concurrency limit
 */
async function processScreenshots(screenshots, concurrencyLimit) {
  const results = [];
  const queue = [...screenshots];
  const inProgress = new Set();

  let completed = 0;
  let succeeded = 0;
  let failed = 0;

  console.log(
    `\n📊 Processing ${screenshots.length} screenshots with concurrency limit ${concurrencyLimit}\n`,
  );

  while (queue.length > 0 || inProgress.size > 0) {
    // Start new tasks up to concurrency limit
    while (queue.length > 0 && inProgress.size < concurrencyLimit) {
      const screenshot = queue.shift();
      const task = evaluateScreenshot(screenshot).then((result) => {
        inProgress.delete(task);
        completed++;

        if (result.success) {
          succeeded++;
          console.log(
            `✅ [${completed}/${screenshots.length}] ${result.filename} - Visual: ${result.visual_quality}/5, Educational: ${result.educational_quality}/5`,
          );
        } else {
          failed++;
          console.error(
            `❌ [${completed}/${screenshots.length}] ${result.filename} - ${result.error}`,
          );
        }

        results.push(result);
        return result;
      });

      inProgress.add(task);
    }

    // Wait for at least one task to complete
    if (inProgress.size > 0) {
      await Promise.race(inProgress);
    }
  }

  return { results, succeeded, failed, total: screenshots.length };
}

/**
 * Generate summary report
 */
function generateSummary(results) {
  const successful = results.filter((r) => r.success);

  if (successful.length === 0) {
    return {
      total: results.length,
      succeeded: 0,
      failed: results.length,
      average_visual_quality: 0,
      average_educational_quality: 0,
    };
  }

  const avgVisual =
    successful.reduce((sum, r) => sum + r.visual_quality, 0) /
    successful.length;
  const avgEducational =
    successful.reduce((sum, r) => sum + r.educational_quality, 0) /
    successful.length;

  return {
    total: results.length,
    succeeded: successful.length,
    failed: results.filter((r) => !r.success).length,
    average_visual_quality: parseFloat(avgVisual.toFixed(2)),
    average_educational_quality: parseFloat(avgEducational.toFixed(2)),
    visual_quality_distribution: calculateDistribution(
      successful.map((r) => r.visual_quality),
    ),
    educational_quality_distribution: calculateDistribution(
      successful.map((r) => r.educational_quality),
    ),
  };
}

/**
 * Calculate score distribution
 */
function calculateDistribution(scores) {
  const dist = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  scores.forEach((score) => {
    const rounded = Math.round(score);
    if (rounded >= 0 && rounded <= 5) {
      dist[rounded]++;
    }
  });
  return dist;
}

/**
 * Main execution
 */
async function main() {
  const startTime = Date.now();

  // Get all screenshots
  console.log(`📁 Reading screenshots from: ${visualsDir}`);
  const screenshots = await getScreenshots();

  if (screenshots.length === 0) {
    console.log(`⚠️  No screenshots found in ${visualsDir}`);
    process.exit(0);
  }

  console.log(`✅ Found ${screenshots.length} screenshots`);

  // Process screenshots
  const { results, succeeded, failed, total } = await processScreenshots(
    screenshots,
    config.concurrency,
  );

  // Generate summary
  const summary = generateSummary(results);
  summary.workspace = config.workspace;
  summary.vlm_model = config.vlmModel;
  summary.evaluated_at = new Date().toISOString();
  summary.duration_seconds = Math.round((Date.now() - startTime) / 1000);

  // Save summary
  const summaryPath = path.join(resultsDir, "_summary.json");
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf-8");

  // Print final report
  console.log(`\n${"=".repeat(70)}`);
  console.log(`\n📊 VLM Evaluation Complete\n`);
  console.log(`Total screenshots:           ${total}`);
  console.log(`✅ Successfully evaluated:   ${succeeded}`);
  console.log(`❌ Failed:                   ${failed}`);
  console.log(`\n📈 Average Scores:`);
  console.log(
    `   Visual Quality:           ${summary.average_visual_quality}/5`,
  );
  console.log(
    `   Educational Quality:      ${summary.average_educational_quality}/5`,
  );
  console.log(`\n📁 Results saved to: ${resultsDir}`);
  console.log(`⏱️  Duration: ${summary.duration_seconds}s`);
  console.log(`\n${"=".repeat(70)}\n`);

  // Print score distributions
  console.log(`Visual Quality Distribution:`);
  Object.entries(summary.visual_quality_distribution).forEach(
    ([score, count]) => {
      console.log(`  ${score}/5: ${"█".repeat(count)} (${count})`);
    },
  );

  console.log(`\nEducational Quality Distribution:`);
  Object.entries(summary.educational_quality_distribution).forEach(
    ([score, count]) => {
      console.log(`  ${score}/5: ${"█".repeat(count)} (${count})`);
    },
  );

  console.log();
}

// Run
main().catch((error) => {
  console.error("💥 Fatal error:", error);
  process.exit(1);
});
