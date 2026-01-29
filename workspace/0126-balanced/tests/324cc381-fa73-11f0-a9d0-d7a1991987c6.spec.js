import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324cc381-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object for the Multiset application
class MultisetPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('input#elementInput');
    this.addButton = page.locator("button[onclick='addElement()']");
    this.removeButton = page.locator("button[onclick='removeElement()']");
    this.multisetDiv = page.locator('div#multiset');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Types value into input (replaces existing)
  async typeElement(value) {
    await this.input.fill(value);
  }

  // Click Add Element button
  async clickAdd() {
    await this.addButton.click();
  }

  // Click Remove Element button
  async clickRemove() {
    await this.removeButton.click();
  }

  // Get displayed elements as an array of strings like "apple: 2"
  async getDisplayedElements() {
    const items = await this.multisetDiv.locator('.element').allTextContents();
    return items.map(s => s.trim()).filter(Boolean);
  }

  // Get count for a given element from DOM display. Returns number or null if not present.
  async getCountFor(element) {
    const items1 = await this.getDisplayedElements();
    for (const item of items) {
      const [name, countStr] = item.split(':').map(p => p.trim());
      if (name === element) {
        return Number(countStr);
      }
    }
    return null;
  }

  // Get input value
  async getInputValue() {
    return this.input.inputValue();
  }

  // Evaluate on page: read internal myMultiset.elements snapshot (if present)
  async getInternalElementsSnapshot() {
    return this.page.evaluate(() => {
      // Allow page to have no global myMultiset (should be present per implementation)
      try {
        if (typeof myMultiset !== 'undefined' && myMultiset && myMultiset.elements) {
          // Return a shallow copy
          return { ...myMultiset.elements };
        }
        return null;
      } catch (e) {
        // If any error occurs, propagate for test assertion to capture console/pageerror
        return { __error__: String(e) };
      }
    });
  }
}

// Helper to collect console and page errors during a test run
function attachErrorCollectors(page) {
  const consoleMessages = [];
  const pageErrors = [];
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    });
  });
  page.on('pageerror', err => {
    pageErrors.push(String(err));
  });
  return { consoleMessages, pageErrors };
}

test.describe('Multiset Demonstration - FSM behavior and UI tests', () => {
  // Each test will create its own page and collectors in beforeEach
  test.beforeEach(async ({ page }) => {
    // nothing global to set here; each test will navigate fresh
  });

  test('Initial state (S0_Idle): UI elements exist and multiset is initially empty', async ({ page }) => {
    // Attach collectors to observe console and page errors
    const { consoleMessages, pageErrors } = attachErrorCollectors(page);

    const app = new MultisetPage(page);
    await app.goto();

    // Verify presence of input and buttons (evidence from FSM)
    await expect(app.input).toBeVisible();
    await expect(app.addButton).toBeVisible();
    await expect(app.removeButton).toBeVisible();
    await expect(app.multisetDiv).toBeVisible();

    // Multiset should be empty on load (no .element children)
    const displayed = await app.getDisplayedElements();
    expect(displayed.length).toBe(0);

    // Implementation should expose global functions addElement and removeElement
    const addType = await page.evaluate(() => typeof addElement);
    const removeType = await page.evaluate(() => typeof removeElement);
    expect(addType).toBe('function');
    expect(removeType).toBe('function');

    // Internal myMultiset should exist and be an empty object
    const internal = await app.getInternalElementsSnapshot();
    expect(internal).not.toBeNull();
    // internal should be an object, possibly empty
    expect(typeof internal).toBe('object');
    // No page errors or console errors should have occurred during load
    const errorConsoles = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoles.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Add Element transition (S0_Idle -> S1_ElementAdded): adding elements updates display and clears input', async ({ page }) => {
    // Collect console/page errors
    const { consoleMessages, pageErrors } = attachErrorCollectors(page);

    const app1 = new MultisetPage(page);
    await app.goto();

    // Add a single element "apple"
    await app.typeElement('apple');
    await expect(app.getInputValue()).resolves.toBe('apple');
    await app.clickAdd();

    // After adding, input should be cleared
    await expect(app.getInputValue()).resolves.toBe('');

    // Display should show "apple: 1"
    const displayed1 = await app.getDisplayedElements();
    expect(displayed).toContain('apple: 1');

    // Internal state should reflect the same
    const internal1 = await app.getInternalElementsSnapshot();
    expect(internal['apple']).toBe(1);

    // Add the same element again to verify incrementing behavior
    await app.typeElement('apple');
    await app.clickAdd();

    // Should increment to 2
    expect(await app.getCountFor('apple')).toBe(2);
    const internalAfter = await app.getInternalElementsSnapshot();
    expect(internalAfter['apple']).toBe(2);

    // Ensure clicking Add when input empty does nothing (input empty because cleared)
    await app.clickAdd();
    // No additional element added; count stays 2
    expect(await app.getCountFor('apple')).toBe(2);

    // Verify no console errors or page errors occurred
    const errorConsoles1 = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoles.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Remove Element transition (S0_Idle -> S2_ElementRemoved): removing elements decrements and deletes when count reaches zero', async ({ page }) => {
    const { consoleMessages, pageErrors } = attachErrorCollectors(page);

    const app2 = new MultisetPage(page);
    await app.goto();

    // Prepare state: add "banana" twice
    await app.typeElement('banana');
    await app.clickAdd();
    await app.typeElement('banana');
    await app.clickAdd();
    expect(await app.getCountFor('banana')).toBe(2);

    // Remove once -> should decrement to 1
    await app.typeElement('banana');
    await app.clickRemove();
    expect(await app.getCountFor('banana')).toBe(1);

    // Remove again -> should remove entry entirely
    await app.typeElement('banana');
    await app.clickRemove();
    const countAfter = await app.getCountFor('banana');
    expect(countAfter).toBeNull(); // entry deleted

    // Internal snapshot should not have banana property
    const internal2 = await app.getInternalElementsSnapshot();
    expect(internal.hasOwnProperty('banana')).toBe(false);

    // Removing a non-existent element should not throw and should not change display
    await app.typeElement('doesnotexist');
    await app.clickRemove();
    // Input was non-empty so per implementation it clears only if element is present? Actually it clears if element was non-empty regardless of existence because remove() checks and display() returns empty; but function removes only if exists. Confirm behavior: implementation clears input whenever input had trimmed value. So input should be cleared.
    await expect(app.getInputValue()).resolves.toBe('');

    // Ensure no console/page errors
    const errorConsoles2 = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoles.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge cases: whitespace input, empty input, and removing non-existent elements', async ({ page }) => {
    const { consoleMessages, pageErrors } = attachErrorCollectors(page);

    const app3 = new MultisetPage(page);
    await app.goto();

    // Whitespace-only input should not add (trimmed to empty)
    await app.typeElement('   ');
    await app.clickAdd();
    // Implementation only adds if element truthy after trim, so input should remain as whitespace (implementation reads input.value.trim() first, if false it doesn't clear)
    // But since we used fill, the input still contains whitespace. Confirm that it was not cleared:
    expect(await app.getInputValue()).toBe('   ');
    // No items added
    expect((await app.getDisplayedElements()).length).toBe(0);

    // Clear input manually and try remove with empty input - should do nothing and not throw
    await app.typeElement('');
    await app.clickRemove();
    // Input remains empty
    await expect(app.getInputValue()).resolves.toBe('');
    // Still no items
    expect((await app.getDisplayedElements()).length).toBe(0);

    // Try removing an element that was never added
    await app.typeElement('ghost');
    await app.clickRemove();
    // Input should be cleared because it had a trimmed value per implementation
    await expect(app.getInputValue()).resolves.toBe('');
    // No display entries
    expect((await app.getDisplayedElements()).length).toBe(0);

    // Finally, ensure adding after bad operations still works: add "cherry"
    await app.typeElement('cherry');
    await app.clickAdd();
    expect(await app.getCountFor('cherry')).toBe(1);

    // Verify no console errors occurred during these edge-case interactions
    const errorConsoles3 = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoles.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Implementation sanity checks: display() and internal state coherence after mixed operations', async ({ page }) => {
    const { consoleMessages, pageErrors } = attachErrorCollectors(page);

    const app4 = new MultisetPage(page);
    await app.goto();

    // Mixed sequence: add a, add b, add a, remove a, remove b, remove a (last should remove a entirely)
    await app.typeElement('a');
    await app.clickAdd(); // a:1
    await app.typeElement('b');
    await app.clickAdd(); // a:1, b:1
    await app.typeElement('a');
    await app.clickAdd(); // a:2, b:1
    await app.typeElement('a');
    await app.clickRemove(); // a:1, b:1
    await app.typeElement('b');
    await app.clickRemove(); // a:1, b removed
    await app.typeElement('a');
    await app.clickRemove(); // a removed

    // At end, multiset should be empty
    expect((await app.getDisplayedElements()).length).toBe(0);

    // Internal state should be empty object (no enumerable properties)
    const internal3 = await app.getInternalElementsSnapshot();
    // internal could be {} or null if not present; we've already tested myMultiset exists earlier, so here expect object with no keys
    expect(Object.keys(internal).length).toBe(0);

    // Check for console/page errors
    const errorConsoles4 = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoles.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Observation of runtime: confirm no ReferenceError / SyntaxError / TypeError thrown during use', async ({ page }) => {
    // This test focuses on collecting any runtime errors that the page emits naturally during typical interactions.
    const { consoleMessages, pageErrors } = attachErrorCollectors(page);

    const app5 = new MultisetPage(page);
    await app.goto();

    // Perform a few interactions to exercise functionality
    await app.typeElement('x');
    await app.clickAdd();
    await app.typeElement('x');
    await app.clickRemove();

    // Wait a short time to allow any async console/pageerrors to appear
    await page.waitForTimeout(200);

    // Filter pageErrors for typical JS error types
    const runtimeErrors = pageErrors.filter(e => /ReferenceError|TypeError|SyntaxError/.test(e));
    // The page is expected to be implemented correctly, so no runtime errors should be present.
    expect(runtimeErrors.length).toBe(0);

    // Also check console error messages (console.error)
    const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorMessages.length).toBe(0);
  });

  // Note: FSM entry_actions and exit_actions are empty in the FSM definition; there is nothing to assert onEnter/onExit.
  // We include this test to explicitly record that there are no onEnter/onExit actions to validate.
  test('FSM onEnter/onExit validation (no actions expected)', async ({ page }) => {
    const { consoleMessages, pageErrors } = attachErrorCollectors(page);

    const app6 = new MultisetPage(page);
    await app.goto();

    // FSM entry/exit actions list in the provided FSM is empty for all states.
    // We assert that there are none to validate on the page itself by checking there are no unexpected side-effect logs.
    // Since no explicit onEnter/onExit markers exist in the HTML/JS, this is a no-op validation.
    // Ensure application still functions normally:
    await app.typeElement('z');
    await app.clickAdd();
    expect(await app.getCountFor('z')).toBe(1);

    // Confirm no console errors
    const errorConsoles5 = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoles.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});