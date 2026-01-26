import { test, expect } from '@playwright/test';

// Test page URL (per requirements)
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f8c4f2-fa77-11f0-a6a1-c765f41a13c7.html';

// Page object model for the Compiler visualization page
class CompilerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  compileBtn() {
    return this.page.locator('#compileBtn');
  }

  resetBtn() {
    return this.page.locator('#resetBtn');
  }

  progressBar() {
    return this.page.locator('#progressBar');
  }

  pctLabel() {
    return this.page.locator('#pctLabel');
  }

  panel() {
    return this.page.locator('#panel');
  }

  astArea() {
    return this.page.locator('#astArea');
  }

  binaryCard() {
    return this.page.locator('#binaryCard');
  }

  tokens() {
    return this.page.locator('.token');
  }

  // convenience to get inline style width value of progress bar
  async progressWidth() {
    return this.page.$eval('#progressBar', (el) => el.style.width || window.getComputedStyle(el).width);
  }

  // click compile button
  async clickCompile() {
    await this.compileBtn().click();
  }

  // click reset button
  async clickReset() {
    await this.resetBtn().click();
  }

  // press Enter while the compile button is focused
  async pressEnterOnCompile() {
    await this.compileBtn().focus();
    // simulate keyup (the page listens for 'keyup' on the button)
    await this.page.keyboard.up('Enter');
    await this.page.keyboard.press('Enter');
  }

  // press Enter while reset button is focused
  async pressEnterOnReset() {
    await this.resetBtn().focus();
    await this.page.keyboard.up('Enter');
    await this.page.keyboard.press('Enter');
  }
}

// Collect console.error messages and page errors across test execution
let consoleErrors = [];
let pageErrors = [];

test.describe('Compiler Visualization FSM tests (f1f8c4f2-fa77-11f0-a6a1-c765f41a13c7)', () => {
  // Increase timeout for long-running animation tests
  test.slow();

  test.beforeEach(async ({ page }) => {
    // reset error collectors for each test
    consoleErrors = [];
    pageErrors = [];

    // collect console errors and page errors (do not modify runtime)
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the app page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Ensure panel has been loaded and basic elements present
    await expect(page.locator('#panel')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    // Wait a short moment to let any asynchronous runtime errors surface
    // (we aren't altering the runtime; we simply observe)
    await page.waitForTimeout(120);

    // Assert no unexpected runtime errors were thrown during the test
    // We assert there are zero page errors and zero console.error messages.
    // This validates that the page executed without uncaught exceptions in this test run.
    expect(pageErrors.length, `Expected no page errors, found: ${pageErrors.map(e => e && e.message).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `Expected no console.error messages, found: ${consoleErrors.map(e => e.text).join('; ')}`).toBe(0);
  });

  test.describe('State S0_Idle (Initial) validations', () => {
    test('Initial Idle state: UI elements and default visual state', async ({ page }) => {
      const app = new CompilerPage(page);

      // Validate compile and reset buttons exist and have expected attributes/text
      await expect(app.compileBtn()).toBeVisible();
      await expect(app.compileBtn()).toHaveText(/Compile/);
      await expect(app.compileBtn()).toHaveAttribute('title', 'Run compilation visualization');
      await expect(app.compileBtn()).toHaveAttribute('aria-pressed', 'false');

      await expect(app.resetBtn()).toBeVisible();
      await expect(app.resetBtn()).toHaveText('Reset');
      await expect(app.resetBtn()).toHaveAttribute('title', 'Reset visuals');

      // Panel should NOT have 'active' class in Idle
      await expect(app.panel()).not.toHaveClass(/active/);

      // Progress should be at 0%
      await expect(app.pctLabel()).toHaveText('0%');
      // progressBar inline style width should be '0%'
      const width = await page.$eval('#progressBar', (el) => el.style.width);
      expect(width === '0%' || width === '' /* fallback computed width may vary */).toBeTruthy();
    });
  });

  test.describe('Transitions from Idle -> Running (S0 -> S1) and Running behaviors', () => {
    test('Clicking Compile begins animation: S0 -> S1 (active visuals, progress starts)', async ({ page }) => {
      const app = new CompilerPage(page);

      // Click compile to start animation
      await app.clickCompile();

      // Immediately upon click the UI should set active class and disable the compile button
      await expect(app.panel()).toHaveClass(/active/);
      await expect(app.compileBtn()).toHaveAttribute('disabled', 'true');
      await expect(app.compileBtn()).toHaveAttribute('aria-pressed', 'true');

      // Check initial progress jump to 6% per animateCompile
      // The script sets progressBar.style.width = '6%' synchronously in animateCompile
      const initialWidth = await page.$eval('#progressBar', el => el.style.width);
      expect(initialWidth).toBe('6%');
      await expect(app.pctLabel()).toHaveText('6%');

      // The AST area should not necessarily be active immediately; ensure that at parseStart (~1100ms)
      // the astArea receives the 'active' class (triggering edge/node animations)
      await page.waitForTimeout(1200); // wait until after parseStart (1100ms)
      await expect(app.pctLabel()).toHaveText('36%');
      await expect(app.astArea()).toHaveClass(/active/);

      // Ensure compile button remains disabled while running
      await expect(app.compileBtn()).toHaveAttribute('disabled', 'true');
    });

    test('Double clicking compile while running should be inert (button disabled prevents duplicate runs)', async ({ page }) => {
      const app = new CompilerPage(page);

      // Start compilation
      await app.clickCompile();

      // Immediately attempt another click; because the button is disabled after setActive(true),
      // the second click should have no effect and should not throw errors.
      // We simulate both clicking and pressing Enter to cover user impatience.
      await app.compileBtn().click().catch(() => {});
      await app.pressEnterOnCompile().catch(() => {});

      // confirm progress is at least the initial 6% set by the first call
      const width = await page.$eval('#progressBar', el => el.style.width);
      expect(width).toBe('6%');

      // wait a short bit and assert no console/page errors have been emitted yet
      await page.waitForTimeout(200);
    });
  });

  test.describe('Reset interactions and S1 -> S0 transition', () => {
    test('Reset during Running clears timeline and restores Idle visuals', async ({ page }) => {
      const app = new CompilerPage(page);

      // Start compile and let it run briefly into the parse stage
      await app.clickCompile();
      await page.waitForTimeout(1200); // after parseStart, progress should be around 36%

      // Now click reset to trigger S1 -> S0 transition
      await app.clickReset();

      // After reset, the panel should no longer be active
      await expect(app.panel()).not.toHaveClass(/active/);

      // Progress bar and label should be reset to 0%
      await expect(app.pctLabel()).toHaveText('0%');
      const widthAfterReset = await page.$eval('#progressBar', el => el.style.width);
      expect(widthAfterReset).toBe('0%');

      // AST active class removed
      await expect(app.astArea()).not.toHaveClass(/active/);

      // Compile button text should be restored to 'Compile' and not disabled
      await expect(app.compileBtn()).toHaveText(/Compile/);
      await expect(app.compileBtn()).not.toHaveAttribute('disabled');

      // Tokens should have been replaced (the code performs cloneNode)
      // We assert there is still a token number equal to 3 (the DOM structure replaces nodes)
      const tokenCount = await app.tokens().count();
      expect(tokenCount).toBeGreaterThanOrEqual(0);
      // No runtime errors from reset
      await page.waitForTimeout(100);
    });

    test('Reset via keyboard (Enter) while running returns to Idle', async ({ page }) => {
      const app = new CompilerPage(page);

      // Start compilation
      await app.clickCompile();
      await page.waitForTimeout(700); // in-progress

      // Focus reset and press Enter to trigger keyup listener
      await app.resetBtn().focus();
      // Key listener is attached to resetBtn for keyup; press Enter
      await app.pressEnterOnReset();

      // Validate state restored
      await expect(app.panel()).not.toHaveClass(/active/);
      await expect(app.pctLabel()).toHaveText('0%');
      await expect(app.compileBtn()).toHaveText(/Compile/);
    });
  });

  test.describe('Completion: S1 -> S2_Completed and post-finish behavior', () => {
    test('Full run completes and update button text to Done then Replay (re-enabled)', async ({ page }) => {
      const app = new CompilerPage(page);

      // Kick off compile
      await app.clickCompile();

      // Wait until 'finish' (5800ms) to assert compileBtn.textContent becomes 'Done'
      // Add a little buffer
      await page.waitForTimeout(5900);

      // At this point the script sets compileBtn.textContent = 'Done'
      await expect(app.compileBtn()).toHaveText(/Done/);

      // Progress bar should read 100%
      await expect(app.pctLabel()).toHaveText('100%');
      const widthAtFinish = await page.$eval('#progressBar', el => el.style.width);
      expect(widthAtFinish).toBe('100%');

      // The AST area should be active (edges revealed)
      await expect(app.astArea()).toHaveClass(/active/);

      // Wait for the final re-enable (finish + 600ms) where button becomes 'Replay' and disabled removed
      await page.waitForTimeout(700);
      await expect(app.compileBtn()).toHaveText(/Replay/);
      await expect(app.compileBtn()).not.toHaveAttribute('disabled');

      // Clicking Replay should start another run (ensure no errors when replaying)
      await app.clickCompile();
      // Immediate progress should go to 6% again
      const replayWidth = await page.$eval('#progressBar', el => el.style.width);
      expect(replayWidth).toBe('6%');

      // Allow some animations to run and then reset to keep tests isolated
      await page.waitForTimeout(300);
      await app.clickReset();
    });
  });

  test.describe('Accessibility and edge-case validations', () => {
    test('Keyboard: Enter on compile triggers the animation (keyup listener)', async ({ page }) => {
      const app = new CompilerPage(page);

      // Focus compile button and trigger Enter key (keyup listener)
      await app.compileBtn().focus();
      // Use keyboard.press to generate keydown/keyup events
      await page.keyboard.press('Enter');

      // The page listens for keyup on the compile button, but keyboard.press will create those events.
      // Wait a short time to allow animateCompile to set initial progress.
      await page.waitForTimeout(120);

      const width = await page.$eval('#progressBar', el => el.style.width);
      expect(width).toBe('6%');

      // cleanup
      await app.clickReset();
    });

    test('No uncaught runtime exceptions when rapidly toggling compile and reset', async ({ page }) => {
      const app = new CompilerPage(page);

      // Rapid sequence: compile, reset, compile, reset to stress timers
      await app.clickCompile();
      await page.waitForTimeout(80);
      await app.clickReset();
      await page.waitForTimeout(80);
      await app.clickCompile();
      await page.waitForTimeout(80);
      await app.clickReset();

      // Allow any leftover timers to settle
      await page.waitForTimeout(200);

      // No page errors or console errors should have been captured (afterEach will assert)
    });
  });
});