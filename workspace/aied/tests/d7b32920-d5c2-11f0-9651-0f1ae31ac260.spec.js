import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d7b32920-d5c2-11f0-9651-0f1ae31ac260.html';

test.describe('Adjacency Matrix Visualization - FSM and UI tests', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for assertions
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the page exactly as-is and wait for load event
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait for the initial generation to complete (generate() is called on load)
    await page.waitForSelector('#matrixContainer table');
    await page.waitForSelector('#graphCanvas');
  });

  test.afterEach(async () => {
    // No special teardown required - placeholder for completeness
  });

  test.describe('Initial state (S0_Idle) and automatic generate() on load', () => {
    test('generate() should be invoked on page load and render the matrix and canvas', async ({ page }) => {
      // Validate matrix table exists
      const table = page.locator('#matrixContainer table');
      await expect(table).toHaveCount(1);

      // Validate header includes N0..N4 by default (default value 5)
      const headerCells = page.locator('#matrixContainer thead th');
      // first TH is empty header; then N0..N4 -> total 6
      await expect(headerCells).toHaveCount(6);

      // Validate number of data cells = 5 * 5 = 25
      const numNodesValue = await page.locator('#numNodes').inputValue();
      const numNodes = Number(numNodesValue);
      const tdCount = await page.locator('#matrixContainer tbody td').count();
      expect(tdCount).toBe(numNodes * numNodes);

      // Validate initially there are no active cells (adjacency initialized with zeros)
      const activeCells = await page.locator('#matrixContainer tbody td.active').count();
      expect(activeCells).toBe(0);

      // Validate canvas exists and has some drawing (non-empty data URL)
      const dataUrl = await page.evaluate(() => {
        const c = document.getElementById('graphCanvas');
        try {
          return c.toDataURL();
        } catch (e) {
          // If toDataURL is unavailable for any reason, return empty string
          return '';
        }
      });
      expect(typeof dataUrl).toBe('string');
      expect(dataUrl.length).toBeGreaterThan(1000); // canvas should have rendered nodes

      // Assert there were no runtime page errors or console errors during load
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Generate Matrix event (S0_Idle -> S1_MatrixGenerated)', () => {
    test(' clicking Generate Matrix should produce a table matching the sanitized input value', async ({ page }) => {
      // Set input to 3 and click generate
      await page.fill('#numNodes', '3');
      await page.click('#generateBtn');

      // Wait for table to update
      await page.waitForSelector('#matrixContainer table');

      // Verify sanitized input value is 3
      const sanitized = await page.locator('#numNodes').inputValue();
      expect(Number(sanitized)).toBe(3);

      // Table should have 3x3 data cells => 9 td elements
      const tdCount = await page.locator('#matrixContainer tbody td').count();
      expect(tdCount).toBe(3 * 3);

      // Canvas should update accordingly (still produce a non-empty data URL)
      const dataUrl = await page.evaluate(() => document.getElementById('graphCanvas').toDataURL());
      expect(dataUrl.length).toBeGreaterThan(1000);

      // No runtime errors expected on generating matrix via button
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('input sanitization edge cases: below min and above max are clamped to [2,15]', async ({ page }) => {
      // Below min -> 1 should be clamped to 2
      await page.fill('#numNodes', '1');
      await page.click('#generateBtn');
      await page.waitForSelector('#matrixContainer table');
      expect(Number(await page.locator('#numNodes').inputValue())).toBe(2);

      // Above max -> 100 should be clamped to 15
      await page.fill('#numNodes', '100');
      await page.click('#generateBtn');
      await page.waitForSelector('#matrixContainer table');
      expect(Number(await page.locator('#numNodes').inputValue())).toBe(15);

      // Ensure no page errors
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('ToggleEdge event (S1_MatrixGenerated -> S1_MatrixGenerated)', () => {
    test('undirected mode: toggling an upper-triangle cell should activate both mirrored cells', async ({ page }) => {
      // Ensure directed unchecked (undirected)
      const directedChecked = await page.isChecked('#directedCheck');
      if (directedChecked) {
        await page.click('#directedCheck');
      }

      // Generate a 4-node matrix for clarity
      await page.fill('#numNodes', '4');
      await page.click('#generateBtn');
      await page.waitForSelector('#matrixContainer table');

      // Click cell at row 0, col 1 (upper triangle)
      const cell01 = page.locator('td[data-row="0"][data-col="1"]');
      await cell01.click();

      // After toggle, both [0][1] and [1][0] should be active in undirected implementation
      const is01Active = await cell01.evaluate((el) => el.classList.contains('active'));
      const is10Active = await page.locator('td[data-row="1"][data-col="0"]').evaluate((el) => el.classList.contains('active'));

      expect(is01Active).toBe(true);
      expect(is10Active).toBe(true);

      // Canvas should also change (non-empty data URL)
      const dataUrl = await page.evaluate(() => document.getElementById('graphCanvas').toDataURL());
      expect(dataUrl.length).toBeGreaterThan(1000);

      // No runtime errors observed during toggling
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('undirected mode - clicking a lower-triangle cell: observe current implementation behavior (edge case)', async ({ page }) => {
      // This test documents the current behaviour of the implementation for lower-triangle clicks.
      // The implementation contains logic that sets row = col; col = row for c < r, which results
      // in toggling a self-loop at the column index due to the order of assignments.
      // We assert the observed behavior rather than attempting to fix it.

      // Ensure undirected mode
      if (await page.isChecked('#directedCheck')) {
        await page.click('#directedCheck');
      }

      // Generate a fresh 4-node matrix
      await page.fill('#numNodes', '4');
      await page.click('#generateBtn');
      await page.waitForSelector('#matrixContainer table');

      // Click a lower-triangle cell, e.g., row=2 col=1 (2 > 1 => c < r)
      await page.locator('td[data-row="2"][data-col="1"]').click();

      // According to buggy implementation, this will toggle adjacencyMatrix[1][1] (self-loop on node 1).
      const is11Active = await page.locator('td[data-row="1"][data-col="1"]').evaluate((el) => el.classList.contains('active'));
      // Also check that the originally clicked cell (2,1) may not become active in this implementation
      const is21Active = await page.locator('td[data-row="2"][data-col="1"]').evaluate((el) => el.classList.contains('active'));

      // Assert observed behavior: self-loop activated, clicked lower-triangle cell not active
      expect(is11Active).toBe(true);
      expect(is21Active).toBe(false);

      // Document that this is an edge case of the implementation
      // No runtime errors are expected
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('directed mode: toggling a cell should only affect that directed edge', async ({ page }) => {
      // Enable directed mode
      if (!(await page.isChecked('#directedCheck'))) {
        await page.click('#directedCheck');
      }

      // Generate a 4-node matrix again
      await page.fill('#numNodes', '4');
      await page.click('#generateBtn');
      await page.waitForSelector('#matrixContainer table');

      // Click cell [0][1] and ensure only that direction is active
      await page.locator('td[data-row="0"][data-col="1"]').click();
      const is01Active = await page.locator('td[data-row="0"][data-col="1"]').evaluate((el) => el.classList.contains('active'));
      const is10Active = await page.locator('td[data-row="1"][data-col="0"]').evaluate((el) => el.classList.contains('active'));

      expect(is01Active).toBe(true);
      expect(is10Active).toBe(false);

      // Now click the reverse [1][0] to create a reverse edge as well
      await page.locator('td[data-row="1"][data-col="0"]').click();
      const is10ActiveAfter = await page.locator('td[data-row="1"][data-col="0"]').evaluate((el) => el.classList.contains('active'));
      expect(is10ActiveAfter).toBe(true);

      // Both edges now exist; ensure canvas still renders (non-empty)
      const dataUrl = await page.evaluate(() => document.getElementById('graphCanvas').toDataURL());
      expect(dataUrl.length).toBeGreaterThan(1000);

      // No runtime errors should have been thrown during directed toggles
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('toggling the same cell twice should add then remove the edge (idempotent toggle)', async ({ page }) => {
      // Ensure directed or undirected mode - behavior should toggle state
      // Use directed mode for clarity
      if (!(await page.isChecked('#directedCheck'))) {
        await page.click('#directedCheck');
      }

      // Generate a 3-node matrix
      await page.fill('#numNodes', '3');
      await page.click('#generateBtn');
      await page.waitForSelector('#matrixContainer table');

      const target = page.locator('td[data-row="0"][data-col="2"]');
      await target.click();
      const first = await target.evaluate((el) => el.classList.contains('active'));
      expect(first).toBe(true);

      // Click again to remove
      await target.click();
      const second = await target.evaluate((el) => el.classList.contains('active'));
      expect(second).toBe(false);

      // No page errors
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Observability: console logs and runtime errors', () => {
    test('no SyntaxError / ReferenceError / TypeError should be emitted during normal interactions', async ({ page }) => {
      // Perform a set of normal interactions (generate, toggle a few cells)
      await page.fill('#numNodes', '4');
      await page.click('#generateBtn');

      // Toggle a few cells
      await page.locator('td[data-row="0"][data-col="1"]').click();
      await page.locator('td[data-row="1"][data-col="2"]').click();
      await page.locator('td[data-row="2"][data-col="3"]').click();

      // Collect any console error messages
      const errors = consoleMessages.filter((m) => m.type === 'error');

      // Also any page errors captured
      expect(pageErrors.length).toBe(0);

      // Make sure no console errors were logged
      expect(errors.length).toBe(0);

      // As an extra check, ensure no obvious JS exception types in collected errors
      const joined = consoleMessages.map((m) => m.text).join('\n').toLowerCase();
      expect(joined).not.toContain('referenceerror');
      expect(joined).not.toContain('syntaxerror');
      expect(joined).not.toContain('typeerror');
    });
  });
});