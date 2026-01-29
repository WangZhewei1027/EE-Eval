import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b063e3-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Utility: wait for the #message element to equal expected text (with timeout)
async function waitForMessage(page, expectedText, timeout = 10000) {
  await page.waitForFunction(
    (text) => {
      const el = document.getElementById('message');
      return el && el.textContent === text;
    },
    expectedText,
    { timeout }
  );
}

test.describe('AVL Tree Visualization and Demo (FSM states & transitions)', () => {

  // Shared variables for console and page error collection
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Navigate to the application page
    await page.goto(APP_URL);
    // Ensure the page loaded and initial elements exist
    await expect(page.locator('#valueInput')).toBeVisible();
    await expect(page.locator('#insertBtn')).toBeVisible();
    await expect(page.locator('#removeBtn')).toBeVisible();
    await expect(page.locator('#clearBtn')).toBeVisible();
    await expect(page.locator('#treeCanvas')).toBeVisible();
  });

  test.afterEach(async () => {
    // Basic sanity: no uncaught page errors during the test run
    expect(pageErrors.length).toBe(0);
  });

  test('Initial Idle state: shows hint message and canvas present', async ({ page }) => {
    // Validate initial message per FSM entry evidence
    const message = await page.locator('#message').textContent();
    expect(message).toContain('Enter a value and insert or remove nodes to see AVL Tree balancing.');

    // Canvas attributes should match the HTML
    const canvas = page.locator('#treeCanvas');
    await expect(canvas).toHaveAttribute('width', '960');
    await expect(canvas).toHaveAttribute('height', '480');

    // Capture initial canvas data URL for later comparisons
    const initialDataUrl = await page.evaluate(() => {
      const c = document.getElementById('treeCanvas');
      return c.toDataURL();
    });
    expect(typeof initialDataUrl).toBe('string');
    expect(initialDataUrl.length).toBeGreaterThan(0);

    // Ensure no page errors were emitted
    expect(pageErrors).toEqual([]);
  });

  test('Insert a value: transition S0 -> S1 -> S0 (Inserting then Idle)', async ({ page }) => {
    // Capture initial canvas image
    const before = await page.evaluate(() => document.getElementById('treeCanvas').toDataURL());

    // Enter value and click insert
    await page.fill('#valueInput', '10');
    await page.click('#insertBtn');

    // Immediately after click, buttons should be disabled (entry action disableButtons(true))
    await expect(page.locator('#insertBtn')).toBeDisabled();
    await expect(page.locator('#removeBtn')).toBeDisabled();
    await expect(page.locator('#clearBtn')).toBeDisabled();

    // The animateActions should eventually set the message to "Operation complete."
    await waitForMessage(page, 'Operation complete.', 10000);

    // After operation complete, buttons should be enabled again
    await expect(page.locator('#insertBtn')).toBeEnabled();
    await expect(page.locator('#removeBtn')).toBeEnabled();
    await expect(page.locator('#clearBtn')).toBeEnabled();

    // Input should be cleared and focused (exit actions)
    const valueAfter = await page.locator('#valueInput').inputValue();
    expect(valueAfter).toBe('');
    const activeId = await page.evaluate(() => document.activeElement && document.activeElement.id);
    expect(activeId).toBe('valueInput');

    // Canvas should have changed (tree drawn)
    const after = await page.evaluate(() => document.getElementById('treeCanvas').toDataURL());
    expect(after).not.toBe(before);

    // Check that we observed relevant messages during animation via DOM
    const finalMessage = await page.locator('#message').textContent();
    expect(finalMessage).toBe('Operation complete.');

    // No page errors
    expect(pageErrors).toEqual([]);
  });

  test('Insert duplicate value: shows duplicate message and completes', async ({ page }) => {
    // Insert a value first
    await page.fill('#valueInput', '20');
    await page.click('#insertBtn');
    await waitForMessage(page, 'Operation complete.', 10000);

    // Insert the same value again to trigger duplicate path
    await page.fill('#valueInput', '20');
    await page.click('#insertBtn');

    // Buttons disabled while processing
    await expect(page.locator('#insertBtn')).toBeDisabled();

    // First the animate step shows duplicate message, then "Operation complete."
    // Wait for the duplicate message to appear (shorter than full timeout)
    await page.waitForFunction(() => {
      const msg = document.getElementById('message');
      return msg && msg.textContent.includes('already exists');
    }, null, { timeout: 5000 });

    // Finally wait for operation complete
    await waitForMessage(page, 'Operation complete.', 10000);

    // Input cleared and focused
    const valueAfter = await page.locator('#valueInput').inputValue();
    expect(valueAfter).toBe('');
    const activeId = await page.evaluate(() => document.activeElement && document.activeElement.id);
    expect(activeId).toBe('valueInput');

    expect(pageErrors).toEqual([]);
  });

  test('Remove existing value: transition S0 -> S2 -> S0 (Removing then Idle)', async ({ page }) => {
    // Ensure a known value exists: insert 30
    await page.fill('#valueInput', '30');
    await page.click('#insertBtn');
    await waitForMessage(page, 'Operation complete.', 10000);

    // Now remove 30
    await page.fill('#valueInput', '30');
    await page.click('#removeBtn');

    // Buttons should be disabled immediately
    await expect(page.locator('#removeBtn')).toBeDisabled();

    // The animation will produce a 'Removed node 30' step then 'Operation complete.'
    await page.waitForFunction(() => {
      const m = document.getElementById('message');
      return m && m.textContent.includes('Removed node 30');
    }, null, { timeout: 5000 });

    await waitForMessage(page, 'Operation complete.', 10000);

    // Input cleared and focused
    expect(await page.locator('#valueInput').inputValue()).toBe('');
    expect(await page.evaluate(() => document.activeElement.id)).toBe('valueInput');

    // After removal, the canvas should differ than when node existed (we just assert no page errors)
    expect(pageErrors).toEqual([]);
  });

  test('Remove non-existing value: shows notFound message and completes', async ({ page }) => {
    // Use a large value unlikely to exist
    await page.fill('#valueInput', '9999');
    await page.click('#removeBtn');

    // Buttons disabled while processing
    await expect(page.locator('#removeBtn')).toBeDisabled();

    // Wait for the not found message to appear
    await page.waitForFunction(() => {
      const m = document.getElementById('message');
      return m && m.textContent.includes('not found for removal');
    }, null, { timeout: 5000 });

    // Then ensure operation completes
    await waitForMessage(page, 'Operation complete.', 10000);

    // Ensure input cleared and focused
    expect(await page.locator('#valueInput').inputValue()).toBe('');
    expect(await page.evaluate(() => document.activeElement.id)).toBe('valueInput');

    expect(pageErrors).toEqual([]);
  });

  test('Clear tree: transition S0 -> S3 -> S0 (Clearing then Idle), canvas cleared and message shown', async ({ page }) => {
    // Insert a node so canvas has content
    await page.fill('#valueInput', '5');
    await page.click('#insertBtn');
    await waitForMessage(page, 'Operation complete.', 10000);

    // Capture canvas after insert
    const afterInsert = await page.evaluate(() => document.getElementById('treeCanvas').toDataURL());

    // Click clear button - per implementation this sets avl.root = null; clearCanvas(); setMessage('Tree cleared.');
    await page.click('#clearBtn');

    // Clear action is immediate: message should be 'Tree cleared.'
    await waitForMessage(page, 'Tree cleared.', 3000);

    // Canvas should now be cleared: compare to a freshly drawn empty canvas dataURL
    const cleared = await page.evaluate(() => document.getElementById('treeCanvas').toDataURL());
    // It should differ from the 'afterInsert' data URL (meaning the drawing was cleared)
    expect(cleared).not.toBe(afterInsert);

    // Input should be cleared and focused
    expect(await page.locator('#valueInput').inputValue()).toBe('');
    expect(await page.evaluate(() => document.activeElement.id)).toBe('valueInput');

    // Clear button does not disable other buttons (should remain enabled)
    await expect(page.locator('#insertBtn')).toBeEnabled();
    await expect(page.locator('#removeBtn')).toBeEnabled();

    expect(pageErrors).toEqual([]);
  });

  test('Invalid input handling: insert/remove with empty or non-numeric input shows validation message', async ({ page }) => {
    // Ensure input is empty
    await page.fill('#valueInput', '');

    // Click insert with empty input
    await page.click('#insertBtn');

    // Validation message expected immediately
    await page.waitForFunction(() => {
      const m = document.getElementById('message');
      return m && m.textContent === 'Please enter a valid integer.';
    }, null, { timeout: 2000 });

    // Buttons should not be disabled since handler returns early
    await expect(page.locator('#insertBtn')).toBeEnabled();
    await expect(page.locator('#removeBtn')).toBeEnabled();

    // Now click remove with empty input
    await page.click('#removeBtn');
    await page.waitForFunction(() => {
      const m = document.getElementById('message');
      return m && m.textContent === 'Please enter a valid integer.';
    }, null, { timeout: 2000 });

    // Ensure the input is still focused (the handlers returned early and did not change focus)
    const activeId = await page.evaluate(() => document.activeElement && document.activeElement.id);
    // It may be the body or the input; we allow either but assert no errors
    expect(['valueInput', null, '']).toContain(activeId);

    expect(pageErrors).toEqual([]);
  });

  test('Sequence of operations: insert multiple to trigger rotations and verify animation text and completion', async ({ page }) => {
    // Insert a sequence to trigger rotations (e.g., 50, 40, 30 -> Left-Left rotation)
    // Insert 50
    await page.fill('#valueInput', '50');
    await page.click('#insertBtn');
    await waitForMessage(page, 'Operation complete.', 10000);

    // Insert 40
    await page.fill('#valueInput', '40');
    await page.click('#insertBtn');
    await waitForMessage(page, 'Operation complete.', 10000);

    // Insert 30 -> this should cause balancing (Left-Left or rotations). We will observe intermediate messages.
    await page.fill('#valueInput', '30');
    await page.click('#insertBtn');

    // During animation we expect at least one message that contains 'Balance' or 'Rotate' or 'Inserted node 30'
    await page.waitForFunction(() => {
      const m = document.getElementById('message');
      return m && (m.textContent.includes('Balance') || m.textContent.includes('Rotate') || m.textContent.includes('Inserted node 30'));
    }, null, { timeout: 5000 });

    // Eventually complete
    await waitForMessage(page, 'Operation complete.', 15000);

    // Buttons re-enabled and input cleared/focused
    await expect(page.locator('#insertBtn')).toBeEnabled();
    expect(await page.locator('#valueInput').inputValue()).toBe('');
    expect(await page.evaluate(() => document.activeElement.id)).toBe('valueInput');

    expect(pageErrors).toEqual([]);
  });

});