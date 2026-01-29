import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520883a0-fa76-11f0-a09b-87751f540fd8.html';

/**
 * PageObject for interacting with the B+ Tree demo page.
 * Collects console messages and page errors for assertions.
 */
class BPlusTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      try {
        // store the raw text of console messages
        this.consoleMessages.push(msg.text());
      } catch (e) {
        // ensure any unexpected console listener errors are captured as pageErrors
        this.pageErrors.push(e);
      }
    });

    // Collect unhandled exceptions from the page
    page.on('pageerror', (err) => {
      this.pageErrors.push(err);
    });
  }

  async goto() {
    // Navigate to the app and wait for load; the page's script runs on load.
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Give a small moment for console messages to flush
    await this.page.waitForTimeout(100);
  }

  async getNodeContents() {
    // Reads the visible DOM contents of the bplus-tree node contents (letters A-H)
    return this.page.$$eval('.bplus-tree-node-content', (els) => els.map((e) => e.textContent.trim()));
  }
}

test.describe('B+ Tree Interactive Application - FSM Validation', () => {
  let treePage;
  let page;

  test.beforeEach(async ({ browser }) => {
    // Setup: new browser page and page object that collects console + errors
    page = await browser.newPage();
    treePage = new BPlusTreePage(page);
    await treePage.goto();
  });

  test.afterEach(async () => {
    // Teardown: close the page
    await page.close();
  });

  test('S0_Idle: Validate initial DOM structure (visual representation present)', async () => {
    // This test validates that the static DOM representing the B+ Tree is present.
    // Although the FSM's Idle state precedes tree initialization, the HTML contains
    // a visual placeholder that should be visible on load.
    const contents = await treePage.getNodeContents();

    // Expect 8 node content elements labeled A through H in order
    expect(contents.length).toBe(8);
    expect(contents).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
  });

  test('S1_TreeInitialized: Insert actions executed (inferred from subsequent search outputs)', async () => {
    // The page's script performs multiple tree.insert(...) calls on load.
    // Those insertions are not directly logged, but their effect is visible
    // through subsequent console.log calls for search results.
    const logs = treePage.consoleMessages;

    // Expect the search results for the inserted keys to appear in console logs
    // The page prints: five, eight, three, nine, one, four (then later null after delete)
    // We'll locate the indices to ensure these messages existed in order.
    const expectedSequence = ['five', 'eight', 'three', 'nine', 'one', 'four'];

    // We may have additional console messages; find the indices of each expected entry in order.
    let lastIndex = -1;
    for (const expected of expectedSequence) {
      const idx = logs.indexOf(expected, lastIndex + 1);
      expect(idx).toBeGreaterThanOrEqual(0);
      lastIndex = idx;
    }
  });

  test('S2_SearchResults: Verify search outputs for existing keys', async () => {
    // Verify that the search outputs printed to console match the expected values.
    // The page logs the search results in order.
    const logs1 = treePage.consoleMessages;

    // Check presence and ordering of specific search outputs
    const expected = ['five', 'eight', 'three', 'nine', 'one', 'four'];
    const found = expected.map(val => logs.includes(val));
    for (let i = 0; i < expected.length; i++) {
      expect(found[i], `Expected console to include "${expected[i]}"`).toBeTruthy();
    }

    // Validate ordering: ensure the first occurrence of each appears in the sequence order
    const firstIndices = expected.map(val => logs.indexOf(val));
    for (let i = 1; i < firstIndices.length; i++) {
      expect(firstIndices[i]).toBeGreaterThan(firstIndices[i - 1]);
    }
  });

  test('S3_TreeModified: Delete transition occurred and search after delete returns null', async () => {
    // The page deletes key 5 and then logs tree.search(5) which should be null.
    const logs2 = treePage.consoleMessages;

    // Ensure 'five' appeared earlier (search before delete)
    const indexFiveBefore = logs.indexOf('five');
    expect(indexFiveBefore).toBeGreaterThanOrEqual(0);

    // The page then logs 'null' after deletion when searching for key 5
    // There should be a 'null' entry after the earlier 'five' log.
    const indexNullAfter = logs.indexOf('null', indexFiveBefore + 1);
    expect(indexNullAfter).toBeGreaterThanOrEqual(0);

    // Additionally ensure that 'null' corresponds to the final search (no subsequent valid results)
    // We'll check that there are no further valid value logs after that null for the deleted key scenario.
    const validValues = ['five', 'eight', 'three', 'nine', 'one', 'four'];
    const laterValid = logs.slice(indexNullAfter + 1).some(l => validValues.includes(l));
    expect(laterValid).toBeFalsy();
  });

  test('Edge cases and error scenarios: ensure no unhandled ReferenceError/SyntaxError/TypeError occurred', async () => {
    // The page may or may not produce runtime errors; per instructions we must observe them
    // and assert about them. Here we assert that no unhandled page errors of
    // types ReferenceError, SyntaxError, or TypeError occurred during load.
    const errors = treePage.pageErrors;

    // If there are any page errors, collect their names for reporting.
    const errorNames = errors.map((e) => {
      // Playwright page errors are Error objects; some may be plain strings.
      try {
        return e.name || (e && e.constructor && e.constructor.name) || String(e);
      } catch (err) {
        return String(e);
      }
    });

    // Assert there were zero page errors (robust expectation for this demo)
    expect(errors.length, `Unexpected page errors occurred: ${errorNames.join(', ')}`).toBe(0);

    // For completeness, assert none of the error names match ReferenceError/SyntaxError/TypeError
    for (const name of errorNames) {
      expect(['ReferenceError', 'SyntaxError', 'TypeError']).not.toContain(name);
    }
  });

  test('FSM transition coverage sanity: ensure console logs reflect full transition sequence', async () => {
    // This test ties together the FSM's transitions:
    // S0 -> S1 (inserts) -> S2 (search logs) -> S3 (delete) -> S2 (search after delete)
    const logs3 = treePage.consoleMessages;

    // Expected lifecycle in console logs (search logs before delete, then null after delete)
    // Find positions for the first block of search logs and the final null after delete
    const seqBeforeDelete = ['five', 'eight', 'three', 'nine', 'one', 'four'];
    const positions = seqBeforeDelete.map(val => logs.indexOf(val));
    // All must exist
    for (const pos of positions) {
      expect(pos).toBeGreaterThanOrEqual(0);
    }

    // Ensure ordering
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }

    // Find 'null' after the last of the above sequence
    const nullIndex = logs.indexOf('null', positions[positions.length - 1] + 1);
    expect(nullIndex).toBeGreaterThanOrEqual(0);
  });

  test('Extra assertion: static DOM nodes remain unchanged after script operations', async () => {
    // Ensure that the visual DOM (the .bplus-tree node structure) is untouched by the script
    // and provides consistent visual feedback.
    const contentsBefore = await treePage.getNodeContents();
    expect(contentsBefore).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);

    // Re-query to ensure no dynamic changes occurred after console logs and operations
    const contentsAfter = await treePage.getNodeContents();
    expect(contentsAfter).toEqual(contentsBefore);
  });
});