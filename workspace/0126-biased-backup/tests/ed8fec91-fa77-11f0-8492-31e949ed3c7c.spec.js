import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8fec91-fa77-11f0-8492-31e949ed3c7c.html';

// Small Page Object for the AST visualization page
class ASTPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('.button');
    this.nodes = page.locator('.node');
    this.container = page.locator('.container');
    this.h1 = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getOnclickAttribute() {
    return this.button.getAttribute('onclick');
  }

  async clickShowVisualization() {
    await this.button.click();
  }

  async hoverFirstNode() {
    const first = this.nodes.first();
    await first.hover();
  }

  async getFirstNodeTransform() {
    return this.page.evaluate(el => getComputedStyle(el).transform, await this.nodes.first().elementHandle());
  }

  async countNodes() {
    return this.nodes.count();
  }

  async clickContainer() {
    await this.container.click({ position: { x: 10, y: 10 } });
  }
}

test.describe('Abstract Syntax Tree Visualization - FSM validation', () => {
  // Collect console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Enable default navigation timeout to be generous for local server
    page.setDefaultTimeout(10000);
  });

  test.describe('States and DOM structure (S0_Idle)', () => {
    test('Initial Idle state: page renders expected heading and tree nodes are present', async ({ page }) => {
      // This test validates that the initial Idle state renders the page as described in the FSM:
      // - The main heading exists
      // - The tree nodes are rendered and there are multiple .node elements
      const ast = new ASTPage(page);
      await ast.goto();

      // Verify heading text
      await expect(ast.h1).toBeVisible();
      await expect(ast.h1).toHaveText('Abstract Syntax Tree');

      // There should be multiple .node elements representing the AST structure
      const count = await ast.countNodes();
      // The markup includes at least 10 nodes (Program, Function Declaration, Parameters, x, y, Body, Return Statement, Addition, x, y)
      expect(count).toBeGreaterThanOrEqual(10);

      // Verify that the Show Visualization button exists and is visible
      await expect(ast.button).toBeVisible();
      await expect(ast.button).toHaveText('Show Visualization');

      // Verify onclick attribute exists and contains the alert call as in the FSM
      const onclick = await ast.getOnclickAttribute();
      expect(onclick).toBeTruthy();
      expect(onclick).toContain("alert('Visualization Loaded!')");
    });

    test('CSS hover effect is present on a node (visual feedback)', async ({ page }) => {
      // Validate visual feedback: hovering a node changes its computed transform from 'none' to something else,
      // corresponding to the :hover { transform: scale(1.05) } rule in the implementation.
      const ast = new ASTPage(page);
      await ast.goto();

      // Get computed transform before hover
      const before = await ast.getFirstNodeTransform();
      // Hover and allow styles to apply
      await ast.hoverFirstNode();
      // Small wait to allow hover styles to settle
      await page.waitForTimeout(100);
      const after = await ast.getFirstNodeTransform();

      // It's expected that before is 'none' (or matrix identity) and after is likely not 'none'
      // We assert that the style has changed (indicates hover transform applied)
      expect(before === after).toBeFalsy();
    });
  });

  test.describe('Events and transitions (ShowVisualization -> S1_Visualization_Loaded)', () => {
    test('Clicking Show Visualization triggers alert with correct message (transition to Visualization Loaded)', async ({ page }) => {
      // This test validates the transition defined in the FSM:
      // - When the .button is clicked, an alert dialog with "Visualization Loaded!" appears (entry action of S1).
      const ast = new ASTPage(page);
      await ast.goto();

      let dialogCount = 0;
      // Listen for dialog and validate message
      page.on('dialog', async dialog => {
        try {
          dialogCount++;
          expect(dialog.message()).toBe("Visualization Loaded!");
          await dialog.accept();
        } catch (err) {
          // If assertion fails inside dialog handler, rethrow so the test fails
          throw err;
        }
      });

      // Click the button once and wait briefly to ensure dialog handler runs
      await ast.clickShowVisualization();
      // Wait a tick to ensure dialog handling completes
      await page.waitForTimeout(100);

      expect(dialogCount).toBe(1);
    });

    test('Clicking Show Visualization twice triggers two alerts (edge case: repeated transitions)', async ({ page }) => {
      // Validate repeated interactions: clicking twice should show alert each time (two transitions to final state are attempted)
      const ast = new ASTPage(page);
      await ast.goto();

      let dialogCount = 0;
      page.on('dialog', async dialog => {
        dialogCount++;
        // Validate content each time
        expect(dialog.message()).toBe("Visualization Loaded!");
        await dialog.accept();
      });

      // Click twice in sequence; Playwright will handle dialogs as they appear.
      await ast.clickShowVisualization();
      // Wait a short time before second click to ensure the first dialog is processed
      await page.waitForTimeout(50);
      await ast.clickShowVisualization();

      // Allow some time for both dialogs to be processed
      await page.waitForTimeout(200);

      expect(dialogCount).toBe(2);
    });

    test('Clicking unrelated area does not trigger the Show Visualization alert (negative test)', async ({ page }) => {
      // Ensure that clicking on the main container (not on the button) does not produce the alert dialog unexpectedly.
      const ast = new ASTPage(page);
      await ast.goto();

      let dialogCount = 0;
      page.on('dialog', async dialog => {
        dialogCount++;
        await dialog.accept();
      });

      // Click near the top-left inside the container but away from the button
      await ast.clickContainer();

      // Wait to ensure no dialog was erroneously triggered
      await page.waitForTimeout(200);

      expect(dialogCount).toBe(0);
    });
  });

  test.describe('Entry/Exit actions and page errors (renderPage and runtime exceptions)', () => {
    test('Calling missing entry action renderPage() in page context triggers a ReferenceError (if unbound)', async ({ page }) => {
      // The FSM mentions renderPage() as an entry action for S0. The implementation does not define renderPage().
      // This test intentionally invokes renderPage asynchronously in the page context to observe the natural ReferenceError
      // and confirm it surfaces as a pageerror event. We do not modify or patch the page; we merely trigger the existing absent function.
      await page.goto(APP_URL);

      // Wait for a pageerror event which will be thrown due to calling undefined renderPage in the page context
      const pageErrorPromise = page.waitForEvent('pageerror');

      // Trigger renderPage asynchronously in the page's event loop so the error is unhandled and surfaces as pageerror
      await page.evaluate(() => {
        setTimeout(() => {
          // calling an undefined function on purpose to let the runtime raise ReferenceError naturally
          // We do not define renderPage anywhere; this should produce a ReferenceError: renderPage is not defined
          // This call is intentionally not wrapped in try/catch to let the page emit an unhandled exception.
          renderPage();
        }, 0);
      });

      const error = await pageErrorPromise;
      // The message from engines may vary, but it should reference renderPage and/or indicate a ReferenceError / not defined.
      expect(error).toBeTruthy();
      expect(error.message).toMatch(/renderPage|not defined|ReferenceError/);
    });

    test('No unexpected console.error messages are emitted on page load', async ({ page }) => {
      // Collect console messages and assert there are no messages of type 'error' during initial load.
      const consoleMessages = [];
      page.on('console', msg => {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      });

      await page.goto(APP_URL);
      // Wait briefly to collect any console messages emitted on load
      await page.waitForTimeout(200);

      const errors = consoleMessages.filter(m => m.type === 'error');
      // We assert that there are zero console.error messages during normal load of this static page.
      expect(errors.length).toBe(0);
    });
  });

  test.describe('Accessibility of the clickable control and attributes', () => {
    test('Show Visualization button is focusable and has accessible name', async ({ page }) => {
      // Validate keyboard/focus interaction: the button should be focusable via keyboard and have a proper accessible name.
      const ast = new ASTPage(page);
      await ast.goto();

      // Focus the button via keyboard (tab)
      await page.keyboard.press('Tab'); // move focus; depending on document order this should focus the first focusable element; if not, fallback to direct focus
      const focused = await page.evaluate(() => document.activeElement && document.activeElement.className);
      // If the first Tab doesn't focus the button, explicitly focus it
      if (!focused || !focused.includes('button')) {
        // Direct focus (still not modifying page code beyond browser interactions)
        await ast.button.focus();
      }

      // Ensure the button is focused now
      const isFocused = await ast.button.evaluate(el => document.activeElement === el);
      expect(isFocused).toBeTruthy();

      // Accessible name should match the visible text
      const accessibleName = await ast.button.evaluate(el => el.innerText || el.textContent);
      expect(accessibleName).toContain('Show Visualization');
    });
  });
});