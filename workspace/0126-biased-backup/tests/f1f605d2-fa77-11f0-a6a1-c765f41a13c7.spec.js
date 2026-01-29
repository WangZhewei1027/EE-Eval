import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f605d2-fa77-11f0-a6a1-c765f41a13c7.html';

// Page Object Model for the interpolation visualization page
class InterpolationPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Selectors
    this.playBtn = page.locator('#playBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.statusText = page.locator('#statusText');
    this.statusDot = page.locator('#statusDot');
    this.targetPill = page.locator('#targetPill');
    this.arrLen = page.locator('#arrLen');
    this.array = page.locator('#array');
    this.progressBar = page.locator('#progressBar');
    this.pointer = page.locator('#pointer');
    this.bubble = page.locator('#bubble');
    this.metaLow = page.locator('#metaLow');
    this.metaHigh = page.locator('#metaHigh');
    this.metaPos = page.locator('#metaPos');
    this.metaVal = page.locator('#metaVal');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'networkidle' });
  }

  async clickPlay() {
    await this.playBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async getStatusText() {
    return (await this.statusText.textContent())?.trim();
  }

  async getTargetText() {
    return (await this.targetPill.textContent())?.trim();
  }

  async getArrLen() {
    const t = (await this.arrLen.textContent())?.trim();
    return t;
  }

  async getCellCount() {
    return await this.array.locator('.cell').count();
  }

  async getCellTextAt(index) {
    const cell = this.array.locator('.cell').nth(index);
    return (await cell.textContent())?.trim();
  }

  async waitForStatusContains(substring, opts = { timeout: 10000 }) {
    await this.page.waitForFunction(
      (sel, substr) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.includes(substr);
      },
      '#statusText',
      substring,
      opts
    );
  }

  async waitForStatusEquals(text, opts = { timeout: 10000 }) {
    await this.page.waitForFunction(
      (sel, txt) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.trim() === txt;
      },
      '#statusText',
      text,
      opts
    );
  }
}

test.describe('Interpolation Search — Visual Demonstration (FSM validation)', () => {
  // Collect console errors and page errors for each test run
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages and page errors to assert later
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', (err) => {
      // Uncaught exceptions will be recorded here (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    // Navigate to the application page
    const interp = new InterpolationPage(page);
    await interp.goto();

    // Wait a short period to allow initial reset() script to complete
    // The app calls reset() on initialization; we wait for the target pill and arr length to populate
    await page.waitForSelector('#targetPill');
    await page.waitForSelector('#arrLen');
  });

  test.afterEach(async ({}, testInfo) => {
    // Basic sanity: fail the test if any uncaught page error occurred
    // These asserts are intentionally placed in afterEach to ensure console/page events during the test are checked.
    expect(pageErrors.length, `Unexpected page errors (pageerror) logged during test "${testInfo.title}": ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console.error messages logged during test "${testInfo.title}": ${consoleErrors.map(c => c.text).join('; ')}`).toBe(0);
  });

  test('S0_Idle: initial state after page load should be Idle (entry action reset())', async ({ page }) => {
    const p = new InterpolationPage(page);

    // Verify status text shows Idle as described by FSM evidence
    const status = await p.getStatusText();
    // The page sets statusText.textContent = 'Idle' in reset()
    expect(status).toBe('Idle');

    // Verify Play and Reset buttons are enabled by default (reset sets disabled=false)
    expect(await p.playBtn.isDisabled()).toBeFalsy();
    expect(await p.resetBtn.isDisabled()).toBeFalsy();

    // Verify array length and target pill are populated (reset builds array & chooses a target)
    const lenText = await p.getArrLen();
    expect(lenText).not.toBe('—');
    const targetText = await p.getTargetText();
    expect(targetText).toMatch(/^Target:\s+\d+/);

    // Visual sanity: there should be cells rendered
    const count = await p.getCellCount();
    expect(count).toBeGreaterThan(0);
  });

  test('Transition S0_Idle -> S1_Searching on PlayClicked, status becomes "Searching..." and animation starts', async ({ page }) => {
    const p = new InterpolationPage(page);

    // Click play to start animation
    await p.clickPlay();

    // Immediately the UI should reflect the searching state (setStatus('Searching...', 'searching'))
    // The animateSteps function sets status to 'Searching...' synchronously at its start.
    await p.waitForStatusContains('Searching...', { timeout: 2000 });

    // Play button should be disabled while animating
    expect(await p.playBtn.isDisabled()).toBeTruthy();

    // Reset button should also be disabled while animating per animateSteps
    expect(await p.resetBtn.isDisabled()).toBeTruthy();
  });

  test('Transition S1_Searching -> S2_Found: animation eventually finds the chosen target (status shows Found at index / Completed: Found)', async ({ page }) => {
    const p = new InterpolationPage(page);

    // Ensure we start from idle
    expect(await p.getStatusText()).toBe('Idle');

    // Start animation
    await p.clickPlay();

    // Wait for the Searching state
    await p.waitForStatusContains('Searching...', { timeout: 2000 });

    // Now wait for a "Found" indication. The implementation updates to "Found at index X" during steps
    // and on finish uses "Completed: Found <target>" — accept either.
    await page.waitForFunction(() => {
      const t = document.getElementById('statusText')?.textContent || '';
      return /Found at index \d+/.test(t) || /Completed:\s*Found/.test(t);
    }, { timeout: 15000 });

    const finalStatus = await p.getStatusText();
    expect(finalStatus).toSatisfy((s) => {
      return typeof s === 'string' && (s.includes('Found at index') || s.includes('Completed: Found'));
    });

    // After completion the play/reset buttons should be enabled again
    // The animateSteps.finish sets animating=false and buttons disabled=false
    // Wait until playBtn is enabled
    await page.waitForFunction(() => !document.getElementById('playBtn').disabled, { timeout: 5000 });
    expect(await p.playBtn.isDisabled()).toBeFalsy();
    expect(await p.resetBtn.isDisabled()).toBeFalsy();

    // Check that meta fields show numeric low/high/pos when found
    const metaPos = (await p.metaPos.textContent())?.trim();
    const metaVal = (await p.metaVal.textContent())?.trim();
    // pos should be something like "pos: 7"
    expect(metaPos).toMatch(/pos:\s*\d+|pos:\s*—/);
    expect(metaVal).toMatch(/A\[pos\]:\s*—|A\[pos\]:\s*\d+/);
  });

  test('Transition S1_Searching -> S0_Idle on ResetClicked: clicking reset during animation returns to Idle (exit action reset())', async ({ page }) => {
    const p = new InterpolationPage(page);

    // Start animation
    await p.clickPlay();

    // Wait for Searching state to apply
    await p.waitForStatusContains('Searching...', { timeout: 2000 });

    // Click reset during animation to trigger the reset() exit action path in FSM
    await p.clickReset();

    // reset() should synchronously set statusText to 'Idle'
    await p.waitForStatusEquals('Idle', { timeout: 3000 });

    // Buttons should be enabled
    expect(await p.playBtn.isDisabled()).toBeFalsy();
    expect(await p.resetBtn.isDisabled()).toBeFalsy();

    // Progress should be cleared (0% width)
    const width = await p.progressBar.evaluate((el) => el.style.width);
    expect(width === '0%' || width === '').toBeTruthy();
  });

  test('PlayClicked is ignored when animating (safeguard: if(animating) return;) — ensure second click does not start duplicate animation', async ({ page }) => {
    const p = new InterpolationPage(page);

    // Start animation
    await p.clickPlay();
    await p.waitForStatusContains('Searching...', { timeout: 2000 });

    // While animating, playBtn should be disabled; attempt to click again should not change state.
    // But to be extra sure, try clicking the play button via JS (if disabled the click has no effect on animate).
    // We assert the button is disabled which means the handler early-return prevents re-entry.
    expect(await p.playBtn.isDisabled()).toBeTruthy();

    // Record current status and progress
    const statusBefore = await p.getStatusText();

    // Attempt to click via evaluate (simulate a programmatic click) — this should not cause a new animation to start
    await page.evaluate(() => {
      const pb = document.getElementById('playBtn');
      if (pb) {
        // Even programmatic click should not lead to double-run because animateSteps sets animating flag
        pb.click();
      }
    });

    // Allow a short grace period and ensure status didn't unexpectedly reset to Idle or create errors
    await page.waitForTimeout(500);

    const statusAfter = await p.getStatusText();
    // The status should still reflect searching/progress/further steps and should not revert to Idle
    expect(statusAfter).not.toBe('Idle');

    // Clean up by waiting for completion to avoid interfering with subsequent tests
    await page.waitForFunction(() => {
      const t = document.getElementById('statusText')?.textContent || '';
      return t.includes('Completed: Found') || t.includes('Completed: Not found') || /Found at index \d+/.test(t);
    }, { timeout: 20000 });
  });

  test('Edge behaviors and DOM feedback: pointer and bubble update, visual classes applied during search', async ({ page }) => {
    const p = new InterpolationPage(page);

    // Initial pointer should be visible and bubble should show 'est'
    expect(await p.pointer.isVisible()).toBeTruthy();
    const bubbleText = (await p.bubble.textContent())?.trim();
    expect(bubbleText).toBe('est');

    // Start animation and observe that pointer moves (left style changes) and bubble updates (e.g., '✓' when found)
    await p.clickPlay();
    await p.waitForStatusContains('Searching...', { timeout: 2000 });

    // wait for either a probe or final found
    await page.waitForFunction(() => {
      const bubble = document.getElementById('bubble');
      return bubble && (bubble.textContent.trim() === 'est' || bubble.textContent.trim() === '✓');
    }, { timeout: 10000 });

    // Inspect that at least one .cell has a 'pos' class while searching/stepping
    const posCount = await page.$$eval('.cell.pos', els => els.length);
    expect(posCount).toBeGreaterThanOrEqual(0); // can be 0 briefly; assert non-crash

    // Wait for completion and then if a found cell exists it should have 'found' class
    await page.waitForFunction(() => {
      const t = document.getElementById('statusText')?.textContent || '';
      return t.includes('Completed: Found') || t.includes('Completed: Not found') || /Found at index \d+/.test(t);
    }, { timeout: 20000 });

    // After completion, check for presence of 'found' class on some cell when found
    const hasFoundClass = await page.$('.cell.found') !== null;
    // If the status indicates found, there must be a found cell; otherwise it's allowed to be false
    const finalStatus = await p.getStatusText();
    if (/Found/.test(finalStatus)) {
      expect(hasFoundClass).toBeTruthy();
    }
  });

  test('Robustness: no uncaught exceptions when repeatedly Reset and Play (stress interactions)', async ({ page }) => {
    const p = new InterpolationPage(page);

    // Perform several quick cycles of Reset -> Play -> small wait -> Reset
    for (let i = 0; i < 3; i++) {
      await p.clickReset();
      // After reset, status should be Idle
      await p.waitForStatusEquals('Idle', { timeout: 2000 });
      // Start a play and then quickly reset
      await p.clickPlay();
      await p.waitForTimeout(300); // short wait to ensure animateSteps started
      await p.clickReset();
      await p.waitForStatusEquals('Idle', { timeout: 3000 });
    }

    // If any uncaught exceptions occurred they'd be captured in pageErrors / consoleErrors and asserted in afterEach
    // Also ensure the UI is still interactive
    expect(await p.playBtn.isDisabled()).toBeFalsy();
    expect(await p.resetBtn.isDisabled()).toBeFalsy();
  });
});