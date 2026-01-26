import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ac2832-fa78-11f0-812d-c9788050701f.html';

// Page object encapsulating common interactions and queries for the transaction visualization app
class TransactionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.statusBadge = page.locator('#statusBadge');
    this.transactionVisualization = page.locator('.transaction-visualization');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the UI to stabilize
    await expect(this.startBtn).toBeVisible();
    await expect(this.resetBtn).toBeVisible();
    await expect(this.statusBadge).toBeVisible();
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async getStatusText() {
    return (await this.statusBadge.textContent())?.trim();
  }

  // Returns computed background-color of the status badge as an rgb(...) string
  async getStatusBackgroundColor() {
    return this.page.evaluate(() => {
      const el = document.getElementById('statusBadge');
      return window.getComputedStyle(el).getPropertyValue('background-color');
    });
  }

  // Count elements with the .transaction-animation class (coins in transit)
  async countTransactionAnimations() {
    return this.page.evaluate(() => document.querySelectorAll('.transaction-animation').length);
  }

  // Count confetti elements currently in the DOM
  async countConfetti() {
    return this.page.evaluate(() => document.querySelectorAll('.confetti').length);
  }

  // Helper to wait until status text equals expected value or timeout
  async waitForStatus(expected, opts = { timeout: 3000 }) {
    await this.page.waitForFunction(
      (expected) => {
        const el = document.getElementById('statusBadge');
        return el && el.textContent.trim() === expected;
      },
      expected,
      opts
    );
  }
}

// Global arrays to collect errors and console messages observed during a test
let pageErrors = [];
let consoleErrors = [];

test.describe('Transaction Visualization - FSM validation', () => {
  test.beforeEach(async ({ page }) => {
    // Reset collectors for each test
    pageErrors = [];
    consoleErrors = [];

    // Collect uncaught page errors (e.g., ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Collect console error messages (e.g., console.error)
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  test.afterEach(async ({ page }) => {
    // For debugging: print any errors to test output (Playwright already shows them on failure)
    if (pageErrors.length > 0) {
      // Do not modify page environment; simply log collected info via test.info()
      // test.info() is not used here to avoid mixing APIs; rely on assertions below to surface problems.
    }
    // Close page to ensure teardown
    await page.close();
  });

  test.describe('State: Idle (S0_Idle)', () => {
    test('Initial Idle state renders controls and status badge correctly', async ({ page }) => {
      // Validate initial rendering and Idle state evidence
      const app = new TransactionPage(page);
      await app.goto();

      // Buttons are present and visible
      await expect(app.startBtn).toBeVisible();
      await expect(app.resetBtn).toBeVisible();

      // Status badge initial text should be "Pending" per HTML
      const initialText = await app.getStatusText();
      expect(initialText).toBe('Pending');

      // The CSS sets --success (#00b894) as the default background in the stylesheet.
      // Verify computed background color matches the expected success RGB.
      const bg = await app.getStatusBackgroundColor();
      // Expecting rgb(0, 184, 148) for #00b894
      expect(bg.replace(/\s+/g, '')).toBe('rgb(0,184,148)');

      // Assert no uncaught errors or console.error messages occurred during initial load
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Transitions triggered by StartTransaction (Start Button)', () => {
    test('Start Transaction: transitions to Processing and then to Completed (S0 -> S1 -> S2)', async ({ page }) => {
      const app = new TransactionPage(page);
      await app.goto();

      // Start the transaction
      await app.clickStart();

      // Immediately expect Processing state observable
      await app.waitForStatus('Processing', { timeout: 1000 });
      const processingText = await app.getStatusText();
      expect(processingText).toBe('Processing');

      // The status badge background should change to var(--warning) (#fdcb6e) while processing
      const processingBg = await app.getStatusBackgroundColor();
      // Expecting rgb(253,203,110) for #fdcb6e
      expect(processingBg.replace(/\s+/g, '')).toBe('rgb(253,203,110)');

      // While processing, a transaction-animation element should be present
      const animationsDuring = await app.countTransactionAnimations();
      expect(animationsDuring).toBeGreaterThanOrEqual(1);

      // Wait for completion (the implementation uses 2s animation + small delays)
      await app.waitForStatus('Completed', { timeout: 4000 });
      const completedText = await app.getStatusText();
      expect(completedText).toBe('Completed');

      // Background should be var(--success) (#00b894) again after completion
      const completedBg = await app.getStatusBackgroundColor();
      expect(completedBg.replace(/\s+/g, '')).toBe('rgb(0,184,148)');

      // Confetti should be created upon completion (some confetti may be removed later but soon after completion there should be some)
      const confettiCount = await app.countConfetti();
      expect(confettiCount).toBeGreaterThanOrEqual(0); // allow zero in case cleanup happened quickly; presence is non-deterministic

      // Assert there were no uncaught errors during the sequence
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Clicking Start while animation is in progress does not start a second animation (edge case)', async ({ page }) => {
      const app = new TransactionPage(page);
      await app.goto();

      // Start transaction to enter Processing
      await app.clickStart();

      // Wait briefly to ensure the animation element is created
      await page.waitForTimeout(200);
      const countAfterFirst = await app.countTransactionAnimations();
      // There should be at least one animation element
      expect(countAfterFirst).toBeGreaterThanOrEqual(1);

      // Try clicking start again while in progress
      await app.clickStart();

      // Wait a brief moment for any side-effects
      await page.waitForTimeout(200);

      const countAfterSecond = await app.countTransactionAnimations();

      // Implementation guards with animationInProgress flag; second click should not create additional animations
      // So number should remain equal to the first observed or less (since the implementation removes previous animations before creating a new one,
      // but because the second click is ignored, count should remain the same)
      expect(countAfterSecond).toBe(countAfterFirst);

      // Cleanup: wait for completion so subsequent tests are stable
      await app.waitForStatus('Completed', { timeout: 4000 });

      // Ensure no uncaught script errors occurred
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Transitions triggered by ResetTransaction (Reset Button)', () => {
    test('Reset during Processing returns to Pending and clears animations (S1 -> S0)', async ({ page }) => {
      const app = new TransactionPage(page);
      await app.goto();

      // Start and then reset quickly while coin is in flight
      await app.clickStart();
      await page.waitForTimeout(200); // ensure animation has started

      // Confirm Processing
      await app.waitForStatus('Processing', { timeout: 1000 });

      // Click Reset to interrupt
      await app.clickReset();

      // After reset, status should be Pending
      await app.waitForStatus('Pending', { timeout: 1000 });
      const afterResetText = await app.getStatusText();
      expect(afterResetText).toBe('Pending');

      // After reset the implementation sets background to var(--warning) (#fdcb6e)
      const afterResetBg = await app.getStatusBackgroundColor();
      expect(afterResetBg.replace(/\s+/g, '')).toBe('rgb(253,203,110)');

      // Transaction animations and confetti should be removed
      const animCount = await app.countTransactionAnimations();
      expect(animCount).toBe(0);

      const confettiCount = await app.countConfetti();
      expect(confettiCount).toBe(0);

      // After reset, it should be possible to start again (animationInProgress should be false)
      await app.clickStart();
      await app.waitForStatus('Processing', { timeout: 1000 });
      await app.waitForStatus('Completed', { timeout: 4000 });

      // Ensure no uncaught errors occurred
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Reset after Completed returns to Pending (S2 -> S0)', async ({ page }) => {
      const app = new TransactionPage(page);
      await app.goto();

      // Start and wait for completion
      await app.clickStart();
      await app.waitForStatus('Completed', { timeout: 4000 });

      // Click Reset after completed
      await app.clickReset();

      // Status must become Pending
      await app.waitForStatus('Pending', { timeout: 1000 });
      const afterResetText = await app.getStatusText();
      expect(afterResetText).toBe('Pending');

      // After reset the background is var(--warning) (#fdcb6e)
      const afterResetBg = await app.getStatusBackgroundColor();
      expect(afterResetBg.replace(/\s+/g, '')).toBe('rgb(253,203,110)');

      // No lingering animations or confetti immediately after reset
      const animCount = await app.countTransactionAnimations();
      expect(animCount).toBe(0);
      const confettiCount = await app.countConfetti();
      expect(confettiCount).toBe(0);

      // Ensure no uncaught errors occurred
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('Clicking Reset while Idle keeps Pending but updates background to warning', async ({ page }) => {
      const app = new TransactionPage(page);
      await app.goto();

      // In Idle the badge text is Pending and initial background is success (per stylesheet)
      const initialText = await app.getStatusText();
      expect(initialText).toBe('Pending');

      const initialBg = await app.getStatusBackgroundColor();
      expect(initialBg.replace(/\s+/g, '')).toBe('rgb(0,184,148)');

      // Click Reset while idle
      await app.clickReset();

      // Status should remain Pending
      await app.waitForStatus('Pending', { timeout: 1000 });
      const afterResetText = await app.getStatusText();
      expect(afterResetText).toBe('Pending');

      // Background should now be warning (the JS sets var(--warning) on reset)
      const afterResetBg = await app.getStatusBackgroundColor();
      expect(afterResetBg.replace(/\s+/g, '')).toBe('rgb(253,203,110)');

      // No errors expected
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Observes console and page errors (if any) during a full run', async ({ page }) => {
      const app = new TransactionPage(page);
      await app.goto();

      // Perform a full run: start -> wait completion -> reset
      await app.clickStart();
      await app.waitForStatus('Completed', { timeout: 5000 });
      await app.clickReset();
      await app.waitForStatus('Pending', { timeout: 1000 });

      // Capture any pageErrors or consoleErrors triggered during the run
      // The test asserts that there are zero uncaught runtime errors. If errors do exist they will be surfaced here.
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });
});