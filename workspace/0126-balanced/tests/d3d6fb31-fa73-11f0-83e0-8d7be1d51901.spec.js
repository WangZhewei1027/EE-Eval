import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d6fb31-fa73-11f0-83e0-8d7be1d51901.html';

// Page Object for the Ternary Search Visualizer
class VisualizerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.genBtn = page.locator('#genBtn');
    this.setTargetBtn = page.locator('#setTargetBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.stepBtn = page.locator('#stepBtn');
    this.playBtn = page.locator('#playBtn');
    this.sizeRange = page.locator('#sizeRange');
    this.sizeLabel = page.locator('#sizeLabel');
    this.modeSelect = page.locator('#modeSelect');
    this.targetInput = page.locator('#targetInput');
    this.compCount = page.locator('#compCount');
    this.iterCount = page.locator('#iterCount');
    this.resultText = page.locator('#resultText');
    this.logArea = page.locator('#logArea');
    this.arrayRow = page.locator('#arrayRow');
    this.speedRange = page.locator('#speedRange');
  }

  // Wait until initial array is rendered: at least one cell present
  async waitForInitialArray() {
    await this.page.waitForSelector('.cell');
    // Wait for the initial "Generated new array" log entry to appear
    await this.page.waitForFunction(() => {
      const log = document.getElementById('logArea');
      return log && /Generated new array/.test(log.innerText);
    });
  }

  // Get all cell elements
  async getCells() {
    return this.page.locator('.cell');
  }

  // Return array of numeric values in the rendered cells (in document order)
  async getCellValues() {
    const count = await this.getCells().count();
    const values = [];
    for (let i = 0; i < count; i++) {
      const cell = this.getCells().nth(i);
      // second child div contains the numeric value
      const valueText = await cell.locator('div').nth(1).innerText();
      values.push(Number(valueText.trim()));
    }
    return values;
  }

  // Click the generate button and wait for log + updated cells
  async generateArray() {
    await this.genBtn.click();
    await this.page.waitForFunction(() => {
      const log = document.getElementById('logArea');
      return log && /Generated new array/.test(log.innerText);
    });
    // ensure cells re-rendered
    await this.page.waitForSelector('.cell');
  }

  // Click a cell by index (0-based). This triggers setTarget via cell click.
  async clickCell(index) {
    const cells = this.getCells();
    await cells.nth(index).click();
    // flashLog is used; wait for either flash or regular log entry
    await this.page.waitForFunction((vIndex) => {
      const log = document.getElementById('logArea');
      return !!log && (log.innerText.includes('Target set to') || log.innerText.includes('» Target set'));
    }, index);
  }

  // Set target using the input field and click Set
  async setTargetByInput(value) {
    await this.targetInput.fill(String(value));
    await this.setTargetBtn.click();
    await this.page.waitForFunction((v) => {
      const log = document.getElementById('logArea');
      return !!log && log.innerText.includes('Target set to ' + v);
    }, String(value));
  }

  // Press Enter key while the target input is focused (InputTarget flow)
  async setTargetByEnter(value) {
    await this.targetInput.fill(String(value));
    await this.targetInput.press('Enter');
    await this.page.waitForFunction((v) => {
      const log = document.getElementById('logArea');
      return !!log && log.innerText.includes('Target set to ' + v);
    }, String(value));
  }

  // Click Step (single step)
  async clickStep() {
    await this.stepBtn.click();
    // give a small moment for UI updates
    await this.page.waitForTimeout(50);
  }

  // Start or pause Play
  async clickPlay() {
    await this.playBtn.click();
  }

  // Click Reset button
  async clickReset() {
    await this.resetBtn.click();
    // Reset triggers generateArray(size) which logs Generated new array...
    await this.page.waitForFunction(() => {
      const log = document.getElementById('logArea');
      return !!log && /Generated new array/.test(log.innerText);
    });
  }

  // Change mode
  async changeMode(modeValue) {
    await this.modeSelect.selectOption(modeValue);
    // mode change listener calls resetExecution which clears logArea; wait for it to be empty
    await this.page.waitForFunction(() => {
      const log = document.getElementById('logArea');
      return !!log && log.innerText.trim() === '';
    });
  }

  // Wait for the resultText to include either 'Found' or 'Not found'
  async waitForResultCompletion(timeout = 5000) {
    await this.page.waitForFunction(() => {
      const res = document.getElementById('resultText');
      return !!res && (res.innerText.includes('Found') || res.innerText.includes('Not found'));
    }, { timeout });
  }

  async getResultText() {
    return (await this.resultText.innerText()).trim();
  }

  async getCompCount() {
    return Number((await this.compCount.innerText()).trim());
  }

  async getIterCount() {
    return Number((await this.iterCount.innerText()).trim());
  }

  async getLogText() {
    return (await this.logArea.innerText()).trim();
  }

  // Get className for a particular cell index
  async getCellClass(index) {
    return await this.getCells().nth(index).getAttribute('class');
  }

  // Ensure that log contains specific substring (convenience)
  async waitForLogContains(substring, timeout = 3000) {
    await this.page.waitForFunction((s) => {
      const log = document.getElementById('logArea');
      return !!log && log.innerText.includes(s);
    }, substring, { timeout });
  }
}

test.describe('Ternary Search Visualizer — FSM and UI integration tests', () => {
  let consoleMessages = [];
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // reset tracking arrays
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages and page errors
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    // Navigate to app
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // At end of each test ensure there are no unexpected runtime errors logged to console or pageerror.
    // If there are errors we'll assert failure here to surface runtime issues.
    expect(consoleErrors, 'No console.error messages should be present during the test run').toEqual([]);
    expect(pageErrors, 'No uncaught page errors should occur during the test run').toEqual([]);
  });

  test('Initial load should generate an array and show initial state (S0_Idle -> S1_ArrayGenerated)', async ({ page }) => {
    // This test validates initial entry action generateArray(size) was executed
    const vp = new VisualizerPage(page);
    // Wait for initial generation to finish
    await vp.waitForInitialArray();

    // Validate size label and number of cells match
    const sizeLabel = Number(await vp.sizeLabel.innerText());
    const cellsCount = await vp.getCells().count();
    // sizeLabel should equal number of cells
    expect(cellsCount).toBeGreaterThanOrEqual(5);
    expect(sizeLabel).toBe(cellsCount);

    // Log should contain generation message
    const logText = await vp.getLogText();
    expect(logText).toMatch(/Generated new array \(\d+ elements\)\./);
  });

  test('Generate button triggers GenerateArray event and re-renders (GenerateArray)', async ({ page }) => {
    // Click Generate and assert new array generated and logged
    const vp = new VisualizerPage(page);
    await vp.waitForInitialArray();

    // Change size to a different value and generate
    await vp.sizeRange.fill('10'); // set via fill won't change range raw value but interacting below click will use current value; for safety set via evaluate
    await page.evaluate(() => { document.getElementById('sizeRange').value = '10'; document.getElementById('sizeRange').dispatchEvent(new Event('input')); });
    await vp.generateArray();

    const sizeLabel = Number(await vp.sizeLabel.innerText());
    const cellsCount = await vp.getCells().count();
    expect(sizeLabel).toBe(cellsCount);
    expect(cellsCount).toBe(10);

    const logText = await vp.getLogText();
    expect(logText).toMatch(/Generated new array \(10 elements\)\./);
  });

  test('Clicking a cell sets the target (S1_ArrayGenerated -> S2_TargetSet) and updates input', async ({ page }) => {
    // Validate cell click sets target, updates input and logs appropriately
    const vp = new VisualizerPage(page);
    await vp.waitForInitialArray();

    const values = await vp.getCellValues();
    expect(values.length).toBeGreaterThan(0);
    const indexToClick = Math.max(0, Math.floor(values.length / 3));

    const value = values[indexToClick];
    await vp.clickCell(indexToClick);

    const inputVal = await vp.targetInput.inputValue();
    expect(Number(inputVal)).toBe(value);

    // resultText reset to '-'
    expect(await vp.getResultText()).toBe('-');

    // Logs should mention the target set
    const logText = await vp.getLogText();
    expect(logText).toMatch(new RegExp('Target set to ' + value));
  });

  test('Entering target in input and pressing Enter triggers InputTarget flow', async ({ page }) => {
    // This validates the keydown 'Enter' triggers the set action
    const vp = new VisualizerPage(page);
    await vp.waitForInitialArray();

    const values = await vp.getCellValues();
    expect(values.length).toBeGreaterThan(1);
    const sampleValue = values[1];

    await vp.setTargetByEnter(sampleValue);

    const inputVal = await vp.targetInput.inputValue();
    expect(Number(inputVal)).toBe(sampleValue);

    const logText = await vp.getLogText();
    expect(logText).toMatch(new RegExp('Target set to ' + sampleValue));
  });

  test('Clicking Set with empty input shows a helpful flash log and does not set target (edge case)', async ({ page }) => {
    // Validate the set button handles empty input as expected (edge case)
    const vp = new VisualizerPage(page);
    await vp.waitForInitialArray();

    // Clear input if any
    await vp.targetInput.fill('');
    // Click set target when empty
    await vp.setTargetBtn.click();

    // We expect a flashLog instructing to enter a value into Target field
    await vp.waitForLogContains('Enter a value into the Target field or click a cell.');

    const logText = await vp.getLogText();
    expect(logText).toMatch(/Enter a value into the Target field or click a cell\./);

    // Ensure result text remains '-' and no target applied
    expect(await vp.getResultText()).toBe('-');
  });

  test('Stepping without setting a target prompts the user (Step event with missing target)', async ({ page }) => {
    // Validate createGenerator handles missing target (should flashLog a message)
    const vp = new VisualizerPage(page);
    await vp.waitForInitialArray();

    // Ensure target input is empty (no target)
    await vp.targetInput.fill('');
    // Click Step - stepBtn's handler will call stop(); step();
    await vp.stepBtn.click();

    // createGenerator should flash a message asking to set target
    await vp.waitForLogContains('Please set a target value first');

    const logText = await vp.getLogText();
    expect(logText).toMatch(/Please set a target value first/);

    // resultText unaffected
    expect(await vp.getResultText()).toBe('-');
  });

  test('Playing search finds an existing target (S2_TargetSet -> S3_Searching -> S4_Found)', async ({ page }) => {
    // Validate full happy path where the target exists in the array and Play completes with "Found"
    const vp = new VisualizerPage(page);
    await vp.waitForInitialArray();

    // Pick an existing value
    const values = await vp.getCellValues();
    expect(values.length).toBeGreaterThan(0);
    const pickIndex = Math.floor(values.length / 2);
    const targetValue = values[pickIndex];

    // Set target
    await vp.setTargetByInput(targetValue);

    // Click Play and wait for completion
    await vp.clickPlay();
    await vp.waitForResultCompletion(10000); // give ample time for runLoop

    const result = await vp.getResultText();
    expect(result).toMatch(/Found at index \d+/);

    // Verify the found cell has class 'found' (visual feedback)
    // Extract index mentioned in result
    const m = result.match(/Found at index (\d+)/);
    expect(m).not.toBeNull();
    const foundIdx = Number(m[1]);
    const className = await vp.getCellClass(foundIdx);
    expect(className).toContain('found');

    // Counters should be numbers greater or equal to 1
    const comparisons = await vp.getCompCount();
    const iterations = await vp.getIterCount();
    expect(iterations).toBeGreaterThanOrEqual(1);
    expect(comparisons).toBeGreaterThanOrEqual(0);

    // Log should note the found event
    const logText = await vp.getLogText();
    expect(logText).toMatch(/Found target at index|Found target/);
  });

  test('Playing search reports Not found for missing target (S2_TargetSet -> S3_Searching -> S5_NotFound)', async ({ page }) => {
    // Validate full path where target not in array => "Not found"
    const vp = new VisualizerPage(page);
    await vp.waitForInitialArray();

    const values = await vp.getCellValues();
    expect(values.length).toBeGreaterThan(0);

    // Choose a value guaranteed not to be in array: less than min value by 1
    const minValue = Math.min(...values);
    const missingTarget = minValue - 1;

    await vp.setTargetByInput(missingTarget);

    // Click Play and wait for completion
    await vp.clickPlay();
    await vp.waitForResultCompletion(10000);

    const result = await vp.getResultText();
    expect(result).toBe('Not found');

    // Log should indicate not found
    const logText = await vp.getLogText();
    expect(logText).toMatch(/Target not found|Target not found after/);
  });

  test('Switching mode resets execution state (ChangeMode event)', async ({ page }) => {
    // Validate changing mode triggers resetExecution (clears logs & resets counters)
    const vp = new VisualizerPage(page);
    await vp.waitForInitialArray();

    // Set a target to place state into S2_TargetSet
    const values = await vp.getCellValues();
    const sampleValue = values[0];
    await vp.setTargetByInput(sampleValue);

    // Do one step to create some execution state
    await vp.clickStep();
    // Ensure some log exists
    expect((await vp.getLogText()).length).toBeGreaterThan(0);

    // Change mode to recursive; this should clear the log and reset counters
    await vp.changeMode('rec');

    // After change, log should be empty, counters reset and resultText '-'
    expect((await vp.getLogText()).trim()).toBe('');
    expect(await vp.getCompCount()).toBe(0);
    expect(await vp.getIterCount()).toBe(0);
    expect(await vp.getResultText()).toBe('-');
  });

  test('Reset button regenerates array and clears target (Reset event)', async ({ page }) => {
    // Validate that Reset re-generates array, clears the target input and resets execution
    const vp = new VisualizerPage(page);
    await vp.waitForInitialArray();

    // Set a target to ensure reset clears it
    const values = await vp.getCellValues();
    const sampleValue = values[0];
    await vp.setTargetByInput(sampleValue);
    expect(Number(await vp.targetInput.inputValue())).toBe(sampleValue);

    // Click Reset
    await vp.clickReset();

    // After reset, input should be empty and resultText reset to '-'
    const inputVal = await vp.targetInput.inputValue();
    expect(inputVal).toBe('');

    expect(await vp.getResultText()).toBe('-');

    // Log should contain "Generated new array" after reset
    const logText = await vp.getLogText();
    expect(logText).toMatch(/Generated new array/);
  });
});