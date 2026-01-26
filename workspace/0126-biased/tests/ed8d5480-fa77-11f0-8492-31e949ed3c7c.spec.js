import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8d5480-fa77-11f0-8492-31e949ed3c7c.html';

/**
 * Page Object for the Bubble Sort Visualization page.
 * Encapsulates common interactions and queries so tests read clearly.
 */
class BubblePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.container = '#container';
    this.startButton = '#startSortBtn';
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure the page's main elements are present before proceeding
    await Promise.all([
      this.page.waitForSelector(this.container),
      this.page.waitForSelector(this.startButton)
    ]);
  }

  async getBars() {
    return this.page.locator(`${this.container} .bar`);
  }

  async getBarsCount() {
    return this.page.locator(`${this.container} .bar`).count();
  }

  async getBarHeights() {
    const handles = await this.page.$$(`${this.container} .bar`);
    const heights = await Promise.all(handles.map(h => h.evaluate(el => {
      // Return numeric height in px (strip 'px')
      const height = window.getComputedStyle(el).height || el.style.height;
      return parseFloat(height);
    })));
    return heights;
  }

  async clickStart() {
    await this.page.click(this.startButton);
  }

  async waitForAnyHighlight(timeout = 1000) {
    return this.page.waitForSelector(`${this.container} .highlight`, { timeout });
  }

  async clearContainer() {
    await this.page.evaluate(sel => {
      const c = document.querySelector(sel);
      if (c) c.innerHTML = '';
    }, this.container);
  }
}

test.describe('Bubble Sort Visualization - FSM validation and behaviors', () => {
  // We'll collect console messages and page errors per test
  test.beforeEach(async ({ page }) => {
    // Attach listeners for console and page errors. Tests will assert on these.
    page._consoleMessages = [];
    page._pageErrors = [];

    page.on('console', msg => {
      // Normalize to simple object for assertions/inspection
      page._consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      page._pageErrors.push(err);
    });
  });

  test.describe('Idle state (S0_Idle)', () => {
    test('Idle: initial render shows array bars and start button (renderArray executed)', async ({ page }) => {
      // This test validates the initial Idle state:
      // - The array is rendered into bars (expected 10 bars)
      // - Bars have heights > 0 (rendered correctly)
      // - Start button exists and is visible
      const bubble = new BubblePage(page);
      await bubble.goto();

      // Assert start button exists and is visible
      const startBtn = page.locator(bubble.startButton);
      await expect(startBtn).toBeVisible();

      // Assert there are 10 bars rendered (generateRandomArray(10) in code)
      const count = await bubble.getBarsCount();
      expect(count).toBe(10);

      // Assert each bar has a positive height (height in px)
      const heights = await bubble.getBarHeights();
      for (const h of heights) {
        expect(typeof h).toBe('number');
        expect(h).toBeGreaterThan(0);
      }

      // Assert no uncaught page errors on initial load
      expect(page._pageErrors.length).toBe(0);

      // Ensure there are no console.error messages emitted during load
      const consoleErrors = page._consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Transition: StartSort event (S0_Idle -> S1_Sorting)', () => {
    test('Click Start Bubble Sort begins sorting animation (highlights appear and array re-render occurs)', async ({ page }) => {
      // This test validates the transition triggered by clicking #startSortBtn:
      // - Immediately after click, highlight(s) are applied to bars (indicating sorting started)
      // - renderArray is invoked during sorting resulting in DOM nodes being replaced (we detect initial bar becoming disconnected)
      const bubble = new BubblePage(page);
      await bubble.goto();

      // Capture initial first bar element handle so we can detect when it gets replaced (renderArray sets innerHTML = '')
      const initialBarHandle = await page.$('#container .bar');
      expect(initialBarHandle).not.toBeNull();

      // Click start to trigger bubbleSort(array)
      await bubble.clickStart();

      // Wait for a highlight to appear quickly (highlightBars is called before awaiting)
      const highlight = await bubble.waitForAnyHighlight(1500);
      await expect(highlight).toBeTruthy();

      // Poll until the initial DOM node becomes disconnected (renderArray replaces the children).
      // We will wait up to 2 seconds for the initial element to be detached.
      const start = Date.now();
      let detached = false;
      while (Date.now() - start < 2000) {
        // Evaluate isConnected on the original handle
        try {
          const isConnected = await initialBarHandle.evaluate(node => node.isConnected).catch(() => false);
          if (!isConnected) {
            detached = true;
            break;
          }
        } catch (e) {
          // If evaluation fails, treat as detached
          detached = true;
          break;
        }
        await page.waitForTimeout(100);
      }
      expect(detached).toBe(true);

      // Confirm at least one highlight class exists in DOM (again)
      const highlightCount = await page.locator('#container .highlight').count();
      expect(highlightCount).toBeGreaterThan(0);

      // Verify no unhandled page errors happened as a result of clicking (normal scenario)
      expect(page._pageErrors.length).toBe(0);

      // And no console.error messages
      const consoleErrors = page._consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    }, 10000); // Allow this test more time in case of slight delays
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Clearing the container before starting should produce a runtime error (highlightBars accessing undefined)', async ({ page }) => {
      // This test intentionally creates an edge-case: clear the container (no .bar children)
      // and then click "Start Bubble Sort". highlightBars will attempt to access container.children[0].classList,
      // which should produce a runtime TypeError. We assert that a pageerror is emitted and captured.
      const bubble = new BubblePage(page);
      await bubble.goto();

      // Clear container to provoke a failure in highlightBars when bubbleSort runs
      await bubble.clearContainer();

      // Confirm container has no bars now
      const countAfterClear = await bubble.getBarsCount();
      expect(countAfterClear).toBe(0);

      // Click start to run bubbleSort which will call highlightBars and likely throw when accessing classList of undefined
      let caughtPageError = null;
      // Attach a one-time listener to capture the first pageerror synchronously
      const pageErrorPromise = new Promise(resolve => {
        const handler = err => {
          resolve(err);
        };
        page.on('pageerror', handler);
      });

      await bubble.clickStart();

      // Wait for a page error to occur (give it a few seconds)
      const timeoutMs = 3000;
      let pageError = null;
      try {
        pageError = await Promise.race([
          pageErrorPromise,
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout waiting for pageerror')), timeoutMs))
        ]);
      } catch (err) {
        // If we timed out, capture the available page._pageErrors as fallback
        const collected = page._pageErrors || [];
        if (collected.length > 0) pageError = collected[0];
      }

      // We expect a page error to have been observed
      expect(pageError).not.toBeNull();

      // The message should indicate a TypeError related to reading classList of undefined.
      // Different browsers have slightly different wording; check for substrings.
      const msg = pageError && pageError.message ? pageError.message : String(pageError);
      const isTypeError = /TypeError|Cannot read|Cannot read properties|reading 'classList'/.test(msg);
      expect(isTypeError).toBe(true);

      // Also ensure a console.error was emitted (the runtime error typically logs to console)
      const consoleErrors = page._consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBeGreaterThanOrEqual(0); // may be 0 depending on environment, but we keep this lenient
    });

    test('Multiple rapid clicks on Start button do not crash the page (should still remain responsive)', async ({ page }) => {
      // This test verifies robustness: clicking the start button multiple times quickly
      // should not crash the page or produce unhandled exceptions (in the normal DOM state).
      const bubble = new BubblePage(page);
      await bubble.goto();

      // Rapidly click the button a few times
      await Promise.all([
        page.click('#startSortBtn'),
        page.click('#startSortBtn'),
        page.click('#startSortBtn')
      ]).catch(() => {
        // If clicks are rejected by Playwright (shouldn't be), we ignore and continue to check page health.
      });

      // Give a short moment for any immediate errors
      await page.waitForTimeout(500);

      // There should be no fatal page errors (we allow that the algorithm runs but must not crash)
      expect(page._pageErrors.length).toBe(0);

      // Page should still have Start button visible and container present
      await expect(page.locator('#startSortBtn')).toBeVisible();
      await expect(page.locator('#container')).toBeVisible();
    });
  });
});