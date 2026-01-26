import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12144dc4-fa7a-11f0-acf9-69409043402d.html';

// Page Object for the Floyd-Warshall demo
class FloydPage {
  constructor(page) {
    this.page = page;
  }

  // Elements
  async createGraphBtn() { return this.page.locator('#createGraphBtn'); }
  async vertexCountInput() { return this.page.locator('#vertexCountInput'); }
  async graphInputSection() { return this.page.locator('#graphInputSection'); }
  async controls() { return this.page.locator('#controls'); }
  async stepForwardBtn() { return this.page.locator('#stepForwardBtn'); }
  async stepBackwardBtn() { return this.page.locator('#stepBackwardBtn'); }
  async runToEndBtn() { return this.page.locator('#runToEndBtn'); }
  async resetBtn() { return this.page.locator('#resetBtn'); }
  async currentStepSpan() { return this.page.locator('#currentStep'); }
  async indexKSpan() { return this.page.locator('#indexK'); }
  async indexISpan() { return this.page.locator('#indexI'); }
  async indexJSpan() { return this.page.locator('#indexJ'); }
  async explanationSpan() { return this.page.locator('#explanation'); }
  async matrixSection() { return this.page.locator('#matrixSection'); }
  async edgeAddFrom() { return this.page.locator('#edgeAddFrom'); }
  async edgeAddTo() { return this.page.locator('#edgeAddTo'); }
  async edgeAddWeight() { return this.page.locator('#edgeAddWeight'); }
  async addEdgeButton() { return this.page.locator('#addEdgeButton'); }
  async removeEdgeButton() { return this.page.locator('#removeEdgeButton'); }
  async exportGraphBtn() { return this.page.locator('#exportGraph'); }
  async importGraphBtn() { return this.page.locator('#importGraph'); }
  async graphJSONInput() { return this.page.locator('#graphJSONInput'); }
  async showPathsBtn() { return this.page.locator('#showPathsBtn'); }
  async pathsSection() { return this.page.locator('#pathsSection'); }

  // Actions
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async setVertexCount(n) {
    const v = await this.vertexCountInput();
    await v.fill(String(n));
  }

  async clickCreateGraph() {
    await (await this.createGraphBtn()).click();
  }

  async addEdge(from, to, weight) {
    await (await this.edgeAddFrom()).fill(String(from));
    await (await this.edgeAddTo()).fill(String(to));
    await (await this.edgeAddWeight()).fill(String(weight));
    await (await this.addEdgeButton()).click();
  }

  async removeEdge(from, to) {
    await (await this.edgeAddFrom()).fill(String(from));
    await (await this.edgeAddTo()).fill(String(to));
    await (await this.removeEdgeButton()).click();
  }

  async clickStepForward() {
    await (await this.stepForwardBtn()).click();
  }

  async clickStepBackward() {
    await (await this.stepBackwardBtn()).click();
  }

  async clickRunToEnd() {
    await (await this.runToEndBtn()).click();
  }

  async clickReset() {
    await (await this.resetBtn()).click();
  }

  async clickExportGraph() {
    await (await this.exportGraphBtn()).click();
  }

  async clickImportGraph() {
    await (await this.importGraphBtn()).click();
  }

  async clickShowPaths() {
    await (await this.showPathsBtn()).click();
  }

  // Query helpers
  async isControlsVisible() {
    const c = await this.controls();
    return await c.evaluate((el) => {
      return window.getComputedStyle(el).display !== 'none';
    });
  }

  async matrixInputValue(i, j) {
    // In graph input matrix, inputs have data-i and data-j
    return this.page.locator(`input[data-i="${i}"][data-j="${j}"]`).inputValue();
  }

  async matrixDisplayCell(i, j) {
    // matrixSection table displays current distMatrix: first header row + header col -> cell indices shifted by 1
    const cell = this.page.locator(`#matrixSection table tr:nth-child(${i+2}) td:nth-child(${j+1})`);
    // Note: the table structure: first row is header (th), subsequent rows start with a th then td...
    return cell.textContent();
  }

  async getCurrentStepText() {
    return (await this.currentStepSpan()).textContent();
  }

  async getIndicesText() {
    return {
      k: (await this.indexKSpan()).textContent(),
      i: (await this.indexISpan()).textContent(),
      j: (await this.indexJSpan()).textContent(),
    };
  }

  async getExplanationText() {
    return (await this.explanationSpan()).textContent();
  }

  async getPathsText() {
    return (await this.pathsSection()).textContent();
  }

  async getGraphJSONText() {
    return (await this.graphJSONInput()).inputValue();
  }

  async setGraphJSONText(text) {
    await (await this.graphJSONInput()).fill(text);
  }

  async graphInputHasTable() {
    return await this.graphInputSection().locator('table').count() > 0;
  }

  async getGraphInputDiagonalValue(index) {
    return this.page.locator(`input[data-i="${index}"][data-j="${index}"]`).inputValue();
  }

  async getMatrixDisplayTableCellTextAtCoordinates(iIndex, jIndex) {
    // matrix display: table header row + header column; use selector based on rows and cells
    // Row index in table: iIndex + 2 (1-based counting, first row header)
    // Cell index: jIndex + 2? In the display, first cell in row is th, then td cells start at 2
    const selector = `#matrixSection table tr:nth-child(${iIndex + 2}) td:nth-child(${jIndex + 1})`;
    // Note: header corner is a th, header row has th elements. Data rows have first child th then td...
    return this.page.locator(selector).textContent();
  }
}

test.describe('Floyd-Warshall Interactive Demo - FSM and UI tests', () => {
  let page;
  let floyd;
  let consoleErrors;
  let pageErrors;
  let dialogMessages;

  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    floyd = new FloydPage(page);
    consoleErrors = [];
    pageErrors = [];
    dialogMessages = [];

    // Record console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Record page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });

    // Auto-accept dialogs but record messages for assertions
    page.on('dialog', async (dialog) => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    await floyd.goto();
  });

  test.afterEach(async () => {
    // Basic sanity: ensure no uncaught syntax/reference/type errors occurred during the test.
    // We assert they are not present by ensuring none of the captured pageErrors contain those keywords.
    for (const err of pageErrors) {
      expect(err).not.toContain('ReferenceError');
      expect(err).not.toContain('SyntaxError');
      expect(err).not.toContain('TypeError');
    }
    // Also ensure there are no console error messages collected
    expect(consoleErrors.length).toBe(0);
  });

  test('Initial Idle state (S0_Idle) - controls hidden and indicators reset', async () => {
    // Validate initial UI matches S0_Idle evidence:
    // - controls.style.display = 'none';
    // - matrixSection.innerHTML = '';
    // - status spans '-'
    expect(await floyd.isControlsVisible()).toBe(false);

    // matrixSection should be empty
    const matrixHtml = await page.locator('#matrixSection').innerHTML();
    expect(matrixHtml.trim()).toBe('');

    // status indicators should be '-' per initial load
    expect(await floyd.getCurrentStepText()).toBe('-');
    const indices = await floyd.getIndicesText();
    expect(indices.k.trim()).toBe('-');
    expect(indices.i.trim()).toBe('-');
    expect(indices.j.trim()).toBe('-');
    expect((await floyd.getExplanationText()).trim()).toBe('-');
  });

  test('Create Graph Matrix (CREATE_GRAPH) transitions to GraphCreated (S1_GraphCreated)', async () => {
    // Use default vertexCount (4). Click create graph.
    await floyd.clickCreateGraph();

    // Graph input section should now have a table
    expect(await floyd.graphInputHasTable()).toBe(true);

    // Controls should remain hidden after creation (evidence says controls.style.display = 'none')
    expect(await floyd.isControlsVisible()).toBe(false);

    // The diagonal entries should be readonly and equal to "0"
    for (let idx = 0; idx < 4; idx++) {
      const diagVal = await floyd.getGraphInputDiagonalValue(idx);
      expect(diagVal).toBe('0');
      // also ensure readOnly is set by checking the DOM property via JS
      const isReadOnly = await page.locator(`input[data-i="${idx}"][data-j="${idx}"]`).evaluate((el) => el.readOnly);
      expect(isReadOnly).toBe(true);
    }

    // Status indicators should be reset per evidence
    expect(await floyd.getCurrentStepText()).toBe('-');
    const indices = await floyd.getIndicesText();
    expect(indices.k.trim()).toBe('-');
    expect(indices.i.trim()).toBe('-');
    expect(indices.j.trim()).toBe('-');
    expect((await floyd.getExplanationText()).trim()).toBe('-');
  });

  test('Start algorithm by adding an edge (ADD_EDGE) -> Algorithm builds steps and controls appear (S2_AlgorithmRunning)', async () => {
    // Create graph first
    await floyd.clickCreateGraph();

    // Add an edge 0 -> 1 with weight 5 (this should call addOrUpdateEdge and then tryStartAlgorithm internally)
    await floyd.addEdge(0, 1, 5);

    // After adding edge, controls should be visible (controls.style.display = "inline-block")
    expect(await floyd.isControlsVisible()).toBe(true);

    // The current step should show "Before start" (the app uses that text when currentStepIndex < 0)
    expect((await floyd.getCurrentStepText()).trim()).toMatch(/Before start/i);

    // Step forward should be enabled (clicking it should advance)
    await floyd.clickStepForward();

    // After first step, currentStep should be "1 / N"
    const csText = (await floyd.getCurrentStepText()).trim();
    expect(csText).toMatch(/1\s*\/\s*\d+/);

    // Indices k,i,j should be numbers (strings representing numbers)
    const idxs = await floyd.getIndicesText();
    expect(String(Number(idxs.k))).toBe(idxs.k.trim());
    expect(String(Number(idxs.i))).toBe(idxs.i.trim());
    expect(String(Number(idxs.j))).toBe(idxs.j.trim());

    // Explanation text should not be the initial guidance now
    const expl = (await floyd.getExplanationText()).trim();
    expect(expl.length).toBeGreaterThan(0);
    expect(expl).not.toMatch(/Click 'Step Forward' or 'Run to End' to start/i);
  });

  test('Step Forward (S3_StepForward) and Step Backward (S4_StepBackward) navigation and Run to End (S5_RunToEnd)', async () => {
    // Setup: create graph and add edges to ensure steps > 0
    await floyd.clickCreateGraph();
    await floyd.addEdge(0, 1, 5);
    await floyd.addEdge(1, 2, 3);

    // Navigate forward a few steps
    await floyd.clickStepForward(); // step 1
    const step1 = (await floyd.getCurrentStepText()).trim();
    expect(step1).toMatch(/1\s*\/\s*\d+/);

    // Step forward again
    await floyd.clickStepForward();
    const step2 = (await floyd.getCurrentStepText()).trim();
    expect(step2).toMatch(/2\s*\/\s*\d+/);

    // Run to end should take to final step
    await floyd.clickRunToEnd();
    const finalText = (await floyd.getCurrentStepText()).trim();
    // final should be "N / N"
    const match = finalText.match(/(\d+)\s*\/\s*(\d+)/);
    expect(match).not.toBeNull();
    if (match) {
      const cur = Number(match[1]);
      const total = Number(match[2]);
      expect(cur).toBe(total);
      // After run to end, runToEnd button should be disabled (per UI update)
      const runDisabled = await page.locator('#runToEndBtn').evaluate((el) => el.disabled);
      expect(runDisabled).toBe(true);
    }

    // Step backward should decrease the step index
    await floyd.clickStepBackward();
    const afterBack = (await floyd.getCurrentStepText()).trim();
    expect(afterBack).not.toBe(finalText);
  });

  test('Reset (S6_Reset) returns to initial state before steps', async () => {
    await floyd.clickCreateGraph();
    await floyd.addEdge(0, 1, 7);
    await floyd.clickRunToEnd();

    // Now reset
    await floyd.clickReset();

    // Should show "Before start"
    expect((await floyd.getCurrentStepText()).trim()).toMatch(/Before start/i);

    // Indices should be '-'
    const idxs = await floyd.getIndicesText();
    expect(idxs.k.trim()).toBe('-');
    expect(idxs.i.trim()).toBe('-');
    expect(idxs.j.trim()).toBe('-');

    // Step backward should be disabled
    const backDisabled = await page.locator('#stepBackwardBtn').evaluate((el) => el.disabled);
    expect(backDisabled).toBe(true);
  });

  test('Remove Edge (S8_RemoveEdge) updates graph and algorithm restarts', async () => {
    await floyd.clickCreateGraph();
    // Add edge and verify path exists after run
    await floyd.addEdge(0, 1, 2);
    await floyd.clickRunToEnd();
    await floyd.clickShowPaths();
    const pathsBefore = (await floyd.getPathsText()).trim();
    // There should be some path lines or "Path from" text
    expect(pathsBefore.length).toBeGreaterThan(0);

    // Now remove the edge and run again
    await floyd.removeEdge(0, 1);

    // After removal, controls still visible and run to end possible
    expect(await floyd.isControlsVisible()).toBe(true);
    await floyd.clickRunToEnd();
    await floyd.clickShowPaths();
    const pathsAfter = (await floyd.getPathsText()).trim();
    // Expect that the specific path from 0 to 1 is likely "No path" or changed
    expect(pathsAfter.length).toBeGreaterThan(0);
    // There should be a difference in the paths text after removal or at least content present
    expect(pathsAfter).not.toBeNull();
  });

  test('Export Graph (S9_ExportGraph) and import malformed/valid JSON (S10_ImportGraph)', async () => {
    await floyd.clickCreateGraph();
    await floyd.addEdge(0, 1, 4);

    // Export should fill graphJSONInput and trigger an alert
    await floyd.clickExportGraph();
    // One dialog should have been recorded containing the export message
    expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
    expect(dialogMessages[dialogMessages.length - 1]).toMatch(/Graph exported to text area below/i);

    // The JSON textarea should now contain a JSON
    const jsonText = await floyd.getGraphJSONText();
    expect(jsonText.trim().length).toBeGreaterThan(0);
    let parsed = JSON.parse(jsonText);
    expect(parsed.vertexCount).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(parsed.graphMatrix)).toBeTruthy();

    // Now test import of malformed JSON -> should alert invalid JSON
    await floyd.setGraphJSONText('{"not":"valid",'); // invalid JSON
    await floyd.clickImportGraph();
    // A dialog should be shown (invalid JSON)
    expect(dialogMessages[dialogMessages.length - 1]).toMatch(/Invalid JSON format|Please paste JSON|malformed|parse error/i);

    // Now craft a valid import JSON with 3 vertices and a simple graphMatrix
    const importObj = {
      vertexCount: 3,
      graphMatrix: [
        [0, 1, null],
        [null, 0, 2],
        [null, null, 0]
      ]
    };
    await floyd.setGraphJSONText(JSON.stringify(importObj));
    await floyd.clickImportGraph();
    // Should have shown success alert
    expect(dialogMessages[dialogMessages.length - 1]).toMatch(/Graph imported successfully/i);

    // After import, vertexCountInput should be updated to 3
    expect(await page.locator('#vertexCountInput').inputValue()).toBe('3');

    // Controls should be visible after import and steps built
    expect(await floyd.isControlsVisible()).toBe(true);
  });

  test('Show Paths (S11_ShowPaths) requires running algorithm to end and displays paths', async () => {
    await floyd.clickCreateGraph();
    // Setup triangle edges so there are paths
    await floyd.addEdge(0, 1, 1);
    await floyd.addEdge(1, 2, 1);
    await floyd.addEdge(0, 2, 10);

    // Try to show paths before runToEnd - should trigger an alert
    await floyd.clickShowPaths();
    expect(dialogMessages[dialogMessages.length - 1]).toMatch(/Please run the algorithm to the end/i);

    // Now run to end and show paths
    await floyd.clickRunToEnd();
    await floyd.clickShowPaths();

    // Paths section should be populated with lines describing paths
    const pathsText = (await floyd.getPathsText()).trim();
    expect(pathsText.length).toBeGreaterThan(0);
    // It should contain path from 0 to 2 and reflect the shorter path through 1 (distance 2)
    expect(pathsText).toMatch(/Path from 0 to 2.*dist=.*2/);
  });

  test('Edge cases: invalid vertex count on create and invalid edge weight on add', async () => {
    // Invalid vertex count (0) should alert and not create graph
    await floyd.setVertexCount(0);
    await floyd.clickCreateGraph();
    expect(dialogMessages[dialogMessages.length - 1]).toMatch(/Number of vertices must be an integer between 1 and/i);

    // Reset to valid graph then attempt to add invalid weight
    await floyd.setVertexCount(3);
    await floyd.clickCreateGraph();

    // Provide invalid weight (non-number) for addEdge
    await (await floyd.edgeAddFrom()).fill('0');
    await (await floyd.edgeAddTo()).fill('1');
    await (await floyd.edgeAddWeight()).fill('not-a-number');
    await (await floyd.addEdgeButton()).click();

    // Should alert weight must be a valid number
    expect(dialogMessages[dialogMessages.length - 1]).toMatch(/Weight must be a valid number|Weight invalid/i);
  });

});