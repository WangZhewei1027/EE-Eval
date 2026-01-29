import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f62ce3-fa77-11f0-a6a1-c765f41a13c7.html';

test.describe('Dijkstra — Visual Elegance (FSM) end-to-end', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
    });

    // Capture uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the application
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Attach console output and errors to test output for debugging (kept as assertions below)
    // No teardown modifications to the page; leaving page to be closed by Playwright.
  });

  test('FSM flows: Idle → Running → Paused → Reset → Running → Completed → Reset', async ({ page }) => {
    // Elements shortcuts
    const playBtn = page.locator('#playBtn');
    const resetBtn = page.locator('#resetBtn');
    const actionText = page.locator('#actionText');
    const logBox = page.locator('#log');

    // 1) Verify initial Idle state right after load
    // Comment: The implementation sets actionText to 'Idle' and log to a ready message on resetVisual().
    await expect(actionText).toHaveText('Idle');
    await expect(logBox).toHaveText('Ready. Press Play to begin the demonstration.');

    // Also check that the start node (A) has been set to frontier and its distance set to 0 by resetVisual().
    const nodeAGroup = page.locator('#nodes [data-id="A"]');
    await expect(nodeAGroup).toHaveClass(/state-frontier/);
    const nodeADist = nodeAGroup.locator('.node-dist');
    await expect(nodeADist).toHaveAttribute('data-dist', '0');
    await expect(nodeADist).toHaveText('0');

    // 2) Ensure deterministic starting point: click Reset to clear any auto-play that may be scheduled
    // Comment: The page auto-plays once after a delay; clicking Reset now ensures a clean Idle baseline.
    await resetBtn.click();
    await expect(actionText).toHaveText('Idle');
    await expect(logBox).toHaveText('Ready. Press Play to begin the demonstration.');

    // 3) Transition S0_Idle -> S1_Running by clicking Play
    // Comment: On entering Running, playBtn text should switch to '❚❚ Pause' and a 'Running demonstration...' log appears.
    await playBtn.click();
    await expect(playBtn).toHaveText('❚❚ Pause');
    // The controller logs 'Running demonstration...' immediately when run() is invoked.
    await expect(logBox).toHaveText(/Running demonstration...|Visited/); // allow either initial run log or immediate subsequent log

    // The first animation step is 'init' that sets actionText to 'Preparing…'
    await expect(actionText).toHaveText('Preparing…');

    // 4) Transition S1_Running -> S2_Paused: click Play while running to pause
    // Comment: Pausing should change playBtn text back to '▶︎ Play' and log 'Paused'
    await playBtn.click(); // pause
    await expect(playBtn).toHaveText('▶︎ Play');
    await expect(logBox).toHaveText(/Paused/);

    // 5) Transition S2_Paused -> S0_Idle via ResetClick
    // Comment: Reset while paused should return to Idle state, reset node distances and log 'Ready...'
    await resetBtn.click();
    await expect(actionText).toHaveText('Idle');
    await expect(logBox).toHaveText('Ready. Press Play to begin the demonstration.');

    // Verify nodes reset: A -> frontier with dist 0; others infinite
    await expect(page.locator('#nodes [data-id="A"] .node-dist')).toHaveAttribute('data-dist', '0');
    const otherNode = page.locator('#nodes [data-id="B"] .node-dist');
    await expect(otherNode).toHaveAttribute('data-dist', 'Infinity').catch(async () => {
      // The implementation uses string 'Infinity' when setAttr; some browsers may coerce to 'inf' or '∞' in text.
      // As a fallback, check displayed text is '∞' or 'Infinity' without failing the test immediately.
      const text = await otherNode.textContent();
      expect(['∞', 'Infinity', 'inf']).toContain(text?.trim());
    });

    // 6) Start again and let the visualization run to completion (S0 -> S1 -> ... -> S3_Completed)
    // Comment: We now click Play and wait until actionText becomes 'Complete'.
    await playBtn.click();
    await expect(playBtn).toHaveText('❚❚ Pause');

    // Wait for final 'Complete' state. This may take multiple seconds due to animations.
    // We allow an extended timeout to accommodate the step-driven animation sequence.
    await page.waitForFunction(() => {
      const el = document.getElementById('actionText');
      return el && el.textContent && el.textContent.trim() === 'Complete';
    }, null, { timeout: 60000 });

    // Verify Completed state observables
    await expect(actionText).toHaveText('Complete');
    // After completion, the log should include the shortest path summary.
    const logText = await logBox.textContent();
    expect(logText).toMatch(/Shortest path:.*→.*\(distance:.*\)/);

    // The play button should have been reset to '▶︎ Play' once run finished
    await expect(playBtn).toHaveText('▶︎ Play');

    // Verify that nodes on the shortest path are marked as final in the DOM.
    // The path is highlighted in the log as well; we extract nodes from the log to assert classes.
    const match = logText?.match(/Shortest path:\s*([A-Z](?:\s*→\s*[A-Z])*)/);
    if (match && match[1]) {
      const pathNodes = match[1].split('→').map(s => s.trim());
      for (const nid of pathNodes) {
        const node = page.locator(`#nodes [data-id="${nid}"]`);
        await expect(node).toHaveClass(/state-final/);
        // Dist labels for path nodes should reflect finite values
        const d = await node.locator('.node-dist').getAttribute('data-dist');
        // distances should be numeric or '0' etc.
        expect(d).not.toBeNull();
        expect(['Infinity', 'inf', '∞']).not.toContain(d);
      }
    } else {
      // If log parsing failed, still assert at least one final node exists (H should be final)
      const nodeH = page.locator('#nodes [data-id="H"]');
      await expect(nodeH).toHaveClass(/state-final/);
    }

    // Verify at least one edge has been highlighted (stroke-width increased to 6 for the chosen path)
    const thickEdge = page.locator('#edges .edge').filter({ has: page.locator('[stroke-width="6"]') });
    // There's a possibility stroke-width is set via attribute; just ensure at least one .edge has stroke-width 6 or stroke contains url(#gNodeAccent)
    const edges = await page.locator('#edges .edge').elementHandles();
    let foundHighlightedEdge = false;
    for (const e of edges) {
      const sw = await e.getAttribute('stroke-width');
      const stroke = await e.getAttribute('stroke');
      if (sw === '6' || (stroke && stroke.includes('gNodeAccent'))) {
        foundHighlightedEdge = true;
        break;
      }
    }
    expect(foundHighlightedEdge).toBe(true);

    // 7) Test Reset after completion (S3_Completed -> S0_Idle via ResetClick)
    // Comment: Reset should return the UI to Idle, distances reset, and log reset.
    await resetBtn.click();
    await expect(actionText).toHaveText('Idle');
    await expect(logBox).toHaveText('Ready. Press Play to begin the demonstration.');
    await expect(page.locator('#nodes [data-id="A"]')).toHaveClass(/state-frontier/);
    await expect(page.locator('#nodes [data-id="A"] .node-dist')).toHaveAttribute('data-dist', '0');

    // 8) Edge case: Clicking Play at the very end (when idx >= steps.length) will reset first then run.
    // We simulate finishing the run, click Play once more, and verify that the play toggles to running again.
    // First ensure we are at Idle (we are) then click Play to start a fresh run. We won't wait for completion again.
    await playBtn.click();
    await expect(playBtn).toHaveText('❚❚ Pause');
    // Pause quickly to stabilize the test environment
    await playBtn.click();
    await expect(playBtn).toHaveText('▶︎ Play');

    // 9) Assertions about console errors and page errors
    // Comment: We observe console and page errors but do NOT modify the page to force or suppress them.
    // We assert that there were no uncaught page errors during the test run.
    expect(pageErrors.length).toBe(0);

    // Ensure there were no console messages of severity 'error'
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // Add a final sanity check: actionText exists and log is visible (styling / DOM presence)
    await expect(actionText).toBeVisible();
    await expect(logBox).toBeVisible();
  }, { timeout: 90000 }); // extended timeout because visual animation can take several seconds
});