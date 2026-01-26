import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72aac8a2-fa78-11f0-812d-c9788050701f.html';

/**
 * Page object for the Divide & Conquer visualization page.
 * Encapsulates interactions and common assertions for clarity and reuse.
 */
class AlgoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demoBtn = page.locator('#demoBtn');
    this.algoContainer = page.locator('.algo-container');
    this.subproblemContainer = page.locator('.subproblem-container');
    this.solutionContainer = page.locator('.solution-container');
    this.problemContainer = page.locator('.problem-container');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickDemo() {
    await this.demoBtn.click();
  }

  async getButtonText() {
    return (await this.demoBtn.textContent()).trim();
  }

  async isContainerActive() {
    return await this.algoContainer.evaluate((el) => el.classList.contains('active'));
  }

  async getComputedOpacityOf(locator) {
    return await locator.evaluate((el) => window.getComputedStyle(el).opacity);
  }

  async getComputedTransformOf(locator) {
    return await locator.evaluate((el) => window.getComputedStyle(el).transform);
  }

  // Wait for the initial "renderPage" animation to complete (the script uses a 300ms timeout).
  async waitForInitialAnimation(timeout = 2000) {
    await this.page.waitForFunction(() => {
      const el = document.querySelector('.problem-container');
      if (!el) return false;
      return window.getComputedStyle(el).opacity === '1';
    }, {}, { timeout });
  }
}

test.describe('Divide & Conquer Visualization - FSM tests (72aac8a2-fa78-11f0-812d-c9788050701f)', () => {
  // Arrays to capture console messages and page errors during navigation/interactions.
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors before each test
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (including errors) emitted by the page
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      // err is an Error object serialized from the page context
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Nothing special to tear down; listeners are tied to the Playwright page and will be disposed.
  });

  test.describe('State S0_Idle (Initial Render) validations', () => {
    test('Initial Idle state: button present, text correct, no active class, initial animation runs', async ({ page }) => {
      // Arrange
      const app = new AlgoPage(page);

      // Act: navigate to the page (listeners already attached in beforeEach to capture errors during load)
      await app.goto();

      // Assert: button exists with expected initial text
      await expect(app.demoBtn).toBeVisible();
      const btnText = await app.getButtonText();
      expect(btnText).toBe('Visualize Algorithm');

      // Assert: algorithm container should NOT have the active class in Idle
      const active = await app.isContainerActive();
      expect(active).toBeFalsy();

      // The solution container should be hidden (opacity 0) initially
      const solutionOpacity = await app.getComputedOpacityOf(app.solutionContainer);
      expect(['0', '0.0']).toContain(solutionOpacity);

      // The subproblem container has inline styles for transform/opacity initially.
      const subproblemOpacity = await app.getComputedOpacityOf(app.subproblemContainer);
      expect(['0', '0.0']).toContain(subproblemOpacity);

      // Wait for the initial animation that the script triggers after a short timeout (renderPage entry action).
      // This asserts that the entry action that manipulates problem-container styles runs.
      await app.waitForInitialAnimation();
      const problemOpacityAfter = await app.getComputedOpacityOf(app.problemContainer);
      expect(problemOpacityAfter).toBe('1');

      // Confirm there were no page errors during initial render
      expect(pageErrors.length).toBe(0);

      // Confirm there are no console 'error' type messages
      const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMsgs.length).toBe(0);
    });
  });

  test.describe('Transitions and visual changes (Button click events)', () => {
    test('Transition S0 -> S1 on first ButtonClick: .active added and button text changes', async ({ page }) => {
      const app = new AlgoPage(page);

      await app.goto();

      // Precondition: idle state
      expect(await app.isContainerActive()).toBeFalsy();
      expect(await app.getButtonText()).toBe('Visualize Algorithm');

      // Act: click the demo button to visualize algorithm
      await app.clickDemo();

      // Allow a small amount of time for DOM updates/transition (script toggles class synchronously, but CSS transitions can affect computed styles)
      await page.waitForTimeout(100);

      // Assert: container has active class
      expect(await app.isContainerActive()).toBeTruthy();

      // Assert: button text updated to 'Reset Visualization'
      expect(await app.getButtonText()).toBe('Reset Visualization');

      // Assert: subproblem container and solution container reflect "active" styles (opacity should be 1)
      const subOpacity = await app.getComputedOpacityOf(app.subproblemContainer);
      expect(parseFloat(subOpacity)).toBeGreaterThan(0.9);

      const solOpacity = await app.getComputedOpacityOf(app.solutionContainer);
      expect(parseFloat(solOpacity)).toBeGreaterThan(0.9);

      // Also validate transform for subproblem container changes towards identity (matrix for translateY(0) may be 'none' or a matrix)
      const subTransform = await app.getComputedTransformOf(app.subproblemContainer);
      // Accept 'none' or a matrix that corresponds to no translation; at minimum ensure it's not the initial translateY(-20px) inline transform
      expect(subTransform).not.toContain('-20');

      // Ensure no page-level JS errors occurred during clicking / toggling
      expect(pageErrors.length).toBe(0);
      const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMsgs.length).toBe(0);
    });

    test('Transition S1 -> S0 on second ButtonClick: .active removed and button text resets', async ({ page }) => {
      const app = new AlgoPage(page);

      await app.goto();

      // Toggle to active first
      await app.clickDemo();
      await page.waitForTimeout(100);
      expect(await app.isContainerActive()).toBeTruthy();
      expect(await app.getButtonText()).toBe('Reset Visualization');

      // Act: click again to reset
      await app.clickDemo();
      await page.waitForTimeout(100);

      // Assert: container is no longer active
      expect(await app.isContainerActive()).toBeFalsy();

      // Assert: button text returns to 'Visualize Algorithm'
      expect(await app.getButtonText()).toBe('Visualize Algorithm');

      // The solution container should be back to non-visible (opacity near 0)
      const solOpacity = await app.getComputedOpacityOf(app.solutionContainer);
      expect(parseFloat(solOpacity)).toBeLessThan(0.2);

      // Ensure no page-level JS errors occurred during toggling
      expect(pageErrors.length).toBe(0);
      const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMsgs.length).toBe(0);
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('Rapid repeated clicks toggle state consistently (parity determines final state)', async ({ page }) => {
      const app = new AlgoPage(page);
      await app.goto();

      // Rapidly click the button 5 times
      for (let i = 0; i < 5; i++) {
        await app.clickDemo();
      }

      // After 5 clicks, parity is odd => expected active
      await page.waitForTimeout(100);
      expect(await app.isContainerActive()).toBeTruthy();
      expect(await app.getButtonText()).toBe('Reset Visualization');

      // Now click one more time to make it even (6)
      await app.clickDemo();
      await page.waitForTimeout(100);
      expect(await app.isContainerActive()).toBeFalsy();
      expect(await app.getButtonText()).toBe('Visualize Algorithm');

      // Confirm no runtime errors were thrown during the rapid interactions
      expect(pageErrors.length).toBe(0);
      const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMsgs.length).toBe(0);
    });

    test('No unexpected ReferenceError/SyntaxError/TypeError occurred during page lifetime', async ({ page }) => {
      // This test explicitly inspects the collected pageErrors to ensure none are the critical error types called out.
      const app = new AlgoPage(page);
      await app.goto();

      // Do a few interactions to exercise the code paths
      await app.clickDemo();
      await page.waitForTimeout(50);
      await app.clickDemo();
      await page.waitForTimeout(50);

      // Now assert that if any errors were captured, they are not unexpected fatal runtime errors.
      // Preferably there should be zero page errors; if there are, they should be reported here for clarity.
      if (pageErrors.length > 0) {
        // Format a readable message for test failure to help debugging
        const descriptions = pageErrors.map(e => `${e.name}: ${e.message}`).join('\n');
        // Fail with collected errors
        throw new Error(`Captured page errors during interactions:\n${descriptions}`);
      }

      // Also ensure console doesn't contain messages indicating ReferenceError/SyntaxError/TypeError
      const errorConsoleTexts = consoleMessages
        .filter(m => m.type === 'error')
        .map(m => m.text);

      const forbiddenTerms = ['ReferenceError', 'SyntaxError', 'TypeError'];
      for (const txt of errorConsoleTexts) {
        for (const term of forbiddenTerms) {
          expect(txt).not.toContain(term);
        }
      }
    });
  });

  test.describe('FSM coverage checklist', () => {
    test('Covers S0_Idle entry action and both transitions described in FSM', async ({ page }) => {
      // This test explicitly ties the observed behavior to the FSM description:
      // - S0_Idle: renderPage() entry action that sets problem-container styles after delay
      // - ButtonClick transitions between S0_Idle <-> S1_Active with class toggling and button text change

      const app = new AlgoPage(page);
      await app.goto();

      // Validate S0_Idle evidence: the demo button presence and initial text
      expect(await app.getButtonText()).toBe('Visualize Algorithm');

      // Validate renderPage entry: after delay the problem-container opacity becomes 1
      await app.waitForInitialAnimation();
      expect(await app.getComputedOpacityOf(app.problemContainer)).toBe('1');

      // Validate S0 -> S1 (ButtonClick): toggles .active on algoContainer
      await app.clickDemo();
      await page.waitForTimeout(100);
      expect(await app.isContainerActive()).toBeTruthy();
      expect(await app.getButtonText()).toBe('Reset Visualization');

      // Validate S1 -> S0 (ButtonClick): toggles off and button text resets
      await app.clickDemo();
      await page.waitForTimeout(100);
      expect(await app.isContainerActive()).toBeFalsy();
      expect(await app.getButtonText()).toBe('Visualize Algorithm');

      // Final assertion: no runtime page errors were observed during this FSM exercise
      expect(pageErrors.length).toBe(0);
    });
  });
});