import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d54d81-fa73-11f0-83e0-8d7be1d51901.html';

test.describe('d3d54d81-fa73-11f0-83e0-8d7be1d51901 - BST Interactive Demo (FSM Validation)', () => {
  // Shared per-test collectors for console messages, page errors, and dialogs
  let consoleMessages;
  let pageErrors;
  let dialogs;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogs = [];

    // Collect console messages
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // swallow any unexpected console inspection errors
      }
    });

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Auto-accept dialogs but record their messages so tests can assert on them
    page.on('dialog', async (dialog) => {
      try {
        dialogs.push(dialog.message());
        await dialog.accept();
      } catch (e) {
        // ignore dialog handling errors
      }
    });

    // Load the application exactly as-is
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
  });

  test.afterEach(async () => {
    // Teardown is implicitly handled by Playwright's fixture,
    // but we keep a place for additional cleanup if needed in future.
  });

  test('Idle state renders controls and initial example is inserted', async ({ page }) => {
    // Validate presence of key controls (evidence for S0_Idle)
    await expect(page.locator('#insertBtn')).toBeVisible();
    await expect(page.locator('#searchBtn')).toBeVisible();
    await expect(page.locator('#deleteBtn')).toBeVisible();
    await expect(page.locator('#randomBtn')).toBeVisible();
    await expect(page.locator('#clearBtn')).toBeVisible();

    // Input placeholder and initial seed value should be present
    await expect(page.locator('#valueInput')).toHaveAttribute('placeholder', 'e.g. 12, 5, 18, 7');

    // The page's initExample populates the input with seed values. Verify the input has the expected seed.
    const inputValue = await page.locator('#valueInput').inputValue();
    expect(inputValue).toContain('50'); // seed includes 50
    expect(inputValue).toContain('30'); // seed includes 30

    // Wait for the initial example (7 nodes) to be rendered in the SVG.
    // The UI creates <g class="node" data-value="..."> elements for each node.
    await page.waitForFunction(() => {
      return document.querySelectorAll('svg g.node').length >= 7;
    }, null, { timeout: 15000 });

    const nodeCount = await page.evaluate(() => document.querySelectorAll('svg g.node').length);
    expect(nodeCount).toBeGreaterThanOrEqual(7);

    // Ensure the trace element exists (part of UI feedback)
    await expect(page.locator('#trace')).toBeVisible();

    // The log should have entries (initial insert logs)
    const logText = await page.locator('#log').innerText();
    expect(logText.length).toBeGreaterThan(0);
  });

  test('InsertEvent transitions: inserting single and comma-separated values updates the tree', async ({ page }) => {
    // Insert a single value 25 (S1_Inserting)
    await page.fill('#valueInput', '25');
    await page.click('#insertBtn');

    // Wait for the inserted node with data-value="25" to appear in the DOM
    await page.waitForFunction(() => !!document.querySelector('svg g.node[data-value="25"]'), null, { timeout: 8000 });
    const exists25 = await page.$('svg g.node[data-value="25"]');
    expect(exists25).not.toBeNull();

    // Insert multiple values at once: 10 and 15
    await page.fill('#valueInput', '10, 15');
    await page.click('#insertBtn');

    // After the animations, both 10 and 15 should exist
    await page.waitForFunction(() => {
      return !!document.querySelector('svg g.node[data-value="10"]') && !!document.querySelector('svg g.node[data-value="15"]');
    }, null, { timeout: 12000 });

    const exists10 = await page.$('svg g.node[data-value="10"]');
    const exists15 = await page.$('svg g.node[data-value="15"]');
    expect(exists10).not.toBeNull();
    expect(exists15).not.toBeNull();

    // Log should contain insert messages
    const logText1 = await page.locator('#log').innerText();
    expect(/Insert/.test(logText) || /Inserted/.test(logText)).toBeTruthy();
  });

  test('SearchEvent transitions: searching existing, non-existing, and invalid input', async ({ page }) => {
    // Ensure the initial tree is present
    await page.waitForFunction(() => document.querySelectorAll('svg g.node').length >= 7, null, { timeout: 12000 });

    // 1) Search for an existing value (60)
    await page.fill('#valueInput', '60');
    await page.click('#searchBtn');

    // Wait for the runSteps to mark the node; look for circle with class "found"
    await page.waitForFunction(() => {
      const el = document.querySelector('svg g.node[data-value="60"] circle');
      return el && el.classList.contains('found');
    }, null, { timeout: 8000 });

    // Confirm the trace text indicates the found value
    const traceText = await page.locator('#trace').innerText();
    expect(traceText).toMatch(/Found\s*60/);

    // 2) Search for a non-existing value (999)
    await page.fill('#valueInput', '999');
    await page.click('#searchBtn');

    // Wait for log or trace to indicate not found
    await page.waitForFunction(() => {
      return document.querySelector('#trace') && /not found/i.test(document.querySelector('#trace').textContent) || /Value not found/i.test(document.getElementById('log').textContent);
    }, null, { timeout: 8000 });

    const logTextAfterNotFound = await page.locator('#log').innerText();
    expect(/not found/i.test(logTextAfterNotFound)).toBeTruthy();

    // 3) Invalid search input triggers alert (edge case)
    // Provide a non-integer string; performSearch should alert and the dialog handler captures it.
    dialogs.length = 0; // reset
    await page.fill('#valueInput', 'abc');
    await page.click('#searchBtn');

    // Wait briefly for the dialog to be captured
    await page.waitForTimeout(200);
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    // The alert message should mention entering an integer
    const lastDialog = dialogs[dialogs.length - 1];
    expect(/Enter an integer to search/i.test(lastDialog)).toBeTruthy();
  });

  test('DeleteEvent transitions: delete leaf, delete node with two children, and delete via node click', async ({ page }) => {
    // Wait for initial nodes
    await page.waitForFunction(() => document.querySelectorAll('svg g.node').length >= 7, null, { timeout: 12000 });

    // 1) Delete a leaf node: 20
    await page.fill('#valueInput', '20');
    await page.click('#deleteBtn');

    // Wait for node with value 20 to be removed from DOM
    await page.waitForFunction(() => !document.querySelector('svg g.node[data-value="20"]'), null, { timeout: 8000 });
    const node20 = await page.$('svg g.node[data-value="20"]');
    expect(node20).toBeNull();

    // 2) Delete a node with two children: root value 50 should be replaced by successor (60) and 50 removed
    await page.fill('#valueInput', '50');
    await page.click('#deleteBtn');

    // Wait for 50 to be absent from the DOM
    await page.waitForFunction(() => !document.querySelector('svg g.node[data-value="50"]'), null, { timeout: 10000 });
    const node50 = await page.$('svg g.node[data-value="50"]');
    expect(node50).toBeNull();

    // 3) Delete by clicking a node in the visualization (click on node with value 40)
    // The node click handler triggers confirm('Delete node with value X?') and, if accepted, performs deletion.
    // We have globally accepted dialogs in beforeEach, so the deletion will proceed.
    // First ensure node 40 exists
    await page.waitForFunction(() => !!document.querySelector('svg g.node[data-value="40"]'), null, { timeout: 8000 });

    // Click the node element (center)
    const node40 = page.locator('svg g.node[data-value="40"]');
    await node40.click();

    // Wait for the node 40 to be removed from the DOM after deletion animation
    await page.waitForFunction(() => !document.querySelector('svg g.node[data-value="40"]'), null, { timeout: 10000 });
    const node40After = await page.$('svg g.node[data-value="40"]');
    expect(node40After).toBeNull();

    // Log should reflect deletions
    const logText2 = await page.locator('#log').innerText();
    expect(/Deleted/.test(logText) || /Deleted leaf|Deleted \(one child\)/i.test(logText)).toBeTruthy();
  });

  test('ClearEvent transition clears the tree and resets UI', async ({ page }) => {
    // Ensure the tree is present first
    await page.waitForFunction(() => document.querySelectorAll('svg g.node').length >= 7, null, { timeout: 12000 });

    // Click clear button (S4_Clear)
    await page.click('#clearBtn');

    // After clicking, the tree should be cleared: no svg nodes, input empty, and log cleared
    await page.waitForFunction(() => document.querySelectorAll('svg g.node').length === 0, null, { timeout: 5000 });

    const nodeCountAfterClear = await page.evaluate(() => document.querySelectorAll('svg g.node').length);
    expect(nodeCountAfterClear).toBe(0);

    const inputAfterClear = await page.locator('#valueInput').inputValue();
    expect(inputAfterClear).toBe('');

    const logText3 = await page.locator('#log').innerText();
    expect(logText).toBe(''); // logBox.innerHTML is set to '' on clearAll()
  });

  test('RandomTreeEvent populates the tree with a random set of nodes (count check)', async ({ page }) => {
    // Click Random Tree button; it clears and fills input with random values and inserts them
    await page.click('#randomBtn');

    // Wait for the insertion to finish by waiting for at least 5 nodes (the code inserts between 5 and 11)
    await page.waitForFunction(() => document.querySelectorAll('svg g.node').length >= 5, null, { timeout: 15000 });

    const nodeCount1 = await page.evaluate(() => document.querySelectorAll('svg g.node').length);
    expect(nodeCount).toBeGreaterThanOrEqual(5);
  });

  test('Traversal events: inorder, preorder, postorder, level-order show alerts and log results', async ({ page }) => {
    // Ensure initial tree is present
    await page.waitForFunction(() => document.querySelectorAll('svg g.node').length >= 7, null, { timeout: 12000 });

    // Reset dialogs for clear assertions
    dialogs.length = 0;

    // In-order
    await page.click('#inorderBtn');
    await page.waitForTimeout(200); // give dialog handler a beat
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(/In-order traversal/i.test(dialogs[dialogs.length - 1])).toBeTruthy();
    const logTextInorder = await page.locator('#log').innerText();
    expect(/In-order:/.test(logTextInorder)).toBeTruthy();

    // Pre-order
    await page.click('#preorderBtn');
    await page.waitForTimeout(200);
    expect(/Pre-order traversal/i.test(dialogs[dialogs.length - 1]) || /Pre-order traversal/i.test(dialogs[dialogs.length - 2])).toBeTruthy();
    const logTextPreorder = await page.locator('#log').innerText();
    expect(/Pre-order:/.test(logTextPreorder)).toBeTruthy();

    // Post-order
    await page.click('#postorderBtn');
    await page.waitForTimeout(200);
    const lastDialog1 = dialogs[dialogs.length - 1];
    expect(/Post-order traversal/i.test(lastDialog) || /Post-order traversal/i.test(dialogs[dialogs.length - 2])).toBeTruthy();
    const logTextPostorder = await page.locator('#log').innerText();
    expect(/Post-order:/.test(logTextPostorder)).toBeTruthy();

    // Level-order
    await page.click('#levelBtn');
    await page.waitForTimeout(200);
    const lastDialog2 = dialogs[dialogs.length - 1];
    expect(/Level-order traversal/i.test(lastDialog2) || /Level-order traversal/i.test(dialogs[dialogs.length - 2])).toBeTruthy();
    const logTextLevel = await page.locator('#log').innerText();
    expect(/Level-order:/.test(logTextLevel)).toBeTruthy();
  });

  test('Edge-case validations: inserting nothing alerts, traversals alert on empty tree', async ({ page }) => {
    dialogs.length = 0;

    // 1) Insert with empty input should trigger alert 'Enter at least one integer.'
    await page.fill('#valueInput', '');
    await page.click('#insertBtn');
    await page.waitForTimeout(200);
    // Some browsers may show an alert; the implementation triggers alert when arr.length === 0
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(/Enter at least one integer/i.test(dialogs[dialogs.length - 1])).toBeTruthy();

    // 2) Clear, then click inorder to assert 'Tree is empty' alert
    await page.click('#clearBtn');
    // ensure cleared
    await page.waitForFunction(() => document.querySelectorAll('svg g.node').length === 0, null, { timeout: 5000 });

    // Reset dialogs and click inorder
    dialogs.length = 0;
    await page.click('#inorderBtn');
    await page.waitForTimeout(200);
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(/Tree is empty/i.test(dialogs[dialogs.length - 1])).toBeTruthy();
  });

  test('Console and page error monitoring: no uncaught ReferenceError/SyntaxError/TypeError', async ({ page }) => {
    // Wait briefly to collect any runtime errors that may occur during initialization and animations
    await page.waitForTimeout(2000);

    // Verify there are no page-level uncaught errors recorded
    // If any occurred, include them in the test failure message for easier debugging
    if (pageErrors.length > 0) {
      // Provide the first few errors as context
      const joined = pageErrors.slice(0, 5).join(' | ');
      throw new Error('Uncaught page errors detected: ' + joined);
    }

    // Also assert that console messages do not include common fatal error names
    const badConsole = consoleMessages.find(m =>
      /ReferenceError|SyntaxError|TypeError/.test(m.text) || /Uncaught (ReferenceError|TypeError|SyntaxError)/i.test(m.text)
    );
    if (badConsole) {
      throw new Error('Console contains fatal error message: ' + JSON.stringify(badConsole));
    }

    // If none found, the test passes (no uncaught fatal JS errors detected)
    expect(pageErrors.length).toBe(0);
    expect(badConsole).toBeUndefined();
  });
});