import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72a94200-fa78-11f0-812d-c9788050701f.html';

// Page Object Model for interacting with the B+ Tree page
class TreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleErrors = [];
    this.pageErrors = [];

    // Capture console errors and page errors for assertions
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        this.consoleErrors.push(msg.text());
      }
    });
    this.page.on('pageerror', err => {
      this.pageErrors.push(err.message);
    });
  }

  // Navigate to the app and wait for initial render
  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the main controls to be available
    await this.page.waitForSelector('#insert-btn', { state: 'visible' });
    await this.page.waitForSelector('#highlight-btn', { state: 'visible' });
    // Wait for at least one node to be rendered (initial visualization)
    await this.page.waitForSelector('.node', { state: 'attached', timeout: 5000 }).catch(() => {});
  }

  // Click the Insert Random Key button
  async clickInsert() {
    await this.page.click('#insert-btn');
  }

  // Click the Highlight Path button
  async clickHighlight() {
    await this.page.click('#highlight-btn');
  }

  // Return number of .key elements in the DOM
  async getKeyCount() {
    return await this.page.locator('.key').count();
  }

  // Return number of .node elements in the DOM
  async getNodeCount() {
    return await this.page.locator('.node').count();
  }

  // Return number of highlighted key elements
  async getHighlightedKeyCount() {
    return await this.page.locator('.key.highlight').count();
  }

  // Wait until at least one highlighted key appears or timeout
  async waitForAnyHighlight(timeout = 4000) {
    return await this.page.waitForFunction(() => {
      return document.querySelector('.key.highlight') !== null;
    }, { timeout }).catch(() => null);
  }

  // Return captured console error messages
  getConsoleErrors() {
    return this.consoleErrors;
  }

  // Return captured page error messages (uncaught exceptions)
  getPageErrors() {
    return this.pageErrors;
  }
}

test.describe('B+ Tree Visualization - FSM states and transitions', () => {
  let treePage;

  test.beforeEach(async ({ page }) => {
    treePage = new TreePage(page);
    // Load the application page before each test
    await treePage.goto();
  });

  test.afterEach(async () => {
    // After each test assert there were no unexpected runtime errors
    // We allow tests to examine these arrays individually if they expect errors,
    // but by default ensure the app runs without console or page errors.
    expect(treePage.getConsoleErrors()).toEqual([]);
    expect(treePage.getPageErrors()).toEqual([]);
  });

  test('S0_Idle: Initial render (Idle state) - controls present and visualization created', async () => {
    // Validate that the page loaded into the Idle state:
    // - Both control buttons are present
    // - An initial visualization (nodes/keys) exists
    const insertBtn = await treePage.page.locator('#insert-btn');
    const highlightBtn = await treePage.page.locator('#highlight-btn');

    await expect(insertBtn).toBeVisible();
    await expect(highlightBtn).toBeVisible();

    // The implementation initially inserts a set of keys; ensure keys are present
    const keyCount = await treePage.getKeyCount();
    // There should be at least the initial seeded keys visible (>= 1)
    expect(keyCount).toBeGreaterThanOrEqual(1);

    // There should be at least one node rendered
    const nodeCount = await treePage.getNodeCount();
    expect(nodeCount).toBeGreaterThanOrEqual(1);

    // No console/page errors during initial render
    expect(treePage.getConsoleErrors().length).toBe(0);
    expect(treePage.getPageErrors().length).toBe(0);
  });

  test('S1_Insert: Clicking "Insert Random Key" adds a key and triggers visualization (entry and exit actions)', async () => {
    // This test validates the transition Idle -> Inserting Key -> Idle:
    // - Entry action tree.insert(randomKey) is expected to add a key
    // - Exit action tree.visualize() is expected to update the DOM visualization

    // Capture counts before insertion
    const beforeKeyCount = await treePage.getKeyCount();
    const beforeNodeCount = await treePage.getNodeCount();

    // Perform the insert action (trigger event)
    await treePage.clickInsert();

    // After clicking insert, visualize() is called in implementation; wait for DOM to reflect change.
    // Since the tree may split nodes leading to changes in node count or key count,
    // wait for the key count to increase by at least 1 (the newly inserted key).
    // We poll for up to 3 seconds for the new key to appear.
    const start = Date.now();
    let afterKeyCount = beforeKeyCount;
    while (Date.now() - start < 3000) {
      afterKeyCount = await treePage.getKeyCount();
      if (afterKeyCount > beforeKeyCount) break;
      await new Promise(res => setTimeout(res, 150));
    }

    // Assert at least one new key was added to the visualization
    expect(afterKeyCount).toBeGreaterThanOrEqual(beforeKeyCount + 1);

    // Node count should be >= 1 still; allow both increases or decreases due to splits; just ensure visualization exists
    const afterNodeCount = await treePage.getNodeCount();
    expect(afterNodeCount).toBeGreaterThanOrEqual(1);

    // No runtime errors during insertion
    expect(treePage.getConsoleErrors().length).toBe(0);
    expect(treePage.getPageErrors().length).toBe(0);
  });

  test('S1_Insert (robustness): Multiple rapid inserts do not produce runtime errors and add multiple keys', async () => {
    // This test simulates multiple InsertKey events in quick succession to exercise splits and internal logic.
    const beforeKeyCount = await treePage.getKeyCount();

    // Rapidly trigger 5 inserts
    for (let i = 0; i < 5; i++) {
      // Fire click without awaiting long delays between them
      await treePage.clickInsert();
    }

    // Wait for the DOM to stabilize and new keys to appear (up to 5 seconds)
    const start = Date.now();
    let afterKeyCount = beforeKeyCount;
    while (Date.now() - start < 5000) {
      afterKeyCount = await treePage.getKeyCount();
      if (afterKeyCount >= beforeKeyCount + 5) break;
      await new Promise(res => setTimeout(res, 200));
    }

    // We expect at least 5 new keys were added (duplicates might exist but keys are inserted per click)
    expect(afterKeyCount).toBeGreaterThanOrEqual(beforeKeyCount + 5);

    // Still, the visualization should be present
    const nodeCount = await treePage.getNodeCount();
    expect(nodeCount).toBeGreaterThanOrEqual(1);

    // Check no console/page errors occurred during rapid inserts
    expect(treePage.getConsoleErrors().length).toBe(0);
    expect(treePage.getPageErrors().length).toBe(0);
  }, { timeout: 15000 });

  test('S2_Highlight: Clicking "Highlight Path" highlights nodes/keys along path to the chosen key', async () => {
    // Validate transition Idle -> Highlighting Path:
    // - Entry action tree.highlightPath(randomKey) should result in DOM elements receiving 'highlight' class over time

    // Ensure there is at least one key to highlight
    const totalKeys = await treePage.getKeyCount();
    expect(totalKeys).toBeGreaterThan(0);

    // Trigger highlight
    await treePage.clickHighlight();

    // highlightPath uses timeouts; wait up to 4 seconds for any .highlight to appear
    await treePage.waitForAnyHighlight(4000);

    const highlightedCount = await treePage.getHighlightedKeyCount();

    // Expect at least one key to be highlighted after invoking highlightPath
    expect(highlightedCount).toBeGreaterThanOrEqual(1);

    // Ensure no runtime errors occurred during highlighting
    expect(treePage.getConsoleErrors().length).toBe(0);
    expect(treePage.getPageErrors().length).toBe(0);
  }, { timeout: 8000 });

  test('Transition sequence: Insert then Highlight - ensures new keys can be highlighted after insertion', async () => {
    // This test exercises a sequence S0 -> S1 -> S0 -> S2:
    // - Insert a key (S1)
    // - Then highlight a path (S2) to confirm highlight works after state changes

    const beforeKeyCount = await treePage.getKeyCount();
    await treePage.clickInsert();

    // Wait for key count bump
    const start = Date.now();
    let afterKeyCount = beforeKeyCount;
    while (Date.now() - start < 4000) {
      afterKeyCount = await treePage.getKeyCount();
      if (afterKeyCount > beforeKeyCount) break;
      await new Promise(res => setTimeout(res, 150));
    }
    expect(afterKeyCount).toBeGreaterThan(beforeKeyCount);

    // Now trigger highlight after insertion
    await treePage.clickHighlight();

    // Wait for highlights to appear
    await treePage.waitForAnyHighlight(4000);
    const highlightedCount = await treePage.getHighlightedKeyCount();
    expect(highlightedCount).toBeGreaterThanOrEqual(1);

    // Ensure no runtime errors during this sequence
    expect(treePage.getConsoleErrors().length).toBe(0);
    expect(treePage.getPageErrors().length).toBe(0);
  }, { timeout: 10000 });

  test('Edge case: Repeated highlighting does not produce uncaught exceptions (stability check)', async () => {
    // Repeatedly click the highlight button several times to ensure stable behavior and no uncaught exceptions
    for (let i = 0; i < 6; i++) {
      await treePage.clickHighlight();
      // Allow some time for the highlight sequence to run
      await new Promise(res => setTimeout(res, 600));
    }

    // There should be at least one highlighted key eventually (or highlights from previous calls)
    const highlightedCount = await treePage.getHighlightedKeyCount();
    expect(highlightedCount).toBeGreaterThanOrEqual(0); // allow 0 but primarily check no runtime errors

    // Confirm no console/page errors occurred during repeated highlights
    expect(treePage.getConsoleErrors().length).toBe(0);
    expect(treePage.getPageErrors().length).toBe(0);
  }, { timeout: 10000 });

  test('Inspect console and page errors: capture and report any runtime issues on page load and interactions', async ({ page }) => {
    // This test demonstrates capturing console & page errors explicitly.
    // We intentionally do minimal interactions and then assert that no errors were collected.

    // Create a fresh TreePage for explicit inspection
    const inspector = new TreePage(page);
    await inspector.goto();

    // Perform a couple of actions
    await inspector.clickInsert();
    await inspector.clickHighlight();

    // Allow asynchronous highlight animations/timeouts to run
    await new Promise(res => setTimeout(res, 1200));

    // Assert that there are no console errors or page errors
    expect(inspector.getConsoleErrors()).toEqual([]);
    expect(inspector.getPageErrors()).toEqual([]);
  }, { timeout: 10000 });
});