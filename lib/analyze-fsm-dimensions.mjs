/**
 * Part 3: FSM Multi-Dimensional Analysis
 *
 * This script analyzes FSM evaluation results across different dimensions:
 * a. Table: Model performance across all FSM dimensions
 * b. Radar Charts: Visual comparison of each model's multi-dimensional profile
 *
 * FSM Dimensions:
 * - Node Count Similarity
 * - Edge Count Similarity
 * - State Overlap
 * - Transition Overlap
 * - Semantic Similarity
 * - Overall Similarity
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadFSMData(workspaceName) {
  // Remove 'workspace/' prefix if present
  const cleanWorkspaceName = workspaceName.replace(/^workspace[\/\\]/, "");
  const workspaceDir = path.join(__dirname, "workspace", cleanWorkspaceName);
  const fsmPath = path.join(workspaceDir, "fsm-similarity-results.json");
  return JSON.parse(fs.readFileSync(fsmPath, "utf-8"));
}

function aggregateDimensionsByModel(fsmData) {
  const modelDimensions = {};

  fsmData.results.forEach((result) => {
    const model = result.model;
    // Skip undefined or invalid models
    if (!model || model === "undefined") return;

    if (!modelDimensions[model]) {
      modelDimensions[model] = {
        structural: [],
        semantic: [],
        overall: [],
        nodeCountSim: [],
        edgeCountSim: [],
      };
    }

    const simResult = result.similarityResult;

    // Main dimensions (weighted components) - extract from combined_similarity and component similarities
    const structuralScore =
      (simResult.structural_similarity?.overall || 0) * 100;
    const semanticScore = (simResult.semantic_similarity?.overall || 0) * 100;
    const overallScore = result.summary?.score || 0;

    modelDimensions[model].structural.push(structuralScore);
    modelDimensions[model].semantic.push(semanticScore);
    modelDimensions[model].overall.push(overallScore);

    // Sub-dimensions (detailed metrics)
    modelDimensions[model].nodeCountSim.push(
      (simResult.structural_similarity?.node_count_similarity || 0) * 100
    );
    modelDimensions[model].edgeCountSim.push(
      (simResult.structural_similarity?.edge_count_similarity || 0) * 100
    );
  });

  // Collect all dimension values for normalization
  const allDimensionValues = {
    structural: [],
    semantic: [],
    overall: [],
    nodeCountSim: [],
    edgeCountSim: [],
  };

  Object.keys(modelDimensions).forEach((model) => {
    Object.keys(allDimensionValues).forEach((dim) => {
      allDimensionValues[dim].push(...modelDimensions[model][dim]);
    });
  });

  // Calculate normalization parameters for each dimension
  const normParams = {};
  Object.keys(allDimensionValues).forEach((dim) => {
    const values = allDimensionValues[dim];
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const std = calculateStdDev(values);
    normParams[dim] = { mean, std };
  });

  // Apply z-score normalization with amplification to each dimension
  const modelStats = {};
  Object.keys(modelDimensions).forEach((model) => {
    modelStats[model] = {};

    Object.keys(modelDimensions[model]).forEach((dimension) => {
      const values = modelDimensions[model][dimension];
      const { mean, std } = normParams[dimension];

      // Normalize values using z-score with amplification
      const normalizedValues = values.map((value) => {
        const zScore = (value - mean) / (std || 1); // Avoid division by zero
        const amplifiedZ = zScore * 2.5; // Amplify variance
        const clampedZ = Math.max(-3, Math.min(3, amplifiedZ));
        return ((clampedZ + 3) / 6) * 70 + 15; // Map to [15, 85]
      });

      modelStats[model][dimension] = {
        mean:
          normalizedValues.reduce((a, b) => a + b, 0) / normalizedValues.length,
        std: calculateStdDev(normalizedValues),
        count: normalizedValues.length,
        rawMean: values.reduce((a, b) => a + b, 0) / values.length, // Keep for reference
      };
    });
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

function generateHTML(workspaceName, modelStats) {
  const timestamp = new Date().toISOString();
  const models = Object.keys(modelStats).sort();

  // Generate table rows
  const tableRows = models
    .map((model) => {
      const stats = modelStats[model];
      return `
            <tr>
                <td class="model-cell">${model}</td>
                <td>${stats.nodeCountSim.mean.toFixed(
                  2
                )} <span class="std">±${stats.nodeCountSim.std.toFixed(
        2
      )}</span></td>
                <td>${stats.edgeCountSim.mean.toFixed(
                  2
                )} <span class="std">±${stats.edgeCountSim.std.toFixed(
        2
      )}</span></td>
                <td class="dimension-structural">${stats.structural.mean.toFixed(
                  2
                )} <span class="std">±${stats.structural.std.toFixed(
        2
      )}</span></td>
                <td class="dimension-semantic">${stats.semantic.mean.toFixed(
                  2
                )} <span class="std">±${stats.semantic.std.toFixed(
        2
      )}</span></td>
                <td class="dimension-overall">${stats.overall.mean.toFixed(
                  2
                )} <span class="std">±${stats.overall.std.toFixed(
        2
      )}</span></td>
            </tr>`;
    })
    .join("");

  // Prepare radar chart data (only non-zero dimensions)
  const radarData = models.map((model) => {
    const stats = modelStats[model];
    return {
      model,
      data: [
        stats.structural.mean,
        stats.semantic.mean,
        stats.nodeCountSim.mean,
        stats.edgeCountSim.mean,
        stats.overall.mean,
      ],
    };
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Part 3: FSM Multi-Dimensional Analysis - ${workspaceName}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            padding: 40px 20px;
            min-height: 100vh;
        }
        
        .container {
            max-width: 1600px;
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
            border-bottom: 3px solid #f5576c;
        }
        
        .dimension-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            font-size: 14px;
            overflow-x: auto;
            display: block;
        }
        
        .dimension-table thead {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
        }
        
        .dimension-table th,
        .dimension-table td {
            padding: 12px 15px;
            text-align: center;
            border: 1px solid #e2e8f0;
        }
        
        .dimension-table th {
            font-weight: 600;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.5px;
        }
        
        .dimension-table tbody tr:nth-child(even) {
            background-color: #f7fafc;
        }
        
        .dimension-table tbody tr:hover {
            background-color: #edf2f7;
            transition: background-color 0.2s;
        }
        
        .model-cell {
            font-weight: 600;
            color: #2d3748;
            text-align: left !important;
            white-space: nowrap;
        }
        
        .std {
            color: #a0aec0;
            font-size: 11px;
            display: block;
            margin-top: 2px;
        }
        
        .dimension-structural {
            background-color: #e6f7ff !important;
        }
        
        .dimension-semantic {
            background-color: #fff7e6 !important;
        }
        
        .dimension-isomorphism {
            background-color: #f0f5ff !important;
        }
        
        .dimension-overall {
            background-color: #f6ffed !important;
            font-weight: 600;
        }
        
        .radar-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 30px;
            margin-top: 30px;
        }
        
        .radar-item {
            background: #f7fafc;
            padding: 25px;
            border-radius: 8px;
            border: 2px solid #e2e8f0;
        }
        
        .radar-item h3 {
            color: #2d3748;
            font-size: 18px;
            margin-bottom: 20px;
            text-align: center;
            font-weight: 600;
        }
        
        .chart-container {
            position: relative;
            height: 350px;
        }
        
        .interpretation {
            background: #edf2f7;
            padding: 20px;
            border-radius: 8px;
            margin-top: 20px;
            border-left: 4px solid #f5576c;
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
            margin-bottom: 10px;
        }
        
        .interpretation ul {
            margin-left: 20px;
            color: #4a5568;
            line-height: 1.8;
        }
        
        .legend-box {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 20px;
            padding: 20px;
            background: white;
            border-radius: 8px;
            border: 2px dashed #cbd5e0;
        }
        
        .legend-item {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .legend-color {
            width: 20px;
            height: 20px;
            border-radius: 4px;
        }
        
        .legend-label {
            color: #4a5568;
            font-size: 13px;
            font-weight: 500;
        }
        
        @media (max-width: 768px) {
            .radar-grid {
                grid-template-columns: 1fr;
            }
            
            .dimension-table {
                font-size: 11px;
            }
            
            .dimension-table th,
            .dimension-table td {
                padding: 8px 10px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>🎯 Part 3: FSM Multi-Dimensional Analysis</h1>
            <div class="subtitle">Breaking down FSM evaluation across 5 key dimensions (normalized with 2.5× variance amplification)</div>
            
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
                    <label>Models Analyzed</label>
                    <value>${models.length}</value>
                </div>
                <div class="metadata-item">
                    <label>Total Samples</label>
                    <value>${modelStats[models[0]].overall.count}</value>
                </div>
            </div>
        </div>
        
        <!-- Section A: Dimension Table -->
        <div class="section">
            <h2>A. Model Performance Across FSM Dimensions</h2>
            
            <div style="overflow-x: auto;">
                <table class="dimension-table">
                    <thead>
                        <tr>
                            <th>Model</th>
                            <th>Node Count<br>Similarity</th>
                            <th>Edge Count<br>Similarity</th>
                            <th>Structural<br>(40%)</th>
                            <th>Semantic<br>(40%)</th>
                            <th>Overall<br>Score</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
            
            <div class="interpretation">
                <h3>📊 Table Interpretation</h3>
                <p>
                    This table shows the mean and standard deviation (±) for each FSM dimension across all samples generated by each model.
                    <strong>All scores are normalized using z-score transformation with 2.5× variance amplification</strong> to match the distribution
                    characteristics of human evaluations (standard deviation ~10-20), mapped to a [15, 85] range.
                </p>
                <p><strong>Note:</strong> Zero-valued dimensions (Isomorphism, State Overlap, Transition Overlap) have been removed for clearer visualization.</p>
                <p><strong>Dimensions:</strong></p>
                <ul>
                    <li><strong>Node Count Similarity:</strong> How similar the number of states is between generated and ideal FSM</li>
                    <li><strong>Edge Count Similarity:</strong> How similar the number of transitions is between FSMs</li>
                    <li><strong>Structural (40%):</strong> Graph topology metrics (nodes, edges, connectivity)</li>
                    <li><strong>Semantic (40%):</strong> Conceptual alignment and state naming similarity</li>
                    <li><strong>Overall Score:</strong> Weighted combination of structural and semantic dimensions</li>
                </ul>
            </div>
        </div>
        
        <!-- Section B: Radar Charts -->
        <div class="section">
            <h2>B. Multi-Dimensional Model Profiles (Radar Charts)</h2>
            
            <div class="legend-box">
                <div class="legend-item">
                    <div class="legend-color" style="background: #10b981;"></div>
                    <div class="legend-label">gpt-5-mini</div>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #3b82f6;"></div>
                    <div class="legend-label">gpt-4o-mini</div>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #f59e0b;"></div>
                    <div class="legend-label">gpt-3.5-turbo</div>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #8b5cf6;"></div>
                    <div class="legend-label">Deepseek-chat</div>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #ef4444;"></div>
                    <div class="legend-label">Qwen1.5-0.5B-Chat</div>
                </div>
            </div>
            
            <div class="radar-grid">
                ${models
                  .map(
                    (model) => `
                    <div class="radar-item">
                        <h3>${model}</h3>
                        <div class="chart-container">
                            <canvas id="radar-${model.replace(
                              /[^a-zA-Z0-9]/g,
                              "-"
                            )}"></canvas>
                        </div>
                    </div>
                `
                  )
                  .join("")}
            </div>
            
            <div class="interpretation">
                <h3>🎯 Radar Chart Interpretation</h3>
                <p>
                    Each radar chart visualizes a model's performance across five FSM dimensions.
                    <strong>All scores are normalized using z-score transformation with 2.5× variance amplification</strong> to match human evaluation distributions,
                    enabling fair visual comparison. A larger polygon area indicates better overall performance, while the shape reveals strengths and weaknesses:
                </p>
                <ul>
                    <li><strong>Balanced polygon:</strong> Model performs consistently across all dimensions</li>
                    <li><strong>Asymmetric polygon:</strong> Model excels in some dimensions but underperforms in others</li>
                    <li><strong>Larger area:</strong> Higher overall quality and similarity to ideal FSMs</li>
                </ul>
                <p>
                    Compare the shapes across models to identify which models generate FSMs that are structurally sound
                    and semantically meaningful. Zero-valued dimensions (Isomorphism, State/Transition Overlap) are excluded.
                </p>
            </div>
        </div>
    </div>
    
    <script>
        // Data from server
        const radarData = ${JSON.stringify(radarData)};
        
        const modelColors = {
            'gpt-5-mini': 'rgba(16, 185, 129, 0.6)',
            'gpt-4o-mini': 'rgba(59, 130, 246, 0.6)',
            'gpt-3.5-turbo': 'rgba(245, 158, 11, 0.6)',
            'Deepseek-chat': 'rgba(139, 92, 246, 0.6)',
            'Qwen1.5-0.5B-Chat': 'rgba(239, 68, 68, 0.6)'
        };
        
        const modelBorderColors = {
            'gpt-5-mini': 'rgb(16, 185, 129)',
            'gpt-4o-mini': 'rgb(59, 130, 246)',
            'gpt-3.5-turbo': 'rgb(245, 158, 11)',
            'Deepseek-chat': 'rgb(139, 92, 246)',
            'Qwen1.5-0.5B-Chat': 'rgb(239, 68, 68)'
        };
        
        const radarLabels = [
            'Structural',
            'Semantic',
            'Node Count Sim',
            'Edge Count Sim',
            'Overall Score'
        ];
        
        // Create radar chart for each model
        radarData.forEach(({ model, data }) => {
            const canvasId = 'radar-' + model.replace(/[^a-zA-Z0-9]/g, '-');
            const ctx = document.getElementById(canvasId).getContext('2d');
            
            new Chart(ctx, {
                type: 'radar',
                data: {
                    labels: radarLabels,
                    datasets: [{
                        label: model,
                        data: data,
                        backgroundColor: modelColors[model] || 'rgba(100, 100, 100, 0.6)',
                        borderColor: modelBorderColors[model] || 'rgb(100, 100, 100)',
                        borderWidth: 2,
                        pointBackgroundColor: modelBorderColors[model] || 'rgb(100, 100, 100)',
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: modelBorderColors[model] || 'rgb(100, 100, 100)',
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return context.label + ': ' + context.parsed.r.toFixed(2);
                                }
                            }
                        }
                    },
                    scales: {
                        r: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                stepSize: 20,
                                font: {
                                    size: 10
                                }
                            },
                            pointLabels: {
                                font: {
                                    size: 11,
                                    weight: 'bold'
                                },
                                color: '#4a5568'
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.1)'
                            },
                            angleLines: {
                                color: 'rgba(0, 0, 0, 0.1)'
                            }
                        }
                    }
                }
            });
        });
    </script>
</body>
</html>`;

  return html;
}

function main() {
  const workspaceName = process.argv[2] || "batch-1207";

  console.log(
    `🎯 Starting Part 3 Multi-Dimensional Analysis for workspace: ${workspaceName}`
  );

  // Load FSM data
  console.log("📂 Loading FSM evaluation data...");
  const fsmData = loadFSMData(workspaceName);

  // Aggregate dimensions by model
  console.log("📊 Aggregating dimensions by model...");
  const modelStats = aggregateDimensionsByModel(fsmData);

  console.log("\n📈 Model Dimension Statistics:");
  Object.keys(modelStats)
    .sort()
    .forEach((model) => {
      const stats = modelStats[model];
      console.log(`\n  ${model}:`);
      console.log(
        `    Structural: ${stats.structural.mean.toFixed(
          2
        )} ± ${stats.structural.std.toFixed(2)}`
      );
      console.log(
        `    Semantic: ${stats.semantic.mean.toFixed(
          2
        )} ± ${stats.semantic.std.toFixed(2)}`
      );
      console.log(
        `    Node Count Sim: ${stats.nodeCountSim.mean.toFixed(
          2
        )} ± ${stats.nodeCountSim.std.toFixed(2)}`
      );
      console.log(
        `    Edge Count Sim: ${stats.edgeCountSim.mean.toFixed(
          2
        )} ± ${stats.edgeCountSim.std.toFixed(2)}`
      );
      console.log(
        `    Overall: ${stats.overall.mean.toFixed(
          2
        )} ± ${stats.overall.std.toFixed(2)}`
      );
    });

  // Generate HTML report
  console.log("\n📝 Generating HTML report with table and radar charts...");
  const html = generateHTML(workspaceName, modelStats);

  // Remove 'workspace/' prefix if present for output path
  const cleanWorkspaceName = workspaceName.replace(/^workspace[\/\\]/, "");
  const outputPath = path.join(
    __dirname,
    "workspace",
    cleanWorkspaceName,
    "part3-fsm-dimensions-analysis.html"
  );
  fs.writeFileSync(outputPath, html, "utf-8");

  console.log(`\n✅ Analysis complete!`);
  console.log(`📄 Report saved to: ${outputPath}`);
  console.log(
    `\n🌐 Open the HTML file in your browser to view the interactive visualizations.`
  );
}

main();
