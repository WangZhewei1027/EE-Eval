import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8da2a4-fa77-11f0-8492-31e949ed3c7c.html';

class VisualizerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startButton = page.locator('#startButton');
    this.container = page.locator('#container');
    this.numberItems = page.locator('.number');
    // collectors for page issues
    this.pageErrors = [];
    this.consoleMessages = [];
    this._boundPageErrorHandler = (err) => {
      this.pageErrors.push(err);
    };
    this._boundConsoleHandler = (msg) => {
      this.consoleMessages.push(msg);
    };
  }

  async initListeners() {
    this.page.on('pageerror', this._boundPageErrorHandler);
    this.page.on('console', this._boundConsoleHandler);
  }

  async removeListeners() {
    this.page.off('pageerror', this._boundPageErrorHandler);
    this.page.off('console', this._boundConsoleHandler);
  }

  async goto() {
    await this.page.goto(APP_URL);
    await this.initListeners();
  }

  async isStartEnabled() {
    return await this.startButton.isEnabled();
  }

  async clickStart() {
    await this.startButton.click();
  }

  async isStartDisabled() {
    return await this.startButton.isDisabled();
  }

  async numbersCount() {
    return await this.numberItems.count();
  }

  // Wait until at least `n` .number elements present or timeout
  async waitForNumbersAtLeast(n, options = {}) {
    const { timeout = 20000 } = options;
    await this.page.waitForFunction(
      (sel, min) => document.querySelectorAll(sel).length >= min,
      '.number',
      n,
      { timeout }
    );
  }

  // Find a number element that has exact text content
  async findNumberByText(text) {
    return this.page.locator('.number', { hasText: text }).first();
  }

  // Helper to extract numeric left percentage of a number element
  async leftPercentOfNumberWithText(text) {
    const el = await this.findNumberByText(text);
    const handle = await el.elementHandle();
    if (!handle) return null;
    const left = await this.page.evaluate((node) => {
      const styleLeft = node.style.left || window.getComputedStyle(node).left || '';
      return styleLeft;
    }, handle);
    return left;
  }
}

test.describe('Exponential Search Visualization - FSM and UI tests', () => {
  // Each test will create its own page fixture from playwright.
  // Shared assertions about uncaught page errors and console messages will be gathered per test.

  test('S0_Idle: Initial Idle state - start button present and enabled, no numbers drawn', async ({ page }) => {
    // Validate initial Idle state before any interaction
    const vp = new VisualizerPage(page);
    await vp.goto();

    // Check startButton exists and is enabled (Idle state)
    await expect(vp.startButton).toBeVisible();
    expect(await vp.isStartEnabled()).toBe(true);

    // Container should be present and initially empty (no .number elements)
    await expect(vp.container).toBeVisible();
    expect(await vp.numbersCount()).toBe(0);

    // Ensure there are no uncaught page errors at load time (we observe and assert)
    // We collect pageErrors via the listener attached in goto()
    expect(vp.pageErrors.length).toBe(0);

    // Remove listeners to avoid cross-test noise
    await vp.removeListeners();
  });

  test('S1_Visualizing: Clicking Start transitions to Visualizing - button disabled and highlights drawn', async ({ page }) => {
    // Validate transition S0 -> S1: clicking start disables button and starts exponential highlights
    const vp = new VisualizerPage(page);
    await vp.goto();

    // Prepare dialog handling (linearSearch will eventually trigger an alert; prevent it from blocking)
    const dialogs = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });

    // Click start and assert immediate onEnter actions: button disabled
    await vp.clickStart();
    expect(await vp.isStartDisabled()).toBe(true);

    // After clicking, exponential visualization draws at least one circle immediately (index 0)
    // Wait for at least 1 .number element
    await vp.waitForNumbersAtLeast(1, { timeout: 5000 });
    expect(await vp.numbersCount()).toBeGreaterThanOrEqual(1);

    // Validate the first drawn number has text '1' (array[0] === 1) and initially has 'highlight' class
    const firstNumber = page.locator('.number').first();
    await expect(firstNumber).toBeVisible();
    await expect(firstNumber).toHaveText('1');

    // Immediately after creation the element should include the highlight class; it is removed after ~1000ms.
    // Check presence of 'highlight' class soon after click
    const classAttr = await firstNumber.getAttribute('class');
    expect(classAttr).toContain('number');
    // Highlight may or may not be removed depending on timing; we assert it was present at creation time by checking console/DOM soon
    // Check that within 500ms it contains highlight
    const hasHighlightSoon = await page.waitForFunction(
      (selector) => {
        const el = document.querySelector(selector);
        return el && el.classList.contains('highlight');
      },
      '.number',
      { timeout: 500 }
    );
    expect(hasHighlightSoon).toBeTruthy();

    // After 1200ms the class 'highlight' should have been removed from that instance (per implementation)
    await page.waitForTimeout(1200);
    const classAfter = await firstNumber.getAttribute('class');
    expect(classAfter).not.toContain('highlight');

    // Ensure still no uncaught JS errors
    expect(vp.pageErrors.length).toBe(0);

    await vp.removeListeners();
  });

  test('S1_Visualizing -> S2_LinearSearching: Exponential completes and linear search runs, alert is shown', async ({ page }) => {
    // This test validates the transition from Visualizing to LinearSearching:
    // - exponential interval clears when index goes out of bounds or arr[index] >= target
    // - linearSearch is invoked and eventually triggers an alert for the found target
    // This test waits for the alert and validates its content and that start button remains disabled.
    test.setTimeout(45000); // increase timeout because the in-page timers are slow (several seconds)

    const vp = new VisualizerPage(page);
    await vp.goto();

    const dialogMessages = [];
    page.on('dialog', async (dialog) => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    // Click start to begin visualization
    await vp.clickStart();
    expect(await vp.isStartDisabled()).toBe(true);

    // The exponential phase will draw indices: 0 (immediate), 1, 2, 4, 8 and then terminate (approx 5 seconds)
    // After that linearSearch will schedule highlights and eventually show an alert "Found 14 at index 13"
    // Wait for the dialog that indicates linear search found the target.
    // Give a generous timeout to allow the algorithm's timers to run.
    await page.waitForFunction(() => window.hasOwnProperty('setTimeout'), null, { timeout: 1000 });

    // Wait for the alert from linearSearch that reports the found target.
    // Based on implementation timing: exponential ~5s, linearSearch schedules alert at i*1000 for i=13 => ~5 + 13 = ~18s
    // We allow up to 40s to be robust.
    await page.waitForFunction(
      () => {
        // check if any dialog messages were added to the outer scope (we rely on closure)
        // This function returns true only when a dialog has been handled and the global "lastDialogSeen" is set.
        // Since we cannot access node scope variables here, we instead check DOM for an indicator:
        // There's no indicator, so we rely on the Playwright dialog handler to populate closure-level array.
        return false;
      },
      {},
      { timeout: 1 }
    ).catch(() => {
      // ignore; we just used this to avoid early return - real wait will be below by waiting on dialogMessages
    });

    // Wait until our dialog handler has captured at least one message or timeout
    const maxWait = 40000;
    const pollInterval = 500;
    let waited = 0;
    while (dialogMessages.length === 0 && waited < maxWait) {
      await page.waitForTimeout(pollInterval);
      waited += pollInterval;
    }

    // After waiting, ensure we received an alert
    expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
    // Validate the alert text content contains the expected found message
    const foundMsg = dialogMessages.find((m) => m.includes('Found 14 at index') || m.includes('Found 14 at index 13'));
    expect(foundMsg).toBeTruthy();
    // The implementation uses exactly: alert(`Found ${target} at index ${i}`) -> expect index 13 for target 14
    expect(foundMsg).toContain('Found 14 at index 13');

    // Validate that the container contains multiple .number elements (linear search appended many)
    const cnt = await vp.numbersCount();
    expect(cnt).toBeGreaterThanOrEqual(10); // after linear search runs partially/completely, many elements exist

    // Validate the position (left style) of the element with text '14' (should be near 86-87%)
    const leftStyle = await vp.leftPercentOfNumberWithText('14');
    expect(leftStyle).toBeTruthy();
    // Extract numeric percent and ensure it's within expected range (80% - 95%)
    const match = leftStyle.match(/([\d\.]+)%/);
    if (match) {
      const num = parseFloat(match[1]);
      expect(num).toBeGreaterThan(80);
      expect(num).toBeLessThanOrEqual(95);
    } else {
      // If style left is not parseable, still ensure it's a non-empty string containing '%'
      expect(leftStyle).toContain('%');
    }

    // Ensure start button stayed disabled after start (onExit action not defined to re-enable)
    expect(await vp.isStartDisabled()).toBe(true);

    // Ensure no uncaught page errors of types ReferenceError / SyntaxError / TypeError occurred
    // We assert there are no page errors; if any exist they will be listed and cause the test to fail.
    expect(vp.pageErrors.length).toBe(0);

    await vp.removeListeners();
  });

  test('Edge case: Clicking Start multiple times quickly does not throw errors and button remains disabled', async ({ page }) => {
    // This validates resilience: trying to click the start button again after it becomes disabled should not cause page errors.
    const vp = new VisualizerPage(page);
    await vp.goto();

    // First click to start
    await vp.clickStart();
    expect(await vp.isStartDisabled()).toBe(true);

    // Attempt to click again (should be ignored because the button is disabled)
    // Use try/catch to ensure that if Playwright can't click due to disabled state it doesn't throw unexpected errors in page context
    let secondClickError = null;
    try {
      // This will either be a no-op or throw in Playwright; we catch it but ensure no page JS errors
      await vp.startButton.click({ timeout: 1000 }).catch(() => {});
    } catch (e) {
      secondClickError = e;
    }

    // There shouldn't be an exception bubbling that indicates page JS errors as a result of double click attempt
    expect(secondClickError).toBeNull();

    // Allow some time for any unforeseen page errors to surface
    await page.waitForTimeout(2000);
    expect(vp.pageErrors.length).toBe(0);

    await vp.removeListeners();
  });

  test('Observability: capture console messages and ensure no syntax/reference/type errors occurred on load', async ({ page }) => {
    // This test purely observes console and page errors on initial load (S0)
    const vp = new VisualizerPage(page);
    await vp.goto();

    // Wait a short moment to allow possible immediate runtime errors to surface
    await page.waitForTimeout(500);

    // There should be no syntax/reference/type errors; if any exist they will be in pageErrors.
    // We assert explicitly that no page error is an instance of ReferenceError, SyntaxError, or TypeError by name.
    const problematic = vp.pageErrors.filter((err) => {
      const name = err && err.name ? err.name : '';
      return name === 'ReferenceError' || name === 'SyntaxError' || name === 'TypeError';
    });

    expect(problematic.length).toBe(0);

    // Also ensure console captured some messages (even if empty), and none of them are errors of those types.
    // Playwright console messages include type; we can assert none of the console messages are of type 'error' with those names.
    const errorConsoleMessages = vp.consoleMessages.filter((m) => {
      try {
        return m.type() === 'error' && /ReferenceError|SyntaxError|TypeError/.test(m.text());
      } catch {
        return false;
      }
    });
    expect(errorConsoleMessages.length).toBe(0);

    await vp.removeListeners();
  });
});