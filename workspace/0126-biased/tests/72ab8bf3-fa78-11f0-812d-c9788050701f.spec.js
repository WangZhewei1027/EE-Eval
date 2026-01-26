import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ab8bf3-fa78-11f0-812d-c9788050701f.html';

test.describe('Deadlock: A Visual Elegy - FSM tests (72ab8bf3-fa78-11f0-812d-c9788050701f)', () => {
  // Collect console and page error events for each test
  test.beforeEach(async ({ page }) => {
    // Navigate to the page fresh for each test
    await page.goto(APP_URL);
  });

  // Helper to attach listeners and capture console / page errors
  async function captureConsoleAndErrors(page) {
    const consoleMessages = [];
    const pageErrors = [];

    const onConsole = msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    };
    const onPageError = error => {
      pageErrors.push({ message: error.message, stack: error.stack });
    };

    page.on('console', onConsole);
    page.on('pageerror', onPageError);

    return {
      consoleMessages,
      pageErrors,
      detach: () => {
        page.off('console', onConsole);
        page.off('pageerror', onPageError);
      }
    };
  }

  test('Initial state (S0_Idle) — resetAnimation() runs on load and positions/styles are reset', async ({ page }) => {
    // Validate onEnter action for Idle: resetAnimation() should have been executed on DOMContentLoaded
    // Capture console and page errors during initial load
    const capture = await captureConsoleAndErrors(page);

    // Selectors for key elements
    const animateBtn = await page.$('#animate-btn');
    const resetBtn = await page.$('#reset-btn');
    const explanation = await page.$('#explanation');
    const process1 = await page.$('.process-1');
    const process2 = await page.$('.process-2');
    const resourceA = await page.$('.resource-a');
    const resourceB = await page.$('.resource-b');
    const connectionSelectors = ['.connection-1', '.connection-2', '.connection-3', '.connection-4'];

    // Assertions for Idle initial conditions set by resetAnimation()
    // 1) Animate button should be enabled
    expect(animateBtn).not.toBeNull();
    expect(await animateBtn.isEnabled()).toBeTruthy();

    // 2) Process and resource inline styles should reflect resetAnimation() (top/left inline styles)
    const p1Top = await page.$eval('.process-1', el => el.style.top);
    const p1Left = await page.$eval('.process-1', el => el.style.left);
    const p2Top = await page.$eval('.process-2', el => el.style.top);
    const p2Left = await page.$eval('.process-2', el => el.style.left);
    const rATop = await page.$eval('.resource-a', el => el.style.top);
    const rBTop = await page.$eval('.resource-b', el => el.style.top);

    expect(p1Top).toBe('30%');
    expect(p1Left).toBe('30%');
    expect(p2Top).toBe('30%');
    expect(p2Left).toBe('70%');
    expect(rATop).toBe('50%');
    expect(rBTop).toBe('50%');

    // 3) Connections should be hidden (width set to '0')
    for (const sel of connectionSelectors) {
      const width = await page.$eval(sel, el => el.style.width);
      expect(width === '0' || width === '').toBeTruthy();
    }

    // 4) Explanation should be hidden (no show-explanation class)
    const explanationHasClass = await page.$eval('#explanation', el => el.classList.contains('show-explanation'));
    expect(explanationHasClass).toBeFalsy();

    // 5) No page errors or console errors occurred during initial load
    // Wait a brief moment to ensure any synchronous console messages are captured
    await page.waitForTimeout(200);
    expect(capture.pageErrors.length).toBe(0);
    // Filter console errors
    const consoleErrors = capture.consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    capture.detach();
  });

  test('Transition: AnimateDeadlock event moves to S1_Animating and performs animateDeadlock() actions', async ({ page }) => {
    // Validate clicking #animate-btn triggers animateDeadlock() and expected DOM changes
    const capture = await captureConsoleAndErrors(page);

    // Click the animate button
    const animateBtn = await page.$('#animate-btn');
    expect(animateBtn).not.toBeNull();

    await animateBtn.click();

    // After click, animateBtn should be disabled immediately (exit condition for idle -> animating)
    expect(await animateBtn.isEnabled()).toBeFalsy();

    // process positions are updated immediately (animateDeadlock sets these before setTimeout)
    const p1TopAfterClick = await page.$eval('.process-1', el => el.style.top);
    const p1LeftAfterClick = await page.$eval('.process-1', el => el.style.left);
    const p2TopAfterClick = await page.$eval('.process-2', el => el.style.top);
    const p2LeftAfterClick = await page.$eval('.process-2', el => el.style.left);

    expect(p1TopAfterClick).toBe('50%');
    expect(p1LeftAfterClick).toBe('70%');
    expect(p2TopAfterClick).toBe('50%');
    expect(p2LeftAfterClick).toBe('30%');

    // Connections and pulsing happen inside a setTimeout of ~1000ms; explanation appears after another 1000ms.
    // Wait for the explanation to be visible which implies connections and pulse were applied
    await page.waitForSelector('#explanation.show-explanation', { timeout: 4000 });

    // Verify connections have widths set according to the animation code
    const conn1Width = await page.$eval('.connection-1', el => el.style.width);
    const conn2Width = await page.$eval('.connection-2', el => el.style.width);
    const conn3Width = await page.$eval('.connection-3', el => el.style.width);
    const conn4Width = await page.$eval('.connection-4', el => el.style.width);

    expect(conn1Width).toBe('80px');
    expect(conn2Width).toBe('150px');
    expect(conn3Width).toBe('80px');
    expect(conn4Width).toBe('150px');

    // Verify processes have pulse class (visual stuck animation)
    const p1HasPulse = await page.$eval('.process-1', el => el.classList.contains('pulse'));
    const p2HasPulse = await page.$eval('.process-2', el => el.classList.contains('pulse'));
    expect(p1HasPulse).toBeTruthy();
    expect(p2HasPulse).toBeTruthy();

    // Verify explanation is shown
    const explanationVisible = await page.$eval('#explanation', el => el.classList.contains('show-explanation'));
    expect(explanationVisible).toBeTruthy();

    // Ensure no unexpected page errors or console errors occurred during the animation
    await page.waitForTimeout(200); // allow any late microtask errors to surface
    expect(capture.pageErrors.length).toBe(0);
    const consoleErrors = capture.consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    capture.detach();
  });

  test('Transition: ResetAnimation event from S1_Animating -> S0_Idle restores initial state and removes animation artifacts', async ({ page }) => {
    // Validate that resetAnimation() (triggered by #reset-btn) returns the UI to the Idle state
    const capture = await captureConsoleAndErrors(page);

    // Trigger animation first to enter S1_Animating
    await page.click('#animate-btn');

    // Wait for full animation sequence to complete (explanation visible)
    await page.waitForSelector('#explanation.show-explanation', { timeout: 4000 });

    // Now click reset to go back to Idle state
    await page.click('#reset-btn');

    // After reset, animate button should be enabled again
    const animateBtn = await page.$('#animate-btn');
    expect(await animateBtn.isEnabled()).toBeTruthy();

    // Processes and resources should be returned to their reset positions
    const p1Top = await page.$eval('.process-1', el => el.style.top);
    const p1Left = await page.$eval('.process-1', el => el.style.left);
    const p2Top = await page.$eval('.process-2', el => el.style.top);
    const p2Left = await page.$eval('.process-2', el => el.style.left);
    const rATop = await page.$eval('.resource-a', el => el.style.top);
    const rBTop = await page.$eval('.resource-b', el => el.style.top);

    expect(p1Top).toBe('30%');
    expect(p1Left).toBe('30%');
    expect(p2Top).toBe('30%');
    expect(p2Left).toBe('70%');
    expect(rATop).toBe('50%');
    expect(rBTop).toBe('50%');

    // Connections should be hidden (width '0')
    const connWidths = await page.$$eval('.connection', nodes => nodes.map(n => n.style.width));
    for (const w of connWidths) {
      expect(w === '0' || w === '').toBeTruthy();
    }

    // Pulse classes removed
    const p1HasPulse = await page.$eval('.process-1', el => el.classList.contains('pulse'));
    const p2HasPulse = await page.$eval('.process-2', el => el.classList.contains('pulse'));
    expect(p1HasPulse).toBeFalsy();
    expect(p2HasPulse).toBeFalsy();

    // Explanation hidden
    const explanationHasClass = await page.$eval('#explanation', el => el.classList.contains('show-explanation'));
    expect(explanationHasClass).toBeFalsy();

    // Ensure no page errors or console errors occurred during reset
    await page.waitForTimeout(200);
    expect(capture.pageErrors.length).toBe(0);
    const consoleErrors = capture.consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    capture.detach();
  });

  test('Edge cases: clicking reset while idle and double-clicking animate (disabled) behavior', async ({ page }) => {
    // Validate behavior when reset is clicked in Idle (no-op) and that animate button becomes disabled after first click
    const capture = await captureConsoleAndErrors(page);

    // Click reset while in idle state
    await page.click('#reset-btn');

    // After reset in idle, animate should remain enabled (idempotent)
    const animateBtn = await page.$('#animate-btn');
    expect(await animateBtn.isEnabled()).toBeTruthy();

    // Now click animate once - should disable the button
    await animateBtn.click();
    expect(await animateBtn.isEnabled()).toBeFalsy();

    // Attempt to click animate again. Since the button is disabled, it should remain disabled.
    // Playwright's click might still attempt to click; guard by ensuring isDisabled is true and assert it.
    const isDisabled = !(await animateBtn.isEnabled());
    expect(isDisabled).toBeTruthy();

    // Verify that the UI remains in the animating state (pulse class present eventually)
    await page.waitForSelector('.process-1.pulse', { timeout: 3000 });
    const p1HasPulse = await page.$eval('.process-1', el => el.classList.contains('pulse'));
    expect(p1HasPulse).toBeTruthy();

    // Clean up: reset to restore original state
    await page.click('#reset-btn');

    // Final assertions: no uncaught page errors or console errors occurred across these interactions
    await page.waitForTimeout(200);
    expect(capture.pageErrors.length).toBe(0);
    const consoleErrors = capture.consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    capture.detach();
  });

  test('Observability: ensure we capture console messages and page errors if they occur (none expected)', async ({ page }) => {
    // This test explicitly verifies that console and page errors are observed and asserted.
    const capture = await captureConsoleAndErrors(page);

    // Perform a set of interactions to exercise code paths
    await page.click('#animate-btn');
    await page.waitForSelector('#explanation.show-explanation', { timeout: 4000 });
    await page.click('#reset-btn');

    // Wait briefly to let any asynchronous errors surface
    await page.waitForTimeout(300);

    // Assert that there were no uncaught exceptions during the interactions
    // If there had been ReferenceError / TypeError / SyntaxError they would appear in pageErrors
    expect(capture.pageErrors.length).toBe(0);

    // Also assert no console-level errors (console.error) were emitted
    const consoleErrs = capture.consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);

    // For completeness, ensure we did capture some console messages array (even if empty)
    expect(Array.isArray(capture.consoleMessages)).toBeTruthy();

    capture.detach();
  });
});