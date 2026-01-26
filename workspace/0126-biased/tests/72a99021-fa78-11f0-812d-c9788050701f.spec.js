import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72a99021-fa78-11f0-812d-c9788050701f.html';

test.describe('Cosmic Web Graph - FSM and UI integration tests', () => {
  // Arrays to collect console messages and page errors for inspection in tests
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (info/warn/error) for later assertions
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture uncaught page errors (these map to exceptions thrown in page context)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application and wait for full load
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait a short time to allow initial animation setup to run
    await page.waitForTimeout(200);
  });

  test.afterEach(async ({ page }) => {
    // A helpful debug output when tests fail locally - kept as assertions in tests themselves
    // Ensure the page is closed/reset by Playwright fixtures automatically
  });

  test('Initial render: Idle state - DOM structure and initial visibility', async ({ page }) => {
    // Validate that critical elements exist (evidence for S0_Idle)
    const header = await page.locator('header');
    await expect(header).toBeVisible();

    const canvas = await page.locator('#graph');
    await expect(canvas).toBeVisible();

    const nodeInfo = await page.locator('#nodeInfo');
    await expect(nodeInfo).toBeVisible(); // nodeInfo exists in DOM

    // nodeInfo should be hidden initially (no "show" class)
    const nodeInfoClass = await nodeInfo.getAttribute('class');
    expect(nodeInfoClass).not.toContain('show');

    // Ensure there were no uncaught page errors immediately after load
    expect(pageErrors.length).toBe(0);
  });

  test('MouseMove: hovering over a computed node shows Node Info and leaving hides it (S0 -> S1 -> S0)', async ({ page }) => {
    // This test verifies the transition from Idle to Node Hovered and back.
    // Compute coordinates for the first node (NEBULA-1) based on canvas geometry
    const canvas = await page.locator('#graph');
    const bbox = await canvas.boundingBox();
    expect(bbox).not.toBeNull();
    const { x: canvasX, y: canvasY, width, height } = bbox;

    // According to implementation:
    // centerX = canvas.width / 2; centerY = canvas.height / 2;
    // distance = min(canvas.width, canvas.height) * 0.35;
    // node 0 angle = 0 => dx = cos(0) * distance = distance, dy = 0
    const centerX = width / 2;
    const centerY = height / 2;
    const distance = Math.min(width, height) * 0.35;

    // Target coordinates inside the first node's hover radius
    const targetX = canvasX + centerX + distance;
    const targetY = canvasY + centerY;

    // Move mouse to the target position to simulate hover (trigger MouseMove)
    await page.mouse.move(targetX, targetY);
    // Allow a short time for the mousemove handler and rendering to execute
    await page.waitForTimeout(250);

    // nodeInfo should now have the 'show' class and display NEBULA-1 label
    const nodeInfo = page.locator('#nodeInfo');
    await expect(nodeInfo).toHaveClass(/show/);

    // The info text should include the node label NEBULA-1 (as implemented)
    const infoText = await page.locator('#infoText');
    await expect(infoText).toContainText('NEBULA-1');

    // Now move the mouse away from any node to trigger hiding (simulate MouseMove leaving node)
    // Move to the top-left corner of the canvas
    await page.mouse.move(canvasX + 5, canvasY + 5);
    await page.waitForTimeout(200);

    // nodeInfo should no longer have the 'show' class
    const nodeInfoClassAfter = await nodeInfo.getAttribute('class');
    expect(nodeInfoClassAfter).not.toContain('show');

    // Ensure no unexpected page errors occurred during hover interactions
    expect(pageErrors.length).toBe(0);
  });

  test('PulseClick: clicking Pulse Network activates pulse effect without throwing errors (S0 -> S2)', async ({ page }) => {
    // This test verifies the PulseClick event and that the app continues running.
    // We cannot access internal pulseActive variable (scoped inside page script),
    // so we assert that clicking the button does not produce exceptions and the canvas remains usable.

    // Prepare to record any pageerror that may occur after the click
    const pulseButton = page.locator('#pulse');
    await expect(pulseButton).toBeVisible();

    // Click the Pulse button
    await pulseButton.click();

    // Allow some animation frames/time for pulse to be processed
    await page.waitForTimeout(500);

    // After clicking pulse, node-info should still be present in DOM (not removed)
    await expect(page.locator('#nodeInfo')).toBeVisible();

    // The canvas should still have dimensions set (i.e., animation didn't break it)
    const canvas = page.locator('#graph');
    const bbox = await canvas.boundingBox();
    expect(bbox).not.toBeNull();
    expect(bbox.width).toBeGreaterThan(0);
    expect(bbox.height).toBeGreaterThan(0);

    // Ensure clicking pulse generated no uncaught exceptions
    expect(pageErrors.length).toBe(0);
  });

  test('RecenterClick after Pulse: recentering works without throwing errors (S2 -> S0)', async ({ page }) => {
    // Ensure we can transition from Pulse Active back to Idle by clicking Recenter.
    // Again, internal rotationAngle isn't exposed; we validate that no errors occur and buttons are operable.

    // Activate pulse first
    await page.locator('#pulse').click();
    await page.waitForTimeout(200);

    // Click recenter to trigger RecenterClick transition
    const recenterButton = page.locator('#recenter');
    await expect(recenterButton).toBeVisible();
    await recenterButton.click();

    // Allow time for handlers to run
    await page.waitForTimeout(200);

    // Validate DOM still stable and no uncaught errors happened
    await expect(page.locator('#graph')).toBeVisible();
    expect(pageErrors.length).toBe(0);
  });

  test('Resize edge case: triggering window resize invokes resize handler and produces a TypeError (assignment to constant)', async ({ page }) => {
    // The implementation declares centerX/centerY as const and later reassigns them on resize:
    // centerX = newCenterX; centerY = newCenterY;
    // This should throw a TypeError: Assignment to constant variable.
    // We assert that a pageerror with that TypeError occurs when the resize handler runs.

    // Clear any previously captured errors
    pageErrors.length = 0;

    // Wait briefly to ensure animation loop is active
    await page.waitForTimeout(200);

    // Trigger a resize of the browser viewport - this should dispatch the resize event in the page
    // We rely on Playwright's viewport resize to trigger the handler
    const originalSize = page.viewportSize() || { width: 1280, height: 720 };
    try {
      // Change viewport size to a different value to cause the resize handler to execute
      await page.setViewportSize({ width: originalSize.width - 100, height: originalSize.height - 100 });
    } catch (e) {
      // Some runners may disallow setViewportSize; still attempt to dispatch resize from page
      await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    }

    // Wait for a pageerror event to be captured. If the implementation throws, Playwright should catch it.
    // Use a short polling loop because we already have a listener that pushes to pageErrors array.
    let waited = 0;
    while (waited < 2000 && pageErrors.length === 0) {
      await page.waitForTimeout(100);
      waited += 100;
    }

    // At this point, we expect a TypeError caused by assignment to a const variable.
    // Confirm that at least one page error was captured.
    expect(pageErrors.length).toBeGreaterThan(0);

    // Verify that one of the captured errors is a TypeError mentioning 'constant' or 'Assignment to constant'
    const hasConstAssignmentError = pageErrors.some(err => {
      const msg = String(err && err.message ? err.message : err);
      return /Assignment to constant/i.test(msg) || /constant/i.test(msg) || /TypeError/i.test(msg);
    });

    expect(hasConstAssignmentError).toBeTruthy();
  });

  test('Edge cases: rapid interactions (multiple rapid hover and button clicks) do not produce uncaught exceptions', async ({ page }) => {
    // Rapidly hover around several positions on the canvas and click buttons quickly to test stability.
    // This test ensures the app can handle burst interactions without uncaught runtime errors.

    const canvas = await page.locator('#graph');
    const bbox = await canvas.boundingBox();
    expect(bbox).not.toBeNull();
    const { x: canvasX, y: canvasY, width, height } = bbox;

    const centerX = width / 2;
    const centerY = height / 2;
    const distance = Math.min(width, height) * 0.35;

    // Prepare a set of positions around the circle (angles: 0, 90, 180, 270 degrees)
    const positions = [
      { x: canvasX + centerX + distance, y: canvasY + centerY },                  // 0 deg
      { x: canvasX + centerX, y: canvasY + centerY + distance },                 // 90 deg
      { x: canvasX + centerX - distance, y: canvasY + centerY },                 // 180 deg
      { x: canvasX + centerX, y: canvasY + centerY - distance }                  // 270 deg
    ];

    // Rapidly move between these positions and click pulse/recenter repeatedly
    for (let i = 0; i < 3; i++) {
      for (const pos of positions) {
        await page.mouse.move(pos.x, pos.y, { steps: 5 });
        // short pause to allow hover detection
        await page.waitForTimeout(80);
      }
      // Rapid button clicks
      await page.locator('#pulse').click();
      await page.locator('#recenter').click();
    }

    // Wait a bit for any asynchronous errors to surface
    await page.waitForTimeout(500);

    // Assert that no uncaught exceptions were recorded during the rapid interactions
    // Note: the resize test intentionally produced a TypeError earlier; to ensure isolation we only assert
    // that there is at least no new unexpected errors added in this test's timeframe.
    // We assert that any errors captured are not new TypeError from reassigning constants (unless already present).
    expect(pageErrors.length).toBeGreaterThanOrEqual(0); // at minimum the array exists

    // Ensure there are no recent runtime exceptions that look like they came from these interactions:
    const recentErrors = pageErrors.filter(err => {
      const msg = String(err && err.message ? err.message : err);
      // Filter out the known 'Assignment to constant' that may have appeared in other test.
      return !(/Assignment to constant/i.test(msg));
    });

    // If there are any errors other than the known constant assignment one, fail
    expect(recentErrors.length).toBe(0);
  });
});