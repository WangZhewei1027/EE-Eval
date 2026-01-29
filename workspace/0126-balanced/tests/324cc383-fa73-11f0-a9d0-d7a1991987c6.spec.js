import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324cc383-fa73-11f0-a9d0-d7a1991987c6.html';

test.describe('Binary Search Tree (Application ID: 324cc383-fa73-11f0-a9d0-d7a1991987c6) - FSM & UI tests', () => {
  // Shared collectors for console messages and page errors to validate runtime health
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and page errors emitted by the page
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // pageerror is typically an Error object
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
    // Ensure initial paint and any synchronous scripts have executed
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterEach(async ({}, testInfo) => {
    // On failure, output captured console messages and page errors to help debugging
    if (testInfo.status !== testInfo.expectedStatus) {
      // eslint-disable-next-line no-console
      console.log('--- Console Messages Captured ---');
      for (const m of consoleMessages) {
        // eslint-disable-next-line no-console
        console.log(m.type, m.text);
      }
      // eslint-disable-next-line no-console
      console.log('--- Page Errors Captured ---');
      for (const e of pageErrors) {
        // eslint-disable-next-line no-console
        console.log(e);
      }
    }
  });

  // Validate the Idle state (S0_Idle) initial UI and absence of runtime errors
  test('S0_Idle: Initial page load shows input and buttons and no runtime errors', async ({ page }) => {
    // Verify presence of expected components specified by the FSM
    await expect(page.locator('#value')).toBeVisible();
    await expect(page.locator('#insertBtn')).toBeVisible();
    await expect(page.locator('#clearBtn')).toBeVisible();
    await expect(page.locator('#bst')).toBeVisible();

    // The BST container should be empty initially (no .node elements)
    await expect(page.locator('#bst .node')).toHaveCount(0);

    // Verify there were no uncaught page errors
    // No SyntaxError / ReferenceError / TypeError should occur during load
    expect(pageErrors.length).toBe(0);

    // Verify console contains no error-level messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test insertion event and transition S0_Idle -> S1_TreeUpdated
  test('Insert event: inserting a single number updates the tree visual and transitions to TreeUpdated', async ({ page }) => {
    // Insert a root value 50
    await page.fill('#value', '50');
    await page.click('#insertBtn');

    // Input should be cleared by the page's JS after successful insert
    const inputValueAfter = await page.$eval('#value', el => el.value);
    expect(inputValueAfter).toBe('');

    // There should be at least one .node element rendered for the root
    const nodes = page.locator('#bst .node');
    await expect(nodes).toHaveCount(1);

    // The node's text content should be '50'
    await expect(nodes.first()).toHaveText('50');

    // Check that the node has absolute positional styles (visual placement)
    const computedStyle = await page.evaluate(() => {
      const node = document.querySelector('#bst .node');
      if (!node) return null;
      const s = window.getComputedStyle(node);
      return { position: s.position, left: s.left, top: s.top };
    });
    expect(computedStyle).not.toBeNull();
    expect(computedStyle.position).toBe('absolute');

    // Validate the underlying BST object was updated (root exists and has correct value)
    const rootValue = await page.evaluate(() => {
      // access the global bst defined by the page script
      return window.bst && window.bst.root ? window.bst.root.value : null;
    });
    expect(rootValue).toBe(50);

    // No runtime errors should have been thrown during the interaction
    expect(pageErrors.length).toBe(0);
    const consoleErrors1 = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test multiple inserts to validate left/right placement and increasing number of nodes
  test('Insert event: multiple inserts create left and right children and increase DOM nodes', async ({ page }) => {
    // Insert root 50
    await page.fill('#value', '50');
    await page.click('#insertBtn');
    // Insert left child 30
    await page.fill('#value', '30');
    await page.click('#insertBtn');
    // Insert right child 70
    await page.fill('#value', '70');
    await page.click('#insertBtn');

    // Wait for the nodes to render
    const nodes1 = page.locator('#bst .node');
    await expect(nodes).toHaveCount(3);

    // Verify values present somewhere in the rendered nodes
    const texts = await nodes.allTextContents();
    expect(texts).toContain('50');
    expect(texts).toContain('30');
    expect(texts).toContain('70');

    // Validate the bst object's structure reflects these inserts
    const structure = await page.evaluate(() => {
      if (!window.bst || !window.bst.root) return null;
      const root = window.bst.root;
      return {
        root: root.value,
        left: root.left ? root.left.value : null,
        right: root.right ? root.right.value : null
      };
    });
    expect(structure).toEqual({ root: 50, left: 30, right: 70 });

    // No runtime errors during these interactions
    expect(pageErrors.length).toBe(0);
    const consoleErrors2 = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test duplicates behavior and edge cases (non-number input)
  test('Edge cases: inserting duplicate values and invalid input', async ({ page }) => {
    // Ensure clean start by clicking Clear (if available)
    await page.click('#clearBtn');

    // Insert a value 10 twice - duplicates should be inserted to the right per implementation
    await page.fill('#value', '10');
    await page.click('#insertBtn');
    await page.fill('#value', '10');
    await page.click('#insertBtn');

    // There should be 2 nodes rendered
    await expect(page.locator('#bst .node')).toHaveCount(2);

    // Validate BST structure: root 10, root.right exists and equals 10
    const dupStructure = await page.evaluate(() => {
      if (!window.bst || !window.bst.root) return null;
      const root1 = window.bst.root1;
      return {
        root: root.value,
        right: root.right ? root.right.value : null
      };
    });
    expect(dupStructure).toEqual({ root: 10, right: 10 });

    // Now attempt to insert invalid input: setting an empty value and clicking Insert should do nothing
    // Clearing the input explicitly
    await page.fill('#value', '');
    await page.click('#insertBtn');

    // Node count should remain 2
    await expect(page.locator('#bst .node')).toHaveCount(2);

    // No runtime errors occurred due to invalid input handling
    expect(pageErrors.length).toBe(0);
    const consoleErrors3 = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test Clear event: S1_TreeUpdated -> S0_Idle transition and associated actions
  test('Clear event: clicking Clear empties the tree visual and resets bst.root', async ({ page }) => {
    // Insert multiple nodes
    await page.fill('#value', '40');
    await page.click('#insertBtn');
    await page.fill('#value', '20');
    await page.click('#insertBtn');
    await page.fill('#value', '60');
    await page.click('#insertBtn');

    // Ensure nodes exist
    await expect(page.locator('#bst .node')).toHaveCount(3);

    // Click Clear button to transition back to Idle
    await page.click('#clearBtn');

    // The visual container should be empty
    await expect(page.locator('#bst .node')).toHaveCount(0);

    // The underlying bst.root should be null
    const rootAfterClear = await page.evaluate(() => {
      return window.bst ? window.bst.root : 'no-bst-object';
    });
    expect(rootAfterClear).toBeNull();

    // No runtime errors occurred during clear
    expect(pageErrors.length).toBe(0);
    const consoleErrors4 = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Verify that expected onEnter/onExit actions (if any) are observable.
  // FSM mentioned an entry action renderPage() for Idle; the implementation doesn't define renderPage.
  // We validate that no ReferenceError occurred (i.e., the app did not attempt to call an undefined renderPage()).
  test('FSM entry/exit action verification: no unexpected ReferenceError for missing renderPage()', async ({ page }) => {
    // After load and previous interactions, ensure no ReferenceError or other errors happened
    const hasReferenceError = pageErrors.some(e => e && e.name === 'ReferenceError');
    const hasTypeError = pageErrors.some(e => e && e.name === 'TypeError');
    const hasSyntaxError = pageErrors.some(e => e && e.name === 'SyntaxError');

    // The implementation does not call a global renderPage(), so there should be no ReferenceError
    expect(hasReferenceError).toBe(false);
    expect(hasTypeError).toBe(false);
    expect(hasSyntaxError).toBe(false);

    // Also confirm console didn't log errors referencing renderPage
    const renderPageConsoleErrors = consoleMessages.filter(m => m.type === 'error' && m.text.includes('renderPage'));
    expect(renderPageConsoleErrors.length).toBe(0);
  });
});