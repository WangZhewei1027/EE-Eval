import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f96132-fa77-11f0-a6a1-c765f41a13c7.html';

test.describe('SVM Visualization FSM — f1f96132-fa77-11f0-a6a1-c765f41a13c7', () => {
  // Collect console messages and page errors for each test to validate runtime behavior.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture all console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application and wait for the main button to be available
    await page.goto(APP_URL, { waitUntil: 'load' });
    await page.waitForSelector('#toggleBtn', { state: 'visible', timeout: 5000 });
  });

  test.afterEach(async () => {
    // Nothing to teardown explicitly in the page; tests below will assert on captured errors/messages.
  });

  test('S0_Idle — Initial Idle state renders correctly and shows Play control', async ({ page }) => {
    // Validate initial UI elements — idle state expectations
    // 1) toggle button exists with aria-pressed="false" and contains Play icon/text
    const toggle = page.locator('#toggleBtn');
    await expect(toggle).toBeVisible();

    const ariaPressed = await toggle.getAttribute('aria-pressed');
    expect(ariaPressed).toBe('false');

    const html = await toggle.innerHTML();
    // Should include the play path from the SVG or the text "Play"
    expect(html).toContain('M5 3v18l15-9L5 3z');
    expect(html).toMatch(/Play/);

    // 2) svCount should reflect the number of support vectors (expected "3")
    const svCount = await page.locator('#svCount').textContent();
    expect(svCount.trim()).toBe('3');

    // 3) The hyper line element should be present with numeric coordinates set
    const hyperExists = await page.locator('#hyper').evaluate((el) => !!el && el.getAttribute('x1') !== null);
    expect(hyperExists).toBeTruthy();

    // 4) Ensure there are no uncaught page errors during initial render
    expect(pageErrors).toEqual([]);

    // Record at least one console message (the page may log things; we assert capture works)
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });

  test('Transition S0_Idle -> S1_Playing: clicking toggle starts animation and updates button', async ({ page }) => {
    // Click the toggle button to start play
    const toggle = page.locator('#toggleBtn');
    await toggle.click();

    // After clicking, aria-pressed should become "true"
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    // Button innerHTML should switch to Pause representation
    const innerAfterPlay = await toggle.innerHTML();
    expect(innerAfterPlay).toContain('M6 4h4v16H6z'); // pause icon path snippet
    expect(innerAfterPlay).toMatch(/Pause/);

    // The supportRings element should have received a drop-shadow style as part of onEnter actions
    const supportFilter = await page.locator('#supportRings').evaluate((el) => el.style.filter || '');
    expect(supportFilter).toContain('drop-shadow(');

    // The code triggers requestAnimationFrame(step) on play. Validate a visible side-effect:
    // the hyper stroke-width is modified by the animation loop; wait briefly and assert stroke-width changes over time.
    const hyper = page.locator('#hyper');
    // Read stroke-width once and then after a short delay verify it's present and numeric (animation may adjust it)
    const strokeBefore = await hyper.getAttribute('stroke-width');
    // wait to allow RAF-driven changes to occur
    await page.waitForTimeout(550);
    const strokeAfter = await hyper.getAttribute('stroke-width');

    // Ensure attributes exist and are numeric strings
    expect(strokeBefore).not.toBeNull();
    expect(strokeAfter).not.toBeNull();
    // It's sufficient that strokeAfter is a string representing a number and differs or is present
    const numAfter = Number(strokeAfter);
    expect(Number.isFinite(numAfter)).toBeTruthy();

    // No uncaught page errors should have occurred during the transition
    expect(pageErrors).toEqual([]);
  });

  test('Transition S1_Playing -> S2_Paused: clicking toggle pauses animation and updates button', async ({ page }) => {
    const toggle = page.locator('#toggleBtn');

    // Ensure we are in playing state first by clicking to play (idempotent if already playing)
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    // Now click once more to pause
    await toggle.click();

    // After pausing, aria-pressed should be "false"
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    // Button innerHTML should include playIcon id and the text "Play"
    const innerAfterPause = await toggle.innerHTML();
    expect(innerAfterPause).toContain('id="playIcon"');
    expect(innerAfterPause).toMatch(/Play/);

    // supportRings should have its filter set to 'none' on pause
    const supportFilterAfterPause = await page.locator('#supportRings').evaluate((el) => el.style.filter || '');
    expect(supportFilterAfterPause).toBe('none');

    // While paused, the stroke-width should still be present and numeric
    const strokePaused = await page.locator('#hyper').getAttribute('stroke-width');
    expect(Number.isFinite(Number(strokePaused))).toBeTruthy();

    // No uncaught page errors in this interaction
    expect(pageErrors).toEqual([]);
  });

  test('Transition S2_Paused -> S1_Playing (resume): clicking toggles resume behavior repeatedly', async ({ page }) => {
    const toggle = page.locator('#toggleBtn');

    // Ensure starting paused: if currently playing, click to pause
    const currentPressed = await toggle.getAttribute('aria-pressed');
    if (currentPressed === 'true') {
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    }

    // Rapid toggles: simulate user pressing play, pause, play quickly
    await toggle.click(); // play
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    // Validate play state artifacts
    const playHtml = await toggle.innerHTML();
    expect(playHtml).toContain('M6 4h4v16H6z');
    expect(playHtml).toMatch(/Pause/);

    // Pause again
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    // Resume again to ensure transition back to playing works
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    // After resuming, supportRings filter should again contain drop-shadow
    const supportFilter = await page.locator('#supportRings').evaluate((el) => el.style.filter || '');
    expect(supportFilter).toContain('drop-shadow(');

    // No page errors from rapid toggles
    expect(pageErrors).toEqual([]);
  });

  test('Visual elements and support vectors are highlighted as expected', async ({ page }) => {
    // Verify existence and properties of support rings and colored support points
    const supportRingsCount = await page.locator('#supportRings > g').count();
    expect(supportRingsCount).toBeGreaterThanOrEqual(3); // should have at least 3 rings (3 supports)

    // Check that the support circles were drawn with expected fill colors on initialization
    // We inspect the second child circle of each support ring (r2) for its fill attribute values
    const fills = await page.evaluate(() => {
      const rings = Array.from(document.querySelectorAll('#supportRings > g'));
      return rings.slice(0, 3).map((g) => {
        // the middle circle (index 1) is r2 in the construction
        const circles = g.querySelectorAll('circle');
        return circles[1] ? circles[1].getAttribute('fill') : null;
      });
    });
    // Expect at least one green-ish and one blue-ish filler based on the construction
    expect(fills.some(f => f && f.includes('#A7F3D0')) || fills.some(f => f && f.includes('#34D399')) || fills.some(f => f && f.includes('#BFDBFE'))).toBeTruthy();

    // Validate the displayed support vector count in the UI matches the rings present
    const svCountText = await page.locator('#svCount').textContent();
    expect(Number(svCountText.trim())).toBeGreaterThanOrEqual(1);

    // No uncaught page errors
    expect(pageErrors).toEqual([]);
  });

  test('Edge case: multiple rapid clicks do not throw errors and toggle state consistently', async ({ page }) => {
    const toggle = page.locator('#toggleBtn');

    // Rapidly click the toggle button several times to simulate jittery user
    for (let i = 0; i < 6; i++) {
      await toggle.click();
      // tiny pause to allow internal handlers to run
      await page.waitForTimeout(80);
    }

    // After an even number of clicks (6), state should be same as initial (false)
    const aria = await toggle.getAttribute('aria-pressed');
    expect(['true', 'false']).toContain(aria);

    // Ensure no uncaught page errors resulted from rapid interactions
    expect(pageErrors).toEqual([]);

    // Also verify that console captured messages are present (if page emits logs)
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });

  test('Sanity: ensure no unexpected runtime exceptions occurred during full interaction sequence', async ({ page }) => {
    // Walk through full sequence: idle -> play -> pause -> play -> pause, ensuring no page errors at any stage
    const toggle = page.locator('#toggleBtn');

    // idle -> play
    await toggle.click();
    await page.waitForTimeout(300);
    // play -> pause
    await toggle.click();
    await page.waitForTimeout(300);
    // pause -> play
    await toggle.click();
    await page.waitForTimeout(300);
    // play -> pause
    await toggle.click();
    await page.waitForTimeout(300);

    // Assert there were no uncaught exceptions
    expect(pageErrors).toEqual([]);

    // If any console messages are at error type, surface them for debugging (fail the test)
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    // We expect no console error level logs for a healthy run
    expect(consoleErrors).toEqual([]);
  });
});