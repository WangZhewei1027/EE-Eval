import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c998943-fa78-11f0-857d-d58e82d5de73.html';

// Page object to encapsulate interactions and assertions for the indexing visual
class IndexingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait for the data-list to be present and initial highlight to settle
    await this.page.waitForSelector('.data-list .data-item');
    // Wait for the highlighted class to be set on initial element (updateHighlight called on init)
    await this.page.waitForSelector('.data-item.highlighted');
  }

  // Element handles
  async cycleButton() {
    return this.page.locator('#cycle-btn');
  }
  async indexMarkers() {
    return this.page.locator('.index-marker');
  }
  async dataItems() {
    return this.page.locator('.data-item');
  }
  async cards() {
    return this.page.locator('.card');
  }
  async indexArrow() {
    return this.page.locator('.index-arrow');
  }
  async explanation() {
    return this.page.locator('#explanation-text');
  }

  // Utility: returns zero-based index of currently highlighted data-item (based on class 'highlighted')
  async getActiveDataIndex() {
    const count = await this.dataItems().count();
    for (let i = 0; i < count; i++) {
      const el = this.dataItems().nth(i);
      if (await el.evaluate((n) => n.classList.contains('highlighted'))) {
        return i;
      }
    }
    return -1;
  }

  // Returns whether marker i has highlighted class and aria-selected attribute
  async getMarkerState(i) {
    const marker = this.indexMarkers().nth(i);
    const hasHighlighted = await marker.evaluate((el) => el.classList.contains('highlighted'));
    const ariaSelected = await marker.getAttribute('aria-selected');
    return { hasHighlighted, ariaSelected };
  }

  // Returns attributes of data item i
  async getDataItemState(i) {
    const item = this.dataItems().nth(i);
    const hasHighlighted = await item.evaluate((el) => el.classList.contains('highlighted'));
    const ariaCurrent = await item.getAttribute('aria-current');
    const tabIndex = await item.getAttribute('tabindex');
    const id = await item.getAttribute('id');
    return { id, hasHighlighted, ariaCurrent, tabIndex };
  }

  // Returns inline style transform for card i
  async getCardStyle(i) {
    const card = this.cards().nth(i);
    const transform = await card.evaluate((el) => el.style.transform);
    const boxShadow = await card.evaluate((el) => el.style.boxShadow);
    const zIndex = await card.evaluate((el) => el.style.zIndex);
    return { transform, boxShadow, zIndex };
  }

  // Returns indexArrow style.top value (string)
  async getIndexArrowTop() {
    const arrow = await this.indexArrow();
    return arrow.evaluate((el) => el.style.top);
  }

  // Click the cycle button once
  async clickCycle(times = 1) {
    const btn = await this.cycleButton();
    for (let i = 0; i < times; i++) {
      await btn.click();
      // Allow the UI to update after each click
      await this.page.waitForTimeout(120); // small debounce to allow DOM updates
    }
  }

  // Assert the active index equals expected and validate DOM attributes for that state
  async expectActiveIndex(expectedIndex) {
    // Active data index by class
    const activeIndex = await this.getActiveDataIndex();
    expect(activeIndex).toBe(expectedIndex);

    // Data item state validations
    for (let i = 0; i < (await this.dataItems().count()); i++) {
      const state = await this.getDataItemState(i);
      if (i === expectedIndex) {
        expect(state.hasHighlighted, `data-item ${i} should have highlighted class`).toBe(true);
        expect(state.ariaCurrent, `data-item ${i} should have aria-current="true"`).toBe('true');
        expect(state.tabIndex, `data-item ${i} should have tabindex="0"`).toBe('0');
      } else {
        expect(state.hasHighlighted, `data-item ${i} should NOT have highlighted class`).toBe(false);
        // aria-current removed for non-active items (null)
        expect(state.ariaCurrent === null || state.ariaCurrent === 'false').toBe(true);
        expect(state.tabIndex, `data-item ${i} should have tabindex="-1"`).toBe('-1');
      }
    }

    // Index marker validations (only first maxIndex markers are used)
    const maxIndex = await this.dataItems().count();
    const markerCount = await this.indexMarkers().count();
    for (let i = 0; i < markerCount; i++) {
      const marker = await this.getMarkerState(i);
      if (i < maxIndex) {
        if (i === expectedIndex) {
          expect(marker.hasHighlighted, `marker ${i} should be highlighted`).toBe(true);
          expect(marker.ariaSelected, `marker ${i} should have aria-selected true`).toBe('true');
        } else {
          expect(marker.hasHighlighted, `marker ${i} should NOT be highlighted`).toBe(false);
          expect(marker.ariaSelected === 'false' || marker.ariaSelected === null).toBe(true);
        }
      } else {
        // Markers beyond maxIndex should remain untouched (should not be highlighted)
        expect(marker.hasHighlighted, `marker ${i} beyond maxIndex should NOT be highlighted`).toBe(false);
      }
    }

    // Card style validations
    for (let i = 0; i < (await this.cards().count()); i++) {
      const style = await this.getCardStyle(i);
      if (i === expectedIndex) {
        expect(style.transform.includes('translateZ(24px)'), `card ${i} should be pushed forward`).toBe(true);
        expect(style.zIndex === '5' || style.zIndex === 5).toBe(true);
        expect(style.boxShadow && style.boxShadow.length > 0).toBe(true);
      } else {
        expect(style.transform.includes('translateZ(0px)'), `card ${i} should be reset`).toBe(true);
        expect(style.zIndex === '1' || style.zIndex === 1).toBe(true);
      }
    }

    // Explanation text should match one of the explanation variants (safe check)
    const explanationText = (await this.explanation().textContent()) || '';
    expect(explanationText.length).toBeGreaterThan(10);
  }
}

test.describe('Indexing — Visual Metaphor & Explanation (FSM validation)', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // Capture console messages and page errors for assertions later
    pageErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });
  });

  test.afterEach(async ({ page }) => {
    // detach listeners to be safe (Playwright cleans up, but remove to avoid cross-test leaks)
    page.removeAllListeners('pageerror');
    page.removeAllListeners('console');
  });

  test('Initial state: S0_Initial -> S1_Highlighted_0 (entry_action updateHighlight(0))', async ({ page }) => {
    // This test validates that on load the page initializes the highlight to index 0
    const app = new IndexingPage(page);
    await app.goto();

    // Validate active index is 0 and all related DOM attributes/styles updated
    await app.expectActiveIndex(0);

    // Ensure the focused element is the active data item (updateHighlight focuses it)
    const activeId = await page.evaluate(() => document.activeElement?.id || null);
    expect(activeId).toBe('data-1');

    // Validate index arrow moved to align with the first marker (style.top should be non-empty and in px)
    const arrowTop = await app.getIndexArrowTop();
    expect(arrowTop).toMatch(/px$/);
    // No page errors during initialization
    expect(pageErrors.length, 'no fatal page errors on initialization').toBe(0);
  });

  test('CycleHighlight event: transitions S1->S2->S3->S1 via #cycle-btn clicks', async ({ page }) => {
    // This test validates the click event cycles through highlights as per the FSM transitions
    const app = new IndexingPage(page);
    await app.goto();

    // initial state is 0
    await app.expectActiveIndex(0);

    // Click once: expect index 1 (S2_Highlighted_1)
    await app.clickCycle(1);
    await app.expectActiveIndex(1);

    // Click again: expect index 2 (S3_Highlighted_2)
    await app.clickCycle(1);
    await app.expectActiveIndex(2);

    // Click again: should wrap around to 0 (S1_Highlighted_0)
    await app.clickCycle(1);
    await app.expectActiveIndex(0);

    // Validate explanation text changed across transitions (should match one of the variants)
    const explanationText = (await app.explanation().textContent()) || '';
    expect([
      'Indexing improves retrieval speed by creating a direct path to the data, avoiding the need to scan everything.',
      'Think of an index like a smart directory, instantly guiding you to what you seek.',
      'Indexes greatly reduce lookup time, enhancing system performance especially for large datasets.'
    ]).toContain(explanationText);

    // Confirm no unhandled exceptions during interactions
    expect(pageErrors.length, 'no page errors during cycling interactions').toBe(0);
  });

  test('Edge cases: only first N markers are used; extra markers remain unchanged', async ({ page }) => {
    // Validate the implementation handles mismatch between markers and data items (5 markers, 3 data)
    const app = new IndexingPage(page);
    await app.goto();

    // The implementation is expected to only use the first dataItems.length markers
    const maxIndex = await app.dataItems().count(); // expected 3
    const markerCount = await app.indexMarkers().count(); // expected 5

    expect(maxIndex).toBe(3);
    expect(markerCount).toBeGreaterThanOrEqual(3);

    // After initialization, markers beyond maxIndex should not be highlighted
    for (let i = maxIndex; i < markerCount; i++) {
      const marker = await app.getMarkerState(i);
      expect(marker.hasHighlighted, `marker ${i} (beyond maxIndex) should not be highlighted`).toBe(false);
      // aria-selected should either be 'false' or not present. The code doesn't manipulate beyond maxIndex.
      expect(marker.ariaSelected === 'false' || marker.ariaSelected === null).toBe(true);
    }

    // Cycle through all valid indices and ensure beyond markers still unchanged
    await app.clickCycle(1); // to 1
    await app.clickCycle(1); // to 2
    for (let i = maxIndex; i < markerCount; i++) {
      const marker = await app.getMarkerState(i);
      expect(marker.hasHighlighted, `marker ${i} should remain not highlighted after cycling`).toBe(false);
    }

    expect(pageErrors.length).toBe(0);
  });

  test('Rapid clicking and wrap-around consistency (edge behavior)', async ({ page }) => {
    // Validates that multiple rapid clicks still result in consistent wrap-around behavior
    const app = new IndexingPage(page);
    await app.goto();

    // Click 6 times (2 full cycles for 3 items) and expect to land back at index 0
    await app.clickCycle(6);
    await app.expectActiveIndex(0);

    // Click 4 times -> (0 + 4) % 3 = 1
    await app.clickCycle(4);
    await app.expectActiveIndex(1);

    expect(pageErrors.length).toBe(0);
  });

  test('Observes console messages and page errors during full interaction flow', async ({ page }) => {
    // This test intentionally gathers console messages and page errors while interacting with the app.
    // It asserts that no runtime exceptions (ReferenceError/SyntaxError/TypeError) were thrown during normal usage.
    const app = new IndexingPage(page);
    await app.goto();

    // Clear any early console messages captured during load to focus on interaction
    consoleMessages = [];

    // Perform a sequence of interactions
    await app.clickCycle(1); // to 1
    await app.clickCycle(1); // to 2
    await app.clickCycle(1); // to 0

    // Inspect captured console messages to ensure there are no error-level logs
    const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error');
    if (errorConsoleMessages.length > 0) {
      // If there are any console errors, fail with details to help debugging
      const joined = errorConsoleMessages.map((m) => m.text).join('\n---\n');
      throw new Error(`Console errors were detected during interactions:\n${joined}`);
    }

    // Assert no pageerror events occurred
    expect(pageErrors.length, 'no page errors (exceptions) during interactions').toBe(0);
  });
});