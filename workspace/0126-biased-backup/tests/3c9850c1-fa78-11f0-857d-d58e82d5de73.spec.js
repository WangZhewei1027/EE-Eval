import { test, expect } from '@playwright/test';

// Test file for Application ID: 3c9850c1-fa78-11f0-857d-d58e82d5de73
// This suite validates the FSM states (Idle -> Animating -> Idle), events (StartAnimation, ResetAnimation),
// visual updates to the DP grid, and ensures no unexpected console/page errors appear during interactions.

// Page object model for the DP visualization page
class DPPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.grid = page.locator('.dp-grid');
    this.cell = (r, c) => page.locator(`.dp-cell[data-row="${r}"][data-col="${c}"]`);
  }

  async goto(url) {
    await this.page.goto(url);
  }

  // Wait until the initial grid is created with 8x8 = 64 cells
  async expectGridInitialized() {
    await expect(this.grid.locator('.dp-cell')).toHaveCount(64);
    // All cells should initially display "0"
    const cells = this.grid.locator('.dp-cell');
    const count = await cells.count();
    for (let i = 0; i < count; i++) {
      await expect(cells.nth(i)).toHaveText('0');
    }
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async getStartAriaPressed() {
    return await this.startBtn.getAttribute('aria-pressed');
  }

  async getStartText() {
    return await this.startBtn.textContent();
  }

  async getCellText(r, c) {
    return await this.cell(r, c).textContent();
  }
}

// Base URL for the served HTML
const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9850c1-fa78-11f0-857d-d58e82d5de73.html';

test.describe('Dynamic Programming — Visualized Elegance (FSM & UI)', () => {
  // Arrays to collect console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages (console.error etc.)
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location()
          });
        }
      } catch (e) {
        // If any unexpected exception occurs while processing console, record it
        consoleErrors.push({ text: `Failure parsing console message: ${String(e)}` });
      }
    });

    // Capture uncaught page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push({
        message: err.message,
        stack: err.stack
      });
    });

    // Navigate to application page
    await page.goto(BASE_URL);
  });

  test.afterEach(async () => {
    // Assert that no console errors or page errors occurred during the test.
    // This verifies that the application runs without uncaught exceptions in the scenarios exercised.
    expect(consoleErrors, 'Expected no console.error messages during interaction').toHaveLength(0);
    expect(pageErrors, 'Expected no uncaught page errors during interaction').toHaveLength(0);
  });

  test('Initial state: Idle — grid is created with zeros (onEnter: createGrid)', async ({ page }) => {
    // This test validates the S0_Idle state which should be the initial state after page load.
    // It ensures createGrid() ran and produced an 8x8 grid with all cells set to "0".
    const dp = new DPPage(page);

    // Verify grid was initialized with 64 cells and all set to '0'
    await dp.expectGridInitialized();

    // Spot-check ARIA attributes of controls per component definitions
    await expect(page.locator('#startBtn')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#startBtn')).toHaveAttribute('aria-label', /Start Dynamic Programming/i);
    await expect(page.locator('#resetBtn')).toHaveAttribute('aria-label', /Reset Dynamic Programming/i);
  });

  test('StartAnimation event transitions Idle -> Animating: start button toggles and grid updates', async ({ page }) => {
    // This test validates the StartAnimation event and the transition to S1_Animating.
    // It asserts the start button updates (aria-pressed true, label change) and that grid values update.
    const dp = new DPPage(page);

    // Precondition: grid present
    await dp.expectGridInitialized();

    // Click start to begin animation
    await dp.clickStart();

    // Immediately, the start button aria-pressed should be true and text should indicate running
    await expect(dp.startBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(dp.startBtn).toHaveText(/Running\.\.\./i);

    // Edge cells (first row and first column) are set synchronously by startAnimation()
    // Verify a few edge cells updated to "1" right away (no long wait)
    await expect(dp.cell(0, 0)).toHaveText('1');
    await expect(dp.cell(0, 3)).toHaveText('1');
    await expect(dp.cell(3, 0)).toHaveText('1');

    // Interior cells update with delays: wait for at least one interior cell (1,1) to become non-zero.
    // The first scheduled interior update should happen after ~600ms. Allow up to 5s for robustness.
    await expect(dp.cell(1, 1)).not.toHaveText('0', { timeout: 5000 });

    // Confirm that at least one interior cell has become > 0 (text not '0')
    const interiorText = await dp.getCellText(1, 1);
    expect(interiorText.trim().length).toBeGreaterThan(0);
    expect(interiorText).not.toBe('0');
  });

  test('ResetAnimation event transitions Animating -> Idle: reset clears grid and button state', async ({ page }) => {
    // This test validates the ResetAnimation event and transition back to S0_Idle.
    // It ensures clearAnimation() resets dp values, the grid text, classes and start button state.
    const dp = new DPPage(page);

    // Ensure initial grid created
    await dp.expectGridInitialized();

    // Start the animation then immediately reset
    await dp.clickStart();

    // Wait a short moment so initial edge updates apply
    await page.waitForTimeout(100);

    // Now click reset to clear animation and reset UI
    await dp.clickReset();

    // After reset, all cells should display '0' again
    const cells = page.locator('.dp-cell');
    await expect(cells).toHaveCount(64);
    const count = await cells.count();
    for (let i = 0; i < count; i++) {
      await expect(cells.nth(i)).toHaveText('0');
      // The 'update' class should be removed
      await expect(cells.nth(i)).not.toHaveClass(/update/);
    }

    // Start button should be restored to default state
    await expect(dp.startBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(dp.startBtn).toHaveText('Start Animation');
  });

  test('Edge case: clicking start while already running does not re-trigger (idempotent start)', async ({ page }) => {
    // This test validates the early-return guard inside the start button handler:
    // if aria-pressed === 'true', clicking start again should be a no-op.
    const dp = new DPPage(page);

    await dp.expectGridInitialized();

    // Start animation
    await dp.clickStart();
    await expect(dp.startBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(dp.startBtn).toHaveText(/Running\.\.\./i);

    // Click start again while running
    await dp.clickStart();

    // Button should remain in running state and not toggle off
    await expect(dp.startBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(dp.startBtn).toHaveText(/Running\.\.\./i);

    // Also confirm that interior cell (1,1) is still going to be updated eventually (sanity)
    await expect(dp.cell(1, 1)).not.toHaveText('0', { timeout: 5000 });
  });

  test('Edge case: reset when idle (no-op) should keep grid intact and not throw errors', async ({ page }) => {
    // This test clicks Reset when no animation is running and asserts it is a safe no-op.
    const dp = new DPPage(page);

    // Ensure initial idle state
    await dp.expectGridInitialized();

    // Click reset when nothing is running
    await dp.clickReset();

    // Grid should remain initialized and all zeros
    await dp.expectGridInitialized();

    // Start button should still be in ready state
    await expect(dp.startBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(dp.startBtn).toHaveText('Start Animation');
  });

  test('Long-running: ensure final completion updates start button text to "Animation Completed"', async ({ page }) => {
    // This test verifies that after the scheduled animation finishes, the start button's text
    // becomes "Animation Completed". The completion timeout can be ~18.3s total for an 8x8 grid.
    // We wait with a generous timeout to allow completion.
    const dp = new DPPage(page);

    await dp.expectGridInitialized();

    // Start animation
    await dp.clickStart();

    // Expect some interior progress to confirm it started
    await expect(dp.cell(1, 1)).not.toHaveText('0', { timeout: 5000 });

    // Wait for the final completion callback. Calculation in page:
    // setTimeout(() => startBtn.textContent = 'Animation Completed'; }, 600 + (ROWS-1)*(COLS-1)*330 + 1500);
    // For ROWS = COLS = 8 -> 600 + 49*330 + 1500 = 18270ms (~18.27s)
    // Allow up to 30s to be safe for CI variability.
    await expect(dp.startBtn).toHaveText('Animation Completed', { timeout: 30000 });
  });
});