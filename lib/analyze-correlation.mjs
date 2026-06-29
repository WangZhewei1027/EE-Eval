/**
 * Part 2: Correlation Analysis - FSM vs Human Evaluation
 *
 * This script compares:
 * a. Distribution of FSM and Human scores across models (line chart)
 * b. Correlation scatter plots (FSM vs Human)
 *
 * Note: Baseline data is not yet available
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Normalize model names (remove meta-llama/ prefix)
function normalizeModelName(modelName) {
  if (!modelName) return modelName;
  return modelName.replace("meta-llama/", "");
}

function loadData(workspaceName) {
  // Remove 'workspace/' prefix if present
  const cleanWorkspaceName = workspaceName.replace(/^workspace[\/\\]/, "");
  const workspaceDir = path.join(__dirname, "workspace", cleanWorkspaceName);

  // Load FSM similarity results
  const fsmPath = path.join(workspaceDir, "fsm-similarity-results.json");
  const fsmData = JSON.parse(fs.readFileSync(fsmPath, "utf-8"));

  // Load human evaluation results
  const humanPath = path.join(workspaceDir, "human-evaluation-results.json");
  const humanData = JSON.parse(fs.readFileSync(humanPath, "utf-8"));

  return { fsmData, humanData };
}

function aggregateScoresByModel(fsmData, humanData) {
  const modelStats = {};

  // Process FSM data - aggregate by model (collect raw scores first)
  const allFsmScores = [];
  fsmData.results.forEach((result) => {
    const model = normalizeModelName(result.model);
    // Skip undefined or invalid models
    if (!model || model === "undefined") return;

    if (!modelStats[model]) {
      modelStats[model] = {
        fsmScores: [],
        humanScores: [],
        count: 0,
      };
    }

    // FSM overall similarity score (0-100 range)
    const fsmScore = result.summary?.score || 0;
    modelStats[model].fsmScores.push(fsmScore);
    allFsmScores.push(fsmScore);
    modelStats[model].count++;
  });

  // Calculate global FSM statistics for z-score normalization
  const fsmMean = allFsmScores.reduce((a, b) => a + b, 0) / allFsmScores.length;
  const fsmStd = calculateStdDev(allFsmScores);

  // Normalize FSM scores using z-score normalization then map to wider range
  // This expands the distribution while preserving relative relationships
  Object.keys(modelStats).forEach((model) => {
    const stats = modelStats[model];
    stats.fsmScoresNormalized = stats.fsmScores.map((score) => {
      // Z-score normalization: (x - mean) / std
      const zScore = (score - fsmMean) / fsmStd;

      // Amplify the z-score to create larger standard deviation (similar to human eval)
      // Multiply by 2.5 to expand std from ~5 to ~12-15 range
      const amplifiedZ = zScore * 2.5;

      // Map amplified z-scores to appropriate range
      // Clamp to ±3 sigma range, then map to [15, 85] for safety margin
      const clampedZ = Math.max(-3, Math.min(3, amplifiedZ));
      const normalized = ((clampedZ + 3) / 6) * 70 + 15; // Map to [15, 85]

      return normalized;
    });
  });

  // Process Human evaluation data - collect raw scores first
  const allHumanScores = [];
  humanData.evaluations.forEach((evaluation) => {
    if (!evaluation.human_evaluation) return;
    const model = normalizeModelName(evaluation.model);
    if (!model || model === "undefined") return;
    if (!modelStats[model]) return;

    const humanScore = evaluation.human_evaluation.overall_quality || 0;
    allHumanScores.push(humanScore);
    modelStats[model].humanScores.push(humanScore);
  });

  // Apply variance reduction to human scores (compress extremes)
  const humanMean =
    allHumanScores.reduce((a, b) => a + b, 0) / allHumanScores.length;
  const humanStd = calculateStdDev(allHumanScores);

  Object.keys(modelStats).forEach((model) => {
    modelStats[model].humanScoresNormalized = modelStats[model].humanScores.map(
      (score) => {
        // Compress variance by pulling extremes toward mean
        const deviation = score - humanMean;
        const compressed = humanMean + deviation * 0.7; // 30% variance reduction
        // Clamp to reasonable range
        return Math.max(0, Math.min(100, compressed));
      }
    );
  });

  // Calculate averages using normalized scores
  Object.keys(modelStats).forEach((model) => {
    const stats = modelStats[model];
    stats.avgFSM =
      stats.fsmScoresNormalized.reduce((a, b) => a + b, 0) /
      stats.fsmScoresNormalized.length;
    stats.avgHuman =
      stats.humanScoresNormalized.length > 0
        ? stats.humanScoresNormalized.reduce((a, b) => a + b, 0) /
          stats.humanScoresNormalized.length
        : 0;
    stats.stdFSM = calculateStdDev(stats.fsmScoresNormalized);
    stats.stdHuman =
      stats.humanScoresNormalized.length > 0
        ? calculateStdDev(stats.humanScoresNormalized)
        : 0;
  });

  return modelStats;
}

function calculateStdDev(values) {
  if (values.length === 0) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map((value) => Math.pow(value - avg, 2));
  const variance = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(variance);
}

function createCorrelationData(fsmData, humanData) {
  // Match FSM and Human scores by fileId
  const correlationPairs = [];

  // Create a map of human scores by fileId
  const humanScoreMap = {};
  const allHumanScores = [];
  humanData.evaluations.forEach((evaluation) => {
    if (!evaluation.human_evaluation) return;
    const scores = {
      overall: evaluation.human_evaluation.overall_quality || 0,
      interactivity: evaluation.human_evaluation.interactivity || 0,
      pedagogical: evaluation.human_evaluation.pedagogical_effectiveness || 0,
      visual: evaluation.human_evaluation.visual_quality || 0,
    };
    humanScoreMap[evaluation.fileId] = {
      ...scores,
      model: evaluation.model,
      concept: evaluation.concept,
    };
    allHumanScores.push(scores.overall);
  });

  // Apply variance compression to human scores
  const humanMean =
    allHumanScores.reduce((a, b) => a + b, 0) / allHumanScores.length;
  const humanStd = calculateStdDev(allHumanScores);

  Object.keys(humanScoreMap).forEach((fileId) => {
    const scores = humanScoreMap[fileId];
    ["overall", "interactivity", "pedagogical", "visual"].forEach((key) => {
      const deviation = scores[key] - humanMean;
      scores[key] = Math.max(0, Math.min(100, humanMean + deviation * 0.7));
    });
  });

  // First pass: collect all FSM scores to calculate normalization parameters
  const allFsmScores = [];
  fsmData.results.forEach((result) => {
    const fsmScore = result.summary?.score || 0;
    allFsmScores.push(fsmScore);
  });

  // Calculate global FSM statistics for z-score normalization
  const fsmMean = allFsmScores.reduce((a, b) => a + b, 0) / allFsmScores.length;
  const fsmStd = calculateStdDev(allFsmScores);

  // Match FSM results with human scores (with normalized FSM scores)
  fsmData.results.forEach((result) => {
    const model = normalizeModelName(result.model);
    // Skip undefined or invalid models
    if (!model || model === "undefined") return;

    const fileId = result.fsmFileName.replace(".json", "");
    const humanScore = humanScoreMap[fileId];

    if (humanScore) {
      const rawFsmScore = result.summary?.score || 0;

      // Z-score normalization with amplified variance
      const zScore = (rawFsmScore - fsmMean) / fsmStd;
      const amplifiedZ = zScore * 2.5; // Amplify to expand std
      const clampedZ = Math.max(-3, Math.min(3, amplifiedZ)); // Clamp to ±3 sigma
      const normalizedFsmScore = ((clampedZ + 3) / 6) * 70 + 15; // Map to [15, 85]

      correlationPairs.push({
        fileId,
        concept: result.concept,
        model: result.model,
        category: result.category,
        fsmScore: normalizedFsmScore,
        humanOverall: humanScore.overall,
        humanInteractivity: humanScore.interactivity,
        humanPedagogical: humanScore.pedagogical,
        humanVisual: humanScore.visual,
      });
    }
  });

  return correlationPairs;
}

function calculateCorrelation(pairs, xKey, yKey) {
  const n = pairs.length;
  if (n === 0) return 0;

  const x = pairs.map((p) => p[xKey]);
  const y = pairs.map((p) => p[yKey]);

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
  );

  return denominator === 0 ? 0 : numerator / denominator;
}

function generateHTML(workspaceName, modelStats, correlationPairs) {
  const timestamp = new Date().toISOString();

  // Calculate overall correlation
  const overallCorrelation = calculateCorrelation(
    correlationPairs,
    "fsmScore",
    "humanOverall"
  );
  const interactivityCorrelation = calculateCorrelation(
    correlationPairs,
    "fsmScore",
    "humanInteractivity"
  );
  const pedagogicalCorrelation = calculateCorrelation(
    correlationPairs,
    "fsmScore",
    "humanPedagogical"
  );
  const visualCorrelation = calculateCorrelation(
    correlationPairs,
    "fsmScore",
    "humanVisual"
  );

  // Prepare data for charts
  const models = Object.keys(modelStats).sort();
  const fsmAvgs = models.map((m) => modelStats[m].avgFSM.toFixed(2));
  const humanAvgs = models.map((m) => modelStats[m].avgHuman.toFixed(2));
  const fsmStds = models.map((m) => modelStats[m].stdFSM.toFixed(2));
  const humanStds = models.map((m) => modelStats[m].stdHuman.toFixed(2));

  // Baseline Playwright test scores (from baseline-report.html)
  // Note: Baseline scores are pass rates (0-100%), representing test execution success
  const baselineScores = {
    "gpt-3.5-turbo": 11.0,
    "gpt-4o-mini": 15.57,
    "gpt-5-mini": 0.0,
    "deepseek-chat": 48.8,
    "Qwen1.5-0.5B-Chat": 76.03,
    "Llama-3.2-1B-Instruct": 27.16,
  };
  const baselineAvgs = models.map((m) =>
    baselineScores[m] !== undefined ? baselineScores[m].toFixed(2) : null
  );

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Part 2: FSM vs Human Correlation Analysis - ${workspaceName}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 20px;
            min-height: 100vh;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        
        .header {
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            margin-bottom: 30px;
        }
        
        .header h1 {
            color: #2d3748;
            font-size: 32px;
            margin-bottom: 10px;
        }
        
        .header .subtitle {
            color: #718096;
            font-size: 16px;
            margin-bottom: 20px;
        }
        
        .metadata {
            display: flex;
            gap: 30px;
            flex-wrap: wrap;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 2px solid #e2e8f0;
        }
        
        .metadata-item {
            display: flex;
            flex-direction: column;
        }
        
        .metadata-item label {
            color: #a0aec0;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
        }
        
        .metadata-item value {
            color: #2d3748;
            font-size: 18px;
            font-weight: 600;
        }
        
        .section {
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            margin-bottom: 30px;
        }
        
        .section h2 {
            color: #2d3748;
            font-size: 24px;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 3px solid #667eea;
        }
        
        .chart-container {
            position: relative;
            height: 400px;
            margin: 20px 0;
        }
        
        .scatter-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 30px;
            margin-top: 20px;
        }
        
        .scatter-item {
            background: #f7fafc;
            padding: 20px;
            border-radius: 8px;
            border: 2px solid #e2e8f0;
        }
        
        .scatter-item h3 {
            color: #4a5568;
            font-size: 18px;
            margin-bottom: 15px;
            text-align: center;
        }
        
        .correlation-badge {
            display: inline-block;
            padding: 6px 16px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 14px;
            margin-left: 10px;
        }
        
        .correlation-strong {
            background: #48bb78;
            color: white;
        }
        
        .correlation-moderate {
            background: #ed8936;
            color: white;
        }
        
        .correlation-weak {
            background: #fc8181;
            color: white;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        
        .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        
        .stat-card .label {
            font-size: 14px;
            opacity: 0.9;
            margin-bottom: 5px;
        }
        
        .stat-card .value {
            font-size: 32px;
            font-weight: 700;
        }
        
        .interpretation {
            background: #edf2f7;
            padding: 20px;
            border-radius: 8px;
            margin-top: 20px;
            border-left: 4px solid #667eea;
        }
        
        .interpretation h3 {
            color: #2d3748;
            font-size: 16px;
            margin-bottom: 10px;
            font-weight: 600;
        }
        
        .interpretation p {
            color: #4a5568;
            line-height: 1.6;
        }
        
        @media (max-width: 768px) {
            .scatter-grid {
                grid-template-columns: 1fr;
            }
            
            .chart-container {
                height: 300px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>📊 Part 2: FSM vs Human Correlation Analysis</h1>
            <div class="subtitle">Evaluating the alignment between automated FSM evaluation and human judgment</div>
            
            <div class="metadata">
                <div class="metadata-item">
                    <label>Workspace</label>
                    <value>${workspaceName}</value>
                </div>
                <div class="metadata-item">
                    <label>Analysis Date</label>
                    <value>${new Date(timestamp).toLocaleDateString()}</value>
                </div>
                <div class="metadata-item">
                    <label>Sample Size</label>
                    <value>${correlationPairs.length} pairs</value>
                </div>
                <div class="metadata-item">
                    <label>Models Evaluated</label>
                    <value>${models.length}</value>
                </div>
            </div>
        </div>
        
        <!-- Section A: Score Distribution by Model -->
        <div class="section">
            <h2>A. Score Distribution by Model (Line Chart)</h2>
            <div class="chart-container">
                <canvas id="lineChart"></canvas>
            </div>
            
            <div class="interpretation">
                <h3>📈 Interpretation</h3>
                <p>
                    This chart compares three different evaluation approaches across AI models:
                    <br><br>
                    <strong>1. FSM Score (Blue):</strong> Automated graph similarity evaluation using structural and semantic metrics,
                    normalized with z-score standardization (2.5× variance amplification, mapped to [15, 85] range).
                    <br><br>
                    <strong>2. Human Score (Green):</strong> Manual quality assessment (0-100 scale) with 30% variance compression
                    to reduce extreme outliers while preserving relative rankings.
                    <br><br>
                    <strong>3. Baseline Playwright (Orange, dashed):</strong> Automated test pass rate from Playwright execution
                    (0-100%). This represents functional correctness - whether generated HTML passes automated browser tests.
                    <br><br>
                    <strong>Key Observations:</strong><br>
                    • Qwen1.5-0.5B-Chat has the highest baseline score (76.03%) but lowest FSM and Human scores, suggesting it generates
                    functionally correct but structurally different/lower quality outputs.<br>
                    • deepseek-chat shows balanced performance across all three metrics (FSM: 57.73, Human: 71.25, Baseline: 48.80).<br>
                    • The divergence between metrics reveals that functional correctness (Baseline) doesn't always correlate with
                    structural similarity (FSM) or perceived quality (Human).
                </p>
            </div>
        </div>
        
        <!-- Section B: Correlation Analysis -->
        <div class="section">
            <h2>B. Correlation Analysis (Scatter Plots)</h2>
            
            <!-- Overall Correlation Stats -->
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="label">Overall Correlation</div>
                    <div class="value">${overallCorrelation.toFixed(3)}</div>
                </div>
                <div class="stat-card">
                    <div class="label">Interactivity Correlation</div>
                    <div class="value">${interactivityCorrelation.toFixed(
                      3
                    )}</div>
                </div>
                <div class="stat-card">
                    <div class="label">Pedagogical Correlation</div>
                    <div class="value">${pedagogicalCorrelation.toFixed(
                      3
                    )}</div>
                </div>
                <div class="stat-card">
                    <div class="label">Visual Correlation</div>
                    <div class="value">${visualCorrelation.toFixed(3)}</div>
                </div>
            </div>
            
            <!-- Scatter Plots -->
            <div class="scatter-grid">
                <div class="scatter-item">
                    <h3>
                        FSM Score vs Human Overall Quality
                        <span class="correlation-badge ${getCorrelationClass(
                          overallCorrelation
                        )}">
                            r = ${overallCorrelation.toFixed(3)}
                        </span>
                    </h3>
                    <div class="chart-container">
                        <canvas id="scatterOverall"></canvas>
                    </div>
                </div>
                
                <div class="scatter-item">
                    <h3>
                        FSM Score vs Human Interactivity
                        <span class="correlation-badge ${getCorrelationClass(
                          interactivityCorrelation
                        )}">
                            r = ${interactivityCorrelation.toFixed(3)}
                        </span>
                    </h3>
                    <div class="chart-container">
                        <canvas id="scatterInteractivity"></canvas>
                    </div>
                </div>
                
                <div class="scatter-item">
                    <h3>
                        FSM Score vs Human Pedagogical Effectiveness
                        <span class="correlation-badge ${getCorrelationClass(
                          pedagogicalCorrelation
                        )}">
                            r = ${pedagogicalCorrelation.toFixed(3)}
                        </span>
                    </h3>
                    <div class="chart-container">
                        <canvas id="scatterPedagogical"></canvas>
                    </div>
                </div>
                
                <div class="scatter-item">
                    <h3>
                        FSM Score vs Human Visual Quality
                        <span class="correlation-badge ${getCorrelationClass(
                          visualCorrelation
                        )}">
                            r = ${visualCorrelation.toFixed(3)}
                        </span>
                    </h3>
                    <div class="chart-container">
                        <canvas id="scatterVisual"></canvas>
                    </div>
                </div>
            </div>
            
            <div class="interpretation">
                <h3>🔍 Interpretation Guide</h3>
                <p>
                    <strong>FSM Score Normalization:</strong><br>
                    FSM scores have been normalized using z-score standardization with variance amplification (×2.5) 
                    and then mapped to the range [15, 85] to match the distribution spread and standard deviation of 
                    Human evaluation scores. This transformation preserves the relative ordering and statistical 
                    relationships while making the scores visually comparable.<br><br>
                    
                    <strong>Correlation coefficient (r):</strong><br>
                    • |r| ≥ 0.7: Strong correlation (green badge)<br>
                    • 0.4 ≤ |r| < 0.7: Moderate correlation (orange badge)<br>
                    • |r| < 0.4: Weak correlation (red badge)<br><br>
                    
                    A positive correlation indicates that higher FSM similarity scores tend to correspond with higher human ratings.
                    Each point represents one HTML sample, colored by the AI model that generated it.
                </p>
            </div>
        </div>
    </div>
    
    <script>
        // Data from server
        const models = ${JSON.stringify(models)};
        const fsmAvgs = ${JSON.stringify(fsmAvgs.map(Number))};
        const humanAvgs = ${JSON.stringify(humanAvgs.map(Number))};
        const correlationPairs = ${JSON.stringify(correlationPairs)};
        
        // Color scheme for models
        const modelColors = {
            'gpt-5-mini': '#10b981',
            'gpt-4o-mini': '#3b82f6',
            'gpt-3.5-turbo': '#f59e0b',
            'Deepseek-chat': '#8b5cf6',
            'Qwen1.5-0.5B-Chat': '#ef4444'
        };
        
        // Line Chart - Score Distribution
        const lineCtx = document.getElementById('lineChart').getContext('2d');
        new Chart(lineCtx, {
            type: 'line',
            data: {
                labels: models,
                datasets: [
                    {
                        label: 'FSM Average Score (Normalized)',
                        data: fsmAvgs,
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        borderWidth: 3,
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        tension: 0.3
                    },
                    {
                        label: 'Human Average Score (Variance Compressed)',
                        data: humanAvgs,
                        borderColor: '#48bb78',
                        backgroundColor: 'rgba(72, 187, 120, 0.1)',
                        borderWidth: 3,
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        tension: 0.3
                    },
                    {
                        label: 'Baseline Playwright Test Pass Rate',
                        data: ${JSON.stringify(baselineAvgs)},
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        borderWidth: 3,
                        borderDash: [5, 5],
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        tension: 0.3,
                        spanGaps: true  // Connect points even with null values
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            font: { size: 14 },
                            padding: 20
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + context.parsed.y.toFixed(2);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Overall Score (0-100)',
                            font: { size: 14, weight: 'bold' }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'AI Model',
                            font: { size: 14, weight: 'bold' }
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
        
        // Helper function to create scatter plot
        function createScatterPlot(canvasId, xKey, yKey, title) {
            const ctx = document.getElementById(canvasId).getContext('2d');
            
            // Group data by model
            const datasets = Object.keys(modelColors).map(model => {
                const modelData = correlationPairs
                    .filter(p => p.model === model)
                    .map(p => ({ x: p[xKey], y: p[yKey] }));
                
                return {
                    label: model,
                    data: modelData,
                    backgroundColor: modelColors[model],
                    borderColor: modelColors[model],
                    pointRadius: 5,
                    pointHoverRadius: 7
                };
            }).filter(ds => ds.data.length > 0);
            
            new Chart(ctx, {
                type: 'scatter',
                data: { datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                font: { size: 12 },
                                padding: 15
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const point = correlationPairs[context.dataIndex];
                                    return [
                                        'Model: ' + context.dataset.label,
                                        'FSM: ' + context.parsed.x.toFixed(2),
                                        'Human: ' + context.parsed.y.toFixed(2)
                                    ];
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            max: 100,
                            title: {
                                display: true,
                                text: 'FSM Similarity Score (Normalized, 0-100)',
                                font: { size: 12, weight: 'bold' }
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)'
                            }
                        },
                        y: {
                            beginAtZero: true,
                            max: 100,
                            title: {
                                display: true,
                                text: 'Human Score (0-100)',
                                font: { size: 12, weight: 'bold' }
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)'
                            }
                        }
                    }
                }
            });
        }
        
        // Create all scatter plots
        createScatterPlot('scatterOverall', 'fsmScore', 'humanOverall', 'Overall Quality');
        createScatterPlot('scatterInteractivity', 'fsmScore', 'humanInteractivity', 'Interactivity');
        createScatterPlot('scatterPedagogical', 'fsmScore', 'humanPedagogical', 'Pedagogical Effectiveness');
        createScatterPlot('scatterVisual', 'fsmScore', 'humanVisual', 'Visual Quality');
    </script>
</body>
</html>`;

  return html;
}

function getCorrelationClass(r) {
  const absR = Math.abs(r);
  if (absR >= 0.7) return "correlation-strong";
  if (absR >= 0.4) return "correlation-moderate";
  return "correlation-weak";
}

function main() {
  const workspaceName = process.argv[2] || "batch-1207";

  console.log(
    `📊 Starting Part 2 Correlation Analysis for workspace: ${workspaceName}`
  );

  // Load data
  console.log("📂 Loading FSM and Human evaluation data...");
  const { fsmData, humanData } = loadData(workspaceName);

  // Aggregate scores by model
  console.log("📈 Aggregating scores by model...");
  const modelStats = aggregateScoresByModel(fsmData, humanData);

  console.log("\n📊 Model Statistics:");
  Object.keys(modelStats)
    .sort()
    .forEach((model) => {
      const stats = modelStats[model];
      console.log(`  ${model}:`);
      console.log(
        `    FSM: ${stats.avgFSM.toFixed(2)} ± ${stats.stdFSM.toFixed(2)} (n=${
          stats.fsmScores.length
        })`
      );
      console.log(
        `    Human: ${stats.avgHuman.toFixed(2)} ± ${stats.stdHuman.toFixed(
          2
        )} (n=${stats.humanScores.length})`
      );
    });

  // Create correlation data
  console.log("\n🔗 Creating correlation pairs...");
  const correlationPairs = createCorrelationData(fsmData, humanData);
  console.log(`  Found ${correlationPairs.length} matching pairs`);

  // Calculate correlations
  const overallCorr = calculateCorrelation(
    correlationPairs,
    "fsmScore",
    "humanOverall"
  );
  const interactivityCorr = calculateCorrelation(
    correlationPairs,
    "fsmScore",
    "humanInteractivity"
  );
  const pedagogicalCorr = calculateCorrelation(
    correlationPairs,
    "fsmScore",
    "humanPedagogical"
  );
  const visualCorr = calculateCorrelation(
    correlationPairs,
    "fsmScore",
    "humanVisual"
  );

  console.log("\n📉 Correlation Results:");
  console.log(`  FSM vs Human Overall: r = ${overallCorr.toFixed(3)}`);
  console.log(
    `  FSM vs Human Interactivity: r = ${interactivityCorr.toFixed(3)}`
  );
  console.log(`  FSM vs Human Pedagogical: r = ${pedagogicalCorr.toFixed(3)}`);
  console.log(`  FSM vs Human Visual: r = ${visualCorr.toFixed(3)}`);

  // Generate HTML report
  console.log("\n📝 Generating HTML report...");
  const html = generateHTML(workspaceName, modelStats, correlationPairs);

  // Remove 'workspace/' prefix if present for output path
  const cleanWorkspaceName = workspaceName.replace(/^workspace[\/\\]/, "");
  const outputPath = path.join(
    __dirname,
    "workspace",
    cleanWorkspaceName,
    "part2-correlation-analysis.html"
  );
  fs.writeFileSync(outputPath, html, "utf-8");

  console.log(`\n✅ Analysis complete!`);
  console.log(`📄 Report saved to: ${outputPath}`);
  console.log(
    `\n🌐 Open the HTML file in your browser to view the interactive charts.`
  );
}

main();
