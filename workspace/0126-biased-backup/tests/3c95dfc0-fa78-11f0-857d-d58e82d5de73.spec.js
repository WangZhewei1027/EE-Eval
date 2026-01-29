import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c95dfc0-fa78-11f0-857d-d58e82d5de73.html';

// Page Object for the Hash Table Visualization
class HashPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.refreshButton = page.locator('#refreshButton');
    this.stepsContainer = page.locator('#hashSteps');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Returns true if the refresh button is disabled
  async isRefreshDisabled() {
    return await this.refreshButton.evaluate((btn) => btn.disabled === true);
  }

  // Clicks the refresh button
  async clickRefresh() {
    await this.refreshButton.click();
  }

  // Returns the raw text content of the steps container
  async getStepsText() {
    return await this.stepsContainer.textContent();
  }

  // Returns number of child div elements inside steps container (each step is a div)
  async getStepsCount() {
    return await this.stepsContainer.evaluate((el) => {
      // Only count element children that are DIV nodes (the implementation appends DIVs)
      return Array.from(el.children).filter((c) => c.nodeName === 'DIV').length;
    });
  }

  // Wait until a "Compute index:" line appears (final modulo line)
  async waitForModLine(timeout = 20000) {
    await this.page.waitForFunction(() => {
      const container = document.getElementById('hashSteps');
      if (!container) return false;
      return Array.from(container.children).some((c) => c.textContent && c.textContent.includes('Compute index:'));
    }, null, { timeout });
  }

  // Wait until refresh button becomes enabled again
  async waitForRefreshEnabled(timeout = 12000) {
    await this.page.waitForFunction(() => {
      const btn = document.getElementById('refreshButton');
      return btn && btn.disabled === false;
    }, null, { timeout });
  }
}

test.describe('Hash Table Visualization — FSM validation (3c95dfc0-fa78-11f0-857d-d58e82d5de73)', () => {
  let page;
  let hashPage;
  // Collect console and page errors for assertions
  const consoleMessages = [];
  const consoleErrors = [];
  const pageErrors = [];

  test.beforeEach(async ({ browser }) => {
    // Create a fresh page for each test to avoid cross-test interference
    page = await browser.newPage();

    // Attach listeners to capture console messages and page errors
    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    page.on('pageerror', (err) => {
      // pageerror is for uncaught exceptions in the page context
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    hashPage = new HashPage(page);
    await hashPage.goto();
  });

  test.afterEach(async () => {
    // Close page after each test
    await page.close();

    // Clear captured messages for next test run
    consoleMessages.length = 0;
    consoleErrors.length = 0;
    pageErrors.length = 0;
  });

  test('Initial render shows Idle state with Run Hash Computation button (S0_Idle)', async () => {
    // Validate that the button exists and is enabled (Idle state)
    await expect(hashPage.refreshButton).toBeVisible();
    await expect(hashPage.refreshButton).toHaveAttribute('aria-label', 'Refresh hash computation visualization');

    // Ensure the button is initially enabled (Idle state)
    const disabled = await hashPage.isRefreshDisabled();
    expect(disabled, 'Refresh button should be enabled on initial idle render').toBeFalsy();

    // Validate the initial helper text is present in the steps container
    const stepsText = await hashPage.getStepsText();
    expect(stepsText).toContain('Press the button to see hash computation steps');
  });

  test('Clicking Run Hash Computation transitions to Computing state and shows incremental steps (S1_Computing)', async () => {
    // Comments: This test validates that clicking the button starts the animation,
    // that steps begin to appear, and that the button becomes disabled immediately.

    // Click to trigger hash computation
    await hashPage.clickRefresh();

    // Immediately after click, the button should be disabled (onEnter of Computing)
    const disabledAfterClick = await hashPage.isRefreshDisabled();
    expect(disabledAfterClick, 'Button should be disabled immediately after clicking (computing started)').toBeTruthy();

    // The steps container should be cleared on start; wait for the first step to appear
    // The first step should appear within 1 second
    await page.waitForFunction(() => {
      const c = document.getElementById('hashSteps');
      if (!c) return false;
      return Array.from(c.children).some((d) => d.textContent && d.textContent.includes('Add char code for'));
    }, null, { timeout: 3000 });

    // Ensure at least one incremental step was appended
    const stepCountSoon = await hashPage.getStepsCount();
    expect(stepCountSoon).toBeGreaterThanOrEqual(1);
  });

  test('All hash computation steps and final modulo result are displayed; verify computed values and styles', async () => {
    // Comments: This test waits for the entire sequence to finish,
    // validates the count of step lines (5 char steps + 1 mod = 6),
    // checks the exact modulo result text derived from the page logic (530 % 6 = 2),
    // and inspects some inline style properties applied to the final line.

    // Start the computation
    await hashPage.clickRefresh();

    // Wait for the final modulo computation line to appear (this happens after the 5 steps)
    await hashPage.waitForModLine(20000);

    // Count the number of DIV children - should be 6 (5 per-char + 1 modulo)
    const stepsCount = await hashPage.getStepsCount();
    expect(stepsCount).toBe(6);

    // Assert the final mod line text is exactly as computed by the implementation:
    // The JS code sums char codes [97,112,112,108,101] => 530, slotsCount = 6, 530 % 6 = 2
    const modLineText = await page.evaluate(() => {
      const container = document.getElementById('hashSteps');
      const children = Array.from(container.children).filter((c) => c.nodeName === 'DIV');
      // The final line is appended after the character steps
      const last = children[children.length - 1];
      return last ? last.textContent.trim() : null;
    });

    expect(modLineText).toBe('Compute index: 530 % 6 = 2');

    // Check inline style expectations applied in the implementation for the mod line
    const modLineStyle = await page.evaluate(() => {
      const container = document.getElementById('hashSteps');
      const children = Array.from(container.children).filter((c) => c.nodeName === 'DIV');
      const last = children[children.length - 1];
      if (!last) return null;
      return {
        marginTop: last.style.marginTop,
        fontWeight: last.style.fontWeight,
        color: last.style.color,
      };
    });

    expect(modLineStyle).not.toBeNull();
    expect(modLineStyle.fontWeight).toBe('600');
    // color was set as '#5ac8fa' in the implementation; the browser normalizes to rgb
    // Accept either the hex string or normalized rgb form
    const allowedColors = ['#5ac8fa', 'rgb(90,200,250)', 'rgba(90,200,250,1)'];
    expect(allowedColors).toContain(modLineStyle.color);
    expect(modLineStyle.marginTop).toBe('0.8rem');
  });

  test('Button is re-enabled after the expected computation timeout (transition: S1_Computing -> S0_Idle)', async () => {
    // Comments: This test verifies that the refresh button is disabled for the
    // specified period and then becomes enabled again (the FSM exit action).

    // Start computation
    await hashPage.clickRefresh();

    // Immediately disabled
    expect(await hashPage.isRefreshDisabled()).toBeTruthy();

    // Wait until the button is enabled again (implementation uses 6500ms)
    await hashPage.waitForRefreshEnabled(12000);

    // Confirm enabled state (back to Idle)
    expect(await hashPage.isRefreshDisabled()).toBeFalsy();
  });

  test('Rapid multiple clicks do not cause duplicated computation runs while computing (edge case)', async () => {
    // Comments: This edge-case test attempts to click the button rapidly multiple times.
    // Because the implementation disables the button on click, subsequent clicks should be ignored,
    // and only one sequence of steps should be produced.

    // Click once to start
    await hashPage.clickRefresh();

    // Try to click again immediately; if the button is disabled the click should have no effect.
    // We attempt to click but ignore any Playwright errors if the element is transiently disabled
    try {
      await hashPage.clickRefresh();
    } catch (err) {
      // Ignoring errors from clicking a disabled control; the goal is to ensure UI logic prevents duplicates.
    }

    // Wait for the first character step to appear (ensure computation started)
    await page.waitForFunction(() => {
      const c = document.getElementById('hashSteps');
      if (!c) return false;
      return Array.from(c.children).some((d) => d.textContent && d.textContent.includes('Add char code for'));
    }, null, { timeout: 3000 });

    // Record number of steps after a short while (should be growing but correspond to one run)
    // Wait until final mod line to assert total steps = 6 for a single run
    await hashPage.waitForModLine(20000);
    const stepsCount = await hashPage.getStepsCount();
    expect(stepsCount).toBe(6);
  });

  test('No unexpected page errors or console errors occurred during interactions', async () => {
    // Comments:
    // This test validates that no uncaught exceptions (pageerror) or console.error events
    // were emitted during normal usage (render + one full computation).
    //
    // We will execute a full computation as part of this test to capture any runtime problems.

    // Start a computation and wait for completion
    await hashPage.clickRefresh();
    await hashPage.waitForModLine(20000);
    await hashPage.waitForRefreshEnabled(12000);

    // At this point, we expect no uncaught exceptions reported by the page
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.join(' | ')}`).toBe(0);

    // Also expect no console.error messages
    expect(consoleErrors.length, `Console error messages: ${consoleErrors.join(' | ')}`).toBe(0);

    // For debugging contexts we still provide that console messages were captured (info and debug)
    // but they are not considered failures. We assert that some console activity might be present.
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  }, /* timeout */ 45000);
});