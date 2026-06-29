## Overview

EE-Eval treats interactivity as a machine-readable behavioral model rather than a side effect of UI generation. In this repository, that idea is implemented as a pipeline with three main stages:

1. Generate an explorable explanation as HTML.
2. Extract an FSM that captures the interaction structure of the generated interface.
3. Evaluate the generated FSM against an ideal FSM and complementary baselines.

The repository is organized for research workflows, not for shipping a single application. It includes batch generation utilities, FSM analysis scripts, Playwright baselines, visual evaluation tools, and a local API plus viewer for inspecting results.

## Installation

Requirements:

- Node.js 20 or newer
- npm
- An OpenAI-compatible API key

Install dependencies:

```bash
npm install
npx playwright install
```

Create a `.env` file in the repository root:

```bash
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
```

If you use a different provider or endpoint, keep the same environment variable names and point `OPENAI_BASE_URL` to the compatible API host.

## Generation Workflow

For a single generation task, use the interactive CLI:

```bash
node lib/add.mjs
```

Or run it with explicit arguments:

```bash
node lib/add.mjs \
  --workspace "workspace-name" \
  --model "gpt-4o-mini" \
  --question "Create an interactive bubble sort visualization" \
  --topic "Bubble Sort" \
  --enable-tests
```

For a batch run, use the main batch workflow:

```bash
node lib/batch-workflow.mjs -c 15 --html-model "gpt-4o-mini" --fsm-model "gpt-4o-mini" --playwright-model "gpt-5-mini" -w "workspace-name" -q "./question-list.json"
```

Use the single-task CLI when you want to inspect one example, debug prompts, or verify a model configuration. Use the batch workflow when you want comparable results across many concepts and models.

If you only want the ideal FSM generation path, use:

```bash
node lib/batch-workflow.mjs -c 100 --ideal-fsm -w "workspace-name" -q "./question-list.json"
```

## Evaluation and Analysis

The repository supports several evaluation layers:

- FSM similarity evaluation for the core EE-Eval framework.
- VLM-based visual evaluation for screenshots.
- Playwright baseline testing for executable behavior.
- Statistical analysis of scores and model comparisons.

Core FSM commands:

```bash
# Verify embedding setup before running similarity evaluation
node lib/test-embedding.mjs

# Run FSM similarity evaluation for a workspace
node lib/batch-similarity-eval.mjs <workspace-name>

# Recompute FSM scores with custom weights
node lib/recalculate-fsm-with-weights.mjs <workspace-name>

# Analyze cross-framework results
node lib/analyze-three-frameworks.mjs <workspace-name>

# Compare two workspaces in detail
node lib/compare-workspace-data.mjs <workspace-name>
```

For score distribution analysis:

```bash
node lib/analyze-scores.mjs workspace/<workspace-name>
```

For visual evaluation from screenshots:

```bash
node lib/capture-screenshots.mjs workspace/<workspace-name> --workers 20
node lib/vlm-evaluation.mjs -c 200 --vlm-model "gpt-4o-mini" -w "workspace-name"
```

The VLM viewer can then be opened at `vlm-viewer.html` with the workspace query parameter.

## Viewer and API

Start the local API server first:

```bash
node api.mjs
```

Then open the browser viewer:

```bash
open viewer.html
```

The API exposes workspace browsing, HTML/FSM artifact access, screenshots, and evaluation endpoints. It serves the `workspace/` directory statically so the viewer can inspect generated files locally.

Common endpoints include:

- `GET /api/workspaces`
- `GET /api/workspaces/:workspace/data`
- `GET /api/workspaces/:workspace/html`
- `GET /api/workspaces/:workspace/stats`
- `GET /api/fsm/:workspace/:fileId`
- `GET /api/screenshots/:workspace/:filename`
- `GET /api/evaluation/:workspace/:filename`
- `POST /api/evaluation/:workspace/:filename`

## Output Structure

Generated artifacts are stored under `workspace/<workspace-name>/`.

```bash
workspace/
  <workspace-name>/
    html/          # Generated HTML artifacts
    fsm/           # Extracted or ideal FSM JSON files
    tests/         # Playwright tests
    data/          # Per-run metadata and evaluation records
    visuals/       # Screenshots for visual evaluation
    test-results/   # Playwright output and reports
```

Each run writes a UUID-named HTML file, FSM JSON file, optional Playwright spec, and a metadata JSON record. The metadata captures prompts, model selection, timestamps, and evaluation state.

## Suggested Research Workflow

1. Prepare `question-list.json` and model settings.
2. Run `node lib/batch-workflow.mjs` to generate HTML, FSMs, and tests.
3. Run `node lib/validate-tests.mjs workspace/<workspace-name>` before executing tests.
4. Execute `npx playwright test workspace/<workspace-name>/tests/`.
5. Extract statistics with `node lib/extract-test-stats.mjs workspace/<workspace-name>`.
6. Run FSM similarity and analysis scripts for the paper’s evaluation tables and figures.
7. Use `node api.mjs` plus `viewer.html` to inspect artifacts interactively.

## Notes

- Prefer the batch workflow when reproducing experiments from the paper.
- Keep generated HTML and test artifacts under `workspace/` so the viewer and API can discover them.
- Use stronger models for HTML generation and lighter models for FSM/test generation when balancing cost and quality.
- Validate generated tests before running Playwright, especially for large batches.

## Related Documentation

- Playwright documentation: https://playwright.dev/
- OpenAI API documentation: https://platform.openai.com/docs/
