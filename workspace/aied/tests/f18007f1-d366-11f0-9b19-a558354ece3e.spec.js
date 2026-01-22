import { test, expect } from '@playwright/test';

// Test file: f18007f1-d366-11f0-9b19-a558354ece3e.spec.js
// Application URL (served externally as specified)
const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f18007f1-d366-11f0-9b19-a558354ece3e.html';

/**
 * Page Object for the Hash Table interactive page.
 * Encapsulates common actions so tests are readable and maintainable.
 */
class HashTablePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Selectors derived from the provided HTML
    this.selectors = {
      keyInput: '#keyInput',
      valueInput: '#valueInput',
      insertButton: 'button[onclick="insertValue()"]',
      getKeyInput: '#getKeyInput',
      getValueButton: 'button[onclick="getValue()"]',
      deleteKeyInput: '#deleteKeyInput',
      deleteButton: 'button[onclick="deleteValue()"]',
      clearButton: 'button[onclick="clearTable()"]',
      showHashFunctionButton: 'button[onclick="showHashFunction()"]',
      runDemoButton: 'button[onclick="runDemo()"]',
      output: '#output',
      tableContents: '#tableContents',
      bucketCollision: '.bucket.collision',
      entry: '.entry'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for initial display update to complete (updateDisplay runs on load)
    await this.page.waitForSelector(this.selectors.tableContents);
    await this.page.waitForSelector(this.selectors.output);
  }

  async insert(key, value) {
    if (key !== undefined) {
      await this.page.fill(this.selectors.keyInput, key);
    }
    if (value !== undefined) {
      await this.page.fill(this.selectors.valueInput, value);
    }
    await this.page.click(this.selectors.insertButton);
  }

  async getValue(key) {
    if (key !== undefined) {
      await this.page.fill(this.selectors.getKeyInput, key);
    }
    await this.page.click(this.selectors.getValueButton);
  }

  async deleteValue(key) {
    if (key !== undefined) {
      await this.page.fill(this.selectors.deleteKeyInput, key);
    }
    await this.page.click(this.selectors.deleteButton);
  }

  async clearTable() {
    await this.page.click(this.selectors.clearButton);
  }

  async showHashFunction() {
    await this.page.click(this.selectors.showHashFunctionButton);
  }

  async runDemo() {
    await this.page.click(this.selectors.runDemoButton);
  }

  async getOutputText() {
    return await this.page.$eval(this.selectors.output, el => el.innerText);
  }

  async getTableInnerHTML() {
    return await this.page.$eval(this.selectors.tableContents, el => el.innerHTML);
  }

  async countEntries() {
    return await this.page.$$eval(this.selectors.entry, els => els.length);
  }

  async countBucketsWithCollisionClass() {
    return await this.page.$$eval(this.selectors.bucketCollision, els => els.length);
  }
}

test.describe('Hash Table FSM - states and transitions', () => {
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset error collections before each test
    consoleErrors = [];
    pageErrors = [];

    // Capture console errors emitted by the page
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture uncaught exceptions / page errors
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });
  });

  test('Initial load -> Idle state: updateDisplay() invoked and table is initialized', async ({ page }) => {
    // Arrange
    const ht = new HashTablePage(page);

    // Act
    await ht.goto();

    // Assert: output should reflect idle state (Entries: 0/10 ...)
    const outputText = await ht.getOutputText();
    expect(outputText).toMatch(/Entries:\s*0\/10/);

    // Assert: tableContents should include Bucket entries (display() builds buckets)
    const tableHtml = await ht.getTableInnerHTML();
    expect(tableHtml).toContain('Bucket 0:');
    // Since no entries, expect at least one <em>Empty</em>
    expect(tableHtml).toMatch(/<em>Empty<\/em>/);

    // No runtime console errors or uncaught exceptions should be present on initial load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test.describe('Insert / Get / Delete transitions (S1, S2, S3)', () => {
    test('InsertValue -> S1_Inserted: inserting a key-value updates display and prints insertion message', async ({ page }) => {
      const ht = new HashTablePage(page);
      await ht.goto();

      // Act: Insert using default values present in inputs (apple/red)
      await ht.insert(); // uses current values in inputs

      // Wait for the insertion message to appear in output
      await page.waitForFunction(() => {
        const out = document.getElementById('output');
        return out && /Inserted "[^"]+": "[^"]+" at bucket \d+/.test(out.innerHTML);
      });

      const outputText = await ht.getOutputText();
      expect(outputText).toMatch(/Inserted "apple": "red" at bucket \d+/);

      // After insertion, updateDisplay() should have set entries to 1/10
      expect(outputText).toMatch(/Entries:\s*1\/10/);

      // Table should contain the inserted key
      const tableHtml = await ht.getTableInnerHTML();
      expect(tableHtml).toContain('apple');
      // No runtime console/page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('GetValue -> S2_ValueRetrieved: retrieving an existing key shows its value', async ({ page }) => {
      const ht = new HashTablePage(page);
      await ht.goto();

      // Ensure the key exists by inserting first
      await ht.insert('apple', 'red');

      // Act: retrieve
      await ht.getValue('apple');

      // Assert: output exactly shows the retrieved value for key
      await page.waitForFunction(() => {
        const out = document.getElementById('output');
        return out && /Value for "apple": "red"/.test(out.innerHTML);
      });
      const outputText = await ht.getOutputText();
      expect(outputText.trim()).toContain('Value for "apple": "red"');

      // No runtime errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('DeleteValue -> S3_Deleted: deleting an existing key updates table and prints deletion message', async ({ page }) => {
      const ht = new HashTablePage(page);
      await ht.goto();

      // Insert then delete
      await ht.insert('apple', 'red');

      // Act: delete
      await ht.deleteValue('apple');

      // Assert: output shows Deleted key "apple"
      await page.waitForFunction(() => {
        const out = document.getElementById('output');
        return out && /Deleted key "apple"/.test(out.innerHTML);
      });
      const outputText = await ht.getOutputText();
      expect(outputText).toContain('Deleted key "apple"');

      // After deletion, table should no longer contain 'apple'
      const tableHtml = await ht.getTableInnerHTML();
      expect(tableHtml).not.toContain('apple');

      // updateDisplay() should set entries back to 0/10
      expect(outputText).toMatch(/Entries:\s*0\/10/);

      // No runtime errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Clear table and hash function / demo behaviors (S4, S5)', () => {
    test('ClearTable -> S4_Cleared: clears all entries and reports cleared message', async ({ page }) => {
      const ht = new HashTablePage(page);
      await ht.goto();

      // Insert two entries
      await ht.insert('apple', 'red');
      await ht.insert('banana', 'yellow');

      // Sanity: ensure entries > 0
      let countBefore = await ht.countEntries();
      expect(countBefore).toBeGreaterThan(0);

      // Act: clear
      await ht.clearTable();

      // Assert: output contains 'Hash table cleared'
      await page.waitForFunction(() => {
        const out = document.getElementById('output');
        return out && /Hash table cleared/.test(out.innerHTML);
      });
      const outputText = await ht.getOutputText();
      expect(outputText).toContain('Hash table cleared');

      // Table should be empty (entries count 0)
      const entriesCount = await ht.countEntries();
      expect(entriesCount).toBe(0);

      // No runtime errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('ShowHashFunction -> displays hashes for sample keys (visualization of hash function)', async ({ page }) => {
      const ht = new HashTablePage(page);
      await ht.goto();

      // Act
      await ht.showHashFunction();

      // Assert: output contains the demonstration header and mapping lines for sample keys
      await page.waitForFunction(() => {
        const out = document.getElementById('output');
        return out && /Hash Function Demonstration:/.test(out.innerHTML);
      });
      const outputText = await ht.getOutputText();
      expect(outputText).toContain('Hash Function Demonstration:');
      // Check for at least one mapped key such as "apple" → hash: N
      expect(outputText).toMatch(/"apple"\s*→\s*hash:\s*\d+\s*\(bucket\s*\d+\)/);
      expect(outputText).toMatch(/"banana"\s*→\s*hash:\s*\d+\s*\(bucket\s*\d+\)/);

      // No runtime errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('RunDemo -> S5_DemoRunning: starts demo and completes inserting multiple items', async ({ page }) => {
      const ht = new HashTablePage(page);
      await ht.goto();

      // Act: click run demo
      await ht.runDemo();

      // Immediately expect 'Running Demo...' to be present
      await page.waitForFunction(() => {
        const out = document.getElementById('output');
        return out && /Running Demo\.\.\./.test(out.innerHTML);
      });

      // Wait for the final demo completion message. The demo inserts 7 items at 800ms intervals => ~5600ms.
      // Give a generous timeout to account for environment slowness.
      await page.waitForFunction(() => {
        const out = document.getElementById('output');
        return out && /Demo completed!/.test(out.innerHTML);
      }, null, { timeout: 10000 });

      // After demo finishes, expect a number of .entry elements equal to demo dataset length (7)
      const entriesCount = await ht.countEntries();
      // The demo data had 7 unique keys; expect at least 7 entry elements present.
      expect(entriesCount).toBeGreaterThanOrEqual(7);

      // Also expect the output to contain the 'Demo completed!' note
      const outputText = await ht.getOutputText();
      expect(outputText).toContain('Demo completed!');

      // No runtime errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Inserting with empty key triggers an alert and does not insert (edge case)', async ({ page }) => {
      const ht = new HashTablePage(page);
      await ht.goto();

      // Ensure table initially empty
      const initialEntries = await ht.countEntries();
      expect(initialEntries).toBe(0);

      // Prepare to accept the alert dialog triggered by insertValue()
      page.once('dialog', async dialog => {
        // The application uses alert('Please enter a key') for empty key
        expect(dialog.type()).toBe('alert');
        expect(dialog.message()).toContain('Please enter a key');
        await dialog.accept();
      });

      // Act: clear key input to trigger empty key alert
      await page.fill(ht.selectors.keyInput, '');
      await page.click(ht.selectors.insertButton);

      // Wait a small amount to ensure any UI changes would have happened
      await page.waitForTimeout(200);

      // Assert: no entries were created
      const entriesAfter = await ht.countEntries();
      expect(entriesAfter).toBe(initialEntries);

      // No runtime errors (alert usage is expected, not an error)
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Getting a non-existing key reports "not found" and does not throw', async ({ page }) => {
      const ht = new HashTablePage(page);
      await ht.goto();

      // Act: attempt to get a key that does not exist
      await ht.getValue('this_key_does_not_exist_123');

      // Assert: output reports key not found
      await page.waitForFunction(() => {
        const out = document.getElementById('output');
        return out && /Key "this_key_does_not_exist_123" not found/.test(out.innerHTML);
      });
      const outputText = await ht.getOutputText();
      expect(outputText).toContain('Key "this_key_does_not_exist_123" not found');

      // No runtime errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Deleting a non-existing key reports "not found" and does not throw', async ({ page }) => {
      const ht = new HashTablePage(page);
      await ht.goto();

      // Act: attempt to delete a key that does not exist
      await ht.deleteValue('no_such_key_456');

      // Assert: output reports key not found
      await page.waitForFunction(() => {
        const out = document.getElementById('output');
        return out && /Key "no_such_key_456" not found/.test(out.innerHTML);
      });
      const outputText = await ht.getOutputText();
      expect(outputText).toContain('Key "no_such_key_456" not found');

      // No runtime errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  // Optional teardown check: ensure no unexpected page errors remained (keeps tests deterministic)
  test.afterEach(async () => {
    // If any console errors or page errors were collected, fail the test explicitly with context.
    if (consoleErrors.length > 0 || pageErrors.length > 0) {
      // Throw combined error to make debugging easier in CI logs
      throw new Error(
        `Detected runtime issues during test:\nConsole errors: ${JSON.stringify(consoleErrors, null, 2)}\nPage errors: ${JSON.stringify(pageErrors, null, 2)}`
      );
    }
  });
});