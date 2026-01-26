import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122d5e92-fa7b-11f0-814c-dbec508f0b3b.html';

// Page object for the congestion control app
class CongestionControlPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.maxButton = page.locator('#max-traffic');
    this.lowButton = page.locator('#low-traffic');
    this.mediumButton = page.locator('#medium-traffic');
    this.highButton = page.locator('#high-traffic');
    this.volumeInput = page.locator('#traffic-volume');
    this.submitButton = page.locator('#submit-traffic');
    this.statusParagraph = page.locator('#traffic-status');
    this.buttonContainer = page.locator('.button-container');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickMax() {
    await this.maxButton.click();
  }

  async clickLow() {
    await this.lowButton.click();
  }

  async clickMedium() {
    await this.mediumButton.click();
  }

  async clickHigh() {
    await this.highButton.click();
  }

  async setVolume(value) {
    await this.volumeInput.fill(''); // clear first
    // use type to simulate real input events and trigger input listener
    await this.volumeInput.type(String(value));
    // Wait for input event to propagate and DOM to update
    await this.page.waitForTimeout(50);
  }

  async submit() {
    await this.submitButton.click();
  }

  async getStatusText() {
    return (await this.statusParagraph.textContent())?.trim() ?? '';
  }

  async getVolumeInputValue() {
    return await this.volumeInput.inputValue();
  }
}

test.describe('Congestion Control Application (FSM validation)', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // reset collectors
    consoleMessages = [];
    pageErrors = [];

    // collect console messages for inspection
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test('Initial render - Idle state & UI presence', async ({ page }) => {
    // This test validates the initial page render (Idle state).
    const app = new CongestionControlPage(page);
    await app.goto();

    // Verify main UI components render correctly
    await expect(app.buttonContainer).toBeVisible();
    await expect(app.maxButton).toBeVisible();
    await expect(app.lowButton).toBeVisible();
    await expect(app.mediumButton).toBeVisible();
    await expect(app.highButton).toBeVisible();
    await expect(app.volumeInput).toBeVisible();
    await expect(app.submitButton).toBeVisible();
    await expect(app.statusParagraph).toBeVisible();

    // The initial <p id="traffic-status"> is empty in the implementation
    const statusText = await app.getStatusText();
    expect(statusText).toBe('', 'Initial traffic status paragraph should be empty by default');

    // Verify CSS visual: background-color is white as in the implementation
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(255, 255, 255)');

    // Verify that the declared FSM entry action "renderPage()" is not present on window (we must not inject it)
    // This confirms that onEnter action mentioned in the FSM is not implemented in the page global scope.
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(hasRenderPage).toBe(false);

    // Assert no uncaught page errors occurred during load
    expect(pageErrors.length).toBe(0);

    // Also ensure there are no console 'error' messages during load
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test.describe('Traffic status button interactions (active states)', () => {
    test('Clicking Max/Low/Medium/High updates traffic status paragraph', async ({ page }) => {
      // Validate each button sets the traffic-status paragraph to the expected label.
      const app = new CongestionControlPage(page);
      await app.goto();

      // Max Traffic
      await app.clickMax();
      expect(await app.getStatusText()).toBe('Max Traffic');

      // Low Traffic
      await app.clickLow();
      expect(await app.getStatusText()).toBe('Low Traffic');

      // Medium Traffic
      await app.clickMedium();
      expect(await app.getStatusText()).toBe('Medium Traffic');

      // High Traffic
      await app.clickHigh();
      expect(await app.getStatusText()).toBe('High Traffic');

      // Ensure no uncaught exceptions or console errors from these interactions
      expect(pageErrors.length).toBe(0);
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMsgs.length).toBe(0);
    });
  });

  test.describe('Traffic volume input and submit transitions (final states)', () => {
    test('Input event displays "Traffic Volume: X units" and numeric parsing behavior', async ({ page }) => {
      // Valid numeric input
      const app = new CongestionControlPage(page);
      await app.goto();

      await app.setVolume('42');
      expect(await app.getStatusText()).toBe('Traffic Volume: 42 units');

      // Non-numeric input -> parseInt gives NaN and DOM shows NaN in implementation
      await app.setVolume('abc');
      const statusAfterNonNumeric = await app.getStatusText();
      // Implementation uses parseInt which produces NaN and then text is `Traffic Volume: ${trafficVolume} units`
      expect(statusAfterNonNumeric).toBe('Traffic Volume: NaN units');

      // Negative numeric input should be displayed as entered
      await app.setVolume('-10');
      expect(await app.getStatusText()).toBe('Traffic Volume: -10 units');

      // Ensure no page errors from input events
      expect(pageErrors.length).toBe(0);
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMsgs.length).toBe(0);
    });

    test('Submit with volume <= 100 results in "Traffic is under control"', async ({ page }) => {
      // Use typed input to set boundary value 100
      const app = new CongestionControlPage(page);
      await app.goto();

      await app.setVolume('100');
      // ensure input value reflected
      expect(await app.getVolumeInputValue()).toBe('100');

      await app.submit();
      expect(await app.getStatusText()).toBe('Traffic Status: Traffic is under control');

      // Also verify when buttons set volumes (these set trafficVolume internally) -> should produce same final state
      // Set via clicking "Low Traffic" (50) then Submit
      await app.clickLow();
      // Button click sets the paragraph to "Low Traffic" - verify
      expect(await app.getStatusText()).toBe('Low Traffic');
      await app.submit();
      expect(await app.getStatusText()).toBe('Traffic Status: Traffic is under control');

      // Set via clicking "Max Traffic" (100) then Submit
      await app.clickMax();
      expect(await app.getStatusText()).toBe('Max Traffic');
      await app.submit();
      expect(await app.getStatusText()).toBe('Traffic Status: Traffic is under control');

      // Confirm no uncaught exceptions
      expect(pageErrors.length).toBe(0);
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMsgs.length).toBe(0);
    });

    test('Submit with volume > 100 results in "Traffic is congested"', async ({ page }) => {
      // Use typed input to set over-limit value 150
      const app = new CongestionControlPage(page);
      await app.goto();

      await app.setVolume('150');
      expect(await app.getStatusText()).toBe('Traffic Volume: 150 units');

      await app.submit();
      expect(await app.getStatusText()).toBe('Traffic Status: Traffic is congested');

      // Edge: empty input results in NaN -> submit treats as congested due to NaN <= 100 being false
      await app.setVolume(''); // clear
      // give some time for input side effects
      await page.waitForTimeout(20);
      // Submit with empty -> trafficVolume will be NaN and thus expected to be congested per implementation
      await app.submit();
      expect(await app.getStatusText()).toBe('Traffic Status: Traffic is congested');

      // Ensure no runtime page errors
      expect(pageErrors.length).toBe(0);
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMsgs.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenario checks', () => {
    test('Non-numeric and borderline inputs produce deterministic text output (no thrown exceptions)', async ({ page }) => {
      // This test covers edge cases and ensures the app handles them without throwing exceptions.
      const app = new CongestionControlPage(page);
      await app.goto();

      // Large number
      await app.setVolume('1000000');
      await app.submit();
      expect(await app.getStatusText()).toBe('Traffic Status: Traffic is congested');

      // Decimal input: parseInt should parse integer part
      await app.setVolume('75.9');
      expect(await app.getStatusText()).toBe('Traffic Volume: 75 units');

      await app.submit();
      // 75 -> under control
      expect(await app.getStatusText()).toBe('Traffic Status: Traffic is under control');

      // Input with leading/trailing spaces
      await app.setVolume('  101  ');
      expect(await app.getStatusText()).toBe('Traffic Volume: 101 units');
      await app.submit();
      expect(await app.getStatusText()).toBe('Traffic Status: Traffic is congested');

      // Verify that no ReferenceError/SyntaxError/TypeError was thrown during these interactions
      // We capture page errors via page.on('pageerror') in beforeEach; assert none occurred
      expect(pageErrors.length).toBe(0);

      // Also ensure there were no console.error messages
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMsgs.length).toBe(0);
    });
  });

  test.afterEach(async ({ page }) => {
    // Final safety checks after each test:
    // If there are any page errors, fail with details for easier debugging.
    if (pageErrors.length > 0) {
      // Throwing here will mark the test as failed and include the first page error stack
      throw pageErrors[0];
    }

    // Also assert that no console error-level messages were emitted
    const errors = consoleMessages.filter(m => m.type === 'error');
    if (errors.length > 0) {
      // Provide informative failure about console errors
      throw new Error('Console error messages were emitted: ' + JSON.stringify(errors, null, 2));
    }

    // otherwise no-op; cleanup handled by Playwright fixtures
  });
});