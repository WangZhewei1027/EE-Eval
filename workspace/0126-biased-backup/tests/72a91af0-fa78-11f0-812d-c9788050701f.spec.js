import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72a91af0-fa78-11f0-812d-c9788050701f.html';

test.describe('Visual Binary Search Tree (FSM) - 72a91af0-fa78-11f0-812d-c9788050701f', () => {
  // Shared collectors for console and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Arrays to capture console error messages and page errors
    page.context()._testConsoleErrors = [];
    page.context()._testConsoleLogs = [];
    page.context()._testPageErrors = [];

    // Capture console events
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      // store all console messages for inspection
      page.context()._testConsoleLogs.push({ type, text });
      // specifically track console.error types
      if (type === 'error') {
        page.context()._testConsoleErrors.push(text);
      }
    });

    // Capture uncaught page errors (exceptions)
    page.on('pageerror', error => {
      page.context()._testPageErrors.push(String(error && error.message ? error.message : error));
    });

    // Navigate to the target application
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Wait for the tree container to be present and nodes to render
    await page.waitForSelector('#treeContainer');

    // Wait for at least one node to ensure renderTree ran
    await page.waitForSelector('.node', { timeout: 5000 });
  });

  test.afterEach(async ({ page }) => {
    // Attach any captured console/page errors to the test output for debugging
    const consoleErrors = page.context()._testConsoleErrors || [];
    const pageErrors = page.context()._testPageErrors || [];
    if (consoleErrors.length > 0) {
      // eslint-disable-next-line no-console
      console.warn('Captured console.error messages:', consoleErrors);
    }
    if (pageErrors.length > 0) {
      // eslint-disable-next-line no-console
      console.warn('Captured page errors:', pageErrors);
    }
  });

  test.describe('State S0_Idle - Initial render and invariants', () => {
    test('Idle: should render the full BST with expected node and edge counts and no highlights', async ({ page }) => {
      // Validate that the BST renders all nodes (expected 15 nodes from the provided bstData)
      const nodeLocator = page.locator('.node');
      await expect(nodeLocator).toHaveCount(15);

      // Validate number of edges is nodes - 1 = 14
      const edgeLocator = page.locator('.edge');
      await expect(edgeLocator).toHaveCount(14);

      // Ensure no node is highlighted or pulsing in the idle state
      const highlighted = page.locator('.node.highlight, .node.pulse');
      await expect(highlighted).toHaveCount(0);

      // Confirm animate and reset buttons are visible and enabled
      await expect(page.locator('#animateBtn')).toBeVisible();
      await expect(page.locator('#resetBtn')).toBeVisible();

      // Confirm there are no synchronous page errors captured immediately on load
      const consoleErrors = page.context()._testConsoleErrors;
      const pageErrors = page.context()._testPageErrors;
      expect(Array.isArray(consoleErrors)).toBeTruthy();
      expect(Array.isArray(pageErrors)).toBeTruthy();
      // We assert there were no immediate uncaught errors on load
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('State S1_Animating - Animate Search interactions', () => {
    test('Animate Search: clicking animate should highlight the root and animate search for value 50', async ({ page }) => {
      // Click the Animate Search button to trigger animateSearch(50)
      await page.click('#animateBtn');

      // The root node (50) should receive the highlight class shortly after clicking
      const rootNode = page.locator('.node', { hasText: '50' });
      await expect(rootNode).toHaveClass(/highlight/, { timeout: 2000 });

      // It should also have the 'pulse' animation class
      await expect(rootNode).toHaveClass(/pulse/, { timeout: 2000 });

      // Since the search target is the root (50), the animation finishes after a short delay (approx 1500ms).
      // Wait a little longer to allow the animation to complete and ensure no errors occurred.
      await page.waitForTimeout(2200);

      // After animation finishes, root should still have highlight/pulse
      await expect(rootNode).toHaveClass(/highlight/);
      await expect(rootNode).toHaveClass(/pulse/);

      // Confirm no uncaught page errors were thrown during animation
      const consoleErrors = page.context()._testConsoleErrors;
      const pageErrors = page.context()._testPageErrors;
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Edge case: clicking Reset during an in-progress animation should NOT remove highlights (animation blocks reset)', async ({ page }) => {
      // Start animation
      await page.click('#animateBtn');

      // Immediately (without waiting for animation to finish) click Reset
      await page.click('#resetBtn');

      // The root node should still be highlighted (reset is ignored while animationInProgress is true)
      const rootNode = page.locator('.node', { hasText: '50' });

      // Because the highlight is applied via setTimeout quickly, wait briefly for it to appear
      await expect(rootNode).toHaveClass(/highlight/, { timeout: 2000 });

      // Wait a short time and assert highlight remains (i.e., reset did not clear it during animation)
      await page.waitForTimeout(500);
      await expect(rootNode).toHaveClass(/highlight/);

      // Let the animation finish to avoid cross-test interference
      await page.waitForTimeout(1800);
    });
  });

  test.describe('State S2_Resetting - Reset behavior and transitions', () => {
    test('Reset from Idle: clicking Reset when idle should be a no-op (no highlights to clear) and not throw errors', async ({ page }) => {
      // Ensure no highlights initially
      await expect(page.locator('.node.highlight')).toHaveCount(0);

      // Click Reset while idle
      await page.click('#resetBtn');

      // Still no highlights and no errors
      await expect(page.locator('.node.highlight')).toHaveCount(0);
      const consoleErrors = page.context()._testConsoleErrors;
      const pageErrors = page.context()._testPageErrors;
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Reset after animation: clicking Reset after animation completes should remove highlight and pulse classes', async ({ page }) => {
      // Start animation and wait for it to complete
      await page.click('#animateBtn');

      // The root node will be highlighted; wait until it is present
      const rootNode = page.locator('.node', { hasText: '50' });
      await expect(rootNode).toHaveClass(/highlight/, { timeout: 2000 });

      // Allow animation to finish (animation sets animationInProgress = false after ~1500ms)
      await page.waitForTimeout(2200);

      // Now click Reset which should clear highlight/pulse classes
      await page.click('#resetBtn');

      // After reset, highlight and pulse classes should be removed on all nodes
      const highlightedAfterReset = page.locator('.node.highlight, .node.pulse');
      await expect(highlightedAfterReset).toHaveCount(0);

      // Confirm no page errors were thrown during reset
      const consoleErrors = page.context()._testConsoleErrors;
      const pageErrors = page.context()._testPageErrors;
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('FSM transition validations and invariants', () => {
    test('Validate FSM transitions: AnimateSearch (S0 -> S1), ResetTree (S1 -> S0 via post-animation reset), and ResetTree (S0 -> S2) behaviors observed in DOM', async ({ page }) => {
      // Start from idle - ensure no highlights
      await expect(page.locator('.node.highlight')).toHaveCount(0);

      // S0 -> S1 via AnimateSearch
      await page.click('#animateBtn');
      const rootNode = page.locator('.node', { hasText: '50' });
      await expect(rootNode).toHaveClass(/highlight/, { timeout: 2000 });

      // Attempt S1 -> S0 via ResetTree while animation is in progress:
      // According to the implementation, resetBtn click is ignored during animation.
      // We perform an immediate reset click and confirm the highlight remains (observed behavior).
      await page.click('#resetBtn');
      await expect(rootNode).toHaveClass(/highlight/, { timeout: 1000 });

      // Allow animation to finish -> now animationInProgress should be false
      await page.waitForTimeout(2200);

      // Now perform Reset (S0 <- S2 or S1 -> S0 after animation); should clear highlights
      await page.click('#resetBtn');
      await expect(page.locator('.node.highlight')).toHaveCount(0);

      // Final assertion: DOM reflects correct sequence of transitions (rendered nodes, edges, and class toggles)
      await expect(page.locator('.node')).toHaveCount(15);
      await expect(page.locator('.edge')).toHaveCount(14);
    });

    test('Edge cases: validate that clicking Animate multiple times while idle triggers only one animation sequence at a time', async ({ page }) => {
      // Click animate twice quickly
      await page.click('#animateBtn');
      await page.click('#animateBtn');

      // Root should be highlighted and animation should not cause duplicate side effects (still highlighted once)
      const highlighted = page.locator('.node.highlight');
      await expect(highlighted).toHaveCount(1);

      // Wait for animation to complete
      await page.waitForTimeout(2200);

      // Reset to clean up
      await page.click('#resetBtn');
      await expect(page.locator('.node.highlight')).toHaveCount(0);
    });
  });

  test.describe('Console and Error Observability', () => {
    test('Capture console and page errors throughout interactions and assert none of the critical JS error types occurred', async ({ page }) => {
      // Perform a series of interactions to maximize chance of errors if present
      await page.click('#animateBtn');
      await page.waitForTimeout(200);
      await page.click('#resetBtn'); // may be ignored during animation
      await page.waitForTimeout(2500);

      // Inspect captured console and page errors
      const consoleErrors = page.context()._testConsoleErrors || [];
      const pageErrors = page.context()._testPageErrors || [];

      // Log any errors captured for debugging information (printed in afterEach)
      // Assert that none of the captured errors are critical JS runtime errors of types ReferenceError, SyntaxError, or TypeError.
      // If such errors exist, fail the test and include the messages.
      const criticalErrorPatterns = [/ReferenceError/, /SyntaxError/, /TypeError/];

      const allErrors = [...consoleErrors, ...pageErrors];
      const criticalErrorsFound = allErrors.filter(msg => criticalErrorPatterns.some(rx => rx.test(msg)));

      // If critical errors are found, include them in a failing assertion with details
      expect(criticalErrorsFound.length, `Critical JS errors detected: ${criticalErrorsFound.join(' | ')}`).toBe(0);

      // Also assert that no uncaught page errors were recorded
      expect(pageErrors.length).toBe(0);
    });
  });
});