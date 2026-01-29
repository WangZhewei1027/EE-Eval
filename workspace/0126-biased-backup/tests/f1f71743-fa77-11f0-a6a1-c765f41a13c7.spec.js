import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f71743-fa77-11f0-a6a1-c765f41a13c7.html';

/*
  Page object for the Memory Visualization page.
  Encapsulates common selectors and interactions so tests read clearly.
*/
class MemoryPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.locators = {
      memGrid: page.locator('#memGrid'),
      memoryPane: page.locator('#memory'),
      toggleBtn: page.locator('#toggleBtn'),
      resetBtn: page.locator('#resetBtn'),
      scenarioLabel: page.locator('#scenarioLabel'),
      blocks: page.locator('#memGrid .block'),
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickToggle() {
    await this.locators.toggleBtn.click();
  }

  async clickReset() {
    await this.locators.resetBtn.click();
  }

  async pressToggleKey(key = ' ') {
    await this.locators.toggleBtn.focus();
    await this.page.keyboard.press(key);
  }
}

test.describe('Space Complexity Visual — FSM and UI validations', () => {
  // Capture console errors and page errors for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console.error messages
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      } catch (e) {
        // ignore collection errors
      }
    });

    // Collect uncaught exceptions / page errors
    page.on('pageerror', err => {
      try {
        pageErrors.push(String(err && err.message ? err.message : err));
      } catch (e) {
        // ignore
      }
    });
  });

  test.describe('Initialization and script parsing errors', () => {
    test('Page loads static DOM but script parsing error is observed (expect SyntaxError)', async ({ page }) => {
      // Arrange
      const memoryPage = new MemoryPage(page);

      // Act: navigate to the app and wait for load
      await memoryPage.goto();

      // Assert: static UI elements from HTML are present
      await expect(memoryPage.locators.toggleBtn).toBeVisible();
      await expect(memoryPage.locators.resetBtn).toBeVisible();
      await expect(memoryPage.locators.scenarioLabel).toHaveText(/Scenario: O\(1\) — Constant|Scenario: O\(1\)/i);

      // The JS in the page is expected to build the grid dynamically.
      // Because the provided script contains a syntax error, the script will not execute.
      // The memGrid should therefore remain empty (no .block children created by JS).
      const childCount = await page.evaluate(() => {
        const g = document.getElementById('memGrid');
        return g ? g.children.length : -1;
      });
      expect(childCount).toBe(0);

      // Wait briefly to allow any console/page errors to arrive
      await page.waitForTimeout(300);

      // Combine collected messages for robust assertion
      const combinedErrors = consoleErrors.concat(pageErrors).join('\n');

      // We expect at least one syntax or parse error due to the deliberate bug in the script.
      // Assert that either a SyntaxError or an Unexpected token message was emitted.
      const foundSyntax = /syntaxerror/i.test(combinedErrors) || /unexpected token/i.test(combinedErrors) || /unexpected identifier/i.test(combinedErrors);
      expect(foundSyntax).toBeTruthy();

      // Also assert that no blocks with .active class exist (since script didn't run)
      const activeBlocks = await page.$$eval('.block.active', els => els.length);
      expect(activeBlocks).toBe(0);
    });
  });

  test.describe('FSM controls and transitions (graceful failure behavior)', () => {
    test('Toggle Play/Pause button exists but clicking does not change state when script failed', async ({ page }) => {
      const memoryPage = new MemoryPage(page);
      await memoryPage.goto();

      // initial text comes from static HTML; since script error prevented execution, it remains the same
      const initialText = await memoryPage.locators.toggleBtn.textContent();
      expect(initialText.trim()).toBe('Pause');

      // aria-pressed is declared in HTML as "false", ensure it remains unchanged after click
      const initialAria = await memoryPage.locators.toggleBtn.getAttribute('aria-pressed');
      expect(initialAria).toBe('false');

      // Click the toggle button; because the JS didn't attach the event handler, there should be no change
      await memoryPage.clickToggle();

      // Short wait to allow any unexpected handlers (if any) to run
      await page.waitForTimeout(150);

      const afterClickText = await memoryPage.locators.toggleBtn.textContent();
      expect(afterClickText.trim()).toBe('Pause');

      const afterClickAria = await memoryPage.locators.toggleBtn.getAttribute('aria-pressed');
      expect(afterClickAria).toBe('false');

      // Ensure no console/page error was introduced by clicking beyond the initial parse error
      const combinedErrors = consoleErrors.concat(pageErrors).join('\n');
      const foundSyntax = /syntaxerror/i.test(combinedErrors) || /unexpected token/i.test(combinedErrors);
      expect(foundSyntax).toBeTruthy();
    });

    test('Reset button is present and clicking it does not produce expected JS-driven reset (script not running)', async ({ page }) => {
      const memoryPage = new MemoryPage(page);
      await memoryPage.goto();

      // Ensure reset button attributes are as described in HTML
      await expect(memoryPage.locators.resetBtn).toHaveAttribute('title', 'Reset animation');
      await expect(memoryPage.locators.resetBtn).toHaveAttribute('aria-label', 'Reset animation');

      // Focus should not automatically change when clicking reset because handler isn't attached
      await memoryPage.clickReset();

      // Wait a little for any focus changes (should not happen)
      await page.waitForTimeout(100);

      // Verify that focus is not on the toggle button (handler normally focuses toggleBtn)
      const activeHandle = await page.evaluateHandle(() => document.activeElement);
      const activeId = await page.evaluate(el => el && el.id, activeHandle);
      // Either no element focused or not the toggle button; ensure it's not the toggle button
      expect(activeId === 'toggleBtn').toBe(false);

      // MemGrid should remain empty (no reset population occurred)
      const count = await page.evaluate(() => document.getElementById('memGrid').children.length);
      expect(count).toBe(0);
    });
  });

  test.describe('Accessibility & keyboard interactions (when JS is absent)', () => {
    test('Keyboard activation on toggle does not throw and does not change label when script failed', async ({ page }) => {
      const memoryPage = new MemoryPage(page);
      await memoryPage.goto();

      // Press Space while toggle has focus (handler not present due to script failure)
      await memoryPage.locators.toggleBtn.focus();
      await memoryPage.pressToggleKey('Space');

      // allow potential events to process
      await page.waitForTimeout(100);

      // Text should still be the original static label
      const text = await memoryPage.locators.toggleBtn.textContent();
      expect(text.trim()).toBe('Pause');

      // Confirm we observed a syntax/parse error earlier
      const combined = consoleErrors.concat(pageErrors).join('\n');
      expect(/syntaxerror|unexpected token/i.test(combined)).toBeTruthy();
    });
  });

  test.describe('Edge cases & error surface assertions', () => {
    test('No runtime active animations or dynamically created blocks exist if script fails', async ({ page }) => {
      const memoryPage = new MemoryPage(page);
      await memoryPage.goto();

      // Because the main script did not run, there should be no '.block' elements at all
      const blockCount = await page.$$eval('.block', els => els.length);
      expect(blockCount).toBe(0);

      // The memory pane should exist and have the default transform from static HTML (or none)
      const transform = await memoryPage.locators.memoryPane.evaluate(el => getComputedStyle(el).transform || '');
      // Allow either 'none' or some simple transform; we only assert that we don't have JS-driven transforms like translateZ applied
      // We check that the string does not contain 'matrix3d' with non-trivial translateZ value which would indicate animation applied
      expect(/matrix3d/i.test(transform)).toBe(false);

      // Ensure we observed at least one error on page load (script syntax error)
      const errs = consoleErrors.concat(pageErrors);
      expect(errs.length).toBeGreaterThan(0);
      const combined = errs.join('\n');
      expect(/syntaxerror|unexpected token/i.test(combined)).toBeTruthy();
    });
  });
});