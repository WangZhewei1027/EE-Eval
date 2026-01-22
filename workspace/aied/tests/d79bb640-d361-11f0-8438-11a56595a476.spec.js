import { test, expect } from '@playwright/test';

// Test file for: d79bb640-d361-11f0-8438-11a56595a476
// Purpose: Validate the Hash Map Demo application behavior against the FSM.
// URL under test:
const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79bb640-d361-11f0-8438-11a56595a476.html';

// Page Object Model for the Hash Map Demo
class HashMapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.keyInput = page.locator('#keyInput');
    this.valueInput = page.locator('#valueInput');
    this.addBtn = page.locator('#addBtn');
    this.getBtn = page.locator('#getBtn');
    this.deleteBtn = page.locator('#deleteBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setKey(key) {
    await this.keyInput.fill(key);
  }

  async setValue(value) {
    await this.valueInput.fill(value);
  }

  async clickAdd() {
    await this.addBtn.click();
  }

  async clickGet() {
    await this.getBtn.click();
  }

  async clickDelete() {
    await this.deleteBtn.click();
  }

  async clickClear() {
    await this.clearBtn.click();
  }

  async getOutputText() {
    // textContent() may return null, coerce to empty string to simplify assertions
    const t = await this.output.textContent();
    return t === null ? '' : t;
  }
}

// Keep tests grouped and descriptive
test.describe('Hash Map Demo - FSM validation', () => {
  let consoleErrors = [];
  let pageErrors = [];

  // Setup listeners and navigate before each test
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages of type 'error'
    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      } catch (e) {
        // Swallow any listener errors, but record them as pageErrors for visibility
        pageErrors.push(e);
      }
    });

    // Capture uncaught exceptions in the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Go to the application (loaded exactly as-is)
    await page.goto(APP_URL);
  });

  // After each test assert that no runtime errors (console 'error' or page errors) occurred.
  test.afterEach(async () => {
    // Assert there were no uncaught page errors (ReferenceError, SyntaxError, TypeError, etc.)
    expect(pageErrors, `Unexpected page errors: ${pageErrors.map(e => e && e.toString()).join(' | ')}`).toHaveLength(0);
    // Assert there were no console.error messages
    expect(consoleErrors, `Unexpected console.error messages: ${consoleErrors.join(' | ')}`).toHaveLength(0);
  });

  test.describe('Initial State (S0_Empty)', () => {
    test('should display initial empty message on load', async ({ page }) => {
      // Validate entry action for S0_Empty: output.textContent = 'Hash Map is empty.'
      const p = new HashMapPage(page);
      const out = await p.getOutputText();
      expect(out).toContain('Hash Map is empty.');
    });
  });

  test.describe('Add / Update (AddUpdate) and transition to HasEntries (S1_HasEntries)', () => {
    test('adding a key without value transitions to S1 and prints map', async ({ page }) => {
      const p = new HashMapPage(page);

      // Start from empty state; add a key with empty value
      await p.setKey('alpha');
      await p.setValue('');
      await p.clickAdd();

      // Expected observable: output contains Added/Updated message
      const out = await p.getOutputText();
      expect(out).toContain('Added/Updated key "alpha" with value "".');
      // Because S1 entry action calls printMap(), ensure map contents are printed
      expect(out).toContain('Current Hash Map Contents:');
      // Should show the stored key => value (value is empty string JSON-stringified)
      expect(out).toContain('"alpha" => ""');
    });

    test('adding then updating the same key updates value and printMap shows update', async ({ page }) => {
      const p = new HashMapPage(page);

      // Add initial key
      await p.setKey('beta');
      await p.setValue('first');
      await p.clickAdd();
      let out = await p.getOutputText();
      expect(out).toContain('Added/Updated key "beta" with value "first".');
      expect(out).toContain('"beta" => "first"');

      // Update same key with new value
      await p.setKey('beta');
      await p.setValue('second');
      await p.clickAdd();
      out = await p.getOutputText();
      expect(out).toContain('Added/Updated key "beta" with value "second".');
      // printMap should now reflect the updated value
      expect(out).toContain('"beta" => "second"');
      // Ensure old value is gone
      expect(out).not.toContain('"beta" => "first"');
    });

    test('edge case: attempt to add without a key shows an error message and does not transition', async ({ page }) => {
      const p = new HashMapPage(page);

      // Clear key input (no key)
      await p.setKey('');
      await p.setValue('someValue');
      await p.clickAdd();

      // Expect guidance message
      const out = await p.getOutputText();
      expect(out).toContain('Please enter a key to add/update.');
      // Map should remain empty (S0_Empty), so printMap was not triggered; ensure output doesn't contain "Added/Updated"
      expect(out).not.toContain('Added/Updated key');
    });
  });

  test.describe('Get Value (GetValue) behavior in S1_HasEntries', () => {
    test('getting an existing key returns its value', async ({ page }) => {
      const p = new HashMapPage(page);

      // Prepare by adding a key
      await p.setKey('gamma');
      await p.setValue('gVal');
      await p.clickAdd();

      // Now get the value
      await p.setKey('gamma');
      await p.clickGet();

      const out = await p.getOutputText();
      expect(out).toContain('Value at key "gamma": "gVal"');
    });

    test('getting a non-existent key yields a friendly message', async ({ page }) => {
      const p = new HashMapPage(page);

      // Ensure a known different key exists
      await p.setKey('existing');
      await p.setValue('v');
      await p.clickAdd();

      // Request a missing key
      await p.setKey('missing');
      await p.clickGet();

      const out = await p.getOutputText();
      expect(out).toContain('No such key "missing" in the hash map.');
    });

    test('edge case: clicking Get Value without a key prompts for a key', async ({ page }) => {
      const p = new HashMapPage(page);

      await p.setKey('');
      await p.clickGet();

      const out = await p.getOutputText();
      expect(out).toContain('Please enter a key to get.');
    });
  });

  test.describe('Delete Key (DeleteKey) behavior', () => {
    test('deleting an existing key removes it and printMap reflects removal', async ({ page }) => {
      const p = new HashMapPage(page);

      // Add a key then delete it
      await p.setKey('delta');
      await p.setValue('dVal');
      await p.clickAdd();

      // Confirm present
      let out = await p.getOutputText();
      expect(out).toContain('"delta" => "dVal"');

      // Delete the key
      await p.setKey('delta');
      await p.clickDelete();

      out = await p.getOutputText();
      // Expected deleted message
      expect(out).toContain('Deleted key "delta" from the hash map.');
      // After deletion, printMap runs; since likely empty, check for empty state message
      expect(out).toContain('Hash Map is empty.');
    });

    test('deleting a non-existent key results in a no-op message', async ({ page }) => {
      const p = new HashMapPage(page);

      // Ensure map is in some state (can be empty)
      await p.setKey('ghost');
      await p.clickDelete();

      const out = await p.getOutputText();
      expect(out).toContain('Key "ghost" not found. Nothing deleted.');
    });

    test('edge case: clicking Delete without a key prompts for a key', async ({ page }) => {
      const p = new HashMapPage(page);

      await p.setKey('');
      await p.clickDelete();

      const out = await p.getOutputText();
      expect(out).toContain('Please enter a key to delete.');
    });
  });

  test.describe('Clear All (ClearAll) behavior and transition back to S0_Empty', () => {
    test('clearing all entries empties the map and returns to empty state', async ({ page }) => {
      const p = new HashMapPage(page);

      // Add multiple keys
      await p.setKey('k1');
      await p.setValue('v1');
      await p.clickAdd();

      await p.setKey('k2');
      await p.setValue('v2');
      await p.clickAdd();

      // Ensure map has content
      let out = await p.getOutputText();
      expect(out).toContain('Current Hash Map Contents:');
      expect(out).toContain('"k1" => "v1"');
      expect(out).toContain('"k2" => "v2"');

      // Clear all
      await p.clickClear();

      out = await p.getOutputText();
      // The ClearAll action sets a cleared message and printMap should set 'Hash Map is empty.'
      expect(out).toContain('Cleared all entries in the hash map.');
      expect(out).toContain('Hash Map is empty.');
    });
  });

  test.describe('Cross-cutting concerns and additional checks', () => {
    test('sequence: add -> get -> delete -> get shows expected messages and state transitions', async ({ page }) => {
      const p = new HashMapPage(page);

      // Add
      await p.setKey('seq');
      await p.setValue('one');
      await p.clickAdd();
      let out = await p.getOutputText();
      expect(out).toContain('Added/Updated key "seq" with value "one".');

      // Get existing
      await p.setKey('seq');
      await p.clickGet();
      out = await p.getOutputText();
      expect(out).toContain('Value at key "seq": "one"');

      // Delete
      await p.setKey('seq');
      await p.clickDelete();
      out = await p.getOutputText();
      expect(out).toContain('Deleted key "seq" from the hash map.');

      // Get after delete should say no such key
      await p.setKey('seq');
      await p.clickGet();
      out = await p.getOutputText();
      expect(out).toContain('No such key "seq" in the hash map.');
    });

    test('UI sanity checks: ensure buttons and inputs exist and are usable', async ({ page }) => {
      const p = new HashMapPage(page);

      // Sanity: elements are visible/enabled so user interactions are possible
      await expect(p.keyInput).toBeVisible();
      await expect(p.valueInput).toBeVisible();
      await expect(p.addBtn).toBeVisible();
      await expect(p.getBtn).toBeVisible();
      await expect(p.deleteBtn).toBeVisible();
      await expect(p.clearBtn).toBeVisible();
      // Clickability check: try clicking without side-effects other than messages
      await p.setKey('');
      await p.setValue('');
      await p.clickAdd(); // expected to prompt for key
      const out = await p.getOutputText();
      expect(out).toContain('Please enter a key to add/update.');
    });
  });
});