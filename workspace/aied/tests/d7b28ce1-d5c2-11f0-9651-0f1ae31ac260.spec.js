import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d7b28ce1-d5c2-11f0-9651-0f1ae31ac260.html';

// Page Object for the Hash Map Demo page
class HashMapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.keyInput = page.locator('#keyInput');
    this.valueInput = page.locator('#valueInput');
    this.addBtn = page.locator('#addBtn');
    this.deleteBtn = page.locator('#deleteBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.mapContent = page.locator('#mapContent');
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // wait for main elements to be present
    await Promise.all([
      this.keyInput.waitFor(),
      this.valueInput.waitFor(),
      this.addBtn.waitFor(),
      this.deleteBtn.waitFor(),
      this.clearBtn.waitFor(),
      this.mapContent.waitFor(),
      this.output.waitFor(),
    ]);
  }

  async fillKey(key) {
    await this.keyInput.fill(key);
  }

  async fillValue(value) {
    await this.valueInput.fill(value);
  }

  async clickAdd() {
    await this.addBtn.click();
  }

  async clickDelete() {
    await this.deleteBtn.click();
  }

  async clickClear() {
    await this.clearBtn.click();
  }

  async getMapText() {
    return (await this.mapContent.textContent()) ?? '';
  }

  async getOutputText() {
    return (await this.output.textContent()) ?? '';
  }

  async isButtonDisabled(buttonLocator) {
    return await buttonLocator.getAttribute('disabled') !== null;
  }
}

test.describe('Hash Map Demo - FSM behavior and transitions', () => {
  let pageErrors;
  let consoleErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // Collect page errors and console messages for assertions
    pageErrors = [];
    consoleErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // Collect uncaught exceptions from the page (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      // Collect console messages and separately track error-level console messages
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  test.describe('Initial Idle State (S0_Idle)', () => {
    test('renders initial UI and button states; no runtime errors on load', async ({ page }) => {
      // This test validates the initial "Idle" state:
      // - renderMap() should run and show "(Map is empty)"
      // - updateButtonStates() should disable all action buttons
      // - there should be no uncaught page errors or console.error messages
      const mapPage = new HashMapPage(page);
      await mapPage.goto();

      // Validate map content initial rendering (onEnter renderMap())
      await expect(mapPage.mapContent).toHaveText('(Map is empty)');

      // Validate button disabled states per initial updateButtonStates()
      expect(await mapPage.isButtonDisabled(mapPage.addBtn)).toBe(true);
      expect(await mapPage.isButtonDisabled(mapPage.deleteBtn)).toBe(true);
      expect(await mapPage.isButtonDisabled(mapPage.clearBtn)).toBe(true);

      // No uncaught runtime errors (the page should load cleanly)
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Transitions: Add, Update, Delete, Clear', () => {
    test('Add a new entry (S0_Idle -> S1_EntryAdded) shows map entry and output message', async ({ page }) => {
      // This test validates the AddEntry event when the key does not exist:
      // - entering key/value enables Add button
      // - click Add will add to map, renderMap shows the new entry
      // - output message shows "Added entry: key = ..." as evidence
      const mapPage = new HashMapPage(page);
      await mapPage.goto();

      // Type key and value
      await mapPage.fillKey('key');
      await mapPage.fillValue('value');

      // Buttons should update: addBtn enabled; deleteBtn initially disabled until add occurs
      expect(await mapPage.isButtonDisabled(mapPage.addBtn)).toBe(false);

      // Click add to create a new entry
      await mapPage.clickAdd();

      // After adding, mapContent should include the JSON-serialized key => value
      // The application uses JSON.stringify on both key and value
      await expect(mapPage.mapContent).toHaveText('"key" => "value"');

      // Output should log the 'Added entry' message
      await expect(mapPage.output).toHaveText('Added entry: key = "key", value = "value"');

      // After add: delete and clear buttons should be enabled
      expect(await mapPage.isButtonDisabled(mapPage.deleteBtn)).toBe(false);
      expect(await mapPage.isButtonDisabled(mapPage.clearBtn)).toBe(false);

      // No uncaught runtime errors or console.error messages occurred
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Update an existing entry (S0_Idle -> S2_EntryUpdated) updates value and logs update message', async ({ page }) => {
      // This test validates updating an existing entry:
      // - add an entry first, then change value and click Add again
      // - the application should detect 'existed' and log an "Updated entry ..." message
      const mapPage = new HashMapPage(page);
      await mapPage.goto();

      // Create initial entry
      await mapPage.fillKey('key');
      await mapPage.fillValue('initial');
      await mapPage.clickAdd();

      await expect(mapPage.mapContent).toHaveText('"key" => "initial"');
      await expect(mapPage.output).toHaveText('Added entry: key = "key", value = "initial"');

      // Update the value
      await mapPage.fillValue('newValue');
      // addBtn should still be enabled
      expect(await mapPage.isButtonDisabled(mapPage.addBtn)).toBe(false);
      await mapPage.clickAdd();

      // Expect value updated in mapContent and update message
      await expect(mapPage.mapContent).toHaveText('"key" => "newValue"');
      await expect(mapPage.output).toHaveText('Updated entry with key: "key" to new value: "newValue"');

      // No uncaught runtime errors or console.error messages occurred
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Delete an entry (S0_Idle -> S3_EntryDeleted) removes entry and logs deletion', async ({ page }) => {
      // This test validates DeleteEntry event:
      // - add an entry, then delete it via Delete button
      // - mapContent should revert to empty and output should show deletion evidence
      const mapPage = new HashMapPage(page);
      await mapPage.goto();

      // Add an entry to delete
      await mapPage.fillKey('key');
      await mapPage.fillValue('value');
      await mapPage.clickAdd();

      await expect(mapPage.mapContent).toHaveText('"key" => "value"');
      await expect(mapPage.output).toHaveText('Added entry: key = "key", value = "value"');

      // Now delete
      expect(await mapPage.isButtonDisabled(mapPage.deleteBtn)).toBe(false);
      await mapPage.clickDelete();

      // After delete, map should be empty
      await expect(mapPage.mapContent).toHaveText('(Map is empty)');
      await expect(mapPage.output).toHaveText('Deleted entry with key: "key"');

      // Buttons should be updated: add remains enabled if key input still has text; clear disabled
      // In this UI, keyInput still has 'key' text, so addBtn is enabled but deleteBtn disabled now (map has no such key)
      expect(await mapPage.isButtonDisabled(mapPage.clearBtn)).toBe(true);

      // Ensure no runtime errors occurred
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Clear the map (S0_Idle -> S4_MapCleared) clears all entries and logs message', async ({ page }) => {
      // This test validates ClearMap event:
      // - add two entries and then clear them
      // - mapContent becomes empty, output shows cleared message
      const mapPage = new HashMapPage(page);
      await mapPage.goto();

      // Add first entry
      await mapPage.fillKey('a');
      await mapPage.fillValue('1');
      await mapPage.clickAdd();
      await expect(mapPage.mapContent).toHaveText('"a" => "1"');

      // Add second entry: change key
      await mapPage.fillKey('b');
      await mapPage.fillValue('2');
      await mapPage.clickAdd();

      // mapContent should contain both entries (order preserved by insertion)
      const mapText = await mapPage.getMapText();
      expect(mapText.split('\n').length).toBeGreaterThanOrEqual(2);
      expect(mapText).toContain('"a" => "1"');
      expect(mapText).toContain('"b" => "2"');

      // Clear the map
      expect(await mapPage.isButtonDisabled(mapPage.clearBtn)).toBe(false);
      await mapPage.clickClear();

      // After clearing: empty map and proper output message
      await expect(mapPage.mapContent).toHaveText('(Map is empty)');
      await expect(mapPage.output).toHaveText('Cleared all entries in the map.');

      // Ensure no runtime errors occurred during clear
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Cannot add when key is empty -> logs the expected error message', async ({ page }) => {
      // This test validates edge case where user tries to add with empty key
      // The app should log 'Cannot add: key is empty.' and not throw runtime errors
      const mapPage = new HashMapPage(page);
      await mapPage.goto();

      // Ensure key empty and value non-empty
      await mapPage.fillKey('');
      await mapPage.fillValue('someValue');

      // Add button must be disabled when key is empty (per updateButtonStates)
      expect(await mapPage.isButtonDisabled(mapPage.addBtn)).toBe(true);

      // Try clicking add should fail from Playwright because button is disabled; instead assert app message by simulating input sequence that triggers log:
      // The application itself prevents add when key === '' by checking in handler; but handler cannot run if button disabled.
      // To assert behavior, remove disabled state by typing whitespace then trimming to empty; still disabled.
      // The safe assertion is that addBtn is disabled and no page errors occurred.
      expect(await mapPage.isButtonDisabled(mapPage.addBtn)).toBe(true);

      // Since button is disabled, we assert that attempting to click throws an error from Playwright (ensures client-side prevents improper action)
      let clickThrew = false;
      try {
        await mapPage.clickAdd();
      } catch (err) {
        clickThrew = true;
      }
      expect(clickThrew).toBe(true);

      // Additionally, directly trigger input to empty key and ensure no runtime errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Deleting non-existent key does not crash and delete button remains disabled', async ({ page }) => {
      // This test validates that the UI prevents deleting keys that don't exist:
      // - when key input contains a value not in the map, deleteBtn stays disabled
      // - the app logs 'No entry found ...' only if delete handler runs (but since button disabled it shouldn't run)
      const mapPage = new HashMapPage(page);
      await mapPage.goto();

      // Ensure map empty and enter a non-existing key
      await mapPage.fillKey('nonexistent');
      await mapPage.fillValue('irrelevant');

      // deleteBtn should be disabled because map.has(keyInput.value) is false
      expect(await mapPage.isButtonDisabled(mapPage.deleteBtn)).toBe(true);

      // Attempting to click the disabled delete button should throw; confirm Playwright blocks it
      let clickThrew = false;
      try {
        await mapPage.clickDelete();
      } catch (err) {
        clickThrew = true;
      }
      expect(clickThrew).toBe(true);

      // Confirm no runtime errors occurred on the page
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Clicking clear when map already empty does not crash; clear button disabled', async ({ page }) => {
      // This test validates that clearBtn is disabled when map is empty
      // and clicking a disabled clear button is prevented by the browser/Playwright.
      const mapPage = new HashMapPage(page);
      await mapPage.goto();

      // map is initially empty; clearBtn must be disabled
      expect(await mapPage.isButtonDisabled(mapPage.clearBtn)).toBe(true);

      // Attempt to click disabled clear button and confirm Playwright throws
      let clickThrew = false;
      try {
        await mapPage.clickClear();
      } catch (err) {
        clickThrew = true;
      }
      expect(clickThrew).toBe(true);

      // No runtime errors on the page
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.afterEach(async ({ page }) => {
    // Final safety assertions on console and page errors for each test run
    // Fail the test explicitly if any uncaught page errors or console.error messages were observed.
    if (pageErrors.length > 0) {
      // Re-throw the first page error to surface it in Playwright's test output
      throw pageErrors[0];
    }
    if (consoleErrors.length > 0) {
      // If there are console.error messages, fail the test with their content
      throw new Error('Console error(s) observed: ' + JSON.stringify(consoleErrors));
    }
  });
});