import express from "express";
import { promises as fs } from "fs";
import path from "path";
import cors from "cors";

const app = express();
const PORT = 3000;

// Enable CORS to allow access from the frontend
app.use(cors());
app.use(express.json());

// Static file serving - exposes the workspace folder
app.use("/workspace", express.static("./workspace"));

// Get the list of all workspaces
app.get("/api/workspaces", async (req, res) => {
  try {
    const workspacePath = "./workspace";

    // Check whether the workspace directory exists
    try {
      await fs.access(workspacePath);
    } catch (error) {
      return res.json([]);
    }

    const items = await fs.readdir(workspacePath, { withFileTypes: true });

    // Filter directories and check whether each one contains the required subdirectories
    const workspaces = [];

    for (const item of items) {
      if (item.isDirectory()) {
        const workspaceName = item.name;
        const workspaceFullPath = path.join(workspacePath, workspaceName);

        // Check whether it contains both the data and html directories
        try {
          const dataPath = path.join(workspaceFullPath, "data");
          const htmlPath = path.join(workspaceFullPath, "html");

          await fs.access(dataPath);
          await fs.access(htmlPath);

          // Check whether the data directory contains JSON files (UUID format or data.json)
          const dataFiles = await fs.readdir(dataPath);
          const hasDataFiles = dataFiles.some(
            (file) =>
              file.endsWith(".json") &&
              (file === "data.json" ||
                /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json$/i.test(
                  file
                ))
          );

          if (hasDataFiles) {
            workspaces.push({
              name: workspaceName,
              path: workspaceName,
              hasData: true,
              hasHtml: true,
            });
          } else {
            workspaces.push({
              name: workspaceName,
              path: workspaceName,
              hasData: false,
              hasHtml: false,
            });
          }
        } catch (error) {
          // If the directory structure is incomplete, still add it but mark it as incomplete
          workspaces.push({
            name: workspaceName,
            path: workspaceName,
            hasData: false,
            hasHtml: false,
          });
        }
      }
    }

    res.json(workspaces);
  } catch (error) {
    console.error("Failed to get workspace list:", error);
    res.status(500).json({
      error: "Failed to get workspace list",
      message: error.message,
    });
  }
});

// Get the data for a specific workspace
app.get("/api/workspaces/:workspace/data", async (req, res) => {
  try {
    const { workspace } = req.params;
    const dataDir = `./workspace/${workspace}/data`;
    const legacyDataPath = path.join(dataDir, "data.json");

    // First check whether the legacy data.json file exists
    try {
      await fs.access(legacyDataPath);
      const data = await fs.readFile(legacyDataPath, "utf-8");
      const jsonData = JSON.parse(data);
      return res.json(jsonData);
    } catch (error) {
      // data.json does not exist; fall back to reading the UUID-format files
    }

    // Read all UUID-format JSON files
    const files = await fs.readdir(dataDir);
    const uuidFiles = files.filter((file) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json$/i.test(
        file
      )
    );

    const allData = [];
    for (const file of uuidFiles) {
      try {
        const filePath = path.join(dataDir, file);
        const fileData = await fs.readFile(filePath, "utf-8");
        const jsonData = JSON.parse(fileData);
        allData.push(jsonData);
      } catch (error) {
        console.warn(`Skipping invalid file ${file}:`, error.message);
      }
    }

    // Sort by timestamp
    allData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    res.json(allData);
  } catch (error) {
    console.error("Failed to get workspace data:", error);
    res.status(500).json({
      error: "Failed to get workspace data",
      message: error.message,
    });
  }
});

// Get the list of HTML files for a specific workspace
app.get("/api/workspaces/:workspace/html", async (req, res) => {
  try {
    const { workspace } = req.params;
    const htmlPath = `./workspace/${workspace}/html`;

    const files = await fs.readdir(htmlPath);
    const htmlFiles = files
      .filter((file) => file.endsWith(".html"))
      .map((file) => ({
        name: file,
        id: file.replace(".html", ""),
        url: `/workspace/${workspace}/html/${file}`,
      }));

    res.json(htmlFiles);
  } catch (error) {
    console.error("Failed to get HTML file list:", error);
    res.status(500).json({
      error: "Failed to get HTML file list",
      message: error.message,
    });
  }
});

// Get workspace statistics
app.get("/api/workspaces/:workspace/stats", async (req, res) => {
  try {
    const { workspace } = req.params;
    const dataDir = `./workspace/${workspace}/data`;
    const htmlPath = `./workspace/${workspace}/html`;

    // Get the data (both formats supported)
    let jsonData = [];

    // First try the legacy data.json
    const legacyDataPath = path.join(dataDir, "data.json");
    try {
      await fs.access(legacyDataPath);
      const data = await fs.readFile(legacyDataPath, "utf-8");
      jsonData = JSON.parse(data);
    } catch (error) {
      // Fall back to reading the UUID files
      const files = await fs.readdir(dataDir);
      const uuidFiles = files.filter((file) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json$/i.test(
          file
        )
      );

      for (const file of uuidFiles) {
        try {
          const filePath = path.join(dataDir, file);
          const fileData = await fs.readFile(filePath, "utf-8");
          const data = JSON.parse(fileData);
          jsonData.push(data);
        } catch (error) {
          console.warn(`Skipping invalid file ${file}:`, error.message);
        }
      }
    }

    // Read the HTML files
    const htmlFiles = await fs.readdir(htmlPath);
    const htmlCount = htmlFiles.filter((file) => file.endsWith(".html")).length;

    // Tally model usage
    const modelStats = {};
    jsonData.forEach((item) => {
      modelStats[item.model] = (modelStats[item.model] || 0) + 1;
    });

    // Get the newest and oldest records
    const timestamps = jsonData.map((item) => new Date(item.timestamp));
    const newest =
      timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null;
    const oldest =
      timestamps.length > 0 ? new Date(Math.min(...timestamps)) : null;

    res.json({
      workspace,
      totalEntries: jsonData.length,
      htmlFiles: htmlCount,
      modelStats,
      storageType: jsonData.length > 0 ? "uuid" : "legacy", // Storage type indicator
      dateRange: {
        newest: newest ? newest.toISOString() : null,
        oldest: oldest ? oldest.toISOString() : null,
      },
    });
  } catch (error) {
    console.error("Failed to get workspace stats:", error);
    res.status(500).json({
      error: "Failed to get workspace stats",
      message: error.message,
    });
  }
});

// FSM-related endpoints

// Get FSM data from an HTML file
app.get("/api/fsm-data/:workspace/:filename", async (req, res) => {
  try {
    const { workspace, filename } = req.params;
    const htmlPath = path.join("./workspace", workspace, "html", filename);

    // Check whether the file exists
    try {
      await fs.access(htmlPath);
    } catch (error) {
      return res.status(404).json({ error: "HTML file not found" });
    }

    const htmlContent = await fs.readFile(htmlPath, "utf-8");

    // Extract FSM data from script tag
    const fsmMatch = htmlContent.match(
      /<script[^>]*type=['"]application\/json['"][^>]*>([\s\S]*?)<\/script>/
    );

    if (!fsmMatch) {
      return res.status(404).json({ error: "FSM data not found in HTML file" });
    }

    const fsmData = JSON.parse(fsmMatch[1]);
    res.json(fsmData);
  } catch (error) {
    console.error("Failed to get FSM data:", error);
    res.status(500).json({ error: error.message });
  }
});

// New API endpoint: get FSM data from a standalone FSM JSON file
app.get("/api/fsm/:workspace/:fileId", async (req, res) => {
  try {
    const { workspace, fileId } = req.params;
    // Support the file ID with or without the .json extension
    const cleanFileId = fileId.replace(/\.json$/, "");
    const fsmPath = path.join(
      "./workspace",
      workspace,
      "fsm",
      `${cleanFileId}.json`
    );

    // Check whether the file exists
    try {
      await fs.access(fsmPath);
    } catch (error) {
      return res.status(404).json({ error: "FSM file not found" });
    }

    const fsmContent = await fs.readFile(fsmPath, "utf-8");
    const fsmData = JSON.parse(fsmContent);
    res.json(fsmData);
  } catch (error) {
    console.error("Failed to get FSM data:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get a single UUID data entry
app.get("/api/workspaces/:workspace/data/:uuid", async (req, res) => {
  try {
    const { workspace, uuid } = req.params;
    const dataPath = `./workspace/${workspace}/data/${uuid}.json`;

    const data = await fs.readFile(dataPath, "utf-8");
    const jsonData = JSON.parse(data);

    res.json(jsonData);
  } catch (error) {
    console.error("Failed to get UUID data:", error);
    res.status(404).json({
      error: "Data not found",
      message: `No data file exists for UUID ${req.params.uuid}`,
    });
  }
});

// Check whether the workspace has an ideal-FSM folder
app.get("/api/workspace/:workspace/has-ideal-fsm", async (req, res) => {
  try {
    const { workspace } = req.params;
    const idealFsmPath = `./workspace/${workspace}/ideal-fsm`;

    try {
      await fs.access(idealFsmPath);
      res.json({ exists: true });
    } catch (error) {
      res.json({ exists: false });
    }
  } catch (error) {
    console.error("Failed to check ideal-FSM folder:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get ideal-FSM data
app.get("/api/ideal-fsm/:workspace/:topic", async (req, res) => {
  try {
    const { workspace, topic } = req.params;
    const decodedTopic = decodeURIComponent(topic);

    // Sanitize the topic name, replacing special characters with underscores
    const cleanTopic = decodedTopic.replace(/[^a-zA-Z0-9]/g, "_");
    const idealFsmPath = `./workspace/${workspace}/ideal-fsm/${cleanTopic}.json`;

    console.log("Looking for ideal FSM at:", idealFsmPath);

    try {
      const data = await fs.readFile(idealFsmPath, "utf-8");
      const jsonData = JSON.parse(data);
      res.json(jsonData);
    } catch (error) {
      console.warn("Ideal FSM not found:", idealFsmPath);
      res.status(404).json({
        error: "Ideal FSM not found",
        message: `No ideal-FSM file exists for topic "${decodedTopic}"`,
        searchPath: idealFsmPath,
      });
    }
  } catch (error) {
    console.error("Failed to get ideal-FSM data:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get a data file (used to extract topic information)
app.get("/api/data/:workspace/:fileId", async (req, res) => {
  try {
    const { workspace, fileId } = req.params;
    const dataPath = `./workspace/${workspace}/data/${fileId}.json`;

    console.log("Looking for data file at:", dataPath);

    try {
      const data = await fs.readFile(dataPath, "utf-8");
      const jsonData = JSON.parse(data);
      res.json(jsonData);
    } catch (error) {
      console.warn("Data file not found:", dataPath);
      res.status(404).json({
        error: "Data file not found",
        message: `No data file exists for "${fileId}"`,
        searchPath: dataPath,
      });
    }
  } catch (error) {
    console.error("Failed to get data file:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get the screenshot list
app.get("/api/screenshots/:workspace/:filename", async (req, res) => {
  try {
    const { workspace, filename } = req.params;
    const baseName = filename.replace(".html", "");
    const screenshotDir = path.join(
      "./workspace",
      workspace,
      "visuals",
      baseName
    );

    // Check whether the screenshot directory exists
    try {
      await fs.access(screenshotDir);
    } catch (error) {
      return res.json([]);
    }

    const files = await fs.readdir(screenshotDir);
    const screenshots = files
      .filter((file) => file.endsWith(".png"))
      .sort()
      .map((file) => ({
        filename: file,
        url: `/workspace/${workspace}/visuals/${baseName}/${file}`,
        state: extractStateFromFilename(file),
      }));

    res.json(screenshots);
  } catch (error) {
    console.error("Failed to get screenshot list:", error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to extract state from filename
function extractStateFromFilename(filename) {
  // Handle different screenshot naming patterns

  // Pattern 1: Deque format like "001_01_initial_state.png", "002_01_add_front_A.png"
  const dequePatterns = [
    /\d+_\d+_initial_state\.png$/, // initial state
    /\d+_\d+_add_front_.*\.png$/, // adding to front
    /\d+_\d+_add_back_.*\.png$/, // adding to back
    /\d+_\d+_remove_front.*\.png$/, // removing from front
    /\d+_\d+_remove_back.*\.png$/, // removing from back
    /\d+_empty_.*\.png$/, // empty operations
    /\d+_.*_complete\.png$/, // completion states
    /\d+_.*_test\.png$/, // test states
  ];

  // Map Deque screenshot patterns to FSM states
  if (/\d+_\d+_initial_state\.png$/.test(filename)) return "idle";
  if (/\d+_\d+_add_front_.*\.png$/.test(filename)) return "adding_to_front";
  if (/\d+_\d+_add_back_.*\.png$/.test(filename)) return "adding_to_back";
  if (/\d+_\d+_remove_front.*\.png$/.test(filename))
    return "removing_from_front";
  if (/\d+_\d+_remove_back.*\.png$/.test(filename)) return "removing_from_back";
  if (/\d+_empty_.*\.png$/.test(filename)) return "idle";
  if (/\d+_.*_complete\.png$/.test(filename)) return "updating_display";
  if (/\d+_.*_test\.png$/.test(filename)) return "idle";

  // Pattern 2: Traditional FSM format like "01_idle_initial.png", "02_validating_input_valid.png"
  const traditionalPatterns = [
    /\d+_([a-z_]+)_.*\.png$/,
    /([a-z_]+)_[a-z_]+\.png$/,
    /\d+_([a-z_]+)\.png$/,
  ];

  for (const pattern of traditionalPatterns) {
    const match = filename.match(pattern);
    if (match) {
      return match[1];
    }
  }

  // Pattern 3: Try to extract meaningful state from filename
  const meaningfulPatterns = [
    { pattern: /initial/i, state: "idle" },
    { pattern: /add.*front/i, state: "adding_to_front" },
    { pattern: /add.*back/i, state: "adding_to_back" },
    { pattern: /remove.*front/i, state: "removing_from_front" },
    { pattern: /remove.*back/i, state: "removing_from_back" },
    { pattern: /validating/i, state: "validating_input" },
    { pattern: /error|alert/i, state: "error_alert" },
    { pattern: /inserting/i, state: "inserting_node" },
    { pattern: /drawing|tree/i, state: "drawing_tree" },
    { pattern: /reset/i, state: "tree_resetting" },
    { pattern: /empty/i, state: "idle" },
    { pattern: /complete/i, state: "updating_display" },
  ];

  for (const { pattern, state } of meaningfulPatterns) {
    if (pattern.test(filename)) {
      return state;
    }
  }

  return "unknown";
}

// Get evaluation results
app.get("/api/evaluation/:workspace/:filename", async (req, res) => {
  try {
    const { workspace, filename } = req.params;
    const baseName = filename.replace(".html", "");
    const evaluationPath = path.join(
      "./workspace",
      workspace,
      "data",
      `${baseName}_evaluation.json`
    );

    // Check whether the evaluation file exists
    try {
      await fs.access(evaluationPath);
    } catch (error) {
      return res.status(404).json({
        error: "Evaluation not found",
        message: "No evaluation file exists for this HTML file",
      });
    }

    const evaluationData = await fs.readFile(evaluationPath, "utf-8");
    const evaluation = JSON.parse(evaluationData);

    res.json(evaluation);
  } catch (error) {
    console.error("Failed to get evaluation results:", error);
    res.status(500).json({ error: error.message });
  }
});

// Trigger a new evaluation
app.post("/api/evaluation/:workspace/:filename", async (req, res) => {
  try {
    const { workspace, filename } = req.params;
    const baseName = filename.replace(".html", "");

    // Dynamically import the evaluator
    const { default: VisualEvaluator } = await import("./visual-evaluator.mjs");
    const evaluator = new VisualEvaluator();

    // Run the evaluation
    const evaluation = await evaluator.evaluateHtmlFile(workspace, baseName);

    res.json({
      status: "success",
      message: "Evaluation completed",
      evaluation,
    });
  } catch (error) {
    console.error("Failed to run evaluation:", error);
    res.status(500).json({
      status: "error",
      error: error.message,
    });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 API server running at http://localhost:${PORT}`);
  console.log(`📡 Available API endpoints:`);
  console.log(`   GET /api/workspaces - Get all workspaces`);
  console.log(
    `   GET /api/workspaces/:workspace/data - Get workspace data (supports UUID-distributed storage)`
  );
  console.log(
    `   GET /api/workspaces/:workspace/data/:uuid - Get a single UUID data entry`
  );
  console.log(`   GET /api/workspaces/:workspace/html - Get the HTML file list`);
  console.log(`   GET /api/workspaces/:workspace/stats - Get workspace stats`);
  console.log(
    `   GET /api/fsm/:workspace/:fileId - Get standalone FSM JSON file data (new)`
  );
  console.log(
    `   GET /api/fsm-data/:workspace/:filename - Get FSM data embedded in HTML (legacy)`
  );
  console.log(`   GET /api/screenshots/:workspace/:filename - Get the screenshot list`);
  console.log(`   GET /api/evaluation/:workspace/:filename - Get evaluation data`);
  console.log(`   POST /api/evaluation/:workspace/:filename - Run an evaluation`);
  console.log(`   GET /api/health - Health check`);
  console.log(
    `💻 The frontend can access static files via http://localhost:${PORT}/workspace/`
  );
});

export default app;
