import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b21190-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page object encapsulating interactions with the Greedy Algorithm demo page
class GreedyPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.coinsInput = page.locator('#coinsInput');
    this.amountInput = page.locator('#amountInput');
    this.runButton = page.locator('#runGreedyBtn');
    this.resultEl = page.locator('#result');
    this.explanationEl = page.locator('#explanation');
    this.header = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'networkidle' });
  }

  async getHeaderText() {
    return (await this.header.textContent()) ?? '';
  }

  async getCoinsValue() {
    return await this.coinsInput.inputValue();
  }

  async setCoinsValue(value) {
    await this.coinsInput.fill(value);
  }

  async getAmountValue() {
    return await this.amountInput.inputValue();
  }

  async setAmountValue(value) {
    // value may be a string or number
    await this.amountInput.fill(String(value));
  }

  async clickRun() {
    await this.runButton.click();
    // Wait briefly for the handlers to update DOM
    // Use waitFor to observe the result element change if necessary
    await this.page.waitForTimeout(50);
  }

  async getResultText() {
    const txt = await this.resultEl.textContent();
    return txt === null ? '' : txt;
  }

  async getExplanationText(trim = true) {
    const txt = await this.explanationEl.textContent();
    if (txt === null) return '';
    return trim ? txt.trim() : txt;
  }
}

test.describe('Greedy Algorithm Demo - FSM and UI tests', () => {
  // Shared holders for console and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Intentionally attach listeners before navigation so we capture any early errors
    page._observedConsoleMessages = [];
    page._observedConsoleErrors = [];
    page._observedPageErrors = [];

    page.on('console', (msg) => {
      page._observedConsoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error' || msg.type() === 'warning') {
        page._observedConsoleErrors.push({ type: msg.type(), text: msg.text() });
      }
    });

    page.on('pageerror', (err) => {
      // err is an Error object
      page._observedPageErrors.push(err);
    });
  });

  // Helper to assert that no uncaught runtime errors or console error/warning were emitted.
  async function assertNoRuntimeErrors(page) {
    // Give a small grace to allow asynchronous errors to surface
    await page.waitForTimeout(20);
    const consoleErrors = page._observedConsoleErrors ?? [];
    const pageErrors = page._observedPageErrors ?? [];
    expect(consoleErrors.length, `Expected no console errors/warnings, got: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Expected no uncaught page errors, got: ${JSON.stringify(pageErrors)}`).toBe(0);
  }

  test.describe('Initial state (S0_Idle) validations', () => {
    test('renders header and default input values (verifies entry state evidence)', async ({ page }) => {
      // This test validates the initial "Idle" state evidence and default values
      const gp = new GreedyPage(page);
      await gp.goto();

      // Validate top header exists and matches FSM evidence
      const headerText = await gp.getHeaderText();
      expect(headerText).toContain('Greedy Algorithm Demonstration');

      // Validate default coins input and amount input values as per HTML attributes
      const coinsVal = await gp.getCoinsValue();
      expect(coinsVal).toBe('25,10,5,1');

      const amountVal = await gp.getAmountValue();
      expect(amountVal).toBe('87');

      // Result area should be empty initially
      const resultText = await gp.getResultText();
      expect(resultText.trim()).toBe('');

      // Explanation area contains only placeholder comment/whitespace initially
      const explanationText = await gp.getExplanationText();
      expect(explanationText).toBe('');

      // Assert no unexpected runtime errors occurred during load
      await assertNoRuntimeErrors(page);
    });
  });

  test.describe('RunGreedyAlgorithm event and transition to ResultDisplayed (S1_ResultDisplayed)', () => {
    test('clicking Run Greedy Algorithm with default inputs displays expected result and explanation', async ({ page }) => {
      // This test triggers the RunGreedyAlgorithm event and validates the transition outputs.
      const gp = new GreedyPage(page);
      await gp.goto();

      // Sanity check inputs are defaults
      expect(await gp.getCoinsValue()).toBe('25,10,5,1');
      expect(await gp.getAmountValue()).toBe('87');

      // Trigger event
      await gp.clickRun();

      // Expected exact formatted result (computed from the page's formatting logic)
      // For 87 with coins 25,10,5,1 greedy picks: 25 x3 (75), 10 x1 (85), 1 x2 (87) => total 6 coins
      const expectedResult =
`Coin 25¢ : 3 coins
Coin 10¢ : 1 coin
Coin 1¢ : 2 coins

Total coins used: 6`;
      const actualResult = (await gp.getResultText()).replace(/\r\n/g, '\n');
      expect(actualResult).toBe(expectedResult);

      // Explanation text should mention the amount and the sorted coins list
      const explanation = await gp.getExplanationText();
      expect(explanation).toContain('Steps taken for amount 87¢');
      expect(explanation).toContain('Using coins sorted in descending order: 25, 10, 5, 1');

      // Ensure no runtime errors were produced by clicking and computing
      await assertNoRuntimeErrors(page);
    });

    test('transition evidence: result and explanation updated after running algorithm', async ({ page }) => {
      // This test double-checks that the page sets both #result and #explanation as part of the transition
      const gp = new GreedyPage(page);
      await gp.goto();

      // Ensure earlier they are empty
      expect((await gp.getResultText()).trim()).toBe('');
      expect((await gp.getExplanationText())).toBe('');

      // Run algorithm
      await gp.clickRun();

      // Both elements should now be non-empty
      const res = await gp.getResultText();
      const expl = await gp.getExplanationText();
      expect(res.trim().length).toBeGreaterThan(0);
      expect(expl.trim().length).toBeGreaterThan(0);

      // Additional checks for expected substrings in each
      expect(res).toContain('Total coins used');
      expect(expl).toContain('greedy approach works optimally');

      await assertNoRuntimeErrors(page);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('invalid inputs show validation message and clear explanation', async ({ page }) => {
      // This test verifies behavior when inputs are invalid (empty or non-positive)
      const gp = new GreedyPage(page);
      await gp.goto();

      // Set invalid coins and amount
      await gp.setCoinsValue('   '); // effectively empty after trimming/splitting
      await gp.setAmountValue(''); // empty amount input

      await gp.clickRun();

      // Should display a validation message in result and clear explanation
      const res = await gp.getResultText();
      const expl = await gp.getExplanationText();
      expect(res).toBe('Please enter valid positive coin denominations and amount.');
      expect(expl).toBe('');

      await assertNoRuntimeErrors(page);
    });

    test('greedy algorithm fails to find solution for certain coin sets (returns null) and displays message', async ({ page }) => {
      // This test uses a coin system where greedy fails but another combination would work:
      // coins = [4,3], amount = 6 -> greedy picks 4 then fails, although 3+3 is possible.
      const gp = new GreedyPage(page);
      await gp.goto();

      await gp.setCoinsValue('4,3');
      await gp.setAmountValue('6');

      await gp.clickRun();

      const res = await gp.getResultText();
      const expl = await gp.getExplanationText();

      // The application is expected to indicate greedy failure with a specific message
      expect(res).toBe('No solution possible using this greedy approach.');
      expect(expl).toContain('was unable to make exact change');
      expect(expl).toContain('6¢');

      await assertNoRuntimeErrors(page);
    });
  });

  test.describe('Observability: console and page error capture', () => {
    test('no console.error or uncaught page errors emitted during load and interactions', async ({ page }) => {
      // Attach page object and listeners already in beforeEach
      const gp = new GreedyPage(page);
      await gp.goto();

      // Interact with page to exercise code paths
      await gp.clickRun();
      await gp.setCoinsValue('4,3');
      await gp.setAmountValue('6');
      await gp.clickRun();
      await gp.setCoinsValue('');
      await gp.setAmountValue('');
      await gp.clickRun();

      // Wait a little to allow any asynchronous errors to surface
      await page.waitForTimeout(50);

      // Validate that we captured no console errors (type 'error' or 'warning') and no page errors
      const consoleErrors = page._observedConsoleErrors ?? [];
      const pageErrors = page._observedPageErrors ?? [];
      expect(consoleErrors.length, `Console errors/warnings were emitted: ${JSON.stringify(page._observedConsoleMessages)}`).toBe(0);
      expect(pageErrors.length, `Uncaught page errors were emitted: ${JSON.stringify(pageErrors)}`).toBe(0);
    });
  });
});