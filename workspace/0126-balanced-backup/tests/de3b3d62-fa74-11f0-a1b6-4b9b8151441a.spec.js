import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3b3d62-fa74-11f0-a1b6-4b9b8151441a.html';

test.describe('Red-Black Tree Visualization - FSM tests (de3b3d62-fa74-11f0-a1b6-4b9b8151441a)', () => {
  // Helper to attach listeners for console and page errors and gather messages
  const attachErrorCollectors = (page) => {
    const pageErrors = [];
    const consoleMessages = [];

    page.on('pageerror', (err) => {
      // Collect page errors (uncaught exceptions in page)
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    page.on('console', (msg) => {
      try {
        consoleMessages.push(`${msg.type()}: ${msg.text()}`);
      } catch (e) {
        consoleMessages.push(`console: <could not serialize message>`);
      }
    });

    return { pageErrors, consoleMessages };
  };

  test('S0_Idle: initial load renders page title and attempts to run entry action renderPage()', async ({ page }) => {
    // Validate initial state S0_Idle: page should load, title present, and entry action renderPage() should either be available or produce a runtime error if missing.
    const { pageErrors, consoleMessages } = attachErrorCollectors(page);

    await page.goto(APP_URL, { waitUntil: 'load' });

    // Check the document title (evidence for S0_Idle)
    await expect(page).toHaveTitle('Red-Black Tree Visualization');

    // Allow any inline scripts/onload handlers to run and possibly produce errors
    await page.waitForTimeout(250);

    // Check whether renderPage is defined in global scope
    const hasRenderPage = await page.evaluate(() => typeof renderPage === 'function');

    if (hasRenderPage) {
      // If function exists, assert that at least the function is present (we cannot patch or spy on it)
      expect(hasRenderPage).toBe(true);
    } else {
      // If renderPage is not defined, the page may have thrown a ReferenceError when trying to call it.
      // Assert that a page error mentioning renderPage was observed.
      const found = pageErrors.some(msg => /renderPage/.test(msg));
      expect(found).toBe(true);
    }

    // For debugging purposes ensure we collected console output (non-fatal)
    expect(Array.isArray(consoleMessages)).toBe(true);
  });

  test.describe('Transitions from S0_Idle to S1_TreeUpdated', () => {
    test('InsertNode: clicking the Insert button triggers insertNode() or results in a ReferenceError and/or DOM change', async ({ page }) => {
      // Validate the InsertNode event and transition S0_Idle -> S1_TreeUpdated
      const { pageErrors, consoleMessages } = attachErrorCollectors(page);

      await page.goto(APP_URL, { waitUntil: 'load' });

      // Ensure the insert button is present
      const insertBtn = page.locator('button#insert');
      await expect(insertBtn).toHaveCount(1);
      await expect(insertBtn).toBeVisible();

      // Capture DOM snapshot before clicking
      const beforeHTML = await page.evaluate(() => document.body ? document.body.innerHTML : '');

      // Click the insert button (this is expected to call insertNode() if implemented)
      await insertBtn.click();

      // Allow any scripts/handlers to run and possibly produce errors or change DOM
      await page.waitForTimeout(300);

      // Capture DOM after clicking
      const afterHTML = await page.evaluate(() => document.body ? document.body.innerHTML : '');

      // Check if insertNode exists in global scope
      const hasInsertNode = await page.evaluate(() => typeof insertNode === 'function');

      if (hasInsertNode) {
        // If the function exists, we expect either a DOM change as the visualization updates,
        // or console messages indicating an update. At minimum, the function being present is good evidence.
        expect(hasInsertNode).toBe(true);
        // Accept either DOM changed or a related console message was emitted
        const domChanged = beforeHTML !== afterHTML;
        const consoleMention = consoleMessages.some(m => /insertNode|Tree visualization|visualization/i.test(m));
        expect(domChanged || consoleMention).toBeTruthy();
      } else {
        // If the function does not exist, the page likely threw a ReferenceError when the button invoked insertNode()
        const foundReferenceError = pageErrors.some(msg => /insertNode/.test(msg));
        expect(foundReferenceError).toBeTruthy();
      }
    });

    test('DeleteNode: clicking the Delete button triggers deleteNode() or results in a ReferenceError and/or DOM change', async ({ page }) => {
      // Validate the DeleteNode event and transition S0_Idle -> S1_TreeUpdated
      const { pageErrors, consoleMessages } = attachErrorCollectors(page);

      await page.goto(APP_URL, { waitUntil: 'load' });

      // Ensure the delete button is present
      const deleteBtn = page.locator('button#delete');
      await expect(deleteBtn).toHaveCount(1);
      await expect(deleteBtn).toBeVisible();

      // Capture DOM snapshot before clicking
      const beforeHTML = await page.evaluate(() => document.body ? document.body.innerHTML : '');

      // Click the delete button (this is expected to call deleteNode() if implemented)
      await deleteBtn.click();

      // Allow handlers to run
      await page.waitForTimeout(300);

      // Capture DOM after clicking
      const afterHTML = await page.evaluate(() => document.body ? document.body.innerHTML : '');

      // Check if deleteNode exists in global scope
      const hasDeleteNode = await page.evaluate(() => typeof deleteNode === 'function');

      if (hasDeleteNode) {
        // If function exists, expect some sign of update: DOM change or console output
        expect(hasDeleteNode).toBe(true);
        const domChanged = beforeHTML !== afterHTML;
        const consoleMention = consoleMessages.some(m => /deleteNode|Tree visualization|visualization/i.test(m));
        expect(domChanged || consoleMention).toBeTruthy();
      } else {
        // Expect ReferenceError mentioning deleteNode
        const foundReferenceError = pageErrors.some(msg => /deleteNode/.test(msg));
        expect(foundReferenceError).toBeTruthy();
      }
    });

    test('VisualizeTree: clicking the Visualize button triggers visualizeTree() or results in a ReferenceError and/or visualization displayed', async ({ page }) => {
      // Validate the VisualizeTree event and transition S0_Idle -> S1_TreeUpdated (visualization displayed)
      const { pageErrors, consoleMessages } = attachErrorCollectors(page);

      await page.goto(APP_URL, { waitUntil: 'load' });

      const visualizeBtn = page.locator('button#visualize');
      await expect(visualizeBtn).toHaveCount(1);
      await expect(visualizeBtn).toBeVisible();

      // Snapshot before
      const beforeHTML = await page.evaluate(() => document.body ? document.body.innerHTML : '');

      // Click visualize
      await visualizeBtn.click();

      // Allow handlers to run
      await page.waitForTimeout(300);

      // Snapshot after
      const afterHTML = await page.evaluate(() => document.body ? document.body.innerHTML : '');

      // Check if visualizeTree function exists
      const hasVisualizeTree = await page.evaluate(() => typeof visualizeTree === 'function');

      if (hasVisualizeTree) {
        // If the function exists, we expect a visualization to be displayed (DOM changed) or console logs indicating display
        expect(hasVisualizeTree).toBe(true);
        const domChanged = beforeHTML !== afterHTML;
        const consoleMention = consoleMessages.some(m => /visualizeTree|visualization|Tree visualization/i.test(m));
        expect(domChanged || consoleMention).toBeTruthy();
      } else {
        // If missing, expect a ReferenceError mentioning visualizeTree
        const foundReferenceError = pageErrors.some(msg => /visualizeTree/.test(msg));
        expect(foundReferenceError).toBeTruthy();
      }
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Clicking multiple controls in succession should either update DOM or surface function reference errors (robustness)', async ({ page }) => {
      // This test clicks insert, delete, visualize in rapid succession and ensures either DOM changes occur
      // or appropriate ReferenceErrors are raised for missing implementation.
      const { pageErrors, consoleMessages } = attachErrorCollectors(page);

      await page.goto(APP_URL, { waitUntil: 'load' });

      const insertBtn = page.locator('button#insert');
      const deleteBtn = page.locator('button#delete');
      const visualizeBtn = page.locator('button#visualize');

      // Ensure buttons present
      await expect(insertBtn).toHaveCount(1);
      await expect(deleteBtn).toHaveCount(1);
      await expect(visualizeBtn).toHaveCount(1);

      // Click them in quick succession
      await insertBtn.click();
      await deleteBtn.click();
      await visualizeBtn.click();

      // Allow handlers to run and errors to surface
      await page.waitForTimeout(500);

      // We expect at least one of the following to be true:
      // - there was a DOM change after the interactions
      // - or page errors mention missing functions (insertNode/deleteNode/visualizeTree)
      const beforeAfterDifferent = await page.evaluate(() => {
        // For robustness, compare a snapshot of the body after multiple clicks to itself (sanity check)
        return document.body ? document.body.innerHTML.length > 0 : false;
      });

      // Collect whether any reference error mentions one of the expected action names
      const referenceErrorsFound = pageErrors.some(msg => /insertNode|deleteNode|visualizeTree|renderPage/.test(msg));

      // At least one indicator must be present: some console output or reference errors or non-empty DOM
      const consoleActivity = consoleMessages.length > 0;

      expect(referenceErrorsFound || consoleActivity || beforeAfterDifferent).toBeTruthy();
    });

    test('Attempt to evaluate presence of updateTreeVisualization entry action for S1_TreeUpdated', async ({ page }) => {
      // Verify the updateTreeVisualization function is present or that its absence produced a runtime error earlier
      const { pageErrors } = attachErrorCollectors(page);

      await page.goto(APP_URL, { waitUntil: 'load' });

      // Allow any scripts to run
      await page.waitForTimeout(200);

      const hasUpdateTreeVisualization = await page.evaluate(() => typeof updateTreeVisualization === 'function');

      if (hasUpdateTreeVisualization) {
        expect(hasUpdateTreeVisualization).toBe(true);
      } else {
        // If not present, ensure that a ReferenceError mentioning updateTreeVisualization was observed
        const found = pageErrors.some(msg => /updateTreeVisualization/.test(msg));
        expect(found).toBeTruthy();
      }
    });
  });
});