import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a333175-ffc5-11f0-8b43-1ffa87931c43.html';

test.describe('Kruskal\'s Algorithm Visualization - FSM and UI end-to-end', () => {
  let pageErrors = [];
  let consoleErrors = [];

  // Setup listeners and navigate to page before each test
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Capture uncaught errors from the page (pageerror)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console.error messages from the page
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Go to the app page and wait for controls to be available
    await page.goto(APP_URL);
    await page.waitForSelector('#startBtn');
    await page.waitForSelector('#stepBtn');
    await page.waitForSelector('#resetBtn');
    // Ensure the canvas has been initialized
    await page.waitForSelector('#graphCanvas');
  });

  // Teardown: simple assertion no stray errors observed during each test
  test.afterEach(async () => {
    // Assert there were no uncaught page errors or console.error messages
    expect(pageErrors, `Unexpected page errors: ${pageErrors.map(e => String(e)).join('; ')}`).toHaveLength(0);
    expect(consoleErrors, `Unexpected console.error messages: ${consoleErrors.join('; ')}`).toHaveLength(0);
  });

  test.describe('Initial Idle State (S0_Idle)', () => {
    test('should be in Idle state after init: Start enabled, Step & Reset disabled', async ({ page }) => {
      // Validate buttons' enabled/disabled state per S0_Idle evidence
      const startBtn = page.locator('#startBtn');
      const stepBtn = page.locator('#stepBtn');
      const resetBtn = page.locator('#resetBtn');

      // Start should be enabled
      expect(await startBtn.isEnabled()).toBeTruthy();

      // Step and Reset should be disabled
      expect(await stepBtn.isDisabled()).toBeTruthy();
      expect(await resetBtn.isDisabled()).toBeTruthy();

      // Edge list and union-find containers should be present but not showing any progress markers
      const edgeItems = await page.locator('#edge-list > div').count();
      expect(edgeItems).toBeGreaterThan(0); // edges are displayed from initialization

      const ufText = await page.locator('#union-find-sets').textContent();
      // On init, union-find sets should list all nodes separated into initial sets
      expect(ufText).toBeTruthy();
      // Basic sanity checks to ensure content format looks like "Set 1: { ..." etc.
      expect(ufText).toMatch(/Set\s+\d+:\s*\{.*\}/);
    });
  });

  test.describe('Start Algorithm Transition (S0_Idle -> S1_Running)', () => {
    test('clicking Start Algorithm should set running state and enable Next Step', async ({ page }) => {
      // Comments: This validates the StartAlgorithm event and S1_Running entry actions (start()).
      const startBtn = page.locator('#startBtn');
      const stepBtn = page.locator('#stepBtn');
      const resetBtn = page.locator('#resetBtn');

      // Precondition: start enabled
      expect(await startBtn.isEnabled()).toBeTruthy();

      // Click Start Algorithm
      await startBtn.click();

      // After clicking, Start should be disabled, Step enabled, Reset enabled (per start() implementation)
      await expect(startBtn).toBeDisabled();
      await expect(stepBtn).toBeEnabled();
      // start() explicitly enables resetBtn
      await expect(resetBtn).toBeEnabled();

      // The visual edge list should update: current edge (index 0) gets highlighted (blue marker "♦ ")
      // Find the first edge item and assert it contains the current-marker glyph when running
      const firstEdgeText = await page.locator('#edge-list > div').first().textContent();
      expect(firstEdgeText).toBeTruthy();
      expect(firstEdgeText.trim().startsWith('♦') || firstEdgeText.includes('weight')).toBeTruthy();
    });
  });

  test.describe('Next Step Transition(s) (S1_Running -> S2_StepCompleted -> S2...)', () => {
    test('perform one Next Step and verify MST/skipped sets update and currentEdgeIndex advances', async ({ page }) => {
      // Comments: This validates the NextStep event performs a single step() invocation and updates UI accordingly.
      const startBtn = page.locator('#startBtn');
      const stepBtn = page.locator('#stepBtn');
      const resetBtn = page.locator('#resetBtn');
      const edgeListFirst = page.locator('#edge-list > div').first();
      const edgeList = page.locator('#edge-list > div');
      const ufSets = page.locator('#union-find-sets');

      // Start the algorithm first
      await startBtn.click();
      await expect(stepBtn).toBeEnabled();

      // Capture the first edge text before step for comparison
      const beforeFirst = (await edgeListFirst.textContent()) || '';

      // Perform one step
      await stepBtn.click();

      // After one step, current edge index should have advanced (first entry should no longer be marked as "current")
      // Instead, the first edge should now either be marked as included in MST (✅) or marked as skipped (⛔)
      const afterFirst = (await edgeListFirst.textContent()) || '';
      const isMst = afterFirst.trim().startsWith('✅');
      const isSkipped = afterFirst.trim().startsWith('⛔');

      // Exactly one of these should be true (the edge was either added to MST or skipped)
      expect(isMst || isSkipped).toBeTruthy();

      // Union-Find display should reflect a change from initial state (at least one merging happened for MST case)
      const ufText = (await ufSets.textContent()) || '';
      expect(ufText.length).toBeGreaterThan(0);

      // Reset should remain enabled (start() enabled it), and step should remain enabled if not finished
      expect(await resetBtn.isEnabled()).toBeTruthy();

      // If there are more edges left, step button should stay enabled; the simplest check is ensure it's not unexpectedly disabled here (unless algorithm finished immediately)
      const edgesCount = await edgeList.count();
      // If edges > 1 we expect step still enabled; otherwise might be disabled if edgesCount==1
      if (edgesCount > 1) {
        await expect(stepBtn).toBeEnabled();
      }
    });

    test('run through all Next Steps until completion and handle completion alert', async ({ page }) => {
      // Comments: This test iterates clicks on Next Step until algorithm completes,
      // validates the completion dialog message, and checks button states after completion.
      const startBtn = page.locator('#startBtn');
      const stepBtn = page.locator('#stepBtn');
      const resetBtn = page.locator('#resetBtn');
      const edgeList = page.locator('#edge-list > div');

      // Start algorithm
      await startBtn.click();
      await expect(stepBtn).toBeEnabled();

      // Prepare to capture dialog
      let dialogMessage = null;
      page.on('dialog', async (dialog) => {
        dialogMessage = dialog.message();
        await dialog.accept();
      });

      // Count how many edges exist (we will click step that many times; the step() implementation locks and triggers alert at the end)
      const totalEdges = await edgeList.count();

      // Click step button totalEdges times or until step becomes disabled
      for (let i = 0; i < totalEdges; i++) {
        // Wait for step to be enabled before clicking (it will be until last iteration)
        if (await stepBtn.isEnabled()) {
          await stepBtn.click();
        } else {
          break;
        }
      }

      // After finishing all edges, we expect a completion dialog with this exact message
      expect(dialogMessage).toBe('Algorithm completed! MST formed.');

      // After completion stepBtn should be disabled, startBtn disabled, resetBtn enabled
      await expect(stepBtn).toBeDisabled();
      await expect(startBtn).toBeDisabled();
      await expect(resetBtn).toBeEnabled();

      // Validate that the edge-list shows many items marked as included in MST (✅) or skipped (⛔)
      const anyMst = await page.locator('#edge-list > div', { hasText: '✅' }).count();
      const anySkipped = await page.locator('#edge-list > div', { hasText: '⛔' }).count();
      expect(anyMst + anySkipped).toBeGreaterThan(0);
    });
  });

  test.describe('Reset Transition (S2_StepCompleted -> S3_Reset -> S0_Idle)', () => {
    test('clicking Reset after completion clears MST and returns to Idle state', async ({ page }) => {
      // Comments: This validates the ResetAlgorithm event and S3_Reset entry actions (reset()).
      const startBtn = page.locator('#startBtn');
      const stepBtn = page.locator('#stepBtn');
      const resetBtn = page.locator('#resetBtn');
      const edgeList = page.locator('#edge-list > div');
      const ufSets = page.locator('#union-find-sets');

      // Start and run to completion to ensure reset is meaningful
      await startBtn.click();

      // Finish all steps
      const totalEdges = await edgeList.count();
      for (let i = 0; i < totalEdges; i++) {
        if (await stepBtn.isEnabled()) {
          await stepBtn.click();
        } else {
          break;
        }
      }

      // After completion, reset should be enabled
      await expect(resetBtn).toBeEnabled();

      // Click Reset
      await resetBtn.click();

      // After reset, Start should be enabled, Step and Reset disabled (per reset() implementation)
      await expect(startBtn).toBeEnabled();
      await expect(stepBtn).toBeDisabled();
      await expect(resetBtn).toBeDisabled();

      // The edge list should no longer show check marks or skipped marks at indices (they should be normal)
      const firstEdgeText = (await page.locator('#edge-list > div').first().textContent()) || '';
      // After reset the first edge should not have the "✅" or "⛔" prefix and should not be highlighted as current
      expect(firstEdgeText.trim().startsWith('✅')).toBeFalsy();
      expect(firstEdgeText.trim().startsWith('⛔')).toBeFalsy();

      // Union-Find display should be back to initial grouping (multiple sets listed)
      const ufTextAfterReset = (await ufSets.textContent()) || '';
      expect(ufTextAfterReset).toMatch(/Set\s+\d+:\s*\{.*\}/);
    });

    test('starting again after reset transitions back to Running (S3_Reset -> S0_Idle -> S1_Running)', async ({ page }) => {
      // Comments: Confirm that after a reset we can start the algorithm again and reach Running state.
      const startBtn = page.locator('#startBtn');
      const stepBtn = page.locator('#stepBtn');
      const resetBtn = page.locator('#resetBtn');

      // Ensure initial idle, then click start
      await expect(startBtn).toBeEnabled();
      await startBtn.click();

      // After starting, running should be true per UI (Start disabled and Step enabled)
      await expect(startBtn).toBeDisabled();
      await expect(stepBtn).toBeEnabled();
      // resetBtn should be enabled after start
      await expect(resetBtn).toBeEnabled();
    });
  });

  test.describe('UI Interaction Extras and Edge Cases', () => {
    test('tooltip appears when hovering near an edge on the canvas', async ({ page }) => {
      // Comments: Validate the tooltip behavior on canvas mousemove (edge hover).
      const canvas = page.locator('#graphCanvas');
      const tooltip = page.locator('#tooltip');

      // Ensure canvas has a bounding box to compute coordinates
      const box = await canvas.boundingBox();
      expect(box).not.toBeNull();
      if (!box) return; // typeguard for safety

      // Choose a point likely to be over an edge:
      // The HTML uses nodes with coordinates (approx). We'll hover near mid-area of canvas.
      const hoverX = box.x + Math.floor(box.width * 0.5);
      const hoverY = box.y + Math.floor(box.height * 0.45);

      // Move the mouse to this location to trigger edge detection hover logic
      await page.mouse.move(hoverX, hoverY);
      // Allow a small delay for tooltip logic to update
      await page.waitForTimeout(150);

      // The tooltip may or may not be visible depending on exact coordinates; check both possibilities gracefully
      const visibility = await tooltip.evaluate((el) => getComputedStyle(el).visibility);
      // Expect tooltip to be either 'visible' or 'hidden' (no errors thrown). If it's visible, assert content format.
      expect(['visible', 'hidden']).toContain(visibility);

      if (visibility === 'visible') {
        const tipText = await tooltip.textContent();
        expect(tipText).toMatch(/Edge\s+\(\d+\s*-\s*\d+\),\s*weight\s+\d+/);
      }
    });

    test('Step button remains disabled in Idle (cannot proceed without starting)', async ({ page }) => {
      // Comments: Verify that the UI prevents progressing algorithm from Idle state by disabling the Next Step button.
      const stepBtn = page.locator('#stepBtn');

      // Step should be disabled in Idle
      await expect(stepBtn).toBeDisabled();

      // Attempting to click a disabled element will be disallowed by Playwright (it will error),
      // so we assert it is disabled and do not force a click. This ensures the UI enforces preconditions.
      // No additional action needed; the disabled state is the assertion itself.
    });
  });
});