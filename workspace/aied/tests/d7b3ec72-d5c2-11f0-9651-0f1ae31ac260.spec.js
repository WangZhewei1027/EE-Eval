import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d7b3ec72-d5c2-11f0-9651-0f1ae31ac260.html';

// Simple page object for interacting with the Bellman-Ford visualization
class BellmanFordPage {
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.stepBtn = page.locator('#stepBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.graphInput = page.locator('#graphInput');
    this.sourceInput = page.locator('#sourceNode');
    this.log = page.locator('#log');
    this.distanceRows = page.locator('#distanceTable tbody tr');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async start() {
    await this.startBtn.click();
  }

  async step() {
    await this.stepBtn.click();
  }

  async reset() {
    await this.resetBtn.click();
  }

  async setGraphInput(value) {
    // Replace existing contents
    await this.graphInput.fill('');
    await this.graphInput.fill(value);
  }

  async setSource(value) {
    await this.sourceInput.fill('');
    await this.sourceInput.fill(value);
  }

  async getLogText() {
    return await this.log.textContent() || '';
  }

  async getDistanceTableRows() {
    return await this.distanceRows.count();
  }

  async getDistanceTableSnapshot() {
    // returns array of {node, distance}
    return await this.page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#distanceTable tbody tr'));
      return rows.map(r => {
        const tds = r.querySelectorAll('td');
        return {
          node: tds[0]?.textContent?.trim() ?? '',
          distance: tds[1]?.textContent?.trim() ?? ''
        };
      });
    });
  }

  async isStartEnabled() {
    return await this.startBtn.isEnabled();
  }

  async isStepEnabled() {
    return await this.stepBtn.isEnabled();
  }

  async isResetEnabled() {
    return await this.resetBtn.isEnabled();
  }

  async isGraphInputDisabled() {
    return await this.graphInput.evaluate((el) => el.disabled);
  }

  async isSourceInputDisabled() {
    return await this.sourceInput.evaluate((el) => el.disabled);
  }
}

test.describe('Bellman-Ford Algorithm Visualization - FSM tests', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      // collect text for assertions and debugging
      try {
        consoleMessages.push(msg.text());
      } catch {
        consoleMessages.push(String(msg));
      }
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // Ensure no unexpected page errors happened for each test
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => String(e)).join('\n')}`).toBe(0);
  });

  test('Idle state: initial render shows controls and default inputs (S0_Idle)', async ({ page }) => {
    // Validate initial idle state: controls enabled/disabled, inputs prefilled, initial draw executed
    const bf = new BellmanFordPage(page);
    await bf.goto();

    // The application sets default graphInput and sourceInput in script
    const graphValue = await page.locator('#graphInput').inputValue();
    const sourceValue = await page.locator('#sourceNode').inputValue();

    // Default values expected from the implementation
    expect(graphValue.trim().startsWith('A B 6')).toBeTruthy();
    expect(sourceValue).toBe('A');

    // Verify button states: Start enabled, Step and Reset disabled
    expect(await bf.isStartEnabled()).toBeTruthy();
    expect(await bf.isStepEnabled()).toBeFalsy();
    expect(await bf.isResetEnabled()).toBeFalsy();

    // Distance table should be populated from initial parse/draw attempt (script tries to parse at startup)
    const rows = await bf.getDistanceTableRows();
    expect(rows).toBeGreaterThan(0);

    // Log should be present (could be empty) but no uncaught exceptions must have occurred
    const logText = await bf.getLogText();
    expect(typeof logText).toBe('string');
  });

  test('StartAlgorithm transitions to AlgorithmRunning and updates UI (S1_AlgorithmRunning)', async ({ page }) => {
    // This test validates: start button triggers algorithm initialization,
    // UI controls become disabled/enabled appropriately, and logs/distance table update.
    const bf = new BellmanFordPage(page);
    await bf.goto();

    await bf.start();

    // Wait for the log to show the starting message
    await page.waitForFunction(() => {
      const log = document.getElementById('log');
      return log && log.textContent.includes('Starting Bellman-Ford algorithm with source node:');
    });

    // Verify UI flags for AlgorithmRunning
    expect(await bf.isStartEnabled()).toBeFalsy();
    expect(await bf.isStepEnabled()).toBeTruthy();
    expect(await bf.isResetEnabled()).toBeTruthy();
    expect(await bf.isGraphInputDisabled()).toBeTruthy();
    expect(await bf.isSourceInputDisabled()).toBeTruthy();

    // Verify distances table shows source node distance 0
    const table = await bf.getDistanceTableSnapshot();
    const sourceRow = table.find(r => r.node === 'A');
    expect(sourceRow).toBeDefined();
    expect(sourceRow.distance).toBe('0');

    // Check that the log includes the explicit starting message
    const logText = await bf.getLogText();
    expect(logText).toContain('Starting Bellman-Ford algorithm with source node:');
  });

  test('StepAlgorithm repeated until algorithm finishes (S2_StepAlgorithm -> S4_AlgorithmFinished)', async ({ page }) => {
    // This test steps through the algorithm until the "Algorithm finished" message appears.
    // It validates step transitions, log updates, and final disabling of the step button.
    const bf = new BellmanFordPage(page);
    await bf.goto();

    await bf.start();

    // Wait until the UI indicates running
    await page.waitForFunction(() => document.getElementById('stepBtn') && !document.getElementById('stepBtn').disabled);

    // Step repeatedly until the finished message is observed, with a safety cap to avoid infinite loop
    const finishedMessage = 'No negative weight cycles detected. Algorithm finished.';
    const maxClicks = 150; // safety cap
    let finished = false;

    for (let i = 0; i < maxClicks; i++) {
      const log = await bf.getLogText();
      if (log.includes(finishedMessage)) {
        finished = true;
        break;
      }
      // If step button is disabled unexpectedly, break to avoid further clicks
      if (!(await bf.isStepEnabled())) {
        break;
      }
      await bf.step();
      // Small wait to let UI update and logs be written
      await page.waitForTimeout(20);
    }

    // Ensure we reached finished state
    const finalLog = await bf.getLogText();
    expect(finalLog).toContain(finishedMessage);

    // Step button should now be disabled
    expect(await bf.isStepEnabled()).toBeFalsy();
  }, 120000);

  test('ResetAlgorithm returns UI to Idle (S5_Reset)', async ({ page }) => {
    // This test validates the Reset transition from a running/finished state back to idle.
    const bf = new BellmanFordPage(page);
    await bf.goto();

    await bf.start();

    // Step once to change some state
    await page.waitForFunction(() => document.getElementById('stepBtn') && !document.getElementById('stepBtn').disabled);
    await bf.step();
    await page.waitForTimeout(50);

    // Now click reset
    await bf.reset();

    // Validate UI returned to initial/idle configuration
    expect(await bf.isStartEnabled()).toBeTruthy();
    expect(await bf.isStepEnabled()).toBeFalsy();
    expect(await bf.isResetEnabled()).toBeFalsy();
    expect(await bf.isGraphInputDisabled()).toBeFalsy();
    expect(await bf.isSourceInputDisabled()).toBeFalsy();

    // Log should be cleared and distance table should be empty
    const logText = await bf.getLogText();
    expect(logText.trim()).toBe('');

    const rowsAfterReset = await bf.getDistanceTableRows();
    // The implementation clears table on reset, so expect zero rows
    expect(rowsAfterReset).toBe(0);
  });

  test('Negative cycle detection path triggers NegativeCycleDetected (S3_NegativeCycleDetected)', async ({ page }) => {
    // This test provides a graph with an explicit negative cycle and verifies detection.
    const bf = new BellmanFordPage(page);
    await bf.goto();

    // Provide a graph with a negative cycle: A -> B (1), B -> C (-2), C -> A (-2) total cycle = -3
    const negativeCycleGraph = `A B 1
B C -2
C A -2`;
    await bf.setGraphInput(negativeCycleGraph);
    await bf.setSource('A');

    // Start the algorithm
    // Capture any alert dialogs (should not appear here)
    page.on('dialog', async (dialog) => {
      // Accept any unexpected dialogs to let test continue
      await dialog.accept();
    });

    await bf.start();

    // Step until the negative cycle log message appears; safety cap to avoid infinite loop
    const negativeMsg = 'Negative weight cycle detected on edge';
    const maxSteps = 50;
    let detected = false;
    for (let i = 0; i < maxSteps; i++) {
      const log = await bf.getLogText();
      if (log.includes(negativeMsg)) {
        detected = true;
        break;
      }
      if (!(await bf.isStepEnabled())) {
        // If the step button got disabled before detection, break
        break;
      }
      await bf.step();
      await page.waitForTimeout(30);
    }

    // Validate detection occurred
    const finalLog = await bf.getLogText();
    expect(finalLog).toContain(negativeMsg);

    // Step button should be disabled after detection
    expect(await bf.isStepEnabled()).toBeFalsy();
  });

  test('Invalid input triggers parse error alert and prevents algorithm start (edge case)', async ({ page }) => {
    // This test validates error handling when the graph input cannot be parsed.
    const bf = new BellmanFordPage(page);
    await bf.goto();

    // Set a malformed line that will cause parseInputGraph to throw
    await bf.setGraphInput('this line is invalid');

    // Capture the alert dialog
    let dialogMessage = null;
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Click start - should cause an alert due to thrown error in parseInputGraph
    await bf.start();

    // Wait a short time for the dialog handler to execute
    await page.waitForTimeout(50);

    expect(dialogMessage).toBeTruthy();
    expect(dialogMessage).toContain('invalid'); // message contains information about invalid line

    // After failed start, the start button should still be enabled (algorithm did not start)
    expect(await bf.isStartEnabled()).toBeTruthy();
    expect(await bf.isStepEnabled()).toBeFalsy();
    expect(await bf.isResetEnabled()).toBeFalsy();
  });

  test('Console logs and no uncaught page errors during normal run', async ({ page }) => {
    // This test ensures that during a normal run we observe expected console/log messages
    // and that no uncaught exceptions occur.
    const bf = new BellmanFordPage(page);
    await bf.goto();

    // Start and step a few times
    await bf.start();
    await page.waitForFunction(() => document.getElementById('stepBtn') && !document.getElementById('stepBtn').disabled);

    // Step a handful of times to generate log entries
    for (let i = 0; i < 6; i++) {
      if (!(await bf.isStepEnabled())) break;
      await bf.step();
      await page.waitForTimeout(20);
    }

    // Inspect the page log for expected patterns
    const logText = await bf.getLogText();
    expect(logText).toContain('relaxing edge');

    // Ensure our captured console messages do not include fatal errors (they may include app logs)
    const fatalConsole = consoleMessages.filter(m => /error|uncaught|exception/i.test(m));
    // Allow that there might be normal console messages, but assert there are no console messages that look like an uncaught exception
    expect(fatalConsole.length).toBe(0);
  });
});