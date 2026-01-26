import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/0444f422-fa79-11f0-8a8e-bbe4f11717c6.html';

class RandomForestPage {
  /**
   * Page object for the Random Forest example.
   * Collects console messages and page errors for assertions.
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Collect console messages and page errors for later assertions.
    this.page.on('console', msg => {
      // store shallow copy of useful info
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    this.page.on('pageerror', error => {
      // pageerror emits an Error object
      this.pageErrors.push(error);
    });
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickGenerate() {
    await this.page.click(".button[onclick='generateRandomForest()']");
  }

  async clickDisplay() {
    await this.page.click(".button[onclick='displayRandomForest()']");
  }

  // Polling helper to wait until a console message that contains the expected text appears.
  async waitForConsoleContains(expectedText, timeout = 2000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (this.consoleMessages.some(m => m.text.includes(expectedText))) {
        return;
      }
      // small delay
      await new Promise(res => setTimeout(res, 50));
    }
    throw new Error(`Timed out waiting for console message containing: "${expectedText}". Collected messages: ${JSON.stringify(this.consoleMessages)}`);
  }

  // Return number of console messages that contain the given text.
  countConsoleContains(text) {
    return this.consoleMessages.filter(m => m.text.includes(text)).length;
  }

  // Reset collected messages/errors between steps if needed.
  resetCollected() {
    this.consoleMessages = [];
    this.pageErrors = [];
  }
}

test.describe('Random Forest FSM - Interactive Application', () => {
  // Use a fresh page for each test to avoid state bleed.
  test.beforeEach(async ({ page }) => {
    // nothing here; page object will be created per-test
  });

  test('S0_Idle: Initial render shows expected elements and no runtime errors on load', async ({ page }) => {
    // This test validates the Idle state: page renders correctly with two buttons and no page errors.
    const rf = new RandomForestPage(page);
    await rf.goto();

    // Verify document title and main headings to confirm page rendered.
    await expect(page).toHaveTitle(/Random Forest/);

    // Verify the two expected buttons are present and have correct text.
    const generateBtn = page.locator(".button[onclick='generateRandomForest()']");
    const displayBtn = page.locator(".button[onclick='displayRandomForest()']");

    await expect(generateBtn).toBeVisible();
    await expect(displayBtn).toBeVisible();

    await expect(generateBtn).toHaveText('Generate Random Forest');
    await expect(displayBtn).toHaveText('Display Random Forest');

    // No console messages should exist before any interaction (apart from possible benign browser messages).
    // We assert that there are no uncaught page errors.
    expect(rf.pageErrors.length).toBe(0);
  });

  test('Transition GenerateRandomForest -> S1_RandomForestGenerated: clicking Generate logs expected message', async ({ page }) => {
    // This test validates the GenerateRandomForest event and S1 entry action observation.
    const rf = new RandomForestPage(page);
    await rf.goto();

    // Ensure no pre-existing messages
    rf.resetCollected();

    // Click the Generate button and wait for the expected console log.
    await rf.clickGenerate();

    // Wait and assert the console printed the expected message.
    await rf.waitForConsoleContains('Random Forest generated');

    // Verify at least one such message was produced.
    const count = rf.countConsoleContains('Random Forest generated');
    expect(count).toBeGreaterThanOrEqual(1);

    // Verify no uncaught page errors occurred as a result of clicking.
    expect(rf.pageErrors.length).toBe(0);

    // Verify DOM remains consistent (buttons still present) to show that transition didn't break UI.
    await expect(page.locator(".button[onclick='generateRandomForest()']")).toBeVisible();
    await expect(page.locator(".button[onclick='displayRandomForest()']")).toBeVisible();
  });

  test('Transition DisplayRandomForest -> S2_RandomForestDisplayed: clicking Display logs expected message', async ({ page }) => {
    // This test validates the DisplayRandomForest event and S2 entry action observation.
    const rf = new RandomForestPage(page);
    await rf.goto();

    // Clear any messages
    rf.resetCollected();

    // Click the Display button and wait for the expected console log.
    await rf.clickDisplay();
    await rf.waitForConsoleContains('Random Forest displayed');

    const count = rf.countConsoleContains('Random Forest displayed');
    expect(count).toBeGreaterThanOrEqual(1);

    // No uncaught page errors should be present.
    expect(rf.pageErrors.length).toBe(0);

    // Buttons still exist after display call.
    await expect(page.locator(".button[onclick='generateRandomForest()']")).toBeVisible();
    await expect(page.locator(".button[onclick='displayRandomForest()']")).toBeVisible();
  });

  test('Edge case: Rapid repeated clicks produce multiple logs and no errors', async ({ page }) => {
    // This test validates robustness: multiple rapid clicks should log multiple messages and not throw errors.
    const rf = new RandomForestPage(page);
    await rf.goto();

    rf.resetCollected();

    // Rapidly click Generate 3 times and Display 2 times.
    await Promise.all([
      rf.clickGenerate(),
      rf.clickGenerate(),
      rf.clickGenerate(),
      rf.clickDisplay(),
      rf.clickDisplay()
    ]).catch(() => {
      // clicks may race; do not swallow errors — they will be asserted below by checking pageErrors
    });

    // Wait for expected messages to appear (sum of events).
    await rf.waitForConsoleContains('Random Forest generated', 3000);
    await rf.waitForConsoleContains('Random Forest displayed', 3000);

    // Expect at least 3 generated logs and at least 2 displayed logs.
    const genCount = rf.countConsoleContains('Random Forest generated');
    const dispCount = rf.countConsoleContains('Random Forest displayed');

    expect(genCount).toBeGreaterThanOrEqual(3);
    expect(dispCount).toBeGreaterThanOrEqual(2);

    // Ensure no uncaught exceptions bubbled up to the page level.
    expect(rf.pageErrors.length).toBe(0);
  });

  test('Verify onEnter action referenced in FSM (renderPage) is not defined in the page and invoking it raises ReferenceError', async ({ page }) => {
    // The FSM lists renderPage() as an entry action for the Idle state.
    // The HTML implementation does not define renderPage(); per requirements we must try to verify onEnter/onExit actions.
    // We will attempt to call renderPage() and assert that a ReferenceError (or similar) is thrown by the page context.
    const rf = new RandomForestPage(page);
    await rf.goto();

    // Attempt to invoke renderPage in page context; this should reject with a ReferenceError because renderPage is not defined.
    // We do not modify the page; we simply call the function to observe the natural runtime error.
    await expect(page.evaluate(() => {
      // direct invocation; will throw in page context if function is missing
      // DO NOT catch the error here, allow it to surface so Playwright's evaluate rejects.
      // eslint-disable-next-line no-undef
      return renderPage();
    })).rejects.toThrow(/(renderPage is not defined|ReferenceError)/);
  });

  test('Error scenario: deliberately invoking non-existent function to confirm natural error propagation', async ({ page }) => {
    // Additional explicit error scenario as an edge case: call a clearly non-existent function and assert the page error propagates.
    // This confirms we can observe and assert runtime ReferenceError behavior without patching the app.
    const rf = new RandomForestPage(page);
    await rf.goto();

    rf.resetCollected();

    // We expect this evaluation to reject with an error indicating the function is not defined.
    await expect(page.evaluate(() => {
      // Intentionally call a function that doesn't exist on purpose for this test.
      // eslint-disable-next-line no-undef
      return someNonExistentFunctionForTestPurposes();
    })).rejects.toThrow(/(someNonExistentFunctionForTestPurposes is not defined|ReferenceError)/);

    // There may be no pageerror emitted for evaluate() thrown ReferenceError — but if any page errors did occur, collect them.
    // Assert that pageErrors is an array (we don't require it to be non-empty because page.evaluate may throw before an uncaught page error is registered).
    expect(Array.isArray(rf.pageErrors)).toBe(true);
  });

  test('Combined transitions: click generate then display and verify logs order', async ({ page }) => {
    // Validate sequence: transitioning from Idle->Generated then Displayed should produce logs in expected order.
    const rf = new RandomForestPage(page);
    await rf.goto();
    rf.resetCollected();

    // Click Generate then Display with a small gap to preserve ordering.
    await rf.clickGenerate();
    // short wait to ensure the generate console message is produced before the next click
    await new Promise(res => setTimeout(res, 100));
    await rf.clickDisplay();

    // Wait for both expected messages.
    await rf.waitForConsoleContains('Random Forest generated');
    await rf.waitForConsoleContains('Random Forest displayed');

    // Inspect the order of collected console messages to ensure 'generated' comes before 'displayed'
    const logs = rf.consoleMessages.map(m => m.text);
    const genIndex = logs.findIndex(t => t.includes('Random Forest generated'));
    const dispIndex = logs.findIndex(t => t.includes('Random Forest displayed'));

    expect(genIndex).toBeGreaterThanOrEqual(0);
    expect(dispIndex).toBeGreaterThanOrEqual(0);
    expect(genIndex).toBeLessThan(dispIndex);

    // Ensure no page-level errors.
    expect(rf.pageErrors.length).toBe(0);
  });
});