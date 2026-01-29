import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9654f0-fa78-11f0-857d-d58e82d5de73.html';

test.describe('Red-Black Tree Visualization — FSM comprehensive tests', () => {
  // Arrays to capture console messages and uncaught page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture uncaught exceptions (page errors)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Load the application exactly as provided
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async ({ page }) => {
    // As part of test requirements, observe console logs and page errors and assert none of them
    // are uncaught runtime errors. If any exist, fail with helpful diagnostics.
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    if (pageErrors.length > 0 || errorConsoleMsgs.length > 0) {
      // Provide diagnostics in test failure
      const errs = pageErrors.map(e => e.toString()).join('\n---\n') || 'none';
      const consoles = errorConsoleMsgs.map(c => `${c.type}: ${c.text}`).join('\n---\n') || 'none';
      // Keep the assertion to fail the test if unexpected errors are present.
      expect(pageErrors.length, `Uncaught page errors detected:\n${errs}\nConsole errors/warnings:\n${consoles}`).toBe(0);
    }

    // Also ensure we didn't accidentally leave the page in a different state; nothing further here.
    await page.close();
  });

  test('Initial state S0_Empty: SVG shows "Tree is empty" and no nodes are present', async ({ page }) => {
    // Validate initial visual state (S0_Empty): an SVG text 'Tree is empty' should be present
    const svg = page.locator('#tree-svg');
    await expect(svg).toBeVisible();

    // The SVG should contain a visible text element with content 'Tree is empty'
    const emptyText = svg.locator('text', { hasText: 'Tree is empty' });
    await expect(emptyText).toHaveCount(1);

    // There should be no node groups initially
    const nodes = svg.locator('g.node');
    await expect(nodes).toHaveCount(0);

    // The Next Step button should be enabled at initial state
    const btnStep = page.locator('#btnStep');
    await expect(btnStep).toBeEnabled();

    // Also ensure Reset exists and is enabled
    const btnReset = page.locator('#btnReset');
    await expect(btnReset).toBeEnabled();
  });

  test('Transition S0_Empty -> S1_Inserting: click Next Step inserts root node and highlights it', async ({ page }) => {
    // Click Next Step once to insert first node
    const btnStep = page.locator('#btnStep');
    await btnStep.click();

    const svg = page.locator('#tree-svg');

    // After one insertion, at least one node <g class="node ..."> should exist
    const nodes = svg.locator('g.node');
    await expect(nodes).toHaveCount(1);

    // The inserted node should contain a text node with the first insertion key (11)
    // We check that some text node contains '11'
    const nodeText = svg.locator('g.node text', { hasText: '11' });
    await expect(nodeText).toHaveCount(1);

    // The inserted node should be visually highlighted (class 'highlight' applied) as per S1_Inserting
    const highlighted = svg.locator('g.node.highlight');
    await expect(highlighted).toHaveCount(1);

    // The circle within the highlighted node should have an aria-label containing the key and 'node'
    const circle = highlighted.locator('circle');
    await expect(circle).toHaveAttribute('aria-label', /11.*node/);

    // Clicking Next Step should not have produced uncaught page errors
    expect(pageErrors.length).toBe(0);
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test('S1_Inserting repeated steps -> S2_Finished: full insertion sequence adds nodes and disables Next Step', async ({ page }) => {
    const btnStep = page.locator('#btnStep');
    const svg = page.locator('#tree-svg');

    // Insertion sequence length is expected to be 9 as per the app source.
    const expectedInsertions = 9;

    // Click Next Step expectedInsertions times
    for (let i = 0; i < expectedInsertions; i++) {
      await btnStep.click();
      // After each click a render occurs; ensure at least one node exists
      const nodeCount = await svg.locator('g.node').count();
      expect(nodeCount).toBeGreaterThanOrEqual(1);
    }

    // After the final insertion, the Next Step button should be disabled (S2_Finished evidence)
    await expect(btnStep).toBeDisabled();

    // The total number of node groups in the SVG should equal expectedInsertions (9)
    // Note: due to visualization logic the tree may arrange nodes but number of drawn nodes should equal inserted keys
    const finalNodeCount = await svg.locator('g.node').count();
    expect(finalNodeCount).toBe(expectedInsertions);

    // According to implementation, highlight may still be present from the last render (renderTree was called with last highlight),
    // but highlightNode is then set to null without a subsequent render. We assert that the button is disabled regardless.
    // We assert that there is at least one node and the button is disabled, which is the important FSM evidence.

    // Try clicking the disabled Next Step (should be a no-op and must not throw errors)
    await btnStep.click();
    // Re-check no new nodes were created
    const nodeCountAfterDisabledClick = await svg.locator('g.node').count();
    expect(nodeCountAfterDisabledClick).toBe(finalNodeCount);

    // Ensure no page errors were emitted during the sequence
    expect(pageErrors.length).toBe(0);
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test('S2_Finished -> S0_Empty: clicking Reset clears the tree and re-enables Next Step', async ({ page }) => {
    const btnStep = page.locator('#btnStep');
    const btnReset = page.locator('#btnReset');
    const svg = page.locator('#tree-svg');

    // First drive to finished state
    const expectedInsertions = 9;
    for (let i = 0; i < expectedInsertions; i++) {
      await btnStep.click();
    }
    await expect(btnStep).toBeDisabled();

    // Now click Reset to transition back to S0_Empty
    await btnReset.click();

    // After reset, the 'Tree is empty' text should be present again
    const emptyText = svg.locator('text', { hasText: 'Tree is empty' });
    await expect(emptyText).toHaveCount(1);

    // There should be zero node groups after reset
    const nodes = svg.locator('g.node');
    await expect(nodes).toHaveCount(0);

    // Next Step should be re-enabled after Reset (per implementation: btnStep.disabled = false in reset handler)
    await expect(btnStep).toBeEnabled();

    // Ensure no uncaught runtime errors occurred during reset
    expect(pageErrors.length).toBe(0);
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test('Edge cases: clicking Reset repeatedly and clicking Next Step beyond sequence should be safe and deterministic', async ({ page }) => {
    const btnStep = page.locator('#btnStep');
    const btnReset = page.locator('#btnReset');
    const svg = page.locator('#tree-svg');

    // Click Reset multiple times at initial state - should not cause errors and should show empty tree
    await btnReset.click();
    await btnReset.click();
    await btnReset.click();

    const emptyText = svg.locator('text', { hasText: 'Tree is empty' });
    await expect(emptyText).toHaveCount(1);
    await expect(btnStep).toBeEnabled();

    // Click Next Step until disabled
    const expectedInsertions = 9;
    for (let i = 0; i < expectedInsertions; i++) {
      await btnStep.click();
    }
    await expect(btnStep).toBeDisabled();

    // Clicking Next Step while disabled repeatedly should not produce additional nodes nor uncaught errors
    for (let i = 0; i < 3; i++) {
      await btnStep.click();
    }
    const nodeCount = await svg.locator('g.node').count();
    expect(nodeCount).toBe(expectedInsertions);

    // Finally, Reset to empty again
    await btnReset.click();
    await expect(svg.locator('g.node')).toHaveCount(0);
    await expect(svg.locator('text', { hasText: 'Tree is empty' })).toHaveCount(1);

    // Validate no uncaught page errors throughout edge-case interactions
    expect(pageErrors.length).toBe(0);
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errorConsoleMsgs.length).toBe(0);
  });
});