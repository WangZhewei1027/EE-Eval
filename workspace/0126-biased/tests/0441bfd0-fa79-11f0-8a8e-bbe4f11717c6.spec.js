import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/0441bfd0-fa79-11f0-8a8e-bbe4f11717c6.html';

test.describe('Binary Search Tree interactive application (FSM validation)', () => {
  // We'll capture console messages and page errors that occur during page load and interactions.
  // Many of the application's scripts run on load, so listeners are attached before navigation.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // Defensive: in case msg.text() throws, still record basic info
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture page errors (unhandled exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page (this will run the inline script)
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Remove listeners to avoid leak between tests (Playwright re-creates page per test normally,
    // but we keep this defensive).
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test.describe('Idle state and initial render', () => {
    test('Initial load shows BST container, header and three visual nodes', async ({ page }) => {
      // Validate Idle state elements exist as evidence of S0_Idle
      const container = page.locator('.bst-container');
      await expect(container).toBeVisible();

      const header = container.locator('.bst-header');
      await expect(header).toHaveText('Binary Search Tree');

      const nodes = page.locator('.bst-node');
      await expect(nodes).toHaveCount(3);

      // Check node texts are present and in expected order
      await expect(nodes.nth(0).locator('.bst-node-text')).toHaveText('Node 1');
      await expect(nodes.nth(1).locator('.bst-node-text')).toHaveText('Node 2');
      await expect(nodes.nth(2).locator('.bst-node-text')).toHaveText('Node 3');

      // Check that delete buttons are rendered
      const buttons = page.locator('.bst-btn');
      await expect(buttons).toHaveCount(3);
      await expect(buttons.nth(0)).toHaveText('Delete Node 1');
      await expect(buttons.nth(1)).toHaveText('Delete Node 2');
      await expect(buttons.nth(2)).toHaveText('Delete Node 3');
    });

    test('Console logs expected messages during initial script execution', async () => {
      // The page's inline script logs before and after deleting Node 1.
      // Ensure those specific messages were emitted to console.
      const texts = consoleMessages.map((m) => m.text);

      // Validate that "Before deleting Node 1:" was logged
      expect(texts.some(t => t.includes('Before deleting Node 1:'))).toBeTruthy();

      // Validate that "After deleting Node 1:" was logged (it's logged before the failing print)
      expect(texts.some(t => t.includes('After deleting Node 1:'))).toBeTruthy();

      // Validate that some numeric values (tree print) were logged before deletion.
      // We expect to see at least one of the node values printed (e.g., "2", "3", "4", "5", "6", "7", "8").
      const numericLogged = ['2','3','4','5','6','7','8'].some(num => texts.some(t => t === num || t.includes(` ${num} `) || t === ` ${num}` || t.includes(num)));
      expect(numericLogged).toBeTruthy();
    });

    test('Page emitted a runtime error during/after delete due to implementation bug', async () => {
      // The inline script calls deleteNode(5) which, due to missing returns in _deleteRecursive,
      // causes this.root to become undefined and later printTree() to throw a TypeError.
      // Assert that at least one pageerror was captured and it's a TypeError.
      expect(pageErrors.length).toBeGreaterThan(0);
      // It's possible multiple errors are captured; ensure at least one is a TypeError or mentions 'undefined'.
      const hasTypeError = pageErrors.some(e => e && (e.name === 'TypeError' || (e.message && (e.message.includes('undefined') || e.message.includes('reading')))));
      expect(hasTypeError).toBeTruthy();
    });
  });

  test.describe('FSM transitions via UI buttons (events)', () => {
    test('Clicking Delete Node 1 button does not change DOM nodes (no handler attached) and does not trigger additional page errors', async ({ page }) => {
      // Snapshot error count after initial load
      const initialErrorCount = pageErrors.length;

      // Verify pre-click: no .disabled class on DOM nodes (evidence expected by FSM not present in DOM)
      const nodes = page.locator('.bst-node');
      const nodeCount = await nodes.count();
      for (let i = 0; i < nodeCount; i++) {
        await expect(nodes.nth(i)).not.toHaveClass(/disabled/);
      }

      // Click the first delete button (intent: Delete Node 1)
      await page.locator('.bst-btn').nth(0).click();

      // After click: still no DOM node has .disabled class because there are no event handlers bound
      for (let i = 0; i < nodeCount; i++) {
        await expect(nodes.nth(i)).not.toHaveClass(/disabled/);
      }

      // Ensure no new pageerror was produced by this click
      expect(pageErrors.length).toBe(initialErrorCount);
    });

    test('