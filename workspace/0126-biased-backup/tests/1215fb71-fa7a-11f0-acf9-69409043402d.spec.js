import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1215fb71-fa7a-11f0-acf9-69409043402d.html';

test.describe('B-Tree Index Interactive Demo (FSM validation) - 1215fb71...', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;
  let dialogMessages;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogMessages = [];

    // Capture console messages
    page.on('console', (msg) => {
      try {
        consoleMessages.push(`${msg.type()}: ${msg.text()}`);
      } catch (e) {
        consoleMessages.push(`console: (could not stringify)`);
      }
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Intercept dialogs (alerts/confirms/prompts) so tests can assert messages and continue
    page.on('dialog', async (dialog) => {
      dialogMessages.push({ type: dialog.type(), message: dialog.message() });
      // auto-accept confirms and alerts so flow continues; for prompts, accept with empty string
      try {
        if (dialog.type() === 'prompt') {
          await dialog.accept('');
        } else {
          await dialog.accept();
        }
      } catch (e) {
        // ignore accept errors
      }
    });

    // Navigate to the page fresh for each test
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Wait for the initial log entry to appear and the page to initialize
    await expect(page.locator('#tree-display')).toBeVisible();
  });

  test.afterEach(async () => {
    // Basic expectation: no uncaught JS errors happened during the test run
    expect(pageErrors.length).toBe(0);
  });

  test('S0 Idle - initial page state shows "(no tree initialized)" and logs page load', async ({ page }) => {
    // Validate initial visuals and logs as the Idle state
    const treeText = (await page.locator('#tree-display').textContent())?.trim();
    expect(treeText).toBe('(no tree initialized)');

    // The page script logs a "Page loaded..." message on initialization
    const logText = (await page.locator('#log').textContent()) || '';
    expect(logText).toContain('Page loaded. Initialize a B-Tree to begin.');

    // No dialogs should have been triggered during normal load
    expect(dialogMessages.length).toBe(0);

    // Ensure no page runtime errors were captured
    expect(pageErrors.length).toBe(0);
  });

  test('InitializeTree -> S1_TreeInitialized: clicking Initialize sets up empty tree and logs with degree', async ({ page }) => {
    // Ensure degree default is 3
    const degreeVal = await page.locator('#degree-input').inputValue();
    expect(degreeVal).toBe('3');

    // Click init-tree to initialize B-Tree
    await page.click('#init-tree');

    // tree-display should update to indicate an empty tree
    const treeText = (await page.locator('#tree-display').textContent())?.trim();
    expect(treeText).toBe('(empty tree)');

    // Log should contain initialization message including the degree
    const logText = await page.locator('#log').textContent();
    expect(logText).toMatch(/Initialized new empty B-Tree with degree t=3/);
  });

  test('InsertKey -> S2_KeyInserted: inserting a key logs success and updates the display', async ({ page }) => {
    // Initialize first
    await page.click('#init-tree');
    // Insert a key
    await page.fill('#insert-key', '10');
    await page.click('#insert-btn');

    // Log must contain a success message for insertion
    const logText = await page.locator('#log').textContent();
    expect(logText).toMatch(/Inserted key 10 successfully\./);

    // tree-display should reflect the key (node keys shown in brackets)
    const treeText = (await page.locator('#tree-display').textContent()) || '';
    expect(treeText).toContain('10');
    // Also ensure tree-display shows the bracket formatting common to traverseIndent
    expect(treeText).toMatch(/\[.*10.*\]/);
  });

  test('SearchKey -> S4_KeySearched: searching an existing and non-existing key logs appropriate messages', async ({ page }) => {
    // Initialize and insert a key to be searched
    await page.click('#init-tree');
    await page.fill('#insert-key', '42');
    await page.click('#insert-btn');

    // Search for existing key
    await page.fill('#search-key', '42');
    await page.click('#search-btn');

    let logText = await page.locator('#log').textContent();
    expect(logText).toMatch(/Key 42 found in node with keys:/);

    // Search for non-existing key
    await page.fill('#search-key', '999');
    await page.click('#search-btn');

    logText = await page.locator('#log').textContent();
    expect(logText).toMatch(/Key 999 not found in tree\./);
  });

  test('DeleteKey -> S3_KeyDeleted: deleting a key logs deletion and updates display', async ({ page }) => {
    // Initialize and insert a key
    await page.click('#init-tree');
    await page.fill('#insert-key', '7');
    await page.click('#insert-btn');

    // Delete the inserted key
    await page.fill('#delete-key', '7');
    await page.click('#delete-btn');

    // Log should show deletion success
    const logText = await page.locator('#log').textContent();
    expect(logText).toMatch(/Deleted key 7 successfully\./);

    // After deletion, the tree display should indicate empty tree (since root has no keys)
    const treeText = (await page.locator('#tree-display').textContent()) || '';
    // either '(empty tree)' or no '7' present
    expect(treeText).toContain('(empty tree)');
  });

  test('BulkInsertKeys -> S6_BulkInserted: bulk inserting multiple keys updates tree and logs count', async ({ page }) => {
    // Initialize
    await page.click('#init-tree');

    // Bulk insert multiple keys
    await page.fill('#bulk-keys', '3, 1, 4, 5, 2');
    await page.click('#bulk-insert-btn');

    // The bulk insert logs an inserted count
    const logText = await page.locator('#log').textContent();
    expect(logText).toMatch(/Bulk inserted 5 keys\./);

    // Refresh display and verify keys exist (inorder list mode also available)
    await page.selectOption('#display-mode', 'list');
    await page.click('#refresh-display');
    const treeList = (await page.locator('#tree-display').textContent()) || '';
    // The list should contain the 5 numbers, sorted or present
    expect(treeList).toMatch(/1.*2.*3.*4.*5/);
  });

  test('ShowTreeStats: statistics reflect current B-Tree properties', async ({ page }) => {
    // Initialize and add keys
    await page.click('#init-tree');
    await page.fill('#bulk-keys', '10,20,30');
    await page.click('#bulk-insert-btn');

    // Show stats
    await page.click('#tree-stats-btn');

    const stats = await page.locator('#stats-display').textContent();
    expect(stats).toContain('Tree statistics:');
    expect(stats).toMatch(/Minimum degree \(t\): 3/); // default t=3
    expect(stats).toMatch(/Number of keys stored: \d+/);
  });

  test('ClearTree -> S5_TreeCleared: clicking Clear Tree confirms and resets the UI', async ({ page }) => {
    // Initialize and create entries
    await page.click('#init-tree');
    await page.fill('#insert-key', '99');
    await page.click('#insert-btn');

    // Click clear-tree and accept the confirm dialog (handled by global dialog listener)
    await page.click('#clear-tree');

    // After clearing, the display should be back to '(no tree initialized)'
    const treeText = (await page.locator('#tree-display').textContent())?.trim();
    expect(treeText).toBe('(no tree initialized)');

    // Stats display should be cleared
    const stats = (await page.locator('#stats-display').textContent()) || '';
    expect(stats.trim()).toBe('');

    // Log should be cleared by clearTree()
    const logText = (await page.locator('#log').textContent()) || '';
    expect(logText.trim()).toBe('');
  });

  test('Step-By-Step Insert -> S7 and S8: start, step through inserts, finish and update global tree', async ({ page }) => {
    // Ensure degree valid
    await page.fill('#degree-input', '3');
    // Enter step keys and start session
    await page.fill('#step-keys', '11,12');
    await page.click('#step-start-btn');

    // After starting, Next and Reset should be enabled
    expect(await page.locator('#step-next-btn').isEnabled()).toBeTruthy();
    expect(await page.locator('#step-reset-btn').isEnabled()).toBeTruthy();

    // First step
    await page.click('#step-next-btn');
    let instr = (await page.locator('#step-instructions').textContent()) || '';
    expect(instr).toContain('Inserted 1 / 2 keys.');

    // Second step - completes the sequence
    await page.click('#step-next-btn');
    // Because stepNext logs an end message into the main log, wait and assert it
    const logText = await page.locator('#log').textContent();
    expect(logText).toMatch(/Step-by-step insert finished; tree updated\./);

    // After completion, the global tree-display should contain inserted keys
    const display = (await page.locator('#tree-display').textContent()) || '';
    expect(display).toContain('11');
    expect(display).toContain('12');

    // Next should now be disabled (end of session)
    // Note: after finish, disableStepInsertControls(true) is called in the code
    expect(await page.locator('#step-next-btn').isEnabled()).toBeFalsy();
  });

  test('Step Reset resets session and controls', async ({ page }) => {
    // Start a step session
    await page.fill('#step-keys', '50,51');
    await page.click('#step-start-btn');
    await page.click('#step-next-btn'); // do one step

    // Now reset
    await page.click('#step-reset-btn');

    const instructions = (await page.locator('#step-instructions').textContent()) || '';
    expect(instructions).toContain('Step-by-step insertion reset.');

    // Controls should be disabled
    expect(await page.locator('#step-next-btn').isEnabled()).toBeFalsy();
    expect(await page.locator('#step-reset-btn').isEnabled()).toBeFalsy();

    // tree-display should be back to '(no tree initialized)'
    const treeText = (await page.locator('#tree-display').textContent())?.trim();
    expect(treeText).toBe('(no tree initialized)');
  });

  test('DownloadJSON triggers a download when tree exists; otherwise alerts', async ({ page }) => {
    // Attempt download with no tree: should alert "Initialize the tree first."
    await page.click('#download-json');
    // dialogMessages contains the alert
    expect(dialogMessages.some(d => d.message.includes('Initialize the tree first.'))).toBeTruthy();

    dialogMessages = []; // reset

    // Now initialize and insert some data
    await page.click('#init-tree');
    await page.fill('#insert-key', '77');
    await page.click('#insert-btn');

    // Wait for the download event created by clicking the download button
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#download-json'),
    ]);
    // Validate a filename suggestion (btree.json)
    const suggested = download.suggestedFilename();
    expect(suggested).toMatch(/\.json$/);
  });

  test('LoadJSONTree: invalid JSON alerts; valid JSON loads and updates tree & stats', async ({ page }) => {
    // Initialize not required for loading; provide invalid JSON first
    await page.fill('#json-input', '{ invalid json }');
    // Ensure the load button becomes enabled by input event
    await page.waitForTimeout(50); // small wait for input listener to enable the button
    expect(await page.locator('#load-json-confirm-btn').isEnabled()).toBeTruthy();

    // Click load -> should alert about invalid JSON
    await page.click('#load-json-confirm-btn');
    // Assert an alert about invalid JSON was shown
    expect(dialogMessages.some(d => /Invalid JSON/.test(d.message))).toBeTruthy();

    dialogMessages = []; // reset

    // Create a valid B-Tree JSON structure that matches expected serialized shape
    const validJson = {
      t: 3,
      root: {
        t: 3,
        keys: [100],
        leaf: true,
        children: []
      }
    };
    await page.fill('#json-input', JSON.stringify(validJson, null, 2));
    // Wait briefly for enable
    await page.waitForTimeout(50);
    expect(await page.locator('#load-json-confirm-btn').isEnabled()).toBeTruthy();

    // Click confirm to load JSON
    await page.click('#load-json-confirm-btn');

    // The script logs "Loaded B-Tree from JSON input."
    const logText = await page.locator('#log').textContent();
    expect(logText).toMatch(/Loaded B-Tree from JSON input\./);

    // tree-display should display the loaded key "100"
    const display = (await page.locator('#tree-display').textContent()) || '';
    expect(display).toContain('100');

    // Stats display should be populated with Minimum degree and height information
    const stats = (await page.locator('#stats-display').textContent()) || '';
    expect(stats).toContain('Tree statistics:');
    expect(stats).toContain('Minimum degree (t): 3');
  });

  test('Edge cases: Insert/Search/Delete without initialization and invalid degree input produce alerts', async ({ page }) => {
    // Attempt insert without initialization -> alert "Initialize the B-Tree first."
    await page.fill('#insert-key', '5');
    await page.click('#insert-btn');
    expect(dialogMessages.some(d => d.message.includes('Initialize the B-Tree first.'))).toBeTruthy();

    // Attempt search without initialization -> alert
    await page.fill('#search-key', '5');
    await page.click('#search-btn');
    expect(dialogMessages.some(d => d.message.includes('Initialize the B-Tree first.'))).toBeTruthy();

    // Attempt delete without initialization -> alert
    await page.fill('#delete-key', '5');
    await page.click('#delete-btn');
    expect(dialogMessages.some(d => d.message.includes('Initialize the B-Tree first.'))).toBeTruthy();

    // Invalid degree input: set degree to 1 and try to initialize -> alert about degree
    dialogMessages = [];
    await page.fill('#degree-input', '1');
    await page.click('#init-tree');
    expect(dialogMessages.some(d => d.message.includes('Degree t must be an integer'))).toBeTruthy();
  });

  test('Clear Log button empties the log area', async ({ page }) => {
    // Initialize and do some operation to produce log entries
    await page.click('#init-tree');
    await page.fill('#insert-key', '200');
    await page.click('#insert-btn');

    // Ensure log has content
    let logText = (await page.locator('#log').textContent()) || '';
    expect(logText.trim().length).toBeGreaterThan(0);

    // Click clear log and assert empty
    await page.click('#clear-log-btn');
    logText = (await page.locator('#log').textContent()) || '';
    expect(logText.trim()).toBe('');
  });
});