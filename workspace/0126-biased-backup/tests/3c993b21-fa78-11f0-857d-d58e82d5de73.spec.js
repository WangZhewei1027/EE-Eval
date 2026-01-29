import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c993b21-fa78-11f0-857d-d58e82d5de73.html';

test.describe('Mutex Concept — Elegant Visualization (FSM validation)', () => {
  // Arrays to capture console errors and page errors during each test.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages of type "error"
    page.on('console', (msg) => {
      try {
        if (msg.type && msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location ? msg.location() : undefined,
          });
        }
      } catch (e) {
        // Guard: do not interfere with page execution
      }
    });

    // Capture uncaught exceptions from the page
    page.on('pageerror', (err) => {
      pageErrors.push({
        message: err.message,
        stack: err.stack,
      });
    });

    // Navigate to the application page and wait for initial JS to run
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // The page's script calls updateState() immediately on load.
    // Give a small settle time to allow any initial setTimeouts to complete.
    await page.waitForTimeout(50);
  });

  test.afterEach(async () => {
    // After each test ensure no console errors or uncaught page errors occurred.
    // These assertions ensure we observed the console and page errors as part of the test lifecycle.
    expect(pageErrors, `Expected no uncaught page errors, but found: ${JSON.stringify(pageErrors)}`).toHaveLength(0);
    expect(consoleErrors, `Expected no console.error messages, but found: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
  });

  test('Initial Locked State is rendered correctly (onEnter of S0_Locked)', async ({ page }) => {
    // This test validates the initial onEnter actions (updateState()) that put the app into S0_Locked.
    // Check the status ring, lock icon, toggle button text/aria-pressed, and threads' aria-labels.

    const statusRing = page.locator('#status-ring');
    const lockIcon = page.locator('#lock-icon');
    const toggleBtn = page.locator('#toggleLock');
    const threads = page.locator('.thread');

    // Status ring should have "locked" class and proper aria-label
    await expect(statusRing).toHaveClass(/locked/);
    await expect(statusRing).toHaveAttribute('aria-label', 'Mutex is currently locked');

    // Lock icon should be marked as locked and have ARIA label added by script
    await expect(lockIcon).toHaveClass(/locked/);
    await expect(lockIcon).toHaveAttribute('aria-label', 'Lock icon: Locked');

    // Toggle button initial text and aria-pressed should reflect locked state
    await expect(toggleBtn).toHaveText('Unlock Mutex');
    await expect(toggleBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(toggleBtn).toHaveAttribute('title', 'Toggle Mutex Lock State');
    await expect(toggleBtn).toHaveAttribute('aria-controls', 'mutex-visual');

    // All threads should have aria-label "Thread X (waiting)"
    const count = await threads.count();
    expect(count).toBeGreaterThanOrEqual(3); // Expect at least the 3 threads defined
    for (let i = 0; i < count; i++) {
      const t = threads.nth(i);
      await expect(t).toHaveAttribute('aria-label', `Thread ${i + 1} (waiting)`);
    }

    // Also ensure the visual wrapper has aria-live to announce state changes
    await expect(page.locator('#mutex-visual')).toHaveAttribute('aria-live', 'polite');
  });

  test('ToggleLock event transitions Locked -> Unlocked (S0_Locked -> S1_Unlocked) and updates DOM', async ({ page }) => {
    // This test validates the ToggleLock event and the expected visual & ARIA changes for S1_Unlocked.
    const statusRing = page.locator('#status-ring');
    const lockIcon = page.locator('#lock-icon');
    const toggleBtn = page.locator('#toggleLock');
    const thread2 = page.locator('#thread-2');
    const thread1 = page.locator('#thread-1');
    const thread3 = page.locator('#thread-3');

    // Click the toggle to unlock
    await toggleBtn.click();

    // updateState() is called synchronously; assert immediate class/attribute changes for unlocked state
    await expect(statusRing).toHaveClass(/unlocked/);
    await expect(statusRing).toHaveAttribute('aria-label', 'Mutex is currently unlocked');

    await expect(lockIcon).toHaveClass(/unlocked/);
    await expect(lockIcon).toHaveAttribute('aria-label', 'Lock icon: Unlocked');

    await expect(toggleBtn).toHaveText('Lock Mutex');
    await expect(toggleBtn).toHaveAttribute('aria-pressed', 'false');

    // Thread 2 should be moved into critical section inline styles and aria-label updated immediately
    await expect(thread2).toHaveAttribute('aria-label', 'Thread 2 (inside critical section)');
    // Inline styles set left and bottom to '50%' for thread-2
    const left2 = await thread2.evaluate((el) => el.style.left);
    const bottom2 = await thread2.evaluate((el) => el.style.bottom);
    expect(left2).toBe('50%');
    expect(bottom2).toBe('50%');

    // animationPlayState should be 'paused' for thread-2
    const animState2 = await thread2.evaluate((el) => getComputedStyle(el).animationPlayState || el.style.animationPlayState);
    expect(animState2 === 'paused' || animState2 === 'paused ').toBeTruthy();

    // Other threads should (after a short timeout inside the app) restore pendulum positions and remain waiting.
    await page.waitForTimeout(350); // wait for the 300ms setTimeout inside updateState

    await expect(thread1).toHaveAttribute('aria-label', 'Thread 1 (waiting)');
    await expect(thread3).toHaveAttribute('aria-label', 'Thread 3 (waiting)');

    // Their inline left/bottom values should have been restored to the original values (22%/25% and 65%/23%)
    const left1 = await thread1.evaluate((el) => el.style.left);
    const bottom1 = await thread1.evaluate((el) => el.style.bottom);
    expect(left1).toBe('22%');
    expect(bottom1).toBe('25%');

    const left3 = await thread3.evaluate((el) => el.style.left);
    const bottom3 = await thread3.evaluate((el) => el.style.bottom);
    expect(left3).toBe('65%');
    expect(bottom3).toBe('23%');
  });

  test('ToggleLock event transitions Unlocked -> Locked (S1_Unlocked -> S0_Locked) and restores DOM', async ({ page }) => {
    // This test toggles twice to go Locked -> Unlocked -> Locked and verifies onReturn to S0_Locked entry actions are applied.
    const statusRing = page.locator('#status-ring');
    const lockIcon = page.locator('#lock-icon');
    const toggleBtn = page.locator('#toggleLock');
    const threads = page.locator('.thread');

    // First click: to Unlocked
    await toggleBtn.click();
    // Wait a little to ensure unlocked state settled
    await page.waitForTimeout(50);

    // Second click: back to Locked
    await toggleBtn.click();
    // updateState() is synchronous, but allow micro-delay for style changes to apply
    await page.waitForTimeout(50);

    // Ensure Locked state is restored
    await expect(statusRing).toHaveClass(/locked/);
    await expect(statusRing).toHaveAttribute('aria-label', 'Mutex is currently locked');

    await expect(lockIcon).toHaveClass(/locked/);
    await expect(lockIcon).toHaveAttribute('aria-label', 'Lock icon: Locked');

    await expect(toggleBtn).toHaveText('Unlock Mutex');
    await expect(toggleBtn).toHaveAttribute('aria-pressed', 'true');

    // All threads should have aria-label "Thread X (waiting)" again
    const count = await threads.count();
    for (let i = 0; i < count; i++) {
      const t = threads.nth(i);
      await expect(t).toHaveAttribute('aria-label', `Thread ${i + 1} (waiting)`);
      // The style filter should reflect the waiting drop-shadow returned in locked state
      const filterStyle = await t.evaluate((el) => el.style.filter);
      expect(filterStyle).toContain('drop-shadow');
    }
  });

  test('Rapid toggles (edge case) produce expected final state parity and stable attributes', async ({ page }) => {
    // This test simulates rapid user clicks and verifies final state parity is correct (odd/even toggles).
    const toggleBtn = page.locator('#toggleLock');
    const statusRing = page.locator('#status-ring');

    // Starting state is Locked. Perform 5 rapid clicks (odd -> final should be Unlocked).
    for (let i = 0; i < 5; i++) {
      // Use Promise.all to not await in between to simulate rapid succession
      await toggleBtn.click();
    }

    // Allow immediate processing and the small 300ms timeouts inside the app to run
    await page.waitForTimeout(400);

    // After 5 toggles from Locked, expected final state: Unlocked
    await expect(statusRing).toHaveClass(/unlocked/);
    await expect(page.locator('#toggleLock')).toHaveAttribute('aria-pressed', 'false');

    // Now do one more click to make it even number of toggles (6 total) -> Locked
    await toggleBtn.click();
    await page.waitForTimeout(100);
    await expect(statusRing).toHaveClass(/locked/);
    await expect(page.locator('#toggleLock')).toHaveAttribute('aria-pressed', 'true');
  });

  test('Accessibility attributes remain consistent across transitions and are present', async ({ page }) => {
    // Validate presence and consistency of ARIA attributes across toggles:
    // - button has title and aria-controls
    // - status region and lock icon have aria-labels updated
    const toggleBtn = page.locator('#toggleLock');
    const statusRing = page.locator('#status-ring');
    const lockIcon = page.locator('#lock-icon');

    // Initial checks
    await expect(toggleBtn).toHaveAttribute('title', 'Toggle Mutex Lock State');
    await expect(toggleBtn).toHaveAttribute('aria-controls', 'mutex-visual');
    await expect(statusRing).toHaveAttribute('aria-label', 'Mutex is currently locked');
    await expect(lockIcon).toHaveAttribute('aria-label', 'Lock icon: Locked');

    // Toggle to unlocked and verify ARIA labels change appropriately
    await toggleBtn.click();
    await page.waitForTimeout(60);
    await expect(statusRing).toHaveAttribute('aria-label', 'Mutex is currently unlocked');
    await expect(lockIcon).toHaveAttribute('aria-label', 'Lock icon: Unlocked');

    // Toggle back to locked and verify ARIA labels revert
    await toggleBtn.click();
    await page.waitForTimeout(60);
    await expect(statusRing).toHaveAttribute('aria-label', 'Mutex is currently locked');
    await expect(lockIcon).toHaveAttribute('aria-label', 'Lock icon: Locked');
  });

  test('No uncaught ReferenceError, SyntaxError, or TypeError occurred during interactions (observed via console/pageerror)', async ({ page }) => {
    // This test explicitly exercises some interactions while watching for errors.
    // We'll click the button a few times and ensure no page errors or console.errors were emitted.
    const toggleBtn = page.locator('#toggleLock');

    // Perform some interactions
    await toggleBtn.click();
    await page.waitForTimeout(120);
    await toggleBtn.click();
    await page.waitForTimeout(120);
    await toggleBtn.click();
    await page.waitForTimeout(350);

    // The afterEach hook will assert that pageErrors and consoleErrors arrays are empty.
    // Here we add explicit expect as well for clarity inside this test.
    // Note: we re-create the listeners arrays from closures (populated in beforeEach).
    expect(pageErrors.length, `Found page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
    expect(consoleErrors.length, `Found console.error messages: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });
});