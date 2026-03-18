import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a329531-ffc5-11f0-8b43-1ffa87931c43.html';

test.describe('Red-Black Tree Visualizer - FSM state & transition tests (app id: 5a329531-ffc5-11f0-8b43-1ffa87931c43)', () => {
  // Collect console and page errors for each test run
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and classify them
    page.on('console', msg => {
      const text = `${msg.type().toUpperCase()}: ${msg.text()}`;
      consoleMessages.push({ type: msg.type(), text, location: msg.location() });
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Load the page exactly as-is
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Keep page open teardown handled by Playwright runner
    // Provide helpful debug output if a test fails (Playwright will surface it)
    // We still assert about console/page errors inside tests themselves.
  });

  // Helper: check if the canvas is (effectively) blank white.
  async function isCanvasBlank(page) {
    return await page.evaluate(() => {
      const canvas = document.getElementById('treeCanvas');
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      const data = ctx.getImageData(0, 0, w, h).data;
      // Check a sample of pixels (sparsely) to avoid heavy computation
      // If we find any pixel not white (255,255,255,alpha>0) we consider it non-blank.
      for (let y = 0; y < h; y += Math.max(1, Math.floor(h / 50))) {
        for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 50))) {
          const idx = (y * w + x) * 4;
          const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
          // treat transparent (a===0) as not drawn (but background is white so a should be 255)
          if (!(r === 255 && g === 255 && b === 255)) return false;
        }
      }
      return true;
    });
  }

  // Helper: count nodes in the tree using page's RBTree structure
  async function getTreeNodeCount(page) {
    return await page.evaluate(() => {
      try {
        if (typeof tree === 'undefined' || !tree || !tree.root) return 0;
        function count(node) {
          if (!node) return 0;
          return 1 + count(node.left) + count(node.right);
        }
        return count(tree.root);
      } catch (err) {
        // If accessing `tree` throws, bubble up error info to test
        return { error: true, name: err.name, message: err.message };
      }
    });
  }

  // Helper: check whether accessing 'tree' throws a ReferenceError/SyntaxError/TypeError
  async function checkAccessTreeThrows(page) {
    return await page.evaluate(() => {
      try {
        // try to read tree and a property to ensure access
        const exists = typeof tree !== 'undefined';
        let rootPresent = false;
        try { rootPresent = !!tree && !!tree.root; } catch (e) { /* ignore */ }
        return { threw: false, exists, rootPresent };
      } catch (err) {
        return { threw: true, name: err.name, message: err.message };
      }
    });
  }

  test('S0_Idle: Initial draw should produce an empty canvas (Idle state)', async ({ page }) => {
    // Validate initial state (Idle): drawTree(tree) executed and canvas is blank
    // Also assert no catastrophic JS errors occurred during load.
    const blank = await isCanvasBlank(page);
    expect(blank).toBe(true);

    // Verify input is present and empty
    const inputVal = await page.locator('#inputValue').inputValue();
    expect(inputVal).toBe('');

    // Verify that accessing the page-scoped `tree` variable does not throw unexpectedly
    const treeAccess = await checkAccessTreeThrows(page);
    expect(treeAccess.threw).toBe(false);
    // tree may be empty state -> root should be null/absent so rootPresent likely false
    expect(typeof treeAccess.exists).toBe('boolean');

    // Ensure there were no uncaught page errors of critical types
    const criticalErrorNames = pageErrors.map(e => e.name);
    expect(criticalErrorNames).not.toContain('SyntaxError');
    expect(criticalErrorNames).not.toContain('ReferenceError');
    expect(criticalErrorNames).not.toContain('TypeError');
  });

  test('InsertValue event: inserting a valid number creates a node and updates canvas (S0 -> S1)', async ({ page }) => {
    // Insert a numeric value and validate the transition from Idle to TreeUpdated
    // Ensure canvas changes from blank to non-blank and tree node count becomes 1
    const beforeBlank = await isCanvasBlank(page);
    expect(beforeBlank).toBe(true);

    // Type a value and click insert
    await page.fill('#inputValue', '42');
    // Click insert and wait a short moment for drawing to occur
    await page.click('#insertBtn');
    await page.waitForTimeout(150); // small wait to let drawing complete

    const blankAfter = await isCanvasBlank(page);
    expect(blankAfter).toBe(false); // canvas should now have drawing

    // Node count should be 1
    const nodeCount = await getTreeNodeCount(page);
    // If access returned an error object, fail with that message for clarity
    if (typeof nodeCount === 'object' && nodeCount && nodeCount.error) {
      throw new Error(`Accessing tree threw ${nodeCount.name}: ${nodeCount.message}`);
    }
    expect(nodeCount).toBeGreaterThanOrEqual(1);

    // Input should be cleared and refocused
    const inputVal = await page.locator('#inputValue').inputValue();
    expect(inputVal).toBe('');
    const activeId = await page.evaluate(() => document.activeElement?.id || null);
    expect(activeId).toBe('inputValue');

    // No critical uncaught page errors
    const names = pageErrors.map(e => e.name);
    expect(names).not.toContain('ReferenceError');
    expect(names).not.toContain('SyntaxError');
    expect(names).not.toContain('TypeError');

    // Also assert that console did not log errors of type 'error'
    const consoleErrorExists = consoleMessages.some(m => m.type === 'error');
    expect(consoleErrorExists).toBe(false);
  });

  test('S1_TreeUpdated self-transition: multiple inserts update tree and increment node count', async ({ page }) => {
    // Insert multiple values and verify node count increases appropriately and canvas remains non-blank
    // Start by inserting a few values
    const values = ['50', '30', '70', '20', '40'];
    for (const v of values) {
      await page.fill('#inputValue', v);
      await page.click('#insertBtn');
      // small pause for drawing/redraw
      await page.waitForTimeout(80);
    }

    // Count nodes in tree
    const nodeCount = await getTreeNodeCount(page);
    if (typeof nodeCount === 'object' && nodeCount && nodeCount.error) {
      throw new Error(`Accessing tree threw ${nodeCount.name}: ${nodeCount.message}`);
    }
    // Expect at least the number of unique values; duplicates not added
    expect(nodeCount).toBeGreaterThanOrEqual(values.length);

    // Canvas should not be blank
    const blank = await isCanvasBlank(page);
    expect(blank).toBe(false);

    // No critical uncaught page errors
    const names = pageErrors.map(e => e.name);
    expect(names).not.toContain('ReferenceError');
    expect(names).not.toContain('SyntaxError');
    expect(names).not.toContain('TypeError');
  });

  test('InsertValue edge-case: clicking insert with empty input shows alert and does not change the tree', async ({ page }) => {
    // Ensure the app reacts to invalid input by showing an alert and not modifying the tree
    // First record current node count and canvas state
    const nodeCountBefore = await getTreeNodeCount(page);
    if (typeof nodeCountBefore === 'object' && nodeCountBefore && nodeCountBefore.error) {
      throw new Error(`Accessing tree threw ${nodeCountBefore.name}: ${nodeCountBefore.message}`);
    }
    const canvasBlankBefore = await isCanvasBlank(page);

    // Listen for the dialog and assert message
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('#insertBtn') // click with empty input
    ]);
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toContain('Please enter a valid number.');
    await dialog.accept();

    // After alert, tree should not have been changed
    const nodeCountAfter = await getTreeNodeCount(page);
    if (typeof nodeCountAfter === 'object' && nodeCountAfter && nodeCountAfter.error) {
      throw new Error(`Accessing tree threw ${nodeCountAfter.name}: ${nodeCountAfter.message}`);
    }
    expect(nodeCountAfter).toBe(nodeCountBefore);

    const canvasBlankAfter = await isCanvasBlank(page);
    expect(canvasBlankAfter).toBe(canvasBlankBefore);

    // No uncaught critical errors
    const names = pageErrors.map(e => e.name);
    expect(names).not.toContain('ReferenceError');
    expect(names).not.toContain('SyntaxError');
    expect(names).not.toContain('TypeError');
  });

  test('ClearTree event: clearing when empty and when populated leads to blank canvas and root reset (S0->S2 and S1->S2)', async ({ page }) => {
    // Part A: clear when already empty (Idle -> TreeCleared)
    // Ensure canvas blank to start
    let blank = await isCanvasBlank(page);
    expect(blank).toBe(true);

    await page.click('#clearBtn');
    await page.waitForTimeout(50);

    // Canvas still blank and node count zero
    blank = await isCanvasBlank(page);
    expect(blank).toBe(true);
    let nodeCount = await getTreeNodeCount(page);
    if (typeof nodeCount === 'object' && nodeCount && nodeCount.error) {
      throw new Error(`Accessing tree threw ${nodeCount.name}: ${nodeCount.message}`);
    }
    expect(nodeCount).toBe(0);

    // Part B: populate tree then clear (S1 -> S2)
    const insertValues = ['15', '10', '20'];
    for (const v of insertValues) {
      await page.fill('#inputValue', v);
      await page.click('#insertBtn');
      await page.waitForTimeout(80);
    }

    // Confirm nodes exist
    nodeCount = await getTreeNodeCount(page);
    if (typeof nodeCount === 'object' && nodeCount && nodeCount.error) {
      throw new Error(`Accessing tree threw ${nodeCount.name}: ${nodeCount.message}`);
    }
    expect(nodeCount).toBeGreaterThanOrEqual(insertValues.length);

    // Now click clear and verify canvas becomes blank and nodeCount resets
    await page.click('#clearBtn');
    await page.waitForTimeout(120);

    const blankAfterClear = await isCanvasBlank(page);
    expect(blankAfterClear).toBe(true);

    const nodeCountAfterClear = await getTreeNodeCount(page);
    if (typeof nodeCountAfterClear === 'object' && nodeCountAfterClear && nodeCountAfterClear.error) {
      throw new Error(`Accessing tree threw ${nodeCountAfterClear.name}: ${nodeCountAfterClear.message}`);
    }
    expect(nodeCountAfterClear).toBe(0);

    // Ensure input cleared and focused
    const inputVal = await page.locator('#inputValue').inputValue();
    expect(inputVal).toBe('');
    const active = await page.evaluate(() => document.activeElement?.id || null);
    expect(active).toBe('inputValue');

    // No critical uncaught page errors recorded
    const names = pageErrors.map(e => e.name);
    expect(names).not.toContain('ReferenceError');
    expect(names).not.toContain('SyntaxError');
    expect(names).not.toContain('TypeError');
  });

  test('Robustness: ensure no ReferenceError/SyntaxError/TypeError occurred during interactions (observability requirement)', async ({ page }) => {
    // This test inspects captured pageErrors and console messages for critical runtime errors.
    // It ensures the app did not produce unhandled ReferenceError/SyntaxError/TypeError during our interactions.

    // Interact quickly with a couple of actions to surface potential errors
    await page.fill('#inputValue', '100');
    await page.click('#insertBtn');
    await page.waitForTimeout(60);
    await page.click('#clearBtn');
    await page.waitForTimeout(60);

    // Check pageErrors collected by page.on('pageerror')
    const errorNames = pageErrors.map(e => e.name);
    // Assert that none of the critical JS error types were thrown unhandled
    expect(errorNames).not.toContain('ReferenceError');
    expect(errorNames).not.toContain('SyntaxError');
    expect(errorNames).not.toContain('TypeError');

    // Also assert that console did not emit 'error' type messages
    const hasConsoleError = consoleMessages.some(m => m.type === 'error');
    expect(hasConsoleError).toBe(false);

    // For transparency, ensure that accessing the `tree` variable remains non-throwing
    const accessResult = await checkAccessTreeThrows(page);
    expect(accessResult.threw).toBe(false);
  });
});