/**
 * FSM Graph Similarity Comparison Library
 *
 * This library provides functionality to compare two FSM JSON files
 * and compute similarity scores using multiple algorithms:
 * - Structural similarity (graph topology)
 * - Node similarity (state comparison)
 * - Edge similarity (transition comparison)
 * - Semantic similarity (content-based with embeddings)
 */

import { getAverageEmbedding, cosineSimilarity } from "./ai-api.mjs";

/**
 * Normalize FSM JSON to a consistent graph representation
 * @param {Object} fsmData - FSM JSON data
 * @returns {Object} Normalized graph representation
 */
function normalizeFSM(fsmData) {
  const normalized = {
    nodes: [],
    edges: [],
    metadata: {},
  };

  // Extract metadata
  normalized.metadata = {
    concept: fsmData.meta?.concept || fsmData.concept || "",
    topic: fsmData.meta?.topic || fsmData.topic || "",
    educational_goal: fsmData.meta?.educational_goal || "",
    expected_interactions: fsmData.meta?.expected_interactions || [],
  };

  // Normalize states to nodes
  let states = [];
  if (fsmData.states && Array.isArray(fsmData.states)) {
    // New format: array of states
    states = fsmData.states;
  } else if (fsmData.states && typeof fsmData.states === "object") {
    // Old format: object with state keys
    states = Object.entries(fsmData.states).map(([key, state]) => ({
      id: key,
      label: state.meta?.label || key,
      type: state.type || "atomic",
      entry_actions: state.onEnter || state.entry_actions || [],
      exit_actions: state.onExit || state.exit_actions || [],
      ...state,
    }));
  }

  // Process nodes
  normalized.nodes = states.map((state) => ({
    id: state.id || state.name || state.label,
    label: state.label || state.name || state.id,
    type: state.type || "atomic",
    entry_actions: state.entry_actions || state.onEnter || [],
    exit_actions: state.exit_actions || state.onExit || [],
    attributes: {
      semantic_category: categorizeState(state.label || state.id),
      action_count:
        (state.entry_actions || []).length + (state.exit_actions || []).length,
      has_guards: false, // Will be updated when processing transitions
      complexity_score: calculateStateComplexity(state),
    },
  }));

  // Normalize transitions to edges
  let transitions = [];
  if (fsmData.transitions && Array.isArray(fsmData.transitions)) {
    // New format: array of transitions
    transitions = fsmData.transitions;
  } else if (fsmData.states) {
    // Extract transitions from state definitions
    const stateEntries = Array.isArray(fsmData.states)
      ? fsmData.states.map((s) => [s.id, s])
      : Object.entries(fsmData.states);

    stateEntries.forEach(([stateKey, state]) => {
      if (state.on || state.transitions) {
        const stateTransitions = state.on || state.transitions || {};
        Object.entries(stateTransitions).forEach(([event, target]) => {
          if (typeof target === "string") {
            transitions.push({
              from: stateKey,
              to: target,
              event: event,
              guard: "",
              actions: [],
              timeout: 0,
            });
          } else if (typeof target === "object") {
            transitions.push({
              from: stateKey,
              to: target.target || target.to,
              event: event,
              guard: target.cond || target.guard || "",
              actions: target.actions || [],
              timeout: target.timeout || 0,
            });
          }
        });
      }
    });
  }

  // Process edges
  normalized.edges = transitions.map((transition) => ({
    from: transition.from,
    to: transition.to,
    event: transition.event || "",
    guard: transition.guard || "",
    actions: transition.actions || [],
    expected_observables: transition.expected_observables || [],
    timeout: transition.timeout || 0,
    attributes: {
      event_type: classifyEvent(transition.event),
      has_guard: !!transition.guard,
      action_count: (transition.actions || []).length,
      complexity_score: calculateTransitionComplexity(transition),
    },
  }));

  // Update node attributes based on transitions
  normalized.nodes.forEach((node) => {
    const incomingTransitions = normalized.edges.filter(
      (edge) => edge.to === node.id,
    );
    const outgoingTransitions = normalized.edges.filter(
      (edge) => edge.from === node.id,
    );

    node.attributes.has_guards = outgoingTransitions.some(
      (edge) => edge.attributes.has_guard,
    );
    node.attributes.in_degree = incomingTransitions.length;
    node.attributes.out_degree = outgoingTransitions.length;
    node.attributes.centrality_score =
      (node.attributes.in_degree + node.attributes.out_degree) /
      Math.max(1, normalized.edges.length);
  });

  return normalized;
}

/**
 * Categorize state by semantic meaning
 */
function categorizeState(stateName) {
  const name = stateName.toLowerCase();
  if (
    name.includes("idle") ||
    name.includes("initial") ||
    name.includes("start")
  )
    return "initial";
  if (name.includes("error") || name.includes("alert") || name.includes("fail"))
    return "error";
  if (name.includes("validating") || name.includes("input"))
    return "validation";
  if (
    name.includes("inserting") ||
    name.includes("adding") ||
    name.includes("removing")
  )
    return "action";
  if (
    name.includes("drawing") ||
    name.includes("updating") ||
    name.includes("display")
  )
    return "display";
  if (
    name.includes("resetting") ||
    name.includes("done") ||
    name.includes("complete")
  )
    return "final";
  return "atomic";
}

/**
 * Classify event type
 */
function classifyEvent(eventName) {
  if (!eventName) return "unknown";
  const name = eventName.toLowerCase();
  if (name.includes("click") || name.includes("user")) return "user_action";
  if (
    name.includes("complete") ||
    name.includes("success") ||
    name.includes("fail")
  )
    return "system_event";
  if (name.includes("timeout") || name.includes("timer")) return "timer_event";
  return "unknown";
}

/**
 * Calculate state complexity score
 */
function calculateStateComplexity(state) {
  let score = 1; // Base complexity
  score += (state.entry_actions || []).length * 0.5;
  score += (state.exit_actions || []).length * 0.5;
  return Math.min(score, 10); // Cap at 10
}

/**
 * Calculate transition complexity score
 */
function calculateTransitionComplexity(transition) {
  let score = 1; // Base complexity
  if (transition.guard) score += 1;
  score += (transition.actions || []).length * 0.5;
  score += (transition.expected_observables || []).length * 0.3;
  return Math.min(score, 10); // Cap at 10
}

/**
 * Compute structural similarity between two normalized FSMs
 */
function computeStructuralSimilarity(fsm1, fsm2) {
  // Node count similarity
  const nodeCountSim =
    1 -
    Math.abs(fsm1.nodes.length - fsm2.nodes.length) /
      Math.max(fsm1.nodes.length, fsm2.nodes.length, 1);

  // Edge count similarity
  const edgeCountSim =
    1 -
    Math.abs(fsm1.edges.length - fsm2.edges.length) /
      Math.max(fsm1.edges.length, fsm2.edges.length, 1);

  // Degree distribution similarity
  const degreeDistSim = computeDegreeDistributionSimilarity(fsm1, fsm2);

  // Graph density similarity
  const density1 =
    fsm1.edges.length /
    Math.max(1, fsm1.nodes.length * (fsm1.nodes.length - 1));
  const density2 =
    fsm2.edges.length /
    Math.max(1, fsm2.nodes.length * (fsm2.nodes.length - 1));
  const densitySim = 1 - Math.abs(density1 - density2);

  return {
    node_count_similarity: nodeCountSim,
    edge_count_similarity: edgeCountSim,
    degree_distribution_similarity: degreeDistSim,
    density_similarity: densitySim,
    overall: (nodeCountSim + edgeCountSim + degreeDistSim + densitySim) / 4,
  };
}

/**
 * Compute degree distribution similarity
 */
function computeDegreeDistributionSimilarity(fsm1, fsm2) {
  const getDegreeDistribution = (fsm) => {
    const distribution = {};
    fsm.nodes.forEach((node) => {
      const degree = node.attributes.in_degree + node.attributes.out_degree;
      distribution[degree] = (distribution[degree] || 0) + 1;
    });
    return distribution;
  };

  const dist1 = getDegreeDistribution(fsm1);
  const dist2 = getDegreeDistribution(fsm2);

  const allDegrees = new Set([...Object.keys(dist1), ...Object.keys(dist2)]);
  let similarity = 0;
  let totalNodes = Math.max(fsm1.nodes.length, fsm2.nodes.length, 1);

  allDegrees.forEach((degree) => {
    const count1 = dist1[degree] || 0;
    const count2 = dist2[degree] || 0;
    similarity += 1 - Math.abs(count1 - count2) / totalNodes;
  });

  return similarity / allDegrees.size;
}

/**
 * Compute semantic similarity between two normalized FSMs using embeddings
 */
async function computeSemanticSimilarity(fsm1, fsm2) {
  // === 1. State Semantic Similarity using Embeddings ===
  const state1Labels = fsm1.nodes.map((n) => n.label);
  const state2Labels = fsm2.nodes.map((n) => n.label);
  const stateEmb1 = await getAverageEmbedding(state1Labels);
  const stateEmb2 = await getAverageEmbedding(state2Labels);
  const stateEmbSim =
    stateEmb1 && stateEmb2
      ? cosineSimilarity(stateEmb1, stateEmb2)
      : computeStateCategorySimilarity(fsm1, fsm2); // Fallback

  // === 2. Action Semantic Similarity using Embeddings ===
  const actions1 = getAllActionsText(fsm1);
  const actions2 = getAllActionsText(fsm2);
  const actionEmb1 = await getAverageEmbedding(actions1);
  const actionEmb2 = await getAverageEmbedding(actions2);
  const actionEmbSim =
    actionEmb1 && actionEmb2
      ? cosineSimilarity(actionEmb1, actionEmb2)
      : computeActionSimilarity(fsm1, fsm2); // Fallback

  // === 3. Event Semantic Similarity using Embeddings ===
  const events1 = fsm1.edges.map((e) => e.event).filter((e) => e);
  const events2 = fsm2.edges.map((e) => e.event).filter((e) => e);
  const eventEmb1 = await getAverageEmbedding(events1);
  const eventEmb2 = await getAverageEmbedding(events2);
  const eventEmbSim =
    eventEmb1 && eventEmb2
      ? cosineSimilarity(eventEmb1, eventEmb2)
      : computeEventTypeSimilarity(fsm1, fsm2); // Fallback

  // === 4. Metadata Semantic Similarity using Embeddings ===
  const meta1Text = [
    fsm1.metadata.concept,
    fsm1.metadata.topic,
    fsm1.metadata.educational_goal,
  ]
    .filter((t) => t)
    .join(" ");
  const meta2Text = [
    fsm2.metadata.concept,
    fsm2.metadata.topic,
    fsm2.metadata.educational_goal,
  ]
    .filter((t) => t)
    .join(" ");

  let metaEmbSim;
  if (meta1Text && meta2Text) {
    const metaEmb1 = await getAverageEmbedding([meta1Text]);
    const metaEmb2 = await getAverageEmbedding([meta2Text]);
    metaEmbSim =
      metaEmb1 && metaEmb2
        ? cosineSimilarity(metaEmb1, metaEmb2)
        : computeMetadataSimilarity(fsm1.metadata, fsm2.metadata);
  } else {
    metaEmbSim = computeMetadataSimilarity(fsm1.metadata, fsm2.metadata);
  }

  // === 5. Category Distribution (Auxiliary Feature) ===
  const catDistSim = computeStateCategorySimilarity(fsm1, fsm2);

  return {
    state_embedding_similarity: stateEmbSim,
    action_embedding_similarity: actionEmbSim,
    event_embedding_similarity: eventEmbSim,
    metadata_embedding_similarity: metaEmbSim,
    category_distribution_similarity: catDistSim, // Auxiliary feature
    overall: (stateEmbSim + actionEmbSim + eventEmbSim + metaEmbSim) / 4,
  };
}

/**
 * Helper: Extract all action texts from FSM
 */
function getAllActionsText(fsm) {
  const actions = [];
  fsm.nodes.forEach((node) => {
    actions.push(...(node.entry_actions || []));
    actions.push(...(node.exit_actions || []));
  });
  fsm.edges.forEach((edge) => {
    actions.push(...(edge.actions || []));
  });
  return actions.filter((a) => a && a.trim());
}

/**
 * Compute state category similarity
 */
function computeStateCategorySimilarity(fsm1, fsm2) {
  const getCategories = (fsm) => {
    const categories = {};
    fsm.nodes.forEach((node) => {
      const cat = node.attributes.semantic_category;
      categories[cat] = (categories[cat] || 0) + 1;
    });
    return categories;
  };

  const cat1 = getCategories(fsm1);
  const cat2 = getCategories(fsm2);

  const allCategories = new Set([...Object.keys(cat1), ...Object.keys(cat2)]);
  let similarity = 0;

  allCategories.forEach((category) => {
    const count1 = cat1[category] || 0;
    const count2 = cat2[category] || 0;
    const maxCount = Math.max(count1, count2, 1);
    similarity += Math.min(count1, count2) / maxCount;
  });

  return similarity / allCategories.size;
}

/**
 * Compute event type similarity
 */
function computeEventTypeSimilarity(fsm1, fsm2) {
  const getEventTypes = (fsm) => {
    const types = {};
    fsm.edges.forEach((edge) => {
      const type = edge.attributes.event_type;
      types[type] = (types[type] || 0) + 1;
    });
    return types;
  };

  const types1 = getEventTypes(fsm1);
  const types2 = getEventTypes(fsm2);

  const allTypes = new Set([...Object.keys(types1), ...Object.keys(types2)]);
  if (allTypes.size === 0) return 1;

  let similarity = 0;
  allTypes.forEach((type) => {
    const count1 = types1[type] || 0;
    const count2 = types2[type] || 0;
    const maxCount = Math.max(count1, count2, 1);
    similarity += Math.min(count1, count2) / maxCount;
  });

  return similarity / allTypes.size;
}

/**
 * Compute action similarity using Jaccard similarity
 */
function computeActionSimilarity(fsm1, fsm2) {
  const getAllActions = (fsm) => {
    const actions = new Set();
    fsm.nodes.forEach((node) => {
      [...(node.entry_actions || []), ...(node.exit_actions || [])].forEach(
        (action) => {
          actions.add(action.toLowerCase().trim());
        },
      );
    });
    fsm.edges.forEach((edge) => {
      (edge.actions || []).forEach((action) => {
        actions.add(action.toLowerCase().trim());
      });
    });
    return actions;
  };

  const actions1 = getAllActions(fsm1);
  const actions2 = getAllActions(fsm2);

  const intersection = new Set([...actions1].filter((x) => actions2.has(x)));
  const union = new Set([...actions1, ...actions2]);

  return union.size === 0 ? 1 : intersection.size / union.size;
}

/**
 * Compute metadata similarity
 */
function computeMetadataSimilarity(meta1, meta2) {
  const conceptSim = stringSimilarity(meta1.concept || "", meta2.concept || "");
  const topicSim = stringSimilarity(meta1.topic || "", meta2.topic || "");
  const goalSim = stringSimilarity(
    meta1.educational_goal || "",
    meta2.educational_goal || "",
  );

  const interactions1 = new Set(meta1.expected_interactions || []);
  const interactions2 = new Set(meta2.expected_interactions || []);
  const intersectionSize = new Set(
    [...interactions1].filter((x) => interactions2.has(x)),
  ).size;
  const unionSize = new Set([...interactions1, ...interactions2]).size;
  const interactionSim = unionSize === 0 ? 1 : intersectionSize / unionSize;

  return (conceptSim + topicSim + goalSim + interactionSim) / 4;
}

/**
 * Simple string similarity using edit distance
 */
function stringSimilarity(str1, str2) {
  if (str1 === str2) return 1;
  if (!str1 || !str2) return 0;

  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;

  return 1 - editDistance(str1.toLowerCase(), str2.toLowerCase()) / maxLen;
}

/**
 * Calculate edit distance between two strings
 */
function editDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2[i - 1] === str1[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Compute graph isomorphism similarity (relaxed version)
 * Uses edit distance on canonical forms instead of exact matching
 */
function computeIsomorphismSimilarity(fsm1, fsm2) {
  const canonical1 = computeCanonicalForm(fsm1);
  const canonical2 = computeCanonicalForm(fsm2);

  // Use edit distance for gradual similarity instead of binary 0/1
  const maxLen = Math.max(canonical1.length, canonical2.length);
  if (maxLen === 0) return 1.0;

  const distance = editDistance(canonical1, canonical2);
  const similarity = Math.max(0, 1 - distance / maxLen);

  // Apply slight boost to reflect structural alignment
  // Even partial structure match is valuable
  return Math.min(1.0, similarity * 1.1);
}

/**
 * Normalize similarity score to align with human evaluation scale
 * FSM similarity scores are naturally lower (30-50% is good)
 * This function maps raw scores to a higher range for better human alignment
 *
 * Mapping strategy:
 * - 0.30 (30% similarity) → 0.70 (good score)
 * - 0.50 (50% similarity) → 0.90 (excellent score)
 * - 0.70 (70% similarity) → 0.98 (near perfect)
 *
 * Uses power transformation: score^0.5 * 1.3 to boost lower scores
 */
function normalizeSimilarityScore(rawScore) {
  if (rawScore <= 0) return 0;
  if (rawScore >= 1) return 1;

  // Power transformation to boost scores
  // sqrt(x) makes low scores higher: 0.3→0.548, 0.5→0.707
  const boosted = Math.pow(rawScore, 0.5);

  // Apply multiplier and cap at 1.0
  const normalized = Math.min(1.0, boosted * 1.3);

  return normalized;
}

/**
 * Compute canonical form of the graph (simplified)
 */
function computeCanonicalForm(fsm) {
  // Sort nodes by degree and label
  const sortedNodes = [...fsm.nodes].sort((a, b) => {
    const degreeA = a.attributes.in_degree + a.attributes.out_degree;
    const degreeB = b.attributes.in_degree + b.attributes.out_degree;
    if (degreeA !== degreeB) return degreeB - degreeA;
    return a.label.localeCompare(b.label);
  });

  // Create signature based on sorted structure
  const nodeSignature = sortedNodes
    .map(
      (node) =>
        `${node.attributes.semantic_category}:${node.attributes.in_degree}-${node.attributes.out_degree}`,
    )
    .join(",");

  const edgeSignature = fsm.edges
    .map((edge) => `${edge.attributes.event_type}:${edge.attributes.has_guard}`)
    .sort()
    .join(",");

  return `${nodeSignature}|${edgeSignature}`;
}

/**
 * Main function to compare two FSMs
 * @param {Object} fsm1 - First FSM JSON
 * @param {Object} fsm2 - Second FSM JSON
 * @returns {Promise<Object>} Similarity analysis results
 */
export async function compareFSMs(fsm1, fsm2) {
  try {
    console.log("Normalizing FSMs...");
    const normalized1 = normalizeFSM(fsm1);
    const normalized2 = normalizeFSM(fsm2);

    console.log("Computing structural similarity...");
    const structuralSim = computeStructuralSimilarity(normalized1, normalized2);

    console.log("Computing semantic similarity with embeddings...");
    const semanticSim = await computeSemanticSimilarity(
      normalized1,
      normalized2,
    );

    console.log("Computing isomorphism similarity...");
    const isomorphismSim = computeIsomorphismSimilarity(
      normalized1,
      normalized2,
    );

    // Combined similarity with weighted average.
    const rawCombinedSimilarity =
      structuralSim.overall * 0.4 +
      semanticSim.overall * 0.4 +
      isomorphismSim * 0.2;

    // Normalize scores to align with human evaluation scale
    const normalizedCombined = normalizeSimilarityScore(rawCombinedSimilarity);
    const normalizedStructural = normalizeSimilarityScore(
      structuralSim.overall,
    );
    const normalizedSemantic = normalizeSimilarityScore(semanticSim.overall);
    const normalizedIsomorphism = normalizeSimilarityScore(isomorphismSim);

    const result = {
      structural_similarity: structuralSim,
      semantic_similarity: semanticSim,
      isomorphism_similarity: isomorphismSim,
      combined_similarity: {
        score: normalizedCombined,
        raw_score: rawCombinedSimilarity,
        percentage: Math.round(normalizedCombined * 100),
      },
      dimension1_interaction_capacity: {
        score: normalizedStructural,
        raw_score: structuralSim.overall,
        percentage: Math.round(normalizedStructural * 100),
      },
      dimension2_behavioral_coherence: {
        score: normalizedSemantic,
        raw_score: semanticSim.overall,
        percentage: Math.round(normalizedSemantic * 100),
      },
      dimension3_interaction_meaningfulness: {
        score: normalizedIsomorphism,
        raw_score: isomorphismSim,
        percentage: Math.round(normalizedIsomorphism * 100),
      },
      summary: {
        score: Math.round(normalizedCombined * 100),
        raw_score: Math.round(rawCombinedSimilarity * 100),
        interpretation: interpretSimilarity(normalizedCombined),
        key_differences: identifyKeyDifferences(normalized1, normalized2),
        recommendations: generateRecommendations(
          normalized1,
          normalized2,
          structuralSim,
          semanticSim,
        ),
      },
      details: {
        fsm1_stats: {
          nodes: normalized1.nodes.length,
          edges: normalized1.edges.length,
          concept: normalized1.metadata.concept,
          categories: getCategoryDistribution(normalized1),
        },
        fsm2_stats: {
          nodes: normalized2.nodes.length,
          edges: normalized2.edges.length,
          concept: normalized2.metadata.concept,
          categories: getCategoryDistribution(normalized2),
        },
        raw_fsm1: normalized1,
        raw_fsm2: normalized2,
      },
    };

    console.log("FSM comparison completed successfully");
    return result;
  } catch (error) {
    console.error("Error comparing FSMs:", error);
    throw new Error(`FSM comparison failed: ${error.message}`);
  }
}

/**
 * Interpret similarity score
 */
function interpretSimilarity(score) {
  if (score >= 0.9) return "Very High - FSMs are nearly identical";
  if (score >= 0.7) return "High - FSMs are quite similar";
  if (score >= 0.5) return "Medium - FSMs have some similarities";
  if (score >= 0.3) return "Low - FSMs have few similarities";
  return "Very Low - FSMs are quite different";
}

/**
 * Identify key differences between FSMs
 */
function identifyKeyDifferences(fsm1, fsm2) {
  const differences = [];

  if (Math.abs(fsm1.nodes.length - fsm2.nodes.length) > 2) {
    differences.push(
      `State count differs significantly: ${fsm1.nodes.length} vs ${fsm2.nodes.length}`,
    );
  }

  if (Math.abs(fsm1.edges.length - fsm2.edges.length) > 2) {
    differences.push(
      `Transition count differs significantly: ${fsm1.edges.length} vs ${fsm2.edges.length}`,
    );
  }

  const cat1 = getCategoryDistribution(fsm1);
  const cat2 = getCategoryDistribution(fsm2);
  const missingCategories = Object.keys(cat1).filter((cat) => !cat2[cat]);
  if (missingCategories.length > 0) {
    differences.push(
      `Missing state categories: ${missingCategories.join(", ")}`,
    );
  }

  return differences;
}

/**
 * Generate recommendations for improving similarity
 */
function generateRecommendations(fsm1, fsm2, structuralSim, semanticSim) {
  const recommendations = [];

  if (structuralSim.overall < 0.5) {
    recommendations.push(
      "Consider adjusting the number of states and transitions to match the ideal structure",
    );
  }

  if (semanticSim.state_category_similarity < 0.5) {
    recommendations.push(
      "Review state categorization - some important state types may be missing",
    );
  }

  if (semanticSim.action_similarity < 0.5) {
    recommendations.push(
      "Actions and behaviors could be more aligned with the ideal FSM",
    );
  }

  if (semanticSim.event_type_similarity < 0.5) {
    recommendations.push(
      "Event types and interactions could better match the expected pattern",
    );
  }

  return recommendations;
}

/**
 * Get category distribution for an FSM
 */
function getCategoryDistribution(fsm) {
  const distribution = {};
  fsm.nodes.forEach((node) => {
    const cat = node.attributes.semantic_category;
    distribution[cat] = (distribution[cat] || 0) + 1;
  });
  return distribution;
}
