#!/usr/bin/env node
/**
 * Add 10 Llama samples to human evaluation template
 * Preserves existing 50 samples (DO NOT MODIFY THEM!)
 */

import fs from "fs/promises";
import path from "path";

const WORKSPACE_DIR = "workspace/batch-1207";
const TEMPLATE_FILE = path.join(
  WORKSPACE_DIR,
  "human-evaluation-template.json"
);
const FSM_RESULTS_FILE = path.join(
  WORKSPACE_DIR,
  "fsm-similarity-results.json"
);

async function main() {
  console.log("📋 Loading existing template...");
  const templateData = JSON.parse(await fs.readFile(TEMPLATE_FILE, "utf-8"));

  console.log(`✅ Current samples: ${templateData.samples.length}`);

  console.log("\n📊 Loading FSM results...");
  const fsmData = JSON.parse(await fs.readFile(FSM_RESULTS_FILE, "utf-8"));

  // Find all Llama samples
  const llamaSamples = fsmData.results.filter(
    (r) => r.model && (r.model.includes("llama") || r.model.includes("Llama"))
  );

  console.log(`✅ Found ${llamaSamples.length} Llama samples`);

  // Take first 10 Llama samples
  const selectedSamples = llamaSamples.slice(0, 10);

  console.log("\n➕ Adding 10 Llama samples...");

  // Starting ID from current max + 1
  let nextId = Math.max(...templateData.samples.map((s) => s.id)) + 1;

  for (const sample of selectedSamples) {
    const newSample = {
      id: nextId++,
      fileId: sample.fileId || sample.fsmFileName.replace(".json", ""),
      fsmFileName: sample.fsmFileName,
      htmlPath: `html/${
        sample.fileId || sample.fsmFileName.replace(".json", "")
      }.html`,
      concept: sample.concept,
      conceptCategory: getCategoryForConcept(sample.concept),
      model: "Llama-3.2-1B-Instruct", // Use simplified name
      fsm_reference: {
        combined_similarity: sample.similarityResult?.combined_similarity || 0,
        structural_similarity:
          sample.similarityResult?.structural_similarity || 0,
        semantic_similarity: sample.similarityResult?.semantic_similarity || 0,
        score: Math.round(
          (sample.similarityResult?.combined_similarity || 0) * 100
        ),
        interpretation: getInterpretation(
          sample.similarityResult?.combined_similarity || 0
        ),
      },
      human_evaluation: {
        interactivity_score: null,
        pedagogical_score: null,
        visual_quality_score: null,
        overall_quality_score: null,
        notes: "",
        evaluator: "",
        evaluation_date: "",
        time_spent_minutes: null,
      },
    };

    templateData.samples.push(newSample);
    console.log(`  ✓ Added sample ${newSample.id}: ${sample.concept}`);
  }

  // Update metadata
  templateData.metadata.totalSamples = templateData.samples.length;
  templateData.metadata.generatedAt = new Date().toISOString();

  // Save updated template
  await fs.writeFile(
    TEMPLATE_FILE,
    JSON.stringify(templateData, null, 2),
    "utf-8"
  );

  console.log(`\n✅ Successfully added 10 Llama samples!`);
  console.log(`📊 Total samples now: ${templateData.samples.length}`);
  console.log(`📄 Updated: ${TEMPLATE_FILE}`);
}

function getCategoryForConcept(concept) {
  const normalized = concept.toLowerCase();

  // Simple categorization based on keywords
  if (
    normalized.includes("array") ||
    normalized.includes("stack") ||
    normalized.includes("queue") ||
    normalized.includes("linked list") ||
    normalized.includes("hash") ||
    normalized.includes("tree") ||
    normalized.includes("set") ||
    normalized.includes("deque")
  ) {
    return "Data Structures";
  }
  if (normalized.includes("sort")) {
    return "Sorting Algorithms";
  }
  if (normalized.includes("search")) {
    return "Searching Algorithms";
  }
  if (
    normalized.includes("graph") ||
    normalized.includes("bfs") ||
    normalized.includes("dfs") ||
    normalized.includes("dijkstra") ||
    normalized.includes("prim") ||
    normalized.includes("kruskal") ||
    normalized.includes("floyd")
  ) {
    return "Graph Algorithms";
  }
  if (
    normalized.includes("dynamic") ||
    normalized.includes("knapsack") ||
    normalized.includes("recursion") ||
    normalized.includes("divide")
  ) {
    return "Advanced Algorithms";
  }
  if (
    normalized.includes("regression") ||
    normalized.includes("neural") ||
    normalized.includes("machine learning")
  ) {
    return "Machine Learning";
  }

  return "Other";
}

function getInterpretation(score) {
  if (score >= 0.8) return "Very High - FSMs are nearly identical";
  if (score >= 0.6) return "High - FSMs are quite similar";
  if (score >= 0.4) return "Moderate - FSMs share some similarities";
  if (score >= 0.2) return "Low - FSMs have few similarities";
  return "Very Low - FSMs are quite different";
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
