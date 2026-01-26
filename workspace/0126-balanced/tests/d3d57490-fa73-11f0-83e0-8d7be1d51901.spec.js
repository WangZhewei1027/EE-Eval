import { test, expect } from '@playwright/test';

// Test file for AVL Tree Visualizer
// Application URL:
// http://127.0.0.1:5500/workspace/0126-balanced/html/d3d57490-fa73-11f0-83e0-8d7be1d51901.html
//
// Filename requirement satisfied by test runner configuration: d3d57490-fa73-11f0-83e0-8d7be1d51901.spec.js

// Page object encapsulating interactions with the AVL visualizer
class AVLPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#inputValue');
    this.insertBtn = page.locator('#insertBtn');
    this.deleteBtn = page.locator('#deleteBtn');
    this.bulkBtn = page.locator('#bulkBtn');
    this.randomBtn = page.locator('#randomBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.playBtn = page.locator('#playBtn');
    this.pauseBtn = page.locator('#pauseBtn');
    this.stepBtn = page.locator('#stepBtn');
    this.snapCount = page.locator('#snapCount');
    this.statusText = page.locator('#statusText');
    this.logDiv = page.locator('#log');
    this.svgCanvas = page.locator('#svgCanvas');
    this.inOrder = page.locator('#inOrder');
    this.preOrder = page.locator('#preOrder');
    this.postOrder = page.locator('#postOrder');
    this.levelOrder = page.locator('#levelOrder');
  }

  async navigate(url) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    // Wait for initial rendering to complete, indicated by the log message
    await expect(this.logDiv).toContainText('AVL Tree Visualizer ready', { timeout: 3000 });
  }

  async insertValue(value) {
    await this.input.fill(String(value));
    await this.insertBtn.click();
  }

  async deleteValue(value) {
    await this.input.fill(String(value));
    await this.deleteBtn.click();
  }

  async bulkInsert(values) {
    await this.input.fill(values.join(','));
    await this.bulkBtn.click();
  }

  async generateRandomTree() {
    await this.randomBtn.click();
  }

  async clearTree() {
    await this.clearBtn.click();
  }

  async play() {
    await this.playBtn.click();
  }

  async pause() {
    await this.pauseBtn.click();
  }

  async step() {
    await this.stepBtn.click();
  }

  async pressEnterInInput() {
    await this.input.press('Enter');
  }
}

test.describe('AVL Tree Visualizer — FSM and UI integration tests', () => {
  const appUrl = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d57490-fa73-11f0-83e0-8d7be1d51901.html';
  let pageErrors = [];
  let consoleErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // Collect page errors and console error messages for assertions later.
    pageErrors = [];
    consoleErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // Capture uncaught exceptions from the page (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });

    // Navigate and ensure app loaded
    const avl = new AVLPage(page);
    await avl.navigate(appUrl);
  });

  test.afterEach(async () => {
    // After each test ensure there were no unexpected page errors
    expect(pageErrors, 'No uncaught page errors should occur').toEqual([]);
    // Also assert that the page did not emit console 'error' level logs
    expect(consoleErrors, 'No console.error messages should be logged').toEqual([]);
  });

  test.describe('Initial state (S0_Ready) and basic UI', () => {
    test('renders Ready state and initial hints', async ({ page }) => {
      const avl = new AVLPage(page);

      // Validate elements existence and initial texts for S0_Ready evidence.
      await expect(avl.statusText).toHaveText(/Status: Ready/);
      await expect(avl.input).toBeVisible();
      await expect(avl.insertBtn).toBeVisible();
      await expect(avl.deleteBtn).toBeVisible();
      await expect(avl.snapCount).toHaveText('0');
      // The log should have an initial ready message
      await expect(avl.logDiv).toContainText('AVL Tree Visualizer ready. Insert a number', { timeout: 2000 });

      // Validate SVG contains 'Tree is empty' message as initial state renderState(initState)
      await expect(avl.svgCanvas).toContainText('Tree is empty');
    });
  });

  test.describe('Insert (S0_Ready -> S1_Inserting) and related transitions', () => {
    test('inserting a single value via button creates snapshots and updates traversals', async ({ page }) => {
      const avl = new AVLPage(page);
      // Insert 30
      await avl.insertValue(30);

      // After insert, UI writes log indicating playback ready and snapshot count updated
      await expect(avl.logDiv).toContainText('Inserted 30 — playback ready', { timeout: 3000 });

      // Snap count should reflect number of snapshots (>=1)
      const snapText = await avl.snapCount.textContent();
      const snapCountNum = Number(snapText || '0');
      expect(snapCountNum).toBeGreaterThan(0);

      // Traversals should include the inserted value
      await expect(avl.inOrder).toContainText('30');
      await expect(avl.preOrder).toContainText('30');
      await expect(avl.postOrder).toContainText('30');
      await expect(avl.levelOrder).toContainText('30');

      // SVG should show a node with text '30'
      await expect(avl.svgCanvas).toContainText('30');
    });

    test('inserting via Enter key triggers insert (KeyboardEnterInsert event)', async ({ page }) => {
      const avl = new AVLPage(page);
      // Use a unique value to avoid duplicates from other tests
      const val = 15;
      await avl.input.fill(String(val));
      await avl.pressEnterInInput();

      // Confirm playback-ready log created
      await expect(avl.logDiv).toContainText('Inserted 15 — playback ready', { timeout: 3000 });

      // Traversal should contain inserted value
      await expect(avl.inOrder).toContainText('15');
    });

    test('bulk insert (S0_Ready -> S3_BulkInserting) inserts multiple values', async ({ page }) => {
      const avl = new AVLPage(page);
      // Bulk insert several values
      const values = [50, 40, 60];
      await avl.bulkInsert(values);

      // Confirm log message about bulk insert
      await expect(avl.logDiv).toContainText('Bulk inserted 3 values — playback ready', { timeout: 3000 });

      // Traversals should include all values
      for (const v of values) {
        await expect(avl.inOrder).toContainText(String(v));
      }

      // Snap count should be non-zero
      const snaps = Number((await avl.snapCount.textContent()) || '0');
      expect(snaps).toBeGreaterThan(0);
    });
  });

  test.describe('Delete (S0_Ready -> S2_Deleting) and transitions', () => {
    test('delete an existing node produces snapshots and updates traversals', async ({ page }) => {
      const avl = new AVLPage(page);

      // Ensure a known value exists first
      await avl.insertValue(77);
      await expect(avl.logDiv).toContainText('Inserted 77 — playback ready', { timeout: 3000 });

      // Delete it
      await avl.deleteValue(77);
      await expect(avl.logDiv).toContainText('Delete 77 — playback ready', { timeout: 3000 });

      // Traversals should no longer include 77
      await expect(avl.inOrder).not.toContainText('77');
    });

    test('deleting a non-existing value logs not found and does not break UI', async ({ page }) => {
      const avl = new AVLPage(page);
      // Use a likely-nonexistent negative value
      await avl.deleteValue(-9999);
      // The delete function pushes snapshots with 'not found' message; the UI log will still say playback ready with steps (may be 0)
      await expect(avl.logDiv).toContainText('Delete -9999 — playback ready', { timeout: 3000 });
      // Ensure UI still responsive: status text exists and SVG still rendered (may be empty)
      await expect(avl.statusText).toBeVisible();
      await expect(avl.svgCanvas).toBeVisible();
    });
  });

  test.describe('Random tree generation (S0_Ready -> S5_Playing) and Clear (S4_Clearing)', () => {
    test('random