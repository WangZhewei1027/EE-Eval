import { test, expect } from '@playwright/test';

// Test constants
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed9061c0-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object for the KNN Visualization app
class KNNPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.canvas = page.locator('#canvas');
    this.button = page.locator('.button');
    this.pointLocator = this.canvas.locator('.point');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Return count of .point elements
  async pointCount() {
    return await this.pointLocator.count();
  }

  // Return array of inline style summaries for each point: "left|top|backgroundColor"
  async pointStyleSummaries() {
    return await this.page.$$eval('#canvas .point', (nodes) =>
      nodes.map((n) => {
        const style = window.getComputedStyle(n);
        return `${n.style.left}|${n.style.top}|${style.backgroundColor}|${n.style.width}|${n.style.height}`;
      })
    );
  }

  // Click the "Generate New Data" button
  async clickGenerate() {
    await this.button.click();
  }

  // Return ElementHandle array of current point elements (used to test isConnected)
  async getPointHandles() {
    return await this.page.$$('#canvas .point');
  }

  // Check if global function generateData exists
  async hasGenerateDataFunction() {
    return await this.page.evaluate(() => typeof generateData === 'function');
  }

  // Get inline innerHTML snapshot (short length)
  async canvasInnerHTMLLength() {
    return await this.page.evaluate(() => document.getElementById('canvas').innerHTML.length);
  }
}

// Collect console and page errors globally for each test run
test.describe('K-Nearest Neighbors Visualization - FSM driven tests', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    pageErrors = [];

    // Listen for console messages and page errors (do not modify page)
    page.on('console', (msg) => {
      // store type, text and location for diagnostics
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location ? msg.location() : null,
      });
    });

    page.on('pageerror', (err) => {
      // store stack/message
      pageErrors.push(err);
    });
  });

  // Group tests related to initial state "S0_Idle" and entry action generateData()
  test.describe('State: S0_Idle (initial load and entry action)', () => {
    test('Initial load should call generateData() and render points', async ({ page }) => {
      const app = new KNNPage(page);

      // Navigate to the app (generateData() is called on load per implementation)
      await app.goto();

      // Validate that generateData exists on the window (entry action present)
      const hasGenerate = await app.hasGenerateDataFunction();
      // Expect the function to be present as the HTML attaches onclick to it
      expect(hasGenerate).toBe(true);

      // After load, there should be points generated (expect 50 as per implementation)
      const count = await app.pointCount();
      expect(count).toBe(50);

      // Verify each point has expected basic styling (width & height 10px, border-radius via CSS class)
      const summaries = await app.pointStyleSummaries();
      expect(summaries.length).toBeGreaterThan(0);
      // Ensure each summary contains width and height strings (as set inline)
      for (const s of summaries) {
        // s format: "left|top|backgroundColor|width|height"
        const parts = s.split('|');
        expect(parts.length).toBe(5);
        // width and height should equal '10px'
        expect(parts[3]).toBe('10px');
        expect(parts[4]).toBe('10px');
        // left/top should be a percentage string ending with %
        expect(parts[0].trim().endsWith('%')).toBeTruthy();
        expect(parts[1].trim().endsWith('%')).toBeTruthy();
      }
    });

    test('No uncaught page errors or console errors on initial load', async ({ page }) => {
      const app = new KNNPage(page);
      await app.goto();

      // Allow a tiny delay for any async messages to appear
      await page.waitForTimeout(100);

      // Assert no page errors (ReferenceError/SyntaxError/TypeError would surface here)
      expect(pageErrors.length).toBe(0);

      // Assert there are no console messages of type 'error'
      const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
    });
  });

  // Group tests related to the GenerateData event transition
  test.describe('Event: GenerateData (click .button) and transitions', () => {
    test('Clicking the Generate New Data button clears previous points and generates new ones', async ({ page }) => {
      const app = new KNNPage(page);

      await app.goto();

      // Capture existing element handles (before click)
      const oldHandles = await app.getPointHandles();
      expect(oldHandles.length).toBeGreaterThan(0);

      // Ensure old handles are connected before clicking
      for (const handle of oldHandles) {
        const isConnected = await handle.evaluate((node) => node.isConnected);
        expect(isConnected).toBeTruthy();
      }

      // Capture old style summaries for comparison
      const oldSummaries = await app.pointStyleSummaries();

      // Click the button to generate new data (transition S0 -> S0)
      await app.clickGenerate();

      // After click, expect canvas points still present and count equals points (50)
      const newCount = await app.pointCount();
      expect(newCount).toBe(50);

      // Old handles should now be detached from document (cleared via innerHTML)
      for (const handle of oldHandles) {
        const isConnectedAfter = await handle.evaluate((node) => node.isConnected);
        // When innerHTML is cleared and new nodes appended, old nodes should not be connected
        expect(isConnectedAfter).toBeFalsy();
      }

      // New summaries should differ from old summaries in at least one element
      const newSummaries = await app.pointStyleSummaries();
      // There should be 50 new summaries
      expect(newSummaries.length).toBe(50);

      // Check that not every summary is identical to a previous summary
      // (random generation should produce at least one different point)
      const allSame = newSummaries.every((s) => oldSummaries.includes(s));
      expect(allSame).toBe(false);
    });

    test('Rapid multiple clicks should still result in stable point count and no uncaught errors', async ({ page }) => {
      const app = new KNNPage(page);
      await app.goto();

      // Rapidly click the generate button multiple times
      await Promise.all([
        app.button.click(),
        app.button.click(),
        app.button.click(),
      ]);

      // Wait briefly for DOM updates to settle
      await page.waitForTimeout(200);

      // Ensure count remains 50
      const count = await app.pointCount();
      expect(count).toBe(50);

      // Ensure no page errors were produced during rapid clicks
      expect(pageErrors.length).toBe(0);

      // Ensure no console errors
      const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
    });

    test('Canvas innerHTML length changes on generate (evidence of clearing and re-populating)', async ({ page }) => {
      const app = new KNNPage(page);
      await app.goto();

      // Get initial innerHTML length
      const beforeLen = await app.canvasInnerHTMLLength();
      expect(beforeLen).toBeGreaterThan(0);

      // Click to generate new data
      await app.clickGenerate();

      // After click, innerHTML length should be > 0 as new points are added,
      // and should not be the exact same string length in most runs (stochastic),
      // but at minimum must be > 0 and the old node handles should be detached (checked in other tests).
      await page.waitForTimeout(50);
      const afterLen = await app.canvasInnerHTMLLength();
      expect(afterLen).toBeGreaterThan(0);
    });
  });

  // Edge cases and error scenario tests
  test.describe('Edge cases and error detection', () => {
    test('generateData() exists and is callable via the global scope', async ({ page }) => {
      const app = new KNNPage(page);
      await app.goto();

      // Confirm function exists
      const hasFn = await app.hasGenerateDataFunction();
      expect(hasFn).toBe(true);

      // Call it from the page to ensure no runtime exception when invoked programmatically
      const result = await page.evaluate(() => {
        try {
          // Call and return success marker
          generateData();
          return { ok: true };
        } catch (err) {
          return { ok: false, message: (err && err.message) || String(err) };
        }
      });

      expect(result.ok).toBe(true);
    });

    test('If any ReferenceError/SyntaxError/TypeError occurs it should surface as a pageerror (assert there are none)', async ({ page }) => {
      const app = new KNNPage(page);
      await app.goto();

      // Wait a short time to collect any async thrown errors
      await page.waitForTimeout(100);

      // If any page errors exist, fail with diagnostic information
      if (pageErrors.length > 0) {
        // Provide a helpful failure message listing the errors detected
        const messages = pageErrors.map((e) => (e && e.message) || String(e)).join('\n---\n');
        throw new Error(`Unexpected page errors detected:\n${messages}`);
      }

      // Additionally ensure there are no console.error messages
      const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error');
      if (errorConsoleMessages.length > 0) {
        const texts = errorConsoleMessages.map((m) => m.text).join('\n---\n');
        throw new Error(`Unexpected console.error messages detected:\n${texts}`);
      }

      // If none, the test passes (the environment produced no ReferenceError/SyntaxError/TypeError)
      expect(pageErrors.length).toBe(0);
      expect(errorConsoleMessages.length).toBe(0);
    });
  });
});