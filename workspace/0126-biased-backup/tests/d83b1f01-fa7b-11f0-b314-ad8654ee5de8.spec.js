import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83b1f01-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object for the tiny demo area
class DemoPage {
  constructor(page) {
    this.page = page;
    this.runBtn = page.locator('#runDemo');
    this.log = page.locator('#log');
    this.canvas = page.locator('#canvas');
  }

  // Navigate to the app
  async goto() {
    await this.page.goto(APP_URL);
    // Wait for key UI elements to be present
    await expect(this.runBtn).toBeVisible();
    await expect(this.canvas).toBeVisible();
    await expect(this.log).toBeVisible();
  }

  // Click the Run Simple Demo button
  async clickRun() {
    await this.runBtn.click();
  }

  // Return whether run button is disabled
  async isRunDisabled() {
    return await this.runBtn.isDisabled();
  }

  // Read all visible log text as one string
  async getLogText() {
    return await this.log.innerText();
  }

  // Count occurrences of a substring in the log text
  async countLogOccurrences(substr) {
    const txt = await this.getLogText();
    return (txt.match(new RegExp(substr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  }

  // Get canvas data URL (PNG) snapshot
  async getCanvasDataURL() {
    return await this.page.evaluate(() => {
      const canvas = document.getElementById('canvas');
      return canvas.toDataURL();
    });
  }

  // Compute a simple numeric checksum of canvas pixels (sum of RGBA) to detect changes
  async getCanvasPixelSumSample() {
    return await this.page.evaluate(() => {
      const canvas = document.getElementById('canvas');
      const ctx = canvas.getContext('2d');
      // sample a small patch to limit cost
      const w = Math.min(50, canvas.width);
      const h = Math.min(50, canvas.height);
      const img = ctx.getImageData(0, 0, w, h).data;
      let sum = 0;
      for (let i = 0; i < img.length; i++) sum += img[i];
      return sum;
    });
  }
}

test.describe('K-Means Tiny Demonstration — FSM and UI verification', () => {
  // Increase timeout for tests that must wait for the demo to run through many sleeps
  test.setTimeout(60_000);

  // Shared state for capturing page-level console messages and errors
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for inspection
    page.on('console', (msg) => {
      try {
        const text = msg.text();
        consoleMessages.push({ type: msg.type(), text });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // Attach logs for easier debugging on failure (Playwright will show test failure output)
    // We do not modify the page or its environment here; just output captured info to test logs.
    if (consoleMessages.length) {
      console.log('Captured console messages:', consoleMessages.slice(0, 50));
    }
    if (pageErrors.length) {
      console.log('Captured page errors:', pageErrors.slice(0, 50));
    }
  });

  test('Initial Idle state (S0_Idle) — UI elements present and entry actions performed', async ({ page }) => {
    // Validate initial Idle state. Entry action draw([], null, null) should have executed producing initial canvas text.
    const demo = new DemoPage(page);
    await demo.goto();

    // The run button should be enabled in Idle state
    await expect(demo.runBtn).toBeEnabled();

    // The log should contain the initial hint message
    const logText = await demo.getLogText();
    expect(logText).toContain('Press "Run Simple Demo" to start.'); // verifies entry textual evidence

    // Canvas should have initial drawn content (not blank). We sample pixel sums to ensure something was rendered.
    const pixelSum = await demo.getCanvasPixelSumSample();
    expect(pixelSum).toBeGreaterThan(0);

    // No uncaught page errors should be present after initial load
    expect(pageErrors.length).toBe(0);
  });

  test('Run Simple Demo triggers Demo Running state (S1_DemoRunning) and completes with expected logs and canvas updates', async ({ page }) => {
    // This test validates the transition S0_Idle -> S1_DemoRunning and that demo completes returning to Idle.
    const demo = new DemoPage(page);
    await demo.goto();

    // Capture canvas snapshot before running to compare later
    const beforeCanvas = await demo.getCanvasDataURL();
    const beforePixelSum = await demo.getCanvasPixelSumSample();

    // Click the Run button to start the demo
    await demo.clickRun();

    // Immediately after clicking, the run button should be disabled (evidence of S1_DemoRunning entry)
    await expect(demo.runBtn).toBeDisabled();

    // While running, initial log entries should contain generating message
    // Wait for the 'Generating synthetic 2D data (three blobs + outliers)...' message to appear in the log.
    await page.waitForFunction(() => {
      const l = document.getElementById('log');
      return l && l.innerText.includes('Generating synthetic 2D data (three blobs + outliers)...');
    }, null, { timeout: 5000 });

    // Also verify k-means++ initialization message appears
    await page.waitForFunction(() => {
      const l = document.getElementById('log');
      return l && l.innerText.includes('Initializing K = 3 centroids using k-means++');
    }, null, { timeout: 5000 });

    // During run we expect 'Assignment step' and 'Update step' messages to appear at least once while iterating
    await page.waitForFunction(() => {
      const txt = document.getElementById('log')?.innerText || '';
      return txt.includes('assignment step') && txt.includes('Update step');
    }, null, { timeout: 20_000 });

    // Wait for demo finalization log 'Demo finished. Final centroids and cluster sizes:'
    await page.waitForFunction(() => {
      const txt = document.getElementById('log')?.innerText || '';
      return txt.includes('Demo finished. Final centroids and cluster sizes:');
    }, null, { timeout: 40_000 });

    // After completion, the run button must be re-enabled
    await expect(demo.runBtn).toBeEnabled();

    // Canvas snapshot after run should differ from before (visual update evidence)
    const afterCanvas = await demo.getCanvasDataURL();
    const afterPixelSum = await demo.getCanvasPixelSumSample();
    expect(afterCanvas).not.toBe(beforeCanvas);
    expect(afterPixelSum).not.toBe(beforePixelSum);

    // The log should contain final centroid lines and cluster sizes
    const finalLog = await demo.getLogText();
    expect(finalLog).toContain('Demo finished. Final centroids and cluster sizes:');
    // there should be centroids listed: 'centroid 0:' etc.
    expect(finalLog).toMatch(/centroid\s+0:/i);
    expect(finalLog).toMatch(/centroid\s+1:/i);
    expect(finalLog).toMatch(/centroid\s+2:/i);

    // No uncaught page errors should have occurred during the run
    expect(pageErrors.length).toBe(0);
  });

  test('Attempting to click Run while demo is running should fail (edge case) and not crash page', async ({ page }) => {
    // This test confirms the UI prevents duplicate concurrent runs and that attempting to click when disabled is handled.
    const demo = new DemoPage(page);
    await demo.goto();

    // Start the demo
    await demo.clickRun();

    // Ensure it started
    await expect(demo.runBtn).toBeDisabled();

    // Attempt to click the disabled button; Playwright should throw an error because the element is disabled.
    let clickError = null;
    try {
      // use a short timeout to avoid waiting for eventual enablement
      await demo.runBtn.click({ timeout: 2000 });
    } catch (err) {
      clickError = err;
    }

    // We expect an error to have been thrown from Playwright due to disabled element
    expect(clickError).toBeTruthy();
    // Error message typically mentions "element is disabled" or similar; assert there's some indication it's not clickable
    expect(String(clickError.message || clickError)).toMatch(/disabled|not clickable|Element is.*disabled/i);

    // Allow the demo to finish to keep environment clean for other tests
    await page.waitForFunction(() => {
      const txt = document.getElementById('log')?.innerText || '';
      return txt.includes('Demo finished. Final centroids and cluster sizes:');
    }, null, { timeout: 40_000 });

    // Ensure no uncaught exceptions occurred
    expect(pageErrors.length).toBe(0);
  });

  test('Run demo twice sequentially (S0 -> S1 -> S0 -> S1) to validate repeated transitions', async ({ page }) => {
    // This tests invoking the demo multiple times across full runs and ensures logs show repeated runs.
    const demo = new DemoPage(page);
    await demo.goto();

    // First run
    await demo.clickRun();
    await page.waitForFunction(() => {
      const txt = document.getElementById('log')?.innerText || '';
      return txt.includes('Demo finished. Final centroids and cluster sizes:');
    }, null, { timeout: 40_000 });

    // Count occurrences of the generating message after first run
    const firstCount = await demo.countLogOccurrences('Generating synthetic 2D data (three blobs + outliers)...');
    expect(firstCount).toBeGreaterThanOrEqual(1);

    // Clear any console messages collected so far (for clarity) - but not touching page code, only our recorded arrays
    // (We simply reset our captured console message array; page DOM untouched)
    consoleMessages = [];

    // Second run
    await demo.clickRun();

    // Wait for second run to finish
    await page.waitForFunction(() => {
      const txt = document.getElementById('log')?.innerText || '';
      // Look for the final marker of the second run; the log accumulates, so ensure a second "Demo finished" appears
      return (txt.match(/Demo finished. Final centroids and cluster sizes:/g) || []).length >= 2;
    }, null, { timeout: 60_000 });

    // After second run, ensure generating message appears at least twice in the accumulated logs
    const totalGenCount = await demo.countLogOccurrences('Generating synthetic 2D data (three blobs + outliers)...');
    expect(totalGenCount).toBeGreaterThanOrEqual(2);

    // Ensure run button ended enabled
    await expect(demo.runBtn).toBeEnabled();

    // No uncaught page errors across both runs
    expect(pageErrors.length).toBe(0);
  });
});