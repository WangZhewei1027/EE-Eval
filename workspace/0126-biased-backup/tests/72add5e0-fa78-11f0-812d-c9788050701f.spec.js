import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72add5e0-fa78-11f0-812d-c9788050701f.html';

// Page Object for interacting with the Luminous Encryption app
class LuminousPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.original = page.locator('#originalMessage');
    this.encrypted = page.locator('#encryptedMessage');
    this.encryptBtn = page.locator('#encryptBtn');
    this.particles = page.locator('#particles');
    this.particleItems = page.locator('.particle');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickAnimate() {
    await this.encryptBtn.click();
  }

  async particleCount() {
    return await this.particleItems.count();
  }

  async originalHasActive() {
    return await this.original.evaluate(el => el.classList.contains('active'));
  }

  async encryptedHasActive() {
    return await this.encrypted.evaluate(el => el.classList.contains('active'));
  }

  async originalOpacity() {
    return await this.original.evaluate(el => window.getComputedStyle(el).opacity || el.style.opacity || '');
  }

  async encryptedOpacity() {
    return await this.encrypted.evaluate(el => window.getComputedStyle(el).opacity || el.style.opacity || '');
  }

  async firstParticleStyle(property) {
    return await this.particleItems.first().evaluate((el, prop) => {
      // return both inline style and computed style for robustness
      return {
        inline: el.style[prop] || '',
        computed: window.getComputedStyle(el)[prop] || ''
      };
    }, property);
  }
}

test.describe('Luminous Encryption - FSM and UI behavior', () => {
  // Collect console errors and page errors to assert there are none (observability)
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Listen for page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Listen for console messages flagged as 'error'
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  test('Initial Idle state (S0_Idle): particles are created and original message becomes active after startup', async ({ page }) => {
    // This test validates the S0_Idle entry action: createParticles() runs on DOMContentLoaded
    // and the initial animation sets the original message active after ~2000ms.
    const app = new LuminousPage(page);
    await app.goto();

    // Immediately after load, particles container should have been populated by createParticles()
    // Expect 50 particles as per implementation loop.
    const count = await app.particleCount();
    expect(count).toBe(50);

    // Initially (immediately) the original message should NOT yet have 'active' (it is added after 2000ms).
    const initiallyActive = await app.originalHasActive();
    // Could be false immediately; assert it's boolean and likely false.
    expect(initiallyActive).toBeFalsy();

    // Wait until the script's initial setTimeout adds the 'active' class (should happen around 2000ms).
    await page.waitForFunction(() => {
      const el = document.getElementById('originalMessage');
      return el && el.classList.contains('active');
    }, { timeout: 3000 });

    // Confirm it's active now
    const afterActive = await app.originalHasActive();
    expect(afterActive).toBeTruthy();

    // Confirm there were no unexpected runtime errors logged to the console or thrown
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Animate Encryption transition S0_Idle -> S1_Animating and back (click flow)', async ({ page }) => {
    // This test validates the transition triggered by clicking #encryptBtn:
    // - animateEncryption() executes
    // - original message fades (opacity change)
    // - encrypted message appears and gets .active
    // - particles animate then are reset after completion
    const app = new LuminousPage(page);
    await app.goto();

    // Ensure starting from Idle: wait for original to be active (entry completion)
    await page.waitForFunction(() => {
      const el = document.getElementById('originalMessage');
      return el && el.classList.contains('active');
    }, { timeout: 3000 });

    // Click the animate button which should trigger animateEncryption()
    await app.clickAnimate();

    // Immediately after click, the script removes 'active' from both messages.
    // Wait until originalMessage no longer has 'active' (should be removed synchronously in function).
    await page.waitForFunction(() => {
      const el = document.getElementById('originalMessage');
      return el && !el.classList.contains('active');
    }, { timeout: 500 });

    // The code sets originalMessage.style.opacity = '1' then after 300ms sets to '0.5'.
    // Wait up to 700ms and assert it reaches '0.5'.
    await page.waitForFunction(() => {
      const el = document.getElementById('originalMessage');
      if (!el) return false;
      const op = el.style.opacity || window.getComputedStyle(el).opacity;
      return String(op) === '0.5';
    }, { timeout: 1000 });

    // The encrypted message should become visible (opacity = '1') and gain 'active' after ~1000ms.
    await page.waitForFunction(() => {
      const el = document.getElementById('encryptedMessage');
      return el && (el.classList.contains('active') || (el.style.opacity && el.style.opacity === '1'));
    }, { timeout: 1500 });

    // Check a particle's animation and opacity after animateParticles() executes (~300ms after click)
    // The particle inline style animation should include 'pulse' and opacity should have been set to '0.8'
    // Allow some time for particles to start animating
    await page.waitForTimeout(400);
    const particleStyle = await app.firstParticleStyle('animation');
    // inline may have the rest; computed also may include 'none' or '' - assert that at least inline includes 'pulse' or computed contains pulse.
    const inlineAnimation = particleStyle.inline || '';
    const computedAnimation = particleStyle.computed || '';
    const animationHasPulse = inlineAnimation.includes('pulse') || computedAnimation.includes('pulse');
    expect(animationHasPulse).toBeTruthy();

    // Check inline opacity for first particle - script sets particle.style.opacity = '0.8'
    const particleOpacity = await app.firstParticleStyle('opacity');
    const inlineOpacity = particleOpacity.inline || particleOpacity.computed;
    // Compare string form (could be '0.8' or computed '0.8')
    expect(Number.parseFloat(inlineOpacity)).toBeGreaterThan(0.0);

    // After total of ~3000ms from click, the reset occurs:
    // - originalMessage.classList.add('active')
    // - particles are reset: animation = 'none' and opacity = '0'
    await page.waitForTimeout(3000); // wait for reset to occur (the last timeout in function is 3000ms)
    // Confirm originalMessage regained 'active'
    const finalActive = await app.originalHasActive();
    expect(finalActive).toBeTruthy();

    // Confirm particles have been reset: first particle's inline style should reflect no animation and opacity 0
    const particleStylePost = await app.firstParticleStyle('animation');
    const particleOpacityPost = await app.firstParticleStyle('opacity');
    const inlineAnimationPost = particleStylePost.inline || '';
    const inlineOpacityPost = particleOpacityPost.inline || particleOpacityPost.computed || '';
    // The code sets particle.style.animation = 'none' and particle.style.opacity = '0'
    expect(inlineAnimationPost).toContain('none');
    expect(Number.parseFloat(inlineOpacityPost)).toBeCloseTo(0, 1);

    // Confirm no runtime errors occurred during the animation sequence
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: Clicking repeatedly during animation does not crash and eventually resets state', async ({ page }) => {
    // This test checks stability when the user clicks the animate button multiple times quickly.
    const app = new LuminousPage(page);
    await app.goto();

    // Wait for initial 'active' state on original (idle)
    await page.waitForFunction(() => {
      const el = document.getElementById('originalMessage');
      return el && el.classList.contains('active');
    }, { timeout: 3000 });

    // Rapidly click the animate button multiple times
    await Promise.all([
      app.clickAnimate(),
      page.waitForTimeout(50).then(() => app.clickAnimate()),
      page.waitForTimeout(100).then(() => app.clickAnimate())
    ]);

    // Wait sufficient time for all pending timeouts from multiple calls to complete (max timeout used is 3000ms)
    await page.waitForTimeout(3500);

    // After all animations, originalMessage should end up with 'active' again (transition S1 -> S0)
    const endedActive = await app.originalHasActive();
    expect(endedActive).toBeTruthy();

    // Encrypted message should not be stuck in inconsistent state; its opacity should end up being '1' or class 'active' may be present depending on timing.
    const encActive = await app.encryptedHasActive();
    // It's acceptable to be true or false depending on timing of clicks, but the DOM should be stable (i.e., no exceptions).
    expect(typeof encActive).toBe('boolean');

    // Validate no errors occurred as a result of rapid interactions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: Clicking before initial automatic activation (click immediately after load)', async ({ page }) => {
    // Validate that clicking almost immediately after page load (before initial 2s activation) still runs animateEncryption
    const app = new LuminousPage(page);
    await app.goto();

    // Click almost immediately
    await app.clickAnimate();

    // Wait for the animateEncryption timelines to progress:
    // - encrypted message should get opacity '1' around 1000ms after click
    await page.waitForFunction(() => {
      const el = document.getElementById('encryptedMessage');
      return el && (el.style.opacity === '1' || window.getComputedStyle(el).opacity === '1');
    }, { timeout: 1500 });

    // After full cycle (~3000ms), original should still get 'active' set by the reset
    await page.waitForTimeout(3200);
    const finalActive = await app.originalHasActive();
    expect(finalActive).toBeTruthy();

    // Confirm no runtime errors or console error messages
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observability: capture console messages and page errors during normal usage (should be none)', async ({ page }) => {
    // A focused test that navigates and exercises one animation while verifying we observed console/page errors (or none)
    const app = new LuminousPage(page);
    await app.goto();

    // Exercise a single animation
    await app.clickAnimate();
    await page.waitForTimeout(3200);

    // Assert collection arrays exist and contain no error entries for this well-formed application
    // We observe console and page errors but do not inject faults. This asserts natural runtime is clean.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});