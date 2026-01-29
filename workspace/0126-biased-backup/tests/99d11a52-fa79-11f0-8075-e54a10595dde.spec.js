import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d11a52-fa79-11f0-8075-e54a10595dde.html';

// Page object for interacting with the decision tree app
class DecisionTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.question = page.locator('#question');
    this.result = page.locator('#result');
    this.fruitButton = page.locator("button[onclick=\"nextStep('fruit')\"]");
    this.vegetableButton = page.locator("button[onclick=\"nextStep('vegetable')\"]");
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async questionText() {
    return (await this.question.textContent())?.trim();
  }

  async resultText() {
    // normalize whitespace
    const txt = await this.result.textContent();
    return txt === null ? '' : txt.trim();
  }

  async clickFruit() {
    await this.fruitButton.click();
  }

  async clickVegetable() {
    await this.vegetableButton.click();
  }

  // Call the global nextStep function (do not inject/patch)
  async nextStep(selection) {
    // Evaluate using existing global function on the page
    await this.page.evaluate((s) => {
      // call existing nextStep if present; if not, this will throw naturally
      // as required by the constraints (do not patch or inject)
      // eslint-disable-next-line no-undef
      window.nextStep(s);
    }, selection);
  }

  // Wait until the app has reset to initial question and cleared result.
  async waitForReset(timeout = 6000) {
    await this.page.waitForFunction(() => {
      const q = document.getElementById('question');
      const r = document.getElementById('result');
      return q && r && q.innerText === 'Is it a fruit or vegetable?' && r.innerText === '';
    }, null, { timeout });
  }

  // Helpers to check presence/absence of yes/no buttons (they are not part of provided HTML)
  async yesButtonExists() {
    return await this.page.$("button[onclick=\"nextStep('yes')\"]") !== null;
  }

  async noButtonExists() {
    return await this.page.$("button[onclick=\"nextStep('no')\"]") !== null;
  }
}

test.describe('Interactive Decision Tree - Application ID: 99d11a52-fa79-11f0-8075-e54a10595dde', () => {
  // Capture runtime errors and console.error messages for each test run
  test.beforeEach(async ({ page }) => {
    // No-op here; listeners will be set up in each test to ensure isolation
  });

  test('Initial UI elements present and no runtime errors on load', async ({ page }) => {
    // Track page errors and console errors
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const dt = new DecisionTreePage(page);
    await dt.goto();

    // Verify main UI elements
    await expect(dt.fruitButton).toBeVisible();
    await expect(dt.vegetableButton).toBeVisible();

    // Initial question text and empty result
    expect(await dt.questionText()).toBe('Is it a fruit or vegetable?');
    expect(await dt.resultText()).toBe('');

    // The implementation does not include Yes/No buttons — verify they are absent
    expect(await dt.yesButtonExists()).toBe(false);
    expect(await dt.noButtonExists()).toBe(false);

    // Ensure there were no uncaught errors during load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('Fruit branch transitions and final results', () => {
    test('Fruit -> Citrus -> Small -> Orange result and reset occurs', async ({ page }) => {
      const pageErrors = [];
      const consoleErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err));
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      const dt = new DecisionTreePage(page);
      await dt.goto();

      // Select Fruit from the root
      await dt.clickFruit();
      expect(await dt.questionText()).toBe('Is it citrus?');

      // Simulate selecting 'Yes' to go to "Is it small?"
      // There are no Yes/No DOM buttons, but the global function is present; invoke it as the app expects.
      await dt.nextStep('yes');
      expect(await dt.questionText()).toBe('Is it small?');

      // Select 'Yes' to get a final result "You selected Orange"
      await dt.nextStep('yes');

      // After selecting the final answer the result should be displayed immediately
      expect(await dt.resultText()).toBe('You selected Orange');

      // The S5_Result exit action triggers reset(), which clears the result and restores the question after ~2000ms
      await dt.waitForReset(7000); // allow margin for reset timeout
      expect(await dt.questionText()).toBe('Is it a fruit or vegetable?');
      expect(await dt.resultText()).toBe('');

      // Ensure no uncaught runtime errors occurred during these transitions
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Fruit -> No -> Berry -> Strawberry and Mango results (both branches)', async ({ page }) => {
      const pageErrors = [];
      const consoleErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err));
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      const dt = new DecisionTreePage(page);

      // Test Strawberry branch
      await dt.goto();
      await dt.clickFruit();
      expect(await dt.questionText()).toBe('Is it citrus?');

      // Choose No -> moves to 'Is it a berry?'
      await dt.nextStep('no');
      expect(await dt.questionText()).toBe('Is it a berry?');

      // Choose Yes -> Strawberry
      await dt.nextStep('yes');
      expect(await dt.resultText()).toBe('You selected Strawberry');
      await dt.waitForReset(7000);
      expect(await dt.resultText()).toBe('');
      expect(await dt.questionText()).toBe('Is it a fruit or vegetable?');

      // Test Mango branch
      await dt.clickFruit();
      await dt.nextStep('no');
      expect(await dt.questionText()).toBe('Is it a berry?');

      // Choose No -> Mango
      await dt.nextStep('no');
      expect(await dt.resultText()).toBe('You selected Mango');
      await dt.waitForReset(7000);
      expect(await dt.resultText()).toBe('');
      expect(await dt.questionText()).toBe('Is it a fruit or vegetable?');

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Vegetable branch transitions and final results', () => {
    test('Vegetable -> Green -> Leafy -> Spinach and Broccoli results', async ({ page }) => {
      const pageErrors = [];
      const consoleErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err));
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      const dt = new DecisionTreePage(page);
      await dt.goto();

      // Select Vegetable
      await dt.clickVegetable();
      expect(await dt.questionText()).toBe('Is it green?');

      // Select Yes -> Is it leafy?
      await dt.nextStep('yes');
      expect(await dt.questionText()).toBe('Is it leafy?');

      // Yes -> Spinach
      await dt.nextStep('yes');
      expect(await dt.resultText()).toBe('You selected Spinach');
      await dt.waitForReset(7000);
      expect(await dt.resultText()).toBe('');
      expect(await dt.questionText()).toBe('Is it a fruit or vegetable?');

      // Test No -> Broccoli
      await dt.clickVegetable();
      await dt.nextStep('yes');
      await dt.nextStep('no');
      expect(await dt.resultText()).toBe('You selected Broccoli');
      await dt.waitForReset(7000);
      expect(await dt.resultText()).toBe('');
      expect(await dt.questionText()).toBe('Is it a fruit or vegetable?');

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Vegetable -> Not green -> Root -> Carrot and Cucumber results', async ({ page }) => {
      const pageErrors = [];
      const consoleErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err));
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      const dt = new DecisionTreePage(page);
      await dt.goto();

      // Select Vegetable -> No branch
      await dt.clickVegetable();
      expect(await dt.questionText()).toBe('Is it green?');

      await dt.nextStep('no');
      expect(await dt.questionText()).toBe('Is it root?');

      // Yes -> Carrot
      await dt.nextStep('yes');
      expect(await dt.resultText()).toBe('You selected Carrot');
      await dt.waitForReset(7000);
      expect(await dt.resultText()).toBe('');
      expect(await dt.questionText()).toBe('Is it a fruit or vegetable?');

      // No -> Cucumber
      await dt.clickVegetable();
      await dt.nextStep('no');
      await dt.nextStep('no');
      expect(await dt.resultText()).toBe('You selected Cucumber');
      await dt.waitForReset(7000);
      expect(await dt.resultText()).toBe('');
      expect(await dt.questionText()).toBe('Is it a fruit or vegetable?');

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test('Edge cases: invalid selection and missing DOM controls', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const dt = new DecisionTreePage(page);
    await dt.goto();

    // Attempt an invalid selection by calling nextStep with an unexpected key
    // This will cause currentNode[selection] to be undefined and displayResult(undefined)
    await dt.clickFruit();
    expect(await dt.questionText()).toBe('Is it citrus?');

    // Call with invalid selection - the app should display "undefined" (string) and then reset
    await dt.nextStep('not_a_choice');
    // DisplayResult sets innerText to undefined -> String "undefined"
    expect(await dt.resultText()).toBe('undefined');

    // The reset is scheduled, wait for it
    await dt.waitForReset(7000);
    expect(await dt.questionText()).toBe('Is it a fruit or vegetable?');
    expect(await dt.resultText()).toBe('');

    // Confirm the app did not accidentally create Yes/No DOM controls (they should remain absent)
    expect(await dt.yesButtonExists()).toBe(false);
    expect(await dt.noButtonExists()).toBe(false);

    // Validate that there were no unhandled page errors; if any runtime errors occurred they will be present
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Behavior when global nextStep is invoked without appropriate context', async ({ page }) => {
    // This test ensures that calling nextStep at root with selection that maps to a string
    // directly displays result and resets (we call an immediate terminal selection by simulating
    // a wrong use-case). We do not modify globals; we call what exists.
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const dt = new DecisionTreePage(page);
    await dt.goto();

    // Directly invoke a non-existing selection at root; this should try to display undefined and reset.
    await dt.nextStep('yes'); // root.yes is undefined in the provided tree
    expect(await dt.resultText()).toBe('undefined');
    await dt.waitForReset(7000);
    expect(await dt.resultText()).toBe('');
    expect(await dt.questionText()).toBe('Is it a fruit or vegetable?');

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});