import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/17633f32-d5c1-11f0-938c-19d14b60ef51.html';

// Page Object for the Union-Find visualization page
class UnionFindPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Selectors match the inline onclick attributes in the HTML
    this.union01 = page.locator('button[onclick="unionSets(0, 1)"]');
    this.union12 = page.locator('button[onclick="unionSets(1, 2)"]');
    this.union34 = page.locator('button[onclick="unionSets(3, 4)"]');
    this.union04 = page.locator('button[onclick="unionSets(0, 4)"]');
    this.check03 = page.locator('button[onclick="checkConnected(0, 3)"]');
    this.check12 = page.locator('button[onclick="checkConnected(1, 2)"]');
    this.check13 = page.locator('button[onclick="checkConnected(1, 3)"]');

    this.sets = page.locator('#sets');
    this.setItems = page.locator('#sets .disjoint-set');
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Return array of strings like "Element 0: Parent 0"
  async getSetTexts() {
    const count = await this.setItems.count();
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push((await this.setItems.nth(i).innerText()).trim());
    }
    return arr;
  }

  // Return output text
  async getOutputText() {
    return (await this.output.innerText()).trim();
  }

  // Helper to parse parents into an array of numbers. If parse fails returns nulls for entries.
  async getParentArray() {
    const texts = await this.getSetTexts();
    return texts.map(t => {
      const m = t.match(/Parent\s+(-?\d+)/);
      return m ? Number(m[1]) : null;
    });
  }
}

test.describe('Union-Find (Disjoint Set) Visualization - Full E2E', () => {
  let pageErrors = [];
  let consoleErrors = [];

  // Attach listeners before each test to collect console errors and page errors.
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', err => {
      // Collect uncaught errors that bubble up to the page
      pageErrors.push(err);
    });
  });

  // Initial render state tests
  test.describe('Initial State (S0_Initial) and renderSets()', () => {
    test('renders 5 elements and displays initial parents correctly', async ({ page }) => {
      // This test validates initial entry action renderSets() and DOM content
      const ui = new UnionFindPage(page);
      await ui.goto();

      // Ensure no unexpected console errors immediately after load
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);

      // There should be 5 disjoint-set elements rendered.
      const setTexts = await ui.getSetTexts();
      expect(setTexts.length).toBe(5);
      // Each element should display itself as its own parent on initial render
      for (let i = 0; i < 5; i++) {
        expect(setTexts[i]).toBe(`Element ${i}: Parent ${i}`);
      }

      // Output should be empty initially
      const out = await ui.getOutputText();
      expect(out).toBe('');
    });
  });

  // Tests covering union operations and asserting state transitions and DOM updates
  test.describe('Union operations and transitions', () => {
    test('Union (0, 1) updates DOM and outputs expected message', async ({ page }) => {
      // Validate unionSets(0, 1) transition and expected visual feedback
      const ui = new UnionFindPage(page);
      await ui.goto();

      await ui.union01.click();

      // After union, output text should reflect the performed union
      await expect(ui.output).toHaveText('Union operation performed on sets containing 0 and 1.');

      // Parents of 0 and 1 should now be the same (connected)
      const parents = await ui.getParentArray();
      expect(parents[0]).not.toBeNull();
      expect(parents[1]).not.toBeNull();
      expect(parents[0]).toBe(parents[1]);

      // Ensure the rest unchanged except unioned nodes
      expect(parents.length).toBe(5);
      // No console/page errors from this normal operation
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Union (1, 2) connects 1 and 2 and preserves connectivity with 0', async ({ page }) => {
      // Validate unionSets(1, 2) transition and connectivity semantics
      const ui = new UnionFindPage(page);
      await ui.goto();

      // perform union(0,1) then union(1,2)
      await ui.union01.click();
      await ui.union12.click();

      // Output should show the most recent union action
      await expect(ui.output).toHaveText('Union operation performed on sets containing 1 and 2.');

      // Now 0,1,2 should all have the same root
      const parents = await ui.getParentArray();
      const root012 = parents[0];
      expect(root012).toBe(parents[1]);
      expect(root012).toBe(parents[2]);

      // Check the explicit UI connectivity check (button) confirms 1 and 2 connected
      await ui.check12.click();
      // Expected message per FSM
      await expect(ui.output).toHaveText('Elements 1 and 2 are connected.');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Union (3, 4) then Union (0, 4) merges sets and changes connectivity', async ({ page }) => {
      // This validates unionSets(3, 4) and unionSets(0, 4) transitions and eventual connectivity across groups
      const ui = new UnionFindPage(page);
      await ui.goto();

      // Create two groups: {0,1,2} and {3,4}, then merge them
      await ui.union01.click();
      await ui.union12.click();
      await ui.union34.click();

      // After union(3,4), 3 and 4 should share a parent
      let parents = await ui.getParentArray();
      expect(parents[3]).toBe(parents[4]);

      // At this point 0-group and 3-group are separate; check that 0 and 3 are not connected yet via button
      await ui.check03.click();
      await expect(ui.output).toHaveText('Elements 0 and 3 are not connected.');

      // Now merge the groups via union(0,4)
      await ui.union04.click();
      await expect(ui.output).toHaveText('Union operation performed on sets containing 0 and 4.');

      // After merging, all elements 0..4 should share root
      parents = await ui.getParentArray();
      const root = parents[0];
      for (let i = 1; i < parents.length; i++) {
        expect(parents[i]).toBe(root);
      }

      // Now check 1 and 3 connectivity via button checkConnected(1, 3)
      await ui.check13.click();
      await expect(ui.output).toHaveText('Elements 1 and 3 are connected.');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  // Tests covering connectivity checks independently and expected messages
  test.describe('Connectivity checks (CheckConnected events)', () => {
    test('CheckConnected(0, 3) returns not connected on fresh page', async ({ page }) => {
      // Validate FSM event CheckConnected_0_3 in initial state
      const ui = new UnionFindPage(page);
      await ui.goto();

      await ui.check03.click();
      await expect(ui.output).toHaveText('Elements 0 and 3 are not connected.');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('CheckConnected(1, 2) reports connected after union(1,2)', async ({ page }) => {
      const ui = new UnionFindPage(page);
      await ui.goto();

      await ui.union12.click();
      await ui.check12.click();
      await expect(ui.output).toHaveText('Elements 1 and 2 are connected.');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('CheckConnected(1, 3) reports not connected before merging groups', async ({ page }) {
      const ui = new UnionFindPage(page);
      await ui.goto();

      // connect 1 with 2 only
      await ui.union12.click();

      // 1 and 3 should still be not connected
      await ui.check13.click();
      await expect(ui.output).toHaveText('Elements 1 and 3 are not connected.');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  // Edge cases and error scenario tests
  test.describe('Edge cases and error scenarios', () => {
    test('Invoking checkConnected with out-of-range indices throws (let runtime errors surface)', async ({ page }) => {
      // This test intentionally calls internal functions with invalid arguments to let runtime errors occur naturally.
      // The DisjointSet implementation will attempt to access out-of-bounds indices which should produce a runtime error.
      const ui = new UnionFindPage(page);
      await ui.goto();

      // Ensure no errors so far
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);

      // Calling checkConnected(10, 10) is expected to throw due to out-of-bounds access.
      // We assert that the page.evaluate promise rejects with an error.
      await expect(page.evaluate(() => {
        // This uses the existing page global function; per instructions we must not redefine functions.
        return checkConnected(10, 10);
      })).rejects.toThrow();

      // After the thrown error, a page 'pageerror' event may have been emitted and collected.
      // We assert that at least one page error was recorded.
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    });

    test('Invoking unionSets with identical indices is a no-op and does not produce errors', async ({ page }) => {
      // Some implementations may handle union(x,x) gracefully. We assert that calling unionSets(0,0) does not crash.
      const ui = new UnionFindPage(page);
      await ui.goto();

      // Call unionSets(0,0) via evaluate to simulate the button-free call
      await page.evaluate(() => {
        // Should not throw; relying on implemented behavior
        unionSets(0, 0);
      });

      // Output should reflect the union operation (even if it's a no-op)
      await expect(ui.output).toHaveText('Union operation performed on sets containing 0 and 0.');

      // No page errors expected
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });
});