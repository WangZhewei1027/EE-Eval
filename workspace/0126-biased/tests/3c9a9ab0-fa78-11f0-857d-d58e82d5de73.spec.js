import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9a9ab0-fa78-11f0-857d-d58e82d5de73.html';

// Page Object encapsulating interactions and queries for the visual app
class SocketPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#btn-start');
    this.resetBtn = page.locator('#btn-reset');
    this.packet = page.locator('#data-packet');
    this.visual = page.locator('.visual');
  }

  // Navigate to the app and wait for initial elements
  async goto() {
    await this.page.goto(APP_URL);
    await this.startBtn.waitFor({ state: 'visible' });
    await this.packet.waitFor({ state: 'attached' });
  }

  // Return the inline transform value set on the packet element (as a string)
  async getPacketTransform() {
    return await this.page.evaluate(() => {
      const el = document.getElementById('data-packet');
      return el ? el.style.transform : null;
    });
  }

  // Return computed transform (useful if inline style isn't present)
  async getComputedPacketTransform() {
    return await this.page.evaluate(() => {
      const el = document.getElementById('data-packet');
      if (!el) return null;
      const style = window.getComputedStyle(el);
      return style.transform || style.getPropertyValue('transform');
    });
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async isStartDisabled() {
    return await this.startBtn.isDisabled();
  }

  async isResetDisabled() {
    return await this.resetBtn.isDisabled();
  }

  // Helper to sample the packet transform repeatedly over a duration and return sampled values
  async samplePacketTransforms(durationMs = 300, intervalMs = 80) {
    const samples = [];
    const end = Date.now() + durationMs;
    while (Date.now() < end) {
      samples.push(await this.getPacketTransform());
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return samples;
  }

  // Trigger a window resize event to exercise responsiveness logic
  async triggerResize(width = 800, height = 500) {
    await this.page.setViewportSize({ width, height });
    // Let app react with a tick
    await this.page.waitForTimeout(120);
  }
}

test.describe('Socket Programming Visual Concept — FSM and interactions', () => {
  let pageErrors;
  let consoleErrors;

  // Attach error/console listeners before each test to capture runtime issues
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    page.on('pageerror', (err) => {
      // Collect page errors (uncaught exceptions)
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      // Collect console.error messages for visibility into runtime issues
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });
  });

  // After each test assert that there were no fatal runtime errors or console error calls
  test.afterEach(async () => {
    // If there are page errors, show them in assertion error message
    expect(pageErrors.length, `Expected no uncaught page errors, found: ${pageErrors.length} - ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `Expected no console.error messages, found: ${consoleErrors.length} - ${consoleErrors.map(e => e.text).join('; ')}`).toBe(0);
  });

  test.describe('Idle State (S0_Idle) validations', () => {
    test('Initial page load should be in Idle state with packet reset and button states correct', async ({ page }) => {
      // This test validates the initial "Idle" state per FSM:
      // - resetPacketPosition() should have been called resulting in an initial inline transform
      // - Start button enabled, Reset button disabled
      const socketPage = new SocketPage(page);
      await socketPage.goto();

      // Assert button states as evidence of Idle state
      expect(await socketPage.isStartDisabled()).toBe(false); // btnStart.disabled = false
      expect(await socketPage.isResetDisabled()).toBe(true);  // btnReset.disabled = true

      // The JS sets an inline transform on the packet element during resetPacketPosition()
      const inlineTransform = await socketPage.getPacketTransform();
      expect(inlineTransform).toBe('translate(-50%, -50%) translate3d(-40px, -40px, 0)');

      // Also verify computed transform matches the inline value
      const computed = await socketPage.getComputedPacketTransform();
      // Computed may be "none" in some browsers if transform is inline; ensure it's not null
      expect(computed).toBeTruthy();
    });

    test('Reset button should be disabled and not actionable while idle (edge case)', async ({ page }) => {
      // Validates that in Idle state the Reset control is disabled and not interactive.
      const socketPage = new SocketPage(page);
      await socketPage.goto();

      // Ensure the reset button reports as disabled
      await expect(page.locator('#btn-reset')).toBeDisabled();

      // Attempting a user click on a disabled element should be prevented by Playwright.
      // We assert that clicking the disabled control throws an error rather than executing.
      let clickThrew = false;
      try {
        // This will typically throw because element is disabled/unenabled
        await page.locator('#btn-reset').click({ timeout: 500 });
      } catch (err) {
        clickThrew = true;
        // Confirm the thrown error indicates disabled or not enabled interaction
        expect(String(err.message)).toMatch(/disabled|not enabled|element is not enabled|not visible/i);
      }
      expect(clickThrew).toBe(true);
    });
  });

  test.describe('Flowing State (S1_Flowing) and transitions', () => {
    test('Clicking Start Flow transitions to Flowing state: buttons toggle and packet animates', async ({ page }) => {
      // Validates StartFlow event and S0 -> S1 transition:
      // - startFlow() should set btnStart.disabled = true and btnReset.disabled = false
      // - packet should begin moving along the paths (transform should change over time)
      const socketPage = new SocketPage(page);
      await socketPage.goto();

      // Capture initial transform
      const before = await socketPage.getPacketTransform();
      expect(before).toBe('translate(-50%, -50%) translate3d(-40px, -40px, 0)');

      // Click Start Flow
      await socketPage.clickStart();

      // Buttons evidence for Flowing state
      expect(await socketPage.isStartDisabled()).toBe(true);  // start disabled while flowing
      expect(await socketPage.isResetDisabled()).toBe(false); // reset enabled while flowing

      // Sample transforms over short time window; we expect movement
      const samples = await socketPage.samplePacketTransforms(600, 120);
      // At least one sample should differ from the initial transform, indicating animation progress
      const moved = samples.some(s => s && s !== before);
      expect(moved, `Expected packet transform to change over time after starting flow, samples: ${JSON.stringify(samples)}`).toBe(true);
    });

    test('Clicking Reset during Flowing transitions back to Idle: animation stops and packet reset', async ({ page }) => {
      // Validates S1 -> S0 transition via ResetFlow:
      // - resetFlow() should cancel animation and call resetPacketPosition()
      // - btnStart.disabled = false and btnReset.disabled = true after reset
      const socketPage = new SocketPage(page);
      await socketPage.goto();

      // Start the flow first
      await socketPage.clickStart();
      expect(await socketPage.isStartDisabled()).toBe(true);
      expect(await socketPage.isResetDisabled()).toBe(false);

      // Give it some time to move
      const movedSamples = await socketPage.samplePacketTransforms(500, 100);
      const initialAfterStart = movedSamples.length ? movedSamples[0] : null;
      // Ensure at least some movement happened
      const movedFlag = movedSamples.some(s => s && s !== 'translate(-50%, -50%) translate3d(-40px, -40px, 0)');
      expect(movedFlag).toBe(true);

      // Click Reset to return to Idle
      await socketPage.clickReset();

      // Buttons evidence for Idle state post-reset
      expect(await socketPage.isStartDisabled()).toBe(false);
      expect(await socketPage.isResetDisabled()).toBe(true);

      // Packet should be reset to the initial inline transform
      const afterReset = await socketPage.getPacketTransform();
      expect(afterReset).toBe('translate(-50%, -50%) translate3d(-40px, -40px, 0)');

      // Verify the packet is not moving anymore by sampling multiple values — they should be identical
      const postResetSamples = await socketPage.samplePacketTransforms(400, 120);
      const allSame = postResetSamples.every(s => s === afterReset);
      expect(allSame, `Expected packet to remain at reset position after reset, samples: ${JSON.stringify(postResetSamples)}`).toBe(true);
    });

    test('Window resize behavior: when idle resetPacketPosition keeps packet at reset; when animating resize should not freeze packet', async ({ page }) => {
      // Validate responsiveness logic:
      // - When not animating, resize triggers resetPacketPosition (packet remains at reset)
      // - When animating, resize should not force a reset (packet should still be moving)
      const socketPage = new SocketPage(page);
      await socketPage.goto();

      // Ensure idle: packet inline transform is reset
      const idleTransform = await socketPage.getPacketTransform();
      expect(idleTransform).toBe('translate(-50%, -50%) translate3d(-40px, -40px, 0)');

      // Resize while idle and verify transform remains reset
      await socketPage.triggerResize(700, 420);
      const afterResizeIdle = await socketPage.getPacketTransform();
      expect(afterResizeIdle).toBe('translate(-50%, -50%) translate3d(-40px, -40px, 0)');

      // Start animation
      await socketPage.clickStart();

      // Sample transforms to ensure movement exists
      const beforeResizeSamples = await socketPage.samplePacketTransforms(500, 120);
      const movedBeforeResize = beforeResizeSamples.some(s => s && s !== idleTransform);
      expect(movedBeforeResize).toBe(true);

      // Now trigger a resize while animating
      await socketPage.triggerResize(1000, 600);

      // Sample after resize to ensure animation continues (not reset to idle value)
      const afterResizeSamples = await socketPage.samplePacketTransforms(600, 120);
      const someDifferentFromIdle = afterResizeSamples.some(s => s && s !== idleTransform);
      expect(someDifferentFromIdle, `Expected packet to continue moving after resize while animating, samples: ${JSON.stringify(afterResizeSamples)}`).toBe(true);

      // Cleanup: reset to be polite to later tests
      await socketPage.clickReset();
      expect(await socketPage.isResetDisabled()).toBe(true);
    });
  });

  test.describe('Edge cases and interaction robustness', () => {
    test('Start button becomes disabled after starting - prevents duplicate starts', async ({ page }) => {
      // This test ensures UI prevents repeated start clicks by disabling the start control after activation.
      const socketPage = new SocketPage(page);
      await socketPage.goto();

      // Start and verify disabled
      await socketPage.clickStart();
      expect(await socketPage.isStartDisabled()).toBe(true);

      // Attempt to click start again - Playwright should prevent clicking a disabled control and throw.
      let secondClickErrored = false;
      try {
        await page.locator('#btn-start').click({ timeout: 500 });
      } catch (err) {
        secondClickErrored = true;
        expect(String(err.message)).toMatch(/disabled|not enabled|not clickable|not visible/i);
      }
      expect(secondClickErrored).toBe(true);

      // Cleanup
      await socketPage.clickReset();
    });

    test('Application exposes no unexpected global errors on startup (sanity check)', async ({ page }) => {
      // This test simply loads the page and ensures there are no uncaught reference/type/syntax errors emitted to the page.
      // It's intentionally minimal: we do not modify or patch the page under test.
      const socketPage = new SocketPage(page);
      await socketPage.goto();

      // Basic sanity checks for presence of main DOM nodes
      await expect(page.locator('#socket-client')).toBeVisible();
      await expect(page.locator('#socket-server')).toBeVisible();
      await expect(page.locator('svg.connections')).toBeVisible();

      // No explicit asserts here for exceptions since afterEach asserts no page errors/console errors were collected.
    });
  });
});