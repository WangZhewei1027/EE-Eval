import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79d8b00-d361-11f0-8438-11a56595a476.html';

/**
 * Page Object for interacting with the Prim's Algorithm demo page.
 * Encapsulates selectors and common actions used by the tests.
 */
class PrimPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.numNodes = page.locator('#numNodes');
    this.density = page.locator('#density');
    this.weightRange = page.locator('#weightRange');
    this.speed = page.locator('#speed');
    this.generateBtn = page.locator('#generateBtn');
    this.startBtn = page.locator('#startBtn');
    this.stepBtn = page.locator('#stepBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.logDiv = page.locator('#log');
    this.canvas = page.locator('#graphCanvas');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Helpers to set inputs
  async setNumNodes(value) {
    await this.numNodes.fill(String(value));
  }
  async setDensity(value) {
    await this.density.fill(String(value));
  }
  async setWeightRange(value) {
    await this.weightRange.fill(String(value));
  }
  async setSpeedValue(value) {
    // value should be the option value as string (e.g., '0', '500', '1000', '1500')
    await this.speed.selectOption(String(value));
  }

  // Actions
  async clickGenerate() {
    await this.generateBtn.click();
  }
  async clickStart() {
    await this.startBtn.click();
  }
  async clickStep() {
    await this.stepBtn.click();
  }
  async clickReset() {
    await this.resetBtn.click();
  }

  // DOM state queries
  async getLogText() {
    return (await this.logDiv.innerText()).trim();
  }
  async logContains(sub) {
    const txt = await this.getLogText();
    return txt.includes(sub);
  }

  async isStartDisabled() {
    return await this.startBtn.isDisabled();
  }
  async isStepDisabled() {
    return await this.stepBtn.isDisabled();
  }
  async isResetDisabled() {
    return await this.resetBtn.isDisabled();
  }
  async isGenerateDisabled() {
    return await this.generateBtn.isDisabled();
  }

  async canvasSize() {
    // Get actual canvas width/height attributes
    return await this.page.evaluate(() => {
      const c = document.getElementById('graphCanvas');
      return { width: c.width, height: c.height };
    });
  }

  // Utility to wait until log contains text (with timeout)
  async waitForLogContains(substr, timeout = 3000) {
    await this.page.waitForFunction(
      (s) => document.getElementById('log').innerText.includes(s),
      substr,
      { timeout }
    );
  }
}

test.describe('Prim\'s Algorithm Visualization - FSM and UI tests', () => {
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Record console messages for later assertions / debugging
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the application
    const prim = new PrimPage(page);
    await prim.goto();

    // Ensure canvas is present and page has initialized
    await expect(prim.canvas).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    // Dump console messages to test output if a test fails - used by Playwright reporter
    for (const c of consoleMessages) {
      // no-op: keeping collected console messages for debugging in test output
    }
    // Assert no uncaught page errors occurred during the test unless an individual test expects them
    expect(pageErrors.length).toBe(0);
  });

  test.describe('Initial state (S0_Idle)', () => {
    test('Initial UI - Idle state: buttons and inputs reflect S0_Idle evidence', async ({ page }) => {
      // Validate initial UI state per S0_Idle
      const prim = new PrimPage(page);

      // Buttons: start disabled if no graph, step disabled, reset disabled, generate enabled
      await expect(prim.generateBtn).toBeEnabled();
      await expect(prim.startBtn).toBeDisabled();
      await expect(prim.stepBtn).toBeDisabled();
      await expect(prim.resetBtn).toBeDisabled();

      // Log should be empty (resetUI calls clearLog)
      const logText = await prim.getLogText();
      expect(logText).toBe('');

      // Canvas should be sized
      const size = await prim.canvasSize();
      expect(size.width).toBeGreaterThan(0);
      expect(size.height).toBeGreaterThan(0);
    });
  });

  test.describe('GenerateGraph (S0_Idle -> S1_GraphGenerated)', () => {
    test('Click Generate Graph produces a graph, logs generation message and enables Start', async ({ page }) => {
      const prim = new PrimPage(page);

      // Change inputs to deterministic valid values
      await prim.setNumNodes(6);
      await prim.setDensity(50);
      await prim.setWeightRange(10);

      // Click generate and wait for the generation log entry
      await prim.clickGenerate();
      await prim.waitForLogContains('Graph generated with', 2000);

      // Evidence: log mentions generated graph
      const logText = await prim.getLogText();
      expect(logText).toMatch(/Graph generated with \d+ nodes and \d+ edges\./);

      // Buttons per S1 evidence
      await expect(prim.startBtn).toBeEnabled();
      await expect(prim.stepBtn).toBeDisabled();
      await expect(prim.resetBtn).toBeDisabled();
    });

    test('Generating twice clears previous log and re-generates single fresh log entry', async ({ page }) => {
      const prim = new PrimPage(page);

      // First generate
      await prim.clickGenerate();
      await prim.waitForLogContains('Graph generated with', 2000);

      // Second generate - should clear log and replace with a single "Graph generated..." line
      await prim.clickGenerate();
      await prim.waitForLogContains('Graph generated with', 2000);

      const log = await prim.getLogText();
      // Ensure only one "Graph generated" exists (generate() calls clearLog before logging)
      const occurrences = (log.match(/Graph generated with/g) || []).length;
      expect(occurrences).toBe(1);

      // Start button enabled, step/reset disabled
      await expect(prim.startBtn).toBeEnabled();
      await expect(prim.stepBtn).toBeDisabled();
      await expect(prim.resetBtn).toBeDisabled();
    });

    test('Edge-case: invalid numNodes input triggers alert dialog (error scenario)', async ({ page }) => {
      const prim = new PrimPage(page);
      // Set an invalid node count (<3)
      await prim.setNumNodes(2);

      // Listen for dialog and assert its message
      const dialogPromise = page.waitForEvent('dialog');
      await prim.clickGenerate();
      const dialog = await dialogPromise;
      expect(dialog.type()).toBe('alert');
      const msg = dialog.message();
      expect(msg).toContain('Number of nodes must be between 3 and 20.');
      await dialog.accept();
    });

    test('Edge-case: invalid density input triggers alert dialog (error scenario)', async ({ page }) => {
      const prim = new PrimPage(page);
      await prim.setNumNodes(5); // valid
      await prim.setDensity(5); // invalid, <10

      const dialogPromise = page.waitForEvent('dialog');
      await prim.clickGenerate();
      const dialog = await dialogPromise;
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toContain('Density must be between 10% and 100%.');
      await dialog.accept();
    });

    test('Edge-case: invalid weight input triggers alert dialog (error scenario)', async ({ page }) => {
      const prim = new PrimPage(page);
      await prim.setNumNodes(5);
      await prim.setDensity(50);
      await prim.setWeightRange(0); // invalid <1

      const dialogPromise = page.waitForEvent('dialog');
      await prim.clickGenerate();
      const dialog = await dialogPromise;
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toContain('Max weight must be between 1 and 100.');
      await dialog.accept();
    });
  });

  test.describe('StartAlgorithm (S1_GraphGenerated -> S2_AlgorithmRunning) and stepping', () => {
    test('Start Prim (manual mode) initializes iterator, updates buttons and produces initial logs', async ({ page }) => {
      const prim = new PrimPage(page);

      // Generate first to reach S1
      await prim.clickGenerate();
      await prim.waitForLogContains('Graph generated with', 2000);

      // Switch to manual stepping (speed = '0') so automatic timer is not started
      await prim.setSpeedValue('0');

      // Start algorithm - this should clear the log and produce Start logs from generator
      await prim.clickStart();

      // After start, verify button states per S2 evidence (manual mode => step enabled)
      await expect(prim.startBtn).toBeDisabled();
      await expect(prim.generateBtn).toBeDisabled();
      await expect(prim.resetBtn).toBeEnabled();
      await expect(prim.stepBtn).toBeEnabled();

      // The generator's first yield logs "Start at node 0."
      await prim.waitForLogContains('Start at node', 2000);
      const logText = await prim.getLogText();
      expect(logText).toContain('Start at node');
      expect(logText).toContain('Add edges adjacent to node');
    });

    test('Stepping through algorithm eventually finishes and transitions to S3_AlgorithmFinished', async ({ page }) => {
      const prim = new PrimPage(page);

      // Generate graph and set manual mode
      await prim.clickGenerate();
      await prim.waitForLogContains('Graph generated with', 2000);
      await prim.setSpeedValue('0');

      // Start prim
      await prim.clickStart();

      // Step until finished. We guard with a max iterations to avoid infinite loops.
      const maxSteps = 200;
      let finished = false;
      for (let i = 0; i < maxSteps; i++) {
        // Click step and allow UI to process
        await prim.clickStep();
        // Wait briefly for drawing/log updates
        await page.waitForTimeout(25);

        if (await prim.logContains('Algorithm finished.') || (await prim.isStepDisabled() && !(await prim.isStartDisabled()) === false)) {
          // If the explicit 'Algorithm finished.' log appears OR step becomes disabled and generate enabled (final state evidence),
          // consider algorithm finished.
          if (await prim.logContains('Algorithm finished.')) {
            finished = true;
            break;
          }
        }
      }

      expect(finished).toBeTruthy();

      // Final UI evidence per S3: step disabled, start disabled, reset enabled, generate enabled
      await expect(prim.stepBtn).toBeDisabled();
      await expect(prim.startBtn).toBeDisabled();
      await expect(prim.resetBtn).toBeEnabled();
      await expect(prim.generateBtn).toBeEnabled();

      // Also final drawGraph(res.value) would have been called and log contains completion
      const finalLog = await prim.getLogText();
      expect(finalLog).toMatch(/Algorithm finished\.|Prim's Algorithm completed\.|Prim' s Algorithm completed\./);
      // Ensure MST completion message present
      expect(finalLog).toContain('Prim\'s Algorithm completed.').or.toContain('Algorithm finished.');
    });

    test('Reset after running returns UI to Idle-like/graph-present state per resetUI semantics', async ({ page }) => {
      const prim = new PrimPage(page);

      await prim.clickGenerate();
      await prim.waitForLogContains('Graph generated with', 2000);
      await prim.setSpeedValue('0');
      await prim.clickStart();

      // Ensure running state
      await expect(prim.startBtn).toBeDisabled();
      await expect(prim.resetBtn).toBeEnabled();

      // Click reset - this should call resetUI and clear iterator/timers
      await prim.clickReset();

      // After reset, resetUI sets: startBtn.disabled = !graph (graph exists), stepBtn.disabled = true, resetBtn.disabled = true, generateBtn.disabled = false
      await expect(prim.startBtn).toBeEnabled();
      await expect(prim.stepBtn).toBeDisabled();
      await expect(prim.resetBtn).toBeDisabled();
      await expect(prim.generateBtn).toBeEnabled();

      // Log cleared by resetUI
      const logText = await prim.getLogText();
      expect(logText).toBe('');
    });
  });

  test.describe('Edge cases, robustness and console/exception observation', () => {
    test('No unexpected uncaught exceptions on load + interaction sequence', async ({ page }) => {
      const prim = new PrimPage(page);

      // Perform a sequence of interactions that exercises many code paths
      // 1) Generate
      await prim.clickGenerate();
      await prim.waitForLogContains('Graph generated with', 2000);

      // 2) Start in auto mode (default speed is 1000) to ensure timers are created & cleaned safely
      await prim.setSpeedValue('1000');
      await prim.clickStart();

      // Wait briefly to let automatic advancement occur at least once (but avoid long waits)
      await page.waitForTimeout(1100);

      // Pause by switching to manual and stepping a few times (user could do this)
      await prim.setSpeedValue('0');
      // If step button was disabled due to auto-play, it should now be enabled because startPrim does not re-enable it when speed changes.
      // But we still attempt safe interactions: click step if enabled.
      if (!(await prim.stepBtn.isDisabled())) {
        await prim.clickStep();
      }

      // Reset to ensure timer cleanup path is exercised
      await prim.clickReset();

      // After these interactions, assert there were no uncaught page errors collected by beforeEach/afterEach
      // The afterEach will assert pageErrors.length === 0, so no further assertion required here.
      expect(true).toBeTruthy(); // placeholder assertion to mark test as passed if no errors thrown
    });

    test('Verify canvas remains present and sized after many interactions (drawGraph calls)', async ({ page }) => {
      const prim = new PrimPage(page);

      await prim.clickGenerate();
      await prim.waitForLogContains('Graph generated with', 2000);

      // Trigger multiple start/step/reset cycles to exercise drawGraph and UI painting
      for (let i = 0; i < 3; i++) {
        await prim.setSpeedValue('0');
        await prim.clickStart();

        // Perform a small number of manual steps to exercise drawing code
        const steps = 3;
        for (let s = 0; s < steps; s++) {
          if (!(await prim.stepBtn.isDisabled())) {
            await prim.clickStep();
            await page.waitForTimeout(20);
          } else {
            break;
          }
        }
        await prim.clickReset();
      }

      const size = await prim.canvasSize();
      expect(size.width).toBeGreaterThan(0);
      expect(size.height).toBeGreaterThan(0);
    });
  });
});