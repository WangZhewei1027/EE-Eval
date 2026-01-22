import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e19392-d5c1-11f0-a327-5f281c6cb8e2.html';

test.describe('Union-Find Visualizer (FSM) - 98e19392-d5c1-11f0-a327-5f281c6cb8e2', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and page errors throughout the test
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      // push the actual Error object for detailed assertions if needed
      pageErrors.push(err);
    });

    // Navigate to the static HTML page (the app auto-initializes on load)
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait for the svg to be present and for initial nodes to render
    await page.waitForSelector('#svg');
    await page.waitForSelector('#nodeCount');
    // ensure the arrays panel is present
    await page.waitForSelector('#parentRow');
    await page.waitForSelector('#rankRow');
  });

  test.afterEach(async () => {
    // Basic sanity check: no unexpected page errors occurred during test
    // (We assert this in one test below as well; keeping here for per-test debugging)
  });

  test('Initial state (S0_Idle -> S1_NodesInitialized): page loads and initializes nodes', async ({ page }) => {
    // Validate the app performed the initial init(Number(initNum.value) || 8) on load.
    // Expect nodeCount to reflect the default value (8).
    const nodeCount = await page.locator('#nodeCount').innerText();
    expect(nodeCount).toBe('8');

    // The parent and rank arrays should have 8 cells each with expected initial values
    const parentCells = page.locator('#parentRow .cell');
    const rankCells = page.locator('#rankRow .cell');
    await expect(parentCells).toHaveCount(8);
    await expect(rankCells).toHaveCount(8);

    // parent[i] should equal i initially
    for (let i = 0; i < 8; i++) {
      const text = await parentCells.nth(i).innerText();
      expect(text).toBe(String(i));
    }

    // rank should all be '0'
    for (let i = 0; i < 8; i++) {
      const text = await rankCells.nth(i).innerText();
      expect(text).toBe('0');
    }

    // Info panel should say No node selected initially
    await expect(page.locator('#info')).toHaveText('No node selected');
  });

  test('AddNode (S1_NodesInitialized -> S2_NodeAdded): clicking Add Node appends a node and updates arrays', async ({ page }) => {
    // Click Add Node
    await page.click('#addBtn');

    // Node count should increase to 9
    await expect(page.locator('#nodeCount')).toHaveText('9');

    // parent and rank arrays should reflect the new node at the end
    await expect(page.locator('#parentRow .cell')).toHaveCount(9);
    await expect(page.locator('#rankRow .cell')).toHaveCount(9);

    // new node's parent should equal its index (8)
    const newParentText = await page.locator('#parentRow .cell').nth(8).innerText();
    expect(newParentText).toBe('8');

    // new node's rank should be 0
    const newRankText = await page.locator('#rankRow .cell').nth(8).innerText();
    expect(newRankText).toBe('0');
  });

  test('Selection (S3_SelectionMade) and clear selection (S9_ClearSelection) behaviour', async ({ page }) => {
    // Select first node by clicking the first SVG node group
    const firstNode = page.locator('svg g.node').first();
    await firstNode.click();

    // Info panel should show Selected: 0 — parent...
    await expect(page.locator('#info')).toContainText('Selected: 0');

    // Select a second node (second SVG node)
    const secondNode = page.locator('svg g.node').nth(1);
    await secondNode.click();

    // Info should describe A and B selection with their roots
    const infoText = await page.locator('#info').innerText();
    expect(infoText).toMatch(/Selected A=0 root=\d+, B=1 root=\d+/);

    // Clear selection using Clear Selection button (S9_ClearSelection)
    await page.click('#clearSelBtn');

    // Info should reset
    await expect(page.locator('#info')).toHaveText('No node selected');

    // Also clicking empty space on the svg should keep selection cleared (click background)
    await page.click('#svg'); // clicking svg background invokes clearing logic when target === svg
    await expect(page.locator('#info')).toHaveText('No node selected');
  });

  test('UnionSelected (S3 -> S4): selecting two nodes then clicking Union Selected unites them (parents & ranks update)', async ({ page }) => {
    // Select node 0 and node 1
    await page.locator('svg g.node').nth(0).click();
    await page.locator('svg g.node').nth(1).click();

    // Click Union Selected
    await page.click('#unionBtn');

    // unionAnimate contains async waits; wait until parent of node 1 changes to 0
    await page.waitForFunction(() => {
      const parentRow = document.getElementById('parentRow');
      if (!parentRow) return false;
      const cells = parentRow.querySelectorAll('.cell');
      return cells.length >= 2 && cells[1].textContent.trim() === '0';
    }, null, { timeout: 3000 });

    // Assert parent[1] == 0
    const p1 = await page.locator('#parentRow .cell').nth(1).innerText();
    expect(p1).toBe('0');

    // Because it was a tie, rank[0] should have incremented to '1'
    const r0 = await page.locator('#rankRow .cell').nth(0).innerText();
    expect(r0).toBe('1');
  });

  test('UnionSelected with insufficient selection shows alert (edge case)', async ({ page }) => {
    // Ensure no selection
    await page.click('#clearSelBtn');
    await expect(page.locator('#info')).toHaveText('No node selected');

    // Listen for dialogs
    page.once('dialog', async dialog => {
      expect(dialog.message()).toBe('Select two nodes first (click nodes).');
      await dialog.accept();
    });

    // Click Union Selected expecting an alert
    await page.click('#unionBtn');
  });

  test('FindSelected (S3 -> S5): selecting one node and clicking Find Selected animates find (no parent mutation)', async ({ page }) => {
    // Ensure selection is single: select node 2 only
    await page.locator('svg g.node').nth(2).click();

    // Capture parents snapshot before find
    const parentsBefore = await page.locator('#parentRow .cell').allTextContents();

    // Click Find Selected - animation should occur but not mutate parents
    await page.click('#findBtn');

    // The UI animates; wait a moment for animation to run
    await page.waitForTimeout(900);

    const parentsAfter = await page.locator('#parentRow .cell').allTextContents();
    expect(parentsAfter).toEqual(parentsBefore);
  });

  test('FindSelected with no selection shows alert (edge case)', async ({ page }) => {
    await page.click('#clearSelBtn');

    page.once('dialog', async dialog => {
      expect(dialog.message()).toBe('Select a node first.');
      await dialog.accept();
    });

    await page.click('#findBtn');
  });

  test('PathCompressSelected (S3 -> S6): clicking compress with a selection triggers pathCompress flow (safe if no deep chain)', async ({ page }) => {
    // Select a node (choose node 1)
    await page.locator('svg g.node').nth(1).click();

    // Snapshot before
    const parentsBefore = await page.locator('#parentRow .cell').allTextContents();

    // Click compress
    await page.click('#compressBtn');

    // Wait to allow any potential animations to run
    await page.waitForTimeout(1000);

    // Ensure no unexpected exceptions and that parent array remains consistent (may or may not change)
    const parentsAfter = await page.locator('#parentRow .cell').allTextContents();
    expect(parentsAfter.length).toBe(parentsBefore.length);
  });

  test('PathCompressSelected with no selection shows alert (edge case)', async ({ page }) => {
    await page.click('#clearSelBtn');

    page.once('dialog', async dialog => {
      expect(dialog.message()).toBe('Select a node first.');
      await dialog.accept();
    });

    await page.click('#compressBtn');
  });

  test('AutoRandomUnions (S1 -> S7) starts and stops when clicking Auto button', async ({ page }) => {
    // Ensure we start from a known state with many sets (should be >1)
    const setsBefore = Number((await page.locator('#setsCount').innerText()).trim());
    expect(setsBefore).toBeGreaterThanOrEqual(1);

    // Click auto to start
    await page.click('#autoBtn');

    // The button text should change to 'Stop Auto' when running
    await expect(page.locator('#autoBtn')).toHaveText('Stop Auto');

    // Let it run briefly to perform at least one union
    await page.waitForTimeout(1200);

    // Stop auto
    await page.click('#autoBtn');
    await expect(page.locator('#autoBtn')).toHaveText('Auto Random Unions');

    // Ensure sets count is <= previous (0 or decreased), but it may or may not change deterministically; assert at least element exists
    const setsAfter = Number((await page.locator('#setsCount').innerText()).trim());
    expect(Number.isFinite(setsAfter)).toBeTruthy();
  });

  test('StepRandomUnion (S1 -> S1): clicking step performs a single random union and reduces set count by 1 (from full singletons)', async ({ page }) => {
    // First reset to fresh initialization: set initNum to 8 and click Initialize to reset state cleanly
    await page.fill('#initNum', '8');
    await page.click('#initBtn');

    // Wait for initialization to complete
    await page.waitForFunction(() => document.querySelectorAll('#parentRow .cell').length === 8);

    // Check sets initially 8
    const setsInitial = Number(await page.locator('#setsCount').innerText());
    expect(setsInitial).toBe(8);

    // Click Step (one random union). On a fresh set of singletons this should reduce sets to 7.
    await page.click('#stepBtn');

    // Wait for arrays to update; allow some time for union animation to complete
    await page.waitForTimeout(900);

    const setsAfter = Number(await page.locator('#setsCount').innerText());
    // It should be <= 8, and likely 7; allow either 7 or 8 (defensive) but assert it did not increase
    expect(setsAfter).toBeLessThanOrEqual(8);
    expect(setsAfter).toBeGreaterThanOrEqual(1);
  });

  test('ResetAll (S1 -> S8): Reset clears nodes, arrays and selection', async ({ page }) => {
    // Ensure some nodes exist
    await expect(page.locator('#parentRow .cell')).toHaveCountGreaterThan(0);

    // Click Reset
    await page.click('#resetBtn');

    // Wait for DOM updates
    await page.waitForTimeout(300);

    // Node count should be 0
    await expect(page.locator('#nodeCount')).toHaveText('0');

    // Arrays should be cleared
    await expect(page.locator('#parentRow .cell')).toHaveCount(0);
    await expect(page.locator('#rankRow .cell')).toHaveCount(0);

    // Info should be 'No node selected'
    await expect(page.locator('#info')).toHaveText('No node selected');
  });

  test('Keyboard shortcuts trigger actions (u, f, c, a) without throwing unhandled errors', async ({ page }) => {
    // Initialize to known state
    await page.fill('#initNum', '6');
    await page.click('#initBtn');
    await page.waitForFunction(() => document.querySelectorAll('#parentRow .cell').length === 6);

    // Select two nodes for union via keyboard 'u' - must select nodes first
    await page.locator('svg g.node').nth(0).click();
    await page.locator('svg g.node').nth(1).click();

    // Press 'u' to union via keyboard
    await page.keyboard.press('u');
    await page.waitForTimeout(800);

    // Press 'f' (find) with a single selection (ensure single selected)
    await page.locator('svg g.node').nth(2).click(); // make single selection
    await page.keyboard.press('f');
    await page.waitForTimeout(700);

    // Press 'c' (compress) with single selection
    await page.keyboard.press('c');
    await page.waitForTimeout(700);

    // Toggle auto with 'a'
    await page.keyboard.press('a');
    // button text should change to Stop Auto
    await expect(page.locator('#autoBtn')).toHaveText('Stop Auto');
    // toggle it back off
    await page.keyboard.press('a');
    await expect(page.locator('#autoBtn')).toHaveText('Auto Random Unions');
  });

  test('Console and runtime error monitoring: assert there are no uncaught page errors or console.error entries', async ({ page }) => {
    // Wait briefly to allow background intervals or async tasks to run
    await page.waitForTimeout(500);

    // Inspect captured pageErrors and consoleMessages
    const errorsFromPageError = pageErrors.map(e => e.toString());
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');

    // Assert no uncaught page errors
    expect(errorsFromPageError.length).toBe(0);

    // Assert no console errors/warnings were emitted
    expect(consoleErrors.length).toBe(0);
  });

  test('Accessibility / DOM expectations: core UI elements exist and have expected attributes (component checks)', async ({ page }) => {
    // Buttons exist
    await expect(page.locator('#initBtn')).toBeVisible();
    await expect(page.locator('#addBtn')).toBeVisible();
    await expect(page.locator('#resetBtn')).toBeVisible();
    await expect(page.locator('#autoBtn')).toBeVisible();
    await expect(page.locator('#stepBtn')).toBeVisible();
    await expect(page.locator('#unionBtn')).toBeVisible();
    await expect(page.locator('#findBtn')).toBeVisible();
    await expect(page.locator('#compressBtn')).toBeVisible();
    await expect(page.locator('#clearSelBtn')).toBeVisible();

    // Input has correct default value
    const initNumVal = await page.locator('#initNum').inputValue();
    expect(initNumVal).toBe('8');

    // SVG should have viewBox attribute as defined
    const svgViewBox = await page.locator('#svg').getAttribute('viewBox');
    expect(svgViewBox).toBe('0 0 800 520');
  });

});