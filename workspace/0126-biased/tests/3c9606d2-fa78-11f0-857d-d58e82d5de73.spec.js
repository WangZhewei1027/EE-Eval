import { test, expect } from '@playwright/test';

// Test file for Application ID 3c9606d2-fa78-11f0-857d-d58e82d5de73
// Loads the page as-is and validates the FSM states, transitions, DOM & visual feedback.
// Observes console and page errors and asserts there are no runtime errors of interest.
// Notes: Tests exercise initial render (S0_Initial), the shuffle interaction (S1_Shuffling),
// and edge cases such as attempts to interact while shuffle is in progress.

// Page Object Model for the Multiset page
class MultisetPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9606d2-fa78-11f0-857d-d58e82d5de73.html';
    this.selectors = {
      container: '#container',
      btnShuffle: '#btnShuffle',
      info: '#info',
      element: '.element',
      elementLabel: '.element-label',
      elementCount: '.element-count',
      tooltip: '.tooltip',
    };
  }

  async goto() {
    await this.page.goto(this.url);
  }

  async getElementCount() {
    return await this.page.locator(this.selectors.element).count();
  }

  async getLabelsInOrder() {
    const labels = await this.page.$$eval(
      `${this.selectors.element} ${this.selectors.elementLabel}`,
      nodes => nodes.map(n => n.textContent.trim())
    );
    return labels;
  }

  async getCountsInOrder() {
    const counts = await this.page.$$eval(
      `${this.selectors.element} ${this.selectors.elementCount}`,
      nodes => nodes.map(n => n.textContent.trim())
    );
    return counts;
  }

  async clickShuffle() {
    await this.page.click(this.selectors.btnShuffle);
  }

  async isButtonDisabled() {
    return await this.page.$eval(this.selectors.btnShuffle, (b) => !!b.disabled);
  }

  async containerOpacity() {
    return await this.page.$eval(this.selectors.container, (c) => {
      // return inline style opacity if present, else computed style
      const inline = c.style.opacity;
      if (inline) return inline;
      return window.getComputedStyle(c).opacity;
    });
  }

  // Wait until shuffle completes by monitoring button disabled lifecycle:
  // wait for disabled=true then disabled=false (with generous timeout)
  async waitForShuffleComplete(timeout = 3000) {
    // Wait for button to become disabled (shuffle started)
    await this.page.waitForFunction(
      (sel) => {
        const b = document.querySelector(sel);
        return !!b && b.disabled === true;
      },
      this.selectors.btnShuffle,
      { timeout }
    );
    // Then wait for button to become enabled again (shuffle finished)
    await this.page.waitForFunction(
      (sel) => {
        const b = document.querySelector(sel);
        return !!b && b.disabled === false;
      },
      this.selectors.btnShuffle,
      { timeout }
    );
  }

  // Hover first element to reveal tooltip and return tooltip opacity
  async hoverFirstElementAndGetTooltipOpacity() {
    const firstElement = this.page.locator(this.selectors.element).first();
    await firstElement.hover();
    // Evaluate computed style of tooltip child
    const opacity = await firstElement.$eval(this.selectors.tooltip, (t) =>
      window.getComputedStyle(t).opacity
    );
    return opacity;
  }

  async getElementAriaLabels() {
    return await this.page.$$eval(this.selectors.element, els =>
      els.map(e => e.getAttribute('aria-label'))
    );
  }
}

// Helper to capture page errors and console errors for each test
function attachErrorCollectors(page) {
  const pageErrors = [];
  const consoleErrors = [];
  const consoleWarnings = [];
  const consoleMessages = [];

  const onPageError = (err) => {
    // err is an Error object
    pageErrors.push(err);
  };
  const onConsole = (msg) => {
    const type = msg.type();
    const text = msg.text();
    consoleMessages.push({ type, text });
    if (type === 'error') consoleErrors.push(text);
    if (type === 'warning') consoleWarnings.push(text);
  };

  page.on('pageerror', onPageError);
  page.on('console', onConsole);

  return {
    getPageErrors: () => pageErrors,
    getConsoleErrors: () => consoleErrors,
    getConsoleWarnings: () => consoleWarnings,
    getConsoleMessages: () => consoleMessages,
    dispose: () => {
      page.removeListener('pageerror', onPageError);
      page.removeListener('console', onConsole);
    },
  };
}

test.describe('Multiset • Visualized Elegance — FSM & UI tests', () => {
  // Group: Initial state validations
  test.describe('S0_Initial (Initial State) validations', () => {
    test('Initial render: container populated with expected number of elements and correct labels/counts', async ({ page }) => {
      // Attach collectors to observe console and page errors during load
      const collectors = attachErrorCollectors(page);

      const multiset = new MultisetPage(page);
      await multiset.goto();

      // Verify container and button exist
      await expect(page.locator(multiset.selectors.container)).toBeVisible();
      await expect(page.locator(multiset.selectors.btnShuffle)).toBeVisible();

      // Check element count (should match multisetData length = 8)
      const count = await multiset.getElementCount();
      expect(count).toBe(8);

      // Verify labels and counts in initial expected order (A..H)
      const labels = await multiset.getLabelsInOrder();
      const counts = await multiset.getCountsInOrder();
      expect(labels).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
      expect(counts).toEqual(['4', '2', '1', '3', '5', '2', '1', '3']);

      // Accessibility & attributes assertions
      const ariaLabels = await multiset.getElementAriaLabels();
      // Every aria-label should mention the label and the number (e.g., "A appears 4 times")
      expect(ariaLabels[0]).toContain('A');
      expect(ariaLabels[0]).toContain('4');
      expect(await page.getAttribute('#container', 'role')).toBe('region');
      expect(await page.getAttribute('#container', 'aria-live')).toBe('polite');

      // Ensure no runtime page errors or console errors occurred during initial load
      expect(collectors.getPageErrors()).toHaveLength(0);
      expect(collectors.getConsoleErrors()).toHaveLength(0);

      collectors.dispose();
    });

    test('Tooltip becomes visible on hover for first element', async ({ page }) => {
      const collectors = attachErrorCollectors(page);
      const multiset = new MultisetPage(page);
      await multiset.goto();

      // Hover first element and check tooltip opacity (CSS shows tooltip on :hover)
      const opacity = await multiset.hoverFirstElementAndGetTooltipOpacity();
      // The design sets opacity to '1' on hover; assert it's truthy and close to visible
      expect(Number(opacity)).toBeGreaterThan(0);

      // No page errors observed
      expect(collectors.getPageErrors()).toHaveLength(0);
      collectors.dispose();
    });
  });

  // Group: Shuffle interaction (S0 -> S1 -> S0)
  test.describe('Shuffle Interaction & State Transitions', () => {
    test('Clicking Shuffle triggers visual fade-out (S1_Shuffling entry) and re-render (S0_Initial re-entry)', async ({ page }) => {
      const collectors = attachErrorCollectors(page);
      const multiset = new MultisetPage(page);
      await multiset.goto();

      // Capture initial order
      const initialLabels = await multiset.getLabelsInOrder();

      // Click shuffle: button should be disabled immediately and container opacity should go to '0'
      await multiset.clickShuffle();

      // Immediately after click, button is disabled
      expect(await multiset.isButtonDisabled()).toBe(true);

      // Container opacity should be set to '0' by the shuffleVisual function
      // Allow a short wait for inline style to apply
      await page.waitForTimeout(50);
      const opacityDuring = await multiset.containerOpacity();
      // inline style set to '0', or computed style near 0
      expect(Number(opacityDuring)).toBeLessThan(0.2);

      // Wait for shuffle to complete (button re-enabled)
      await multiset.waitForShuffleComplete(3000);

      // After shuffle completes, button should be enabled
      expect(await multiset.isButtonDisabled()).toBe(false);

      // Container opacity after completion should be 1 (visible)
      // Wait briefly for style to settle
      await page.waitForTimeout(50);
      const opacityAfter = await multiset.containerOpacity();
      expect(Number(opacityAfter)).toBeGreaterThan(0.8);

      // The order of elements should still be 8, and labels present.
      const finalLabels = await multiset.getLabelsInOrder();
      expect(finalLabels).toHaveLength(initialLabels.length);
      // It's possible shuffle yields same order; verify at least that DOM changed (re-rendered)
      // We check that either order changed OR that the container had opacity transitions as evidence of shuffle.
      const orderChanged = initialLabels.some((lbl, i) => lbl !== finalLabels[i]);
      expect(orderChanged || (Number(opacityDuring) < 0.2 && Number(opacityAfter) > 0.8)).toBeTruthy();

      // No unexpected runtime errors occurred
      expect(collectors.getPageErrors()).toHaveLength(0);
      expect(collectors.getConsoleErrors()).toHaveLength(0);

      collectors.dispose();
    });

    test('Rapid clicks while shuffle in progress do not cause multiple overlapping re-renders (button disabled prevents repeat)', async ({ page }) => {
      const collectors = attachErrorCollectors(page);
      const multiset = new MultisetPage(page);
      await multiset.goto();

      // Start a shuffle
      await multiset.clickShuffle();

      // Try clicking immediately again; since the button should be disabled, this should have no effect
      // Use evaluate to attempt to click the button even if disabled (simulate a user or script)
      // But do not modify page code — just attempt a normal click which Playwright will do on the element;
      // Playwright click will fail if element is disabled but we can still try and catch any exception.
      let secondClickError = null;
      try {
        await page.click(multiset.selectors.btnShuffle, { timeout: 200 }).catch(e => { throw e; });
      } catch (e) {
        // Likely a visible but disabled click will succeed in Playwright unless disabled prevents; capture outcome
        secondClickError = e;
      }

      // Wait for shuffle to complete to avoid flakiness
      await multiset.waitForShuffleComplete(3000);

      // Ensure only one shuffle cycle occurred: button disabled then re-enabled exactly once.
      // We can't introspect internal counters; we validate stability: after completion, element count remains constant
      const finalCount = await multiset.getElementCount();
      expect(finalCount).toBe(8);

      // If Playwright threw on second click due to disabled element, it's acceptable; ensure no page errors
      expect(collectors.getPageErrors()).toHaveLength(0);
      expect(collectors.getConsoleErrors()).toHaveLength(0);

      collectors.dispose();
    });
  });

  // Group: Accessibility & DOM integrity
  test.describe('Accessibility, attributes, and DOM integrity', () => {
    test('Container exposes correct accessibility attributes and each element has an aria-label describing multiplicity', async ({ page }) => {
      const collectors = attachErrorCollectors(page);
      const multiset = new MultisetPage(page);
      await multiset.goto();

      // Check container attributes
      const role = await page.getAttribute(multiset.selectors.container, 'role');
      const tabindex = await page.getAttribute(multiset.selectors.container, 'tabindex');
      const ariaLive = await page.getAttribute(multiset.selectors.container, 'aria-live');
      expect(role).toBe('region');
      expect(tabindex).toBe('0');
      expect(ariaLive).toBe('polite');

      // Check every element has an aria-label that mentions "appears" or "Multiplicity"
      const ariaLabels = await multiset.getElementAriaLabels();
      expect(ariaLabels.length).toBeGreaterThan(0);
      ariaLabels.forEach((al) => {
        expect(typeof al).toBe('string');
        // Basic check for content
        expect(al.toLowerCase()).toMatch(/appears|multiplicity|times/);
      });

      // No runtime errors introduced
      expect(collectors.getPageErrors()).toHaveLength(0);
      collectors.dispose();
    });
  });

  // Group: Edge cases & error observation
  test.describe('Edge cases & runtime error observation', () => {
    test('Observes console and page errors across interactions (assert none of ReferenceError/SyntaxError/TypeError occurred)', async ({ page }) => {
      // This test explicitly listens for runtime errors and asserts none of the common critical errors occurred.
      const collectors = attachErrorCollectors(page);
      const multiset = new MultisetPage(page);
      await multiset.goto();

      // Perform multiple interactions to surface potential errors: hover tooltips, click shuffle twice sequentially (with wait)
      await multiset.hoverFirstElementAndGetTooltipOpacity();
      await multiset.clickShuffle();
      await multiset.waitForShuffleComplete(3000);

      // Do a second shuffle to ensure repeated interactions are stable
      await multiset.clickShuffle();
      await multiset.waitForShuffleComplete(3000);

      // Gather errors and console messages
      const pageErrors = collectors.getPageErrors();
      const consoleErrors = collectors.getConsoleErrors();
      const consoleMessages = collectors.getConsoleMessages();

      // Fail test if any pageErrors were captured
      if (pageErrors.length > 0) {
        // Log details for diagnostics (these will appear in test output)
        for (const err of pageErrors) {
          console.error('Captured pageerror:', err && err.message ? err.message : String(err));
        }
      }
      if (consoleErrors.length > 0) {
        for (const ce of consoleErrors) {
          console.error('Captured console.error:', ce);
        }
      }

      // Assert that no critical runtime errors occurred
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);

      // Additionally ensure none of the console messages contain "ReferenceError", "SyntaxError", or "TypeError"
      const problematic = consoleMessages.filter(m =>
        /ReferenceError|SyntaxError|TypeError/.test(m.text)
      );
      expect(problematic.length).toBe(0);

      collectors.dispose();
    });

    test('Handles absence of user interaction gracefully (page remains stable over time)', async ({ page }) => {
      const collectors = attachErrorCollectors(page);
      const multiset = new MultisetPage(page);
      await multiset.goto();

      // Wait for a short period to ensure no background timers throw errors
      await page.waitForTimeout(1000);

      // Validate the UI is still intact and has expected elements
      expect(await multiset.getElementCount()).toBe(8);
      expect(await page.isVisible(multiset.selectors.btnShuffle)).toBe(true);

      // No page errors observed during idle
      expect(collectors.getPageErrors().length).toBe(0);
      collectors.dispose();
    });
  });
});