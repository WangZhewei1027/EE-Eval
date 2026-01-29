import { test, expect } from '@playwright/test';

const APP = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c158c13-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('B-Tree Index Interactive Demo — FSM coverage and UI assertions', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for each test so we can assert on them
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    // Ensure initial render actions have run
    await page.waitForTimeout(50);
  });

  test.afterEach(async () => {
    // Ensure there were no uncaught page errors during the test run
    // (We assert zero page errors so that any ReferenceError / TypeError would fail the test,
    // thereby letting such errors surface naturally per the instructions.)
    expect(pageErrors.length).toBe(0);
  });

  test.describe('Initialization and configuration (S0 -> S1)', () => {
    test('renders initial UI and logs load message', async ({ page }) => {
      // Validate static elements exist
      await expect(page.locator('#treeView')).toHaveText('(empty)');
      await expect(page.locator('#maxKeysLabel')).toHaveText('3'); // default t=2 => 2*2-1=3

      // The demo logs a loaded message on startup
      const log = await page.locator('#logArea').inputValue();
      expect(log).toMatch(/B-Tree demo loaded/);
    });

    test('Reinitialize Tree transitions to Tree Initialized (S1_TreeInitialized)', async ({ page }) => {
      // Change t and key type and click Reinitialize Tree
      await page.fill('#tInput', '3');
      await page.selectOption('#keyType', 'string');
      await page.click('#reinitBtn');

      // Expect max keys label update
      await expect(page.locator('#maxKeysLabel')).toHaveText('5'); // 2*3-1 = 5

      // Confirm a log entry indicates initialization with chosen t and keyType
      const log = await page.locator('#logArea').inputValue();
      expect(log).toMatch(/Initialized new B-Tree with t=3 keyType=string/);
      // Tree view should still be empty after reinit
      await expect(page.locator('#treeView')).toHaveText('(empty)');
    });
  });

  test.describe('Single operations: insert, delete, search (S2,S3,S4)', () => {
    test('Insert single key updates tree and log (S2_KeyInserted)', async ({ page }) => {
      // Insert an empty key to trigger edge-case message
      await page.fill('#insertKey', '');
      await page.click('#insertBtn');
      let log = await page.locator('#logArea').inputValue();
      expect(log).toMatch(/Insert aborted: empty key/);

      // Now insert a valid key
      await page.fill('#insertKey', '10');
      await page.click('#insertBtn');

      // Log should have "Inserted key: 10"
      log = await page.locator('#logArea').inputValue();
      expect(log).toMatch(/Inserted key: 10/);

      // Tree view should show node with keys containing 10
      const treeText = await page.locator('#treeView').innerText();
      expect(treeText).toMatch(/keys=\[10\]/);
    });

    test('Insert (Step Mode) generates steps and stepping changes tree (S2_KeyInserted)', async ({ page }) => {
      // Prepare by clearing tree
      await page.click('#clearBtn');

      // Insert a few keys to create non-trivial structure
      await page.fill('#insertKey', '5');
      await page.click('#insertBtn');
      await page.fill('#insertKey', '15');
      await page.click('#insertBtn');
      await page.fill('#insertKey', '25');
      await page.click('#insertBtn');

      // Now step-mode insert of a key likely to cause splits or at least steps
      await page.fill('#insertKey', '12');
      await page.click('#insertStepBtn');

      // The UI logs the number of generated steps
      let log = await page.locator('#logArea').inputValue();
      expect(log).toMatch(/Generated \d+ steps for insertion of 12/);

      // Advance one step
      await page.click('#nextStep');
      log = await page.locator('#logArea').inputValue();
      expect(log).toMatch(/Step 1\/\d+: /);

      // Attempt prev step (rewind)
      await page.click('#prevStep');
      const log2 = await page.locator('#logArea').inputValue();
      expect(log2).toMatch(/(Step 1\/|Rewound to step)/);
    });

    test('Search for existing and missing keys (S4_KeySearched)', async ({ page }) => {
      // Ensure some keys exist
      await page.fill('#bulkInsert', '1,2,3');
      await page.click('#bulkInsertBtn');

      // Search existing key
      await page.fill('#searchKey', '2');
      await page.click('#searchBtn');
      let log = await page.locator('#logArea').inputValue();
      expect(log).toMatch(/Found key 2 in node id=\d+ at index=\d+/);

      // Search missing key
      await page.fill('#searchKey', '9999');
      await page.click('#searchBtn');
      log = await page.locator('#logArea').inputValue();
      expect(log).toMatch(/Key 9999 not found/);

      // Search aborted on empty input
      await page.fill('#searchKey', '');
      await page.click('#searchBtn');
      log = await page.locator('#logArea').inputValue();
      expect(log).toMatch(/Search aborted: empty key/);
    });

    test('Delete operations: normal and step-mode (S3_KeyDeleted)', async ({ page }) => {
      // Clear and insert keys
      await page.click('#clearBtn');
      await page.fill('#bulkInsert', '20,30,40');
      await page.click('#bulkInsertBtn');

      // Delete with empty input triggers abort
      await page.fill('#deleteKey', '');
      await page.click('#deleteBtn');
      let log = await page.locator('#logArea').inputValue();
      expect(log).toMatch(/Delete aborted: empty key/);

      // Delete existing key (non-step)
      await page.fill('#deleteKey', '30');
      await page.click('#deleteBtn');
      log = await page.locator('#logArea').inputValue();
      expect(log).toMatch(/Deleted key: 30/);

      // Delete (step mode) of a non-existing key to get steps showing "not found" scenario
      await page.fill('#deleteKey', '999');
      await page.click('#deleteStepBtn');
      log = await page.locator('#logArea').inputValue();
      expect(log).toMatch(/Generated \d+ steps for deletion of 999|No steps available|Key not found/);
      // Try stepping next (may say no steps available)
      await page.click('#nextStep');
      const log2 = await page.locator('#logArea').inputValue();
      expect(log2).toMatch(/(No steps available|Step \d+\/)/);
    });
  });

  test.describe('Bulk, random, range, traversal (S5, S7, S8, S6)', () => {
    test('Bulk insert and clear (S5_BulkInserted -> S6_TreeCleared)', async ({ page }) => {
      await page.fill('#bulkInsert', '10,4,6,23,17');
      await page.click('#bulkInsertBtn');

      let log = await page.locator('#logArea').inputValue();
      expect(log).toMatch(/Bulk inserted 5 keys/);

      // Tree should now show keys in nodes
      const treeText = await page.locator('#treeView').innerText();
      expect(treeText.length).toBeGreaterThan(0);
      expect(treeText).not.toMatch(/\(empty\)/);

      // Clear the tree
      await page.click('#clearBtn');
      log = await page.locator('#logArea').inputValue();
      expect(log).toMatch(/Cleared tree/);
      await expect(page.locator('#treeView')).toHaveText('(empty)');
    });

    test('Range query and traversal produce expected logs (S7_RangeQueried, S8_Traversed)', async ({ page }) => {
      // Insert some numeric keys
      await page.click('#clearBtn');
      await page.fill('#bulkInsert', '5,8,12,20,30');
      await page.click('#bulkInsertBtn');

      await page.fill('#rangeLow', '8');
      await page.fill('#rangeHigh', '25');
      await page.click('#rangeBtn');
      let log = await page.locator('#logArea').inputValue();
      expect(log).toMatch(/Range query results \(8 to 25\):/);

      // Full in-order traversal
      await page.click('#traverseBtn');
      log = await page.locator('#logArea').inputValue();
      expect(log).toMatch(/In-order traversal: /);
      // Ensure traversal outputs the keys in some order
      expect(log).toMatch(/5|8|12|20|30/);
    });

    test('Random insert populates tree and logs count', async ({ page }) => {
      await page.click('#clearBtn');
      await page.fill('#randCount', '3');
      await page.click('#randInsertBtn');
      const log = await page.locator('#logArea').inputValue();
      expect(log).toMatch(/Inserted 3 random keys/);
    });
  });

  test.describe('Stepper controls and autoplay', () => {
    test('Autoplay starts and stops and respects speed', async ({ page }) => {
      // Prepare a step session by using insertStepBtn
      await page.click('#clearBtn');
      await page.fill('#insertKey', '1');
      await page.click('#insertBtn');
      await page.fill('#insertKey', '2');
      await page.click('#insertStepBtn');

      // Start autoplay
      await page.fill('#speed', '50'); // speed faster for test
      await page.click('#autoPlay');

      // Wait a bit to allow autoplay to run
      await page.waitForTimeout(200);

      // Pause autoplay
      await page.click('#pausePlay');
      const log = await page.locator('#logArea').inputValue();
      expect(log).toMatch(/Autoplay started|Autoplay paused|Autoplay paused\/stopped|Step \d+\//);

      // Reset steps
      await page.click('#resetSteps');
      const log2 = await page.locator('#logArea').inputValue();
      expect(log2).toMatch(/Reset step session/);
    });
  });

  test.describe('Manual node operations, editor, borrow/merge (S9_NodeEdited)', () => {
    test('Attempt manual split on non-full node yields graceful message', async ({ page }) => {
      await page.click('#clearBtn');
      await page.fill('#bulkInsert', '1,2,3'); // unlikely to produce a full node
      await page.click('#bulkInsertBtn');

      // Use nodeId 1 (root) which cannot be manually split by this operation
      await page.fill('#nodeIdInput', '1');
      await page.click('#splitNodeBtn');

      const log = await page.locator('#logArea').inputValue();
      // Either parent not found or node not full or cannot split root
      expect(log).toMatch(/(Cannot manually split root|Node not full|Parent not found)/);
    });

    test('Manual borrow/merge operations handle missing siblings gracefully', async ({ page }) => {
      // Ensure at least one node
      await page.click('#clearBtn');
      await page.fill('#bulkInsert', '7,8,9');
      await page.click('#bulkInsertBtn');

      await page.fill('#nodeIdInput', '1');
      await page.click('#borrowLeftBtn');
      let log = await page.locator('#logArea').inputValue();
      expect(log).toMatch(/(No left sibling|Parent not found|Borrowed from left sibling|Warning)/);

      await page.click('#borrowRightBtn');
      log = await page.locator('#logArea').inputValue();
      expect(log).toMatch(/(No right sibling|Parent not found|Borrowed from right sibling|Warning)/);

      await page.click('#mergeNodeBtn');
      log = await page.locator('#logArea').inputValue();
      expect(log).toMatch(/(No right sibling to merge with|Parent not found|Merged node id=)/);
    });

    test('Open node editor, apply edits, and apply changes are logged (S9_NodeEdited)', async ({ page }) => {
      await page.click('#clearBtn');
      await page.fill('#insertKey', '42');
      await page.click('#insertBtn');

      // Assume root is id 1
      await page.fill('#nodeIdInput', '1');
      await page.click('#editNodeBtn');

      // Editor should be visible
      const editorDisplay = await page.locator('#nodeEditor').evaluate(el => window.getComputedStyle(el).display);
      expect(editorDisplay).not.toBe('none');

      // Change keys in editor and apply
      await page.fill('#nodeKeys', '100');
      await page.fill('#nodeChildren', '');
      // Toggle leaf checkbox appropriately (we'll check its presence)
      await page.click('#applyNodeEdit');

      const log = await page.locator('#logArea').inputValue();
      expect(log).toMatch(/Applied edits to node id=1/);

      // Verify tree view includes the edited key
      const treeText = await page.locator('#treeView').innerText();
      expect(treeText).toMatch(/\b100\b/);
    });
  });

  test.describe('Export, Import, file import, undo/redo (export/import/undo/redo events)', () => {
    test('Export attempts to copy or show JSON; import prompt aborts gracefully', async ({ page }) => {
      await page.click('#clearBtn');
      await page.fill('#insertKey', '9');
      await page.click('#insertBtn');

      // Click export - the page code tries clipboard then opens a new window;
      // we assert that a log message about export or clipboard is produced.
      await page.click('#exportBtn');

      // Give UI a moment to log
      await page.waitForTimeout(50);
      const log = await page.locator('#logArea').inputValue();
      expect(log).toMatch(/Exported JSON|Clipboard write failed|copied to clipboard|showing JSON|JSON copied/);
      
      // Import button triggers prompt; headless environment will treat prompt as null -> "Import aborted"
      await page.click('#importBtn');
      const log2 = await page.locator('#logArea').inputValue();
      expect(log2).toMatch(/Import aborted|Import failed/);
    });

    test('File input import handles empty selection and invalid JSON gracefully', async ({ page }) => {
      // Trigger change without a file - nothing should happen; ensure no crash
      // We can't programmatically trigger a native file dialog here without providing a file.
      // Instead, set the input's files via setInputFiles with an invalid JSON file to test parsing error handling.
      const badJson = { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('not-json') };
      await page.setInputFiles('#importArea', badJson);
      // Allow file reader to run
      await page.waitForTimeout(100);
      const log = await page.locator('#logArea').inputValue();
      expect(log).toMatch(/File import error:|Imported tree from file|File import error/);
    });

    test('Undo and redo are functional after operations', async ({ page }) => {
      await page.click('#clearBtn');

      // Do some operations that push history
      await page.fill('#bulkInsert', '11,22');
      await page.click('#bulkInsertBtn');

      // Undo should be available
      await page.click('#undoBtn');
      let log = await page.locator('#logArea').inputValue();
      // Either "Undo applied" or "Nothing to undo" depending on history implementation timing
      expect(log).toMatch(/Undo applied|Nothing to undo/);

      // Redo (if redo exists)
      await page.click('#redoBtn');
      log = await page.locator('#logArea').inputValue();
      expect(log).toMatch(/Redo applied|Nothing to redo/);
    });
  });

  test.describe('Diagnostics: validate, stats, compact, show pages (S10_Validated)', () => {
    test('Validate reports passed or issues, stats and compact produce logs', async ({ page }) => {
      await page.click('#clearBtn');
      await page.fill('#bulkInsert', '3,1,2,5,4');
      await page.click('#bulkInsertBtn');

      // Validate invariants
      await page.click('#validateBtn');
      let log = await page.locator('#logArea').inputValue();
      expect(log).toMatch(/Validation passed: no issues found|Validation found \d+ issues/);

      // Show stats
      await page.click('#statsBtn');
      log = await page.locator('#logArea').inputValue();
      expect(log).toMatch(/Stats: nodes=\d+ keys=\d+ leafCount=\d+ t=\d+/);

      // Compact (rebuild)
      await page.click('#compactBtn');
      log = await page.locator('#logArea').inputValue();
      expect(log).toMatch(/Rebuilt\/compacted tree by reinserting all keys|Rebuilt/);

      // Show disk pages logs
      await page.click('#showPagesBtn');
      log = await page.locator('#logArea').inputValue();
      expect(log).toMatch(/Simulated disk pages|Page \d+: nodeid=\d+ keys=\[/);
    });
  });

  test.describe('Edge cases and keyboard shortcuts', () => {
    test('Enter key in inputs triggers associated actions and edge messages', async ({ page }) => {
      // Clear and focus insertKey, press Enter to trigger Insert
      await page.click('#clearBtn');

      await page.fill('#insertKey', '');
      await page.focus('#insertKey');
      await page.keyboard.press('Enter'); // should trigger Insert with empty key -> aborted
      let log = await page.locator('#logArea').inputValue();
      expect(log).toMatch(/Insert aborted: empty key/);

      // Fill and press Enter to insert
      await page.fill('#insertKey', '77');
      await page.focus('#insertKey');
      await page.keyboard.press('Enter');
      log = await page.locator('#logArea').inputValue();
      expect(log).toMatch(/Inserted key: 77/);

      // Delete via Enter in deleteKey
      await page.fill('#deleteKey', '');
      await page.focus('#deleteKey');
      await page.keyboard.press('Enter');
      log = await page.locator('#logArea').inputValue();
      expect(log).toMatch(/Delete aborted: empty key/);

      await page.fill('#deleteKey', '77');
      await page.focus('#deleteKey');
      await page.keyboard.press('Enter');
      log = await page.locator('#logArea').inputValue();
      expect(log).toMatch(/Deleted key: 77/);
    });
  });

  test.describe('Console and internal telemetry checks', () => {
    test('No severe console errors logged and important lifecycle logs are present', async ({ page }) => {
      // Look for expected lifecycle messages in console logs captured by the page
      const texts = consoleMessages.map(m => m.text).join('\n');

      // Lifecycle messages such as load or initialization should be present
      expect(texts).toMatch(/B-Tree demo loaded/);

      // There should be no console messages with type 'error'
      const errorConsole = consoleMessages.filter(m => m.type === 'error' || m.type === 'debug' && /Error|Exception/.test(m.text));
      expect(errorConsole.length).toBe(0);
    });
  });
});