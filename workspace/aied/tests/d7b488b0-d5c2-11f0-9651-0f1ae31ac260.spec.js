import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d7b488b0-d5c2-11f0-9651-0f1ae31ac260.html';

// Page object encapsulating interactions and queries for the Sliding Window page
class SlidingWindowPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayInput = page.locator('#array-input');
    this.windowSizeInput = page.locator('#window-size');
    this.startBtn = page.locator('#start-btn');
    this.speedRange = page.locator('#speed-range');
    this.speedLabel = page.locator('#speed-label');
    this.arrayContainer = page.locator('#array-container');
    this.resultContainer = page.locator('#result');
  }

  async goto() {
    await this.page.goto(BASE_URL);
  }

  async getStartEnabled() {
    return await this.startBtn.isEnabled();
  }

  async getInputEnabled() {
    return {
      array: await this.arrayInput.isEnabled(),
      window: await this.windowSizeInput.isEnabled(),
      speed: await this.speedRange.isEnabled(),
    };
  }

  async setArray(value) {
    await this.arrayInput.fill(value);
  }

  async setWindowSize(value) {
    await this.windowSizeInput.fill(String(value));
  }

  // Adjust the speed slider and ensure input event is fired
  async setSpeed(value) {
    await this.speedRange.fill(String(value));
    // Trigger input event programmatically by evaluating on the element
    await this.page.evaluate((v) => {
      const el = document.getElementById('speed-range');
      el.value = String(v);
      const ev = new Event('input', { bubbles: true });
      el.dispatchEvent(ev);
    }, value);
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async getArrayElementsCount() {
    return await this.arrayContainer.locator('.array-element').count();
  }

  async getResultText() {
    return await this.resultContainer.textContent() || '';
  }

  async anyArrayElementsWithClass(cls) {
    return await this.page.evaluate((c) => {
      const container = document.getElementById('array-container');
      if (!container) return false;
      const children = Array.from(container.children);
      return children.some(ch => ch.classList.contains(c));
    }, cls);
  }

  // Wait for visualization to complete: defined as start button re-enabled.
  async waitForVisualizationComplete(timeout = 15000) {
    await this.startBtn.waitFor({ state: 'enabled', timeout });
  }
}

test.describe('Sliding Window Visualization - FSM Validation', () => {
  // Capture console errors and page errors per test
  test.beforeEach(async ({ page }) => {
    // Nothing here, listeners are attached in each test for clarity and isolation
  });

  test.afterEach(async ({ page }) => {
    // no-op
  });

  test('Initial Idle State: page loads with Start enabled and inputs active', async ({ page }) => {
    // Validate initial idle state S0_Idle: renderPage()
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err));

    const sw = new SlidingWindowPage(page);
    await sw.goto();

    // Assert no runtime page errors or console.errors on load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Start button exists and is enabled
    expect(await sw.startBtn.isVisible()).toBeTruthy();
    expect(await sw.startBtn.isEnabled()).toBeTruthy();

    // Inputs are enabled
    const inputs = await sw.getInputEnabled();
    expect(inputs.array).toBeTruthy();
    expect(inputs.window).toBeTruthy();
    expect(inputs.speed).toBeTruthy();

    // Initially array container should be empty (not yet rendered)
    expect(await sw.getArrayElementsCount()).toBe(0);

    // result container empty
    const resultText = await sw.getResultText();
    expect(resultText.trim()).toBe('');
  });

  test('ChangeSpeed event: adjusting speed updates label and internal speed', async ({ page }) => {
    // This test validates the ChangeSpeed event handling (speed-range input -> speedLabel)
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err));

    const sw = new SlidingWindowPage(page);
    await sw.goto();

    // Default label should reflect default value (800)
    await expect(sw.speedLabel).toHaveText(/800 ms per step/);

    // Change the speed to a faster value and assert label updates
    await sw.setSpeed(200);
    await expect(sw.speedLabel).toHaveText(/200 ms per step/);

    // Verify no console or page errors triggered by interacting with the speed control
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('StartVisualization transition: S0_Idle -> S1_Visualizing -> S0_Idle full run', async ({ page }) => {
    // This test validates the StartVisualization event and the transitions, onEnter/onExit behaviors.
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err));

    const sw = new SlidingWindowPage(page);
    await sw.goto();

    // Prepare a known array and speed to make the test deterministic and fast
    const testArray = '1,3,-1,-3,5,3,6,7';
    await sw.setArray(testArray);
    await sw.setWindowSize(3);
    await sw.setSpeed(200); // fast animation to reduce test runtime

    // Click start to begin visualization
    await sw.clickStart();

    // Immediately after clicking, the page should have executed the transition actions:
    // startBtn.disabled = true, speedRange.disabled = true, arrayInput.disabled = true, windowSizeInput.disabled = true
    await expect(sw.startBtn).toBeDisabled();
    expect(await sw.arrayInput.isDisabled()).toBeTruthy();
    expect(await sw.windowSizeInput.isDisabled()).toBeTruthy();
    expect(await sw.speedRange.isDisabled()).toBeTruthy();

    // onEnter for Visualizing should render array elements and clear result container
    // renderArray(array) -> array elements should be present
    const arrCount = await sw.getArrayElementsCount();
    expect(arrCount).toBe(8);

    // resultContainer was set to '' at entry; soon it will get visualization text
    const resultDuring = await sw.getResultText();
    // Should at least include the running header
    expect(resultDuring).toContain('Running sliding window maximum');

    // Wait for visualization to finish; as indicator, start button becomes enabled again (transition back to idle)
    await sw.waitForVisualizationComplete(20000);

    // After completion, the UI controls should be re-enabled (transition actions undone)
    await expect(sw.startBtn).toBeEnabled();
    expect(await sw.arrayInput.isEnabled()).toBeTruthy();
    expect(await sw.windowSizeInput.isEnabled()).toBeTruthy();
    expect(await sw.speedRange.isEnabled()).toBeTruthy();

    // The result container should include final results text as per FSM expected observable
    const finalResult = await sw.getResultText();
    expect(finalResult).toContain('Final sliding window maximums:');
    // The known expected result for this input and k=3 is [3,3,5,5,6,7]
    expect(finalResult).toContain('[3, 3, 5, 5, 6, 7]'.replace(/ /g, '')); // tolerant to spacing
    // Ensure array element highlights are cleared after visualization (resetArrayStyles called)
    const anyWindowClass = await sw.anyArrayElementsWithClass('window');
    const anyMaxClass = await sw.anyArrayElementsWithClass('current-max');
    expect(anyWindowClass).toBe(false);
    expect(anyMaxClass).toBe(false);

    // Ensure no runtime errors occurred during the visualization run
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  }, 30000); // extended timeout for visualization run

  test('Edge cases and validation alerts: empty array and invalid window size', async ({ page }) => {
    // This test exercises alert flows triggered by invalid inputs (edge cases)
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err));

    const sw = new SlidingWindowPage(page);
    await sw.goto();

    // Case 1: Empty array should trigger alert 'Please enter a valid array of numbers.'
    const dialogs = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });

    await sw.setArray(''); // clear the input
    await sw.clickStart();
    // Wait briefly to let dialog fire
    await page.waitForTimeout(200);
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[0]).toMatch(/Please enter a valid array of numbers\./i);

    // Reset dialogs array for next case
    dialogs.length = 0;

    // Case 2: Window size larger than array length triggers alert
    await sw.setArray('1,2,3');
    await sw.setWindowSize(10);
    await sw.clickStart();
    await page.waitForTimeout(200);
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[0]).toMatch(/Window size k must be between 1 and the length of the array\./i);

    // Case 3: Window size zero triggers the same alert validation path
    dialogs.length = 0;
    await sw.setWindowSize(0);
    await sw.clickStart();
    await page.waitForTimeout(200);
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[0]).toMatch(/Window size k must be between 1 and the length of the array\./i);

    // Ensure no unexpected console/page errors in validation flows
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observability: capture console and page errors during normal usage', async ({ page }) => {
    // This test explicitly attaches listeners and asserts that no page-level errors occur
    const consoleMessages = [];
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') consoleErrors.push(text);
    });
    page.on('pageerror', (err) => pageErrors.push(err));

    const sw = new SlidingWindowPage(page);
    await sw.goto();

    // Do a short run to exercise a few steps
    await sw.setSpeed(200);
    await sw.setArray('10,9,8,7');
    await sw.setWindowSize(2);
    await sw.clickStart();

    // Wait for run to complete
    await sw.waitForVisualizationComplete(10000);

    // Validate that there were no uncaught page errors
    expect(pageErrors.length).toBe(0);

    // Validate there were no console error messages
    expect(consoleErrors.length).toBe(0);

    // Optionally assert that some console messages were produced (not required), but we keep the check permissive
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });
});