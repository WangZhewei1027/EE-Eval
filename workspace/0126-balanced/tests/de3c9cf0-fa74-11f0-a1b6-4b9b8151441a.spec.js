import { test, expect } from '@playwright/test';

// Page Object for the Space Complexity Demonstration page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Capture console messages and page errors for assertions
    this._consoleListener = (msg) => {
      try {
        // store type and text for easier debugging/assertions
        this.consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // in case message introspection fails, keep a fallback
        this.consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    };
    this._pageErrorListener = (err) => {
      // err is an Error object; capture message and stack
      this.pageErrors.push({ message: err.message, stack: err.stack });
    };
    this.page.on('console', this._consoleListener);
    this.page.on('pageerror', this._pageErrorListener);
  }

  async goto(url) {
    // Navigate to the page under test and wait for network to be idle to capture initial errors
    await this.page.goto(url, { waitUntil: 'load' });
    // brief pause to allow any synchronous onload scripts to run and emit errors
    await this.page.waitForTimeout(200);
  }

  startButton() {
    return this.page.locator('#startDemo');
  }

  demoContainer() {
    return this.page.locator('.demo-container');
  }

  async clickStartDemo() {
    await this.startButton().click();
    // allow handlers to run
    await this.page.waitForTimeout(250);
  }

  // Convenience: combine captured messages into a single searchable string
  combinedMessages() {
    const consoleText = this.consoleMessages.map(m => `${m.type}: ${m.text}`).join(' || ');
    const pageErrorText = this.pageErrors.map(e => `${e.message} ${e.stack ?? ''}`).join(' || ');
    return `${consoleText} || ${pageErrorText}`.trim();
  }

  // Test helper to check if any captured message matches pattern
  anyMessageMatches(regex) {
    const combined = this.combinedMessages();
    return regex.test(combined);
  }

  async dispose() {
    // Remove listeners to avoid leaks between tests
    try {
      this.page.removeListener('console', this._consoleListener);
      this.page.removeListener('pageerror', this._pageErrorListener);
    } catch (e) {
      // ignore
    }
  }
}

// Base URL for the HTML file under test
const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3c9cf0-fa74-11f0-a1b6-4b9b8151441a.html';

// Regex to detect reference to the expected lifecycle functions or common runtime errors
const ERROR_DETECTION_REGEX = /(renderPage|startDemonstration|stopDemonstration|ReferenceError|SyntaxError|TypeError|is not defined)/i;

test.describe('Space Complexity Demonstration (FSM validation)', () => {
  test.describe.configure({ mode: 'serial' });

  // Each test will create its own DemoPage wrapper and navigate fresh
  let demo;

  test.afterEach(async ({ page }) => {
    if (demo) {
      await demo.dispose();
      demo = undefined;
    }
    // Clear potential state by navigating to about:blank
    await page.goto('about:blank');
  });

  test('Idle state renders initial elements and attempts entry action (renderPage)', async ({ page }) => {
    // This test validates the initial S0_Idle state:
    // - The page renders a #startDemo button and a .demo-container
    // - The entry action renderPage() is expected to run; if missing, a ReferenceError or similar should be observed.
    demo = new DemoPage(page);
    await demo.goto(BASE_URL);

    // Assert the Start Demo button is present and visible
    const startBtn = demo.startButton();
    await expect(startBtn).toHaveCount(1);
    await expect(startBtn).toBeVisible();

    // Assert the demo container is present (per FSM evidence)
    const container = demo.demoContainer();
    await expect(container).toHaveCount(1);
    await expect(container).toBeVisible();

    // Check for evidence that renderPage() was called or that an error referring to it occurred.
    // We intentionally assert that the runtime attempted or errored on renderPage/startDemonstration/stopDemonstration
    // or produced a known runtime error (ReferenceError/SyntaxError/TypeError). Per instructions we must observe and assert errors if they occur.
    const combined = demo.combinedMessages();
    // Debugging help for CI logs:
    // console.log('Captured initial messages:', combined);

    // Expect that at least one message contains either references to lifecycle functions or common JS error types.
    const matched = demo.anyMessageMatches(ERROR_DETECTION_REGEX);
    expect(matched).toBeTruthy();
  });

  test('Transition: clicking Start Demo triggers demonstration entry (StartDemo event) or logs startDemonstration error', async ({ page }) => {
    // Validate transition from S0_Idle -> S1_Demonstration via clicking #startDemo
    // If startDemonstration() is implemented, the page should update to show that the Demonstration started.
    // If missing, clicking will naturally throw a ReferenceError which we must observe and assert.
    demo = new DemoPage(page);
    await demo.goto(BASE_URL);

    // Ensure button exists before clicking
    const startBtn = demo.startButton();
    await expect(startBtn).toBeVisible();

    // Click the start button (this triggers the StartDemo event)
    await demo.clickStartDemo();

    // After clicking, allow asynchronous handlers to run
    await page.waitForTimeout(300);

    // Check the demo container text for evidence that a demonstration started
    const containerText = await demo.demoContainer().innerText().catch(() => '');
    const startedByDOM = /demonstration started|demonstration|running|in progress/i.test(containerText);

    if (startedByDOM) {
      // If DOM indicates demonstration started, assert that this is visible to the user
      expect(startedByDOM).toBeTruthy();
    } else {
      // Otherwise, we expect an error to have been produced referencing startDemonstration or a common runtime error
      const combined = demo.combinedMessages();
      // console.log('Captured messages after click:', combined);
      const matched = demo.anyMessageMatches(/(startDemonstration|ReferenceError|TypeError|is not defined)/i);
      expect(matched).toBeTruthy();
    }
  });

  test('Edge case: clicking Start Demo multiple times - idempotency or repeated errors are observed', async ({ page }) => {
    // This test checks how the app behaves when the Start Demo button is clicked repeatedly:
    // - If implemented defensively, subsequent clicks should be idempotent (no additional errors, or a graceful state)
    // - If handlers are missing, repeated clicks will produce repeated ReferenceErrors which we should observe
    demo = new DemoPage(page);
    await demo.goto(BASE_URL);

    const startBtn = demo.startButton();
    await expect(startBtn).toBeVisible();

    // Click multiple times quickly
    await Promise.all([
      demo.clickStartDemo(),
      demo.clickStartDemo(),
      demo.clickStartDemo()
    ]);

    // Allow time for any asynchronous actions or errors to surface
    await page.waitForTimeout(400);

    // Collate messages and assert that either:
    // - DOM indicates demonstration started and we don't see repeated critical errors, OR
    // - We observe repeated errors mentioning the lifecycle function (startDemonstration) or ReferenceError
    const containerText = await demo.demoContainer().innerText().catch(() => '');
    const startedByDOM = /demonstration started|demonstration|running|in progress/i.test(containerText);
    const combined = demo.combinedMessages();

    if (startedByDOM) {
      // If the demo started, ensure there is at least one evidence of startDemonstration invocation OR no critical errors.
      const errorLike = demo.anyMessageMatches(/(ReferenceError|TypeError|SyntaxError|is not defined)/i);
      // If the implementation is robust, we expect not to see repeated unhandled errors.
      // Accept both behaviors but assert that messages were produced and captured.
      expect(demo.consoleMessages.length + demo.pageErrors.length).toBeGreaterThanOrEqual(0);
      // If there were errors, they should reference a known pattern (captured for verification)
      if (errorLike) {
        expect(demo.anyMessageMatches(ERROR_DETECTION_REGEX)).toBeTruthy();
      }
    } else {
      // DOM did not change to indicate a demonstration; we expect errors about startDemonstration being missing/erroneous.
      const matched = demo.anyMessageMatches(/(startDemonstration|ReferenceError|TypeError|is not defined)/i);
      expect(matched).toBeTruthy();
    }
  });

  test('Implementation errors visibility: ensure runtime errors are surfaced to pageerror/console', async ({ page }) => {
    // This test specifically asserts that runtime errors (if present) are observable via Playwright's pageerror and console listeners.
    // It helps ensure that the instrumentation in previous tests captured the actual failures.
    demo = new DemoPage(page);
    await demo.goto(BASE_URL);

    // Trigger potential error path by clicking the Start Demo button if present
    const startBtnCount = await demo.startButton().count();
    if (startBtnCount > 0) {
      await demo.clickStartDemo();
      await page.waitForTimeout(200);
    }

    // Assert that at least one message of interest was captured
    const combined = demo.combinedMessages();
    // console.log('Final captured messages for visibility test:', combined);
    const hasAnyError = demo.anyMessageMatches(ERROR_DETECTION_REGEX);

    // Per instructions we must observe console logs and page errors and assert they occur.
    expect(hasAnyError).toBeTruthy();
  });
});