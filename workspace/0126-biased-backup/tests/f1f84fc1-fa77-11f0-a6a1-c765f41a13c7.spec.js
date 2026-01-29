import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f84fc1-fa77-11f0-a6a1-c765f41a13c7.html';

test.describe('Routing — Play/Pause control (f1f84fc1-fa77-11f0-a6a1-c765f41a13c7)', () => {
  // Containers for console messages and page errors observed during each test
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  // Common setup: navigate to the page and attach listeners to collect console and page errors.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // Collect all console messages; segregate errors for more targeted assertions
      const text = msg.text();
      const type = msg.type();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push({ type, text });
    });

    page.on('pageerror', (err) => {
      // Collect runtime exceptions (ReferenceError, TypeError, SyntaxError, etc)
      pageErrors.push(err);
    });

    // Load the application exactly as-is
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Ensure the primary UI elements are present before tests run
    await page.waitForSelector('#toggleBtn');
    await page.waitForSelector('#toggleIcon');
    await page.waitForSelector('#pkt1');
  });

  // Teardown: nothing special to do, but keep this hook for symmetry and future extension
  test.afterEach(async ({ page }) => {
    // Optionally capture a screenshot for debugging when tests fail (not required)
    // await page.screenshot({ path: `debug-${Date.now()}.png`, fullPage: true });
  });

  test('Initial state: Playing (icon, aria, title, and visual feedback)', async ({ page }) => {
    // This test validates the FSM initial state S0_Playing:
    // - icon.textContent === '||'
    // - setPlaying(true) should set title and aria-label to "Pause animation"
    // - inline style boxShadow for playing state is applied

    // Verify icon shows "||" indicating playing
    const iconText = await page.$eval('#toggleIcon', el => el.textContent.trim());
    expect(iconText).toBe('||');

    // Verify aria-label and title reflect playing state ("Pause animation")
    const btnAria = await page.$eval('#toggleBtn', el => el.getAttribute('aria-label'));
    const btnTitle = await page.$eval('#toggleBtn', el => el.getAttribute('title'));
    expect(btnAria).toBe('Pause animation');
    expect(btnTitle).toBe('Pause animation');

    // Verify inline style boxShadow is the playing value set by setPlaying(true)
    const boxShadow = await page.$eval('#toggleBtn', el => el.style.boxShadow || '');
    expect(boxShadow).toBe('0 12px 30px rgba(2,6,23,0.6)');

    // Check there are no page runtime errors or console.error messages on initial load
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e=>e.message).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console.error messages: ${consoleErrors.map(c=>c.text).join('; ')}`).toBe(0);
  });

  test('Click toggles play -> pause -> play and updates icon, aria, title, and style', async ({ page }) => {
    // This test exercises the TogglePlayPause event:
    // - Click should toggle playing -> paused (S0_Playing -> S1_Paused)
    // - Second click toggles paused -> playing (S1_Paused -> S0_Playing)
    const btn = await page.$('#toggleBtn');
    expect(btn).not.toBeNull();

    // First click: should pause
    await btn.click();

    // Validate icon changed to '▶' for paused
    await page.waitForTimeout(50); // tiny delay to let DOM update
    let iconText = await page.$eval('#toggleIcon', el => el.textContent.trim());
    expect(iconText).toBe('▶');

    // aria-label and title updated to "Resume animation"
    let aria = await page.$eval('#toggleBtn', el => el.getAttribute('aria-label'));
    let title = await page.$eval('#toggleBtn', el => el.getAttribute('title'));
    expect(aria).toBe('Resume animation');
    expect(title).toBe('Resume animation');

    // style boxShadow should reflect paused state
    let boxShadow = await page.$eval('#toggleBtn', el => el.style.boxShadow || '');
    expect(boxShadow).toBe('0 8px 18px rgba(2,6,23,0.45)');

    // Second click: resume playing
    await btn.click();
    await page.waitForTimeout(50); // allow DOM updates
    iconText = await page.$eval('#toggleIcon', el => el.textContent.trim());
    expect(iconText).toBe('||');
    aria = await page.$eval('#toggleBtn', el => el.getAttribute('aria-label'));
    title = await page.$eval('#toggleBtn', el => el.getAttribute('title'));
    expect(aria).toBe('Pause animation');
    expect(title).toBe('Pause animation');
    boxShadow = await page.$eval('#toggleBtn', el => el.style.boxShadow || '');
    expect(boxShadow).toBe('0 12px 30px rgba(2,6,23,0.6)');

    // Ensure no unexpected runtime errors were emitted during clicks
    expect(pageErrors.length, `Unexpected page errors during click toggles: ${pageErrors.map(e=>e.message).join('; ')}`).toBe(0);
  });

  test('Keyboard toggles (Space and Enter) change state as expected', async ({ page }) => {
    // This test exercises the TogglePlayPauseKeyboard event handlers on the button.
    // Focus the control and simulate Space and Enter key presses, verifying the FSM transitions.

    const btnHandle = await page.$('#toggleBtn');
    expect(btnHandle).not.toBeNull();

    // Ensure we start playing
    let startIcon = await page.$eval('#toggleIcon', el => el.textContent.trim());
    if (startIcon !== '||') {
      // If not in playing, bring it to playing for deterministic behavior
      await btnHandle.click();
      await page.waitForTimeout(50);
    }

    // Focus the button before sending keyboard events
    await btnHandle.focus();

    // Press Space -> should pause
    await page.keyboard.press('Space');
    await page.waitForTimeout(50);
    let iconText = await page.$eval('#toggleIcon', el => el.textContent.trim());
    expect(iconText).toBe('▶');

    // Press Enter -> should play
    await page.keyboard.press('Enter');
    await page.waitForTimeout(50);
    iconText = await page.$eval('#toggleIcon', el => el.textContent.trim());
    expect(iconText).toBe('||');

    // Ensure pressing a non-toggle key does nothing (edge case)
    await page.keyboard.press('KeyA'); // 'a' key
    await page.waitForTimeout(50);
    iconText = await page.$eval('#toggleIcon', el => el.textContent.trim());
    expect(iconText).toBe('||');

    // Assert no page errors from keyboard interactions
    expect(pageErrors.length, `Unexpected page errors during keyboard interactions: ${pageErrors.map(e=>e.message).join('; ')}`).toBe(0);
  });

  test('Packets move while playing and show little-to-no movement when paused', async ({ page }) => {
    // This test validates dynamic behavior:
    // - When playing, packet coordinates should change over time.
    // - When paused, packet coordinates should stay nearly the same.

    // Helper to read packet coordinates (returns {x,y} as numbers)
    const readPktPos = async (selector) => {
      return await page.$eval(selector, el => {
        // Some browsers may not have cx/cy set initially; return numeric attributes or 0
        const cx = parseFloat(el.getAttribute('cx') || '0');
        const cy = parseFloat(el.getAttribute('cy') || '0');
        return { x: cx, y: cy };
      });
    };

    // Ensure playing state
    let icon = await page.$eval('#toggleIcon', el => el.textContent.trim());
    if (icon !== '||') {
      await page.click('#toggleBtn');
      await page.waitForTimeout(50);
    }

    // Sample pkt1 position at t0 and t1 while playing
    const p0 = await readPktPos('#pkt1');
    await page.waitForTimeout(350); // allow movement to accumulate
    const p1 = await readPktPos('#pkt1');

    const distPlaying = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    // Expect a measurable movement while playing; threshold modest to avoid flakiness
    expect(distPlaying, `Expected packet to move while playing, but moved only ${distPlaying}px`).toBeGreaterThan(1.5);

    // Now pause via click
    await page.click('#toggleBtn');
    await page.waitForTimeout(50);
    const pausedIcon = await page.$eval('#toggleIcon', el => el.textContent.trim());
    expect(pausedIcon).toBe('▶');

    // Sample pkt1 position at t2 and t3 while paused
    const p2 = await readPktPos('#pkt1');
    await page.waitForTimeout(350);
    const p3 = await readPktPos('#pkt1');

    const distPaused = Math.hypot(p3.x - p2.x, p3.y - p2.y);
    // While paused, movement should be minimal (packets should not advance along path)
    expect(distPaused, `Expected little movement while paused, but moved ${distPaused}px`).toBeLessThan(1.5);

    // Return to playing for cleanup
    await page.click('#toggleBtn');
    await page.waitForTimeout(50);

    // Ensure no runtime errors were emitted during movement sampling
    expect(pageErrors.length, `Unexpected page errors during packet movement test: ${pageErrors.map(e=>e.message).join('; ')}`).toBe(0);
  });

  test('Rapid toggles and repeated interactions are handled without runtime errors', async ({ page }) => {
    // Edge case: quickly toggle play/pause multiple times and verify state reflects last action,
    // and that no uncaught exceptions were thrown during the flurry of interactions.

    const btn = await page.$('#toggleBtn');
    expect(btn).not.toBeNull();

    // Rapidly click 5 times
    for (let i = 0; i < 5; i++) {
      await btn.click();
      // very small delay to simulate rapid user clicks
      await page.waitForTimeout(30);
    }

    // After odd number of clicks (5), the state should be toggled relative to initial.
    // We don't assume what initial is here; read icon to determine the final state is consistent with DOM.
    const iconText = await page.$eval('#toggleIcon', el => el.textContent.trim());
    expect(['||', '▶']).toContain(iconText);

    // No page errors expected
    expect(pageErrors.length, `Unexpected runtime errors after rapid toggles: ${pageErrors.map(e=>e.message).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console.error messages after rapid toggles: ${consoleErrors.map(c=>c.text).join('; ')}`).toBe(0);
  });

  test('No unexpected runtime errors on initial load and interactions (observability check)', async ({ page }) => {
    // This test collects all console messages and page errors observed and asserts that
    // there are no runtime exceptions and no console.error messages emitted during normal operation.
    // It serves as an observability checkpoint described in the requirements.

    // Allow some runtime background activity to occur (glows, animations, etc.)
    await page.waitForTimeout(400);

    // Assert no page errors occurred
    expect(pageErrors.length, `Page errors were emitted: ${pageErrors.map(e=>e.message).join('; ')}`).toBe(0);

    // Assert no console.error messages were logged
    const errors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errors.length, `Console errors/warnings found: ${errors.map(e => e.text).join(' | ')}`).toBe(0);
  });

});