import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e93214e0-d360-11f0-a097-ffdd56c22ef4.html';

test.describe('Linked List Visualizer — e93214e0-d360-11f0-a097-ffdd56c22ef4', () => {
  // Collect console and page errors for each test run
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Observe console messages and page errors (do not modify page)
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.stack || String(err));
    });

    // Navigate to the application page and wait for it to initialize
    await page.goto(APP_URL, { waitUntil: 'networkidle' });

    // Wait for initial render to log 'Ready.' since the app calls render({message:'Ready.'})
    const logTop = page.locator('#log div').first();
    await expect(logTop).toContainText('Ready.', { timeout: 3000 });
  });

  test.afterEach(async () => {
    // Assert that no unexpected page errors or console errors occurred during the test.
    // The application is expected to run without uncaught exceptions in normal operation.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.join('\n')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console errors: ${consoleErrors.join('\n')}`).toBe(0);
  });

  // Helper to read node texts in order (left-to-right)
  async function getNodeTexts(page) {
    const nodes = page.locator('#listContainer .node');
    const count = await nodes.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await nodes.nth(i).textContent()).trim());
    }
    return texts;
  }

  test.describe('Initial State (S0_Ready)', () => {
    test('renders sample list and logs Ready on initialization', async ({ page }) => {
      // Validate length chip shows 5 (sample list A..E was loaded at init)
      const lengthChip = page.locator('#lengthChip');
      await expect(lengthChip).toHaveText('5');

      // Validate the list nodes render A..E in order
      const texts = await getNodeTexts(page);
      expect(texts).toEqual(['A', 'B', 'C', 'D', 'E']);

      // Validate top log message is Ready.
      const topLog = page.locator('#log div').first();
      await expect(topLog).toContainText('Ready.');
    });
  });

  test.describe('Basic Operations (transitions to S1_ListUpdated)', () => {
    test('Prepend: adds new head node and logs message', async ({ page }) => {
      // Place value and trigger prepend
      await page.fill('#valueInput', 'X');
      await page.click('#btnPrepend');

      // New node should appear at index 0 (leftmost)
      await expect(page.locator('#listContainer .node').first()).toHaveText('X');

      // Length should increment to 6
      await expect(page.locator('#lengthChip')).toHaveText('6');

      // Log should contain message about prepending
      await expect(page.locator('#log div').first()).toContainText('Prepended X at head.');
    });

    test('Append: adds new tail node and logs message', async ({ page }) => {
      await page.fill('#valueInput', 'Z');
      await page.click('#btnAppend');

      // Last node should be 'Z'
      const nodes = page.locator('#listContainer .node');
      const count = await nodes.count();
      await expect(nodes.nth(count - 1)).toHaveText('Z');

      // Length updated to 6
      await expect(page.locator('#lengthChip')).toHaveText('6');

      // Log contains append message
      await expect(page.locator('#log div').first()).toContainText('Appended Z at tail.');
    });

    test('InsertAt: inserts at given index (capped to valid range) and logs message', async ({ page }) => {
      // Insert 'M' at index 2
      await page.fill('#valueInput', 'M');
      await page.fill('#indexInput', '2');
      await page.click('#btnInsertAt');

      // Node at index 2 should be 'M'
      const nodes = page.locator('#listContainer .node');
      await expect(nodes.nth(2)).toHaveText('M');

      // Length increments
      await expect(page.locator('#lengthChip')).toHaveText('6');

      // Log contains inserted message
      await expect(page.locator('#log div').first()).toContainText('Inserted M at index 2.');
    });

    test('DeleteAt: deletes node at index and renders updated list', async ({ page }) => {
      // Delete index 1 (should remove 'B')
      await page.fill('#indexInput', '1');
      await page.click('#btnDeleteAt');

      // After deletion, length becomes 4
      await expect(page.locator('#lengthChip')).toHaveText('4');

      // Verify that the node sequence is A,C,D,E
      const texts = await getNodeTexts(page);
      expect(texts).toEqual(['A', 'C', 'D', 'E']);

      // Log should mention deletion
      await expect(page.locator('#log div').first()).toContainText('Updated list after deletion.');
    });

    test('DeleteValue: deletes by value if present, else logs not found', async ({ page }) => {
      // Delete existing value 'C'
      await page.fill('#valueInput', 'C');
      await page.click('#btnDeleteValue');

      await expect(page.locator('#lengthChip')).toHaveText('4');
      const textsAfterDelete = await getNodeTexts(page);
      expect(textsAfterDelete).toEqual(['A', 'B', 'D', 'E']);
      await expect(page.locator('#log div').first()).toContainText('Updated list after deletion.');

      // Attempt to delete non-existent value -> should log not found and not change length
      await page.fill('#valueInput', 'NOT_THERE');
      await page.click('#btnDeleteValue');
      await expect(page.locator('#log div').first()).toContainText('Value NOT_THERE not found.');
      await expect(page.locator('#lengthChip')).toHaveText('4');
    });

    test('Clear: clears the list and logs message', async ({ page }) => {
      await page.click('#btnClear');
      await expect(page.locator('#lengthChip')).toHaveText('0');

      // listContainer should have zero .node elements
      await expect(page.locator('#listContainer .node')).toHaveCount(0);

      await expect(page.locator('#log div').first()).toContainText('List cleared.');
    });

    test('RandomList: generates random list of default size 6', async ({ page }) => {
      await page.click('#btnRandom');

      // length should be 6
      await expect(page.locator('#lengthChip')).toHaveText('6');

      // Log contains generated message
      await expect(page.locator('#log div').first()).toContainText('Generated random list of 6 items.');
    });

    test('LoadSample: loads the sample list and logs message', async ({ page }) => {
      // First clear then load sample to make sure it loads
      await page.click('#btnClear');
      await page.click('#btnSample');

      await expect(page.locator('#lengthChip')).toHaveText('5');
      const texts = await getNodeTexts(page);
      expect(texts).toEqual(['A', 'B', 'C', 'D', 'E']);
      await expect(page.locator('#log div').first()).toContainText('Loaded sample list A→B→C→D→E.');
    });
  });

  test.describe('Search and Reverse (generators) including Step Mode and Next Step', () => {
    test('Search (auto mode): finds an existing value and highlights node', async ({ page }) => {
      // Ensure auto mode (stepToggle unchecked)
      const stepChecked = await page.locator('#stepToggle').isChecked();
      if (stepChecked) await page.click('#stepToggle');

      await page.fill('#valueInput', 'C');
      await page.click('#btnSearch');

      // Auto mode should ultimately mark the found node with class "found"
      await expect(page.locator('#listContainer .node.found')).toHaveCount(1);
      await expect(page.locator('#listContainer .node.found')).toHaveText('C');

      // Log includes found message
      await expect(page.locator('#log div').first()).toContainText('Found C at index');
    });

    test('Search (step mode) + Next Step: steps through until found and then finishes', async ({ page }) => {
      // Enable step mode
      const stepToggle = page.locator('#stepToggle');
      if (!(await stepToggle.isChecked())) await stepToggle.click();

      // Start searching for 'E' — this will perform only the first step and leave generator active
      await page.fill('#valueInput', 'E');
      await page.click('#btnSearch');

      // First step should log a checking message for index 0
      await expect(page.locator('#log div').first()).toContainText('Checking index');

      // Press Next repeatedly until the found message appears
      const btnNext = page.locator('#btnNext');
      let attempts = 0;
      let found = false;
      while (attempts < 10 && !found) {
        await btnNext.click();
        // small wait to allow UI to update
        await page.waitForTimeout(120);
        const topText = await page.locator('#log div').first().textContent();
        if (topText.includes('Found E at index')) found = true;
        attempts++;
      }
      expect(found).toBeTruthy();

      // Ensure a node has 'found' class with text E
      await expect(page.locator('#listContainer .node.found')).toHaveText('E');

      // Finally, pressing Next when nothing to step should log 'Operation finished.' or equivalent final message
      await btnNext.click();
      await page.waitForTimeout(80);
      await expect(page.locator('#log div').first()).toContainText('Operation finished.');
    });

    test('Reverse (auto mode): reverses list order', async ({ page }) => {
      // Ensure auto mode
      if (await page.locator('#stepToggle').isChecked()) await page.click('#stepToggle');

      // Speed up automatic animation
      await page.fill('#speedRange', '100');
      await page.evaluate(() => { document.getElementById('speedLabel').textContent = document.getElementById('speedRange').value + 'ms'; });

      // Click reverse
      await page.click('#btnReverse');

      // Wait for final log message 'List reversed.' (rendered after algorithm)
      await page.waitForFunction(() => {
        const top = document.querySelector('#log div');
        return top && top.textContent.includes('List reversed.');
      }, { timeout: 3000 });

      // Confirm list is reversed (E becomes first)
      const texts = await getNodeTexts(page);
      expect(texts[0]).toBe('E');
      expect(texts).toEqual(['E', 'D', 'C', 'B', 'A']);
    }, { timeout: 10000 });

    test('Reverse (step mode) + Next Step: completes reversal across steps', async ({ page }) => {
      // Ensure step mode on
      const stepToggle = page.locator('#stepToggle');
      if (!(await stepToggle.isChecked())) await stepToggle.click();

      // Speed label set low for clarity, though step mode is manual
      await page.fill('#speedRange', '100');
      await page.evaluate(() => { document.getElementById('speedLabel').textContent = document.getElementById('speedRange').value + 'ms'; });

      // Start reverse — first step will render a partial combined view
      await page.click('#btnReverse');

      // Perform Next until the reversal finishes. There are 5 items -> up to 5 steps.
      const btnNext = page.locator('#btnNext');
      for (let i = 0; i < 6; i++) {
        await btnNext.click();
        // small wait for UI and logs to update
        await page.waitForTimeout(120);
      }

      // After completion, list should be reversed
      const texts = await getNodeTexts(page);
      expect(texts).toEqual(['E', 'D', 'C', 'B', 'A']);
      await expect(page.locator('#log div').first()).toContainText('Operation finished.');
    }, { timeout: 10000 });
  });

  test.describe('Edge cases and error scenarios (validate user feedback)', () => {
    test('Prepend with empty value: logs provide guidance and does not change list', async ({ page }) => {
      // Ensure value input is empty
      await page.fill('#valueInput', '');
      await page.click('#btnPrepend');

      // Top log should instruct to provide a value
      await expect(page.locator('#log div').first()).toContainText('Provide a value to prepend.');

      // Length should remain 5
      await expect(page.locator('#lengthChip')).toHaveText('5');
    });

    test('InsertAt with invalid index: logs error and does not mutate list', async ({ page }) => {
      await page.fill('#valueInput', 'X');
      await page.fill('#indexInput', '-5');
      await page.click('#btnInsertAt');

      await expect(page.locator('#log div').first()).toContainText('Provide a valid index');
      await expect(page.locator('#lengthChip')).toHaveText('5');
    });

    test('DeleteAt out of bounds: logs Index out of bounds and leaves list unchanged', async ({ page }) => {
      // Provide out-of-bounds index
      await page.fill('#indexInput', '99');
      await page.click('#btnDeleteAt');

      await expect(page.locator('#log div').first()).toContainText('Index out of bounds.');
      await expect(page.locator('#lengthChip')).toHaveText('5');
    });

    test('Search with empty input: logs guidance', async ({ page }) => {
      await page.fill('#valueInput', '');
      await page.click('#btnSearch');
      await expect(page.locator('#log div').first()).toContainText('Provide a value to search.');
    });

    test('DeleteValue with empty input: logs guidance', async ({ page }) => {
      await page.fill('#valueInput', '');
      await page.click('#btnDeleteValue');
      await expect(page.locator('#log div').first()).toContainText('Provide a value to delete.');
    });

    test('Reverse on very short list logs appropriate message', async ({ page }) => {
      // Clear and append one item so length <= 1
      await page.click('#btnClear');
      await page.fill('#valueInput', 'Solo');
      await page.click('#btnAppend');

      // Now length is 1; reverse should log 'List too short to reverse.'
      await page.click('#btnReverse');
      await expect(page.locator('#log div').first()).toContainText('List too short to reverse.');
    });
  });

  test.describe('FSM transition NextStep behavior (S1_ListUpdated -> S0_Ready)', () => {
    test('Next Step resumes a paused generator and completes the operation', async ({ page }) => {
      // Enable step mode and start search to create a pausable generator
      const stepToggle = page.locator('#stepToggle');
      if (!(await stepToggle.isChecked())) await stepToggle.click();

      await page.fill('#valueInput', 'D');
      await page.click('#btnSearch');

      // First step executed; now resume via Next Step until finish
      const btnNext = page.locator('#btnNext');

      // Click Next multiple times to ensure completion
      for (let i = 0; i < 6; i++) {
        await btnNext.click();
        await page.waitForTimeout(120);
      }

      // After completion, top log should indicate finished / found message
      const topLogText = await page.locator('#log div').first().textContent();
      expect(topLogText).toMatch(/Found D at index|Operation finished/);
    });
  });
});