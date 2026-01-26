import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f78c73-fa77-11f0-a6a1-c765f41a13c7.html';

// Helper: wait for toast to briefly appear and return its text (toast animates and is removed)
async function waitForToastText(page, timeout = 8000) {
  // wait for the toast element to have 'show' class
  const toast = page.locator('#toast');
  await toast.waitFor({ state: 'attached', timeout });
  // Wait until it has .show class
  await page.waitForFunction(() => {
    const t = document.getElementById('toast');
    return t && t.classList.contains('show');
  }, null, { timeout });
  // Read the text
  const txt = await page.locator('#toastText').innerText();
  // Wait for it to disappear to allow next animations to run cleanly
  await page.waitForFunction(() => {
    const t = document.getElementById('toast');
    return t && !t.classList.contains('show');
  }, null, { timeout: 3000 }).catch(() => null);
  return txt;
}

test.describe('Virtual Memory — Visual Demonstration (FSM tests)', () => {
  // Arrays to capture console and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and page errors to observe runtime behavior
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the application page and ensure it's loaded
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure the app root exists
    await expect(page.locator('#app')).toBeVisible();
  });

  test.afterEach(async () => {
    // Nothing to teardown beyond Playwright default - but could inspect captured logs in each test
  });

  test.describe('States and Initial UI', () => {
    test('Initial state (S0_Stopped): UI built and preload mapping exists', async ({ page }) => {
      // Validate initial play/pause UI shows "Play" (stopped)
      const playLabel = page.locator('#playLabel');
      await expect(playLabel).toHaveText('Play');

      // The FSM initial state's entry action is buildUI(); ensure VAS pages and page table entries exist
      await expect(page.locator('#vasStack .page')).toHaveCount(8);
      await expect(page.locator('#pageTable .entry')).toHaveCount(8);
      await expect(page.locator('#frames .frame')).toHaveCount(4);

      // The implementation preloads P1 into frame 0; assert Frame 0 is occupied and shows P1
      const frame0 = page.locator('#frame-0');
      await expect(frame0).toHaveClass(/occupied/);
      await expect(frame0.locator('.muted')).toHaveText(/P1/);

      // The corresponding Page Table entry for Page 1 should indicate → F0
      const entry1Label = page.locator('#entry-1 .status div').nth(1);
      await expect(entry1Label).toHaveText(/→ F0/);

      // Ensure no uncaught page errors and no console error messages occurred during load
      expect(pageErrors.length, `pageErrors: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, `consoleErrors: ${JSON.stringify(consoleErrors)}`).toBe(0);
    });
  });

  test.describe('Events and Transitions', () => {
    test('PlayPauseClick: clicking Play toggles to Playing and triggers a sequence step (S0 -> S1)', async ({ page }) => {
      // Click Play button to start the simulation (should call play())
      await page.locator('#playPause').click();

      // Play button label should change to Pause (playing = true)
      await expect(page.locator('#playLabel')).toHaveText('Pause');

      // Because the sequence's first access is page 1 and P1 is preloaded, we expect a HIT toast
      const toastText = await waitForToastText(page, 8000);
      expect(toastText).toMatch(/HIT: P1/);

      // The page element P1 should have received the 'hit' visual class at some point (transient).
      // Because the class is transient, we can't reliably assert it is present now, but we can assert frame and table still consistent.
      await expect(page.locator('#frame-0 .muted')).toHaveText(/P1/);
      await expect(page.locator('#entry-1 .status div').nth(1)).toHaveText(/→ F0/);

      // Now click Play/Pause again to pause (S1 -> S0)
      await page.locator('#playPause').click();
      await expect(page.locator('#playLabel')).toHaveText('Play');

      // Ensure no page errors or console errors occurred during play/pause handling
      expect(pageErrors.length, `pageErrors during play: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, `consoleErrors during play: ${JSON.stringify(consoleErrors)}`).toBe(0);
    });

    test('SpaceKeyPress: pressing Space toggles play/pause and triggers behavior', async ({ page }) => {
      // Press Space to start (should call play())
      await page.keyboard.press('Space');

      // Label updates to Pause
      await expect(page.locator('#playLabel')).toHaveText('Pause');

      // The first sequence access should occur (P1 hit). Observe toast.
      const toastText = await waitForToastText(page, 8000);
      expect(toastText).toMatch(/HIT: P1/);

      // Press Space again to pause
      await page.keyboard.press('Space');
      await expect(page.locator('#playLabel')).toHaveText('Play');

      // Ensure no JS runtime errors occurred during space key handling
      expect(pageErrors.length, `pageErrors during Space key: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, `consoleErrors during Space key: ${JSON.stringify(consoleErrors)}`).toBe(0);
    });

    test('ResetClick: clicking Reset resets the simulation state (mapping and frames cleared)', async ({ page }) => {
      // Start the simulation to allow some state changes (we will quickly pause to avoid long run)
      await page.locator('#playPause').click();
      await expect(page.locator('#playLabel')).toHaveText('Pause');

      // Wait for at least one toast to ensure sequence has started (hit or fault)
      await waitForToastText(page, 8000);

      // Now click Reset button
      await page.locator('#resetBtn').click();

      // After reset, play label should remain whatever (reset doesn't change play label aside from pause)
      // The implementation of reset() calls pause(), so label should be 'Play'
      await expect(page.locator('#playLabel')).toHaveText('Play');

      // All frames should be emptied after reset (class .empty)
      const frames = page.locator('#frames .frame');
      const frameCount = await frames.count();
      for (let i = 0; i < frameCount; i++) {
        await expect(frames.nth(i)).toHaveClass(/empty/);
        await expect(frames.nth(i).locator('.muted')).toHaveText(/free/);
      }

      // All page table entries should show free (—)
      const entries = page.locator('#pageTable .entry');
      const entryCount = await entries.count();
      for (let i = 0; i < entryCount; i++) {
        const label = entries.nth(i).locator('.status div').nth(1);
        await expect(label).toHaveText('—');
      }

      // Ensure reset did not produce runtime errors
      expect(pageErrors.length, `pageErrors during Reset: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, `consoleErrors during Reset: ${JSON.stringify(consoleErrors)}`).toBe(0);
    });

    test('RKeyPress: pressing "r" resets simulation while stopped and while playing', async ({ page }) => {
      // First, ensure stopped state then press 'r'
      await expect(page.locator('#playLabel')).toHaveText('Play');
      await page.keyboard.press('r');
      // reset() calls pause() and clears mappings; label remains 'Play'
      await expect(page.locator('#playLabel')).toHaveText('Play');

      // Start playing then press 'r' to reset mid-run
      await page.locator('#playPause').click();
      await expect(page.locator('#playLabel')).toHaveText('Pause');

      // Wait for at least one toast so we observe some activity
      await waitForToastText(page, 8000);

      // Press 'r' to reset while playing
      await page.keyboard.press('r');

      // After reset, label should be 'Play' (reset calls pause)
      await expect(page.locator('#playLabel')).toHaveText('Play');

      // Verify mapping cleared (frame 0 should be free)
      await expect(page.locator('#frame-0')).toHaveClass(/empty/);
      await expect(page.locator('#entry-1 .status div').nth(1)).toHaveText('—');

      // Check no page errors during R key handling
      expect(pageErrors.length, `pageErrors during R key: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, `consoleErrors during R key: ${JSON.stringify(consoleErrors)}`).toBe(0);
    });

    test('Sequence behavior: faults cause swap/eviction and UI updates (simulate a few steps)', async ({ page }) => {
      // Reset first to have a clean slate
      await page.locator('#resetBtn').click();
      await expect(page.locator('#playLabel')).toHaveText('Play');

      // Click Play to start the sequence
      await page.locator('#playPause').click();
      await expect(page.locator('#playLabel')).toHaveText('Pause');

      // The ACCESS_SEQUENCE contains values that will cause faults and eventually evictions.
      // We will wait for a few toast events to observe faults and hits.
      // Wait for 3 events (could be HIT or PAGE FAULT); ensure toast appears sequentially
      const observedTexts = [];
      for (let i = 0; i < 3; i++) {
        const t = await waitForToastText(page, 10000);
        observedTexts.push(t);
      }

      // At least one of the observed toasts should indicate either "PAGE FAULT" or "HIT"
      expect(observedTexts.length).toBeGreaterThanOrEqual(1);
      const hasFault = observedTexts.some(t => /PAGE FAULT/i.test(t));
      const hasHit = observedTexts.some(t => /HIT:/i.test(t) || /HIT/i.test(t));
      expect(hasFault || hasHit).toBe(true);

      // Pause the sequence to stop further actions
      await page.locator('#playPause').click();
      await expect(page.locator('#playLabel')).toHaveText('Play');

      // Validate that table and frames UI reflect a consistent mapping state (no undefined labels)
      const entries = page.locator('#pageTable .entry .status div').nth(1);
      // Ensure entries exist and are readable
      await expect(page.locator('#pageTable .entry')).toHaveCount(8);
      // Validate frames show either 'free' or 'P<number>' text
      const frameCount = await page.locator('#frames .frame').count();
      for (let i = 0; i < frameCount; i++) {
        const text = await page.locator('#frame-' + i + ' .muted').innerText();
        expect(typeof text).toBe('string');
        expect(text.length).toBeGreaterThanOrEqual(1);
      }

      // Ensure no runtime errors during the sequence steps
      expect(pageErrors.length, `pageErrors during sequence: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, `consoleErrors during sequence: ${JSON.stringify(consoleErrors)}`).toBe(0);
    });
  });

  test.describe('Edge cases, accessibility, and robustness', () => {
    test('Clicking Reset multiple times and interacting rapidly does not throw errors', async ({ page }) => {
      // Rapid interactions: click reset multiple times and toggle play/pause quickly
      for (let i = 0; i < 3; i++) {
        await page.locator('#resetBtn').click();
      }

      // Rapid play/pause
      await page.locator('#playPause').click();
      await page.locator('#playPause').click();
      await page.locator('#playPause').click();
      await page.locator('#playPause').click();

      // Press keys rapidly
      await page.keyboard.press('Space');
      await page.keyboard.press('Space');
      await page.keyboard.press('r');
      await page.keyboard.press('r');

      // Allow any async handlers to run briefly
      await page.waitForTimeout(600);

      // Assert no page errors nor console.error messages were produced
      expect(pageErrors.length, `pageErrors during rapid interactions: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, `consoleErrors during rapid interactions: ${JSON.stringify(consoleErrors)}`).toBe(0);
    });

    test('Accessibility: controls are focusable and usable via keyboard', async ({ page }) => {
      // Focus Play/Pause and use Enter/Space to activate
      await page.locator('#playPause').focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('#playLabel')).toHaveText('Pause');

      // Pause again with Space when focused on body
      await page.keyboard.press('Space');
      await expect(page.locator('#playLabel')).toHaveText('Play');

      // Focus Reset and press Enter to reset
      await page.locator('#resetBtn').focus();
      await page.keyboard.press('Enter');
      // Reset calls pause -> label should be 'Play'
      await expect(page.locator('#playLabel')).toHaveText('Play');

      // Ensure no runtime errors occurred during keyboard-driven interactions
      expect(pageErrors.length, `pageErrors during accessibility checks: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, `consoleErrors during accessibility checks: ${JSON.stringify(consoleErrors)}`).toBe(0);
    });
  });

  test.describe('Console and Runtime Error Observability', () => {
    test('No uncaught exceptions or console.error messages observed during a full interactions run', async ({ page }) => {
      // Perform a set of interactions covering main flows
      await page.locator('#playPause').click(); // start
      await waitForToastText(page, 10000);
      await page.locator('#playPause').click(); // pause
      await page.locator('#resetBtn').click(); // reset
      await page.keyboard.press('Space'); // start via space
      await waitForToastText(page, 10000);
      await page.keyboard.press('r'); // reset via key

      // Final check for runtime errors
      expect(pageErrors.length, `Final pageErrors: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
      const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMsgs.length, `Final consoleErrors: ${JSON.stringify(consoleErrorMsgs)}`).toBe(0);
    });
  });
});