import { test, expect } from '@playwright/test';

// Test file for Application ID: 324e9841-fa73-11f0-a9d0-d7a1991987c6
// Served at: http://127.0.0.1:5500/workspace/0126-balanced/html/324e9841-fa73-11f0-a9d0-d7a1991987c6.html

// Page Object Model for interacting with the demo page
class AmortizedPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.addSelector = '#add';
    this.resetSelector = '#reset';
    this.outputSelector = '#output';
  }

  async goto() {
    await this.page.goto('http://127.0.0.1:5500/workspace/0126-balanced/html/324e9841-fa73-11f0-a9d0-d7a1991987c6.html', { waitUntil: 'load' });
  }

  async clickAdd() {
    await this.page.click(this.addSelector);
  }

  async clickReset() {
    // Use Promise.all to capture navigation triggered by location.reload()
    await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'load' }),
      this.page.click(this.resetSelector)
    ]);
  }

  async getOutputText() {
    return this.page.locator(this.outputSelector).textContent();
  }

  async getOutputLines() {
    const text = (await this.getOutputText()) || '';
    // Each report ends with a newline, split and filter empty lines
    return text.split('\n').map(s => s.trim()).filter(Boolean);
  }

  async hasButton(selector) {
    return this.page.locator(selector).count().then(c => c > 0);
  }
}

// Utility to simulate expected outputs using the same algorithm as the page's DynamicArray
function simulateExpectedOutputs(addClicks) {
  const lines = [];
  let capacity = 2;
  let size = 0;
  let operations = 0;

  for (let i = 0; i < addClicks; i++) {
    if (size >= capacity) {
      // resize increments operations and doubles capacity
      operations++;
      capacity = capacity * 2;
    }
    // actual add increments operations and size
    size++;
    operations++;
    lines.push(`Total Array Size: ${capacity}, Elements: ${size}, Operations: ${operations}`);
  }

  return lines;
}

// Collect console messages and page errors for assertions
test.describe('Amortized Analysis Demonstration (Application ID: 324e9841-fa73-11f0-a9d0-d7a1991987c6)', () => {
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    pageErrors = [];
    consoleMessages = [];

    // Listen for uncaught exceptions on the page (ReferenceError, SyntaxError, TypeError, etc.)
    page.on('pageerror', (err) => {
      // err is typically an Error object with name and message
      pageErrors.push({ name: err.name, message: err.message });
    });

    // Collect console messages for inspection
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  });

  test.afterEach(async () => {
    // After each test we'll assert that there were no unexpected runtime errors
    // (The application as provided is expected to run without ReferenceError/SyntaxError/TypeError)
    const criticalErrorTypes = ['ReferenceError', 'SyntaxError', 'TypeError'];

    for (const pe of pageErrors) {
      // If any page error occurred, flag it in the test results with a helpful message
      // We still fail only if it's a critical error type. This gives visibility in test output.
      if (criticalErrorTypes.includes(pe.name)) {
        throw new Error(`Critical page error detected: ${pe.name} - ${pe.message}`);
      }
    }

    // Also search console messages for mention of critical error types or "Uncaught"
    for (const cm of consoleMessages) {
      const txt = cm.text;
      for (const t of criticalErrorTypes) {
        if (txt.includes(t) || txt.includes('Uncaught')) {
          throw new Error(`Critical console message detected (${cm.type}): ${txt}`);
        }
      }
    }
  });

  test.describe('Initial render and UI elements', () => {
    test('should render the page and show controls (S0_Idle entry)', async ({ page }) => {
      // This test validates the initial state (S0_Idle) - entry action renderPage() from FSM is expected
      const app = new AmortizedPage(page);
      await app.goto();

      // Check that title and buttons exist
      await expect(page.locator('h1')).toHaveText('Amortized Analysis Demonstration');
      await expect(page.locator('#add')).toHaveText('Add Element');
      await expect(page.locator('#reset')).toHaveText('Reset');

      // Output should be empty initially
      const lines1 = await app.getOutputLines();
      expect(lines.length).toBe(0);
    });
  });

  test.describe('Add Element interactions and transitions', () => {
    test('clicking Add once transitions S0_Idle -> S1_ElementAdded and reports correct values', async ({ page }) => {
      // Validate first transition and verify report: "Total Array Size: 2, Elements: 1, Operations: 1"
      const app1 = new AmortizedPage(page);
      await app.goto();

      // Click Add once
      await app.clickAdd();

      // Expect exactly one report line matching the simulation
      const lines2 = await app.getOutputLines();
      expect(lines.length).toBe(1);
      const expected = simulateExpectedOutputs(1);
      expect(lines).toEqual(expected);
    });

    test('multiple Add clicks cause resizes and operations count reflects both adds and resizes', async ({ page }) => {
      // Validate a sequence of adds and confirm the series of report lines match expected behavior
      const app2 = new AmortizedPage(page);
      await app.goto();

      const addCount = 6; // exercise multiple resizes across capacity boundaries
      for (let i = 0; i < addCount; i++) {
        await app.clickAdd();
      }

      const lines3 = await app.getOutputLines();
      // Ensure we have one line per add
      expect(lines.length).toBe(addCount);

      // Compute expected lines and compare
      const expected1 = simulateExpectedOutputs(addCount);
      expect(lines).toEqual(expected);

      // Additional sanity checks on the last line: capacity should be >= elements
      const last = lines[lines.length - 1];
      // parse numbers from the last line
      const match = last.match(/Total Array Size:\s*(\d+),\s*Elements:\s*(\d+),\s*Operations:\s*(\d+)/);
      expect(match).not.toBeNull();
      const [, capStr, elemStr, opsStr] = match;
      const cap = parseInt(capStr, 10);
      const elems = parseInt(elemStr, 10);
      const ops = parseInt(opsStr, 10);
      expect(cap).toBeGreaterThanOrEqual(elems);
      expect(ops).toBeGreaterThanOrEqual(elems); // operations at least equals number of adds
    });

    test('edge case: no Add clicks keeps output empty (remains in S0_Idle)', async ({ page }) => {
      // Validate that without interactions the page remains in Idle and no reports are produced
      const app3 = new AmortizedPage(page);
      await app.goto();

      // Do not click anything
      const lines4 = await app.getOutputLines();
      expect(lines.length).toBe(0);
    });
  });

  test.describe('Reset behavior and transitions', () => {
    test('clicking Reset triggers page reload and clears output (S0_Idle -> S0_Idle)', async ({ page }) => {
      // This validates the Reset event and its transition back to Idle via location.reload()
      const app4 = new AmortizedPage(page);
      await app.goto();

      // Add a couple elements to populate output
      await app.clickAdd();
      await app.clickAdd();
      let linesBefore = await app.getOutputLines();
      expect(linesBefore.length).toBeGreaterThan(0);

      // Click Reset and wait for reload
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'load' }),
        page.click('#reset')
      ]);

      // After reload, output should be reset (empty)
      const linesAfter = await app.getOutputLines();
      expect(linesAfter.length).toBe(0);

      // The buttons should still be present after reload (back to Idle)
      const addExists = await app.hasButton('#add');
      const resetExists = await app.hasButton('#reset');
      expect(addExists).toBe(true);
      expect(resetExists).toBe(true);
    });
  });

  test.describe('Robustness and error observation', () => {
    test('should not produce ReferenceError, SyntaxError, or TypeError on load and interactions', async ({ page }) => {
      // This test explicitly loads the page and performs several interactions while collecting runtime errors
      const app5 = new AmortizedPage(page);
      await app.goto();

      // Perform a sequence of interactions
      await app.clickAdd();
      await app.clickAdd();
      await app.clickAdd();

      // Allow microtasks / console messages to flush
      await page.waitForTimeout(100);

      // Assert there were no page errors recorded (critical ones will fail in afterEach)
      expect(pageErrors.length).toBe(0);

      // Inspect console messages for fatal mentions
      const combinedConsoleText = consoleMessages.map(c => c.text).join('\n');
      expect(combinedConsoleText).not.toMatch(/ReferenceError/);
      expect(combinedConsoleText).not.toMatch(/SyntaxError/);
      expect(combinedConsoleText).not.toMatch(/TypeError/);
    });

    test('observes and surfaces any uncaught page errors or console errors (if they occur)', async ({ page }) => {
      // This test demonstrates observation: if the app produced uncaught errors they would be captured.
      // We still assert no critical errors occurred, but we print collected diagnostics when a non-critical issue exists.
      const app6 = new AmortizedPage(page);
      await app.goto();

      // Intentionally perform interactions to surface potential runtime issues
      await app.clickAdd();
      await app.clickAdd();

      // Await small delay to ensure events propagate
      await page.waitForTimeout(50);

      // If any non-critical errors were logged to the console, include them as part of the assertion failure message.
      if (pageErrors.length > 0 || consoleMessages.some(m => m.type === 'error')) {
        // Format diagnostics
        const diagnostics = [
          'Page Errors:',
          ...pageErrors.map(pe => `${pe.name}: ${pe.message}`),
          'Console Errors:',
          ...consoleMessages.filter(m => m.type === 'error').map(m => m.text)
        ].join('\n');
        // Fail the test with diagnostics so they are visible in CI logs.
        throw new Error(`Runtime diagnostics detected:\n${diagnostics}`);
      }

      // Otherwise pass: no runtime diagnostics detected
      expect(pageErrors.length).toBe(0);
    });
  });
});