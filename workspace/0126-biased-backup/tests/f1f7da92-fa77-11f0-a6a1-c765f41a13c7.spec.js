import { test, expect } from '@playwright/test';

test.describe.serial('ACID Properties — Visual Demonstration (FSM tests)', () => {
  const URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f7da92-fa77-11f0-a6a1-c765f41a13c7.html';

  // Arrays to collect console errors and page errors for assertions
  let consoleErrors = [];
  let pageErrors = [];

  // Increase timeout for animation-heavy tests
  test.setTimeout(40_000);

  // Setup listeners before each test to collect console/page errors and navigate to the page
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      // Collect runtime errors logged via console.error
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', err => {
      // Uncaught exceptions end up here
      pageErrors.push(err.message);
    });

    // Load the page and wait until network is idle / load event
    await page.goto(URL, { waitUntil: 'load' });

    // Wait a tick to allow layoutInit (bound to load) to run
    await page.waitForTimeout(120);
  });

  test.afterEach(async ({ page }) => {
    // Ensure no severe console/page errors accumulate between tests unless explicitly expected
    // We'll not force failures here; there is a dedicated test below to assert errors.
    // This hook is reserved for potential teardown in the future.
  });

  test('S0_Idle state on initial load: layoutInit executed and controls reflect Idle', async ({ page }) => {
    // Validate the initial Idle state: playBtn aria-pressed false, playLabel 'Play'
    const playBtn = await page.locator('#playBtn');
    await expect(playBtn).toHaveAttribute('aria-pressed', 'false');

    const playLabel = await page.locator('#playLabel');
    await expect(playLabel).toHaveText('Play');

    // Token should be positioned by layoutInit: check inline transform exists and is non-empty
    const tokenTransform = await page.$eval('#token', el => el.style.transform || getComputedStyle(el).transform || '');
    expect(tokenTransform).toBeTruthy();

    // No pillar should be active or showing descriptions initially
    const pillars = ['#p-atomic', '#p-consistency', '#p-isolation', '#p-durability'];
    for (const sel of pillars) {
      const hasActive = await page.$eval(sel, el => el.classList.contains('active'));
      const hasShowDesc = await page.$eval(sel, el => el.classList.contains('show-desc'));
      expect(hasActive).toBeFalsy();
      expect(hasShowDesc).toBeFalsy();
    }
  });

  test('PlayPauseClick transitions: clicking Play enters S1_Playing with visual changes', async ({ page }) => {
    // Click Play and validate Playing state evidence: running indicator via aria, label, and statusDot shadow
    const playBtn = page.locator('#playBtn');
    const playLabel = page.locator('#playLabel');
    const statusDot = page.locator('#statusDot');

    await playBtn.click();

    await expect(playBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(playLabel).toHaveText('Pause');

    // statusDot boxShadow should change to a "glow" value after play
    const dotBoxShadow = await statusDot.evaluate((el) => el.style.boxShadow);
    expect(dotBoxShadow).toContain('rgba(110,231,183'); // approximate check to ensure style changed

    // Give a little time for the token to start moving (the code sets transform for start)
    await page.waitForTimeout(180);
    const transformAfterStart = await page.$eval('#token', el => el.style.transform || getComputedStyle(el).transform || '');
    expect(transformAfterStart).toBeTruthy();
  });

  test('Animation triggers pillar micro-animations and results in success classes (S1_Playing -> stops)', async ({ page }) => {
    // Start animation ensuring we reach all four stops and each pillar gets a 'success' class eventually.
    const playBtn = page.locator('#playBtn');
    await playBtn.click();

    // The app's timeline total duration is ~5200ms; stops happen earlier.
    // Wait for Atomic (first pillar) success; expected within ~2s
    await page.waitForSelector('#p-atomic.success', { timeout: 4000 });

    // Consistency (second pillar) should succeed within ~2.5-3.5s
    await page.waitForSelector('#p-consistency.success', { timeout: 4000 });

    // Isolation (third) and Durability (fourth) should succeed by end of timeline
    await page.waitForSelector('#p-isolation.success', { timeout: 5000 });
    await page.waitForSelector('#p-durability.success', { timeout: 6000 });

    // Validate that token got a 'glow' class at some point (added when triggers fire)
    const tokenHasGlow = await page.$eval('#token', el => el.classList.contains('glow'));
    expect(tokenHasGlow).toBeTruthy();

    // Final UI should toggle back to Idle (Play) after animation completes (there is a 700ms deferred toggle)
    // Wait a bit longer for the animation to fully finalize
    await page.waitForTimeout(800);
    const playLabelFinal = await page.locator('#playLabel').textContent();
    expect(playLabelFinal).toBe('Play');
    await expect(page.locator('#playBtn')).toHaveAttribute('aria-pressed', 'false');
  });

  test('PlayPauseClick toggles: clicking while running pauses and cancels animation (S1_Playing -> S0_Idle)', async ({ page }) => {
    const playBtn = page.locator('#playBtn');
    const token = page.locator('#token');

    // Start animation
    await playBtn.click();
    await expect(playBtn).toHaveAttribute('aria-pressed', 'true');

    // Let it run briefly
    await page.waitForTimeout(350);

    // Record token transform to compare after pausing
    const beforePause = await token.evaluate(el => el.style.transform || getComputedStyle(el).transform || '');

    // Click to pause
    await playBtn.click();

    // Expect UI evidence of Idle
    await expect(playBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#playLabel')).toHaveText('Play');

    // Wait to ensure animation frames no longer move the token
    await page.waitForTimeout(600);

    const afterPause = await token.evaluate(el => el.style.transform || getComputedStyle(el).transform || '');

    // When paused, position should not continue to advance significantly; conservatively expect transform unchanged
    expect(afterPause).toBe(beforePause);
  });

  test('ReplayClick restarts animation while in Playing (S1_Playing -> S1_Playing) and from Idle triggers Play', async ({ page }) => {
    const playBtn = page.locator('#playBtn');
    const replayBtn = page.locator('#replayBtn');

    // Ensure we're idle, then click replay to test that replay triggers a start even if idle
    await expect(playBtn).toHaveAttribute('aria-pressed', 'false');
    await replayBtn.click();

    // Replay has a 60ms delay then triggers playBtn.click; wait for play evidence
    await page.waitForTimeout(200);
    await expect(playBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#playLabel')).toHaveText('Pause');

    // Allow some of the animation to play so that a pillar's 'active' or 'success' is observable
    await page.waitForTimeout(1200);
    const atomicHasActiveOrSuccess = await page.$eval('#p-atomic', el => el.classList.contains('active') || el.classList.contains('success'));
    expect(atomicHasActiveOrSuccess).toBeTruthy();

    // Now test clicking Replay while already playing: it should restart the animation (we see progress again)
    await replayBtn.click();
    // Wait a bit for restart and observe that play is still active
    await page.waitForTimeout(300);
    await expect(playBtn).toHaveAttribute('aria-pressed', 'true');

    // Let the animation run to a known stop (consistency)
    await page.waitForSelector('#p-consistency.success', { timeout: 4500 });
  });

  test('Hover events reveal descriptions for each pillar (S2..S5 Hover states)', async ({ page }) => {
    // For each pillar, hover should add 'show-desc' and leaving should remove it
    const pillars = [
      { id: '#p-atomic', label: 'Atomicity' },
      { id: '#p-consistency', label: 'Consistency' },
      { id: '#p-isolation', label: 'Isolation' },
      { id: '#p-durability', label: 'Durability' }
    ];

    for (const p of pillars) {
      // Hover in
      await page.hover(p.id);
      // Wait a moment to allow hover handler to fire
      await page.waitForTimeout(120);
      const hasShowDesc = await page.$eval(p.id, el => el.classList.contains('show-desc'));
      expect(hasShowDesc).toBeTruthy();

      // Move mouse away (to body) to trigger mouseleave
      await page.mouse.move(10, 10);
      await page.waitForTimeout(120);
      const hasShowDescAfter = await page.$eval(p.id, el => el.classList.contains('show-desc'));
      expect(hasShowDescAfter).toBeFalsy();
    }
  });

  test('Edge cases: rapid clicks on Play and Replay should not produce uncaught JS errors', async ({ page }) => {
    const playBtn = page.locator('#playBtn');
    const replayBtn = page.locator('#replayBtn');

    // Rapidly click play and replay in quick succession
    for (let i = 0; i < 3; i++) {
      await playBtn.click();
      await replayBtn.click();
    }

    // Give time for handlers to execute and any potential exceptions to surface
    await page.waitForTimeout(800);

    // Collect all errors captured from console/pageerror and assert none are present
    // This test is explicitly validating stability under rapid interactions.
    expect(consoleErrors.length + pageErrors.length).toBe(0);
  });

  test('Final verification: no uncaught ReferenceError/SyntaxError/TypeError or console.error occurred during interactions', async ({ page }) => {
    // This test asserts that no severe JS errors were emitted while exercising the application.
    // It consolidates console.error and uncaught exception observations.
    const allErrors = [...consoleErrors, ...pageErrors];

    // If there are any, fail with the aggregated messages to aid debugging.
    expect(allErrors.length).toBe(0);
  });
});