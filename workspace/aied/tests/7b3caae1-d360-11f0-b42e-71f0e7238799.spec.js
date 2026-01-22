import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3caae1-d360-11f0-b42e-71f0e7238799.html';

// Page Object for the Two Pointers app
class TwoPointersPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayInput = page.locator('#arrayInput');
    this.targetInput = page.locator('#targetInput');
    this.findButton = page.locator('button[onclick="findPairs()"]');
    this.result = page.locator('#result');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async enterArray(value) {
    await this.arrayInput.fill(value);
  }

  async enterTarget(value) {
    await this.targetInput.fill(value);
  }

  async clickFind() {
    await this.findButton.click();
  }

  async getResultText() {
    return (await this.result.textContent()) ?? '';
  }
}

test.describe('Two Pointers Technique - FSM and UI tests', () => {
  // Arrays to collect console errors and page errors observed during navigation/interactions
  let consoleErrors = [];
  let pageErrors = [];

  // Hook to reset collectors before each test and attach listeners
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console 'error' messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location(),
        });
      }
    });

    // Capture uncaught exceptions in the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test we assert there were no unexpected runtime errors in the page
    // This validates that the page loaded and executed without throwing ReferenceError/SyntaxError/TypeError
    expect(pageErrors.length, `Expected no page errors, but got: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `Expected no console.error messages, but got: ${consoleErrors.map(c => c.text).join('; ')}`).toBe(0);
  });

  test.describe('S0_Idle (Initial state) validations', () => {
    test('Idle state: inputs, button and result container are present and empty', async ({ page }) => {
      // Validate presence of UI components in idle state
      const app = new TwoPointersPage(page);
      await app.goto();

      // Inputs and button should be visible
      await expect(app.arrayInput).toBeVisible();
      await expect(app.targetInput).toBeVisible();
      await expect(app.findButton).toBeVisible();

      // Result container should initially be empty
      await expect(app.result).toBeVisible();
      const text = await app.getResultText();
      expect(text.trim()).toBe('', 'Expected result container to be empty in the Idle state');
    });
  });

  test.describe('S1_InputReceived and validation transitions', () => {
    test('Clicking Find Pairs with both inputs empty triggers alert (InputValidationFail -> S1_InputReceived)', async ({ page }) => {
      // This test validates the validation branch that shows an alert when inputs are missing.
      const app = new TwoPointersPage(page);
      await app.goto();

      // Listen for dialog and capture its message
      let dialogMessage = null;
      page.once('dialog', async (dialog) => {
        dialogMessage = dialog.message();
        await dialog.dismiss();
      });

      // Click the button with both inputs empty
      await app.clickFind();

      // Ensure an alert was shown with the expected message
      expect(dialogMessage).toBe('Please enter both the array and target value.');
      // Result should remain empty after validation alert
      const resultText = await app.getResultText();
      expect(resultText.trim()).toBe('', 'Result should remain empty when validation fails');
    });

    test('Clicking Find Pairs with array filled but target missing shows alert', async ({ page }) => {
      // Validate alert when one input is missing (array provided, target missing)
      const app = new TwoPointersPage(page);
      await app.goto();

      let dialogMessage = null;
      page.once('dialog', async (dialog) => {
        dialogMessage = dialog.message();
        await dialog.dismiss();
      });

      await app.enterArray('1,2,3,4,5');
      await app.clickFind();

      expect(dialogMessage).toBe('Please enter both the array and target value.');
      const resultText = await app.getResultText();
      expect(resultText.trim()).toBe('', 'Result should remain empty when validation fails with missing target');
    });

    test('Clicking Find Pairs with target filled but array missing shows alert', async ({ page }) => {
      // Validate alert when array is missing but target provided
      const app = new TwoPointersPage(page);
      await app.goto();

      let dialogMessage = null;
      page.once('dialog', async (dialog) => {
        dialogMessage = dialog.message();
        await dialog.dismiss();
      });

      await app.enterTarget('6');
      await app.clickFind();

      expect(dialogMessage).toBe('Please enter both the array and target value.');
      const resultText = await app.getResultText();
      expect(resultText.trim()).toBe('', 'Result should remain empty when validation fails with missing array');
    });
  });

  test.describe('S2_PairsFound and S3_NoPairsFound (final states)', () => {
    test('Pairs found: input sorted array and target returns expected pairs (S2_PairsFound)', async ({ page }) => {
      // Test the positive path where pairs exist
      const app = new TwoPointersPage(page);
      await app.goto();

      await app.enterArray('1,2,3,4,5');
      await app.enterTarget('6');
      await app.clickFind();

      const resultText = await app.getResultText();
      // Implementation formats pairs like: Pairs that sum to 6: (1, 5), (2, 4)
      expect(resultText.trim()).toBe('Pairs that sum to 6: (1, 5), (2, 4)');
    });

    test('No pairs found: returns expected message (S3_NoPairsFound)', async ({ page }) => {
      // Test the negative path where no pairs exist
      const app = new TwoPointersPage(page);
      await app.goto();

      await app.enterArray('1,2,3');
      await app.enterTarget('10');
      await app.clickFind();

      const resultText = await app.getResultText();
      expect(resultText.trim()).toBe('No pairs found that sum to 10.');
    });

    test('Unsorted input is sorted internally and pairs still found (edge case)', async ({ page }) => {
      // Ensure that even if user supplies an unsorted array, the algorithm sorts and finds pairs
      const app = new TwoPointersPage(page);
      await app.goto();

      await app.enterArray('5,1,4,2'); // unsorted, but contains pairs summing to 6
      await app.enterTarget('6');
      await app.clickFind();

      const resultText = await app.getResultText();
      expect(resultText.trim()).toBe('Pairs that sum to 6: (1, 5), (2, 4)');
    });

    test('Non-numeric array and/or target values lead to NaN handling (edge case)', async ({ page }) => {
      // This checks how the implementation handles non-numeric inputs: it will produce NaN target and ultimately "No pairs found that sum to NaN."
      const app = new TwoPointersPage(page);
      await app.goto();

      await app.enterArray('a,b,c');
      await app.enterTarget('not-a-number');
      await app.clickFind();

      const resultText = await app.getResultText();
      // Implementation will coerce target to Number -> NaN, pairs length likely 0 -> show No pairs found that sum to NaN.
      expect(resultText.trim()).toBe('No pairs found that sum to NaN.');
    });
  });

  test.describe('FSM Transition Coverage and additional interactions', () => {
    test('Repeated clicks do not produce unexpected behavior and update result consistently', async ({ page }) => {
      // This test clicks multiple times and validates idempotence and correct updates
      const app = new TwoPointersPage(page);
      await app.goto();

      await app.enterArray('1,2,3,4,5');
      await app.enterTarget('6');

      // First click (expected pairs)
      await app.clickFind();
      let text1 = await app.getResultText();
      expect(text1.trim()).toBe('Pairs that sum to 6: (1, 5), (2, 4)');

      // Second click without changing inputs should produce same output
      await app.clickFind();
      let text2 = await app.getResultText();
      expect(text2.trim()).toBe('Pairs that sum to 6: (1, 5), (2, 4)');

      // Change target to a value with no pairs
      await app.enterTarget('100');
      await app.clickFind();
      let text3 = await app.getResultText();
      expect(text3.trim()).toBe('No pairs found that sum to 100.');
    });
  });
});