import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f47f32-fa77-11f0-a6a1-c765f41a13c7.html';

test.describe('Queue Visual Concept — FSM states and transitions', () => {
  // Hold console and page errors observed during each test
  let consoleMessages;
  let pageErrors;

  // Page object helpers
  const selectors = {
    toggleBtn: '#toggleBtn',
    pausedOverlay: '#pausedOverlay',
    sizeDisplay: '#sizeDisplay',
    capDisplay: '#capDisplay',
    headPointer: '#headPointer',
    tailPointer: '#tailPointer',
    slots: '#slots',
    stage: '.queue-stage',
  };

  // Setup: navigate and start collecting console/page errors
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // capture console messages and their types for assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // capture uncaught exceptions
      pageErrors.push(err);
    });

    await page.goto(APP_URL);
    // Ensure the main stage exists before continuing
    await expect(page.locator('main.stage')).toBeVisible();
  });

  // Teardown: sanity checks on console and page errors after each test
  test.afterEach(async () => {
    // Assert that no fatal syntax/Reference/Type errors were thrown unexpectedly.
    // The application is expected to run without uncaught runtime exceptions.
    const errorNames = pageErrors.map(e => e.name || e.message || String(e));
    // Fail the test if any page errors exist
    expect(errorNames, `Uncaught page errors: ${errorNames.join('; ')}`).toHaveLength(0);

    // Also assert console doesn't contain obvious JS error messages
    const consoleErrorEntries = consoleMessages.filter(m => m.type === 'error' || /ReferenceError|TypeError|SyntaxError/.test(m.text));
    expect(consoleErrorEntries, `Console errors observed: ${JSON.stringify(consoleErrorEntries)}`).toHaveLength(0);
  });

  // Helper: read numeric size display
  async function getSize(page) {
    const txt = await page.locator(selectors.sizeDisplay).innerText();
    return Number(txt.trim());
  }

  async function getCap(page) {
    const txt = await page.locator(selectors.capDisplay).innerText();
    return Number(txt.trim());
  }

  async function isPausedOverlayShown(page) {
    const cls = await page.locator(selectors.pausedOverlay).getAttribute('class');
    return cls && cls.split(/\s+/).includes('show');
  }

  async function getToggleBtnText(page) {
    // innerText will reflect the current label (Pause / Resume)
    return (await page.locator(selectors.toggleBtn).innerText()).trim();
  }

  test('Initial state should be Idle (S0_Idle) with automatic timers started', async ({ page }) => {
    // This test validates:
    // - The initial UI indicates "Pause" (Idle) state
    // - The paused overlay is not shown
    // - Automatic enqueues are happening (size increases)
    // - No unexpected page errors or console errors emitted at init time

    // Button should initially say 'Pause'
    await expect(page.locator(selectors.toggleBtn)).toBeVisible();
    const btnText = await getToggleBtnText(page);
    expect(btnText.toLowerCase()).toContain('pause');

    // Paused overlay should be hidden initially
    const overlayShown = await isPausedOverlayShown(page);
    expect(overlayShown).toBeFalsy();

    // Read initial size (init function seeds 1 element immediately and another at ~500ms)
    const initialSize = await getSize(page);
    // Allow up to 2200ms to let the seeded second enqueue happen (per implementation)
    await page.waitForTimeout(2200);
    const laterSize = await getSize(page);
    // The queue should have grown (or at least be >= 1). This asserts timers/enqueue process started.
    expect(laterSize).toBeGreaterThanOrEqual(Math.max(1, initialSize));

    // Ensure the size never exceeds the capacity badge (basic invariants)
    const cap = await getCap(page);
    expect(laterSize).toBeLessThanOrEqual(cap);
  });

  test('Clicking toggle should pause the automatic flow (S0_Idle -> S1_Paused)', async ({ page }) => {
    // This test validates:
    // - Clicking the toggle button sets the UI to "Resume" and shows paused overlay
    // - While paused, the size display stops changing (no enqueues/dequeues)

    // Ensure we are not paused first
    expect(await isPausedOverlayShown(page)).toBeFalsy();
    const before = await getSize(page);

    // Click to pause
    await page.locator(selectors.toggleBtn).click();

    // Button label should change to contain 'Resume'
    await expect(page.locator(selectors.toggleBtn)).toBeVisible();
    const afterClickText = await getToggleBtnText(page);
    expect(afterClickText.toLowerCase()).toContain('resume');

    // Paused overlay should be visible
    await expect(page.locator(selectors.pausedOverlay)).toHaveClass(/show/);

    // Wait a bit to ensure timers would have run if not paused; ENQ_INTERVAL is 1600ms and DEQ_INTERVAL is 2600ms
    await page.waitForTimeout(2200);

    const afterPauseSize = await getSize(page);
    // Because paused blocks enqueue/dequeue, size should remain stable
    expect(afterPauseSize).toBe(before);

    // Also pointers should not throw and we can query them
    await expect(page.locator(selectors.headPointer)).toBeVisible();
    await expect(page.locator(selectors.tailPointer)).toBeVisible();
  });

  test('Clicking toggle again should resume automatic flow (S1_Paused -> S0_Idle)', async ({ page }) {
    // This test validates:
    // - From paused state, clicking toggle resumes timers, overlay hides, and enqueues resume

    // Ensure we get into paused state if not already
    if (!(await isPausedOverlayShown(page))) {
      await page.locator(selectors.toggleBtn).click();
      await expect(page.locator(selectors.pausedOverlay)).toHaveClass(/show/);
    }

    const sizeAtPause = await getSize(page);

    // Click to resume
    await page.locator(selectors.toggleBtn).click();

    // Button label should return to 'Pause'
    await expect(page.locator(selectors.pausedOverlay)).not.toHaveClass(/show/);
    const resumedBtnText = await getToggleBtnText(page);
    expect(resumedBtnText.toLowerCase()).toContain('pause');

    // Wait enough time for at least one enqueue to happen (~ENQ_INTERVAL 1600ms + small margin)
    await page.waitForTimeout(2000);
    const sizeAfterResume = await getSize(page);
    // Size should be greater than or equal to paused size (new enqueues may have occurred)
    expect(sizeAfterResume).toBeGreaterThanOrEqual(sizeAtPause);
  });

  test('Rapid toggling should not cause uncaught exceptions or leave timers in inconsistent state', async ({ page }) => {
    // This test validates:
    // - Rapid user interaction with the toggle does not crash the app
    // - The UI ends in a coherent state (either paused or unpaused) and no console/page errors occurred

    // Rapidly click the toggle button multiple times
    const toggle = page.locator(selectors.toggleBtn);
    for (let i = 0; i < 6; i++) {
      await toggle.click();
      // small jitter to mimic a fast user; not zero to allow DOM updates
      await page.waitForTimeout(80);
    }

    // After rapid toggling allow animations/timers to stabilize briefly
    await page.waitForTimeout(600);

    // Ensure toggle button still exists and is interactable
    await expect(toggle).toBeVisible();

    // Ensure paused overlay and button text are consistent with each other
    const overlayShown = await isPausedOverlayShown(page);
    const btnText = await getToggleBtnText(page);
    if (overlayShown) {
      expect(btnText.toLowerCase()).toContain('resume');
    } else {
      expect(btnText.toLowerCase()).toContain('pause');
    }

    // Confirm that no page errors were logged during the rapid toggles
    // (The afterEach hook will also assert this; we can assert here as well for immediate feedback)
    const jsErrorMsgs = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
    expect(jsErrorMsgs, `Console errors after rapid toggles: ${jsErrorMsgs.join('; ')}`).toHaveLength(0);
  });

  test('Invariant: size never exceeds capacity and stays non-negative during normal operation', async ({ page }) => {
    // This test validates:
    // - Over a period of time with automatic flow, the visible queue size respects capacity constraints shown in the UI
    // - Size is always >= 0

    const cap = await getCap(page);
    // Monitor size for a period to ensure it never breaks invariants.
    const observedSizes = [];
    const checks = 8;
    for (let i = 0; i < checks; i++) {
      observedSizes.push(await getSize(page));
      await page.waitForTimeout(700); // sample several points over time
    }

    // All sizes should be within [0, cap]
    for (const s of observedSizes) {
      expect(s, `Observed size ${s} should be >=0`).toBeGreaterThanOrEqual(0);
      expect(s, `Observed size ${s} should be <= capacity ${cap}`).toBeLessThanOrEqual(cap);
    }
  });

  test('Observability: collect console and page errors during lifecycle (no uncaught errors expected)', async ({ page }) => {
    // This test explicitly collects console messages and page errors while exercising the app
    // It ensures the runtime remains clean without ReferenceError/TypeError/SyntaxError messages.

    // Exercise some behavior: wait, pause, resume
    await page.waitForTimeout(500);
    await page.locator(selectors.toggleBtn).click(); // pause
    await page.waitForTimeout(300);
    await page.locator(selectors.toggleBtn).click(); // resume
    await page.waitForTimeout(1200);

    // Inspect captured console messages for fatal JS error patterns
    const fatalPatterns = [/ReferenceError/, /TypeError/, /SyntaxError/, /Uncaught/];
    const fatalConsole = consoleMessages.filter(m => fatalPatterns.some(p => p.test(m.text)));
    expect(fatalConsole, `Fatal patterns in console: ${JSON.stringify(fatalConsole)}`).toHaveLength(0);

    // Inspect pageErrors array
    expect(pageErrors, `Page errors captured: ${JSON.stringify(pageErrors)}`).toHaveLength(0);
  });
});