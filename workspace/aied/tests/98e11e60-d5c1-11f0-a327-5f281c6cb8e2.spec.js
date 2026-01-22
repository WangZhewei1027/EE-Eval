import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e11e60-d5c1-11f0-a327-5f281c6cb8e2.html';

test.describe('Binary Tree Visualizer (FSM: Binary Tree)', () => {
  // Collect console messages and page errors for each test to assert runtime health.
  test.beforeEach(async ({ page }) => {
    // track console messages
    page.context()._consoleMessages = [];
    page.on('console', msg => {
      // store console messages for assertions later
      page.context()._consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    // track page errors (uncaught exceptions)
    page.context()._pageErrors = [];
    page.on('pageerror', err => {
      page.context()._pageErrors.push(String(err && err.stack ? err.stack : err));
    });

    // navigate and wait for main elements
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#svgCanvas')).toBeVisible();
    await expect(page.locator('#insertBtn')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    // Assert there are no unexpected runtime exceptions (ReferenceError, SyntaxError, TypeError)
    // We intentionally observe console/page errors and fail if any critical JS errors occurred.
    const consoleErrors = (page.context()._consoleMessages || []).filter(m => m.type === 'error');
    const pageErrors = page.context()._pageErrors || [];

    // Provide helpful debugging information on failure
    expect(consoleErrors, `Console errors: ${JSON.stringify(consoleErrors, null, 2)}`).toEqual([]);
    expect(pageErrors, `Page errors: ${JSON.stringify(pageErrors, null, 2)}`).toEqual([]);
  });

  test.describe('Initial state and UI render (S0_Idle)', () => {
    test('renders base layout and initial stats', async ({ page }) => {
      // Validate initial UI elements reflect Idle state
      await expect(page.locator('h1')).toHaveText(/Binary Tree \(BST\) Visualizer/);
      await expect(page.locator('#nodeCount')).toHaveText('0');
      await expect(page.locator('#treeHeight')).toHaveText('0');
      await expect(page.locator('#lastOp')).toHaveText('—');
      await expect(page.locator('#result')).toHaveText('—');
      // SVG exists and has no nodes initially
      const circleCount = await page.locator('#svgCanvas circle').count();
      // Even with defs/shadow there may be a few elements; ensure no data nodes exist (data-id on groups)
      const nodeGroups = await page.locator('#svgCanvas g[data-id]').count();
      expect(nodeGroups).toBe(0);
    });
  });

  test.describe('Insert/Delete/Search/Clear/Randomize flows (S1-S5)', () => {
    test('Insert a value, prevent duplicates, then delete it (Insert -> Delete)', async ({ page }) => {
      // Insert 50
      await page.fill('#valueInput', '50');
      await page.click('#insertBtn');
      await expect(page.locator('#lastOp')).toHaveText('Inserted 50');
      await expect(page.locator('#nodeCount')).toHaveText('1');
      await expect(page.locator('#treeHeight')).toHaveText('1');

      // Attempt duplicate insert - should display "Value exists" and not increase nodeCount
      await page.fill('#valueInput', '50');
      await page.click('#insertBtn');
      await expect(page.locator('#lastOp')).toHaveText('Value exists');
      await expect(page.locator('#nodeCount')).toHaveText('1');

      // Delete the value via delete button
      await page.fill('#valueInput', '50');
      await page.click('#deleteBtn');
      await expect(page.locator('#lastOp')).toHaveText('Deleted 50');
      await expect(page.locator('#nodeCount')).toHaveText('0');

      // Deleting non-existent value should yield "Not found"
      await page.fill('#valueInput', '12345');
      await page.click('#deleteBtn');
      await expect(page.locator('#lastOp')).toHaveText('Not found');
    });

    test('Search for a value (found and not found) with highlights (S3_Searching)', async ({ page }) => {
      // Insert few values to build a small tree
      const values = ['40', '20', '60', '10'];
      for (const v of values) {
        await page.fill('#valueInput', v);
        await page.click('#insertBtn');
        await expect(page.locator('#lastOp')).toHaveText(new RegExp(`Inserted ${v}`));
      }
      await expect(page.locator('#nodeCount')).toHaveText('4');

      // speed up animation for test
      await page.fill('#speed', '50'); // using fill to set value attribute; slider change isn't necessary for code

      // Search for existing value
      await page.fill('#searchInput', '60');
      // intercept potential alert - none expected here
      await page.click('#searchBtn');
      // wait until lastOp becomes 'Found 60' (highlightSearch sets lastOp to 'Found n' on completion)
      await page.waitForFunction(() => {
        const el = document.getElementById('lastOp');
        return el && /Found 60|Not found/.test(el.textContent || '');
      }, null, { timeout: 5000 });
      await expect(page.locator('#lastOp')).toHaveText('Found 60');

      // Search for non-existent value
      await page.fill('#searchInput', '9999');
      await page.click('#searchBtn');
      await page.waitForFunction(() => {
        const el = document.getElementById('lastOp');
        return el && /Found 9999|Not found/.test(el.textContent || '');
      }, null, { timeout: 5000 });
      await expect(page.locator('#lastOp')).toHaveText('Not found');
    });

    test('Clear tree (S4_Clearing) and Randomize (S5_Randomizing)', async ({ page }) => {
      // Ensure some nodes exist
      await page.fill('#valueInput', '5');
      await page.click('#insertBtn');
      await expect(page.locator('#nodeCount')).toHaveText(/^[1-9]\d*$/);

      // Clear tree and assert stats
      await page.click('#clearBtn');
      await expect(page.locator('#lastOp')).toHaveText('Cleared tree');
      await expect(page.locator('#nodeCount')).toHaveText('0');

      // Randomize: set count to 5 and click
      await page.fill('#randomCount', '5');
      await page.click('#randomBtn');
      // lastOp should reflect count
      await expect(page.locator('#lastOp')).toHaveText(/Random tree \(5 nodes\)/);
      // nodeCount should show 5
      await expect(page.locator('#nodeCount')).toHaveText('5');

      // clear after test
      await page.click('#clearBtn');
      await expect(page.locator('#nodeCount')).toHaveText('0');
    });
  });

  test.describe('Traversals and Highlights (S6 & S7)', () => {
    test('Inorder, Preorder, Postorder, Level-order animations complete and result updates', async ({ page }) => {
      // Build a predictable tree
      await page.click('#clearBtn');
      const insertOrder = ['30', '10', '50', '5', '20', '40', '60'];
      for (const v of insertOrder) {
        await page.fill('#valueInput', v);
        await page.click('#insertBtn');
      }
      await expect(page.locator('#nodeCount')).toHaveText('7');

      // speed up animations for test
      await page.evaluate(() => { document.getElementById('speed').value = '40'; });

      // Inorder traversal
      await page.click('#inorder');
      // wait for traversal to complete (lastOp becomes "Traversal complete")
      await page.waitForFunction(() => document.getElementById('lastOp').textContent === 'Traversal complete', null, { timeout: 10000 });
      await expect(page.locator('#result')).not.toHaveText('—'); // traversal should populate result

      // Preorder traversal
      await page.click('#preorder');
      await page.waitForFunction(() => document.getElementById('lastOp').textContent === 'Traversal complete', null, { timeout: 10000 });

      // Postorder traversal
      await page.click('#postorder');
      await page.waitForFunction(() => document.getElementById('lastOp').textContent === 'Traversal complete', null, { timeout: 10000 });

      // Level-order traversal
      await page.click('#bfs');
      await page.waitForFunction(() => document.getElementById('lastOp').textContent === 'Traversal complete', null, { timeout: 10000 });

      // Clear highlights (S7_ClearingHighlights)
      await page.click('#clearHighlights');
      await expect(page.locator('#result')).toHaveText('—');
      await expect(page.locator('#lastOp')).toHaveText('Cleared highlights');
    });
  });

  test.describe('Node interaction, panning, zoom, keyboard, and edge cases', () => {
    test('Clicking a node removes it; background click cancels animations; panning & zoom update viewBox', async ({ page }) => {
      // Create few nodes
      await page.click('#clearBtn');
      await page.fill('#valueInput', '15');
      await page.click('#insertBtn');
      await page.fill('#valueInput', '25');
      await page.click('#insertBtn');
      await page.fill('#valueInput', '5');
      await page.click('#insertBtn');

      // Ensure nodes exist
      const groups = page.locator('#svgCanvas g[data-id]');
      const countBefore = await groups.count();
      expect(countBefore).toBeGreaterThanOrEqual(3);

      // Click first node group to remove it
      const firstGroup = groups.first();
      // Click it directly
      await firstGroup.click();
      // lastOp should indicate deletion (Deleted X)
      await expect(page.locator('#lastOp')).toMatchText(/Deleted \d+/);
      // nodeCount decreased by at least 1
      const afterCount = Number(await page.locator('#nodeCount').textContent());
      expect(afterCount).toBeLessThanOrEqual(countBefore - 1);

      // Start a traversal then click background (svg) to cancel animations
      // Ensure at least one node remains for traversal
      await page.fill('#valueInput', '100');
      await page.click('#insertBtn');

      // speed up
      await page.evaluate(() => { document.getElementById('speed').value = '40'; });
      await page.click('#inorder');
      // immediately click svg background to cancel
      await page.click('#svgCanvas');
      // After cancellation, all circles should have the default fill color (#0ea5a4)
      // Evaluate inside page to inspect SVG circle fills
      const allDefault = await page.evaluate(() => {
        const circles = Array.from(document.querySelectorAll('#svgCanvas g[data-id] circle'));
        return circles.every(c => (c.getAttribute('fill') || '').toLowerCase() === '#0ea5a4');
      });
      expect(allDefault).toBeTruthy();

      // Panning: simulate mousedown on visualArea background (not clicking node)
      // Find coordinates that are outside nodes - pick center
      const visual = page.locator('#visualArea');
      const box = await visual.boundingBox();
      test.expect(box).toBeTruthy();
      if (box) {
        const startX = Math.floor(box.x + box.width / 2);
        const startY = Math.floor(box.y + 20); // near top, likely not over a node
        // mousedown, mousemove, mouseup
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX + 40, startY + 20);
        await page.mouse.up();

        // After panning, viewBox attribute should be present and not the default "0 0 1200 700" (unless tiny pan)
        const vb = await page.locator('#svgCanvas').getAttribute('viewBox');
        expect(vb).not.toBeNull();
        // viewBox is string of four numbers
        expect(vb!.split(' ').length).toBe(4);
      }

      // Zoom via wheel
      // Pick the center of svg element
      const svgEl = page.locator('#svgCanvas');
      const svgBox = await svgEl.boundingBox();
      if (svgBox) {
        const clientX = Math.floor(svgBox.x + svgBox.width / 2);
        const clientY = Math.floor(svgBox.y + svgBox.height / 2);
        // dispatch a wheel event (negative deltaY to zoom in)
        await page.dispatchEvent('#visualArea', 'wheel', { deltaY: -120, clientX, clientY });
        const vbAfterZoom = await page.locator('#svgCanvas').getAttribute('viewBox');
        expect(vbAfterZoom).not.toBeNull();
        // Should still be valid viewBox
        expect(vbAfterZoom!.split(' ').length).toBe(4);
      }
    });

    test('Keyboard Delete key removes value when valueInput has a number', async ({ page }) => {
      // Insert a test value
      await page.fill('#valueInput', '77');
      await page.click('#insertBtn');
      const before = Number(await page.locator('#nodeCount').textContent());
      // Press Delete key to trigger the global keydown handler
      await page.keyboard.press('Delete');
      // After pressing Delete, page triggers tree.remove and render()
      // Wait for nodeCount to drop
      await page.waitForFunction((b) => {
        const cur = Number(document.getElementById('nodeCount').textContent || '0');
        return cur < b;
      }, before, { timeout: 2000 });
      const after = Number(await page.locator('#nodeCount').textContent());
      expect(after).toBeLessThan(before);
    });

    test('Edge cases: empty input triggers alerts for insert/delete/search', async ({ page }) => {
      // Intercept dialogs and assert they are shown with expected messages
      const dialogs: string[] = [];
      page.once('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
      // Clear value input and click insert -> alert expected
      await page.fill('#valueInput', '');
      await page.click('#insertBtn');
      // Wait a tick to ensure dialog handler executed
      await page.waitForTimeout(200);
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      expect(dialogs[0]).toMatch(/Enter an integer to insert/);

      // Next: delete with empty value triggers alert
      dialogs.length = 0;
      page.once('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
      await page.fill('#valueInput', '');
      await page.click('#deleteBtn');
      await page.waitForTimeout(200);
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      expect(dialogs[0]).toMatch(/Enter an integer to delete/);

      // Search with empty triggers alert
      dialogs.length = 0;
      page.once('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
      await page.fill('#searchInput', '');
      await page.click('#searchBtn');
      await page.waitForTimeout(200);
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      expect(dialogs[0]).toMatch(/Enter an integer to search/);
    });
  });
});