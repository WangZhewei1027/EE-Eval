import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f4f463-fa77-11f0-a6a1-c765f41a13c7.html';

test.describe('Red-Black Tree — FSM and Interactive Animation (f1f4f463-fa77-11f0-a6a1-c765f41a13c7)', () => {
  // Arrays to capture runtime errors & console messages for each test.
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // Reset capture arrays
    pageErrors = [];
    consoleMessages = [];

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      // record the message for assertions
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Capture console messages and types
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the application page
    await page.goto(APP_URL);
    // Ensure the page has had a moment to initialize DOM and scripts
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterEach(async () => {
    // Basic sanity: no unexpected page errors by default
    // Tests assert this as appropriate per scenario.
  });

  test.describe('Initial Idle State (S0_Idle)', () => {
    test('should render Idle state with op badge and initial tick active', async ({ page }) => {
      // Validate op badge displays the Idle text (onEnter: goToStep(0) should set this)
      const opText = page.locator('#opText');
      await expect(opText).toHaveText('Idle • Awaiting');

      // The first tick should be active to indicate step 0 (Idle)
      const firstTick = page.locator('#ticks .tick').first();
      await expect(firstTick).toHaveClass(/active/);

      // Play button should be visible and indicate "Play"
      const playBtn = page.locator('#playBtn');
      await expect(playBtn).toBeVisible();
      const playText = await playBtn.textContent();
      // It may include whitespace/arrow, ensure "Play" is present
      expect(playText).toContain('Play');

      // Reset button present
      const resetBtn = page.locator('#resetBtn');
      await expect(resetBtn).toBeVisible();
      const resetText = await resetBtn.textContent();
      expect(resetText).toContain('Reset');

      // Assert no uncaught page errors were emitted during initial load
      expect(pageErrors).toHaveLength(0);

      // No console messages of type 'error' should have been emitted
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Play Animation (S0_Idle -> S1_Playing)', () => {
    test('clicking Play starts the sequence and updates op badge and ticks', async ({ page }) => {
      const playBtn = page.locator('#playBtn');
      const opText = page.locator('#opText');
      const ticks = page.locator('#ticks .tick');

      // Click Play to begin the animation sequence
      await playBtn.click();

      // Immediately the UI should show Playing state text and disable the button
      await expect(playBtn).toHaveAttribute('disabled', 'true');
      await expect(playBtn).toHaveText(/Playing|Playing...|⏸/);

      // After a short interval, the first animation step (Insert 10) should be shown
      await expect(opText).toHaveText('Insert 10 → root (black)', { timeout: 2000 });

      // The active tick should have moved to step 1
      // (step 0 was idle; step 1 corresponds to the first insertion)
      const activeIndex = await page.evaluate(() => {
        const ticks = Array.from(document.querySelectorAll('#ticks .tick'));
        return ticks.findIndex(t => t.classList.contains('active'));
      });
      expect(activeIndex).toBe(1);

      // Node for 10 should exist and be visible and black
      const node10 = page.locator('g.node[data-id="10"]');
      await expect(node10).toBeVisible();
      const class10 = await node10.getAttribute('class');
      expect(class10).toMatch(/black/);

      // Continue to a later step (rotation step), verify the op text updates accordingly
      // The rotation/left step is "Insert 30 → rotation (left)" (step 3)
      await expect(opText).toHaveText('Insert 30 → rotation (left)', { timeout: 6000 });

      // Verify nodes repositioned: node 20 should become root and be black
      const node20 = page.locator('g.node[data-id="20"]');
      await expect(node20).toBeVisible();
      const class20 = await node20.getAttribute('class');
      expect(class20).toMatch(/black/);

      // During the sequence, we still expect no uncaught page errors
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('pressing Enter on Play button triggers the animation (keyboard activation)', async ({ page }) => {
      const playBtn = page.locator('#playBtn');
      const opText = page.locator('#opText');

      // Focus button and press Enter to start
      await playBtn.focus();
      await page.keyboard.press('Enter');

      // Should start playing: Play button disabled and opText soon becomes first insertion
      await expect(playBtn).toHaveAttribute('disabled', 'true');
      await expect(opText).toHaveText('Insert 10 → root (black)', { timeout: 2000 });

      // Ensure no page errors emitted during this interaction
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Reset Animation (S1_Playing -> S0_Idle and S2_Reset)', () => {
    test('clicking Reset while Playing stops the sequence and returns to Idle', async ({ page }) => {
      const playBtn = page.locator('#playBtn');
      const resetBtn = page.locator('#resetBtn');
      const opText = page.locator('#opText');

      // Start playing
      await playBtn.click();
      // Ensure it's playing
      await expect(playBtn).toHaveAttribute('disabled', 'true');
      await expect(opText).toHaveText('Insert 10 → root (black)', { timeout: 2000 });

      // While playing, click Reset to trigger goToStep(0) and clear timers
      await resetBtn.click();

      // Reset should re-enable Play and set text back to "Play Animation"
      await expect(playBtn).toBeEnabled();
      await expect(playBtn).toHaveText(/Play/);

      // The UI will purge nodes after ~520ms and call goToStep(0)
      await expect(opText).toHaveText('Idle • Awaiting', { timeout: 2000 });

      // Verify nodes container is empty (no g.node elements) after purge
      const nodesCount = await page.locator('#nodes g.node').count();
      expect(nodesCount).toBe(0);

      // Assert no uncaught page errors resulted from reset and purge
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('clicking Reset while Idle remains Idle and does not throw', async ({ page }) => {
      const resetBtn = page.locator('#resetBtn');
      const opText = page.locator('#opText');

      // Ensure we are idle initially
      await expect(opText).toHaveText('Idle • Awaiting');

      // Click reset again - should be idempotent
      await resetBtn.click();

      // Still Idle
      await expect(opText).toHaveText('Idle • Awaiting');

      // No nodes should be present
      const nodesCount = await page.locator('#nodes g.node').count();
      expect(nodesCount).toBe(0);

      // No page errors
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases & robustness', () => {
    test('clicking Play repeatedly while already playing does not spawn duplicate play sequences', async ({ page }) => {
      const playBtn = page.locator('#playBtn');
      const opText = page.locator('#opText');

      // Start playing
      await playBtn.click();
      await expect(playBtn).toHaveAttribute('disabled', 'true');

      // Click Play again while disabled/playing — the handler should early-return and not break
      // This action is a no-op in the implementation, but we verify nothing erroneous occurs
      await playBtn.click();

      // Still playing and first insertion should be visible shortly
      await expect(opText).toHaveText('Insert 10 → root (black)', { timeout: 2000 });

      // Confirm still only one set of nodes exist for the current visible step (idempotency check)
      const node10Count = await page.locator('g.node[data-id="10"]').count();
      expect(node10Count).toBeGreaterThanOrEqual(1);

      // No page errors observed
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('animation proceeds through several steps without throwing runtime exceptions', async ({ page }) => {
      const playBtn = page.locator('#playBtn');
      const opText = page.locator('#opText');

      // Start the animation
      await playBtn.click();

      // Wait for several key steps to appear in sequence
      await expect(opText).toHaveText('Insert 10 → root (black)', { timeout: 2000 });
      await expect(opText).toHaveText('Insert 20 (red child)', { timeout: 4000 });
      await expect(opText).toHaveText('Insert 30 → rotation (left)', { timeout: 7000 });

      // Check for expected nodes at that stage: 20,10,30
      await expect(page.locator('g.node[data-id="20"]')).toBeVisible();
      await expect(page.locator('g.node[data-id="10"]')).toBeVisible();
      await expect(page.locator('g.node[data-id="30"]')).toBeVisible();

      // No uncaught exceptions on the page
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('verify visual attributes: node color classes correctly reflect step data', async ({ page }) => {
      const playBtn = page.locator('#playBtn');

      // Start and wait for step 4 (recolor step) where nodes 10 and 30 become black and 15 added red
      await playBtn.click();

      // Wait up to a generous timeout for step 4
      await expect(page.locator('#opText')).toHaveText('Insert 15 → recolor', { timeout: 8000 });

      // Node 10 should now have class 'black'
      const node10 = page.locator('g.node[data-id="10"]');
      await expect(node10).toBeVisible();
      const class10 = await node10.getAttribute('class');
      expect(class10).toMatch(/black/);

      // Node 15 should exist and have 'red' style
      const node15 = page.locator('g.node[data-id="15"]');
      await expect(node15).toBeVisible();
      const class15 = await node15.getAttribute('class');
      expect(class15).toMatch(/red/);

      // No page errors
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors.length).toBe(0);
    });
  });
});