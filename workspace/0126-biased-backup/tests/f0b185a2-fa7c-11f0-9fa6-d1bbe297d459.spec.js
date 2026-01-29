import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b185a2-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object representing the AVL demo page
class AVLPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.toggleButton = page.locator("button[onclick='showRotationDemo()']");
    this.rotationVisual = page.locator('#rotation-visual');
    this.rotationContainer = page.locator('#rotation-demo');
  }

  // Clicks the Show Rotation Demo button
  async clickToggle() {
    await this.toggleButton.click();
  }

  // Returns inline style.display value (may be '' if not set inline)
  async getInlineDisplay() {
    return await this.rotationVisual.evaluate((el) => el.style.display);
  }

  // Returns computed style display (reliable)
  async getComputedDisplay() {
    return await this.rotationVisual.evaluate((el) => {
      return window.getComputedStyle(el).display;
    });
  }

  // Returns true if the rotation visual is currently visible (computed style)
  async isVisible() {
    const display = await this.getComputedDisplay();
    return display !== 'none';
  }

  // Returns the text content of the toggle button
  async getButtonText() {
    return await this.toggleButton.textContent();
  }
}

test.describe('AVL Tree - Rotation Demo FSM Tests (f0b185a2-fa7c-11f0-9fa6-d1bbe297d459)', () => {
  // Collect console messages and page errors for each test
  let consoleMessages = [];
  let consoleErrors = [];
  let pageErrors = [];

  // Setup listeners and navigate to the page before each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      const entry = { type: msg.type(), text: msg.text() };
      consoleMessages.push(entry);
      if (msg.type() === 'error') {
        consoleErrors.push(entry);
      }
    });

    // Collect uncaught exceptions from the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application page and wait for load
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // After each test, assert that there were no unexpected runtime errors
  test.afterEach(async () => {
    // If there are page errors, include them in the assertion message for debugging
    const pageErrorMessages = pageErrors.map(e => (e && e.message) || String(e)).join('\n---\n');
    expect(pageErrors.length, `Expected no uncaught page errors, got:\n${pageErrorMessages}`).toBe(0);

    // If there are console.error messages, fail the test and report them
    const consoleErrorTexts = consoleErrors.map(e => e.text).join('\n---\n');
    expect(consoleErrors.length, `Expected no console.error messages, got:\n${consoleErrorTexts}`).toBe(0);
  });

  test.describe('Initial page and idle state (S0_Idle)', () => {
    test('Button exists with expected text and rotation visual is initially hidden', async ({ page }) => {
      // Arrange
      const avl = new AVLPage(page);

      // Act & Assert
      // Verify the toggle button exists and has the correct label
      await expect(avl.toggleButton).toBeVisible();
      const btnText = (await avl.getButtonText())?.trim();
      expect(btnText).toBe('Show Rotation Demo');

      // The rotation visual should exist in the DOM
      await expect(avl.rotationVisual).toBeVisible({ timeout: 1000 }).catch(() => {
        // rotationVisual might be visually hidden via display: none but still present.
        // If Playwright's toBeVisible fails because display: none, check presence instead.
      });
      // Confirm the computed style is 'none' => hidden (S2_RotationHidden evidence)
      const computed = await avl.getComputedDisplay();
      expect(computed).toBe('none');

      // The inline style may be 'none' as in the HTML; assert either inline 'none' or computed 'none'
      const inline = await avl.getInlineDisplay();
      // inline can be '' or 'none'; ensure computed style is authoritative
      expect(await avl.isVisible()).toBe(false);

      // FSM mentioned an entry action 'renderPage()' for S0_Idle.
      // The page does not define renderPage in the global scope; assert it is undefined (edge case).
      const renderPageType = await page.evaluate(() => typeof window.renderPage);
      expect(renderPageType).toBe('undefined');
    });
  });

  test.describe('ShowRotationDemo event and transitions', () => {
    test('Clicking button toggles rotation: Idle (hidden) -> RotationVisible (block)', async ({ page }) => {
      const avl = new AVLPage(page);

      // Precondition: ensure it starts hidden
      expect(await avl.isVisible()).toBe(false);

      // Click to show (S0_Idle -> S1_RotationVisible)
      await avl.clickToggle();

      // The rotation visual should now be visible (evidence: demo.style.display = 'block';)
      const computedAfter = await avl.getComputedDisplay();
      expect(computedAfter === 'block' || (await avl.isVisible())).toBeTruthy();

      // Confirm showRotationDemo exists and is a function on the window
      const showType = await page.evaluate(() => typeof window.showRotationDemo);
      expect(showType).toBe('function');
    });

    test('Clicking button again toggles rotation: RotationVisible -> RotationHidden', async ({ page }) => {
      const avl = new AVLPage(page);

      // Ensure visible by clicking once if needed
      if (!(await avl.isVisible())) {
        await avl.clickToggle();
        expect(await avl.isVisible()).toBe(true);
      }

      // Click to hide (S1_RotationVisible -> S2_RotationHidden)
      await avl.clickToggle();

      // Now it should be hidden again
      expect(await avl.isVisible()).toBe(false);
      const inlineAfter = await avl.getInlineDisplay();
      // Inline style should reflect 'none' based on implementation else computed is authoritative
      const computed = await avl.getComputedDisplay();
      expect(computed).toBe('none');
    });

    test('Transition cycles: Hidden -> Visible -> Hidden -> Visible', async ({ page }) => {
      const avl = new AVLPage(page);

      // Start hidden
      expect(await avl.isVisible()).toBe(false);

      // Cycle 1: show
      await avl.clickToggle();
      expect(await avl.isVisible()).toBe(true);

      // Cycle 2: hide
      await avl.clickToggle();
      expect(await avl.isVisible()).toBe(false);

      // Cycle 3: show
      await avl.clickToggle();
      expect(await avl.isVisible()).toBe(true);
    });

    test('Edge case: rapid multiple clicks produce predictable toggling (odd/even)', async ({ page }) => {
      const avl = new AVLPage(page);

      // Ensure hidden initially
      if (await avl.isVisible()) {
        await avl.clickToggle();
      }
      expect(await avl.isVisible()).toBe(false);

      // Rapidly click 5 times (odd => final should be visible)
      for (let i = 0; i < 5; i++) {
        await Promise.all([
          avl.clickToggle(),
          // small micro-delay to simulate rapid user clicks
          page.waitForTimeout(10)
        ]);
      }
      expect(await avl.isVisible()).toBe(true);

      // Rapidly click 4 times (even => final should be visible -> hidden -> visible -> hidden -> visible -> hidden?)
      // Starting visible, 4 clicks -> even -> stays visible if toggles are applied sequentially: visible->hidden->visible->hidden->visible? Wait: 4 toggles from visible -> hidden -> visible -> hidden -> visible? That's 4 transitions ends visible? Let's just assert parity behavior in terms of even/odd count.
      const clicks = 4;
      for (let i = 0; i < clicks; i++) {
        await avl.clickToggle();
      }
      // Since we started this mini-sequence visible, even number of toggles should leave it visible
      expect(await avl.isVisible()).toBe(true);
    });
  });

  test.describe('Error & Implementation Observability (edge checks)', () => {
    test('showRotationDemo is defined and operable; missing renderPage should not throw on load', async ({ page }) => {
      // Assert that calling showRotationDemo from the test context toggles state as expected.
      // We will call it via page.evaluate to ensure global function works as intended.
      const avl = new AVLPage(page);

      // Ensure hidden
      if (await avl.isVisible()) {
        await avl.clickToggle();
      }
      expect(await avl.isVisible()).toBe(false);

      // Call the function directly in page context
      await page.evaluate(() => {
        // This will call the global function; if it throws, the page.error handler will capture it.
        window.showRotationDemo();
      });

      // Now it should be visible
      expect(await avl.isVisible()).toBe(true);

      // renderPage() was expected by FSM as an entry_action but is not present in the page.
      // Validate that renderPage is undefined and thus would cause a ReferenceError if invoked.
      const renderPageType = await page.evaluate(() => typeof window.renderPage);
      expect(renderPageType).toBe('undefined');

      // Ensure no uncaught exceptions were emitted during this test run (captured by afterEach)
    });

    test('No unexpected console.error or uncaught exceptions occurred during interaction', async ({ page }) => {
      const avl = new AVLPage(page);

      // Perform some interactions
      await avl.clickToggle();
      await avl.clickToggle();
      await avl.clickToggle();

      // After interactions, ensure our collected consoleErrors and pageErrors are empty
      // (These assertions will also be re-checked in afterEach for better failure messages.)
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);

      // Additionally, assert that no console message contains 'ReferenceError' (defensive)
      const hasReferenceErrorText = consoleMessages.some(m => /ReferenceError/.test(m.text));
      expect(hasReferenceErrorText).toBe(false);
    });
  });
});