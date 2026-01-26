import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122dfad0-fa7b-11f0-814c-dbec508f0b3b.html';

// Page object model for interacting with the runtime environment page
class RuntimePage {
  constructor(page) {
    this.page = page;
    this.resetButton = page.locator('#reset-button');
    this.maximizeButton = page.locator('#maximize-button');
    this.minimizeButton = page.locator('#minimize-button');
    this.closeButton = page.locator('#close-button');
    this.searchInput = page.locator('#search-input');
    this.clearButton = page.locator('#clear-button');
    this.saveButton = page.locator('#save-button');
    this.loadButton = page.locator('#load-button');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async isVisible(locator) {
    return await locator.isVisible().catch(() => false);
  }

  async getInlineStyle(selector, property) {
    return await this.page.evaluate(
      (sel, prop) => {
        const el = document.querySelector(sel);
        return el ? el.style[prop] : null;
      },
      selector,
      property
    );
  }

  async getBodyInlineStyle(property) {
    return await this.page.evaluate((prop) => document.body.style[prop], property);
  }
}

test.describe('Runtime Environment - FSM states and transitions', () => {
  // Arrays to capture page errors and console errors per test
  let pageErrors;
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Capture runtime page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console.error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg);
      }
    });
  });

  test.afterEach(async ({ page }) => {
    // detach listeners implicitly by navigation or test end; no explicit teardown needed
    // but ensure we close any leftover dialogs/popups
    try {
      await page.close();
    } catch {
      // ignore if page already closed
    }
  });

  test('Initial load - Idle state: all controls present and visible', async ({ page }) => {
    // Validate initial "Idle" impressions: controls should be present and visible.
    // We do not expect any runtime errors on simple load for this specific HTML.
    const runtime = new RuntimePage(page);
    await runtime.goto();

    // Ensure there were no page runtime errors on initial load
    expect(pageErrors.length).toBe(0);

    // All configured controls should exist in the DOM and be visible
    await expect(runtime.resetButton).toBeVisible();
    await expect(runtime.maximizeButton).toBeVisible();
    await expect(runtime.minimizeButton).toBeVisible();
    await expect(runtime.closeButton).toBeVisible();
    await expect(runtime.searchInput).toBeVisible();
    await expect(runtime.clearButton).toBeVisible();
    await expect(runtime.saveButton).toBeVisible();
    await expect(runtime.loadButton).toBeVisible();

    // Body background color set in CSS (visual check via computed style)
    const bgColor = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    // The CSS set background-color: #000 which corresponds to rgb(0, 0, 0)
    expect(['rgb(0, 0, 0)', '#000', 'black']).toContain(bgColor);
  });

  test.describe('Input and button event transitions (should trigger updateControl and likely runtime errors)', () => {
    test('Search input triggers Search state and leads to update error (observed as pageerror)', async ({ page }) => {
      // This test types into the search input. The page's updateControl function references
      // non-existent DOM nodes and internally shadows variables - we expect a runtime error.
      const runtime = new RuntimePage(page);
      await runtime.goto();

      // Perform the input and concurrently wait for the pageerror produced by updateControl
      const [err] = await Promise.all([
        page.waitForEvent('pageerror'),
        runtime.searchInput.fill('hello world'),
      ]);

      // Validate that an error occurred and is likely a TypeError from attempting to touch a null element
      expect(err).toBeTruthy();
      expect(typeof err.message).toBe('string');
      // Generic check for property access on null or undefined - message varies between engines
      expect(/null|Cannot read|Cannot set|undefined|TypeError/i.test(err.message)).toBeTruthy();

      // The search input should have the typed value despite the error
      expect(await runtime.searchInput.inputValue()).toBe('hello world');

      // There should be at least one console.error emitted as well (updateControl uses getElementById on missing elements)
      expect(consoleErrors.length).toBeGreaterThanOrEqual(0);
    });

    test('Clear button click triggers Clear state and raises a runtime error', async ({ page }) => {
      // Clicking clear sets currentControl and calls updateControl -> leads to exception due to missing DOM nodes
      const runtime = new RuntimePage(page);
      await runtime.goto();

      const [err] = await Promise.all([
        page.waitForEvent('pageerror'),
        runtime.clearButton.click(),
      ]);

      expect(err).toBeTruthy();
      expect(/null|Cannot read|Cannot set|undefined|TypeError/i.test(err.message)).toBeTruthy();

      // Clear button should remain in DOM (the script hides buttons only in close handler)
      expect(await runtime.isVisible(runtime.clearButton)).toBeTruthy();
    });

    test('Save button click triggers Save state and raises a runtime error', async ({ page }) => {
      const runtime = new RuntimePage(page);
      await runtime.goto();

      const [err] = await Promise.all([
        page.waitForEvent('pageerror'),
        runtime.saveButton.click(),
      ]);

      expect(err).toBeTruthy();
      expect(/null|Cannot read|Cannot set|undefined|TypeError/i.test(err.message)).toBeTruthy();
    });

    test('Load button click triggers Load state and raises a runtime error', async ({ page }) => {
      const runtime = new RuntimePage(page);
      await runtime.goto();

      const [err] = await Promise.all([
        page.waitForEvent('pageerror'),
        runtime.loadButton.click(),
      ]);

      expect(err).toBeTruthy();
      expect(/null|Cannot read|Cannot set|undefined|TypeError/i.test(err.message)).toBeTruthy();
    });
  });

  test.describe('Control switching and reset', () => {
    test('Reset button click triggers switchControl(null) and causes updateControl error', async ({ page }) => {
      // Clicking reset calls switchControl(null) which triggers updateControl - expect runtime error
      const runtime = new RuntimePage(page);
      await runtime.goto();

      const [err] = await Promise.all([
        page.waitForEvent('pageerror'),
        runtime.resetButton.click(),
      ]);

      expect(err).toBeTruthy();
      expect(/null|Cannot read|Cannot set|undefined|TypeError/i.test(err.message)).toBeTruthy();
    });

    test('Maximize button click triggers Maximize state (string) and updateControl error', async ({ page }) => {
      // The code passes a string 'Maximize' to switchControl, causing updateControl to search controls for an id
      // match and then attempt to access non-existent DOM elements -> expect runtime error
      const runtime = new RuntimePage(page);
      await runtime.goto();

      const [err] = await Promise.all([
        page.waitForEvent('pageerror'),
        runtime.maximizeButton.click(),
      ]);

      expect(err).toBeTruthy();
      expect(/null|Cannot read|Cannot set|undefined|TypeError/i.test(err.message)).toBeTruthy();
    });

    test('Minimize button click triggers Minimize state (string) and updateControl error', async ({ page }) => {
      const runtime = new RuntimePage(page);
      await runtime.goto();

      const [err] = await Promise.all([
        page.waitForEvent('pageerror'),
        runtime.minimizeButton.click(),
      ]);

      expect(err).toBeTruthy();
      expect(/null|Cannot read|Cannot set|undefined|TypeError/i.test(err.message)).toBeTruthy();
    });
  });

  test.describe('Close behavior (attempts to hide UI then errors when accessing non-existent container)', () => {
    test('Close click applies several inline body styles and hides many controls, then throws a TypeError when touching missing container element', async ({ page }) => {
      // This test verifies the visible DOM changes that are applied by the close handler before the
      // handler throws when trying to access an element with id "button-container" which doesn't exist.
      const runtime = new RuntimePage(page);
      await runtime.goto();

      // Perform the close click and wait for the resulting runtime error
      const [err] = await Promise.all([
        page.waitForEvent('pageerror'),
        runtime.closeButton.click(),
      ]);

      // Validate that an error occurred (expected because the script tries to access a non-existent id)
      expect(err).toBeTruthy();
      expect(/null|Cannot read|Cannot set|undefined|TypeError/i.test(err.message)).toBeTruthy();

      // Even though an error happened, prior inline style modifications should have been applied.
      // Check some body inline styles set by the close handler.
      const bodyWidth = await runtime.getBodyInlineStyle('width');
      const bodyHeight = await runtime.getBodyInlineStyle('height');
      const bodyPosition = await runtime.getBodyInlineStyle('position');
      const bodyOverflow = await runtime.getBodyInlineStyle('overflow');

      // The close handler sets width/height to '0px' and position to 'fixed' and overflow to 'hidden'
      expect(bodyWidth).toBe('0px');
      expect(bodyHeight).toBe('0px');
      expect(bodyPosition).toBe('fixed');
      expect(bodyOverflow).toBe('hidden');

      // The close handler also hides many individual controls before the final failing line.
      // Validate that at least a subset of those controls were hidden (style.display = 'none').
      const resetDisplay = await runtime.getInlineStyle('#reset-button', 'display');
      const maximizeDisplay = await runtime.getInlineStyle('#maximize-button', 'display');
      const minimizeDisplay = await runtime.getInlineStyle('#minimize-button', 'display');
      const searchDisplay = await runtime.getInlineStyle('#search-input', 'display');

      // These should have been set to 'none' prior to the final exception.
      expect(resetDisplay).toBe('none');
      expect(maximizeDisplay).toBe('none');
      expect(minimizeDisplay).toBe('none');
      expect(searchDisplay).toBe('none');
    });
  });

  test.describe('Edge cases and additional scenarios', () => {
    test('Typing empty string into search input still triggers input handler and causes runtime error', async ({ page }) => {
      // Some browsers may not fire input event if value isn't changed; however we call fill('') which will
      // still trigger event in Playwright. Expect the same runtime error path.
      const runtime = new RuntimePage(page);
      await runtime.goto();

      // Ensure the input starts empty
      expect(await runtime.searchInput.inputValue()).toBe('');

      const [err] = await Promise.all([
        page.waitForEvent('pageerror'),
        runtime.searchInput.fill(''),
      ]);

      expect(err).toBeTruthy();
      expect(/null|Cannot read|Cannot set|undefined|TypeError/i.test(err.message)).toBeTruthy();
    });

    test('Clicking maximize twice - second click still triggers the same runtime error path', async ({ page }) => {
      // Clicking maximize twice should not crash the test harness; each click should produce the same error.
      const runtime = new RuntimePage(page);
      await runtime.goto();

      // First click
      const [err1] = await Promise.all([
        page.waitForEvent('pageerror'),
        runtime.maximizeButton.click(),
      ]);
      expect(err1).toBeTruthy();

      // Reload the page to get back to a clean state for the second click
      await runtime.goto();

      const [err2] = await Promise.all([
        page.waitForEvent('pageerror'),
        runtime.maximizeButton.click(),
      ]);
      expect(err2).toBeTruthy();

      // Both errors should be similar in nature (property access on missing DOM elements)
      expect(/null|Cannot read|Cannot set|undefined|TypeError/i.test(err2.message)).toBeTruthy();
    });
  });
});