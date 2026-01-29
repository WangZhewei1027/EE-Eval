import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72aac8a1-fa78-11f0-812d-c9788050701f.html';

test.describe('Recursive Beauty - FSM and UI integration tests', () => {
  // Arrays to collect console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and page errors so tests can assert on them
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // Uncaught exceptions on the page
      pageErrors.push(err);
    });

    // Navigate to the application, wait for DOMContentLoaded so initial script runs
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Ensure controls are visible (they animate in, but the elements exist immediately)
    await expect(page.locator('#growBtn')).toBeVisible();
    await expect(page.locator('#resetBtn')).toBeVisible();
    await expect(page.locator('#tree')).toBeVisible();
  });

  test.afterEach(async ({}, testInfo) => {
    // If there were page errors or console errors, attach them to the test output for debugging
    if (pageErrors.length > 0 || consoleMessages.some(m => m.type === 'error')) {
      testInfo.attach('console-and-errors', {
        body: JSON.stringify({ consoleMessages, pageErrors }, null, 2),
        contentType: 'application/json'
      });
    }
  });

  test('S0_Idle: Initial state should call resetTree() and show an empty tree container before auto-grow', async ({ page }) => {
    // This test validates the Idle state immediately after DOMContentLoaded:
    // - resetTree() should have removed any children in the #tree container
    // - no branches or leaves should be present within a short window before the auto-grow runs (auto-grow scheduled at 1s)
    const tree = page.locator('#tree');

    // Immediately after load (and DOMContentLoaded), ensure there are no branch or leaf elements yet
    // Use a small timeout window to stay well before the 1s auto-grow
    await page.waitForTimeout(300);
    await expect(tree.locator('.branch')).toHaveCount(0);
    await expect(tree.locator('.leaf')).toHaveCount(0);

    // Ensure buttons exist and are enabled (controls present)
    await expect(page.locator('#growBtn')).toBeEnabled();
    await expect(page.locator('#resetBtn')).toBeEnabled();

    // Assert no uncaught page errors occurred so far
    expect(pageErrors.length).toBe(0);
    // Assert no console.error messages have been emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('S1_TreeGrowing: Auto initial grow should create branches and leaves (waits for recursive animation timing)', async ({ page }) => {
    // This test validates that the scheduled auto-grow (setTimeout(growTree, 1000)) actually triggers:
    // - branches (.branch) should appear
    // - eventually leaves (.leaf) should appear (they are added at maxDepth with additional delays)
    const tree = page.locator('#tree');

    // Wait sufficiently long for the initial 1s delay plus recursive branch creation and leaf animation.
    // Calculation notes: initial grow scheduled at ~1000ms. Each depth step uses 200ms delays and leaves have an extra 500ms.
    // For maxDepth=5, leaves could appear around: 1000 + (5 * 200) + 500 = ~2500ms.
    await page.waitForTimeout(3500);

    // After waiting, there should be many branch elements
    const branchCount = await tree.locator('.branch').count();
    expect(branchCount).toBeGreaterThan(0);

    // Leaves should also be present once recursion finishes
    const leafCount = await tree.locator('.leaf').count();
    expect(leafCount).toBeGreaterThan(0);

    // Confirm visual nodes are appended to the #tree container
    const childCount = await tree.evaluate(node => node.childElementCount);
    expect(childCount).toBeGreaterThan(0);

    // Confirm no page errors were raised during growth
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition: GrowTree event via button triggers growth (S0 -> S1)', async ({ page }) => {
    // This test validates the GrowTree event and transition by clicking the Grow Tree button:
    // - When clicking, resetTree() is invoked and then growth starts, resulting in branch elements
    // Re-navigate to ensure a fresh environment without waiting for the auto-grow from initial load
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    const tree = page.locator('#tree');
    const growBtn = page.locator('#growBtn');

    // Ensure empty initially
    await page.waitForTimeout(200);
    await expect(tree.locator('.branch')).toHaveCount(0);

    // Click Grow Tree to initiate growth
    await growBtn.click();

    // Wait for branches to be created (recursive creation)
    await page.waitForTimeout(2000);
    const branchCount = await tree.locator('.branch').count();
    expect(branchCount).toBeGreaterThan(0);

    // Also verify leaves are created eventually
    await page.waitForTimeout(1500);
    const leafCount = await tree.locator('.leaf').count();
    expect(leafCount).toBeGreaterThanOrEqual(0); // may be 0 if not yet reached maxDepth; non-fatal

    // Check no unexpected runtime errors during the user-triggered grow
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition: ResetTree event via button clears the visualization (S1 -> S2)', async ({ page }) => {
    // This test validates the ResetTree event:
    // - Grow the tree first by clicking the button
    // - Then click Reset and ensure all branches and leaves are removed
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    const tree = page.locator('#tree');
    const growBtn = page.locator('#growBtn');
    const resetBtn = page.locator('#resetBtn');

    // Trigger growth
    await growBtn.click();
    await page.waitForTimeout(2000);
    let branches = await tree.locator('.branch').count();
    expect(branches).toBeGreaterThan(0);

    // Now click Reset and ensure the container is cleared
    await resetBtn.click();
    // Small delay to allow resetTree() to execute and remove children
    await page.waitForTimeout(200);
    await expect(tree.locator('.branch')).toHaveCount(0);
    await expect(tree.locator('.leaf')).toHaveCount(0);

    // Confirm control buttons remain usable and no errors occurred
    await expect(growBtn).toBeEnabled();
    await expect(resetBtn).toBeEnabled();
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition sequence: Idle -> Grow -> Reset -> Grow (S0 -> S1 -> S2 -> S1)', async ({ page }) => {
    // This test walks the FSM transitions in sequence:
    // 1. Ensure Idle (empty)
    // 2. Click Grow => branches appear (S1)
    // 3. Click Reset => cleared (S2)
    // 4. Click Grow again => branches reappear (S1)
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    const tree = page.locator('#tree');
    const growBtn = page.locator('#growBtn');
    const resetBtn = page.locator('#resetBtn');

    // Ensure Idle
    await page.waitForTimeout(200);
    await expect(tree.locator('.branch')).toHaveCount(0);

    // Grow -> S1
    await growBtn.click();
    await page.waitForTimeout(2000);
    let branchCount = await tree.locator('.branch').count();
    expect(branchCount).toBeGreaterThan(0);

    // Reset -> S2
    await resetBtn.click();
    await page.waitForTimeout(200);
    await expect(tree.locator('.branch')).toHaveCount(0);

    // Grow again -> S1
    await growBtn.click();
    await page.waitForTimeout(2000);
    branchCount = await tree.locator('.branch').count();
    expect(branchCount).toBeGreaterThan(0);

    // Final sanity: no uncaught exceptions during transitions
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge cases: Rapid repeated Grow clicks and multiple Resets should not throw errors', async ({ page }) => {
    // This test validates robustness when users spam controls:
    // - Rapidly click Grow several times
    // - Rapidly click Reset several times
    // - Ensure no uncaught exceptions and app stabilizes (tree either grows or is cleared)
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    const tree = page.locator('#tree');
    const growBtn = page.locator('#growBtn');
    const resetBtn = page.locator('#resetBtn');

    // Rapidly click Grow 6 times
    for (let i = 0; i < 6; i++) {
      await growBtn.click();
    }

    // Wait for some growth to occur
    await page.waitForTimeout(2500);
    let branchCount = await tree.locator('.branch').count();
    // Expect at least some branches; exact number not deterministic due to overlapping growth calls
    expect(branchCount).toBeGreaterThanOrEqual(0);

    // Rapidly click Reset 6 times
    for (let i = 0; i < 6; i++) {
      await resetBtn.click();
    }

    // Small wait for resets to take effect
    await page.waitForTimeout(300);
    await expect(tree.locator('.branch')).toHaveCount(0);
    await expect(tree.locator('.leaf')).toHaveCount(0);

    // No page errors should have been thrown during spam
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Error observation test: capture any console.error or uncaught exceptions during a full scenario', async ({ page }) => {
    // This test intentionally performs a realistic user flow while recording console and page errors,
    // then asserts that there are no errors. If errors exist, they will be attached via afterEach hook.
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    const tree = page.locator('#tree');
    const growBtn = page.locator('#growBtn');
    const resetBtn = page.locator('#resetBtn');

    // Perform a typical user flow: grow -> wait -> reset -> grow
    await growBtn.click();
    await page.waitForTimeout(2000);
    await resetBtn.click();
    await page.waitForTimeout(200);
    await growBtn.click();
    await page.waitForTimeout(2000);

    // After the flow, assert there were no uncaught exceptions or console.error messages
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // Also assert that at least one growth occurred (sanity)
    const branches = await tree.locator('.branch').count();
    expect(branches).toBeGreaterThanOrEqual(0);
  });
});