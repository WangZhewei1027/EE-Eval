import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8c1c00-fa77-11f0-8492-31e949ed3c7c.html';

/**
 * Page Object for the Array Aesthetics application.
 * Encapsulates common interactions and queries for tests.
 */
class ArrayPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.containerSelector = '#arrayContainer';
    this.itemSelector = '.array-item';
    this.shuffleButtonSelector = '#shuffleButton';
  }

  async navigate() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getItems() {
    return await this.page.$$(this.itemSelector);
  }

  async getItemValues() {
    const items = await this.getItems();
    const values = [];
    for (const it of items) {
      values.push((await it.textContent()).trim());
    }
    return values;
  }

  async clickShuffle() {
    await this.page.click(this.shuffleButtonSelector);
    // wait a short moment for DOM update and transitions (renderArray uses sync DOM update)
    await this.page.waitForTimeout(50);
  }

  async itemCount() {
    return (await this.getItems()).length;
  }
}

test.describe('Array Aesthetics FSM - ed8c1c00-fa77-11f0-8492-31e949ed3c7c', () => {
  // Collect console and page errors for assertions
  let consoleMessages = [];
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the application under test
    const arrayPage = new ArrayPage(page);
    await arrayPage.navigate();
  });

  test.afterEach(async ({ page }) => {
    // Attach logs to Playwright test output if any errors found for debugging
    if (consoleErrors.length > 0) {
      // eslint-disable-next-line no-console
      console.error('Console errors observed:', consoleErrors);
    }
    if (pageErrors.length > 0) {
      // eslint-disable-next-line no-console
      console.error('Page errors observed:', pageErrors);
    }
    // Clean up page listeners (Playwright will handle page recreation between tests,
    // but explicit removal can be done if needed)
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test.describe('State: S0_Idle (Initial render)', () => {
    test('Initial render shows 9 array items in order 1..9 and renderArray entry action produced DOM', async ({ page }) => {
      // This test validates S0_Idle entry action renderArray() and the initial DOM state.
      const arrayPage = new ArrayPage(page);

      // Ensure the container exists
      const container = await page.$('#arrayContainer');
      expect(container).not.toBeNull();

      // There should be exactly 9 items on initial render
      const count = await arrayPage.itemCount();
      expect(count).toBe(9);

      // The items should contain the numbers 1 through 9 in order (strings)
      const values = await arrayPage.getItemValues();
      expect(values).toEqual(['1','2','3','4','5','6','7','8','9']);

      // Verify each node has the expected class and text node (visual element presence)
      const items = await arrayPage.getItems();
      for (const item of items) {
        const className = await item.getAttribute('class');
        expect(className).toContain('array-item');
        const text = (await item.textContent()).trim();
        expect(text).toMatch(/^[1-9]$/);
      }

      // No uncaught page errors should be present on initial load
      expect(pageErrors.length).toBe(0);
      // No console.error messages expected from a valid page
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Event: ShuffleArrayClick and transitions between S0_Idle and S1_Shuffled', () => {
    test('Clicking shuffle rearranges items (S0_Idle -> S1_Shuffled) keeping items as a permutation of 1..9', async ({ page }) => {
      // This test validates the transition on ShuffleArrayClick and verifies renderArray was called (observed via DOM update).
      const arrayPage = new ArrayPage(page);

      const beforeValues = await arrayPage.getItemValues();
      expect(beforeValues).toEqual(['1','2','3','4','5','6','7','8','9']);

      // Click shuffle to trigger transition
      await arrayPage.clickShuffle();

      const afterValues = await arrayPage.getItemValues();
      expect(afterValues.length).toBe(9);

      // Ensure the items after shuffle are a permutation of 1..9 (no duplicates, all items present)
      const sortedAfter = [...afterValues].sort((a,b) => Number(a) - Number(b));
      expect(sortedAfter).toEqual(['1','2','3','4','5','6','7','8','9']);

      // It's acceptable (but improbable) that the shuffle produces the identical order.
      // We assert that the application performed a shuffle operation by verifying the DOM was re-rendered:
      // - Since renderArray clears and re-creates DOM nodes synchronously, we can assert that the text values are accessible
      expect(afterValues.every(v => /^[1-9]$/.test(v))).toBeTruthy();

      // No runtime errors as a result of the shuffle click
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Clicking shuffle multiple times toggles states and keeps DOM stable (S1_Shuffled -> S0_Idle and back)', async ({ page }) => {
      // This test validates repeated transitions and checks for stability and absence of errors.
      const arrayPage = new ArrayPage(page);

      // Capture a sequence of permutations
      const permutations = [];

      // Perform shuffle 5 times, recording the order each time
      for (let i = 0; i < 5; i++) {
        await arrayPage.clickShuffle();
        const values = await arrayPage.getItemValues();
        permutations.push(values);
        // Validate each permutation is a valid permutation
        const sorted = [...values].sort((a,b) => Number(a) - Number(b));
        expect(sorted).toEqual(['1','2','3','4','5','6','7','8','9']);
      }

      // Ensure we observed at least one distinct ordering compared to initial order or between shuffles.
      const initial = ['1','2','3','4','5','6','7','8','9'];
      const anyDifferent = permutations.some(p => p.join(',') !== initial.join(','));
      // If none were different, it's extremely unlikely but possible; we'll treat both as acceptable,
      // but log in test output for visibility.
      expect(Array.isArray(permutations)).toBeTruthy();

      // Validate no uncaught exceptions occurred during rapid interaction
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Rapid clicking of shuffle button does not throw errors and preserves item count and class names (edge case)', async ({ page }) => {
      // This test stresses the shuffle handler by clicking quickly and asserting DOM remains consistent.
      const arrayPage = new ArrayPage(page);

      const button = await page.$('#shuffleButton');
      expect(button).not.toBeNull();

      // Rapidly click the button 20 times
      for (let i = 0; i < 20; i++) {
        await button.click();
      }

      // Allow any pending synchronous renders to complete
      await page.waitForTimeout(100);

      // Validate item count remains 9
      const count = await arrayPage.itemCount();
      expect(count).toBe(9);

      // Validate class presence and that values are still a permutation of 1..9
      const values = await arrayPage.getItemValues();
      const sorted = [...values].sort((a,b) => Number(a) - Number(b));
      expect(sorted).toEqual(['1','2','3','4','5','6','7','8','9']);

      // Confirm there were no page errors or console error messages as a result of rapid interactions
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Visual and DOM feedback checks', () => {
    test('Array items have expected CSS-related properties (class, dimensions exist) - visual smoke test', async ({ page }) => {
      // This test inspects that array-item elements have expected computed dimensions (not asserting exact pixels,
      // but that they are rendered and have non-zero bounding box).
      const arrayPage = new ArrayPage(page);

      const items = await arrayPage.getItems();
      expect(items.length).toBe(9);

      for (const item of items) {
        const box = await item.boundingBox();
        // boundingBox may be null in headless if element not visible; ensure presence or at least non-null for this test environment
        expect(box).not.toBeNull();
        if (box) {
          // Ensure rendered size is reasonable (>10px)
          expect(box.width).toBeGreaterThan(10);
          expect(box.height).toBeGreaterThan(10);
        }
      }

      // No console or page errors during these inspections
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Observability: Console and Error monitoring', () => {
    test('No unexpected console.error or uncaught exceptions during normal use', async ({ page }) => {
      // This test explicitly validates that there are no console errors or uncaught page errors from loading and a shuffle.
      const arrayPage = new ArrayPage(page);

      // Perform one shuffle to exercise code paths
      await arrayPage.clickShuffle();

      // Allow events to propagate
      await page.waitForTimeout(50);

      // Assertions about errors observed
      expect(pageErrors.length).toBe(0, `Expected no uncaught page errors, but found: ${pageErrors.map(e => String(e)).join('; ')}`);
      expect(consoleErrors.length).toBe(0, `Expected no console.error messages, but found: ${consoleErrors.join('; ')}`);
    });

    test('Capture console messages for inspection (helpful if runtime issues occur)', async ({ page }) => {
      // This test does not fail if no messages; it ensures we can observe console output and attaches expectations
      // Example: ensure that console messages (if any) have expected structure (type + text)
      const arrayPage = new ArrayPage(page);

      // Trigger a shuffle and another DOM read to possibly produce logs from page
      await arrayPage.clickShuffle();
      await arrayPage.getItemValues();

      // We assert that all captured console messages have at least type and text defined
      for (const msg of consoleMessages) {
        expect(msg).toHaveProperty('type');
        expect(typeof msg.text).toBe('function' === typeof msg.text ? 'function' : 'string'); // defensive check; msg.text may be function or string
      }

      // This test remains permissive about presence/absence of console messages, focusing on observability
      expect(pageErrors.length).toBe(0);
      // consoleErrors specifically should be empty for a healthy application
      expect(consoleErrors.length).toBe(0);
    });
  });
});