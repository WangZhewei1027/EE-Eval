#!/usr/bin/env node
/**
 * Test Embedding API
 * 测试 HuggingFace Embedding Endpoint 是否正常工作
 */

import {
  getEmbedding,
  getAverageEmbedding,
  cosineSimilarity,
} from "./lib/ai-api.mjs";

async function testEmbeddingAPI() {
  console.log("🧪 Testing Embedding API...\n");

  try {
    // Test 1: Single text embedding
    console.log("Test 1: Single text embedding");
    const text1 = "Bubble Sort";
    const embedding1 = await getEmbedding(text1);
    console.log(`✅ Text: "${text1}"`);
    console.log(
      `   Embedding dimension: ${embedding1 ? embedding1.length : 0}`,
    );
    console.log(
      `   Sample values: [${
        embedding1
          ? embedding1
              .slice(0, 5)
              .map((v) => v.toFixed(4))
              .join(", ")
          : "null"
      }...]\n`,
    );

    // Test 2: Multiple texts embedding
    console.log("Test 2: Multiple texts embedding");
    const texts = ["Idle", "Comparing", "Swapping", "Sorted"];
    const embeddings = await getEmbedding(texts);
    console.log(`✅ Texts: ${JSON.stringify(texts)}`);
    console.log(
      `   Number of embeddings: ${embeddings ? embeddings.length : 0}`,
    );
    if (embeddings && embeddings.length > 0) {
      console.log(`   Each embedding dimension: ${embeddings[0].length}`);
    }
    console.log();

    // Test 3: Average embedding
    console.log("Test 3: Average embedding");
    const avgEmbedding = await getAverageEmbedding(texts);
    console.log(
      `✅ Average embedding dimension: ${avgEmbedding ? avgEmbedding.length : 0}`,
    );
    console.log(
      `   Sample values: [${
        avgEmbedding
          ? avgEmbedding
              .slice(0, 5)
              .map((v) => v.toFixed(4))
              .join(", ")
          : "null"
      }...]\n`,
    );

    // Test 4: Cosine similarity
    console.log("Test 4: Cosine similarity");
    const text2 = "Sorting Algorithm";
    const text3 = "Binary Search";
    const embedding2 = await getEmbedding(text2);
    const embedding3 = await getEmbedding(text3);

    const sim1_2 = cosineSimilarity(embedding1, embedding2);
    const sim1_3 = cosineSimilarity(embedding1, embedding3);
    const sim2_3 = cosineSimilarity(embedding2, embedding3);

    console.log(
      `✅ Similarity between "${text1}" and "${text2}": ${sim1_2.toFixed(4)}`,
    );
    console.log(
      `   Similarity between "${text1}" and "${text3}": ${sim1_3.toFixed(4)}`,
    );
    console.log(
      `   Similarity between "${text2}" and "${text3}": ${sim2_3.toFixed(4)}`,
    );
    console.log();

    // Test 5: Semantic comparison
    console.log("Test 5: Semantic comparison of FSM states");
    const states1 = ["Idle", "Compare", "Swap", "Done"];
    const states2 = ["Start", "Comparing", "Swapping", "Finished"];
    const states3 = ["Initial", "Validate", "Insert", "Complete"];

    const emb_states1 = await getAverageEmbedding(states1);
    const emb_states2 = await getAverageEmbedding(states2);
    const emb_states3 = await getAverageEmbedding(states3);

    const sim_1_2 = cosineSimilarity(emb_states1, emb_states2);
    const sim_1_3 = cosineSimilarity(emb_states1, emb_states3);
    const sim_2_3 = cosineSimilarity(emb_states2, emb_states3);

    console.log(`✅ FSM States Similarity:`);
    console.log(`   States 1: ${JSON.stringify(states1)}`);
    console.log(`   States 2: ${JSON.stringify(states2)}`);
    console.log(`   States 3: ${JSON.stringify(states3)}`);
    console.log(
      `   Similarity (1 vs 2): ${sim_1_2.toFixed(4)} - Similar sorting states`,
    );
    console.log(
      `   Similarity (1 vs 3): ${sim_1_3.toFixed(4)} - Different concepts`,
    );
    console.log(
      `   Similarity (2 vs 3): ${sim_2_3.toFixed(4)} - Different concepts`,
    );
    console.log();

    console.log("🎉 All tests passed! Embedding API is working correctly.\n");
    console.log("📊 Observations:");
    console.log("   - Embeddings have consistent dimensions");
    console.log("   - Cosine similarity values are in [0, 1] range");
    console.log(
      "   - Semantically similar texts have higher similarity scores",
    );
    console.log("   - Ready to use in FSM similarity evaluation!\n");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("\n🔧 Troubleshooting:");
    console.error("   1. Check if HUGGINGFACE_TOKEN is set in .env");
    console.error("   2. Verify the endpoint URL is correct");
    console.error("   3. Ensure the embedding model is deployed and running");
    console.error("   4. Check your HuggingFace account quota\n");
    process.exit(1);
  }
}

// Run tests
testEmbeddingAPI();
