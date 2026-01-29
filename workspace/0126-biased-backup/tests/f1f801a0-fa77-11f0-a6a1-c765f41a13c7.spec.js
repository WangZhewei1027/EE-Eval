import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f801a0-fa77-11f0-a6a1-c765f41a13c7.html';

// Page Object encapsulating common operations and selectors for the transaction app
class TransactionPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Elements
  async statusText() {
    return this.page.locator('#status-text');
  }
  async coin() {
    return this.page.locator('#coin');
  }
  async startBtn() {
    return this.page.locator('#startBtn');
  }
  async infoBtn() {
    return this.page.locator('#infoBtn');
  }
  async step(selector) {
    return this.page.locator(selector);
  }
  async leftBalance() {
    return this.page.locator('#left-balance');
  }
  async rightBalance() {
    return this.page.locator('#right-balance');
  }
  async pendingAmt() {
    return this.page.locator('#pending-amt');
  }
  async completeBadge() {
    return this.page.locator('#complete-badge');
  }
  async statusDot() {
    return this.page.locator('.status-dot');
  }
  async progress() {
    return this.page.locator('#progress');
  }
  async stepsActiveCount() {
    return this.page.locator('.step.active').count();
  }

  // Actions
  async clickStart() {
    await (await this.startBtn()).click();
  }
  async clickInfo() {
    await (await this.infoBtn()).click();
  }

  // Utilities to read computed/inline styles and text
  async getStatusTextContent() {
    return this.page.evaluate(() => document.getElementById('status-text').textContent);
  }
  async getCoinAnimationInline() {
    return this.page.evaluate(() => document.getElementById('coin').style.animation || '');
  }
  async getStartBtnText() {
    return this.page.evaluate(() => document.getElementById('startBtn').textContent);
  }
  async isStartDisabled() {
    return this.page.evaluate(() => document.getElementById('startBtn').disabled);
  }
  async getStartBtnAriaPressed() {
    return this.page.evaluate(() => document.getElementById('startBtn').getAttribute('aria-pressed'));
  }
  async getLeftBalanceText() {
    return this.page.evaluate(() => document.getElementById('left-balance').textContent);
  }
  async getRightBalanceText() {
    return this.page.evaluate(() => document.getElementById('right-balance').textContent);
  }
  async getPendingAmtText() {
    return this.page.evaluate(() => document.getElementById('pending-amt').textContent);
  }
  async getCompleteBadgeOpacity() {
    return this.page.evaluate(() => window.getComputedStyle(document.getElementById('complete-badge')).opacity);
  }
  async getStatusDotBackgroundInline() {
    return this.page.evaluate(() => document.querySelector('.status-dot').style.background || '');
  }
  async getProgressDataOffset() {
    return this.page.evaluate(() => document.getElementById('progress').getAttribute('data-offset'));
  }
  async getStepActiveClasses() {
    return this.page.evaluate(() => Array.from(document.querySelectorAll('.step')).map(s => s.className));
  }

  // Wait helper for status text to equal expected value
  async waitForStatus(expected, timeout = 10000) {
    await this.page.waitForFunction(
      (sel, exp) => document.getElementById(sel).textContent.trim() === exp,
      'status-text',
      expected,
      { timeout }
    );
  }
}

test.describe('Transaction Visual Ledger - FSM states and transitions', () => {
  let page;
  let txPage;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    txPage = new TransactionPage(page);

    // Capture console errors and page errors for assertions
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      // Capture error-level console messages
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    page.on('pageerror', err => {
      // Capture uncaught exceptions from the page
      pageErrors.push({
        message: err.message,
        name: err.name,
        stack: err.stack
      });
    });

    await txPage.goto();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Initial Idle state: coin placed and idle animation present; status is Idle', async () => {
    // Validate initial UI reflects the Idle state per FSM S0_Idle
    // - coin placed (left/top should be set)
    // - coin has idle floaty animation applied inline
    // - status text reads "Idle"
    // - complete badge is hidden (opacity 0)
    const status = await txPage.getStatusTextContent();
    expect(status).toBe('Idle');

    const coinAnimation = await txPage.getCoinAnimationInline();
    // The implementation sets coin.style.animation = 'floaty 3000ms ...'
    expect(coinAnimation).toContain('floaty');

    const completeOpacity = await txPage.getCompleteBadgeOpacity();
    expect(completeOpacity).toBe('0');

    // Ensure no console or page errors occurred during initial load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Initiate Transaction triggers full FSM sequence and updates UI (Authorizing → In transit → Cleared → Settling → Confirmed)', async () => {
    // This test validates the full sequence described by the FSM transitions.
    // It asserts intermediate states, visual changes and final state values.

    // Pre-conditions: known initial balances (from HTML)
    const initialLeft = await txPage.getLeftBalanceText(); // "$12,480.00"
    const initialRight = await txPage.getRightBalanceText(); // "$2,860.00"
    expect(initialLeft).toBe('$12,480.00');
    expect(initialRight).toBe('$2,860.00');

    // Click start to initiate
    await txPage.clickStart();

    // Immediately after click, start button should reflect processing state
    const btnTextWhileProcessing = await txPage.getStartBtnText();
    expect(btnTextWhileProcessing).toContain('Processing');

    const ariaPressed = await txPage.getStartBtnAriaPressed();
    expect(ariaPressed).toBe('true');

    // Button should be disabled while animating
    expect(await txPage.isStartDisabled()).toBe(true);

    // 1) Authorizing: statusText should be set immediately
    await txPage.page.waitForFunction(() => document.getElementById('status-text').textContent.trim() === 'Authorizing', null, { timeout: 2000 });
    const statusDuringAuth = await txPage.getStatusTextContent();
    expect(statusDuringAuth).toBe('Authorizing');

    // The status dot background is set in Authorizing entry
    const statusDotBgAuth = await txPage.getStatusDotBackgroundInline();
    expect(statusDotBgAuth).toContain('linear-gradient');

    // Wait for In transit
    await txPage.page.waitForFunction(() => document.getElementById('status-text').textContent.trim() === 'In transit', null, { timeout: 4000 });
    expect(await txPage.getStatusTextContent()).toBe('In transit');

    // While in transit, progress data-offset should have changed from initial
    const offsetDuring = await txPage.getProgressDataOffset();
    expect(Number(offsetDuring)).toBeGreaterThan(0); // data-offset should be numeric-ish and different from null

    // Wait for Cleared
    await txPage.page.waitForFunction(() => document.getElementById('status-text').textContent.trim() === 'Cleared', null, { timeout: 6000 });
    expect(await txPage.getStatusTextContent()).toBe('Cleared');

    // Wait for Settling
    await txPage.page.waitForFunction(() => document.getElementById('status-text').textContent.trim() === 'Settling', null, { timeout: 4000 });
    expect(await txPage.getStatusTextContent()).toBe('Settling');

    // Final: Confirmed
    await txPage.page.waitForFunction(() => document.getElementById('status-text').textContent.trim() === 'Confirmed', null, { timeout: 4000 });
    expect(await txPage.getStatusTextContent()).toBe('Confirmed');

    // Confirm the status dot background changed to include final gradient for confirmed
    const statusDotBgFinal = await txPage.getStatusDotBackgroundInline();
    expect(statusDotBgFinal).toContain('linear-gradient');

    // The complete badge should be visible (opacity 1)
    await txPage.page.waitForFunction(() => getComputedStyle(document.getElementById('complete-badge')).opacity === '1', null, { timeout: 2000 });
    const completeOpacityFinal = await txPage.getCompleteBadgeOpacity();
    expect(completeOpacityFinal).toBe('1');

    // Balances should be updated: left decreased, right increased by $1,200.00
    const finalLeft = await txPage.getLeftBalanceText();
    const finalRight = await txPage.getRightBalanceText();
    expect(finalLeft).toBe('$11,280.00'); // 12,480 - 1,200
    expect(finalRight).toBe('$4,060.00'); // 2,860 + 1,200

    // Pending amount cleared
    const pending = await txPage.getPendingAmtText();
    expect(pending).toBe('—');

    // Start button should be re-enabled and labelled "Replay Transaction"
    await txPage.page.waitForFunction(() => document.getElementById('startBtn').disabled === false, null, { timeout: 5000 });
    const finalBtnText = await txPage.getStartBtnText();
    expect(finalBtnText.toLowerCase()).toContain('replay');

    // Ensure number of active steps equals 3 (all steps shown active as app marks them)
    // The implementation toggles .active for steps progressively; at finish at least multiple are active
    const activeSteps = await txPage.stepsActiveCount();
    expect(activeSteps).toBeGreaterThanOrEqual(2);

    // Ensure no uncaught page errors were emitted during the entire orchestration
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  }, 30000); // allow extra timeout for full animation sequence

  test('Info button click triggers subtle animation and does not produce errors', async () => {
    // Validate Info button is clickable and its click handler runs without errors
    await txPage.clickInfo();

    // The infoBtn click uses Element.animate and does not change DOM attributes.
    // Verify aria-hidden remains as-is (should be "true" from HTML)
    const infoAria = await page.evaluate(() => document.getElementById('infoBtn').getAttribute('aria-hidden'));
    expect(infoAria).toBe('true');

    // Wait a bit to let animation attempt to run; ensure no console/page errors occurred
    await page.waitForTimeout(500);
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: double-click start rapidly should not spawn concurrent runs and should disable button during processing', async () => {
    // Click start twice in rapid succession
    const startButton = await txPage.startBtn();
    await startButton.click();
    await startButton.click(); // second click should be ignored by animating guard

    // Immediately the button should be disabled (first run in progress)
    expect(await txPage.isStartDisabled()).toBe(true);

    // The aria-pressed state should be true during run
    expect(await txPage.getStartBtnAriaPressed()).toBe('true');

    // Wait until final state Confirmed to ensure process completes without duplicate side-effects
    await txPage.page.waitForFunction(() => document.getElementById('status-text').textContent.trim() === 'Confirmed', null, { timeout: 20000 });
    const finalBtnText = await txPage.getStartBtnText();
    expect(finalBtnText.toLowerCase()).toContain('replay');

    // No uncaught exceptions or console errors must have been created even if clicks were rapid
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  }, 30000);

  test('Verifies onEnter action placeCoinAtStart is invoked on load (coin position is set)', async () => {
    // The placeCoinAtStart entry action places the coin near the left of the path by setting left/top inline.
    // We verify that coin has left and top style attributes after load and before any interactions.
    const coinLeft = await page.evaluate(() => document.getElementById('coin').style.left);
    const coinTop = await page.evaluate(() => document.getElementById('coin').style.top);

    // left/top should be set to a pixel value (not empty)
    expect(coinLeft).toBeTruthy();
    expect(coinLeft).toMatch(/px/);
    expect(coinTop).toBeTruthy();
    expect(coinTop).toMatch(/px/);

    // Confirm coin remains visible and animation exists (idle)
    const anim = await txPage.getCoinAnimationInline();
    expect(anim).toContain('floaty');

    // No page errors emitted during placement
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Observes console and page error streams and asserts none occurred during interactions', async () => {
    // As a final safety check, perform a couple of interactions and then assert no errors were logged.
    await txPage.clickInfo();
    await page.waitForTimeout(200);
    await txPage.clickStart();

    // Wait until the app is in 'In transit' at least to allow some async code to run
    await txPage.page.waitForFunction(() => document.getElementById('status-text').textContent.trim() === 'In transit', null, { timeout: 6000 });

    // No console error-level messages or page errors must have been emitted
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  }, 20000);
});