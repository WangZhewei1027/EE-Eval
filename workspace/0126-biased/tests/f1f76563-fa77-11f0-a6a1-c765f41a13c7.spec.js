import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f76563-fa77-11f0-a6a1-c765f41a13c7.html';

// Helper: wait until mainPanel contains a class substring
async function waitForPanelState(page, stateClass, timeout = 3000) {
  await page.waitForFunction(
    (cls) => {
      const p = document.getElementById('mainPanel');
      return !!(p && p.classList && p.classList.contains(cls));
    },
    stateClass,
    { timeout }
  );
}

// Helper: read core label text
async function getCoreLabel(page) {
  return page.evaluate(() => {
    const el = document.getElementById('coreLabel');
    return el ? el.textContent.trim() : null;
  });
}

// Helper: read lock svg stroke attribute for each lock element
async function getLockStrokeAttributes(page) {
  return page.evaluate(() => {
    const locks = [ 'lock0','lock1','lock2','lock3' ].map(id => document.getElementById(id));
    return locks.map(l => {
      if(!l) return null;
      const svgPath = l.querySelector('svg path, svg rect');
      return svgPath ? svgPath.getAttribute('stroke') : null;
    });
  });
}

// Helper: read request path opacity
async function getRequestOpacities(page) {
  return page.evaluate(() => {
    return ['r0','r1','r2','r3'].map(id => {
      const el = document.getElementById(id);
      return el ? getComputedStyle(el).opacity || el.style.opacity : null;
    });
  });
}

test.describe('Deadlock — Visual Demonstration (f1f76563)', () => {
  // containers for console and page errors per test
  test.beforeEach(async ({ page }) => {
    // collect console and page errors for assertions
    page.context()._testConsoleMessages = [];
    page.context()._testPageErrors = [];

    page.on('console', (msg) => {
      // capture all console events (type, text)
      page.context()._testConsoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      page.context()._testPageErrors.push(err);
    });

    // load the page fresh for each test
    await page.goto(APP_URL);
    // ensure the main panel exists before proceeding
    await expect(page.locator('#mainPanel')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    // Attach diagnostic information in case of failures (console + errors)
    const consoleMessages = page.context()._testConsoleMessages || [];
    const pageErrors = page.context()._testPageErrors || [];
    // Basic logging to aid debugging during failures - kept as expectations to surface if unexpectedly populated
    // (We do not modify runtime; merely assert the captured arrays exist)
    expect(Array.isArray(consoleMessages)).toBe(true);
    expect(Array.isArray(pageErrors)).toBe(true);
  });

  test('Initial DOM state and automatic initial sequence runs (S0 -> S1 -> S2 -> S3)', async ({ page }) => {
    // This test validates:
    // - Initial "state-init" class and "Awaiting..." label before timeline steps execute
    // - Automatic runSequence on load triggers the state changes in correct order and within expected timing:
    //   S1_Acquire (state-acquire) => coreLabel 'Acquiring resources'
    //   S2_Request (state-wait) => coreLabel 'Requests issued'
    //   S3_Deadlock (state-dead) => coreLabel 'Deadlock — Circular Wait'
    //
    // It also validates visual side-effects: locks moved (translateY) on acquire, request paths visible on wait,
    // and lock SVG stroke color updated on deadlock.

    // Immediately after load, the DOM should include the initial state class and the core label should read 'Awaiting...'
    const panelClass = await page.locator('#mainPanel').getAttribute('class');
    expect(panelClass).toContain('state-init');

    const initialLabel = await getCoreLabel(page);
    expect(initialLabel).toBe('Awaiting...');

    // Wait for the acquire state (stepAcquire) - scripted to occur ~400ms after runSequence
    await waitForPanelState(page, 'state-acquire', 2000);
    const labelAcquire = await getCoreLabel(page);
    expect(labelAcquire).toBe('Acquiring resources');

    // Validate locks have the acquire transform/box-shadow styles applied (transform set to translateY(-2px))
    const lockTransforms = await page.evaluate(() => {
      return [ 'lock0','lock1','lock2','lock3' ].map(id => {
        const el = document.getElementById(id);
        return el ? el.style.transform || getComputedStyle(el).transform : null;
      });
    });
    // At least one lock should have a transform reflecting translateY(-2px) or computed transform not 'none'
    expect(lockTransforms.some(t => t && t !== 'none')).toBe(true);

    // Wait for the request state (stepRequest) - scripted to occur ~1400ms after runSequence
    await waitForPanelState(page, 'state-wait', 2500);
    const labelRequest = await getCoreLabel(page);
    expect(labelRequest).toBe('Requests issued');

    // Validate that request arrow paths have opacity 1 (visible / animated)
    const reqOpacitiesDuringWait = await getRequestOpacities(page);
    expect(reqOpacitiesDuringWait.every(o => o !== null)).toBe(true);
    // At least one request should be visible (opacity > 0)
    expect(reqOpacitiesDuringWait.some(o => parseFloat(o) > 0)).toBe(true);

    // Wait for the deadlock state (stepDeadlock) - scripted to occur ~3000ms after runSequence
    await waitForPanelState(page, 'state-dead', 5000);
    const labelDead = await getCoreLabel(page);
    expect(labelDead).toBe('Deadlock — Circular Wait');

    // Validate that lock SVG stroke attributes were updated to red-tinge in deadlock step
    const lockStrokes = await getLockStrokeAttributes(page);
    // The script sets stroke to 'rgba(255,120,120,0.95)' for present svg path/rect; ensure at least one updated
    expect(lockStrokes.some(s => typeof s === 'string' && s.includes('255') && s.includes('120'))).toBe(true);
  });

  test('Clicking Replay button triggers sequence transitions (S0 -> S1 -> S2 -> S3) and no page errors', async ({ page }) => {
    // This test validates the ReplayClicked event handler:
    // - Clicking #replayBtn calls runSequence and produces same transitions as automatic run
    // - Ensures no uncaught page errors appear during the interaction

    // Clear collected page errors/messages (starting fresh)
    page.context()._testConsoleMessages.length = 0;
    page.context()._testPageErrors.length = 0;

    const replay = page.locator('#replayBtn');
    await expect(replay).toBeVisible();

    // click the replay button to start a new runSequence
    await replay.click();

    // After click, expect to reach acquire, wait, dead states in order
    await waitForPanelState(page, 'state-acquire', 2000);
    expect(await getCoreLabel(page)).toBe('Acquiring resources');

    await waitForPanelState(page, 'state-wait', 2500);
    expect(await getCoreLabel(page)).toBe('Requests issued');

    await waitForPanelState(page, 'state-dead', 5000);
    expect(await getCoreLabel(page)).toBe('Deadlock — Circular Wait');

    // Confirm no uncaught page errors recorded during the interactions
    const pageErrors = page.context()._testPageErrors || [];
    expect(pageErrors.length).toBe(0);

    // Confirm console messages captured are an array - don't require specific logs since the page is silent
    const consoleMessages = page.context()._testConsoleMessages || [];
    expect(Array.isArray(consoleMessages)).toBe(true);
  });

  test('Pressing "R" key triggers replay (KeyRPressed -> ReplayClicked) and sequence completes', async ({ page }) => {
    // This test validates the KeyRPressed event handler:
    // - pressing the 'r' key will cause the script to call replayBtn.click() and runSequence()
    // - result should be same transitions to dead state

    // Focus body to ensure keydown is received
    await page.focus('body');

    // Press 'r' (lowercase) - handler uses e.key.toLowerCase() === 'r'
    await page.keyboard.press('r');

    // The click should have started a new run; wait for the states
    await waitForPanelState(page, 'state-acquire', 2000);
    expect(await getCoreLabel(page)).toBe('Acquiring resources');

    await waitForPanelState(page, 'state-wait', 2500);
    expect(await getCoreLabel(page)).toBe('Requests issued');

    await waitForPanelState(page, 'state-dead', 5000);
    expect(await getCoreLabel(page)).toBe('Deadlock — Circular Wait');
  });

  test('Rapid multiple Replay clicks do not produce uncaught exceptions and result still reaches dead state', async ({ page }) => {
    // Edge case: user clicks replay many times quickly. The script should clear timers and start the sequence cleanly.
    page.context()._testPageErrors.length = 0;

    const replay = page.locator('#replayBtn');
    await expect(replay).toBeVisible();

    // Rapid clicks
    await Promise.all([
      replay.click(),
      replay.click(),
      replay.click()
    ]);

    // Wait for eventual dead state
    await waitForPanelState(page, 'state-dead', 6000);
    expect(await getCoreLabel(page)).toBe('Deadlock — Circular Wait');

    // Ensure there were no uncaught page errors
    const pageErrors = page.context()._testPageErrors || [];
    expect(pageErrors.length).toBe(0);
  });

  test('State resetVisuals (S0_Init) is applied on replay and before sequences (evidence of onEnter)', async ({ page }) => {
    // Validate that resetVisuals() is effectively called before a sequence: coreLabel is set to 'Awaiting...' transiently
    // We'll trigger a replay and then immediately check that the panel has state-init class (resetVisuals adds it),
    // before the timed acquire step executes.

    const replay = page.locator('#replayBtn');
    await replay.click();

    // Right after click, resetVisuals is synchronous inside runSequence(), so panel should have state-init class
    const panelClassImmediately = await page.locator('#mainPanel').getAttribute('class');
    expect(panelClassImmediately).toContain('state-init');

    // Then later it should transition to acquire
    await waitForPanelState(page, 'state-acquire', 2000);
    expect(await getCoreLabel(page)).toBe('Acquiring resources');
  });

  test('No unexpected runtime errors on initial load (pageerror / console errors)', async ({ page }) => {
    // Ensure that there were no uncaught exceptions captured during initial page load
    const pageErrors = page.context()._testPageErrors || [];
    // The implementation is expected to run without throwing; assert none were captured.
    expect(pageErrors.length).toBe(0);

    // Also assert there are no console.error messages captured
    const consoleErrors = (page.context()._testConsoleMessages || []).filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});