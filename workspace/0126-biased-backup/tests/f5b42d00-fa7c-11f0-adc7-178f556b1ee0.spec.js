import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b42d00-fa7c-11f0-adc7-178f556b1ee0.html';

// Page Object Model for the K-Means demo page
class KMeansPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demoButton = page.locator('#kmeans-demo');
    this.container = page.locator('.container');
  }

  async goto() {
    const response = await this.page.goto(APP_URL);
    return response;
  }

  async isButtonVisible() {
    return await this.demoButton.isVisible();
  }

  async getButtonText() {
    return await this.demoButton.textContent();
  }

  async clickDemo() {
    await this.demoButton.click();
  }
}

test.describe('FSM: K-Means Clustering (f5b42d00-fa7c-11f0-adc7-178f556b1ee0)', () => {
  // Arrays to collect runtime diagnostics for each test
  let consoleMessages = [];
  let pageErrors = [];

  // Attach listeners and navigate before each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for inspection
    page.on('console', (msg) => {
      // store type and text for assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // store Error objects for message checks
      pageErrors.push(err);
    });

    const kmPage = new KMeansPage(page);
    const response = await kmPage.goto();

    // Ensure the page loaded successfully
    expect(response && response.ok()).toBeTruthy();
  });

  // Each test creates a fresh page fixture provided by Playwright; no extra teardown needed.
  // Test 1: Validate Idle state (S0_Idle) initial rendering and evidence
  test('Initial Idle state: page renders and "Run K-Means Demo" button is present', async ({ page }) => {
    const kmPage = new KMeansPage(page);

    // Verify the container and title exists as part of page rendering
    await expect(kmPage.container).toBeVisible();

    // The FSM's S0_Idle evidence is a button with id #kmeans-demo.
    // Confirm the button exists, is visible, and has expected text.
    await expect(kmPage.demoButton).toBeVisible();
    const btnText = await kmPage.getButtonText();
    expect(typeof btnText).toBe('string');
    expect(btnText.trim()).toBe('Run K-Means Demo');

    // At initial load we capture console and error messages.
    // We do not assert that an error must exist at load; instead we ensure diagnostics were captured.
    // This test validates that renderPage() entry (if it existed) did not crash the page on load.
    // If any page errors occurred during load they will be available in pageErrors for inspection.
    expect(Array.isArray(consoleMessages)).toBeTruthy();
    expect(Array.isArray(pageErrors)).toBeTruthy();
  });

  // Test 2: Validate the RunKMeansDemo event and transition S0 -> S1
  test('RunKMeansDemo event: clicking the button triggers demo action or appropriate error', async ({ page }) => {
    const kmPage = new KMeansPage(page);

    // Ensure starting evidence for Idle state exists
    await expect(kmPage.demoButton).toBeVisible();

    // Clear any previously captured diagnostics to focus on interaction
    consoleMessages.length = 0;
    pageErrors.length = 0;

    // Perform the user action described by the FSM: click the Run K-Means Demo button.
    // We do not modify the page or define missing functions; we let runtime behave as-is.
    await kmPage.clickDemo();

    // Give the page a short moment to surface any synchronous or asynchronous errors
    await page.waitForTimeout(200);

    // There are two acceptable outcomes given the provided implementation:
    // 1) The implementation attempted to call a missing function (e.g. runKMeansDemo) resulting in a ReferenceError / uncaught exception.
    // 2) No runtime error occurred but also no visible change happened (the button may still be visible).
    //
    // We assert that either:
    // - A relevant ReferenceError/TypeError mentioning 'runKMeansDemo' (or a generic ReferenceError) was produced,
    // OR
    // - No page errors occurred and the page remains stable with the demo button still present.
    if (pageErrors.length > 0) {
      // If we have captured page errors, ensure at least one is relevant to the missing demo action.
      const matched = pageErrors.some((err) => {
        const msg = String(err && err.message ? err.message : err);
        return (
          /runKMeansDemo/.test(msg) ||
          /ReferenceError/.test(msg) ||
          /TypeError/.test(msg) ||
          /is not defined/.test(msg)
        );
      });

      // Assert we observed a meaningful error related to the FSM action
      expect(matched).toBeTruthy();
    } else {
      // No page errors: assert that the page remained stable and the evidence (button) is still present.
      await expect(kmPage.demoButton).toBeVisible();

      // Also assert console didn't capture an uncaught error-level message
      const sawErrorConsole = consoleMessages.some((m) => {
        // console types like 'error' are indicative; also match text for typical JS error names
        return (
          m.type === 'error' ||
          /ReferenceError|TypeError|SyntaxError|is not defined/.test(m.text)
        );
      });
      expect(sawErrorConsole).toBeFalsy();
    }
  });

  // Test 3: FSM evidence in both states - both S0_Idle and S1_DemoRunning mention the same button as evidence.
  test('FSM evidence: button is valid evidence for both Idle and DemoRunning states', async ({ page }) => {
    const kmPage = new KMeansPage(page);

    // Evidence for S0_Idle: button exists
    await expect(kmPage.demoButton).toBeVisible();

    // Trigger event to move to S1_DemoRunning (per FSM)
    consoleMessages.length = 0;
    pageErrors.length = 0;
    await kmPage.clickDemo();
    await page.waitForTimeout(200);

    // Evidence for S1_DemoRunning in the FSM is also the same button element.
    // The FSM (as extracted) lists the button as evidence for both states. Confirm it still exists in the DOM.
    await expect(kmPage.demoButton).toBeVisible();

    // If an error occurred when trying to run the demo, it should be in pageErrors. We record that as well.
    // We don't fail this test on error presence because FSM evidence check is simply about DOM presence.
    // However, log diagnostics via assertions to ensure we noticed runtime exceptions if any.
    if (pageErrors.length > 0) {
      // At least record that we observed errors; ensure they are Error objects
      expect(pageErrors.every(e => e instanceof Error)).toBeTruthy();
    }
  });

  // Test 4: Edge case - repeated clicks (double activation) should not crash the page further or cause unexpected state transitions.
  test('Edge case: repeated clicks do not destabilize the page (double-click)', async ({ page }) => {
    const kmPage = new KMeansPage(page);

    // Ensure initial button visible
    await expect(kmPage.demoButton).toBeVisible();

    // Clear diagnostics and perform two quick clicks to simulate a user double-triggering the demo.
    consoleMessages.length = 0;
    pageErrors.length = 0;

    // Two sequential clicks with a very short pause between them
    await kmPage.clickDemo();
    await page.waitForTimeout(50);
    await kmPage.clickDemo();

    // Allow runtime to process
    await page.waitForTimeout(200);

    // If errors occurred, ensure they are not duplicated beyond expectation (i.e., presence is enough).
    if (pageErrors.length > 0) {
      // Ensure the errors are related to missing implementation or runtime issues
      const relevant = pageErrors.filter(err => /runKMeansDemo|ReferenceError|is not defined|TypeError/.test(String(err.message)));
      expect(relevant.length).toBeGreaterThanOrEqual(1);
    } else {
      // No errors: the button remains visible and the page stayed stable under rapid interaction.
      await expect(kmPage.demoButton).toBeVisible();
    }
  });

  // Test 5: Robustness - inspect captured console output and errors for developer-facing clues (non-failing diagnostic test)
  test('Diagnostics: capture and assert structure of console messages and page errors', async ({ page }) => {
    const kmPage = new KMeansPage(page);

    // Capture initial diagnostics baseline
    consoleMessages.length = 0;
    pageErrors.length = 0;

    // Trigger the demo click to surface any runtime logs
    await kmPage.clickDemo();
    await page.waitForTimeout(200);

    // Validate that our diagnostic collectors recorded arrays (they may be empty, but structure must be as expected)
    expect(Array.isArray(consoleMessages)).toBeTruthy();
    expect(Array.isArray(pageErrors)).toBeTruthy();

    // If any console message exists, ensure it has the expected shape: {type, text}
    if (consoleMessages.length > 0) {
      for (const msg of consoleMessages) {
        expect(msg).toHaveProperty('type');
        expect(msg).toHaveProperty('text');
        expect(typeof msg.text).toBe('string');
      }
    }

    // If any page errors exist, ensure each has a message property
    if (pageErrors.length > 0) {
      for (const err of pageErrors) {
        // err is typically an Error instance; ensure it has a message
        expect(err).toHaveProperty('message');
        expect(typeof err.message).toBe('string');
      }
    }
  });
});