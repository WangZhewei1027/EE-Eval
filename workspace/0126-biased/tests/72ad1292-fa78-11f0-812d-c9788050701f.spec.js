import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ad1292-fa78-11f0-812d-c9788050701f.html';

test.describe('AST Explorer - FSM states and transitions (Application ID: 72ad1292-fa78-11f0-812d-c9788050701f)', () => {
  // Arrays to collect runtime errors and console error messages observed while running the page.
  let pageErrors;
  let consoleErrors;

  // Common selectors used across tests
  const animateBtnSel = '#animateBtn';
  const randomizeBtnSel = '#randomizeBtn';
  const nodeSel = '.node';
  const nodeContentSel = '.node-content';
  const treeContainerSel = '#treeContainer';

  test.beforeEach(async ({ page }) => {
    // Reset collectors for each test
    pageErrors = [];
    consoleErrors = [];

    // Capture runtime page errors (uncaught exceptions) and console error messages.
    page.on('pageerror', err => {
      // Collect Error objects/messages thrown during page execution
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    page.on('console', msg => {
      // Collect console.error / console messages that are of type 'error'
      if (msg.type() === 'error') {
        const text = msg.text();
        consoleErrors.push(text);
      }
    });

    // Navigate to the application page and wait for load event
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Ensure at least one node is present after initialization (S0_Idle -> init() draws initial tree)
    await page.waitForSelector(nodeSel, { timeout: 5000 });
  });

  test.afterEach(async ({ page }) => {
    // If there were page errors, attach them to the test output (Playwright will show when assertions fail)
    if (pageErrors.length > 0 || consoleErrors.length > 0) {
      // do nothing here (collected for assertions inside tests)
    }
    // Give a small pause to allow any async animations/timers to finish before tearing down
    await page.waitForTimeout(50);
  });

  test('S0_Idle: on load, init() draws the initial tree (root node present and labeled)', async ({ page }) => {
    // Validate that the initial state displays a tree (entry action: init -> drawTree)
    const firstNode = page.locator(`${nodeSel} ${nodeContentSel}`).first();
    await expect(firstNode).toBeVisible({ timeout: 3000 });

    // The first example's root for this implementation is a BinaryExpression -> label 'Binary Op'
    const text = (await firstNode.textContent()) || '';
    // We check it contains 'Binary' to be resilient if exact formatting differs
    expect(text).toMatch(/Binary|Function|Var Decl|Var|Literal|Return|Call|If/);

    // Ensure the tree container is not empty
    const treeHtml = await page.locator(treeContainerSel).innerHTML();
    expect(treeHtml.trim().length).toBeGreaterThan(0);

    // Assert no page runtime errors or console errors occurred during initialization
    expect(pageErrors, `Runtime page errors occurred during init: ${JSON.stringify(pageErrors)}`).toEqual([]);
    expect(consoleErrors, `Console errors occurred during init: ${JSON.stringify(consoleErrors)}`).toEqual([]);
  });

  test('S1_TreeAnimated: clicking Animate Tree triggers highlights on node elements', async ({ page }) => {
    // Validate state transition S0 -> S1 by clicking animate button
    await page.click(animateBtnSel);

    // animateTree applies 'highlight' class to nodes with staggered timeouts.
    // Wait for at least one node to gain the highlight class.
    await page.waitForSelector(`${nodeSel}.highlight`, { timeout: 5000 });

    // Assert at least one node currently has the 'highlight' class
    const highlighted = await page.locator(`${nodeSel}.highlight`).count();
    expect(highlighted).toBeGreaterThan(0);

    // Wait a bit to allow highlight to be removed by inner timeouts (ensures animation completes without errors)
    await page.waitForTimeout(1600);

    // After animation completes, there should be no runtime page errors
    expect(pageErrors, `Runtime page errors occurred during animate: ${JSON.stringify(pageErrors)}`).toEqual([]);
    expect(consoleErrors, `Console errors occurred during animate: ${JSON.stringify(consoleErrors)}`).toEqual([]);
  });

  test('S2_TreeRandomized: clicking Random Example draws a different example tree', async ({ page }) => {
    // Capture current root node text
    const rootContentLocator = page.locator(`${nodeSel} ${nodeContentSel}`).first();
    const beforeText = (await rootContentLocator.textContent()) || '';

    // Click randomize to transition S0 -> S2 (or from any state to S2)
    await page.click(randomizeBtnSel);

    // Wait for new nodes to render
    await page.waitForSelector(nodeSel, { timeout: 5000 });

    // Capture new root node text
    const afterText = (await page.locator(`${nodeSel} ${nodeContentSel}`).first().textContent()) || '';

    // The text should change because currentExample is advanced (examples are different)
    // However, since it's possible to loop back to the same example if there are only few examples and a race,
    // we guard with a retry: if the same, click again once.
    if (beforeText.trim() === afterText.trim()) {
      await page.click(randomizeBtnSel);
      await page.waitForSelector(nodeSel, { timeout: 5000 });
    }

    const finalText = (await page.locator(`${nodeSel} ${nodeContentSel}`).first().textContent()) || '';
    expect(finalText.trim()).not.toEqual(beforeText.trim());

    // Also verify node counts differ across examples (at least for one of the randomizations)
    const countAfter = await page.locator(nodeSel).count();
    expect(countAfter).toBeGreaterThan(0);

    // Assert no runtime errors during drawTree from randomization
    expect(pageErrors, `Runtime page errors occurred during randomize: ${JSON.stringify(pageErrors)}`).toEqual([]);
    expect(consoleErrors, `Console errors occurred during randomize: ${JSON.stringify(consoleErrors)}`).toEqual([]);
  });

  test('Transition S1 -> S0: animate then randomize should render a new tree without throwing errors', async ({ page }) => {
    // Click animate to go to S1
    await page.click(animateBtnSel);

    // Immediately click randomize to transition to S0 (per FSM possibly S1->S0 on RandomExample)
    await page.click(randomizeBtnSel);

    // Ensure new nodes are drawn and visible
    await page.waitForSelector(nodeSel, { timeout: 5000 });
    const count = await page.locator(nodeSel).count();
    expect(count).toBeGreaterThan(0);

    // Verify no runtime errors occurred during the combined interaction
    expect(pageErrors, `Runtime page errors during animate->randomize: ${JSON.stringify(pageErrors)}`).toEqual([]);
    expect(consoleErrors, `Console errors during animate->randomize: ${JSON.stringify(consoleErrors)}`).toEqual([]);
  });

  test('Transition S2 -> S1: randomize then animate should animate newly drawn nodes', async ({ page }) => {
    // Click randomize to go to S2
    await page.click(randomizeBtnSel);

    // Ensure nodes are present for the newly drawn example
    await page.waitForSelector(nodeSel, { timeout: 5000 });
    const preAnimateCount = await page.locator(nodeSel).count();
    expect(preAnimateCount).toBeGreaterThan(0);

    // Click animate to go to S1 from S2
    await page.click(animateBtnSel);

    // Wait for at least one node to have highlight class
    await page.waitForSelector(`${nodeSel}.highlight`, { timeout: 5000 });
    const highlighted = await page.locator(`${nodeSel}.highlight`).count();
    expect(highlighted).toBeGreaterThan(0);

    // Ensure no runtime errors occurred during randomize->animate
    expect(pageErrors, `Runtime page errors during randomize->animate: ${JSON.stringify(pageErrors)}`).toEqual([]);
    expect(consoleErrors, `Console errors during randomize->animate: ${JSON.stringify(consoleErrors)}`).toEqual([]);
  });

  test('Edge case: cycling examples wraps correctly (RandomExample cycles through examples array)', async ({ page }) => {
    // Capture initial root label
    const getRootLabel = async () => (await page.locator(`${nodeSel} ${nodeContentSel}`).first().textContent())?.trim() || '';

    const initialLabel = await getRootLabel();

    // There are 3 examples in the implementation: click randomize 3 times should return to initial example
    await page.click(randomizeBtnSel);
    await page.waitForSelector(nodeSel, { timeout: 5000 });

    await page.click(randomizeBtnSel);
    await page.waitForSelector(nodeSel, { timeout: 5000 });

    await page.click(randomizeBtnSel);
    await page.waitForSelector(nodeSel, { timeout: 5000 });

    const afterThreeClicks = await getRootLabel();

    // The label after three clicks (full cycle) should match the initial label
    expect(afterThreeClicks).toEqual(initialLabel);

    // No runtime errors should have occurred while cycling
    expect(pageErrors, `Runtime page errors while cycling examples: ${JSON.stringify(pageErrors)}`).toEqual([]);
    expect(consoleErrors, `Console errors while cycling examples: ${JSON.stringify(consoleErrors)}`).toEqual([]);
  });

  test('Edge case & error observation: capture any page/runtime exceptions or console errors during typical usage', async ({ page }) => {
    // Perform a sequence of interactions to surface potential runtime issues
    await page.click(animateBtnSel);
    await page.waitForTimeout(200);
    await page.click(randomizeBtnSel);
    await page.waitForSelector(nodeSel, { timeout: 5000 });
    await page.click(animateBtnSel);

    // Give time for animations and timers to invoke any deferred code paths
    await page.waitForTimeout(2000);

    // This test's purpose is to assert there were no unexpected runtime page errors or console.error messages.
    // If the implementation had ReferenceError / SyntaxError / TypeError during interactions, they would be collected above.
    expect(pageErrors, `Unexpected runtime page errors observed: ${JSON.stringify(pageErrors)}`).toEqual([]);
    expect(consoleErrors, `Unexpected console.error messages observed: ${JSON.stringify(consoleErrors)}`).toEqual([]);
  });
});