import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/176254d1-d5c1-11f0-938c-19d14b60ef51.html';

/**
 * Page Object for the Deque application.
 * Encapsulates selectors and common interactions to keep tests readable.
 */
class DequePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.addFrontBtn = page.locator("button[onclick='addFront()']");
    this.addBackBtn = page.locator("button[onclick='addBack()']");
    this.removeFrontBtn = page.locator("button[onclick='removeFront()']");
    this.removeBackBtn = page.locator("button[onclick='removeBack()']");
    this.frontInput = page.locator('#frontInput');
    this.backInput = page.locator('#backInput');
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async addFront(value) {
    await this.frontInput.fill(value);
    await this.addFrontBtn.click();
  }

  async addBack(value) {
    await this.backInput.fill(value);
    await this.addBackBtn.click();
  }

  async removeFront() {
    await this.removeFrontBtn.click();
  }

  async removeBack() {
    await this.removeBackBtn.click();
  }

  async getOutputText() {
    return (await this.output.textContent()) ?? '';
  }

  async getFrontInputValue() {
    return await this.frontInput.inputValue();
  }

  async getBackInputValue() {
    return await this.backInput.inputValue();
  }
}

test.describe('Deque Implementation in JavaScript - Interactive E2E', () => {
  // Collect console messages and page errors for observation and assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console events
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page-level uncaught exceptions
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test assert that there were no unexpected console errors or page errors.
    // The application provided appears correct; this ensures we observe runtime issues if they occur.
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errorConsoleMessages.length, `Console error/warning messages: ${JSON.stringify(errorConsoleMessages)}`).toBe(0);
    expect(pageErrors.length, `Page errors: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
  });

  test.describe('Initial State - S0_Initial', () => {
    test('Initial render shows controls and empty output (Initial State)', async ({ page }) => {
      // Validate initial presence of UI elements and that the output area is empty before any operations.
      const app = new DequePage(page);
      await app.goto();

      // Buttons should be visible
      await expect(app.addFrontBtn).toBeVisible();
      await expect(app.addBackBtn).toBeVisible();
      await expect(app.removeFrontBtn).toBeVisible();
      await expect(app.removeBackBtn).toBeVisible();

      // Inputs should have correct placeholders and be empty
      await expect(app.frontInput).toBeVisible();
      await expect(app.frontInput).toHaveAttribute('placeholder', 'Value for front');
      await expect(app.backInput).toBeVisible();
      await expect(app.backInput).toHaveAttribute('placeholder', 'Value for back');

      expect(await app.getFrontInputValue()).toBe('');
      expect(await app.getBackInputValue()).toBe('');

      // Output should be empty initially (updateOutput not called on load in the provided HTML)
      const initialOutput = await app.getOutputText();
      expect(initialOutput).toBe('', 'Expected output to be empty before any operation.');
    });
  });

  test.describe('Add Operations - transitions from S0_Initial to S1_Updated', () => {
    test('Add to Front updates deque and clears input (AddToFront)', async ({ page }) => {
      // This test validates the AddToFront event and the S1_Updated state's updateOutput behavior.
      const app = new DequePage(page);
      await app.goto();

      // Add a single item to front
      await app.addFront('A');

      // Output should reflect the new deque
      await expect(app.output).toHaveText('Current Deque: A');

      // The front input should be cleared after successful add
      expect(await app.getFrontInputValue()).toBe('');
    });

    test('Add to Back updates deque and clears input (AddToBack)', async ({ page }) => {
      // Validate adding to back and correct ordering with prior front addition
      const app = new DequePage(page);
      await app.goto();

      // Start with an addFront so we can test ordering when adding to back
      await app.addFront('X'); // deque: X

      // Add to back
      await app.addBack('Y'); // deque: X, Y

      await expect(app.output).toHaveText('Current Deque: X, Y');
      expect(await app.getBackInputValue()).toBe('');
    });

    test('Add multiple items to front and back results in correct ordering', async ({ page }) => {
      // Add sequence: addBack(2), addFront(1), addBack(3) => deque should be 1, 2, 3
      const app = new DequePage(page);
      await app.goto();

      await app.addBack('2');   // [2]
      await app.addFront('1');  // [1,2]
      await app.addBack('3');   // [1,2,3]

      await expect(app.output).toHaveText('Current Deque: 1, 2, 3');
    });

    test('Adding empty input does not modify deque (edge case)', async ({ page }) => {
      // Ensure clicking add when input empty does nothing and does not throw errors.
      const app = new DequePage(page);
      await app.goto();

      // Click addFront with empty input
      await app.addFront(''); // should be ignored
      // Since updateOutput is not called here (input empty), output remains empty
      expect(await app.getOutputText()).toBe('');

      // Click addBack with empty input
      await app.addBack(''); // should be ignored
      expect(await app.getOutputText()).toBe('');
    });
  });

  test.describe('Remove Operations - transitions within S1_Updated', () => {
    test('Remove from Front after multiple adds updates deque (RemoveFromFront)', async ({ page }) => {
      // Validate removal from front in an updated state and that output updates correctly.
      const app = new DequePage(page);
      await app.goto();

      // Build deque: addFront(1) => [1], addBack(2) => [1,2], addBack(3) => [1,2,3]
      await app.addFront('1');
      await app.addBack('2');
      await app.addBack('3');

      await expect(app.output).toHaveText('Current Deque: 1, 2, 3');

      // Remove from front -> should remove '1'
      await app.removeFront();

      await expect(app.output).toHaveText('Current Deque: 2, 3');
    });

    test('Remove from Back after multiple adds updates deque (RemoveFromBack)', async ({ page }) => {
      // Validate removal from back and that output shows remaining items.
      const app = new DequePage(page);
      await app.goto();

      // Build deque: addFront(1), addBack(2), addBack(3) => [1,2,3]
      await app.addFront('1');
      await app.addBack('2');
      await app.addBack('3');

      await expect(app.output).toHaveText('Current Deque: 1, 2, 3');

      // Remove from back -> should remove '3'
      await app.removeBack();

      await expect(app.output).toHaveText('Current Deque: 1, 2');
    });

    test('Removing from empty deque does not throw and sets output to "Current Deque: " (edge case)', async ({ page }) => {
      // This verifies behaviour when removeFront/removeBack are invoked while deque is empty.
      const app = new DequePage(page);
      await app.goto();

      // Remove from front when empty: updateOutput will be called and produce "Current Deque: "
      await app.removeFront();
      await expect(app.output).toHaveText('Current Deque: ');

      // Clear captured console and page errors mid-test to ensure we continue to assert none afterwards
      // (no modifications to the app are done; just ensuring no exceptions occurred)
      // Remove from back when empty should behave similarly
      await app.removeBack();
      await expect(app.output).toHaveText('Current Deque: ');
    });

    test('Sequence of operations results in expected final deque', async ({ page }) => {
      // Complex sequence combining adds/removes and verifying intermediate states map to FSM transitions.
      const app = new DequePage(page);
      await app.goto();

      // Start empty
      await expect(app.output).toHaveText('');

      // Add back A -> [A]
      await app.addBack('A');
      await expect(app.output).toHaveText('Current Deque: A');

      // Add front B -> [B, A]
      await app.addFront('B');
      await expect(app.output).toHaveText('Current Deque: B, A');

      // Remove back -> removes A => [B]
      await app.removeBack();
      await expect(app.output).toHaveText('Current Deque: B');

      // Remove front -> removes B => []
      await app.removeFront();
      await expect(app.output).toHaveText('Current Deque: ');
    });
  });

  test.describe('Observability - Console and Page Errors', () => {
    test('No uncaught exceptions or console errors during typical flows', async ({ page }) => {
      // This test performs a few typical flows and then asserts that no console errors or page errors occurred.
      const app = new DequePage(page);
      await app.goto();

      // Perform a few operations
      await app.addFront('alpha');
      await app.addBack('beta');
      await app.removeFront();
      await app.removeBack();

      // After the interactions above, ensure the output is as expected (empty)
      await expect(app.output).toHaveText('Current Deque: ');

      // Also assert we observed no page errors or console error messages
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
      expect(errorConsoleMessages.length, `Console error/warning messages: ${JSON.stringify(errorConsoleMessages)}`).toBe(0);
      expect(pageErrors.length, `Page errors: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
    });
  });
});