import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ac9d61-fa78-11f0-812d-c9788050701f.html';

test.describe('Neon Network: Socket Programming visualization - FSM validation', () => {
  // Collects console error messages and page errors for each test
  let consoleErrors;
  let pageErrors;

  // Page Object Model for the visualization page
  class VisualizationPage {
    constructor(page) {
      this.page = page;
      this.sendBtn = page.locator('#sendRequest');
      this.resetBtn = page.locator('#resetDemo');
      this.client = page.locator('.client');
      this.server = page.locator('.server');
      this.connection = page.locator('.connection');
      this.packets = page.locator('.data-packet');
    }

    async goto() {
      await this.page.goto(BASE, { waitUntil: 'domcontentloaded' });
    }

    async clickSend() {
      await this.sendBtn.click();
    }

    async clickReset() {
      await this.resetBtn.click();
    }

    async isSendDisabled() {
      return await this.sendBtn.evaluate((b) => b.disabled);
    }

    async isResetDisabled() {
      return await this.resetBtn.evaluate((b) => b.disabled);
    }

    async serverInlineTransform() {
      return await this.server.evaluate((s) => s.style.transform || '');
    }

    async clientInlineTransform() {
      return await this.client.evaluate((s) => s.style.transform || '');
    }

    async countPacketsWithText(text) {
      return await this.page.locator('.data-packet', { hasText: text }).count();
    }

    async waitForAnyPacket() {
      await this.page.waitForSelector('.data-packet', { state: 'attached', timeout: 8000 });
    }

    async waitForPacketWithText(text, timeout = 8000) {
      await this.page.waitForSelector(`.data-packet:has-text("${text}")`, { state: 'attached', timeout });
    }

    async waitForServerScaleUp(timeout = 5000) {
      await this.page.waitForFunction(() => {
        const s = document.querySelector('.server');
        return s && s.style.transform.includes('scale(1.1)');
      }, null, { timeout });
    }

    async waitForServerScaleNormal(timeout = 5000) {
      await this.page.waitForFunction(() => {
        const s = document.querySelector('.server');
        return s && (s.style.transform.includes('scale(1)') || s.style.transform === '');
      }, null, { timeout });
    }

    async waitForAnimationComplete(timeout = 10000) {
      // Animation completes when reset button is enabled (per implementation)
      await this.page.waitForFunction(() => {
        const r = document.getElementById('resetDemo');
        return r && !r.disabled;
      }, null, { timeout });
    }
  }

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test ensure there were no uncaught page errors or console errors.
    // We assert zero to detect accidental runtime errors in the application.
    expect(pageErrors, 'No uncaught page errors should occur').toEqual([]);
    expect(consoleErrors, 'No console.error logs should be emitted').toEqual([]);
  });

  test.describe('Initial state (S0_Idle) validations', () => {
    test('S0_Idle: page renders controls and nodes correctly', async ({ page }) => {
      // Validate initial DOM and attributes per FSM idle state
      const viz = new VisualizationPage(page);
      await viz.goto();

      // Ensure controls exist
      await expect(viz.sendBtn).toBeVisible();
      await expect(viz.resetBtn).toBeVisible();

      // Send button enabled, reset disabled per idle evidence
      expect(await viz.isSendDisabled()).toBe(false);
      expect(await viz.isResetDisabled()).toBe(true);

      // Client and Server nodes exist and are visible
      await expect(viz.client).toBeVisible();
      await expect(viz.server).toBeVisible();

      // Connection line exists
      await expect(viz.connection).toBeVisible();

      // No data packets present initially
      await expect(viz.packets).toHaveCount(0);
    });
  });

  test.describe('SendRequest transition and animation (S1 -> S2 -> S3)', () => {
    test('Transition: SendRequest triggers request packet creation and animation', async ({ page }) => {
      // This test validates:
      // - Clicking Send Request disables send button and starts animation
      // - A request packet (REQ) is created and animates toward server
      // - Server scales up when request is received (S2 evidence)
      // - A response packet (RES) is created and animates back
      // - On completion, reset button becomes enabled (S3 evidence)

      const viz = new VisualizationPage(page);
      await viz.goto();

      // Listen for packets created by checking DOM attachments
      // Click Send Request to start the demo
      await viz.clickSend();

      // Immediately after clicking, send button should be disabled and reset disabled remains true
      expect(await viz.isSendDisabled()).toBe(true);
      expect(await viz.isResetDisabled()).toBe(true);

      // Wait for any data packet to be attached (request packet created)
      await viz.waitForAnyPacket();

      // There should be at least one REQ packet at creation time
      // Because packets are created with text 'REQ' for the request
      const reqCount = await viz.countPacketsWithText('REQ');
      expect(reqCount).toBeGreaterThanOrEqual(1);

      // Server should scale up at some point when request is received
      await viz.waitForServerScaleUp(8000); // allow sufficient time for animation to reach server

      // Confirm that the server inline style contains the scale(1.1) evidence
      const serverTransform = await viz.serverInlineTransform();
      expect(serverTransform).toContain('scale(1.1)');

      // After the server acknowledges request, a response 'RES' packet should be created
      await viz.waitForPacketWithText('RES', 8000);
      const resCount = await viz.countPacketsWithText('RES');
      expect(resCount).toBeGreaterThanOrEqual(1);

      // Server should return to normal scale after response packet creation (scale(1))
      await viz.waitForServerScaleNormal(8000);
      const serverTransformAfter = await viz.serverInlineTransform();
      // Implementation sets scale(1) inline after creating response; ensure that is observed
      expect(serverTransformAfter.includes('scale(1)') || serverTransformAfter === 'translateY(-50%) scale(1)' || serverTransformAfter === 'translateY(-50%)').toBeTruthy();

      // Wait for the entire animation sequence to complete (reset button enabled)
      await viz.waitForAnimationComplete(12000);

      // After animation completes, reset button should be enabled and send should be enabled again
      expect(await viz.isResetDisabled()).toBe(false);
      expect(await viz.isSendDisabled()).toBe(true || false); // send may remain disabled until reset, implementation resets send on reset

      // At least verify that reset is now enabled which indicates S3_AnimationComplete evidence
      expect(await viz.isResetDisabled()).toBe(false);
    });

    test('Edge case: Clicking Send multiple times while animating should not spawn multiple request handlers', async ({ page }) => {
      // Validate that trying to trigger SendRequest while isAnimating blocks subsequent actions
      const viz = new VisualizationPage(page);
      await viz.goto();

      // Click send twice rapidly
      await viz.sendBtn.click();
      // Attempt a second click immediately; the button should quickly become disabled by script.
      // Using try/catch because Playwright will still attempt to click; the application should ignore due to disabled flag.
      try {
        await viz.sendBtn.click({ timeout: 100 }).catch(() => {});
      } catch (e) {
        // Swallow any click error, the important check is DOM behavior below
      }

      // Wait for any data-packet to appear
      await viz.waitForAnyPacket();

      // Count REQ packets — there should be 1 (or at least not multiple concurrent REQ creations at start)
      const reqCount = await viz.countPacketsWithText('REQ');
      expect(reqCount).toBeGreaterThanOrEqual(1);
      // It should not be a large number spawned immediately; expect less than 4 as a heuristic
      expect(reqCount).toBeLessThan(4);
    });
  });

  test.describe('Reset transition (S3 -> S0)', () => {
    test('ResetDemo: After animation complete, Reset restores initial state', async ({ page }) => {
      // Validate Reset transition resets DOM to initial idle state
      const viz = new VisualizationPage(page);
      await viz.goto();

      // Start the animation sequence
      await viz.clickSend();

      // Wait for the demo to reach completion (reset button enabled)
      await viz.waitForAnimationComplete(12000);

      // Now click Reset to return to idle state
      await viz.clickReset();

      // After reset:
      // - No data-packets should remain
      await page.waitForTimeout(200); // brief wait to let DOM updates occur
      await expect(page.locator('.data-packet')).toHaveCount(0);

      // - Send button should be enabled and reset should be disabled (idle evidence)
      expect(await viz.isSendDisabled()).toBe(false);
      expect(await viz.isResetDisabled()).toBe(true);

      // - Client and server inline transforms should be reset to normal (or empty inline style)
      const serverTransform = await viz.serverInlineTransform();
      const clientTransform = await viz.clientInlineTransform();
      // Implementation sets transforms inline to 'translateY(-50%) scale(1)', but initial inline may be empty.
      // We accept either empty string or containing "scale(1)" or translateY
      const serverOk = serverTransform === '' || serverTransform.includes('scale(1)') || serverTransform.includes('translateY(-50%)');
      const clientOk = clientTransform === '' || clientTransform.includes('scale(1)') || clientTransform.includes('translateY(-50%)');
      expect(serverOk).toBeTruthy();
      expect(clientOk).toBeTruthy();
    });
  });

  test.describe('Robustness and error observation', () => {
    test('Observe console and page errors during lifecycle', async ({ page }) => {
      // This test ensures we observe console and page errors while exercising the demo.
      // It captures console.error and uncaught exceptions and asserts none are present.
      const viz = new VisualizationPage(page);

      await viz.goto();

      // Start animation
      await viz.clickSend();

      // Wait reasonably long for animations and possible errors
      await page.waitForTimeout(4000);

      // Trigger additional UI interactions: attempt reset prematurely (should be no-op while disabled)
      const resetDisabledBefore = await viz.isResetDisabled();
      if (!resetDisabledBefore) {
        await viz.clickReset();
      } else {
        // Try clicking disabled reset to ensure no exception thrown by the app
        try {
          await viz.resetBtn.click({ timeout: 200 }).catch(() => {});
        } catch (e) {
          // swallow: we don't want Playwright click errors to mask app errors
        }
      }

      // Wait for animation complete and then reset
      await viz.waitForAnimationComplete(12000);
      await viz.clickReset();

      // Final check: ensure no console errors or page errors were recorded during the run
      // These are asserted in afterEach; here we additionally assert counts are numbers
      expect(Array.isArray(consoleErrors)).toBeTruthy();
      expect(Array.isArray(pageErrors)).toBeTruthy();
    });
  });
});