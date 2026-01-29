import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324cc380-fa73-11f0-a9d0-d7a1991987c6.html';

/**
 * Page Object for the Set demo page.
 * Encapsulates interactions so tests are more readable and maintainable.
 */
class SetPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.addButton = page.locator('#addButton');
    this.deleteButton = page.locator('#deleteButton');
    this.hasButton = page.locator('#hasButton');
    this.showSetButton = page.locator('#showSetButton');
    this.inputElement = page.locator('#inputElement');
    this.hasInput = page.locator('#hasInput');
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async addElement(value) {
    await this.inputElement.fill(value);
    await this.addButton.click();
  }

  async deleteElement(value) {
    await this.inputElement.fill(value);
    await this.deleteButton.click();
  }

  async checkElement(value) {
    // This triggers an alert dialog — caller should set up dialog handler.
    await this.hasInput.fill(value);
    await this.hasButton.click();
  }

  async showSet() {
    await this.showSetButton.click();
  }

  async getOutputText() {
    return (await this.output.innerText()).trim();
  }
}

test.describe('JavaScript Set Example - FSM States and Transitions', () => {
  // Collect console errors and page errors for assertions in tests.
  test.beforeEach(async ({ page }) => {
    // Attach listeners to capture console errors and page errors.
    page.__consoleErrors = [];
    page.__pageErrors = [];

    page.on('console', (msg) => {
      // Capture console messages of type 'error' as relevant runtime errors.
      if (msg.type() === 'error') {
        page.__consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      // pageerror captures uncaught exceptions like ReferenceError, TypeError, etc.
      page.__pageErrors.push(err.message);
    });
  });

  test.afterEach(async ({ page }) => {
    // By default assert there were no console errors or uncaught page errors during the test.
    // This validates the page ran without unexpected runtime exceptions.
    expect(page.__consoleErrors, 'No console.error messages should be emitted').toEqual([]);
    expect(page.__pageErrors, 'No uncaught page errors should occur').toEqual([]);
  });

  test('Initial state (S0_Idle) shows controls and empty set output', async ({ page }) => {
    // Validate Idle state UI presence and initial output
    const setPage = new SetPage(page);
    await setPage.goto();

    // Verify buttons and inputs exist
    await expect(setPage.addButton).toBeVisible();
    await expect(setPage.deleteButton).toBeVisible();
    await expect(setPage.hasButton).toBeVisible();
    await expect(setPage.showSetButton).toBeVisible();
    await expect(setPage.inputElement).toBeVisible();
    await expect(setPage.hasInput).toBeVisible();

    // When nothing has been added, show set should display an empty set
    await setPage.showSet();
    await expect(setPage.output).toHaveText('Current Set: []');
  });

  test('AddElement transition moves to Set Updated (S1_SetUpdated) and displaySet is invoked', async ({ page }) => {
    // Test adding elements triggers displaySet and updates DOM accordingly
    const setPage1 = new SetPage(page);
    await setPage.goto();

    // Add an element and assert output updates and input clears
    await setPage.addElement('apple');
    await expect(setPage.output).toHaveText('Current Set: [apple]');
    await expect(setPage.inputElement).toHaveValue(''); // input cleared after adding

    // Add second element and verify both present in insertion order
    await setPage.addElement('banana');
    // Using ordering that Set preserves: apple, banana
    await expect(setPage.output).toHaveText('Current Set: [apple,banana]');
  });

  test('Adding a duplicate element does not create duplicates (Set uniqueness)', async ({ page }) => {
    // Edge case: duplicates
    const setPage2 = new SetPage(page);
    await setPage.goto();

    await setPage.addElement('dup');
    await expect(setPage.output).toHaveText('Current Set: [dup]');

    // Add duplicate
    await setPage.addElement('dup');
    // Output should remain with single entry
    await expect(setPage.output).toHaveText('Current Set: [dup]');
  });

  test('DeleteElement transition updates set and displaySet is invoked', async ({ page }) => {
    // Test deletion of elements and that displaySet runs to reflect change
    const setPage3 = new SetPage(page);
    await setPage.goto();

    // Prepare set with two elements
    await setPage.addElement('x');
    await setPage.addElement('y');
    await expect(setPage.output).toHaveText('Current Set: [x,y]');

    // Delete one element (note: delete uses the same inputElement)
    await setPage.deleteElement('x');
    await expect(setPage.output).toHaveText('Current Set: [y]');
    await expect(setPage.inputElement).toHaveValue(''); // input cleared after delete

    // Deleting a non-existent element should not throw and should keep set unchanged
    await setPage.deleteElement('not-present');
    await expect(setPage.output).toHaveText('Current Set: [y]');
  });

  test('CheckElement shows alert with correct message for present and absent elements', async ({ page }) => {
    // Validate the CheckElement event triggers alerts with expected messages (S0_Idle -> S0_Idle)
    const setPage4 = new SetPage(page);
    await setPage.goto();

    // Add an element to check
    await setPage.addElement('present');

    // Setup dialog handler to capture alert for present element
    const dialogs = [];
    page.on('dialog', async (dialog) => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.accept();
    });

    // Check an element that exists
    await setPage.checkElement('present');
    // One dialog should have been captured
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs.shift().message).toBe('Yes, "present" exists in the set.');

    // Check an element that does NOT exist
    await setPage.checkElement('absent');
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs.shift().message).toBe('No, "absent" does not exist in the set.');

    // Check with empty input — results in No, "" does not exist...
    await setPage.checkElement('');
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs.shift().message).toBe('No, "" does not exist in the set.');
  });

  test('ShowSet action displays the current set without modifying it', async ({ page }) => {
    // Test the ShowSet event simply calls displaySet and shows the same contents
    const setPage5 = new SetPage(page);
    await setPage.goto();

    // Initially empty
    await setPage.showSet();
    await expect(setPage.output).toHaveText('Current Set: []');

    // Add some elements
    await setPage.addElement('a');
    await setPage.addElement('b');

    // Call showSet explicitly and verify content
    await setPage.showSet();
    await expect(setPage.output).toHaveText('Current Set: [a,b]');
  });

  test('Edge cases: adding empty string does nothing; deleting from empty set is harmless', async ({ page }) => {
    // Verify code guards (if (element)) prevent empty strings from being added
    const setPage6 = new SetPage(page);
    await setPage.goto();

    // Ensure empty add is ignored
    await setPage.addElement('');
    await expect(setPage.output).toHaveText(''); // no text updated (displaySet not invoked because no add)

    // Show set explicitly should still show empty array
    await setPage.showSet();
    await expect(setPage.output).toHaveText('Current Set: []');

    // Delete from empty set should not throw and show still empty
    await setPage.deleteElement('nothing');
    await setPage.showSet();
    await expect(setPage.output).toHaveText('Current Set: []');
  });

  test('Observe console and page errors while interacting with the app', async ({ page }) => {
    // This test explicitly exercises interactions while collecting console/page errors.
    const setPage7 = new SetPage(page);
    await setPage.goto();

    // Interact in several ways to surface potential runtime errors
    await setPage.addElement('one');
    await setPage.addElement('two');
    await setPage.deleteElement('one');

    // Trigger checks
    page.on('dialog', async (dialog) => { await dialog.accept(); });
    await setPage.checkElement('two');
    await setPage.checkElement('nope');

    // Trigger showSet
    await setPage.showSet();
    await expect(setPage.output).toHaveText('Current Set: [two]');

    // Assert no console errors or page errors occurred (captured in afterEach).
    // Note: AfterEach will assert for no errors. Here we also do an inline assertion for clarity.
    expect(page.__consoleErrors.length, 'No console.error messages should be emitted during interactions').toBe(0);
    expect(page.__pageErrors.length, 'No uncaught page errors should occur during interactions').toBe(0);
  });
});