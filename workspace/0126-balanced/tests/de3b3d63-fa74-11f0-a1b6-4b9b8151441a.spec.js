import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3b3d63-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object for the B-Tree page to encapsulate common actions and queries
class BTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.degreeInput = page.locator('input#degreeInput');
    this.insertInput = page.locator('input#insertInput');
    this.deleteInput = page.locator('input#deleteInput');
    this.insertButton = page.locator('button[onclick="insertValue()"]');
    this.deleteButton = page.locator('button[onclick="deleteValue()"]');
    this.generateButton = page.locator('button[onclick="generateRandomTree()"]');
    this.clearButton = page.locator('button[onclick="clearTree()"]');
    this.treeContainer = page.locator('#treeContainer');
    this.currentDegree = page.locator('#currentDegree');
    this.keyElements = page.locator('.key');
  }

  // Navigate to the app URL and wait for load
  async goto() {
    await this.page.goto(APP_URL);
    // Wait a moment for initial script initialization and render
    await this.page.waitForLoadState('networkidle');
  }

  // Change degree input and dispatch change event so that the app reacts
  async changeDegree(value) {
    await this.degreeInput.fill(String(value));
    // Dispatch change explicitly to ensure the change listener fires
    await this.degreeInput.dispatchEvent('change');
    // Wait for any render triggered by the change
    await this.page.waitForTimeout(200);
  }

  // Click Generate Random
  async generateRandom() {
    await this.generateButton.click();
    await this.page.waitForTimeout(200);
  }

  // Click Clear
  async clearTree() {
    await this.clearButton.click();
    await this.page.waitForTimeout(200);
  }

  // Insert a value using the UI
  async insertValue(value) {
    await this.insertInput.fill(String(value));
    await this.insertButton.click();
    // Allow re-render
    await this.page.waitForTimeout(200);
  }

  // Delete a value using the UI
  async deleteValue(value) {
    await this.deleteInput.fill(String(value));
    await this.deleteButton.click();
    await this.page.waitForTimeout(200);
  }

  // Get visible keys as array of strings
  async getKeys() {
    return this.keyElements.allTextContents();
  }

  // Check if tree container indicates empty tree
  async isTreeEmpty() {
    const text = await this.treeContainer.textContent();
    if (!text) return true;
    return text.trim() === 'Tree is empty';
  }

  // Get the displayed current degree value
  async getCurrentDegree() {
    return (await this.currentDegree.textContent())?.trim();
  }
}

test.describe('B-Tree Visualization (FSM-driven) - de3b3d63-fa74-11f0-a1b6-4b9b8151441a', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let page;

  // Setup: for each test start fresh and collect console/page errors
  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();

    pageErrors = [];
    consoleErrors = [];

    // Collect uncaught page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Collect console messages, but keep only 'error' level for failing assertions
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  test.afterEach(async () => {
    // Close page after each test to keep tests isolated
    if (page && !page.isClosed()) {
      await page.close();
    }
  });

  // Test initial rendering and initial FSM state behavior
  test('Initial load: App initializes and renders a tree (S0 entry action renderTree)', async () => {
    // Load the app
    const p = new BTreePage(page);
    await p.goto();

    // The app's initialization in the HTML script inserts several values and calls renderTree()
    // Verify that the UI shows nodes/keys (i.e., not empty)
    const empty = await p.isTreeEmpty();
    expect(empty).toBeFalsy();

    // There should be at least one .key element rendered from the initial population
    const keys = await p.getKeys();
    expect(keys.length).toBeGreaterThan(0);

    // Verify currentDegree shows default value '3' as per HTML attributes and initial script
    const degree = await p.getCurrentDegree();
    expect(degree).toBe('3');

    // Assert no uncaught JS errors occurred during page load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('ChangeDegree event: changing degree reinitializes BTree and triggers renderTree (S0 -> S0)', async () => {
    const p1 = new BTreePage(page);
    await p.goto();

    // Change degree to 4 via the input change event listener
    await p.changeDegree(4);

    // After change, currentDegree must reflect new degree and tree should be reset (empty)
    const degree1 = await p.getCurrentDegree();
    expect(degree).toBe('4');

    const empty1 = await p.isTreeEmpty();
    expect(empty).toBeTruthy();

    // Verify no page errors occurred during degree change
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('GenerateRandomTree event: generates a random populated tree and updates currentDegree (S0 -> S1)', async () => {
    const p2 = new BTreePage(page);
    await p.goto();

    // Set degree to 3 and generate random tree
    await p.changeDegree(3); // ensures degreeInput is 3 and bTree reinitialized
    await p.generateRandom();

    // After generation, currentDegree should match degreeInput and tree should be populated
    const degree2 = await p.getCurrentDegree();
    expect(degree).toBe('3');

    const keys1 = await p.getKeys();
    // count should be > 0 as random generation inserts between 5 and 19 items
    expect(keys.length).toBeGreaterThan(0);

    // No uncaught exceptions expected
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('InsertValue event: inserting a numeric value updates tree and renders new key (S0 -> S1)', async () => {
    const p3 = new BTreePage(page);
    await p.goto();

    // Clear tree first to create deterministic environment
    await p.clearTree();
    expect(await p.isTreeEmpty()).toBeTruthy();

    // Insert a new unique value (e.g., 42)
    await p.insertValue(42);

    // After insert, the key '42' should be present in the DOM
    const keys2 = await p.getKeys();
    expect(keys).toContain('42');

    // Ensure the insert input was cleared by the UI
    const insertInputValue = await page.locator('#insertInput').inputValue();
    expect(insertInputValue).toBe('');

    // Verify no page errors occurred during insert
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('InsertValue with invalid input shows alert and does not throw JS errors', async () => {
    const p4 = new BTreePage(page);
    await p.goto();

    // Clear tree to be deterministic
    await p.clearTree();
    expect(await p.isTreeEmpty()).toBeTruthy();

    // Attempt to insert with empty input - expect an alert dialog with a specific message
    let dialogMessage = null;
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Ensure insertInput empty, then click Insert
    await page.locator('#insertInput').fill('');
    await p.insertButton.click();

    // Wait a short time for dialog to be handled
    await page.waitForTimeout(100);

    expect(dialogMessage).toBe('Please enter a valid number');

    // No uncaught JS errors should have occurred
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('DeleteValue event: deleting an existing key updates the tree (S1 -> S1)', async () => {
    const p5 = new BTreePage(page);
    await p.goto();

    // Ensure a known key exists by inserting it first
    await p.insertValue(12345);
    let keys3 = await p.getKeys();
    expect(keys).toContain('12345');

    // Delete that key
    await p.deleteValue(12345);

    // After deletion, the key should no longer be present
    keys = await p.getKeys();
    expect(keys).not.toContain('12345');

    // Ensure delete input cleared
    const deleteInputValue = await page.locator('#deleteInput').inputValue();
    expect(deleteInputValue).toBe('');

    // Verify no page errors occurred during delete
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('DeleteValue with invalid input shows alert and does not throw JS errors', async () => {
    const p6 = new BTreePage(page);
    await p.goto();

    let dialogMessage1 = null;
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Ensure deleteInput empty, then click Delete
    await page.locator('#deleteInput').fill('');
    await p.deleteButton.click();

    // Wait for dialog handling
    await page.waitForTimeout(100);

    expect(dialogMessage).toBe('Please enter a valid number');

    // No uncaught JS errors expected
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('ClearTree event: clears a populated tree and resets currentDegree (S1 -> S0)', async () => {
    const p7 = new BTreePage(page);
    await p.goto();

    // Ensure tree is populated by generating random
    await p.generateRandom();
    expect((await p.getKeys()).length).toBeGreaterThan(0);

    // Set degree to a known value, then clear
    await p.changeDegree(3);
    await p.generateRandom();
    expect((await p.getKeys()).length).toBeGreaterThan(0);

    // Now click Clear
    await p.clearTree();

    // After clear, tree should be empty and currentDegree should equal degreeInput (3)
    expect(await p.isTreeEmpty()).toBeTruthy();
    expect(await p.getCurrentDegree()).toBe('3');

    // No uncaught JS errors during clear
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('GenerateRandomTree with invalid degree shows alert and does not cause uncaught exceptions', async () => {
    const p8 = new BTreePage(page);
    await p.goto();

    // Set degree input to invalid value (1) and click generate
    await p.degreeInput.fill('1');

    let dialogMessage2 = null;
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    await p.generateButton.click();

    await page.waitForTimeout(100);

    expect(dialogMessage).toBe('Degree must be at least 2');

    // No uncaught JS errors expected
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Additional robustness check: ensure that common JS error types did NOT occur during a sequence of interactions
  test('Sequence of interactions does not produce ReferenceError, TypeError, or SyntaxError (observational)', async () => {
    const p9 = new BTreePage(page);
    await p.goto();

    // Sequence: change degree, generate random, insert, delete, clear
    await p.changeDegree(2);
    await p.generateRandom();
    await p.insertValue(77);
    await p.deleteValue(77);
    await p.clearTree();

    // Collect any page errors (these would include ReferenceError, TypeError, SyntaxError, etc.)
    // The requirement is to observe page errors naturally; here we assert that none happened.
    expect(pageErrors.length).toBe(0);

    // Also assert no console error messages were emitted
    expect(consoleErrors.length).toBe(0);
  });
});