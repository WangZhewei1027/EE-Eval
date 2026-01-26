import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8cdf51-fa77-11f0-8492-31e949ed3c7c.html';

/**
 * Page Object Model for the Multiset Visualization page.
 * Encapsulates selectors and common interactions so tests remain readable.
 */
class MultisetPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.container = page.locator('.container');
    this.heading = page.locator('h1');
    this.description = page.locator('p');
    this.graphic = page.locator('.graphic');
    this.elements = page.locator('.element');
    this.button = page.locator('.button');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async countElements() {
    return this.elements.count();
  }

  async getElementTexts() {
    const count = await this.elements.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push(await this.elements.nth(i).innerText());
    }
    return texts;
  }

  async clickButtonExpectDialog() {
    // Wait for a dialog event and click the button.
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.button.click()
    ]);
    return dialog;
  }
}

test.describe('Multiset Visualization - FSM validation (ed8cdf51-fa77-11f0-8492-31e949ed3c7c)', () => {
  // Arrays to capture console messages and page errors for observation
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console outputs for inspection
    page.on('console', msg => {
      // collect text and type for deeper assertions if needed
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled page errors (ReferenceError, SyntaxError, TypeError, etc.)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the application under test as-is
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Allow a tick for any late errors to surface
    await page.waitForTimeout(50);
    // detach listeners implicitly by ending test scope; arrays remain for assertions in each test
  });

  test('Idle state: page renders correctly with all multiset elements and button present', async ({ page }) => {
    // This test validates the S0_Idle state: initial render of the page, visual components, and absence of unexpected runtime errors.
    const app = new MultisetPage(page);

    // Verify container and headings are present and visible
    await expect(app.container).toBeVisible();
    await expect(app.heading).toHaveText('Multiset Visualization');
    await expect(app.description).toHaveText('Observe the beautiful elements of a multiset.');

    // Verify the graphic grid and that it contains the expected number of elements (10 total)
    const elementCount = await app.countElements();
    expect(elementCount).toBe(10);

    // Verify the text content of each element (counts of letters)
    const texts = await app.getElementTexts();
    // Count occurrences of letters A-E
    const counts = texts.reduce((acc, t) => {
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {});
    // From the HTML: A x3, B x2, C x2, D x2, E x1
    expect(counts['A']).toBe(3);
    expect(counts['B']).toBe(2);
    expect(counts['C']).toBe(2);
    expect(counts['D']).toBe(2);
    expect(counts['E']).toBe(1);

    // Verify button exists with expected label
    await expect(app.button).toBeVisible();
    await expect(app.button).toHaveText('Click Me');

    // Ensure no page runtime errors occurred during initial render (we observe console and pageerrors)
    // The FSM mentioned an entry action "renderPage()" for S0. The HTML does not call renderPage(), so no ReferenceError is expected.
    expect(pageErrors.length).toBe(0);

    // Optionally assert that there are console messages but none are errors (if any)
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_AlertDisplayed: clicking the button triggers alert with expected text', async ({ page }) => {
    // This test validates the ButtonClick event and the transition to AlertDisplayed where alert('Thanks for watching!') is invoked.
    const app = new MultisetPage(page);

    // Prepare to capture the dialog triggered by the inline onclick handler.
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      app.button.click()
    ]);

    // Verify the dialog message matches the FSM expected observable
    expect(dialog.message()).toBe("Thanks for watching!");

    // Accept the dialog so subsequent operations continue
    await dialog.accept();

    // After the alert, ensure page remains stable and elements/buttons still present.
    await expect(app.container).toBeVisible();
    await expect(app.button).toBeVisible();

    // Confirm that no uncaught page errors were raised as a result of the click/alert
    expect(pageErrors.length).toBe(0);
  });

  test('Alert can be triggered multiple times: consecutive clicks produce dialogs each time', async ({ page }) => {
    // This test validates repeated transitions: repeated ButtonClick events should each produce an alert.
    const app = new MultisetPage(page);

    // Click and accept twice in succession, ensuring dialogs are produced twice.
    for (let i = 0; i < 2; i++) {
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        app.button.click()
      ]);
      expect(dialog.message()).toBe("Thanks for watching!");
      await dialog.accept();
    }

    // Ensure no runtime page errors were logged during repeated interactions
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: attempting to interact with a non-existent selector results in a Playwright rejection', async ({ page }) => {
    // This test validates error handling on the test side for invalid interactions (not altering the page).
    // We intentionally attempt to click a selector that does not exist and assert that Playwright throws.
    const missingSelector = '.non-existent-selector-for-testing';

    // Use a short timeout so the rejection happens quickly in case of a real timeout.
    // We expect the click attempt to reject; do not modify the page to create the element.
    await expect(page.click(missingSelector, { timeout: 1000 })).rejects.toThrow();
  });

  test('Observation: capture and assert console and page error streams are empty (no natural JS errors)', async ({ page }) => {
    // This test explicitly examines the collected console messages and page errors during the lifecycle.
    // We do not inject any script nor patch code; we only assert on observed output.
    // Re-check arrays that were populated by beforeEach listeners.

    // There should be no uncaught page errors for this application as provided.
    expect(pageErrors.length).toBe(0);

    // If there are console.error messages, surface them for diagnostic clarity in test failure.
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);

    // There may be info/debug logs - ensure they are strings and well-formed
    for (const msg of consoleMessages) {
      expect(typeof msg.text).toBe('string');
      expect(msg.text.length).toBeGreaterThanOrEqual(0);
    }
  });

  test('DOM integrity after alert: elements remain selectable and unchanged', async ({ page }) => {
    // Validate that firing the alert does not remove or mutate the multiset elements in unexpected ways.
    const app = new MultisetPage(page);

    // Capture initial snapshot of texts
    const before = await app.getElementTexts();

    // Trigger alert and accept it
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      app.button.click()
    ]);
    await dialog.accept();

    // Capture after snapshot
    const after = await app.getElementTexts();

    // Expect no DOM mutation to the element texts as the inline onclick simply shows an alert
    expect(after).toEqual(before);
  });
});