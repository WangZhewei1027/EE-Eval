import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed9061c1-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object Model for the Neural Networks demo
class NeuralNetworksPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('.button');
    this.info = page.locator('#info');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Click the "Learn More" button once
  async clickLearnMore() {
    await this.button.click();
  }

  // Click the "Learn More" button N times
  async clickLearnMoreTimes(n) {
    for (let i = 0; i < n; i++) {
      await this.button.click();
    }
  }

  // Get the computed style.display of the info element
  async getInfoDisplay() {
    return await this.info.evaluate((node) => node.style.display);
  }

  // Get the text content of the info element
  async getInfoText() {
    return await this.info.textContent();
  }

  // Return whether the button has an inline onclick attribute referencing displayInfo
  async hasInlineOnclick() {
    return await this.button.evaluate((btn) => btn.getAttribute('onclick'));
  }
}

test.describe('Neural Networks - FSM and UI tests (ed9061c1-fa77-11f0-8492-31e949ed3c7c)', () => {
  // Will collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      // err is usually an Error object
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    const p = new NeuralNetworksPage(page);
    await p.goto();
  });

  test.afterEach(async () => {
    // No teardown required beyond Playwright's automatic cleanup.
  });

  test.describe('Initial state (S0_Idle) validations', () => {
    test('Initial DOM shows Learn More button and #info is hidden', async ({ page }) => {
      const p = new NeuralNetworksPage(page);

      // Validate the button exists and is visible
      await expect(p.button).toBeVisible();
      await expect(p.button).toHaveText('Learn More');

      // Validate #info element initially hidden via inline style (entry evidence)
      const infoDisplay = await p.getInfoDisplay();
      // The FSM initial state's evidence expects display:none
      expect(infoDisplay).toBe('none');

      // Validate the info text content is correct
      const infoText = await p.getInfoText();
      expect(infoText.trim()).toBe('Neural Networks are a subset of Machine Learning.');

      // Validate the button has onclick="displayInfo()" inline attribute as per implementation
      const onclickAttr = await p.hasInlineOnclick();
      expect(onclickAttr).toBe('displayInfo()');
    });

    // This test validates there are no unexpected runtime errors at initial load
    test('No runtime errors or console.error messages on page load', async ({ page }) => {
      // Allow a short grace period for any synchronous errors to surface
      await page.waitForTimeout(100);

      // Assert no uncaught page errors
      expect(pageErrors.length).toBe(0);

      // Assert there are no console.error messages
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('State transitions and actions', () => {
    test('Transition S0_Idle -> S1_InfoVisible on Learn More click (entry action sets display:block)', async ({ page }) => {
      const p = new NeuralNetworksPage(page);

      // Precondition: info is hidden
      expect(await p.getInfoDisplay()).toBe('none');

      // Click to trigger transition
      await p.clickLearnMore();

      // Verify entry action: info should now be visible (style.display == 'block')
      expect(await p.getInfoDisplay()).toBe('block');

      // Extra check: info remains visible in DOM and text is unchanged
      expect(await p.getInfoText()).toContain('Neural Networks are a subset of Machine Learning.');
    });

    test('Transition S1_InfoVisible -> S0_Idle on Learn More click (exit action sets display:none)', async ({ page }) => {
      const p = new NeuralNetworksPage(page);

      // Ensure we are in visible state first
      await p.clickLearnMore();
      expect(await p.getInfoDisplay()).toBe('block');

      // Click again to hide
      await p.clickLearnMore();

      // Verify exit action: info should now be hidden
      expect(await p.getInfoDisplay()).toBe('none');
    });

    test('Multiple sequential clicks toggle state correctly (odd=visible, even=hidden) - covers FSM looping transitions', async ({ page }) => {
      const p = new NeuralNetworksPage(page);

      // Perform 5 rapid clicks; odd -> visible expected after 5
      await p.clickLearnMoreTimes(5);
      expect(await p.getInfoDisplay()).toBe('block');

      // Perform 1 more click (6 total) -> hidden
      await p.clickLearnMore();
      expect(await p.getInfoDisplay()).toBe('none');

      // Perform 2 more clicks (8 total) -> visible (since starting at hidden and 2 clicks flips twice)
      await p.clickLearnMoreTimes(2);
      // After two clicks from 'none' it should be 'none' -> 'block' -> 'none' (even) => actually 2 clicks from none results none? Let's reason:
      // Starting none: 1 -> block, 2 -> none. So after 2 more clicks (making 8 total) we expect 'none'.
      // To avoid logical confusion, assert parity behavior explicitly:
      // 8 total clicks (even) should result in hidden.
      expect(await p.getInfoDisplay()).toBe('none');
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('Clicking non-button element does not change info visibility', async ({ page }) => {
      const p = new NeuralNetworksPage(page);

      // Ensure initial hidden state
      expect(await p.getInfoDisplay()).toBe('none');

      // Click on a neutral area: the container background
      const container = page.locator('#container');
      await container.click();

      // Visibility should remain unchanged
      expect(await p.getInfoDisplay()).toBe('none');
    });

    test('Rapid sequential interactions do not produce JS errors', async ({ page }) => {
      const p = new NeuralNetworksPage(page);

      // Rapidly click the button 20 times
      await p.clickLearnMoreTimes(20);

      // Allow microtask queue to settle
      await page.waitForTimeout(50);

      // Ensure no page errors occurred as a result
      expect(pageErrors.length).toBe(0);

      // Ensure no console.error messages
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Info element style toggles only between block and none (no unexpected values)', async ({ page }) => {
      const p = new NeuralNetworksPage(page);

      // Click a few times and check style values are only 'block' or 'none'
      for (let i = 0; i < 6; i++) {
        await p.clickLearnMore();
        const disp = await p.getInfoDisplay();
        expect(['block', 'none']).toContain(disp);
      }
    });
  });

  test.describe('Console and error observation (must observe and assert natural errors if any)', () => {
    test('Capture console messages and assert absence of ReferenceError/TypeError/SyntaxError', async ({ page }) => {
      const p = new NeuralNetworksPage(page);

      // Interact a bit to possibly trigger any lazy errors
      await p.clickLearnMore();
      await p.clickLearnMore();

      // Wait briefly to collect any asynchronous errors
      await page.waitForTimeout(100);

      // Assert no uncaught page errors were reported
      expect(pageErrors.length).toBe(0);

      // Check console messages for error types
      const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error' || /ReferenceError|TypeError|SyntaxError/i.test(m.text));
      // If any such messages exist, surface them in the assertion for debugging
      expect(errorConsoleMessages.length, `Found console errors: ${JSON.stringify(errorConsoleMessages)}`).toBe(0);
    });
  });
});