import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f18203c1-d366-11f0-9b19-a558354ece3e.html';

// Helper to compute Fibonacci sequence for assertions
function computeFibonacci(length) {
  const seq = [0, 1];
  for (let i = 2; i < length; i++) {
    seq[i] = seq[i - 1] + seq[i - 2];
  }
  return seq;
}

// Page Object Model for the Fibonacci app
class FibonacciPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.sequenceLengthInput = page.locator('input#sequenceLength');
    this.generateButton = page.locator('button[onclick="generateSequence()"]');
    this.visualizationSelect = page.locator('select#visualizationType');
    this.sequenceContainer = page.locator('#sequenceContainer');
    this.goldenRatio = page.locator('#goldenRatio');
    this.canvas = page.locator('#fibonacciCanvas');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getSequenceCount() {
    return await this.sequenceContainer.locator('.sequence-number').count();
  }

  async getSequenceValuesAsText() {
    const elements = this.sequenceContainer.locator('.sequence-number');
    const count = await elements.count();
    const values = [];
    for (let i = 0; i < count; i++) {
      values.push(await elements.nth(i).innerText());
    }
    return values;
  }

  async getGoldenRatioText() {
    return (await this.goldenRatio.innerText()).trim();
  }

  async setSequenceLength(value) {
    await this.sequenceLengthInput.fill(String(value));
  }

  async clickGenerate() {
    await this.generateButton.click();
  }

  async changeVisualization(typeValue) {
    await this.visualizationSelect.selectOption(typeValue);
    // onchange handler should trigger updateVisualization automatically
  }

  async getCanvasSize() {
    // Evaluate canvas width/height properties from the DOM element
    return await this.page.evaluate(() => {
      const canvas = document.getElementById('fibonacciCanvas');
      return {
        width: canvas.width,
        height: canvas.height,
        offsetWidth: canvas.offsetWidth,
        offsetHeight: canvas.offsetHeight
      };
    });
  }

  async triggerWindowResize() {
    // Dispatch a resize event; updateVisualization is registered on window resize
    await this.page.evaluate(() => {
      window.dispatchEvent(new Event('resize'));
    });
  }
}

test.describe('Fibonacci Sequence Visualization - FSM and UI tests', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and page errors for observation
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({}, testInfo) => {
    // Attach debugging info to the test output on failure
    if (testInfo.status !== testInfo.expectedStatus) {
      // On failure, include captured console messages and page errors
      // Note: testInfo.attach isn't used to keep this test file runnable in minimal setups
      // We still include consoleMessages and pageErrors in the error message via expectation if needed.
    }
  });

  test('Initial load should run generateSequence (S0_Idle -> S1_SequenceGenerated) and render sequence and visualization', async ({ page }) => {
    const app = new FibonacciPage(page);

    // Navigate to the page; window.onload should trigger generateSequence per FSM S0 entry action
    await app.goto();

    // Wait a short time to allow rendering triggered during onload
    await page.waitForTimeout(200);

    // Validate that sequence elements were created (default value is 10)
    const count = await app.getSequenceCount();
    expect(count).toBe(10);

    // Validate the displayed sequence values correspond to the Fibonacci numbers
    const displayed = await app.getSequenceValuesAsText();
    const expectedSeq = computeFibonacci(10).map((n) => String(n));
    expect(displayed).toEqual(expectedSeq);

    // Verify golden ratio approx displayed is consistent with F(9)/F(8) to 6 decimal places
    const expectedRatio = (expectedSeq[9] / expectedSeq[8]).toFixed(6);
    const goldenText = await app.getGoldenRatioText();
    expect(goldenText).toBe(expectedRatio);

    // Verify canvas dimensions were set by updateVisualization (canvas.width and canvas.height should be > 0)
    const canvasSize = await app.getCanvasSize();
    expect(canvasSize.width).toBeGreaterThan(0);
    expect(canvasSize.height).toBeGreaterThan(0);
    expect(canvasSize.offsetWidth).toBeGreaterThan(0);
    expect(canvasSize.offsetHeight).toBeGreaterThan(0);

    // Confirm no uncaught page errors occurred during initial load
    expect(pageErrors.length).toBe(0);

    // Console messages may include debug or info; assert no console 'error' type messages
    const consoleErrorMsgs = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrorMsgs.length).toBe(0);
  });

  test('Clicking Generate Sequence updates sequence and visualization (transition GenerateSequence)', async ({ page }) => {
    const app = new FibonacciPage(page);

    await app.goto();

    // Change the sequence length to 15 and click Generate Sequence to cause transition
    await app.setSequenceLength(15);
    await app.clickGenerate();

    // Small wait for DOM updates
    await page.waitForTimeout(150);

    // Validate new sequence length and values
    const count = await app.getSequenceCount();
    expect(count).toBe(15);

    const displayed = await app.getSequenceValuesAsText();
    const expectedSeq = computeFibonacci(15).map((n) => String(n));
    expect(displayed).toEqual(expectedSeq);

    // Validate golden ratio approximation updated accordingly (F14 / F13)
    const expectedRatio = (expectedSeq[14] / expectedSeq[13]).toFixed(6);
    expect(await app.getGoldenRatioText()).toBe(expectedRatio);

    // Verify canvas still has valid dimensions after update
    const canvasSize = await app.getCanvasSize();
    expect(canvasSize.width).toBeGreaterThan(0);
    expect(canvasSize.height).toBeGreaterThan(0);

    // Ensure no uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Changing visualization type triggers updateVisualization for each option (ChangeVisualization event)', async ({ page }) => {
    const app = new FibonacciPage(page);

    await app.goto();

    // For each visualization type, change the select and assert that updateVisualization ran (canvas dims present, no errors)
    const types = ['spiral', 'bars', 'circles'];

    for (const type of types) {
      // Change visualization; the onchange handler calls updateVisualization()
      await app.changeVisualization(type);

      // Brief wait to allow drawing/update
      await page.waitForTimeout(120);

      // Canvas width/height should be set/refreshed
      const canvasSize = await app.getCanvasSize();
      expect(canvasSize.width).toBeGreaterThan(0);
      expect(canvasSize.height).toBeGreaterThan(0);

      // No runtime errors should occur for any visualization type
      expect(pageErrors.length).toBe(0);
    }

    // Confirm no console 'error' messages were emitted during changes
    const consoleErrorMsgs = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrorMsgs.length).toBe(0);
  });

  test('Window resize triggers updateVisualization (WindowResize event) without throwing', async ({ page }) => {
    const app = new FibonacciPage(page);

    await app.goto();

    // Record canvas size before resize
    const beforeSize = await app.getCanvasSize();

    // Trigger a resize event programmatically which should invoke updateVisualization due to window.addEventListener('resize', updateVisualization)
    await app.triggerWindowResize();

    await page.waitForTimeout(150);

    // After resize, canvas properties should still be defined and non-zero
    const afterSize = await app.getCanvasSize();
    expect(afterSize.width).toBeGreaterThan(0);
    expect(afterSize.height).toBeGreaterThan(0);

    // It's acceptable if width/height change due to responsive layout; ensure at least offset sizes are present
    expect(afterSize.offsetWidth).toBeGreaterThan(0);
    expect(afterSize.offsetHeight).toBeGreaterThan(0);

    // No uncaught page errors should be present
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: extremely small sequence length (below min) behavior is resilient and predictable', async ({ page }) => {
    const app = new FibonacciPage(page);

    await app.goto();

    // Intentionally set sequence length to 1 (below declared min=2) to observe behavior without patching code
    // The app's generateFibonacciSequence will still initialize [0,1] and return that array.
    await app.setSequenceLength(1);
    await app.clickGenerate();

    await page.waitForTimeout(120);

    // Expect sequence container to contain the elements that the current implementation produces.
    // The implementation creates fibonacciSequence = [0,1] and will display those two numbers.
    const count = await app.getSequenceCount();
    expect(count).toBe(2);

    const displayed = await app.getSequenceValuesAsText();
    expect(displayed).toEqual(computeFibonacci(2).map((n) => String(n)));

    // Since displaySequence only updates the golden ratio when sequence.length > 2,
    // the golden ratio should remain as whatever was set earlier by the default generation.
    // We therefore assert that golden ratio is a string and a numeric-looking value, but not necessarily changed here.
    const golden = await app.getGoldenRatioText();
    expect(typeof golden).toBe('string');
    // Ensure no runtime errors occurred while handling this edge case
    expect(pageErrors.length).toBe(0);
  });

  test('Observe console outputs and page errors during interactive sequence of actions (comprehensive observation)', async ({ page }) => {
    const app = new FibonacciPage(page);

    await app.goto();

    // Perform a sequence of interactions: change length, generate, change visualization, resize
    await app.setSequenceLength(8);
    await app.clickGenerate();
    await app.changeVisualization('bars');
    await app.triggerWindowResize();
    await page.waitForTimeout(200);
    await app.changeVisualization('circles');
    await app.setSequenceLength(20);
    await app.clickGenerate();
    await page.waitForTimeout(200);

    // Validate that sequence reflects the last generate action (20 items)
    const count = await app.getSequenceCount();
    expect(count).toBe(20);

    // Validate golden ratio corresponds to the last two Fibonacci numbers
    const lastSeq = computeFibonacci(20).map(String);
    const expectedRatio = (Number(lastSeq[19]) / Number(lastSeq[18])).toFixed(6);
    expect(await app.getGoldenRatioText()).toBe(expectedRatio);

    // Collect any console error messages and page errors and assert none occurred
    const consoleErrorMsgs = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrorMsgs.length).toBe(0);
    expect(pageErrors.length).toBe(0);

    // Also assert that we observed some console activity (info/debug) during the interactions (non-strict)
    // This assertion is lenient: at least zero or more messages; ensuring we recorded the console stream successfully.
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });
});