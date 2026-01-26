import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8f5050-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object Model for the HTTP Visual Concept app
class AppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.heading = page.locator('h1');
    this.learnMoreButton = page.locator('button.button');
    this.infoContainer = page.locator('.info');
    this.container = page.locator('.container');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getHeadingText() {
    return this.heading.textContent();
  }

  async isLearnMoreVisible() {
    return this.learnMoreButton.isVisible();
  }

  async getLearnMoreText() {
    return this.learnMoreButton.textContent();
  }

  async getOnclickAttribute() {
    return this.learnMoreButton.getAttribute('onclick');
  }

  async getInfoText() {
    return this.infoContainer.textContent();
  }

  async clickLearnMore() {
    await this.learnMoreButton.click();
  }

  async clickInfo() {
    await this.infoContainer.click();
  }

  async clickContainer() {
    await this.container.click();
  }
}

test.describe('ed8f5050-fa77-11f0-8492-31e949ed3c7c - HTTP Visual Concept (FSM validation)', () => {
  let page;
  let app;
  let consoleMessages;
  let pageErrors;
  let dialogMessages;

  // Common setup for each test: navigate to the app and attach listeners for diagnostics
  test.beforeEach(async ({ browser }) => {
    // create a fresh page per test to avoid cross-test interference
    page = await browser.newPage();
    app = new AppPage(page);

    consoleMessages = [];
    pageErrors = [];
    dialogMessages = [];

    // Collect console messages for inspection
    page.on('console', msg => {
      // Collect type and text for richer debugging if needed
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect any runtime errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Collect dialog messages and automatically accept them so tests can continue
    page.on('dialog', async dialog => {
      try {
        dialogMessages.push(dialog.message());
        await dialog.accept();
      } catch (e) {
        // If accepting fails, still record that a dialog was seen
        dialogMessages.push(`__accept_failed__:${String(e)}`);
      }
    });

    // Navigate to the application page and wait for load
    await app.goto();

    // Ensure the main page content has rendered before tests run
    await expect(app.heading).toBeVisible({ timeout: 5000 });
  });

  // Clean up the page and also assert diagnostics after each test
  test.afterEach(async () => {
    // Assert there are no uncaught page errors (runtime exceptions)
    // This verifies that the page loaded and ran without producing ReferenceError/TypeError/SyntaxError
    // If there are page errors, include them in the assertion failure message for debugging
    if (pageErrors.length > 0) {
      const msgs = pageErrors.map(e => e.stack || e.message || String(e)).join('\n---\n');
      // Close page before failing to avoid leaks
      await page.close();
      throw new Error(`Unexpected runtime errors occurred on the page:\n${msgs}`);
    }

    // Additionally ensure console does not show obvious runtime error indicators
    const errorConsoleEntries = consoleMessages.filter(
      m => /ReferenceError|TypeError|SyntaxError/i.test(m.text)
    );
    if (errorConsoleEntries.length > 0) {
      const msgs = errorConsoleEntries.map(e => `${e.type}: ${e.text}`).join('\n');
      await page.close();
      throw new Error(`Console shows potential runtime errors:\n${msgs}`);
    }

    // Close the page as part of teardown
    await page.close();
  });

  test.describe('Idle state (S0_Idle) validations', () => {
    test('Initial Idle state renders heading and Learn More button with expected attributes', async () => {
      // This test validates the S0_Idle state's evidence:
      // - <h1>Understanding HTTP</h1> is present
      // - <button class="button" onclick="showMore()">Learn More</button> is present
      const headingText = (await app.getHeadingText())?.trim();
      expect(headingText).toBe('Understanding HTTP');

      // The Learn More button should be visible with correct text
      expect(await app.isLearnMoreVisible()).toBe(true);
      const buttonText = (await app.getLearnMoreText())?.trim();
      expect(buttonText).toBe('Learn More');

      // The button should have the onclick attribute calling showMore()
      const onclickAttr = await app.getOnclickAttribute();
      expect(onclickAttr).toBe('showMore()');

      // The info container should contain educational text (entry_actions: renderPage() is implied).
      const infoText = await app.getInfoText();
      expect(infoText).toContain('HTTP, or HyperText Transfer Protocol');
      expect(infoText.length).toBeGreaterThan(20);

      // No dialogs should have been shown yet
      expect(dialogMessages.length).toBe(0);
    });

    test('Info panel has slide-in animation styles applied (visual feedback check)', async () => {
      // Validate that the info element has a computed animation-name or transition applied.
      // This checks visual feedback exists even though we won't match exact animation durations.
      const infoHandle = await page.$('.info');
      expect(infoHandle).not.toBeNull();
      const computed = await page.evaluate(el => {
        const style = window.getComputedStyle(el);
        return {
          animationName: style.animationName,
          animationDuration: style.animationDuration,
          transform: style.transform
        };
      }, infoHandle);
      // basic checks: animationName should not be 'none' and animationDuration should be non-empty
      expect(computed.animationName).not.toBe('none');
      expect(computed.animationDuration).toBeTruthy();
    });
  });

  test.describe('Transitions and events (LearnMoreClick -> S1_AlertShown)', () => {
    test('Clicking Learn More shows an alert with expected educational message (single click)', async () => {
      // This test validates the transition from S0_Idle to S1_AlertShown by
      // clicking the .button element and asserting an alert dialog appears with the expected text.

      // Ensure no dialogs yet
      expect(dialogMessages.length).toBe(0);

      // Click the Learn More button to trigger alert
      await app.clickLearnMore();

      // Wait for a dialog to be captured by the page.on('dialog') handler
      // Since the handler records messages immediately, poll until we have 1 message or timeout
      await page.waitForTimeout(100); // small wait to allow the dialog event to fire and be handled

      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      const expected = "HTTP stands for HyperText Transfer Protocol. It governs how messages are formatted and transmitted on the internet.";
      // The first captured dialog message should match the expected educational alert text
      expect(dialogMessages[0]).toBe(expected);
    });

    test('Multiple rapid clicks produce multiple alerts and they are all handled (edge case)', async () => {
      // This test verifies robustness: clicking multiple times should produce multiple alerts,
      // and our dialog handler should capture and accept each one without leaving the page blocked.

      // Clear any previous dialog captures
      dialogMessages = [];

      // Click the Learn More button three times in quick succession.
      // The page.on('dialog') handler accepts each dialog so subsequent alerts can appear.
      await Promise.all([
        app.clickLearnMore(),
        app.clickLearnMore(),
        app.clickLearnMore()
      ]);

      // Give the browser a short moment to process and for the event handler to record messages
      // Alerts are modal; our handler accepts them so clicks will proceed.
      await page.waitForTimeout(200);

      // We expect three dialog messages recorded
      expect(dialogMessages.length).toBe(3);
      const expected = "HTTP stands for HyperText Transfer Protocol. It governs how messages are formatted and transmitted on the internet.";
      for (const msg of dialogMessages) {
        expect(msg).toBe(expected);
      }
    });

    test('Clicking non-target elements does not trigger an alert (negative case)', async () => {
      // Clicking the info panel or container should not call showMore() nor produce alerts.

      // Clear any previously captured dialogs
      dialogMessages = [];

      // Click the info panel
      await app.clickInfo();
      // Click the container background
      await app.clickContainer();

      // Wait briefly to ensure no dialog fired
      await page.waitForTimeout(150);

      // No dialogs should have been created by those clicks
      expect(dialogMessages.length).toBe(0);
    });

    test('Direct invocation of showMore() via window executes the same alert (behavioral check)', async () => {
      // This test checks that the function showMore exists on window and invoking it triggers the same alert.
      // We do not modify the page; we call the function as-is.
      const exists = await page.evaluate(() => typeof window.showMore === 'function');
      expect(exists).toBe(true);

      // Invoke the function from page context; the page.on('dialog') handler will capture the alert.
      dialogMessages = [];
      await page.evaluate(() => window.showMore());
      await page.waitForTimeout(100);
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      const expected = "HTTP stands for HyperText Transfer Protocol. It governs how messages are formatted and transmitted on the internet.";
      expect(dialogMessages[0]).toBe(expected);
    });
  });

  test.describe('Robustness and diagnostics', () => {
    test('No runtime ReferenceError/TypeError/SyntaxError occurred while interacting with the page', async () => {
      // This test explicitly checks that the page didn't produce common runtime errors while loaded.
      // The afterEach will fail the test if any runtime errors were recorded; here we also assert proactively.

      // Perform a normal interaction to exercise the code paths
      dialogMessages = [];
      await app.clickLearnMore();
      await page.waitForTimeout(100);

      // Ensure we've captured an alert
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);

      // Ensure pageErrors is empty (no uncaught runtime errors)
      expect(pageErrors.length).toBe(0);

      // Ensure console does not contain ReferenceError/TypeError/SyntaxError entries
      const problematic = consoleMessages.filter(m => /ReferenceError|TypeError|SyntaxError/i.test(m.text));
      expect(problematic.length).toBe(0);
    });

    test('Console messages are collected and can be inspected (diagnostic test)', async () => {
      // This test demonstrates diagnostics: it collects console messages and ensures collection worked.
      // We don't assert absence here beyond not finding the error types — we simply ensure we have an array.
      expect(Array.isArray(consoleMessages)).toBe(true);

      // Trigger one alert to ensure dialog handling is active and page still responsive
      dialogMessages = [];
      await app.clickLearnMore();
      await page.waitForTimeout(100);
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
    });
  });
});