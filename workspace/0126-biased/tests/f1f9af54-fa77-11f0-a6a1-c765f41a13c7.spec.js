import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f9af54-fa77-11f0-a6a1-c765f41a13c7.html';

// Page object to encapsulate interactions and queries against the app
class AppPage {
  constructor(page) {
    this.page = page;
    this.playBtn = page.locator('#playBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.token = page.locator('#token');
    this.tokenHalo = page.locator('#tokenHalo');
    this.paths = [
      '#p-msg-hash',
      '#p-hash-private',
      '#p-private-sign',
      '#p-sign-public',
      '#p-public-verify'
    ].map(sel => page.locator(sel));
    this.sHash = page.locator('#s-hash');
    this.sSign = page.locator('#s-sign');
    this.sSig = page.locator('#s-sig');
    this.sVerify = page.locator('#s-verify');
    this.hashValue = page.locator('#hashValue');
    this.sigVal = page.locator('#sigVal');
    this.verifyMark = page.locator('#verifyMark');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // wait a small amount to allow the page init to run (requestAnimationFrame entrance)
    await this.page.waitForTimeout(50);
  }

  async clickPlay() {
    await this.playBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async isPathActive(index) {
    return await this.paths[index].evaluate(el => el.classList.contains('active'));
  }

  async getTokenOpacity() {
    // token uses attribute opacity set on the element
    return await this.token.getAttribute('opacity');
  }

  async getTokenCxCy() {
    return await this.token.evaluate(el => ({ cx: el.getAttribute('cx'), cy: el.getAttribute('cy') }));
  }

  async isStepActive(stepLocator) {
    return await stepLocator.evaluate(el => el.classList.contains('active'));
  }

  async getHashText() {
    return (await this.hashValue.textContent())?.trim();
  }

  async getSigText() {
    return (await this.sigVal.textContent())?.trim();
  }

  async getVerifyMarkOpacity() {
    // verifyMark opacity is set via inline style
    return await this.verifyMark.evaluate(el => {
      // prefer inline style, fallback to computed style
      return el.style && el.style.opacity ? el.style.opacity : window.getComputedStyle(el).opacity;
    });
  }

  async isPlayDisabled() {
    return await this.playBtn.evaluate(el => el.disabled);
  }
}

test.describe('Digital Signatures — Visual Concept (FSM validation)', () => {
  // containers for console events and page errors captured during tests
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // capture console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // capture uncaught exceptions (page errors)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.describe('Initial State (S0_Idle) and resetVisuals on load', () => {
    test('should load the app and be in the Idle state with visuals reset', async ({ page }) => {
      const app = new AppPage(page);
      // Load the application page (exact URL)
      await app.goto();

      // Validate UI elements exist and initial state is Reset (resetVisuals called on init)
      // 1) Play button should be enabled (idle)
      expect(await app.isPlayDisabled()).toBe(false);

      // 2) Token should be hidden (opacity '0' attribute)
      const tokenOpacity = await app.getTokenOpacity();
      expect(tokenOpacity === '0' || tokenOpacity === null || tokenOpacity === '0.0').toBe(true);

      // 3) No flow paths should be active
      for (let i = 0; i < 5; i++) {
        expect(await app.isPathActive(i)).toBe(false);
      }

      // 4) Steps should not be active
      expect(await app.isStepActive(app.sHash)).toBe(false);
      expect(await app.isStepActive(app.sSign)).toBe(false);
      expect(await app.isStepActive(app.sSig)).toBe(false);
      expect(await app.isStepActive(app.sVerify)).toBe(false);

      // 5) Hash and signature starter values should be the reset defaults
      expect(await app.getHashText()).toBe('e3b0c442...');
      expect(await app.getSigText()).toBe('0x7f2a9c...');

      // 6) No uncaught page errors were thrown up to this point
      expect(pageErrors.length).toBe(0);

      // 7) Console may contain informative logs but there should be no console error entries
      const errorConsoleCount = consoleMessages.filter(m => m.type === 'error').length;
      expect(errorConsoleCount).toBe(0);
    });
  });

  test.describe('Play animation transition (S0_Idle -> S1_Animating) and sequence behavior', () => {
    test('clicking Play starts the animation, disables play, and flows through steps', async ({ page }) => {
      const app = new AppPage(page);
      await app.goto();

      // Comments: We will click Play and assert expected immediate changes (entry actions)
      await app.clickPlay();

      // Immediately, animating should have been set and playBtn disabled
      expect(await app.isPlayDisabled()).toBe(true);

      // Token should become visible (opacity attribute toggled to '1')
      // Wait up to 500ms for token to appear (animation starts)
      await page.waitForFunction(() => {
        const t = document.getElementById('token');
        return t && (t.getAttribute('opacity') === '1' || getComputedStyle(t).opacity !== '0');
      }, { timeout: 1000 });

      const tokenOpacityAfterStart = await app.getTokenOpacity();
      expect(tokenOpacityAfterStart === '1' || tokenOpacityAfterStart === '1.0').toBe(true);

      // The first path (message -> hash) should become active at the beginning of sequence
      await page.waitForFunction(() => document.getElementById('p-msg-hash').classList.contains('active'), { timeout: 1200 });
      expect(await app.isPathActive(0)).toBe(true);

      // The Hash step indicator should be active
      expect(await app.isStepActive(app.sHash)).toBe(true);

      // Hash text should animate/change from the initial static value - wait for a change
      await page.waitForFunction(() => {
        const el = document.getElementById('hashValue');
        return el && el.textContent && !el.textContent.trim().startsWith('e3b0c442');
      }, { timeout: 1500 });
      const hashTextDuring = await app.getHashText();
      expect(hashTextDuring).not.toBe('e3b0c442...');

      // Wait further to let the signing steps happen, and assert signature text updates
      // signature reveal sequence is later in the timeline - wait up to 4s
      await page.waitForFunction(() => {
        const s = document.getElementById('sigVal');
        return s && s.textContent && !s.textContent.trim().startsWith('0x7f2a9c');
      }, { timeout: 4000 });
      const sigDuring = await app.getSigText();
      expect(sigDuring).not.toBe('0x7f2a9c...');

      // Wait for verify mark to be shown near the end of the sequence
      await page.waitForFunction(() => {
        const vm = document.getElementById('verifyMark');
        return vm && (vm.style.opacity === '1' || window.getComputedStyle(vm).opacity === '1');
      }, { timeout: 7000 });

      const verifyOpacity = await app.getVerifyMarkOpacity();
      // The verify mark should have its opacity set to 1 when verification completes
      expect(parseFloat(String(verifyOpacity))).toBeGreaterThan(0.5);

      // After the sequence finalizes, play button should be re-enabled (animating -> false)
      // The page script sets a final timeout of ~1200ms after the last step; allow ample time
      await page.waitForTimeout(1300);
      expect(await app.isPlayDisabled()).toBe(false);

      // Again ensure no uncaught page errors or console errors appeared during the run
      expect(pageErrors.length).toBe(0);
      const errorConsoleCount = consoleMessages.filter(m => m.type === 'error').length;
      expect(errorConsoleCount).toBe(0);
    }, 20000); // this test may take some time given animation lengths

    test('clicking Play multiple times should not crash and playBtn remains disabled during animation', async ({ page }) => {
      const app = new AppPage(page);
      await app.goto();

      // Click Play twice quickly
      await app.clickPlay();
      // Immediately attempt another click - the handler should guard by animating variable; but we do it to exercise edge-case
      await app.clickPlay();

      // Play button should be disabled (first click) and stay disabled while animation runs
      expect(await app.isPlayDisabled()).toBe(true);

      // Wait briefly and ensure only one token is present and moving; token opacity should be 1
      await page.waitForFunction(() => {
        const t = document.getElementById('token');
        return t && t.getAttribute('opacity') === '1';
      }, { timeout: 1000 });

      // Ensure no duplicate problems caused console errors
      const errorConsoleCount = consoleMessages.filter(m => m.type === 'error').length;
      expect(errorConsoleCount).toBe(0);
      expect(pageErrors.length).toBe(0);

      // Let animation finish to avoid interfering with other tests
      await page.waitForTimeout(7000);
    }, 15000);
  });

  test.describe('Reset transition (S1_Animating -> S0_Idle) and resetVisuals behavior', () => {
    test('clicking Reset while animating stops animation and resets visuals', async ({ page }) => {
      const app = new AppPage(page);
      await app.goto();

      // Start animation
      await app.clickPlay();
      // Wait until token becomes visible (animation started)
      await page.waitForFunction(() => {
        const t = document.getElementById('token');
        return t && (t.getAttribute('opacity') === '1' || getComputedStyle(t).opacity !== '0');
      }, { timeout: 1200 });

      // Now click reset while animating is true
      await app.clickReset();

      // After reset, token should be hidden again
      await page.waitForFunction(() => {
        const t = document.getElementById('token');
        return t && (t.getAttribute('opacity') === '0' || getComputedStyle(t).opacity === '0');
      }, { timeout: 800 });

      const tokenOpacityAfterReset = await app.getTokenOpacity();
      expect(tokenOpacityAfterReset === '0' || tokenOpacityAfterReset === null).toBe(true);

      // Flow paths should no longer be active
      for (let i = 0; i < 5; i++) {
        expect(await app.isPathActive(i)).toBe(false);
      }

      // Play button should be enabled again after reset
      expect(await app.isPlayDisabled()).toBe(false);

      // Hash and signature should have been reset to defaults
      expect(await app.getHashText()).toBe('e3b0c442...');
      expect(await app.getSigText()).toBe('0x7f2a9c...');

      // Verify mark should be hidden
      expect(parseFloat(String(await app.getVerifyMarkOpacity()))).toBeLessThan(0.5);

      // Confirm no uncaught page errors from this scenario
      expect(pageErrors.length).toBe(0);
      const errorConsoleCount = consoleMessages.filter(m => m.type === 'error').length;
      expect(errorConsoleCount).toBe(0);
    });

    test('clicking Reset when already idle is a no-op and does not produce errors', async ({ page }) => {
      const app = new AppPage(page);
      await app.goto();

      // Already idle - click reset
      await app.clickReset();

      // State should remain reset: token hidden and play enabled
      const tokenOpacity = await app.getTokenOpacity();
      expect(tokenOpacity === '0' || tokenOpacity === null).toBe(true);
      expect(await app.isPlayDisabled()).toBe(false);

      // No errors on console or uncaught page errors
      expect(pageErrors.length).toBe(0);
      const errorConsoleCount = consoleMessages.filter(m => m.type === 'error').length;
      expect(errorConsoleCount).toBe(0);
    });
  });

  test.describe('Console & runtime error observation', () => {
    test('capture console messages and page errors during load and interactions', async ({ page }) => {
      const app = new AppPage(page);

      // Start with a clean navigation
      await app.goto();

      // Perform some interactions to exercise runtime code paths
      await app.clickPlay();

      // Wait short time so runtime async tasks (timeouts, animations) may produce console output or errors
      await page.waitForTimeout(600);

      // Click reset to exercise clearing timeouts and resetting visuals
      await app.clickReset();

      // Wait a moment for potential errors to surface
      await page.waitForTimeout(300);

      // At this point we assert that we successfully captured console messages array and pageErrors array exists
      expect(Array.isArray(consoleMessages)).toBe(true);
      expect(Array.isArray(pageErrors)).toBe(true);

      // We expect there to be no uncaught runtime errors of type ReferenceError/SyntaxError/TypeError.
      // If they happen they would be present in pageErrors; assert nothing critical occurred.
      // This assertion is intentionally permissive about benign logs (info/debug).
      const hasRuntimeExceptions = pageErrors.length > 0;
      if (hasRuntimeExceptions) {
        // If any pageErrors are present, fail the test with the captured error messages for debugging.
        // We include the stack/messages in the failure for visibility.
        const messages = pageErrors.map(e => String(e && e.message ? e.message : e)).join('\n---\n');
        throw new Error('Uncaught page errors were detected:\n' + messages);
      }

      // Ensure no console 'error' messages were logged
      const consoleErrorEntries = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorEntries.length).toBe(0);
    });
  });
});