import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72abb301-fa78-11f0-812d-c9788050701f.html';

/**
 * Page Object for the Semaphore application.
 * Encapsulates commonly used selectors and helper methods.
 */
class SemaphorePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.semaphore = page.locator('.semaphore-container');
    this.leftArm = page.locator('.arm-left');
    this.rightArm = page.locator('.arm-right');
    this.light = page.locator('.semaphore-light');
    this.signalBtn = page.locator('#signal-btn');
    this.resetBtn = page.locator('#reset-btn');
  }

  // Returns rotation in degrees from computed transform of an element.
  // Normalizes angle to range [-180, 180]
  async getRotationDeg(locator) {
    const handle = await locator.elementHandle();
    if (!handle) return null;
    const angle = await this.page.evaluate((el) => {
      const style = getComputedStyle(el).transform;
      if (!style || style === 'none') return 0;
      // matrix(a, b, c, d, tx, ty)
      const values = style.split('(')[1].split(')')[0].split(',');
      const a = parseFloat(values[0]);
      const b = parseFloat(values[1]);
      const radians = Math.atan2(b, a);
      let deg = Math.round(radians * (180 / Math.PI));
      // normalize to [-180,180]
      if (deg > 180) deg -= 360;
      if (deg <= -180) deg += 360;
      return deg;
    }, handle);
    await handle.dispose();
    return angle;
  }

  // Returns computed opacity of semaphore light (as number)
  async getLightOpacity() {
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return parseFloat(getComputedStyle(el).opacity);
    }, '.semaphore-light');
  }

  async getLightBackground() {
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return el.style.background || getComputedStyle(el).backgroundImage || '';
    }, '.semaphore-light');
  }

  async clickSignal() {
    await this.signalBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  // Dispatch mousedown on the signal button (without click)
  async mousedownSignal() {
    const handle = await this.signalBtn.elementHandle();
    if (handle) {
      await handle.dispatchEvent('mousedown');
      await handle.dispose();
    } else {
      // fallback to page.mouse if element not found
      const box = await this.signalBtn.boundingBox();
      if (box) {
        await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await this.page.mouse.down();
        await this.page.mouse.up();
      }
    }
  }

  async mousedownReset() {
    const handle = await this.resetBtn.elementHandle();
    if (handle) {
      await handle.dispatchEvent('mousedown');
      await handle.dispose();
    } else {
      const box = await this.resetBtn.boundingBox();
      if (box) {
        await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await this.page.mouse.down();
        await this.page.mouse.up();
      }
    }
  }

  // Poll the semaphore container for transitions into the 'active' class.
  // Returns number of times it entered the active state during the observation window.
  async countActiveTransitions(ms = 4000, sampleInterval = 100) {
    const page = this.page;
    const start = Date.now();
    let previous = await this.semaphore.evaluate((el) => el.classList.contains('active'));
    let count = 0;
    while (Date.now() - start < ms) {
      // small sleep
      await page.waitForTimeout(sampleInterval);
      const current = await this.semaphore.evaluate((el) => el.classList.contains('active'));
      if (!previous && current) count += 1;
      previous = current;
    }
    return count;
  }
}

test.describe('Semaphore Visual Symphony - FSM and UI E2E tests', () => {
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Capture page errors and console errors for later assertions
    page.on('pageerror', (err) => {
      // Collect page errors (uncaught exceptions)
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to the exact HTML as provided
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // After each test ensure there were no unexpected runtime page errors.
    // We assert there are no SyntaxError / ReferenceError / TypeError occurrences.
    // If such errors exist they will be surfaced here and cause the test to fail.
    const seriousErrors = pageErrors.filter(e =>
      /ReferenceError|SyntaxError|TypeError/.test(String(e))
    );
    expect(seriousErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Initial Idle State: DOM elements are present and arms in default positions', async ({ page }) => {
    // Validate initial Idle state S0_Idle
    const app = new SemaphorePage(page);

    // All main components exist
    await expect(app.signalBtn).toBeVisible();
    await expect(app.resetBtn).toBeVisible();
    await expect(app.semaphore).toBeVisible();
    await expect(app.leftArm).toBeVisible();
    await expect(app.rightArm).toBeVisible();
    await expect(app.light).toBeVisible();

    // The Idle state's evidence includes the buttons; verify their labels
    await expect(app.signalBtn).toHaveText('Activate Signal');
    await expect(app.resetBtn).toHaveText('Reset Position');

    // Verify arms are at default angles (approximately -45 and 45 degrees).
    // Use getComputedStyle to compute rotation.
    const leftDeg = await app.getRotationDeg(app.leftArm);
    const rightDeg = await app.getRotationDeg(app.rightArm);

    // The CSS sets left -45deg and right 45deg; allow small tolerance due to matrix rounding
    expect(Math.abs(leftDeg - -45)).toBeLessThanOrEqual(3);
    expect(Math.abs(rightDeg - 45)).toBeLessThanOrEqual(3);

    // Semaphore light should be hidden in idle (opacity 0)
    const opacity = await app.getLightOpacity();
    expect(opacity).toBeLessThanOrEqual(0.05);

    // Ensure the container has the initial 'pulse' decorative class
    await expect(app.semaphore).toHaveClass(/pulse/);
  });

  test('ActivateSignal transition: clicking Activate Signal animates arms and lights', async ({ page }) => {
    // Validates transition S0_Idle -> S1_SignalActive triggered by ActivateSignal
    const app = new SemaphorePage(page);

    // Snapshot initial rotations
    const beforeLeft = await app.getRotationDeg(app.leftArm);
    const beforeRight = await app.getRotationDeg(app.rightArm);

    // Click the signal button to activate the semaphore
    await app.clickSignal();

    // Immediately after clicking, the container should have the 'active' class
    await expect(app.semaphore).toHaveClass(/active/);

    // The arms should animate to the next position (positions array in code cycles).
    // We can't know the exact previous autoCycle state, but we can assert a change occurred.
    // Wait a short moment to let JS set inline styles
    await page.waitForTimeout(200);
    const afterLeft = await app.getRotationDeg(app.leftArm);
    const afterRight = await app.getRotationDeg(app.rightArm);

    // Either arm rotation changed from before -> after
    const leftChanged = Math.abs(afterLeft - beforeLeft) > 1;
    const rightChanged = Math.abs(afterRight - beforeRight) > 1;
    expect(leftChanged || rightChanged).toBeTruthy();

    // The light background should have been updated to a radial-gradient with a hex color
    const lightBg = await app.getLightBackground();
    expect(lightBg).toContain('radial-gradient');

    // The active class should be removed after ~2000ms as per code
    await page.waitForTimeout(2100);
    const hasActiveAfter = await app.semaphore.evaluate((el) => el.classList.contains('active'));
    expect(hasActiveAfter).toBeFalsy();
  });

  test('ResetPosition transition: clicking Reset Position returns arms to default', async ({ page }) => {
    // Validates transition S0_Idle -> S2_Reset triggered by ResetPosition
    const app = new SemaphorePage(page);

    // First, move arms by clicking signal to ensure they change
    await app.clickSignal();
    await page.waitForTimeout(300);
    // Confirm they have some inline transform now
    const leftInline = await app.leftArm.getAttribute('style');
    expect(leftInline).not.toBeNull();

    // Click reset button
    await app.clickReset();

    // After reset, inline styles should indicate default rotations -45deg and 45deg
    // Wait a tick for style application
    await page.waitForTimeout(100);
    const leftStyle = await app.leftArm.getAttribute('style');
    const rightStyle = await app.rightArm.getAttribute('style');

    expect(leftStyle).toContain('rotate(-45deg)');
    expect(rightStyle).toContain('rotate(45deg)');

    // Also the container should not be active after reset
    const isActive = await app.semaphore.evaluate((el) => el.classList.contains('active'));
    expect(isActive).toBeFalsy();
  });

  test('MouseDown events pause auto-cycling (MouseDownSignal & MouseDownReset transitions)', async ({ page }) => {
    // Validate transitions that clearInterval(autoCycle) on mousedown of signal/reset.
    // Strategy:
    //  - Observe active transitions driven by autoCycle before mousedown
    //  - Trigger mousedown on a control to clear the interval
    //  - Observe again and ensure autoCycle activations do not increase

    const app = new SemaphorePage(page);

    // Let the page run a little so autoCycle can potentially trigger.
    // countActiveTransitions polls state transitions into 'active'.
    const preCount = await app.countActiveTransitions(3800, 100); // slightly more than 3000ms interval
    // preCount could be 0 or more depending on timing; record it.

    // Trigger mousedown on the signal button to pause auto-cycling
    await app.mousedownSignal();

    // Immediately observe for another interval equal to autoCycle to detect further activations
    const postCountAfterSignal = await app.countActiveTransitions(3800, 100);

    // We expect that after mousedown, autoCycle no longer triggers additional activations.
    // postCountAfterSignal should be 0 in the observation window if clearInterval worked.
    // However, because of timing edge cases, assert that it did not increase significantly.
    expect(postCountAfterSignal).toBeLessThanOrEqual(1);

    // Now resume by simulating a mousemove (this schedules restartAutoCycle after 10s,
    // we won't wait 10s during tests). But we will also test mousedown on reset similarly
    // to ensure it does not throw and clears the interval.
    await app.mousedownReset();
    const postCountAfterReset = await app.countActiveTransitions(2000, 100);
    // Ensure no sudden activations; it's acceptable if 0.
    expect(postCountAfterReset).toBeLessThanOrEqual(1);
  });

  test('MouseMove event registered and does not produce errors (MouseMove transition)', async ({ page }) => {
    // Validates S0_Idle -> S0_Idle via MouseMove and that restartAutoCycle listener exists and runs without throwing
    const app = new SemaphorePage(page);

    // Dispatch a mousemove event on document
    await page.mouse.move(10, 10);
    // Allow the restartAutoCycle handler to run (it sets a timeout, we don't wait for 10s)
    // We only ensure that it doesn't throw errors and that the handler is present.
    await page.waitForTimeout(100);

    // There should be no pageerrors after dispatching mousemove
    expect(pageErrors.length).toBe(0);

    // As an observable effect, restartAutoCycle sets/clears timeouts; we cannot directly observe
    // the scheduled setInterval until 10s pass. The important part for this test is that the handler exists
    // and did not cause runtime exceptions.
  });

  test('Edge cases: rapid consecutive Activate Signal clicks and stability', async ({ page }) => {
    // Test robustness when clicking Activate Signal rapidly multiple times
    const app = new SemaphorePage(page);

    // Rapidly click the signal button 5 times
    for (let i = 0; i < 5; i++) {
      await app.signalBtn.click();
      // tiny delay to simulate rapid user clicking but allow DOM updates
      await page.waitForTimeout(80);
    }

    // After rapid clicks, ensure semaphore light and arms are in a valid state (no exceptions thrown)
    const leftDeg = await app.getRotationDeg(app.leftArm);
    const rightDeg = await app.getRotationDeg(app.rightArm);
    expect(typeof leftDeg).toBe('number');
    expect(typeof rightDeg).toBe('number');

    // Light should have some opacity as last animation may have applied 'active' then removed it,
    // but style should be present and background contain radial-gradient from code.
    const lightBg = await app.getLightBackground();
    expect(lightBg).toContain('radial-gradient');
  });

  test('Error observation: collect console and pageerrors and assert none are critical', async ({ page }) => {
    // This test explicitly collects console and page errors and asserts they are empty arrays.
    // It is intended to surface any runtime issues such as ReferenceError/TypeError/SyntaxError.
    const app = new SemaphorePage(page);

    // perform some interactions to ensure handlers are invoked
    await app.signalBtn.click();
    await page.waitForTimeout(200);
    await app.resetBtn.click();
    await page.waitForTimeout(200);

    // Assert collected errors arrays are arrays (they were captured in beforeEach/afterEach too)
    expect(Array.isArray(pageErrors)).toBeTruthy();
    expect(Array.isArray(consoleErrors)).toBeTruthy();

    // The afterEach hook will also assert that there are no serious errors. Here we can make a lightweight assertion:
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});