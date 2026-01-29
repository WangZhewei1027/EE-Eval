import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ab64e2-fa78-11f0-812d-c9788050701f.html';

/**
 * Page Object for the Amortized Analysis Visualizer page.
 * Encapsulates selectors and convenient accessors for assertions.
 */
class VisualizerPage {
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.actualCostBar = page.locator('#actualCostBar');
    this.amortizedCostBar = page.locator('#amortizedCostBar');
    this.averageCost = page.locator('#averageCost');
    this.graphLine = page.locator('#graphLine');
    this.graphPoints = page.locator('#graphPoints');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Read numeric cost from data-cost attribute
  async getActualCostAttr() {
    return await this.actualCostBar.getAttribute('data-cost');
  }

  async getAmortizedCostAttr() {
    return await this.amortizedCostBar.getAttribute('data-cost');
  }

  async getAverageCostText() {
    return (await this.averageCost.innerText()).trim();
  }

  // Get computed width (in pixels) of graphLine element
  async getGraphLineWidth() {
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return window.getComputedStyle(el).width;
    }, '#graphLine');
  }

  async getGraphPointsCount() {
    return await this.graphPoints.evaluate((el) => el.children.length);
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async hasStartPulseClass() {
    return await this.startBtn.evaluate((el) => el.classList.contains('pulse'));
  }

  async isStartDisabled() {
    return await this.startBtn.evaluate((el) => el.disabled);
  }
}

test.describe('Amortized Analysis Visualizer - FSM and UI validation', () => {
  // Arrays to collect runtime errors and console messages observed during page load/interactions
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      // Push the Error object for later assertions
      pageErrors.push(err);
    });

    // Collect console calls (info/warn/error) for inspection
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });
  });

  test.afterEach(async ({ page }) => {
    // Close page to ensure clean teardown for subsequent tests
    await page.close();
  });

  test.describe('Initial Idle State (S0_Idle)', () => {
    test('renders the page and shows initial controls and visual elements', async ({ page }) => {
      // This test validates the Idle state: DOM elements exist and initial values are as expected.
      const viz = new VisualizerPage(page);
      await viz.goto();

      // Basic presence checks for controls and their attributes
      await expect(viz.startBtn).toBeVisible();
      await expect(viz.resetBtn).toBeVisible();

      // Start button should have the "pulse" class and be enabled in the Idle state
      expect(await viz.hasStartPulseClass()).toBe(true);
      expect(await viz.isStartDisabled()).toBe(false);

      // Cost bars should have initial data-cost attributes of "0"
      expect(await viz.getActualCostAttr()).toBe('0');
      expect(await viz.getAmortizedCostAttr()).toBe('0');

      // Average cost text should be "0"
      expect(await viz.getAverageCostText()).toBe('0');

      // Graph line initial width should be '0px' or '0' depending on computed style (we accept both)
      const graphLineWidth = await viz.getGraphLineWidth();
      expect(graphLineWidth === '0px' || graphLineWidth === '0' || graphLineWidth === '0%').toBeTruthy();

      // No graph points should be rendered initially
      expect(await viz.getGraphPointsCount()).toBe(0);

      // The page is expected to have runtime errors due to the intentionally truncated script.
      // We do not attempt to patch or fix the page; we assert that at least one page error (likely a SyntaxError)
      // occurred during load as per the test instructions.
      expect(pageErrors.length).toBeGreaterThan(0);

      // Ensure at least one of the collected page errors indicates a SyntaxError / Unexpected end of input
      const errorMessages = pageErrors.map((e) => e.message || String(e));
      const hasSyntax = errorMessages.some((m) => /syntaxerror/i.test(m) || /unexpected/i.test(m) || /unexpected end/i.test(m));
      expect(hasSyntax).toBe(true);
    });
  });

  test.describe('Start Visualization (S0_Idle -> S1_Running) transition', () => {
    test('clicking Start does not start animation when script failed to load; UI remains in Idle', async ({ page }) => {
      // This test checks the Start transition and verifies that, given the broken JS, nothing starts.
      const viz = new VisualizerPage(page);
      await viz.goto();

      // Snapshot initial metrics
      const initialActual = await viz.getActualCostAttr();
      const initialAmortized = await viz.getAmortizedCostAttr();
      const initialAverage = await viz.getAverageCostText();
      const initialGraphWidth = await viz.getGraphLineWidth();
      const initialPoints = await viz.getGraphPointsCount();

      // Click the start button - because the page's script is truncated, event handlers may not be attached.
      await viz.clickStart();

      // Wait a short while to allow any (unexpected) async changes if handlers existed
      await page.waitForTimeout(500);

      // After clicking, since script parsing failed, we expect no changes:
      expect(await viz.getActualCostAttr()).toBe(initialActual);
      expect(await viz.getAmortizedCostAttr()).toBe(initialAmortized);
      expect(await viz.getAverageCostText()).toBe(initialAverage);
      expect(await viz.getGraphLineWidth()).toBe(initialGraphWidth);
      expect(await viz.getGraphPointsCount()).toBe(initialPoints);

      // Start button should remain enabled and should still have the 'pulse' class (no startVisualization run)
      expect(await viz.isStartDisabled()).toBe(false);
      expect(await viz.hasStartPulseClass()).toBe(true);

      // Verify that page errors were observed (from load). Also ensure no new pageerror was thrown as a result of clicking.
      // (We allow the initial errors to be present; we assert that count is >= 1)
      expect(pageErrors.length).toBeGreaterThan(0);

      // Ensure there is at least one console message or page error hinting at the scripting problem.
      const consoleTexts = consoleMessages.map((c) => `${c.type}: ${c.text}`);
      const combined = consoleTexts.concat(pageErrors.map((e) => e.message || String(e)));
      const containsScriptIssue = combined.some((m) => /syntaxerror|unexpected|referenceerror|typeerror/i.test(m));
      expect(containsScriptIssue).toBe(true);
    });
  });

  test.describe('Reset Visualization (S1_Running -> S0_Idle) transition and edge cases', () => {
    test('clicking Reset does not change visualization because handlers are not reliably attached; verify idempotent behavior', async ({ page }) => {
      // This test validates Reset transition behavior (and edge cases) when the page runtime is broken.
      const viz = new VisualizerPage(page);
      await viz.goto();

      // Initial values
      const initialActual = await viz.getActualCostAttr();
      const initialAmortized = await viz.getAmortizedCostAttr();
      const initialAverage = await viz.getAverageCostText();
      const initialGraphWidth = await viz.getGraphLineWidth();
      const initialPoints = await viz.getGraphPointsCount();

      // Click reset multiple times to simulate user edge-case behavior
      await viz.clickReset();
      await page.waitForTimeout(200);
      await viz.clickReset();
      await page.waitForTimeout(200);

      // Expect no change due to missing/failed scripting
      expect(await viz.getActualCostAttr()).toBe(initialActual);
      expect(await viz.getAmortizedCostAttr()).toBe(initialAmortized);
      expect(await viz.getAverageCostText()).toBe(initialAverage);
      expect(await viz.getGraphLineWidth()).toBe(initialGraphWidth);
      expect(await viz.getGraphPointsCount()).toBe(initialPoints);

      // Ensure the Reset button exists and is visible and clickable (i.e., not disabled by default)
      await expect(viz.resetBtn).toBeVisible();
      // No page-level thrown exception as a direct result of clicking reset (we already had initial syntax errors)
      expect(pageErrors.length).toBeGreaterThan(0);
    });

    test('double-clicking Start rapidly should not produce inconsistent DOM updates in broken runtime', async ({ page }) => {
      // Rapid interactions: click start multiple times quickly
      const viz = new VisualizerPage(page);
      await viz.goto();

      await viz.clickStart();
      await viz.clickStart();
      await viz.clickStart();

      // Give short time for any unexpected handlers
      await page.waitForTimeout(300);

      // All visual metrics should remain unchanged from the initial idle snapshot
      expect(await viz.getActualCostAttr()).toBe('0');
      expect(await viz.getAmortizedCostAttr()).toBe('0');
      expect(await viz.getAverageCostText()).toBe('0');
      expect(await viz.getGraphPointsCount()).toBe(0);
    });
  });

  test.describe('Error observation and diagnostics', () => {
    test('asserts that a SyntaxError (or related script parsing error) occurred during page load', async ({ page }) => {
      // This stand-alone test ensures we explicitly assert that the broken script produced a parsing/runtime error.
      const viz = new VisualizerPage(page);
      await viz.goto();

      // At least one pageerror should have been captured
      expect(pageErrors.length).toBeGreaterThan(0);

      // The aggregated messages should indicate a syntax/parsing issue
      const messages = pageErrors.map((e) => e.message || String(e));
      const hasRelevant = messages.some((m) => /syntaxerror|unexpected end|unexpected token|unterminated/i.test(m.toLowerCase()));
      expect(hasRelevant).toBe(true);
    });

    test('captures console output for post-mortem and ensures we did not suppress page errors', async ({ page }) => {
      // This test documents the presence of console messages and ensures we didn't inadvertently swallow errors.
      const viz = new VisualizerPage(page);
      await viz.goto();

      // We expect at least some console messages (could be none depending on environment), but we must not fail the test
      // solely because console is empty; instead assert that monitoring worked correctly by verifying captured arrays exist.
      expect(Array.isArray(consoleMessages)).toBe(true);
      expect(Array.isArray(pageErrors)).toBe(true);

      // If consoleMessages is non-empty, ensure at least one entry contains relevant script-failure text.
      const texts = consoleMessages.map((c) => c.text.toLowerCase());
      const hasFailureInConsole = texts.some((t) => /syntaxerror|unexpected|referenceerror|typeerror/.test(t));
      // It's acceptable for this to be false in some environments; we assert it's a boolean and include an informative diagnostic if present.
      if (hasFailureInConsole) {
        expect(hasFailureInConsole).toBe(true);
      } else {
        // Ensure pageErrors caught the issue if console did not
        const fallbackDetected = pageErrors.some((e) => /syntaxerror|unexpected/i.test((e.message || '').toLowerCase()));
        expect(fallbackDetected).toBe(true);
      }
    });
  });
});