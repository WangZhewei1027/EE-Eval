import { test, expect } from '@playwright/test';

test.setTimeout(180000); // Allow time for full animation to complete in long-running tests

// URL under test
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f653f0-fa77-11f0-a6a1-c765f41a13c7.html';

// Helper to create a page object for the UI controls and common queries
function pageObjects(page) {
  return {
    playBtn: page.locator('#playBtn'),
    resetBtn: page.locator('#resetBtn'),
    statusText: page.locator('#statusText'),
    statusDot: page.locator('#statusDot'),
    iterCount: page.locator('#iterCount'),
    explain: page.locator('#explain'),
    async nodeDistance(i) {
      return (await page.locator(`#dist-${i}`).textContent())?.trim();
    },
    async nodeClass(i) {
      return (await page.locator(`#node-${i}`).getAttribute('class')) || '';
    },
    async edgeClass(i) {
      return (await page.locator(`#edge-${i}`).getAttribute('class')) || '';
    }
  };
}

test.describe('Bellman-Ford visualization — FSM validation', () => {
  // Collect console and page errors for each test and assert there are none unexpected.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);
    // Ensure page loaded
    await expect(page).toHaveTitle(/Bellman-Ford/);
  });

  test.afterEach(async () => {
    // After each test, expect no uncaught page errors
    expect(pageErrors, 'No uncaught page errors should occur').toEqual([]);
    // No console errors expected by default
    const errors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errors, `No console errors/warnings expected, got: ${JSON.stringify(errors)}`).toEqual([]);
  });

  test.describe('Initial Idle state (S0_Idle)', () => {
    test('shows Idle UI state and initial distances', async ({ page }) => {
      const p = pageObjects(page);

      // Validate UI is in Idle state on load
      await expect(p.statusText).toHaveText('Idle');
      await expect(p.playBtn).toHaveText('Play');
      await expect(p.playBtn).toBeEnabled();
      await expect(p.iterCount).toHaveText('0 / 5');

      // Source node (A / node-0) should have distance 0, others Infinity (∞)
      const d0 = await p.nodeDistance(0);
      expect(d0).toBe('0');

      for (let i = 1; i < 6; i++) {
        const d = await p.nodeDistance(i);
        expect(d).toBe('∞');
      }

      // Source node should initially have an 'active' or 'inactive' class set by resetState (expected active)
      const cls0 = await p.nodeClass(0);
      expect(cls0.includes('active') || cls0.includes('inactive')).toBe(true);
    });
  });

  test.describe('Play/Pause interactions (PlayPauseClick event)', () => {
    test('transition S0_Idle -> S1_Running on Play click', async ({ page }) => {
      const p = pageObjects(page);

      // Click Play to start animation
      await p.playBtn.click();

      // Expect Running status and Play button text changed to Pause
      await page.waitForFunction(() => document.getElementById('statusText').textContent === 'Running');
      await expect(p.statusText).toHaveText('Running');
      await expect(p.playBtn).toHaveText('Pause');
    });

    test('transition S1_Running -> S2_Paused on Pause click', async ({ page }) => {
      const p = pageObjects(page);

      // Start running
      await p.playBtn.click();
      await page.waitForFunction(() => document.getElementById('statusText').textContent === 'Running');

      // Pause by clicking Play (toggles to Pause->Play)
      await p.playBtn.click();
      await page.waitForFunction(() => document.getElementById('statusText').textContent === 'Paused');

      // Validate paused UI
      await expect(p.statusText).toHaveText('Paused');
      await expect(p.playBtn).toHaveText('Play');
    });

    test('transition S2_Paused -> S1_Running on Play click (resume)', async ({ page }) => {
      const p = pageObjects(page);

      // Start -> Pause
      await p.playBtn.click();
      await page.waitForFunction(() => document.getElementById('statusText').textContent === 'Running');
      await p.playBtn.click();
      await page.waitForFunction(() => document.getElementById('statusText').textContent === 'Paused');

      // Resume
      await p.playBtn.click();
      await page.waitForFunction(() => document.getElementById('statusText').textContent === 'Running');

      await expect(p.statusText).toHaveText('Running');
      await expect(p.playBtn).toHaveText('Pause');
    });

    test('spacebar toggles Play/Pause as accessibility shortcut', async ({ page }) => {
      const p = pageObjects(page);

      // Ensure Idle, then press Space to play
      await expect(p.statusText).toHaveText('Idle');
      await page.keyboard.press('Space');
      await page.waitForFunction(() => document.getElementById('statusText').textContent === 'Running');
      await expect(p.statusText).toHaveText('Running');

      // Press Space to pause
      await page.keyboard.press('Space');
      await page.waitForFunction(() => document.getElementById('statusText').textContent === 'Paused');
      await expect(p.statusText).toHaveText('Paused');
    });
  });

  test.describe('Reset interactions (ResetClick event)', () => {
    test('Reset during Running stops animation and returns to Idle (resetState onEnter)', async ({ page }) => {
      const p = pageObjects(page);

      // Start the animation
      await p.playBtn.click();
      await page.waitForFunction(() => document.getElementById('statusText').textContent === 'Running');

      // Click reset while running
      await p.resetBtn.click();

      // After reset, expect Idle state observables
      await expect(p.statusText).toHaveText('Idle');
      await expect(p.playBtn).toHaveText('Play');
      await expect(p.iterCount).toHaveText('0 / 5');

      // Distances should be reset (source 0, others ∞)
      const d0 = await p.nodeDistance(0);
      expect(d0).toBe('0');
      for (let i = 1; i < 6; i++) {
        const d = await p.nodeDistance(i);
        expect(d).toBe('∞');
      }

      // The explain text should have been restored to the initial content (contains headline)
      const explainHtml = await p.explain.innerHTML();
      expect(explainHtml).toContain('How to read this visualization');
    });

    test('rapid multiple Reset clicks while Idle do not produce errors', async ({ page }) => {
      const p = pageObjects(page);

      // Click reset multiple times quickly
      for (let i = 0; i < 6; i++) {
        await p.resetBtn.click();
      }

      // State should still be idle and stable
      await expect(p.statusText).toHaveText('Idle');
      await expect(p.playBtn).toHaveText('Play');
    });
  });

  test.describe('Full animation lifecycle and final states (S1_Running -> S3_Completed / S4_NegativeCycleDetected)', () => {
    test('complete animation reaches Completed state (S3_Completed) and iterations count is max', async ({ page }) => {
      const p = pageObjects(page);

      // Start full animation run
      await p.playBtn.click();

      // Wait until Completed status is reached. This may take time; timeout increased globally.
      await page.waitForFunction(() => document.getElementById('statusText').textContent === 'Completed', { timeout: 170000 });

      // Validate final Completed observables
      await expect(p.statusText).toHaveText('Completed');
      await expect(p.playBtn).toHaveText('Play'); // animate() sets Play when finished
      await expect(p.iterCount).toHaveText('5 / 5');
      const statusDotClass = await p.statusDot.getAttribute('class');
      expect(statusDotClass).toContain('ok'); // Completed sets ok indicator

      // Verify that negative-cycle final message is NOT present in this run (given graph has none)
      const finalExplain = await p.explain.innerHTML();
      expect(finalExplain).not.toContain('Detected a negative-weight cycle');
      await expect(page.locator('text=Negative cycle detected!')).toHaveCount(0);

      // Check that no console errors were emitted (collected in afterEach as well)
      // Additional local assertion for clarity
      const errorMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorMsgs.length).toBe(0);
    });

    test('negative-cycle branch is not taken (S4_NegativeCycleDetected should not occur) for supplied graph', async ({ page }) => {
      const p = pageObjects(page);

      // Start and wait until Completed (ensures checkNegativeCycle executed)
      await p.playBtn.click();
      await page.waitForFunction(() => document.getElementById('statusText').textContent === 'Completed', { timeout: 170000 });

      // Confirm that 'Negative cycle detected!' text never became the current status
      const seenNeg = consoleMessages.some(m => m.text.includes('Negative cycle detected'));
      // It's possible the app doesn't log that exact phrase to console; instead ensure UI doesn't show it
      await expect(page.locator('text=Negative cycle detected!')).toHaveCount(0);

      // If any console message contains 'Negative cycle', fail explicitly (should not happen)
      expect(seenNeg).toBe(false);
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('rapid-play toggles do not throw and leave UI in stable state', async ({ page }) => {
      const p = pageObjects(page);

      // Rapidly click play many times
      for (let i = 0; i < 8; i++) {
        await p.playBtn.click();
      }

      // UI should be in either Running or Paused state; ensure no uncaught errors occurred
      const status = (await p.statusText.textContent())?.trim();
      expect(['Running', 'Paused', 'Idle', 'Completed']).toContain(status);

      // No console errors
      const errorMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorMsgs.length).toBe(0);
    });

    test('attempt to observe non-existent elements yields no unexpected exceptions', async ({ page }) => {
      // Intentionally query elements that are not present and ensure no pageerror is emitted
      // (This validates the app handles DOM queries gracefully)
      await page.evaluate(() => {
        // read some elements that don't exist (safe operations)
        const maybe = document.querySelector('#nonexistent-element');
        return maybe ? maybe.textContent : null;
      });

      // No page errors should have been captured
      expect(pageErrors.length).toBe(0);
    });
  });
});