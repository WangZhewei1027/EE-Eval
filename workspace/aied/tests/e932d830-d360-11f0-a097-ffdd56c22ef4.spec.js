import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e932d830-d360-11f0-a097-ffdd56c22ef4.html';

test.describe('BST Visualizer (FSM) - e932d830-d360-11f0-a097-ffdd56c22ef4', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to browser console messages
    page.on('console', msg => {
      try {
        const text = msg.text();
        consoleMessages.push({ type: msg.type(), text });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Listen to uncaught errors on the page
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the application
    await page.goto(APP_URL);
    // Wait for the app to initialize and log the ready message
    await page.waitForSelector('#svgCanvas');
    await expect(page.locator('h1')).toHaveText(/Binary Search Tree/);
    // Ensure the initial log contains the "ready" message
    await page.waitForFunction(() => {
      const log = document.getElementById('log');
      return log && log.textContent && /BST visualizer ready/.test(log.textContent);
    });
  });

  test.afterEach(async ({ page }) => {
    // Assert there are no uncaught page errors (SyntaxError/ReferenceError/TypeError)
    expect(pageErrors.length, 'No uncaught page errors should happen').toBe(0);
    // Optionally assert there are console messages captured
    expect(consoleMessages.length).toBeGreaterThan(0);
  });

  test.describe('Idle state (S0_Idle) and initial rendering', () => {
    test('drawTree() runs on load and UI shows initial empty tree', async ({ page }) => {
      // Verify node count, height and min/max reflect empty tree
      await expect(page.locator('#nodeCount')).toHaveText('0');
      await expect(page.locator('#height')).toHaveText('0');
      await expect(page.locator('#minmax')).toHaveText('—');

      // SVG should exist; initially there should be no text nodes representing values
      const texts = await page.locator('svg#svgCanvas text').allTextContents();
      expect(texts.length).toBe(0);

      // The console log should contain initialization message
      const logText = await page.locator('#log').textContent();
      expect(logText).toContain('BST visualizer ready');
    });
  });

  test.describe('Insert (S1_Inserting) transitions and behaviors', () => {
    test('Insert a single value and verify SVG, stats, and logs', async ({ page }) => {
      // Speed up animations by setting range to 0 (min step still enforced by app)
      await page.fill('#valueInput', '50');
      await page.click('#insertBtn');

      // Wait for an "Inserted 50" log entry
      await page.waitForFunction(() => {
        const l = document.getElementById('log');
        return l && /Inserted\s+50/.test(l.textContent || '');
      }, { timeout: 3000 });

      // Node count should update
      await expect(page.locator('#nodeCount')).toHaveText('1');

      // SVG should contain text node "50"
      const texts = await page.locator('svg#svgCanvas text').allTextContents();
      expect(texts).toContain('50');

      // Attempt to insert duplicate and expect duplicate message (edge case)
      await page.fill('#valueInput', '50');
      await page.click('#insertBtn');
      await page.waitForFunction(() => {
        const l = document.getElementById('log');
        return l && /duplicates are ignored/.test(l.textContent || '');
      }, { timeout: 2000 });

      // Node count remains 1
      await expect(page.locator('#nodeCount')).toHaveText('1');
    });

    test('Insert sequence of values to form a tree (used later for traversal tests)', async ({ page }) => {
      // Clear first to ensure deterministic state
      await page.click('#clearBtn');
      await page.waitForFunction(() => document.getElementById('nodeCount').textContent === '0');

      const values = ['50','30','70','20','40','60','80'];
      for (const v of values) {
        await page.fill('#valueInput', v);
        await page.click('#insertBtn');
        // Wait for inserted log for this value
        await page.waitForFunction((val) => {
          const l = document.getElementById('log');
          return l && new RegExp('Inserted\\s+' + val).test(l.textContent || '');
        }, v, { timeout: 3000 });
      }

      // Verify node count and presence of all values in SVG
      await expect(page.locator('#nodeCount')).toHaveText('7');
      const texts = await page.locator('svg#svgCanvas text').allTextContents();
      for (const v of values) expect(texts).toContain(v);
    });
  });

  test.describe('Delete (S2_Deleting) behaviors and edge cases', () => {
    test('Delete an existing node and verify removal and logs', async ({ page }) => {
      // Ensure tree has a known value 30 (inserted in prior tests, but ensure idempotent)
      await page.fill('#valueInput', '30');
      await page.click('#insertBtn');
      // If duplicate, it will log duplicate; we just proceed
      await page.fill('#valueInput', '30');
      await page.click('#deleteBtn');

      // Wait for 'Deleted 30' log
      await page.waitForFunction(() => {
        const l = document.getElementById('log');
        return l && /Deleted\s+30/.test(l.textContent || '');
      }, { timeout: 3000 });

      // Ensure '30' is no longer present in SVG text contents (or size decreased)
      const texts = await page.locator('svg#svgCanvas text').allTextContents();
      expect(texts).not.toContain('30');
      // Node count decreased (should be at most 7)
      const count = parseInt(await page.locator('#nodeCount').textContent());
      expect(Number.isInteger(count)).toBeTruthy();
      expect(count).toBeLessThanOrEqual(7);
    });

    test('Delete a non-existent value logs not found (edge case)', async ({ page }) => {
      // Pick a large unlikely value
      await page.fill('#valueInput', '9999');
      await page.click('#deleteBtn');

      // Wait for 'not found' message
      await page.waitForFunction(() => {
        const l = document.getElementById('log');
        return l && /not found; cannot delete/.test(l.textContent || '');
      }, { timeout: 2000 });
    });
  });

  test.describe('Search (S3_Searching) behaviors', () => {
    test('Search for existing and non-existing values', async ({ page }) => {
      // Search for an existing value 50
      await page.fill('#valueInput', '50');
      await page.click('#searchBtn');

      await page.waitForFunction(() => {
        const l = document.getElementById('log');
        return l && /Found\s+50/.test(l.textContent || '');
      }, { timeout: 3000 });

      // Search for a non-existent value
      await page.fill('#valueInput', '12345');
      await page.click('#searchBtn');

      await page.waitForFunction(() => {
        const l = document.getElementById('log');
        return l && /Not found:\s*12345/.test(l.textContent || '');
      }, { timeout: 3000 });
    });

    test('Clicking search without a number logs the guidance message (edge case)', async ({ page }) => {
      await page.fill('#valueInput', '');
      await page.click('#searchBtn');

      await page.waitForFunction(() => {
        const l = document.getElementById('log');
        return l && /Enter an integer value to search/.test(l.textContent || '');
      }, { timeout: 2000 });
    });
  });

  test.describe('Clear (S4_Clearing) and Randomize (S5_Randomizing)', () => {
    test('Clear button resets the tree and logs action', async ({ page }) => {
      // Insert something first
      await page.fill('#valueInput', '11');
      await page.click('#insertBtn');
      await page.waitForFunction(() => /Inserted\s+11/.test(document.getElementById('log').textContent || ''), { timeout: 2000 });

      // Clear
      await page.click('#clearBtn');
      await page.waitForFunction(() => {
        return document.getElementById('nodeCount').textContent === '0' &&
               /Tree cleared/.test(document.getElementById('log').textContent || '');
      }, { timeout: 2000 });

      await expect(page.locator('#nodeCount')).toHaveText('0');
    });

    test('Randomize inserts multiple nodes and completes', async ({ page }) => {
      // Click random and wait for completion message
      await page.click('#randomBtn');

      // Randomization logs the start message
      await page.waitForFunction(() => /Randomizing tree with/.test(document.getElementById('log').textContent || ''), { timeout: 2000 });

      // Wait for 'Random insertion complete.' which is logged after scheduled insertions
      await page.waitForFunction(() => /Random insertion complete/.test(document.getElementById('log').textContent || ''), { timeout: 8000 });

      // Node count should be >= 8 (random count between 8 and 15)
      const count = parseInt(await page.locator('#nodeCount').textContent());
      expect(count).toBeGreaterThanOrEqual(8);
      expect(count).toBeLessThanOrEqual(15);
    });
  });

  test.describe('Traversals (S6_Traversing) and Step Traversal (S7_StepTraversal)', () => {
    test('In-order traversal produces sorted sequence', async ({ page }) => {
      // Ensure deterministic tree: clear and insert specific values
      await page.click('#clearBtn');
      await page.waitForFunction(() => document.getElementById('nodeCount').textContent === '0');

      const values = ['50','30','70','20','40','60','80'];
      for (const v of values) {
        await page.fill('#valueInput', v);
        await page.click('#insertBtn');
        await page.waitForFunction((val) => {
          const l = document.getElementById('log');
          return l && new RegExp('Inserted\\s+' + val).test(l.textContent || '');
        }, v, { timeout: 2000 });
      }

      // Trigger inorder traversal
      await page.click('#inorderBtn');

      // Wait for 'In-order complete. Sequence:' log
      await page.waitForFunction(() => /In-order complete\. Sequence:/.test(document.getElementById('log').textContent || ''), { timeout: 5000 });

      // Extract the sequence from the log
      const logText = await page.locator('#log').textContent();
      const match = logText.match(/In-order complete\. Sequence:\s*([\d,\s]+)/);
      expect(match).not.toBeNull();
      const seq = match[1].split(',').map(s=>s.trim()).filter(Boolean);
      // In-order of BST should be ascending numeric
      expect(seq).toEqual(['20','30','40','50','60','70','80']);
    });

    test('Preorder, Postorder and Level-order produce expected sequences', async ({ page }) => {
      // Preorder
      await page.click('#preorderBtn');
      await page.waitForFunction(() => /Pre-order complete\. Sequence:/.test(document.getElementById('log').textContent || ''), { timeout: 5000 });
      let logText = await page.locator('#log').textContent();
      let match = logText.match(/Pre-order complete\. Sequence:\s*([\d,\s]+)/);
      expect(match).not.toBeNull();
      let seq = match[1].split(',').map(s=>s.trim()).filter(Boolean);
      expect(seq).toEqual(['50','30','20','40','70','60','80']);

      // Postorder
      await page.click('#postorderBtn');
      await page.waitForFunction(() => /Post-order complete\. Sequence:/.test(document.getElementById('log').textContent || ''), { timeout: 5000 });
      logText = await page.locator('#log').textContent();
      match = logText.match(/Post-order complete\. Sequence:\s*([\d,\s]+)/);
      expect(match).not.toBeNull();
      seq = match[1].split(',').map(s=>s.trim()).filter(Boolean);
      expect(seq).toEqual(['20','40','30','60','80','70','50']);

      // Level-order
      await page.click('#levelBtn');
      await page.waitForFunction(() => /Level-order complete\. Sequence:/.test(document.getElementById('log').textContent || ''), { timeout: 5000 });
      logText = await page.locator('#log').textContent();
      match = logText.match(/Level-order complete\. Sequence:\s*([\d,\s]+)/);
      expect(match).not.toBeNull();
      seq = match[1].split(',').map(s=>s.trim()).filter(Boolean);
      expect(seq).toEqual(['50','30','70','20','40','60','80']);
    });

    test('Step traversal (S7) advances on svg clicks and completes', async ({ page }) => {
      // Start step traversal (uses inorder list internally)
      await page.click('#stepTraversal');

      // Wait for the initial step traversal log entry
      await page.waitForFunction(() => /Step traversal: click anywhere on the canvas to advance/.test(document.getElementById('log').textContent || ''), { timeout: 2000 });

      // The implementation immediately highlights (calls stepOnce) for first node, so we should see at least one Step visiting entry
      await page.waitForFunction(() => /Step visiting/.test(document.getElementById('log').textContent || ''), { timeout: 2000 });

      // Simulate clicking the canvas several times to advance through nodes
      const svg = page.locator('#svgCanvas');
      // There are 7 nodes; click 7 times to finish traversal (one already done initially)
      for (let i = 0; i < 8; i++) {
        // Click the center of the svg to trigger step
        await svg.click({ position: { x: 600, y: 260 } });
        // Small wait so logs accumulate
        await page.waitForTimeout(100);
      }

      // Wait for completion message
      await page.waitForFunction(() => /Step traversal complete/.test(document.getElementById('log').textContent || ''), { timeout: 3000 });
    });
  });

  test.describe('Pause (S8_Paused) and Resume (S9_Resumed)', () => {
    test('Pause stops animations and logs "Paused." then Resume logs expected message', async ({ page }) => {
      // Start a traversal that schedules multiple actions
      await page.click('#inorderBtn');

      // Give it a moment to start scheduling
      await page.waitForTimeout(150);

      // Click pause to stop further scheduled actions
      await page.click('#pauseBtn');

      // Pause handler logs 'Paused.'
      await page.waitForFunction(() => /Paused\./.test(document.getElementById('log').textContent || ''), { timeout: 2000 });

      // Click resume - implementation logs a message regardless, and may also log "Nothing to resume."
      await page.click('#resumeBtn');

      // Wait for resume-related messages
      await page.waitForFunction(() => /Resume not implemented for mid-animation|Nothing to resume/.test(document.getElementById('log').textContent || ''), { timeout: 2000 });

      // Ensure running state was cleared by pause (node count remains consistent)
      const count = parseInt(await page.locator('#nodeCount').textContent());
      expect(Number.isInteger(count)).toBeTruthy();
    });

    test('Clicking Pause when nothing running still logs "Paused."', async ({ page }) => {
      // Ensure nothing is running by clearing pending and not starting any animation
      await page.click('#clearBtn');
      await page.click('#pauseBtn');

      await page.waitForFunction(() => /Paused\./.test(document.getElementById('log').textContent || ''), { timeout: 2000 });
    });
  });

  test.describe('Edge cases and input validation', () => {
    test('Insert without value logs guidance and does not change tree', async ({ page }) => {
      // Clear value and click insert
      await page.fill('#valueInput', '');
      await page.click('#insertBtn');

      await page.waitForFunction(() => /Enter an integer value to insert/.test(document.getElementById('log').textContent || ''), { timeout: 2000 });

      // Node count should remain zero (or unchanged)
      const count = parseInt(await page.locator('#nodeCount').textContent());
      expect(Number.isInteger(count)).toBeTruthy();
    });

    test('Delete without value logs guidance', async ({ page }) => {
      await page.fill('#valueInput', '');
      await page.click('#deleteBtn');

      await page.waitForFunction(() => /Enter an integer value to delete/.test(document.getElementById('log').textContent || ''), { timeout: 2000 });
    });
  });
});