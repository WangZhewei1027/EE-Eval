import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d7b37741-d5c2-11f0-9651-0f1ae31ac260.html';

// Page Object to encapsulate common interactions and queries
class InsertionSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayInput = page.locator('#arrayInput');
    this.sortBtn = page.locator('#sortBtn');
    this.speedRange = page.locator('#speedRange');
    this.speedDisplay = page.locator('#speedDisplay');
    this.barsContainer = page.locator('#bars');
    this.barLocator = page.locator('#bars .bar');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setInput(value) {
    // Replace the input value as a user would
    await this.arrayInput.fill(value);
    // fire input event to mimic user typing (some browsers handle it automatically via fill())
    await this.page.evaluate(() => {
      const el = document.getElementById('arrayInput');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  async clickStartSorting() {
    await this.sortBtn.click();
  }

  async setSpeed(value) {
    // value as number or string; set the range input and dispatch input event
    await this.page.evaluate((v) => {
      const el = document.getElementById('speedRange');
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }

  async getSpeedDisplayText() {
    return await this.speedDisplay.textContent();
  }

  async getWindowDelay() {
    // read the global delay variable declared in the page script
    return await this.page.evaluate(() => window.delay);
  }

  async getBarsCount() {
    return await this.barLocator.count();
  }

  async getBarTexts() {
    const count = await this.getBarsCount();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push(await this.barLocator.nth(i).textContent());
    }
    return texts;
  }

  async getBarBackgroundColors() {
    const count = await this.getBarsCount();
    const colors = [];
    for (let i = 0; i < count; i++) {
      // computed style to account for final inline style changes
      colors.push(
        await this.page.evaluate((el) => {
          const cs = window.getComputedStyle(el);
          return cs.backgroundColor;
        }, await this.barLocator.nth(i).elementHandle())
      );
    }
    return colors;
  }

  async isSortButtonDisabled() {
    return await this.sortBtn.evaluate((btn) => btn.disabled);
  }

  async isInputDisabled() {
    return await this.arrayInput.evaluate((inp) => inp.disabled);
  }

  async isSpeedRangeDisabled() {
    return await this.speedRange.evaluate((r) => r.disabled);
  }

  async waitForSortingToFinish(timeout = 20000) {
    // Sorting code enables the sort button when finished. Wait for sortBtn.disabled === false
    await this.page.waitForFunction(
      () => {
        const btn = document.getElementById('sortBtn');
        return btn && btn.disabled === false;
      },
      null,
      { timeout }
    );
  }

  async waitForAnyCurrentClass(timeout = 2000) {
    // during sorting a .bar.current should appear; wait for it
    await this.page.waitForSelector('.bar.current', { timeout });
  }
}

test.describe('Insertion Sort Visualization - FSM and DOM behavior', () => {
  // shared per-test variables to capture console messages and page errors
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // collect console messages for debugging and assertions
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // collect page errors (unhandled exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });
  });

  test.afterEach(async ({}, testInfo) => {
    // Basic sanity: report if any page errors were collected for debugging context
    if (pageErrors.length > 0) {
      // attach to Playwright test output for easier debugging if present
      testInfo.attach('page-errors', { body: pageErrors.join('\n'), contentType: 'text/plain' });
    }
    if (consoleMessages.length > 0) {
      testInfo.attach('console-messages', { body: JSON.stringify(consoleMessages, null, 2), contentType: 'application/json' });
    }
  });

  test.describe('Idle State (S0_Idle) validations', () => {
    test('Initial page load creates bars and UI is enabled (Idle state)', async ({ page }) => {
      // This test validates the "Idle" initial state: createBars(initialArr) should run on load.
      const p = new InsertionSortPage(page);

      // Navigate to the app
      await p.goto();

      // Ensure no unexpected runtime errors happened during load
      expect(pageErrors).toEqual([]);

      // Bars should be created on window.onload using the initial input value (8,5,3,7,6,2,4,1)
      const barCount = await p.getBarsCount();
      expect(barCount).toBe(8);

      // Validate bar texts correspond to the default input value
      const texts = await p.getBarTexts();
      expect(texts).toEqual(['8', '5', '3', '7', '6', '2', '4', '1']);

      // UI controls should be enabled in Idle state
      expect(await p.isSortButtonDisabled()).toBe(false);
      expect(await p.isInputDisabled()).toBe(false);
      expect(await p.isSpeedRangeDisabled()).toBe(false);
    });
  });

  test.describe('Input Error State (S2_InputError) validations', () => {
    test('Clicking Start Sorting with empty input shows alert and does not disable controls', async ({ page }) => {
      // This test validates the Input Error state is reached when input is invalid (empty)
      const p = new InsertionSortPage(page);
      const alertMessages = [];

      await p.goto();

      // Listen for dialogs (alert)
      page.on('dialog', async (dialog) => {
        alertMessages.push(dialog.message());
        await dialog.accept();
      });

      // Clear input and click Start Sorting - should trigger alert and return early
      await p.setInput('   '); // whitespace-only should be treated as invalid
      await p.clickStartSorting();

      // Alert should have fired with the expected message
      expect(alertMessages.length).toBeGreaterThanOrEqual(1);
      expect(alertMessages[0]).toContain('Please enter a valid sequence of numbers separated by commas!');

      // Since handler returned early, controls should remain enabled (no disable happened)
      expect(await p.isSortButtonDisabled()).toBe(false);
      expect(await p.isInputDisabled()).toBe(false);
      expect(await p.isSpeedRangeDisabled()).toBe(false);

      // No unhandled page errors expected
      expect(pageErrors).toEqual([]);
    });

    test('Clicking Start Sorting with malformed numbers shows alert and leaves UI enabled', async ({ page }) => {
      // Validate a malformed numeric input (non-number tokens) triggers the same alert
      const p = new InsertionSortPage(page);
      const alertMessages = [];

      await p.goto();

      page.on('dialog', async (dialog) => {
        alertMessages.push(dialog.message());
        await dialog.accept();
      });

      await p.setInput('1, 2, foo, 4');
      await p.clickStartSorting();

      expect(alertMessages.length).toBeGreaterThanOrEqual(1);
      expect(alertMessages[0]).toContain('Please enter a valid sequence of numbers separated by commas!');

      // UI should still be enabled
      expect(await p.isSortButtonDisabled()).toBe(false);
      expect(await p.isInputDisabled()).toBe(false);
      expect(await p.isSpeedRangeDisabled()).toBe(false);

      // No unhandled page errors expected
      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Sorting State (S1_Sorting) and transitions', () => {
    test('Starting sort disables controls, visualizes sorting, and re-enables controls when done', async ({ page }) => {
      // This test validates the transition S0_Idle -> S1_Sorting and then back to S0_Idle after sorting.
      const p = new InsertionSortPage(page);

      await p.goto();

      // Speed up animation to make test deterministic and fast
      await p.setSpeed(50);

      // Assert that the displayed speed and window.delay updated (transition action expectation)
      const speedDisplay = await p.getSpeedDisplayText();
      expect(speedDisplay).toContain('50 ms');
      const windowDelay = await p.getWindowDelay();
      expect(windowDelay).toBe(50);

      // Start sorting
      const sortButtonBefore = await p.isSortButtonDisabled();
      expect(sortButtonBefore).toBe(false);

      // Click sort and immediately check that controls get disabled per exit/entry actions
      const clickPromise = p.clickStartSorting();

      // Immediately after clicking, the handler in script disables controls - assert that
      await page.waitForFunction(() => document.getElementById('sortBtn').disabled === true);

      expect(await p.isSortButtonDisabled()).toBe(true);
      expect(await p.isInputDisabled()).toBe(true);
      expect(await p.isSpeedRangeDisabled()).toBe(true);

      // During sorting, there should be a moment where a .bar.current exists representing the key
      // Wait for that class to appear; this confirms visual feedback during sorting
      await p.waitForAnyCurrentClass();

      // Wait for sorting to finish (script re-enables controls when done)
      await p.waitForSortingToFinish(20000);

      // After sorting, controls should be re-enabled
      expect(await p.isSortButtonDisabled()).toBe(false);
      expect(await p.isInputDisabled()).toBe(false);
      expect(await p.isSpeedRangeDisabled()).toBe(false);

      // Final colors: the script sets backgroundColor inline to '#4caf50' for all bars.
      const colors = await p.getBarBackgroundColors();
      // '#4caf50' is rgb(76, 175, 80)
      colors.forEach((c) => expect(c).toBe('rgb(76, 175, 80)'));

      // Ensure no unhandled page errors occurred during sorting flow
      expect(pageErrors).toEqual([]);
    });

    test('Changing input after sorting updates bars (transition S1_Sorting -> S0_Idle via InputChange)', async ({ page }) => {
      // This test validates that after sorting completes, updating the input results in new bars (Idle state)
      const p = new InsertionSortPage(page);

      await p.goto();

      // Speed up and run a quick sort
      await p.setSpeed(50);
      await p.clickStartSorting();

      // wait for completion
      await p.waitForSortingToFinish(20000);

      // Now change the input to a different sequence and check that createBars produced new bars
      await p.setInput('10,20,30');
      // There is no explicit input listener to create bars on input in the provided script,
      // but the initial FSM expected that InputChange validates input. We can emulate user clicking Start to produce bars.
      await p.clickStartSorting();

      // If the input is valid, start should perform createBars and then sort. Wait until done.
      await p.waitForSortingToFinish(20000);

      // The bars should reflect the new input values
      const texts = await p.getBarTexts();
      expect(texts).toEqual(['10', '20', '30']);

      // No unhandled page errors
      expect(pageErrors).toEqual([]);
    });

    test('Adjusting speed while idle updates animation speed (SpeedChange transition)', async ({ page }) => {
      // Validate the speedRange input updates the displayed speed and the global delay variable
      const p = new InsertionSortPage(page);

      await p.goto();

      // Set to a mid-value
      await p.setSpeed(1500);

      // speedDisplay should update
      const display = await p.getSpeedDisplayText();
      expect(display).toContain('1500 ms');

      // window.delay should be in sync
      const delay = await p.getWindowDelay();
      expect(delay).toBe(1500);

      // No page errors expected
      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Robustness: console and runtime error observation', () => {
    test('No uncaught ReferenceError/SyntaxError/TypeError during normal use', async ({ page }) => {
      // This test simply exercises the app and asserts that no unhandled runtime errors were emitted.
      const p = new InsertionSortPage(page);

      await p.goto();

      // Perform a sequence of interactions: change speed, start sort with small delay, then finish
      await p.setSpeed(50);
      await p.setInput('4,3,2,1');
      await p.clickStartSorting();

      // Wait for sorting to finish
      await p.waitForSortingToFinish(20000);

      // We expect no page errors to have been emitted (no unhandled ReferenceError/SyntaxError/TypeError)
      expect(pageErrors).toEqual([]);

      // Also capture console for any 'error' severity messages and assert none
      const errorConsoleEntries = consoleMessages.filter((m) => m.type === 'error');
      expect(errorConsoleEntries.length).toBe(0);
    });
  });
});