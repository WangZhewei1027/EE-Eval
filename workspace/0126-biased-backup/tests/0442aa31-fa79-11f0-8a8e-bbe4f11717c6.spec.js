import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/0442aa31-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page Object Model for the Dijkstra demo page
class DijkstraPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.pageErrors = [];
    this.consoleMessages = [];

    // Capture browser console messages and page errors for assertions
    this.page.on('console', msg => {
      try {
        this.consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        this.consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    this.page.on('pageerror', err => {
      // Playwright passes an Error-like object
      this.pageErrors.push(err);
    });
  }

  // Navigate to app and wait for load so scripts execute (and possibly error)
  async goto() {
    this.pageErrors = [];
    this.consoleMessages = [];
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // allow any asynchronous handlers to run and errors to surface
    await this.page.waitForTimeout(250);
  }

  async startButton() {
    return this.page.locator('#start-button');
  }

  async resetButton() {
    return this.page.locator('#reset-button');
  }

  async graphElement() {
    return this.page.locator('#graph');
  }

  // Click Start and wait a bit for listeners and rendering to run
  async clickStart() {
    await (await this.startButton()).click();
    await this.page.waitForTimeout(200);
  }

  // Click Reset and wait a bit
  async clickReset() {
    await (await this.resetButton()).click();
    await this.page.waitForTimeout(200);
  }

  // Return captured errors
  getErrors() {
    return this.pageErrors;
  }

  // Return captured console messages
  getConsoleMessages() {
    return this.consoleMessages;
  }

  // Helper: check if any captured page error has a "TypeError"/"ReferenceError"/"SyntaxError" name
  hasJSRuntimeErrorOfInterest() {
    return this.pageErrors.some(e => {
      const name = (e && e.name) ? e.name : '';
      return ['TypeError', 'ReferenceError', 'SyntaxError'].includes(name);
    });
  }
}

test.describe('Dijkstra Algorithm Interactive App - FSM validation', () => {
  // Create a fresh page and page model for each test to isolate state
  test.beforeEach(async ({ page }) => {
    // nothing here: individual tests will create their own DijkstraPage and navigate
  });

  test.afterEach(async ({ page }) => {
    // ensure any leftover dialogs are closed
    try {
      await page.close();
    } catch (e) {
      // ignore
    }
  });

  test.describe('Initial State: S0_Idle', () => {
    test('S0: Page loads and Idle UI elements are present (Start & Reset buttons, graph container)', async ({ page }) => {
      // This test validates the initial idle state:
      // - The page loads
      // - Start and Reset buttons exist and are enabled
      // - Graph container exists (even if it's a div and not a canvas)
      // - The page scripts may produce runtime errors during load; we assert that errors are observed (as required)
      const app = new DijkstraPage(page);
      await app.goto();

      const start = await app.startButton();
      const reset = await app.resetButton();
      const graph = await app.graphElement();

      await expect(start).toBeVisible();
      await expect(start).toBeEnabled();
      await expect(reset).toBeVisible();
      await expect(reset).toBeEnabled();
      await expect(graph).toBeVisible();

      // The implementation contains several JS issues (e.g. getContext on a div, bad references).
      // We assert that at least one JS runtime error occurred during page load.
      const errors = app.getErrors();
      expect(errors.length).toBeGreaterThanOrEqual(1);

      // Also assert that at least one of the errors is a common JS error type (TypeError/ReferenceError/SyntaxError)
      expect(app.hasJSRuntimeErrorOfInterest()).toBeTruthy();

      // Ensure console captured messages (helps debugging) - not required to be non-empty, but we record them
      const consoleMsgs = app.getConsoleMessages();
      expect(consoleMsgs).toBeInstanceOf(Array);
    });
  });

  test.describe('Transition: StartButtonClick (S0 -> S1 and S2 -> S1)', () => {
    test('S1: Clicking Start triggers algorithm execution (or at least the start handler) and surfaces runtime errors', async ({ page }) => {
      // This test validates:
      // - Clicking Start runs the click handler attached in the page.
      // - Because the page has runtime issues, we expect additional errors to be emitted upon clicking.
      // - Buttons remain present and usable after the click.
      const app = new DijkstraPage(page);
      await app.goto();

      const initialErrorCount = app.getErrors().length;

      // Click Start to transition to "Algorithm Running"
      await app.clickStart();

      // After clicking, we expect either the algorithm executed or runtime errors were produced by the click handler
      const postClickErrors = app.getErrors();
      expect(postClickErrors.length).toBeGreaterThanOrEqual(initialErrorCount);

      // At minimum, ensure a JS runtime error occurred either during load or after clicking
      expect(app.hasJSRuntimeErrorOfInterest()).toBeTruthy();

      // Validate UI still has buttons and they are clickable
      const start = await app.startButton();
      const reset = await app.resetButton();
      await expect(start).toBeVisible();
      await expect(reset).toBeVisible();

      // Clicking start again should not crash the test runner; it may produce more page errors which we allow
      await app.clickStart();
      await expect(start).toBeEnabled();
    });

    test('Edge case: Clicking Start multiple times (idempotency / repeated transitions)', async ({ page }) => {
      // Validate repeated Start clicks while in S1 or returning to S1 do not cause the test to hang.
      const app = new DijkstraPage(page);
      await app.goto();

      // Click Start several times in quick succession
      await app.clickStart();
      await app.clickStart();
      await app.clickStart();

      // Allow errors to propagate
      const errors = app.getErrors();
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(app.hasJSRuntimeErrorOfInterest()).toBeTruthy();

      // Ensure UI remains responsive: Start still present and Reset present
      await expect(app.startButton()).toBeVisible();
      await expect(app.resetButton()).toBeVisible();
    });
  });

  test.describe('Transition: ResetButtonClick (S1 -> S2)', () => {
    test('S2: Clicking Reset after Start resets the visualization (or runs reset handler) and surfaces runtime errors', async ({ page }) => {
      // Validate:
      // - Reset button exists and clicking it runs the handler.
      // - Because of implementation issues, runtime errors may occur; assert they do.
      const app = new DijkstraPage(page);
      await app.goto();

      // Try clicking Reset before Start as an edge case
      await app.clickReset();

      // Clicking reset likely triggers similar drawing code and errors; ensure errors exist
      const errorsAfterResetFirst = app.getErrors();
      expect(errorsAfterResetFirst.length).toBeGreaterThanOrEqual(1);
      expect(app.hasJSRuntimeErrorOfInterest()).toBeTruthy();

      // Now click Start to enter "Algorithm Running" and then Reset to go to "Algorithm Reset"
      await app.clickStart();
      const errorsAfterStart = app.getErrors();
      // errors may increase or stay; ensure the array is accessible
      expect(Array.isArray(errorsAfterStart)).toBeTruthy();

      // Now click Reset again to simulate S1 -> S2 transition
      await app.clickReset();
      await app.page.waitForTimeout(150);

      // Confirm errors captured (the handlers call the same broken drawing code)
      const finalErrors = app.getErrors();
      expect(finalErrors.length).toBeGreaterThanOrEqual(1);
      expect(app.hasJSRuntimeErrorOfInterest()).toBeTruthy();

      // Validate that buttons still present and enabled after reset
      await expect(app.startButton()).toBeVisible();
      await expect(app.resetButton()).toBeVisible();
      await expect(app.startButton()).toBeEnabled();
      await expect(app.resetButton()).toBeEnabled();
    });

    test('Edge case: Reset before any algorithm execution', async ({ page }) => {
      // Validate calling Reset in idle state does not crash the test runner and emits errors as expected.
      const app = new DijkstraPage(page);
      await app.goto();

      // Click Reset (S0 -> S2 might not be a defined direct transition in FSM, but we test robustness)
      await app.clickReset();

      const errs = app.getErrors();
      expect(errs.length).toBeGreaterThanOrEqual(1);
      expect(app.hasJSRuntimeErrorOfInterest()).toBeTruthy();
    });
  });

  test.describe('State cycle: S0 -> S1 -> S2 -> S1', () => {
    test('Cycle through Start -> Reset -> Start and assert handlers invoked and errors captured', async ({ page }) => {
      // This test validates the full transition cycle described in FSM:
      // - Start (executeDijkstra)
      // - Reset (resetGraph)
      // - Start again (executeDijkstra)
      // The actual page contains implementation bugs; we assert that the handlers are invoked and errors are produced.
      const app = new DijkstraPage(page);
      await app.goto();

      // Track initial errors
      const before = app.getErrors().length;

      // Start (S0 -> S1)
      await app.clickStart();
      const afterStart = app.getErrors().length;
      expect(afterStart).toBeGreaterThanOrEqual(before);

      // Reset (S1 -> S2)
      await app.clickReset();
      const afterReset = app.getErrors().length;
      expect(afterReset).toBeGreaterThanOrEqual(afterStart);

      // Start again (S2 -> S1)
      await app.clickStart();
      const afterSecondStart = app.getErrors().length;
      expect(afterSecondStart).toBeGreaterThanOrEqual(afterReset);

      // Ensure at least one runtime error of interest has been captured across the cycle
      expect(app.hasJSRuntimeErrorOfInterest()).toBeTruthy();

      // Confirm UI elements persist across transitions
      await expect(app.startButton()).toBeVisible();
      await expect(app.resetButton()).toBeVisible();
    });
  });

  test.describe('Diagnostics: Inspect console and error details', () => {
    test('Collect and report console messages and error names (ensures we observe natural runtime failures)', async ({ page }) => {
      // This test gathers diagnostics and asserts that the page produced JS errors with identifiable names.
      const app = new DijkstraPage(page);
      await app.goto();

      // Trigger some interactions to surface errors
      await app.clickStart();
      await app.clickReset();

      const errors = app.getErrors();
      const consoleMsgs = app.getConsoleMessages();

      // We expect at least one page error (runtime exception)
      expect(errors.length).toBeGreaterThanOrEqual(1);

      // Check that errors include a recognizable JS error name
      const names = errors.map(e => e && e.name ? e.name : 'Unknown');
      const hasKnownName = names.some(n => ['TypeError', 'ReferenceError', 'SyntaxError'].includes(n));
      expect(hasKnownName).toBeTruthy();

      // Console messages may or may not include helpful logs; assert we captured an array
      expect(Array.isArray(consoleMsgs)).toBeTruthy();

      // For debugging, ensure we can access error messages (non-empty strings)
      const msgs = errors.map(e => (e && e.message) ? e.message : String(e));
      expect(msgs.some(m => typeof m === 'string' && m.length > 0)).toBeTruthy();
    });
  });

  test.describe('Robustness and UI invariants', () => {
    test('Buttons remain actionable after repeated error-producing interactions', async ({ page }) => {
      // Validate that repeated interactions (which provoke errors) do not remove or disable the control buttons
      const app = new DijkstraPage(page);
      await app.goto();

      const start = await app.startButton();
      const reset = await app.resetButton();

      // Perform repeated interactions
      for (let i = 0; i < 5; i++) {
        await app.clickStart();
        await app.clickReset();
      }

      // Buttons should still exist and be enabled
      await expect(start).toBeVisible();
      await expect(reset).toBeVisible();
      await expect(start).toBeEnabled();
      await expect(reset).toBeEnabled();

      // Ensure errors have been collected (since the drawing code is broken)
      expect(app.getErrors().length).toBeGreaterThanOrEqual(1);
    });
  });
});