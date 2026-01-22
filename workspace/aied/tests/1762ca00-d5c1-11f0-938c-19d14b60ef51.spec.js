import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/1762ca00-d5c1-11f0-938c-19d14b60ef51.html';

test.describe('BST Visualization - FSM driven end-to-end tests', () => {
  // Attach console and page error listeners per-test and expose them via test.info().annotations if needed.
  test.beforeEach(async ({ page }) => {
    // Arrays to collect console messages and page errors for assertions
    page._consoleMessages = [];
    page._pageErrors = [];

    page.on('console', msg => {
      page._consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      page._pageErrors.push(err);
    });

    // Navigate to the app page exactly as-is
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Basic sanity checks after each test: no uncaught page errors and no console.error messages.
    const pageErrors = page._pageErrors || [];
    const consoleErrorMessages = (page._consoleMessages || []).filter(m => m.type === 'error');

    // Report if there were any page errors or console.errors
    expect(pageErrors.length, `Expected no page errors, but found: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
    expect(consoleErrorMessages.length, `Expected no console.error messages, but found: ${consoleErrorMessages.map(m => m.text).join(' | ')}`).toBe(0);
  });

  test.describe('S0_Idle - Initial UI and controls', () => {
    test('renders input, add button, clear button and empty tree (Idle state)', async ({ page }) => {
      // Validate presence of input and buttons and that the BST container exists and is empty.
      const input = page.locator('#inputValue');
      const addButton = page.locator('#addButton');
      const clearButton = page.locator('#clearButton');
      const bstree = page.locator('#bstree');

      await expect(input).toBeVisible();
      await expect(addButton).toBeVisible();
      await expect(clearButton).toBeVisible();
      await expect(bstree).toBeVisible();

      // Initially the tree should be empty (Idle state: bstree.innerHTML == '')
      await expect(bstree).toHaveText('', { timeout: 500 }).catch(async () => {
        // Some browsers may expose whitespace; verify innerHTML is empty via evaluate if text check fails
        const innerHTML = await page.evaluate(() => document.getElementById('bstree').innerHTML);
        expect(innerHTML).toBe('', 'Expected #bstree to be empty on initial load (Idle state).');
      });
    });
  });

  test.describe('AddToBST transitions and TreePopulated (S1)', () => {
    test('adding a single number updates the tree and clears the input (S0 -> S1)', async ({ page }) => {
      // Comments: This test validates the transition from Idle to TreePopulated by adding a single number.
      const input = page.locator('#inputValue');
      const addButton = page.locator('#addButton');
      const bstree = page.locator('#bstree');

      // Enter number and click Add
      await input.fill('10');
      await addButton.click();

      // Expect the tree container to contain a node with '10'
      await expect(bstree).toContainText('10');

      // Expect the input to be cleared after insertion
      const valueAfter = await page.evaluate(() => document.getElementById('inputValue').value);
      expect(valueAfter).toBe('', 'Expected input to be cleared after adding a number.');

      // Expect at least one node element in the rendered tree
      const nodeCount = await page.locator('#bstree .node').count();
      expect(nodeCount).toBeGreaterThan(0);
    });

    test('adding multiple numbers keeps tree populated and shows all values (S1 -> S1)', async ({ page }) => {
      // Comments: This test validates repeated AddToBST events while in the populated state.
      const input = page.locator('#inputValue');
      const addButton = page.locator('#addButton');
      const bstree = page.locator('#bstree');

      // Add root
      await input.fill('20');
      await addButton.click();

      // Add left child
      await input.fill('10');
      await addButton.click();

      // Add right child
      await input.fill('30');
      await addButton.click();

      // The tree should contain all inserted values
      await expect(bstree).toContainText('20');
      await expect(bstree).toContainText('10');
      await expect(bstree).toContainText('30');

      // There should be three node elements rendered
      const nodeCount = await page.locator('#bstree .node').count();
      expect(nodeCount).toBe(3);
    });
  });

  test.describe('ClearTree transition and TreeCleared (S2)', () => {
    test('clearing the tree empties the visualization (S1 -> S2)', async ({ page }) => {
      // Comments: This test validates the ClearTree event empties the tree.
      const input = page.locator('#inputValue');
      const addButton = page.locator('#addButton');
      const clearButton = page.locator('#clearButton');
      const bstree = page.locator('#bstree');

      // Setup: populate tree with a couple of nodes
      await input.fill('5');
      await addButton.click();
      await input.fill('3');
      await addButton.click();

      // Ensure tree is populated
      await expect(bstree).toContainText('5');
      await expect(bstree).toContainText('3');

      // Click clear
      await clearButton.click();

      // The tree should now be empty (innerHTML == '')
      const innerHTML = await page.evaluate(() => document.getElementById('bstree').innerHTML);
      expect(innerHTML).toBe('', 'Expected bstree.innerHTML to be empty after clearing the tree.');

      // No node elements should be present
      const nodeCount = await page.locator('#bstree .node').count();
      expect(nodeCount).toBe(0);
    });

    test('adding after clear transitions back to populated (S2 -> S0 -> S1)', async ({ page }) => {
      // Comments: This test validates that after clearing, adding a number repopulates the tree.
      const input = page.locator('#inputValue');
      const addButton = page.locator('#addButton');
      const clearButton = page.locator('#clearButton');
      const bstree = page.locator('#bstree');

      // Add a node then clear
      await input.fill('42');
      await addButton.click();
      await expect(bstree).toContainText('42');

      await clearButton.click();
      let innerHTML = await page.evaluate(() => document.getElementById('bstree').innerHTML);
      expect(innerHTML).toBe('', 'Expected bstree to be empty after clear.');

      // Add another node after clear
      await input.fill('7');
      await addButton.click();

      // Tree should show the new node
      await expect(bstree).toContainText('7');
      const nodeCount = await page.locator('#bstree .node').count();
      expect(nodeCount).toBeGreaterThan(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('non-numeric input triggers alert and does not modify tree', async ({ page }) => {
      // Comments: Validates handling of invalid input: shows alert and leaves tree unchanged.
      const input = page.locator('#inputValue');
      const addButton = page.locator('#addButton');
      const bstree = page.locator('#bstree');

      // Ensure tree is initially empty
      let initialInner = await page.evaluate(() => document.getElementById('bstree').innerHTML);
      expect(initialInner).toBe('');

      // Listen for dialog (alert)
      let dialogSeen = false;
      page.on('dialog', async dialog => {
        dialogSeen = true;
        // Assert the alert message matches expected prompt
        expect(dialog.message()).toContain('Please enter a valid number');
        await dialog.accept();
      });

      // Fill invalid value (type=number input will still accept the string via JS)
      await input.fill('not-a-number');
      await addButton.click();

      // Confirm dialog was shown
      expect(dialogSeen).toBe(true);

      // Tree should remain unchanged
      const innerAfter = await page.evaluate(() => document.getElementById('bstree').innerHTML);
      expect(innerAfter).toBe('', 'Expected bstree to remain empty after invalid input.');
    });

    test('clicking add with empty input triggers alert and does not add node', async ({ page }) => {
      // Comments: Clicking add without providing a value should trigger the same validation.
      const addButton = page.locator('#addButton');
      const bstree = page.locator('#bstree');

      let dialogSeen = false;
      page.on('dialog', async dialog => {
        dialogSeen = true;
        expect(dialog.message()).toContain('Please enter a valid number');
        await dialog.accept();
      });

      // Ensure input is empty
      await page.fill('#inputValue', '');

      // Click add with empty input
      await addButton.click();

      // Expect an alert and no tree nodes added
      expect(dialogSeen).toBe(true);
      const innerAfter = await page.evaluate(() => document.getElementById('bstree').innerHTML);
      expect(innerAfter).toBe('', 'Expected bstree to remain empty when adding with empty input.');
    });
  });

  test.describe('Observability: console logs and page errors are monitored', () => {
    test('no console.error or page errors during typical flows', async ({ page }) => {
      // Comments: This test runs a small sequence of actions and asserts no runtime errors are logged.
      const input = page.locator('#inputValue');
      const addButton = page.locator('#addButton');
      const clearButton = page.locator('#clearButton');

      // Perform a few interactions
      await input.fill('1');
      await addButton.click();
      await input.fill('2');
      await addButton.click();
      await clearButton.click();

      // Give a tick for any async errors to surface
      await page.waitForTimeout(100);

      // The afterEach will assert that there are no page errors or console.error messages.
      // Here we perform a local assertion too for clearer test failure messages.
      const pageErrors = page._pageErrors || [];
      const consoleErrorMessages = (page._consoleMessages || []).filter(m => m.type === 'error');

      expect(pageErrors.length, `Expected no page errors, but found: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
      expect(consoleErrorMessages.length, `Expected no console.error messages, but found: ${consoleErrorMessages.map(m => m.text).join(' | ')}`).toBe(0);
    });
  });
});